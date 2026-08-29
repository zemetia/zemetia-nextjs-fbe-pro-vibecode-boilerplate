// ==========================================
// Supplier Invoice Module
// Manage supplier invoices with 3-way matching
// ==========================================

const SupplierInvoice = {
    invoices: [],
    currentInvoice: null,

    statuses: {
        draft: 'Draft',
        submitted: 'Submitted',
        matched: 'Matched',
        discrepancy: 'Discrepancy',
        approved: 'Approved',
        paid: 'Paid',
        rejected: 'Rejected'
    },

    init() {
        this.loadInvoices();
    },

    loadInvoices() {
        this.invoices = Storage.getSupplierInvoices();
    },

    saveInvoices() {
        Storage.saveSupplierInvoices(this.invoices);
    },

    generateInvoiceNumber() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');

        const invs = this.invoices.filter(i =>
            i.invoiceNumber.startsWith(`INV-${year}${month}`)
        );

        const nextNum = String(invs.length + 1).padStart(4, '0');
        return `INV-${year}${month}-${nextNum}`;
    },

    createInvoice(data) {
        // Validate required fields
        if (!data.supplierId || !data.supplierInvoiceNumber || !data.poId) {
            return {
                success: false,
                errors: { validation: 'Supplier, Invoice Number, and PO are required' }
            };
        }

        // Get PO and GR
        const po = PurchaseOrder.getOrder(data.poId);
        if (!po) {
            return { success: false, errors: { po: 'Purchase Order not found' } };
        }

        const gr = GoodsReceipt.getGRByPO(data.poId)[0];
        if (!gr) {
            return { success: false, errors: { gr: 'Goods Receipt not found for this PO' } };
        }

        const invoice = {
            id: Date.now(),
            invoiceNumber: this.generateInvoiceNumber(),
            supplierInvoiceNumber: data.supplierInvoiceNumber,
            supplierId: data.supplierId,
            supplierName: data.supplierName,
            invoiceDate: data.invoiceDate || new Date().toISOString().split('T')[0],
            dueDate: data.dueDate,

            // Links
            poId: po.id,
            poNumber: po.poNumber,
            grId: gr.id,
            grNumber: gr.grNumber,

            items: data.items.map(item => ({
                itemId: item.itemId,
                itemCode: item.itemCode,
                itemName: item.itemName,
                quantity: parseFloat(item.quantity),
                unit: item.unit,
                unitPrice: parseFloat(item.unitPrice),
                subtotal: parseFloat(item.quantity) * parseFloat(item.unitPrice)
            })),

            subtotal: 0,
            taxRate: parseFloat(data.taxRate || 11),
            taxAmount: 0,
            total: 0,

            // 3-Way Matching
            matchingStatus: 'pending',
            matchingResult: null,
            matchingApprovedBy: null,
            matchingApprovedAt: null,

            // Payment
            paymentStatus: 'unpaid',
            paidAmount: 0,
            paymentVoucherId: null,

            status: 'draft',
            notes: data.notes || '',
            createdBy: Auth.getCurrentUser() ? Auth.getCurrentUser().id : 'SYSTEM',
            createdByName: Auth.getCurrentUser() ? Auth.getCurrentUser().name : 'System User',
            createdAt: new Date().toISOString()
        };

        // Calculate totals
        invoice.subtotal = invoice.items.reduce((sum, item) => sum + item.subtotal, 0);
        invoice.taxAmount = invoice.subtotal * (invoice.taxRate / 100);
        invoice.total = invoice.subtotal + invoice.taxAmount;

        this.invoices.push(invoice);
        this.saveInvoices();

        AuditLog.log('create', 'supplier_invoice', invoice.id,
            `Created invoice ${invoice.invoiceNumber} from ${invoice.supplierName}`);

        return { success: true, invoice };
    },

    submitForMatching(invoiceId) {
        const invoice = this.getInvoice(invoiceId);
        if (!invoice) {
            return { success: false, errors: { invoice: 'Invoice not found' } };
        }

        if (invoice.status !== 'draft') {
            return { success: false, errors: { status: 'Can only submit draft invoices' } };
        }

        // Perform 3-way matching
        const matchingResult = ThreeWayMatching.performMatch(
            invoice.poId,
            invoice.grId,
            invoiceId
        );

        invoice.matchingResult = matchingResult;
        invoice.matchingStatus = matchingResult.matched ? 'matched' : 'discrepancy';
        invoice.status = matchingResult.matched ? 'matched' : 'discrepancy';
        invoice.submittedAt = new Date().toISOString();

        this.saveInvoices();

        AuditLog.log('update', 'supplier_invoice', invoiceId,
            `3-way matching ${matchingResult.matched ? 'passed' : 'failed'}`);

        return { success: true, invoice, matchingResult };
    },

    approveDiscrepancy(invoiceId, notes) {
        const invoice = this.getInvoice(invoiceId);
        if (!invoice) {
            return { success: false, errors: { invoice: 'Invoice not found' } };
        }

        if (invoice.matchingStatus !== 'discrepancy') {
            return { success: false, errors: { status: 'Only discrepancy invoices can be approved' } };
        }

        // Check permission (director only)
        const user = Auth.getCurrentUser();
        const userRole = (user && user.role ? user.role : '').toLowerCase();

        if (userRole !== 'director' && userRole !== 'admin') {
            return { success: false, errors: { permission: 'Only director can approve discrepancies' } };
        }

        invoice.matchingStatus = 'matched';
        invoice.matchingApprovedBy = user ? user.id : 'SYSTEM';
        invoice.matchingApprovedAt = new Date().toISOString();
        invoice.matchingApprovalNotes = notes;
        invoice.status = 'approved';

        this.saveInvoices();

        AuditLog.log('update', 'supplier_invoice', invoiceId,
            'Discrepancy approved by director');

        return { success: true, invoice };
    },

    async createPaymentVoucher(invoiceId) {
        const invoice = this.getInvoice(invoiceId);
        if (!invoice) {
            return { success: false, errors: { invoice: 'Invoice not found' } };
        }

        if (invoice.matchingStatus !== 'matched') {
            return {
                success: false,
                errors: { matching: 'Invoice must be matched before payment' }
            };
        }

        if (invoice.paymentStatus === 'paid') {
            return { success: false, errors: { payment: 'Invoice already paid' } };
        }

        // Create payment voucher
        if (typeof PaymentVoucher !== 'undefined') {
            const voucherData = {
                type: 'BBK',
                payTo: invoice.supplierName,
                amount: invoice.total,
                purpose: `Payment for Invoice ${invoice.supplierInvoiceNumber}`,
                paymentCategory: 'supplier',
                documents: {
                    poNumber: invoice.poNumber,
                    sjNumber: invoice.grNumber,
                    invoiceNumber: invoice.supplierInvoiceNumber,
                    taxInvoiceNumber: invoice.taxInvoiceNumber || ''
                },
                invoiceId: invoice.id
            };

            const result = await PaymentVoucher.createVoucher(voucherData);

            if (result.success) {
                invoice.paymentVoucherId = result.voucher.id;
                this.saveInvoices();

                return { success: true, voucher: result.voucher };
            }

            return result;
        }

        return { success: false, errors: { module: 'Payment Voucher module not loaded' } };
    },

    markAsPaid(invoiceId, paymentVoucherId, amount) {
        const invoice = this.getInvoice(invoiceId);
        if (!invoice) {
            return { success: false, errors: { invoice: 'Invoice not found' } };
        }

        invoice.paidAmount += amount;
        invoice.paymentVoucherId = paymentVoucherId;

        if (invoice.paidAmount >= invoice.total) {
            invoice.paymentStatus = 'paid';
            invoice.status = 'paid';
            invoice.paidAt = new Date().toISOString();
        } else {
            invoice.paymentStatus = 'partial';
        }

        this.saveInvoices();

        AuditLog.log('update', 'supplier_invoice', invoiceId,
            `Payment recorded: ${this.formatCurrency(amount)}`);

        return { success: true, invoice };
    },

    getInvoice(id) {
        return this.invoices.find(i => i.id === id);
    },

    getInvoicesByStatus(status) {
        return this.invoices.filter(i => i.status === status);
    },

    getInvoicesBySupplier(supplierId) {
        return this.invoices.filter(i => i.supplierId === supplierId);
    },

    getUnpaidInvoices() {
        return this.invoices.filter(i => i.paymentStatus !== 'paid');
    },

    getOverdueInvoices() {
        const today = new Date().toISOString().split('T')[0];
        return this.invoices.filter(i =>
            i.paymentStatus !== 'paid' &&
            i.dueDate &&
            i.dueDate < today
        );
    },

    formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    },

    formatDate(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString('id-ID', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    },

    getStatusBadgeClass(status) {
        const classes = {
            draft: 'badge-secondary',
            submitted: 'badge-info',
            matched: 'badge-success',
            discrepancy: 'badge-warning',
            approved: 'badge-primary',
            paid: 'badge-success',
            rejected: 'badge-danger'
        };
        return classes[status] || 'badge-secondary';
    }
};


// Explicitly make SupplierInvoice globally available
window.SupplierInvoice = SupplierInvoice;
