// ==========================================
// Sales Order Module
// Manage sales orders from customers
// ==========================================

const SalesOrder = {
    orders: [],
    currentOrder: null,

    init() {
        this.loadOrders();
    },

    loadOrders() {
        this.orders = Storage.getSalesOrders();
    },

    saveOrders() {
        Storage.saveSalesOrders(this.orders);
    },

    async generateSONumber() {
        // ☁️ Use Atomic Cloud Sequencer
        const nextRef = await Storage.getNextReferenceNumber('SO');
        if (nextRef) return nextRef;

        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const count = this.orders.filter(o => o.soNumber && o.soNumber.startsWith(`SO-${year}${month}`)).length + 1;
        return `SO-${year}${month}-${String(count).padStart(4, '0')}`;
    },

    async createOrder(orderData) {
        // Check KYC status first
        if (typeof CustomerKYC !== 'undefined' && orderData.customer) {
            const kycCheck = CustomerKYC.checkKYCStatus(orderData.customer);
            if (!kycCheck.approved) {
                alert(`⚠️ KYC Verification Required\n\nCannot create order: ${kycCheck.reason}.\nPlease complete KYC verification first.`);
                return {
                    success: false,
                    errors: { kyc: kycCheck.reason }
                };
            }
        }

        // Validate
        const validation = Validators.validateForm(orderData, {
            customer: { label: 'Customer', rules: ['required'] },
            orderDate: { label: 'Order Date', rules: ['required', 'date'] }
        });

        // Validate items separately
        if (!orderData.items || !Array.isArray(orderData.items) || orderData.items.length === 0) {
            return { success: false, errors: { items: 'At least one item is required' } };
        }

        if (!validation.isValid) {
            Validators.showValidationErrors(validation.errors);
            return { success: false, errors: validation.errors };
        }

        const order = {
            id: Date.now(),
            soNumber: await this.generateSONumber(),
            customer: orderData.customer,
            customerName: orderData.customerName,
            orderDate: orderData.orderDate,
            deliveryDate: orderData.deliveryDate || null,
            items: orderData.items.map(item => ({
                itemId: item.itemId,
                itemCode: item.itemCode,
                itemName: item.itemName,
                quantity: parseFloat(item.quantity),
                unit: item.unit,
                unitPrice: parseFloat(item.unitPrice),
                discount: parseFloat(item.discount || 0),
                subtotal: (parseFloat(item.quantity) * parseFloat(item.unitPrice)) - parseFloat(item.discount || 0),
                notes: item.notes || ''
            })),
            subtotal: 0,
            discount: parseFloat(orderData.discount || 0),
            taxRate: parseFloat(orderData.taxRate || 0),
            taxAmount: 0,
            total: 0,
            notes: orderData.notes || '',
            status: 'draft', // draft, confirmed, processing, delivered, invoiced, cancelled
            createdBy: Auth?.getCurrentUser?.()?.id || 'system',
            createdByName: Auth?.getCurrentUser?.()?.name || 'system',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        order.subtotal = order.items.reduce((sum, item) => sum + item.subtotal, 0);
        order.taxAmount = (order.subtotal - order.discount) * (order.taxRate / 100);
        order.total = order.subtotal - order.discount + order.taxAmount;

        this.orders.unshift(order);
        await this.saveOrders();

        // Audit log
        if (typeof AuditLog !== 'undefined') {
            AuditLog.logCreate('sales_order', order.soNumber, { total: order.total });
        }

        // Automatically send email if customer has email
        this.sendEmail(order.id);

        return { success: true, order };
    },

    async updateOrder(id, updates) {
        const index = this.orders.findIndex(o => o.id === id);
        if (index === -1) {
            return { success: false, error: 'Order not found' };
        }

        const oldOrder = { ...this.orders[index] };
        this.orders[index] = {
            ...this.orders[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };

        // Recalculate totals if items changed
        if (updates.items) {
            const order = this.orders[index];
            order.subtotal = order.items.reduce((sum, item) => sum + item.subtotal, 0);
            order.taxAmount = (order.subtotal - order.discount) * (order.taxRate / 100);
            order.total = order.subtotal - order.discount + order.taxAmount;
        }

        await this.saveOrders();

        // Audit log
        if (typeof AuditLog !== 'undefined') {
            AuditLog.logUpdate('sales_order', oldOrder.soNumber, updates);
        }

        return { success: true, order: this.orders[index] };
    },

    async changeStatus(id, newStatus) {
        const order = this.orders.find(o => o.id === id);
        if (!order) {
            return { success: false, error: 'Order not found' };
        }

        const validTransitions = {
            'draft': ['confirmed', 'cancelled'],
            'confirmed': ['processing', 'cancelled'],
            'processing': ['delivered', 'cancelled'],
            'delivered': ['invoiced'],
            'invoiced': [],
            'cancelled': []
        };

        if (!validTransitions[order.status].includes(newStatus)) {
            return { success: false, error: `Cannot change status from ${order.status} to ${newStatus}` };
        }

        order.status = newStatus;
        order.updatedAt = new Date().toISOString();

        if (newStatus === 'delivered') {
            order.deliveredDate = new Date().toISOString();
            this.createDeliveryOrder(order);
        }

        if (newStatus === 'invoiced') {
            order.invoicedDate = new Date().toISOString();
            this.createInvoice(order);
        }

        await this.saveOrders();

        // Audit log
        if (typeof AuditLog !== 'undefined') {
            AuditLog.logUpdate('sales_order', order.soNumber, { status: newStatus });
        }

        return { success: true, order };
    },

    async createDeliveryOrder(order) {
        // Update warehouse stock (reduce)
        if (typeof WarehouseStock !== 'undefined') {
            for (const item of order.items) {
                await WarehouseStock.updateStock(
                    'default',
                    item.itemCode,
                    -Math.abs(item.quantity),
                    item.unitPrice || 0,
                    `SO-${order.soNumber}`,
                    'OUT',
                    'CUSTOMER'
                );
            }
        }

        // NEW: Calculate COGS and update inventory costs
        console.log('💰 Calculating COGS for SO:', order.soNumber);
        let totalCOGS = 0;

        order.items.forEach(item => {
            // Get COGS using average cost
            const cogsResult = InventoryValuation.getCOGS(item.itemCode, item.quantity);

            if (cogsResult.success) {
                const cogs = cogsResult.totalCOGS;
                totalCOGS += cogs;

                // Store COGS in item for reference
                item.cogs = cogs;
                item.unitCost = cogsResult.unitCost;

                // Update inventory cost tracking (reduce quantity)
                const transaction = {
                    type: 'OUT',
                    itemCode: item.itemCode,
                    quantity: item.quantity,
                    unitCost: cogsResult.unitCost,
                    date: order.deliveredDate || new Date().toISOString().split('T')[0],
                    warehouse: 'default',
                    sourceDocument: 'SO',
                    sourceDocumentId: order.id,
                    sourceDocumentNumber: order.soNumber
                };

                InventoryValuation.updateItemCost(item.itemCode, transaction);

                console.log(`  ✅ ${item.itemCode}: COGS = ${InventoryValuation.formatCurrency(cogs)} (${item.quantity} × ${InventoryValuation.formatCurrency(cogsResult.unitCost)})`);
            } else {
                console.warn(`  ⚠️ Failed to calculate COGS for ${item.itemCode}:`, cogsResult.error);
            }
        });

        // Store total COGS in order
        order.totalCOGS = totalCOGS;
        order.grossProfit = (order.totalAmount || 0) - totalCOGS;
        order.grossMargin = order.totalAmount > 0 ? (order.grossProfit / order.totalAmount * 100) : 0;

        console.log(`  📊 Total COGS: ${InventoryValuation.formatCurrency(totalCOGS)}`);
        console.log(`  📊 Gross Profit: ${InventoryValuation.formatCurrency(order.grossProfit)} (${order.grossMargin.toFixed(2)}%)`);

        await this.saveOrders();
    },

    createInvoice(order) {
        // Create journal entry for sales
        if (typeof JournalEntry !== 'undefined') {
            const accountMapping = this.getAccountMapping();

            JournalEntry.addEntry({
                date: new Date().toISOString().split('T')[0],
                description: `Sales to ${order.customerName} - ${order.soNumber}`,
                reference: order.soNumber,
                lines: [
                    {
                        accountCode: accountMapping.accountsReceivable || '1130',
                        accountName: 'Accounts Receivable',
                        debit: order.total,
                        credit: 0
                    },
                    {
                        accountCode: accountMapping.salesRevenue || '4110',
                        accountName: 'Sales Revenue',
                        debit: 0,
                        credit: order.subtotal - order.discount
                    },
                    {
                        accountCode: accountMapping.outputTax || '2140',
                        accountName: 'Output Tax',
                        debit: 0,
                        credit: order.taxAmount
                    }
                ]
            });
        }
    },

    getAccountMapping() {
        const config = Storage.get(Storage.KEYS.CONFIG) || {};
        return config.accountMapping || {};
    },

    async deleteOrder(id) {
        const order = this.orders.find(o => o.id === id);
        if (!order) {
            return { success: false, error: 'Order not found' };
        }

        if (order.status === 'invoiced' || order.status === 'delivered') {
            return { success: false, error: 'Cannot delete invoiced or delivered orders' };
        }

        // Delete from cloud first (tombstone) to prevent restore on next login
        try {
            if (typeof FirebaseSync !== 'undefined' && FirebaseSync.isEnabled()) {
                await FirebaseSync.deleteFromCloud(Storage.KEYS.SALES_ORDERS, id);
            }
        } catch (e) { console.warn('Cloud delete failed for SO:', e); }

        this.orders = this.orders.filter(o => o.id !== id);
        await this.saveOrders();

        // Audit log
        if (typeof AuditLog !== 'undefined') {
            AuditLog.logDelete('sales_order', order.soNumber, { total: order.total });
        }

        return { success: true };
    },

    getOrder(id) {
        return this.orders.find(o => o.id === id);
    },

    getOrders(filters = {}) {
        let filtered = [...this.orders];

        if (filters.status) {
            filtered = filtered.filter(o => o.status === filters.status);
        }

        if (filters.customer) {
            filtered = filtered.filter(o => o.customer === filters.customer);
        }

        if (filters.startDate) {
            filtered = filtered.filter(o => o.orderDate >= filters.startDate);
        }

        if (filters.endDate) {
            filtered = filtered.filter(o => o.orderDate <= filters.endDate);
        }

        return filtered;
    },

    render() {
        return `
            <div class="sales-order-module">
                <div class="page-header">
                    <h1 class="page-title">Sales Orders</h1>
                    <div class="page-actions">
                        <button onclick="SalesOrder.showCreateModal()" class="btn btn-primary">
                            ➕ Create SO
                        </button>
                    </div>
                </div>

                ${this.renderStats()}
                ${this.renderOrderList()}
                ${this.renderCreateModal()}
            </div>
        `;
    },

    renderStats() {
        const stats = {
            draft: this.orders.filter(o => o.status === 'draft').length,
            confirmed: this.orders.filter(o => o.status === 'confirmed').length,
            processing: this.orders.filter(o => o.status === 'processing').length,
            delivered: this.orders.filter(o => o.status === 'delivered').length
        };

        return `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${stats.draft}</div>
                    <div class="stat-label">Draft</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.confirmed}</div>
                    <div class="stat-label">Confirmed</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.processing}</div>
                    <div class="stat-label">Processing</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.delivered}</div>
                    <div class="stat-label">Delivered</div>
                </div>
            </div>
        `;
    },

    renderOrderList() {
        const orders = this.getOrders();

        return `
            <div class="card">
                <div class="card-header">
                    <h3>Sales Orders</h3>
                </div>
                <div class="card-body">
                    ${orders.length === 0 ? `
                        <div style="text-align: center; padding: 40px; color: var(--color-gray-600);">
                            <div style="font-size: 48px; margin-bottom: 16px;">📋</div>
                            <div>No sales orders yet</div>
                            <button onclick="SalesOrder.showCreateModal()" class="btn btn-primary" style="margin-top: 16px;">
                                Create First SO
                            </button>
                        </div>
                    ` : `
                        <div class="table-responsive">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>SO Number</th>
                                        <th>Date</th>
                                        <th>Customer</th>
                                        <th>Total</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${orders.map(order => `
                                        <tr>
                                            <td><strong>${order.soNumber}</strong></td>
                                            <td>${new Date(order.orderDate).toLocaleDateString('id-ID')}</td>
                                            <td>${order.customerName}</td>
                                            <td>${this.formatCurrency(order.total)}</td>
                                            <td>${this.renderStatusBadge(order.status)}</td>
                                            <td>
                                                <button onclick="SalesOrder.showDetail(${order.id})" class="btn btn-sm btn-secondary">
                                                    View
                                                </button>
                                                ${order.status === 'draft' ? `
                                                    <button onclick="SalesOrder.showEditModal(${order.id})" class="btn btn-sm btn-primary">
                                                        Edit
                                                    </button>
                                                ` : ''}
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
            'confirmed': '<span class="badge badge-info">Confirmed</span>',
            'processing': '<span class="badge badge-warning">Processing</span>',
            'delivered': '<span class="badge badge-primary">Delivered</span>',
            'invoiced': '<span class="badge badge-success">Invoiced</span>',
            'cancelled': '<span class="badge badge-danger">Cancelled</span>'
        };
        return badges[status] || status;
    },

    renderCreateModal() {
        return `
            <div id="so-create-modal" class="modal" style="display: none;">
                <div class="modal" style="max-width: 900px;">
                    <div class="modal-header">
                        <h2>Create Sales Order</h2>
                        <button onclick="SalesOrder.closeModal()" class="close-btn">×</button>
                    </div>
                    <form id="so-create-form" onsubmit="SalesOrder.handleSubmit(event)">
                        <div class="modal-body">
                            <!-- Customer Info -->
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Customer *</label>
                                    <select name="customer" required onchange="SalesOrder.onCustomerChange(this)">
                                        <option value="">Select Customer</option>
                                        ${this.getCustomerOptions()}
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Order Date *</label>
                                    <input type="date" name="orderDate" required value="${new Date().toISOString().split('T')[0]}">
                                </div>
                                <div class="form-group">
                                    <label>Delivery Date</label>
                                    <input type="date" name="deliveryDate">
                                </div>
                            </div>

                            <!-- Items -->
                            <div class="form-group">
                                <label>Items *</label>
                                <div id="so-items-container">
                                    <!-- Items will be added here -->
                                </div>
                                <button type="button" onclick="SalesOrder.addItemRow()" class="btn btn-secondary" style="margin-top: 8px;">
                                    ➕ Add Item
                                </button>
                            </div>

                            <!-- Totals -->
                            <div class="form-row" style="justify-content: flex-end;">
                                <div style="width: 300px;">
                                    <div style="display: flex; justify-content: space-between; padding: 8px 0;">
                                        <span>Subtotal:</span>
                                        <span id="so-subtotal">Rp 0</span>
                                    </div>
                                    <div style="display: flex; justify-content: space-between; padding: 8px 0;">
                                        <span>Discount:</span>
                                        <input type="number" name="discount" value="0" min="0" step="0.01" 
                                            style="width: 120px; text-align: right;" onchange="SalesOrder.calculateTotals()">
                                    </div>
                                    <div style="display: flex; justify-content: space-between; padding: 8px 0; align-items: center;">
                                        <span>Tax:</span>
                                        <div>
                                            <input type="number" name="taxRate" value="11" min="0" max="100" step="0.01" 
                                                style="width: 60px; text-align: right;" onchange="SalesOrder.calculateTotals()"> %
                                            <span id="so-tax" style="margin-left: 8px;">Rp 0</span>
                                        </div>
                                    </div>
                                    <div style="display: flex; justify-content: space-between; padding: 8px 0; font-weight: 600; font-size: 18px; border-top: 2px solid var(--color-gray-800);">
                                        <span>Total:</span>
                                        <span id="so-total">Rp 0</span>
                                    </div>
                                </div>
                            </div>

                            <!-- Notes -->
                            <div class="form-group">
                                <label>Notes</label>
                                <textarea name="notes" rows="3"></textarea>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" onclick="SalesOrder.closeModal()" class="btn btn-secondary">Cancel</button>
                            <button type="submit" class="btn btn-primary">Create Sales Order</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    },

    getCustomerOptions() {
        const customers = Storage.get(Storage.KEYS.CUSTOMERS) || [];
        return customers.map(c => `<option value="${c.id}" data-name="${c.name}">${c.code} - ${c.name}</option>`).join('');
    },

    getItemOptions() {
        const items = Storage.get(Storage.KEYS.ITEMS) || [];
        return items.map(i => `<option value="${i.id}" data-code="${i.code}" data-name="${i.name}" data-unit="${i.unit}">${i.code} - ${i.name}</option>`).join('');
    },

    onCustomerChange(select) {
        const option = select.options[select.selectedIndex];
        const form = select.closest('form');
        form.customerName = option.dataset.name;
    },

    addItemRow() {
        const container = document.getElementById('so-items-container');
        const row = document.createElement('div');
        row.className = 'so-item-row';
        row.style.cssText = 'display: grid; grid-template-columns: 2fr 1fr 1fr 1fr auto; gap: 8px; margin-bottom: 8px; align-items: end;';
        row.innerHTML = `
            <div class="form-group" style="margin: 0;">
                <select name="itemId[]" required onchange="SalesOrder.onItemChange(this)">
                    <option value="">Select Item</option>
                    ${this.getItemOptions()}
                </select>
            </div>
            <div class="form-group" style="margin: 0;">
                <input type="number" name="quantity[]" placeholder="Qty" required min="0.01" step="0.01" onchange="SalesOrder.calculateTotals()">
            </div>
            <div class="form-group" style="margin: 0;">
                <input type="number" name="unitPrice[]" placeholder="Unit Price" required min="0" step="0.01" onchange="SalesOrder.calculateTotals()">
            </div>
            <div class="form-group" style="margin: 0;">
                <input type="text" class="item-subtotal" readonly placeholder="Subtotal" style="background: #f5f5f5;">
            </div>
            <button type="button" onclick="this.parentElement.remove(); SalesOrder.calculateTotals();" class="btn btn-sm btn-danger">×</button>
        `;
        container.appendChild(row);
    },

    onItemChange(select) {
        const option = select.options[select.selectedIndex];
        const row = select.closest('.so-item-row');
        row.dataset.itemCode = option.dataset.code;
        row.dataset.itemName = option.dataset.name;
        row.dataset.unit = option.dataset.unit;
    },

    calculateTotals() {
        const rows = document.querySelectorAll('.so-item-row');
        let subtotal = 0;

        rows.forEach(row => {
            const qty = parseFloat(row.querySelector('[name="quantity[]"]').value) || 0;
            const price = parseFloat(row.querySelector('[name="unitPrice[]"]').value) || 0;
            const itemSubtotal = qty * price;

            row.querySelector('.item-subtotal').value = this.formatCurrency(itemSubtotal);
            subtotal += itemSubtotal;
        });

        const discount = parseFloat(document.querySelector('[name="discount"]').value) || 0;
        const taxRate = parseFloat(document.querySelector('[name="taxRate"]').value) || 0;
        const taxAmount = (subtotal - discount) * (taxRate / 100);
        const total = subtotal - discount + taxAmount;

        document.getElementById('so-subtotal').textContent = this.formatCurrency(subtotal);
        document.getElementById('so-tax').textContent = this.formatCurrency(taxAmount);
        document.getElementById('so-total').textContent = this.formatCurrency(total);
    },

    showCreateModal() {
        document.getElementById('so-create-modal').style.display = 'flex';
        this.addItemRow(); // Add first item row
    },

    closeModal() {
        document.getElementById('so-create-modal').style.display = 'none';
        document.getElementById('so-create-form').reset();
        document.getElementById('so-items-container').innerHTML = '';
    },

    async handleSubmit(event) {
        event.preventDefault();
        const form = event.target;
        const btn = form.querySelector('button[type="submit"]');
        const originalText = btn.textContent;

        // UI FEEDBACK: Lock button to prevent double-submit
        btn.disabled = true;
        btn.textContent = '⏳ Processing...';

        try {
            const formData = new FormData(form);

            // Collect items
            const items = [];
            const itemIds = formData.getAll('itemId[]');
            const quantities = formData.getAll('quantity[]');
            const unitPrices = formData.getAll('unitPrice[]');

            itemIds.forEach((itemId, index) => {
                if (itemId) {
                    const row = document.querySelectorAll('.so-item-row')[index];
                    items.push({
                        itemId: itemId,
                        itemCode: row.dataset.itemCode,
                        itemName: row.dataset.itemName,
                        unit: row.dataset.unit,
                        quantity: quantities[index],
                        unitPrice: unitPrices[index]
                    });
                }
            });

            const orderData = {
                customer: formData.get('customer'),
                customerName: form.customerName,
                orderDate: formData.get('orderDate'),
                deliveryDate: formData.get('deliveryDate'),
                items: items,
                discount: formData.get('discount'),
                taxRate: formData.get('taxRate'),
                notes: formData.get('notes')
            };

            const result = await this.createOrder(orderData);

            if (result.success) {
                this.closeModal();
                App.showAlert('success', 'Sales Order created successfully');
                App.navigateTo('sales-order');
            } else {
                if (result.errors) {
                    Validators.showValidationErrors(result.errors);
                } else {
                    alert(result.error || 'Failed to create order');
                }
            }
        } catch (error) {
            console.error('SO Submit Error:', error);
            alert('An unexpected error occurred. Please try again.');
        } finally {
            // RELEASE LOCK
            if (btn) {
                btn.disabled = false;
                btn.textContent = originalText;
            }
        }
    },

    showDetail(id) {
        const order = this.getOrder(id);
        if (!order) return;

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal" style="max-width: 900px;">
                <div class="modal-header">
                    <h2>Sales Order: ${order.soNumber}</h2>
                    <button onclick="this.closest('.modal').remove()" class="close-btn">×</button>
                </div>
                <div class="modal-body">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px;">
                        <div>
                            <h4>Customer Information</h4>
                            <p><strong>${order.customerName}</strong></p>
                        </div>
                        <div>
                            <h4>Order Information</h4>
                            <p>Date: ${new Date(order.orderDate).toLocaleDateString('id-ID')}</p>
                            <p>Status: ${this.renderStatusBadge(order.status)}</p>
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
                            ${order.items.map(item => `
                                <tr>
                                    <td>${item.itemCode} - ${item.itemName}</td>
                                    <td>${item.quantity} ${item.unit}</td>
                                    <td>${this.formatCurrency(item.unitPrice)}</td>
                                    <td>${this.formatCurrency(item.subtotal)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colspan="3" style="text-align: right;"><strong>Subtotal:</strong></td>
                                <td><strong>${this.formatCurrency(order.subtotal)}</strong></td>
                            </tr>
                            ${order.discount > 0 ? `
                                <tr>
                                    <td colspan="3" style="text-align: right;">Discount:</td>
                                    <td>-${this.formatCurrency(order.discount)}</td>
                                </tr>
                            ` : ''}
                            <tr>
                                <td colspan="3" style="text-align: right;">Tax (${order.taxRate}%):</td>
                                <td>${this.formatCurrency(order.taxAmount)}</td>
                            </tr>
                            <tr>
                                <td colspan="3" style="text-align: right; font-size: 18px;"><strong>Total:</strong></td>
                                <td style="font-size: 18px;"><strong>${this.formatCurrency(order.total)}</strong></td>
                            </tr>
                        </tfoot>
                    </table>

                    ${order.notes ? `<p><strong>Notes:</strong> ${order.notes}</p>` : ''}
                </div>
                <div class="modal-footer" style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <div style="flex-grow: 1; display: flex; gap: 10px;">
                        <button onclick="SalesOrder.exportToPDF(${order.id})" class="btn btn-secondary">
                             📄 Download PDF
                        </button>
                        <button onclick="SalesOrder.sendEmail(${order.id})" class="btn btn-info">
                             📧 Kirim ke Email Pelanggan
                        </button>
                    </div>
                    
                    ${order.status === 'draft' ? `
                        <button onclick="SalesOrder.changeStatus(${order.id}, 'confirmed').then(() => { this.closest('.modal').parentElement.remove(); App.navigateTo('sales-order'); });" class="btn btn-primary">
                            Confirm Order
                        </button>
                    ` : ''}
                    ${order.status === 'confirmed' ? `
                        <button onclick="SalesOrder.changeStatus(${order.id}, 'processing').then(() => { this.closest('.modal').parentElement.remove(); App.navigateTo('sales-order'); });" class="btn btn-warning">
                            Start Processing
                        </button>
                    ` : ''}
                    ${order.status === 'processing' ? `
                        <button onclick="SalesOrder.changeStatus(${order.id}, 'delivered').then(() => { this.closest('.modal').parentElement.remove(); App.navigateTo('sales-order'); });" class="btn btn-success">
                            Mark as Delivered
                        </button>
                    ` : ''}
                    ${order.status === 'delivered' ? `
                        <button onclick="SalesOrder.changeStatus(${order.id}, 'invoiced').then(() => { this.closest('.modal').parentElement.remove(); App.navigateTo('sales-order'); });" class="btn btn-success">
                            Create Invoice
                        </button>
                    ` : ''}
                    <button onclick="this.closest('.modal').parentElement.remove()" class="btn btn-secondary">Close</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    async sendEmail(id) {
        const order = this.getOrder(id);
        if (!order) return;

        // Get customer email
        const customers = Storage.get(Storage.KEYS.CUSTOMERS) || [];
        const customer = customers.find(c => c.id === order.customer || c.name === order.customerName);

        if (!customer || !customer.email) {
            const fallbackEmail = prompt('Email pelanggan tidak ditemukan. Masukkan email tujuan:', '');
            if (!fallbackEmail) return;
            order.tempEmail = fallbackEmail;
        } else {
            order.tempEmail = customer.email;
        }

        try {
            App.showLoading('📧 Mengirim Email...');
            
            // Check if Firebase function is available
            if (typeof firebase !== 'undefined' && firebase.functions) {
                const sendInvoice = firebase.functions().httpsCallable('sendSalesInvoiceEmail');
                const result = await sendInvoice({
                    orderId: order.id,
                    customerEmail: order.tempEmail,
                    orderDetails: order
                });

                if (result.data.success) {
                    App.showAlert('success', `Invoice berhasil dikirim ke ${order.tempEmail}`);
                } else {
                    App.showAlert('error', 'Gagal mengirim email: ' + result.data.message);
                }
            } else {
                alert('Firebase Functions tidak tersedia. Pastikan Anda sudah login.');
            }
        } catch (error) {
            console.error('Error sending email:', error);
            App.showAlert('error', 'Gagal mengirim email: ' + error.message);
        } finally {
            App.hideLoading();
        }
    },

    exportToPDF(id) {
        const order = this.getOrder(id);
        if (!order) return;

        const config = Storage.get(Storage.KEYS.CONFIG) || {};
        if (typeof PDFExporter !== 'undefined') {
            if(PDFExporter.exportSalesOrder) {
                PDFExporter.exportSalesOrder(order, config);
            } else {
                // Fallback to exportInvoice if script is not reloaded properly
                PDFExporter.exportInvoice(order, config);
            }
        } else {
            alert('PDF Exporter module not loaded.');
        }
    },

    sendEmail(id) {
        const order = this.getOrder(id);
        if (!order) return;

        const config = Storage.get(Storage.KEYS.CONFIG) || {};
        const customers = Storage.getCustomers() || [];
        const customer = customers.find(c => c.id === order.customer || c.name === order.customerName);
        const customerEmail = customer ? customer.email : '';

        const subject = `Invoice Approval Required: ${order.soNumber} - ${config.companyName || 'PT GOLD ALURA REFINERI'}`;
        const body = `Dear ${order.customerName},

Terima kasih atas pesanan Anda. Berikut adalah detail tagihan (Invoice) untuk pembelian Gold Bar:

Nomor Invoice: ${order.soNumber}
Tanggal: ${new Date(order.orderDate).toLocaleDateString('id-ID')}
Total Tagihan: ${this.formatCurrency(order.total)}

Kami telah melampirkan file PDF Invoice pada sistem kami. Mohon kesediaannya untuk memeriksa kembali rincian tersebut.

Ketik "APPROVE" dan reply email ini untuk menyetujui invoice ini agar kami dapat memproses pengiriman lebih lanjut.

Hormat kami,
Sales Team - ${config.companyName || 'PT GOLD ALURA REFINERI'}`;

        const mailtoUrl = `mailto:${customerEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.open(mailtoUrl, '_blank');
    },

    formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    }
};



// Explicitly make SalesOrder globally available
window.SalesOrder = SalesOrder;
