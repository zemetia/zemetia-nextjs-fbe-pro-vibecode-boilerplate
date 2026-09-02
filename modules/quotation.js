// ==========================================
// Quotation Module
// Manage sales quotations/proposals
// ==========================================

const Quotation = {
    quotations: [],

    init() {
        this.loadQuotations();
    },

    loadQuotations() {
        this.quotations = Storage.getQuotations();
    },

    async saveQuotations() {
        await Storage.saveQuotations(this.quotations);
    },

    async generateQuoteNumber() {
        // ☁️ Use Atomic Cloud Sequencer
        const nextRef = await Storage.getNextReferenceNumber('QTN');
        if (nextRef) return nextRef;

        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const count = this.quotations.filter(q => q.quoteNumber && q.quoteNumber.startsWith(`QT-${year}${month}`)).length + 1;
        return `QT-${year}${month}-${String(count).padStart(4, '0')}`;
    },

    async createQuotation(quoteData) {
        // Check KYC status first
        if (typeof CustomerKYC !== 'undefined' && quoteData.customer) {
            const kycCheck = CustomerKYC.checkKYCStatus(quoteData.customer);
            if (!kycCheck.approved) {
                alert(`⚠️ KYC Verification Required\n\nCannot create quotation: ${kycCheck.reason}.\nPlease complete KYC verification first.`);
                return {
                    success: false,
                    errors: { kyc: kycCheck.reason }
                };
            }
        }

        // Validate items
        if (!quoteData.items || !Array.isArray(quoteData.items) || quoteData.items.length === 0) {
            return { success: false, errors: { items: 'At least one item is required' } };
        }

        const quote = {
            id: Date.now(),
            quoteNumber: await this.generateQuoteNumber(),
            customer: quoteData.customer,
            customerName: quoteData.customerName,
            quoteDate: quoteData.quoteDate,
            validUntil: quoteData.validUntil,
            items: quoteData.items.map(item => ({
                itemId: item.itemId,
                itemCode: item.itemCode,
                itemName: item.itemName,
                description: item.description || '',
                quantity: parseFloat(item.quantity),
                unit: item.unit,
                unitPrice: parseFloat(item.unitPrice),
                discount: parseFloat(item.discount || 0),
                subtotal: (parseFloat(item.quantity) * parseFloat(item.unitPrice)) - parseFloat(item.discount || 0)
            })),
            subtotal: 0,
            discount: parseFloat(quoteData.discount || 0),
            taxRate: parseFloat(quoteData.taxRate || 0),
            taxAmount: 0,
            total: 0,
            notes: quoteData.notes || '',
            terms: quoteData.terms || '',
            status: 'draft', // draft, sent, accepted, rejected, expired
            createdBy: Auth?.getCurrentUser?.()?.username || 'system',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        quote.subtotal = quote.items.reduce((sum, item) => sum + item.subtotal, 0);
        quote.taxAmount = (quote.subtotal - quote.discount) * (quote.taxRate / 100);
        quote.total = quote.subtotal - quote.discount + quote.taxAmount;

        this.quotations.unshift(quote);
        this.saveQuotations();

        if (typeof AuditLog !== 'undefined') {
            AuditLog.logCreate('quotation', quote.quoteNumber, { total: quote.total });
        }

        return { success: true, quote };
    },

    convertToSalesOrder(id) {
        const quote = this.quotations.find(q => q.id === id);
        if (!quote) {
            return { success: false, error: 'Quotation not found' };
        }

        if (quote.status !== 'accepted') {
            return { success: false, error: 'Only accepted quotations can be converted to sales orders' };
        }

        // Create sales order
        if (typeof SalesOrder !== 'undefined') {
            const orderData = {
                customer: quote.customer,
                customerName: quote.customerName,
                orderDate: new Date().toISOString().split('T')[0],
                items: quote.items,
                discount: quote.discount,
                taxRate: quote.taxRate,
                notes: `Converted from ${quote.quoteNumber}\n${quote.notes}`
            };

            const result = SalesOrder.createOrder(orderData);

            if (result.success) {
                quote.status = 'converted';
                quote.convertedToSO = result.order.soNumber;
                this.saveQuotations();

                return { success: true, order: result.order };
            }
        }

        return { success: false, error: 'Failed to create sales order' };
    },

    changeStatus(id, newStatus) {
        const quote = this.quotations.find(q => q.id === id);
        if (!quote) {
            return { success: false, error: 'Quotation not found' };
        }

        quote.status = newStatus;
        quote.updatedAt = new Date().toISOString();

        if (newStatus === 'sent') {
            quote.sentDate = new Date().toISOString();
        }

        this.saveQuotations();

        if (typeof AuditLog !== 'undefined') {
            AuditLog.logUpdate('quotation', quote.quoteNumber, { status: newStatus });
        }

        return { success: true, quote };
    },

    render() {
        return `
            <div class="quotation-module">
                <div class="page-header">
                    <h1 class="page-title">Quotations</h1>
                    <div class="page-actions">
                        <button onclick="Quotation.showCreateModal()" class="btn btn-primary">
                            ➕ Create Quotation
                        </button>
                    </div>
                </div>

                ${this.renderQuotationList()}
            </div>
        `;
    },

    renderQuotationList() {
        const quotes = this.quotations;

        return `
            <div class="card">
                <div class="card-header">
                    <h3>Quotations</h3>
                </div>
                <div class="card-body">
                    ${quotes.length === 0 ? `
                        <div style="text-align: center; padding: 40px; color: var(--color-gray-600);">
                            <div style="font-size: 48px; margin-bottom: 16px;">📄</div>
                            <div>No quotations yet</div>
                        </div>
                    ` : `
                        <div class="table-responsive">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>Quote #</th>
                                        <th>Date</th>
                                        <th>Customer</th>
                                        <th>Valid Until</th>
                                        <th>Total</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${quotes.map(quote => `
                                        <tr>
                                            <td><strong>${quote.quoteNumber}</strong></td>
                                            <td>${new Date(quote.quoteDate).toLocaleDateString('id-ID')}</td>
                                            <td>${quote.customerName}</td>
                                            <td>${new Date(quote.validUntil).toLocaleDateString('id-ID')}</td>
                                            <td>${this.formatCurrency(quote.total)}</td>
                                            <td>${this.renderStatusBadge(quote.status)}</td>
                                            <td>
                                                <button onclick="Quotation.showDetail(${quote.id})" class="btn btn-sm btn-secondary">
                                                    View
                                                </button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    `}
                </div>
            </div>
        `;
    },

    renderStatusBadge(status) {
        const badges = {
            'draft': '<span class="badge badge-secondary">Draft</span>',
            'sent': '<span class="badge badge-info">Sent</span>',
            'accepted': '<span class="badge badge-success">Accepted</span>',
            'rejected': '<span class="badge badge-danger">Rejected</span>',
            'expired': '<span class="badge badge-warning">Expired</span>',
            'converted': '<span class="badge badge-primary">Converted</span>'
        };
        return badges[status] || status;
    },

    showCreateModal() {
        alert('Quotation creation modal - Similar to Sales Order');
    },

    showDetail(id) {
        const quote = this.quotations.find(q => q.id === id);
        if (!quote) return;

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px;">
                <div class="modal-header">
                    <h2>Quotation: ${quote.quoteNumber}</h2>
                    <button onclick="this.closest('.modal').remove()" class="close-btn">×</button>
                </div>
                <div class="modal-body">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px;">
                        <div>
                            <h4>Customer: ${quote.customerName}</h4>
                            <p>Date: ${new Date(quote.quoteDate).toLocaleDateString('id-ID')}</p>
                            <p>Valid Until: ${new Date(quote.validUntil).toLocaleDateString('id-ID')}</p>
                        </div>
                        <div>
                            <p>Status: ${this.renderStatusBadge(quote.status)}</p>
                            <p>Total: <strong>${this.formatCurrency(quote.total)}</strong></p>
                        </div>
                    </div>

                    <h4>Items</h4>
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Item</th>
                                <th>Qty</th>
                                <th>Unit Price</th>
                                <th>Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${quote.items.map(item => `
                                <tr>
                                    <td>${item.itemName}</td>
                                    <td>${item.quantity} ${item.unit}</td>
                                    <td>${this.formatCurrency(item.unitPrice)}</td>
                                    <td>${this.formatCurrency(item.subtotal)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="modal-footer">
                    ${quote.status === 'accepted' ? `
                        <button onclick="Quotation.convertToSalesOrder(${quote.id}); this.closest('.modal').remove(); App.navigateTo('sales-order');" class="btn btn-success">
                            Convert to Sales Order
                        </button>
                    ` : ''}
                    <button onclick="this.closest('.modal').remove()" class="btn btn-secondary">Close</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    }
};


// Explicitly make Quotation globally available
window.Quotation = Quotation;
