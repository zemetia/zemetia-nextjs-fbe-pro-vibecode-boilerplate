// ==========================================
// Purchase Order Module
// Manage purchase orders to suppliers
// ==========================================

const PurchaseOrder = {
    orders: [],
    currentOrder: null,
    _editMode: false,
    _editingId: null,

    init() {
        this.loadOrders();
        // Run cleanup after 3 seconds to allow firebase-sync to pull any remote duplicates first
        setTimeout(() => this.cleanupDuplicates(), 3000);
    },

    loadOrders() {
        const stored = Storage.get(Storage.KEYS.PURCHASE_ORDERS);
        this.orders = stored || [];
    },

    getStoredOrders() {
        const stored = Storage.get(Storage.KEYS.PURCHASE_ORDERS);
        return Array.isArray(stored) ? stored : [];
    },

    async cleanupDuplicates(manual = false) {
        // Auto-run only once per session; manual button click always runs
        if (!manual) {
            if (sessionStorage.getItem('_po_cleanup_done')) return;
            sessionStorage.setItem('_po_cleanup_done', '1');
        }

        const orders = Storage.get(Storage.KEYS.PURCHASE_ORDERS) || [];
        const seen = new Set();
        const keep = [];
        const toDelete = [];

        // Sort by id (timestamp) ascending, so we keep the oldest (original) one
        const sortedOrders = [...orders].sort((a, b) => a.id - b.id);

        for (const order of sortedOrders) {
            // Check if poNumber exists and is not draft/empty
            if (order.poNumber) {
                if (seen.has(order.poNumber)) {
                    toDelete.push(order.id);
                } else {
                    seen.add(order.poNumber);
                    keep.push(order);
                }
            } else {
                keep.push(order);
            }
        }

        if (toDelete.length > 0) {
            console.log('🧹 [Cleanup] Found duplicate POs to delete:', toDelete);
            let successCount = 0;
            for (const id of toDelete) {
                try {
                    if (typeof FirebaseSync !== 'undefined' && FirebaseSync.isEnabled()) {
                        await FirebaseSync.deleteFromCloud(Storage.KEYS.PURCHASE_ORDERS, id);
                        successCount++;
                    }
                } catch (e) {
                    console.warn('Cloud delete failed for duplicate PO:', e);
                }
            }
            Storage.set(Storage.KEYS.PURCHASE_ORDERS, keep);
            this.orders = keep;
            
            // Re-render if currently viewing purchase-order page
            if (document.querySelector('.purchase-order-module')) {
                const content = document.getElementById('main-content');
                if (content) content.innerHTML = this.render();
            }
            alert(`🧹 Berhasil membersihkan ${successCount} duplikasi PO!`);
        } else {
            alert('✅ Tidak ditemukan duplikasi PO. Data sudah bersih.');
        }
    },

    async saveOrders() {
        return await Storage.set(Storage.KEYS.PURCHASE_ORDERS, this.orders);
    },

    // ... (rest of methods)

    // ...

    async deleteOrder(id) {
        const order = this.orders.find(o => o.id === id);
        if (!order) {
            return { success: false, error: 'Order not found' };
        }

        if (order.status === 'received') {
            return { success: false, error: 'Cannot delete received orders' };
        }

        // Delete from cloud first (tombstone) to prevent restore on next login
        try {
            if (typeof FirebaseSync !== 'undefined' && FirebaseSync.isEnabled()) {
                await FirebaseSync.deleteFromCloud(Storage.KEYS.PURCHASE_ORDERS, id);
            }
        } catch (e) { console.warn('Cloud delete failed for PO:', e); }

        const originalOrders = [...this.orders];
        this.orders = this.orders.filter(o => o.id !== id);

        try {
            await this.saveOrders();
            // Audit log
            if (typeof AuditLog !== 'undefined') {
                AuditLog.logDelete('purchase_order', order.poNumber, { total: order.total });
            }
            return { success: true };
        } catch (error) {
            console.error('❌ Failed to delete purchase order:', error);
            // Rollback
            this.orders = originalOrders;
            return { success: false, error: 'Cloud sync failed: ' + error.message };
        }
    },

    async generatePONumber() {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const prefix = `PO-${year}${month}-`;
        const counterKey = `PO_${year}${month}`;
        const orders = this.getStoredOrders();
        const maxSequence = orders.reduce((max, order) => {
            const poNumber = order && order.poNumber ? String(order.poNumber) : '';
            if (!poNumber.startsWith(prefix)) return max;

            const sequence = parseInt(poNumber.slice(prefix.length), 10);
            return Number.isFinite(sequence) && sequence > max ? sequence : max;
        }, 0);

        if (Storage.USE_CLOUD_STORAGE && typeof window !== 'undefined' && window.db && window.firestore) {
            try {
                const { doc, runTransaction, serverTimestamp } = window.firestore;
                const counterRef = doc(window.db, 'transactionCounters', 'counters');
                const nextSequence = await runTransaction(window.db, async (transaction) => {
                    const counterDoc = await transaction.get(counterRef);
                    const currentSequence = counterDoc.exists() ? (counterDoc.data()[counterKey] || 0) : 0;
                    const sequence = Math.max(currentSequence + 1, maxSequence + 1);
                    const update = {
                        [counterKey]: sequence,
                        updatedAt: serverTimestamp()
                    };

                    if (counterDoc.exists()) {
                        transaction.update(counterRef, update);
                    } else {
                        transaction.set(counterRef, update);
                    }

                    return sequence;
                });

                return `${prefix}${String(nextSequence).padStart(4, '0')}`;
            } catch (error) {
                console.warn('⚠️ [PurchaseOrder] Cloud PO counter unavailable. Falling back to local PO scan:', error);
            }
        }

        return `${prefix}${String(maxSequence + 1).padStart(4, '0')}`;
    },

    async createOrder(orderData) {
        this.orders = this.getStoredOrders();

        // Validate
        const validation = Validators.validateForm(orderData, {
            supplier: { label: 'Supplier', rules: ['required'] },
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

        const allSuppliers = (typeof Storage !== 'undefined' && Storage.getSuppliers) ? Storage.getSuppliers() : [];
        const supplierObj = allSuppliers.find(s => String(s.id) === String(orderData.supplier) || s.code === orderData.supplier);
        const isPkp = supplierObj ? (supplierObj.taxStatus === 'PKP' || supplierObj.is_pkp === true) : false;
        const defaultTaxRate = (typeof Storage !== 'undefined' && Storage.get && Storage.get('erp_settings')?.defaultTaxRate) ?? 11;
        const enforcedTaxRate = isPkp ? defaultTaxRate : 0;
        const subtotal = orderData.items.reduce((sum, item) => sum + (parseFloat(item.quantity) * parseFloat(item.unitPrice)), 0);
        const taxAmount = Math.round(subtotal * (enforcedTaxRate / 100));
        const total = subtotal + taxAmount;

        const currency = orderData.currency || 'IDR';
        const exchangeRate = parseFloat(orderData.exchangeRate || 1);
        const subtotalIDR = currency === 'USD' ? (subtotal * exchangeRate) : subtotal;
        const importDuty = parseFloat(orderData.importDuty || 0);
        const freightAndInsurance = parseFloat(orderData.freightAndInsurance || 0);
        const totalQty = orderData.items.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
        const totalLandedCostIDR = subtotalIDR + importDuty + freightAndInsurance;
        const unitLandedCostIDRPerGram = totalQty > 0 ? (totalLandedCostIDR / totalQty) : 0;

        const order = {
            id: Date.now(),
            poNumber: await this.generatePONumber(),
            supplier: orderData.supplier,
            supplierName: orderData.supplierName,
            orderDate: orderData.orderDate,
            expectedDate: orderData.expectedDate || null,
            currency: currency,
            exchangeRate: exchangeRate,
            subtotalIDR: subtotalIDR,
            importDuty: importDuty,
            freightAndInsurance: freightAndInsurance,
            totalLandedCostIDR: totalLandedCostIDR,
            unitLandedCostIDRPerGram: unitLandedCostIDRPerGram,
            pibNo: orderData.pibNo || '',
            sppbNo: orderData.sppbNo || '',
            mawbNo: orderData.mawbNo || '',
            barSerialNumbers: orderData.barSerialNumbers || [],
            items: orderData.items.map(item => {
                // Look up inventory GL account from master items
                const masterItems = Storage.getItems ? Storage.getItems() : (Storage.get(Storage.KEYS.ITEMS) || []);
                const masterItem = masterItems.find(mi => mi.id === item.itemId || mi.code === item.itemCode);
                const inventoryAccount = masterItem?.inventoryAccount || '';

                return {
                    itemId: item.itemId,
                    itemCode: item.itemCode,
                    itemName: item.itemName,
                    quantity: parseFloat(item.quantity),
                    unit: item.unit,
                    unitPrice: parseFloat(item.unitPrice),
                    subtotal: parseFloat(item.quantity) * parseFloat(item.unitPrice),
                    notes: item.notes || '',
                    inventoryAccount: inventoryAccount  // GL account for journal
                };
            }),
            subtotal: subtotal,
            taxRate: enforcedTaxRate,
            taxAmount: taxAmount,
            total: total,
            reference: orderData.reference || '',
            prfId: orderData.prfId || null,
            prfNumber: orderData.prfNumber || '',
            prfNotes: orderData.prfNotes || '',
            notes: orderData.notes || '',
            status: 'draft', // draft, submitted, approved, received, cancelled
            createdBy: Auth?.getCurrentUser?.()?.id || 'system',
            createdByName: Auth?.getCurrentUser?.()?.name || 'system',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.orders.unshift(order);
        const saved = await this.saveOrders();
        if (!saved) {
            this.orders = this.orders.filter(existing => existing.id !== order.id);
            return { success: false, errors: { storage: 'Failed to save purchase order' } };
        }

        // Audit log
        if (typeof AuditLog !== 'undefined') {
            AuditLog.logCreate('purchase_order', order.poNumber, { total: order.total });
        }

        return { success: true, order };
    },

    async recordPayment(poNumberOrId, paymentData) {
        this.orders = this.getStoredOrders();
        const index = this.orders.findIndex(o => o.id === poNumberOrId || o.poNumber === poNumberOrId);
        if (index === -1) {
            return { success: false, error: 'Order not found' };
        }

        const order = this.orders[index];
        const paymentAmount = parseFloat(paymentData.amount || 0);
        const category = paymentData.category || paymentData.paymentCategory || 'PO_PRINCIPAL';

        let categoryLabel = paymentData.categoryLabel;
        if (!categoryLabel) {
            switch (category) {
                case 'CUSTOMS_DUTY_PPH22':
                    categoryLabel = '🏛️ Pajak PPh 22 Impor (0,25%)';
                    break;
                case 'LOGISTICS_HANDLING':
                    categoryLabel = '🚚 Logistik & Handling';
                    break;
                case 'OTHER_EXPENSE':
                    categoryLabel = '📑 Biaya Tambahan';
                    break;
                default:
                    categoryLabel = '💰 Pelunasan Pokok Supplier';
                    break;
            }
        }

        const historyEntry = {
            id: paymentData.id || Date.now(),
            voucherNo: paymentData.voucherNo || paymentData.voucherNumber || 'BBK',
            voucherType: paymentData.voucherType || 'BBK',
            date: paymentData.date || new Date().toISOString().split('T')[0],
            category,
            categoryLabel,
            payee: paymentData.payee || order.supplierName || 'Supplier',
            bank: paymentData.bank || paymentData.bankAccountName || 'Bank BCA',
            bankAccountCode: paymentData.bankAccountCode || '1111-IDR',
            accountCode: paymentData.accountCode || (category === 'CUSTOMS_DUTY_PPH22' ? '1135' : '2111'),
            amount: paymentAmount,
            notes: paymentData.notes || paymentData.description || '',
            recordedAt: new Date().toISOString()
        };

        const existingHistory = Array.isArray(order.paymentHistory) ? order.paymentHistory : [];

        let currentPaid = parseFloat(order.paidAmountIDR || 0);
        const totalCost = parseFloat(order.totalLandedCostIDR || order.total || order.subtotalIDR || 0);
        let newRemaining = typeof order.remainingBalanceIDR !== 'undefined' ? parseFloat(order.remainingBalanceIDR) : Math.max(0, totalCost - currentPaid);
        let customsPaid = parseFloat(order.customsPaidAmountIDR || 0);
        let logisticsPaid = parseFloat(order.logisticsPaidAmountIDR || 0);
        let otherExpensesPaid = parseFloat(order.otherExpensesPaidAmountIDR || 0);

        if (category === 'PO_PRINCIPAL') {
            currentPaid += paymentAmount;
            newRemaining = Math.max(0, totalCost - currentPaid);
        } else if (category === 'CUSTOMS_DUTY_PPH22') {
            customsPaid += paymentAmount;
        } else if (category === 'LOGISTICS_HANDLING') {
            logisticsPaid += paymentAmount;
        } else {
            otherExpensesPaid += paymentAmount;
        }

        const isFullyPaid = newRemaining === 0;

        this.orders[index] = {
            ...order,
            paidAmountIDR: currentPaid,
            remainingBalanceIDR: newRemaining,
            customsPaidAmountIDR: customsPaid,
            logisticsPaidAmountIDR: logisticsPaid,
            otherExpensesPaidAmountIDR: otherExpensesPaid,
            paymentStatus: isFullyPaid ? 'PAID' : currentPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID',
            lastPaymentVoucher: historyEntry.voucherNo,
            lastPaymentDate: historyEntry.date,
            paymentHistory: [historyEntry, ...existingHistory],
            updatedAt: new Date().toISOString()
        };

        await this.saveOrders();
        return { success: true, order: this.orders[index] };
    },

    updateOrder(id, updates) {
        const index = this.orders.findIndex(o => o.id === id);
        if (index === -1) {
            return { success: false, error: 'Order not found' };
        }

        const oldOrder = { ...this.orders[index] };
        const targetSupplier = updates.supplier || oldOrder.supplier;
        const allSuppliers = (typeof Storage !== 'undefined' && Storage.getSuppliers) ? Storage.getSuppliers() : [];
        const supplierObj = allSuppliers.find(s => String(s.id) === String(targetSupplier) || s.code === targetSupplier);
        const isPkp = supplierObj ? (supplierObj.taxStatus === 'PKP' || supplierObj.is_pkp === true) : false;
        const defaultTaxRate = (typeof Storage !== 'undefined' && Storage.get && Storage.get('erp_settings')?.defaultTaxRate) ?? 11;
        const enforcedTaxRate = isPkp ? defaultTaxRate : 0;
        updates.taxRate = enforcedTaxRate;

        // Retain PRF notes and tracking if not explicitly passed
        if (updates.prfNotes === undefined && oldOrder.prfNotes) updates.prfNotes = oldOrder.prfNotes;
        if (updates.prfId === undefined && oldOrder.prfId) updates.prfId = oldOrder.prfId;
        if (updates.prfNumber === undefined && oldOrder.prfNumber) updates.prfNumber = oldOrder.prfNumber;

        // Process items if provided to ensure subtotals are calculated
        if (updates.items) {
            updates.items = updates.items.map(item => ({
                itemId: item.itemId,
                itemCode: item.itemCode,
                itemName: item.itemName,
                unit: item.unit,
                quantity: parseFloat(item.quantity || 0),
                unitPrice: parseFloat(item.unitPrice || 0),
                subtotal: parseFloat(item.quantity || 0) * parseFloat(item.unitPrice || 0),
                notes: item.notes || ''
            }));

            updates.subtotal = updates.items.reduce((sum, item) => sum + item.subtotal, 0);
            updates.taxAmount = Math.round(updates.subtotal * (enforcedTaxRate / 100));
            updates.total = updates.subtotal + updates.taxAmount;
        } else {
            const currentSubtotal = updates.subtotal !== undefined ? updates.subtotal : oldOrder.subtotal;
            updates.taxAmount = Math.round(currentSubtotal * (enforcedTaxRate / 100));
            updates.total = currentSubtotal + updates.taxAmount;
        }

        this.orders[index] = {
            ...this.orders[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };

        this.saveOrders();

        // Audit log
        if (typeof AuditLog !== 'undefined') {
            AuditLog.logUpdate('purchase_order', oldOrder.poNumber, updates);
        }

        return { success: true, order: this.orders[index] };
    },

    async changeStatus(id, newStatus) {
        const order = this.orders.find(o => o.id === id);
        if (!order) {
            return { success: false, error: 'Order not found' };
        }

        const validTransitions = {
            'draft': ['submitted', 'cancelled'],
            'submitted': ['approved', 'cancelled'],
            'approved': ['received', 'partially_received', 'cancelled'],
            'partially_received': ['partially_received', 'received', 'cancelled'],
            'received': [],
            'cancelled': []
        };

        if (!validTransitions[order.status].includes(newStatus)) {
            return { success: false, error: `Cannot change status from ${order.status} to ${newStatus}` };
        }

        order.status = newStatus;
        order.updatedAt = new Date().toISOString();

        if (newStatus === 'approved') {
            if (typeof Auth !== 'undefined') {
                const user = Auth.getCurrentUser();
                order.approvedBy = user?.id || 'unknown';
                order.approvedByName = user?.name || 'Director';
                order.approvedAt = new Date().toISOString();
            }
        }

        if (newStatus === 'received') {
            order.receivedDate = new Date().toISOString();
            // Create inventory receipt
            await this.createInventoryReceipt(order);
        }

        this.saveOrders();

        // Audit log
        if (typeof AuditLog !== 'undefined') {
            AuditLog.logUpdate('purchase_order', order.poNumber, { status: newStatus });
        }

        return { success: true, order };
    },

    async createInventoryReceipt(order) {
        // Update warehouse stock immediately on receipt
        if (typeof WarehouseStock !== 'undefined' && typeof Storage !== 'undefined') {
            const warehouses = Storage.getWarehouses ? Storage.getWarehouses() : [];
            const warehouseCode = warehouses.length > 0 ? warehouses[0].code : 'WH-001';

            for (const item of order.items) {
                try {
                    await WarehouseStock.updateStock(
                        warehouseCode,
                        item.itemCode,
                        parseFloat(item.quantity) || 0,
                        parseFloat(item.unitPrice) || 0,
                        `PO-${order.poNumber}`,
                        'IN',
                        'COMPANY'
                    );
                } catch (err) {
                    console.error('Failed to update stock for item', item.itemCode, err);
                }
            }
        }

        // Build pending journal data (per-item debit lines)
        const accountMapping = this.getAccountMapping();
        const defaultInventoryAccount = accountMapping.inventory || accountMapping.raw_gold_inventory || '1151';
        const taxAccount = accountMapping.inputTax || accountMapping.tax_in || '11901';
        const apAccount = accountMapping.accountsPayable || accountMapping.accounts_payable || '2110';

        // Group items by their inventory account to consolidate lines
        const accountGroups = {};
        order.items.forEach(item => {
            const acctCode = item.inventoryAccount || defaultInventoryAccount;
            if (!accountGroups[acctCode]) {
                accountGroups[acctCode] = { code: acctCode, total: 0, itemNames: [] };
            }
            accountGroups[acctCode].total += parseFloat(item.subtotal) || 0;
            accountGroups[acctCode].itemNames.push(item.itemName);
        });

        // Build journal lines: one debit per account group
        const journalLines = [];
        Object.values(accountGroups).forEach(group => {
            // Get account name from COA
            const coaAccounts = Storage.get(Storage.KEYS.CHART_OF_ACCOUNTS) || [];
            const coaAccount = coaAccounts.find(a => String(a.code) === String(group.code));
            const acctName = coaAccount ? coaAccount.name : `Persediaan (${group.code})`;

            journalLines.push({
                accountCode: group.code,
                accountName: acctName,
                debit: group.total,
                credit: 0,
                description: group.itemNames.join(', ')
            });
        });

        // Input Tax line (PPN Masukan)
        if (order.taxAmount && order.taxAmount > 0) {
            const taxCoaAccount = (Storage.get(Storage.KEYS.CHART_OF_ACCOUNTS) || []).find(a => String(a.code) === String(taxAccount));
            journalLines.push({
                accountCode: taxAccount,
                accountName: taxCoaAccount ? taxCoaAccount.name : 'PPN Masukan',
                debit: order.taxAmount,
                credit: 0
            });
        }

        // Accounts Payable credit line
        const apCoaAccount = (Storage.get(Storage.KEYS.CHART_OF_ACCOUNTS) || []).find(a => String(a.code) === String(apAccount));
        journalLines.push({
            accountCode: apAccount,
            accountName: apCoaAccount ? apCoaAccount.name : 'Hutang Usaha',
            debit: 0,
            credit: order.total
        });

        // Save pending journal data — will be posted after Finance Manager approval
        const pendingJournalData = {
            date: new Date().toISOString().split('T')[0],
            description: `Purchase from ${order.supplierName} - ${order.poNumber}`,
            reference: order.poNumber,
            transactionType: 'PUR',
            manualReference: true,
            lines: journalLines
        };

        // Update order with pending journal
        order.journalStatus = 'pending_approval';
        order.pendingJournalData = pendingJournalData;
    },

    getAccountMapping() {
        // Use global Storage.getAccountMapping() which merges defaults
        if (Storage.getAccountMapping) return Storage.getAccountMapping();
        const config = Storage.get(Storage.KEYS.CONFIG) || {};
        return config.accountMapping || {};
    },

    // === Feature 3: Finance Manager Journal Approval ===
    canApproveJournal() {
        const user = Auth?.getCurrentUser?.();
        if (!user) return false;
        const allowedRoles = ['ADMIN', 'director', 'manager_finance'];
        return allowedRoles.includes(user.role);
    },

    async approveJournal(id) {
        if (!this.canApproveJournal()) {
            alert('❌ Hanya Finance Manager, Director, atau Admin yang dapat menyetujui jurnal ini.');
            return;
        }

        const order = this.getOrder(id);
        if (!order) return;

        if (order.journalStatus !== 'pending_approval') {
            alert('Jurnal ini sudah diposting atau tidak dalam status pending.');
            return;
        }

        if (!order.pendingJournalData) {
            alert('Tidak ada data jurnal yang tersimpan untuk PO ini.');
            return;
        }

        if (!confirm(`Setujui dan posting jurnal untuk PO ${order.poNumber}?\n\nJurnal akan langsung masuk ke Daftar Jurnal.`)) return;

        // Post the journal
        if (typeof JournalEntry !== 'undefined') {
            try {
                await JournalEntry.createEntry(order.pendingJournalData);
            } catch (err) {
                console.error('Failed to post journal:', err);
                alert('❌ Gagal memposting jurnal: ' + err.message);
                return;
            }
        }

        // Update order
        const user = Auth.getCurrentUser();
        order.journalStatus = 'posted';
        order.journalPostedAt = new Date().toISOString();
        order.journalApprovedBy = user?.name || user?.id || 'unknown';
        delete order.pendingJournalData; // clean up

        await this.saveOrders();

        if (typeof AuditLog !== 'undefined') {
            AuditLog.logUpdate('purchase_order', order.poNumber, { journalStatus: 'posted' });
        }

        alert(`✅ Jurnal untuk PO ${order.poNumber} berhasil diposting oleh ${order.journalApprovedBy}.`);
        App.navigateTo('purchase-order');
    },
    // === End Feature 3 ===

    getOrder(id) {
        return this.orders.find(o => o.id === id);
    },

    getOrders(filters = {}) {
        let filtered = [...this.orders];

        if (filters.status) {
            filtered = filtered.filter(o => o.status === filters.status);
        }

        if (filters.supplier) {
            filtered = filtered.filter(o => o.supplier === filters.supplier);
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
            <div class="purchase-order-module">
                <div class="page-header">
                    <h1 class="page-title">Purchase Orders</h1>
                    <div class="page-actions">
                        <button onclick="PurchaseOrder.cleanupDuplicates(true)" class="btn btn-warning" style="margin-right: 10px;">
                            🧹 Clean Duplicates
                        </button>
                        <button onclick="PurchaseOrder.showCreateModal()" class="btn btn-primary">
                            ➕ Create PO
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
            submitted: this.orders.filter(o => o.status === 'submitted').length,
            approved: this.orders.filter(o => o.status === 'approved').length,
            received: this.orders.filter(o => o.status === 'received').length
        };

        return `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${stats.draft}</div>
                    <div class="stat-label">Draft</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.submitted}</div>
                    <div class="stat-label">Submitted</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.approved}</div>
                    <div class="stat-label">Approved</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.received}</div>
                    <div class="stat-label">Received</div>
                </div>
            </div>
        `;
    },

    calculateGRProgress(order) {
        if (!order || !order.items || order.items.length === 0) return 0;
        const grs = (typeof Storage !== 'undefined' && Storage.get) ? (Storage.get(Storage.KEYS.GOODS_RECEIPTS) || []) : [];
        const poGrs = grs.filter(gr => (gr.poId && String(gr.poId) === String(order.id)) || (gr.poNumber && gr.poNumber === order.poNumber));
        
        let totalOrdered = order.items.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
        if (totalOrdered <= 0) return 0;

        let totalReceived = 0;
        poGrs.forEach(gr => {
            (gr.items || []).forEach(item => {
                totalReceived += (parseFloat(item.receivedQty) || 0);
            });
        });

        const percent = Math.min(100, Math.round((totalReceived / totalOrdered) * 100));
        return percent;
    },

    renderProgressBarHTML(percent) {
        let colorClass = '#94a3b8';
        if (percent === 100) colorClass = '#10b981';
        else if (percent > 0) colorClass = '#3b82f6';

        return `
            <div style="background: #e2e8f0; border-radius: 4px; height: 16px; width: 100px; position: relative; overflow: hidden; display: inline-block; vertical-align: middle;">
                <div style="background: ${colorClass}; height: 100%; width: ${percent}%; transition: width 0.3s;"></div>
                <span style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; text-align: center; font-size: 10px; font-weight: bold; color: ${percent > 50 ? '#ffffff' : '#0f172a'}; line-height: 16px;">${percent}%</span>
            </div>
        `;
    },

    renderOrderList() {
        const orders = this.getOrders();

        return `
            <div class="card">
                <div class="card-header">
                    <h3>Purchase Orders</h3>
                </div>
                <div class="card-body">
                    ${orders.length === 0 ? `
                        <div style="text-align: center; padding: 40px; color: var(--color-gray-600);">
                            <div style="font-size: 48px; margin-bottom: 16px;">📋</div>
                            <div>No purchase orders yet</div>
                            <button onclick="PurchaseOrder.showCreateModal()" class="btn btn-primary" style="margin-top: 16px;">
                                Create First PO
                            </button>
                        </div>
                    ` : `
                        <div class="table-responsive">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>PO Number</th>
                                        <th>Date</th>
                                        <th>Supplier</th>
                                        <th>Total</th>
                                        <th>Status</th>
                                        <th>GR Progress</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${orders.map(order => {
                                        const grPercent = this.calculateGRProgress(order);
                                        return `
                                            <tr>
                                                <td>
                                                    <strong>${order.poNumber}</strong>
                                                    ${order.prfNumber ? `<br><small class="text-gray">PRF: ${order.prfNumber}</small>` : ''}
                                                </td>
                                                <td>${new Date(order.orderDate).toLocaleDateString('id-ID')}</td>
                                                <td>${order.supplierName}</td>
                                                <td>${this.formatCurrency(order.total)}</td>
                                                <td>${this.renderStatusBadge(order.status)}</td>
                                                <td>${this.renderProgressBarHTML(grPercent)}</td>
                                                <td>
                                                    <button onclick="PurchaseOrder.showDetail(${order.id})" class="btn btn-sm btn-secondary">
                                                        View
                                                    </button>
                                                    ${order.status === 'draft' ? `
                                                        <button onclick="PurchaseOrder.showEditModal(${order.id})" class="btn btn-sm btn-primary">
                                                            Edit
                                                        </button>
                                                    ` : ''}
                                                    ${['approved', 'partially_received', 'received'].includes(order.status) ? `
                                                        <button onclick="PurchaseOrder.createAssetFromPO(${order.id})" class="btn btn-sm btn-info" title="Buat Aset dari PO">
                                                            🏢 Jadikan Aset
                                                        </button>
                                                    ` : ''}
                                                    <button onclick="PDFExporter.exportPurchaseOrder(PurchaseOrder.getOrder(${order.id}), Storage.get(Storage.KEYS.CONFIG))" class="btn btn-sm btn-outline-info" title="Cetak PDF">
                                                        📄 PDF
                                                    </button>
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
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
            'submitted': '<span class="badge badge-info">Submitted</span>',
            'approved': '<span class="badge badge-warning">Approved</span>',
            'received': '<span class="badge badge-success">Received</span>',
            'cancelled': '<span class="badge badge-danger">Cancelled</span>'
        };
        return badges[status] || status;
    },

    renderCreateModal() {
        return `
            <div id="po-create-modal" class="modal-overlay hidden">
                <style>
                    #po-create-modal .modal-content {
                        width: 98% !important;
                        max-width: 1600px !important;
                    }
                    #po-create-modal .form-group label {
                        font-size: 1.1rem;
                    }
                    #po-create-modal input, 
                    #po-create-modal select {
                        font-size: 1.1rem !important;
                        padding: 10px !important;
                        height: auto !important;
                    }
                    .po-item-row {
                        background: rgba(255, 255, 255, 0.03);
                        padding: 12px;
                        border-radius: 8px;
                        border: 1px solid rgba(255, 255, 255, 0.1);
                    }
                </style>
                <div class="modal-content" style="width: 98%; max-width: 1600px;">
                    <div class="modal-header">
                        <h2 id="po-modal-title">Create Purchase Order</h2>
                        <button onclick="PurchaseOrder.closeModal()" class="close-btn">×</button>
                    </div>
                    <form id="po-create-form" onsubmit="PurchaseOrder.handleSubmit(event)">
                        <div class="modal-body">
                            <!-- PRF Reference Box (Poin 2) -->
                            <div id="po-prf-reference-box" style="display: none; margin-bottom: 16px; padding: 12px 16px; background: rgba(59, 130, 246, 0.08); border-left: 4px solid #3b82f6; border-radius: 6px;">
                                <strong style="color: #1d4ed8;">📝 Catatan dari PRF:</strong>
                                <span id="po-prf-reference-text" style="margin-left: 8px; color: #1e293b; font-style: italic;"></span>
                            </div>

                            <!-- Supplier Info -->
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Supplier *</label>
                                    <select name="supplier" required onchange="PurchaseOrder.onSupplierChange(this)">
                                        <option value="">Select Supplier</option>
                                        ${this.getSupplierOptions()}
                                    </select>
                                    <small id="supplier-tax-status" class="text-gray" style="display: block; margin-top: 4px;"></small>
                                </div>
                                <div class="form-group">
                                    <label>Order Date *</label>
                                    <input type="date" name="orderDate" required value="${new Date().toISOString().split('T')[0]}">
                                </div>
                                <div class="form-group">
                                    <label>Expected Delivery</label>
                                    <input type="date" name="expectedDate">
                                </div>
                                <div class="form-group">
                                    <label>Referensi <small class="text-gray">(No. Quotation Supplier)</small></label>
                                    <input type="text" name="reference" id="po-reference" placeholder="Contoh: QUO/2026/05/001" maxlength="100">
                                </div>
                            </div>

                            <!-- Items -->
                            <div class="form-group">
                                <label>Items *</label>
                                <div id="po-items-container">
                                    <!-- Items will be added here -->
                                </div>
                                <button type="button" onclick="PurchaseOrder.addItemRow()" class="btn btn-secondary" style="margin-top: 8px;">
                                    ➕ Add Item
                                </button>
                            </div>

                            <!-- Totals (Poin 3: DPP, PPN Auto & Locked, Grand Total) -->
                            <div class="form-row" style="justify-content: flex-end;">
                                <div style="width: 340px;">
                                    <div style="display: flex; justify-content: space-between; padding: 8px 0;">
                                        <span>DPP (Subtotal):</span>
                                        <span id="po-subtotal">Rp 0</span>
                                    </div>
                                    <div style="display: flex; justify-content: space-between; padding: 8px 0; align-items: center;">
                                        <span>PPN (Auto):</span>
                                        <div>
                                            <input type="number" name="taxRate" value="0" readonly 
                                                style="width: 60px; text-align: right; background: var(--color-gray-100, #f1f5f9); cursor: not-allowed;" onchange="PurchaseOrder.calculateTotals()"> %
                                            <span id="po-tax" style="margin-left: 8px;">Rp 0</span>
                                        </div>
                                    </div>
                                    <div style="display: flex; justify-content: space-between; padding: 8px 0; font-weight: 600; font-size: 18px; border-top: 2px solid var(--color-gray-800);">
                                        <span>Grand Total:</span>
                                        <span id="po-total">Rp 0</span>
                                    </div>
                                </div>
                            </div>

                            <!-- Notes -->
                            <div class="form-group">
                                <label>Notes</label>
                                <textarea name="notes" rows="3" placeholder="Catatan tambahan PO"></textarea>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" onclick="PurchaseOrder.closeModal()" class="btn btn-secondary">Cancel</button>
                            <button type="submit" id="po-submit-btn" class="btn btn-primary">Create Purchase Order</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    },

    getSupplierOptions() {
        // Use Storage API
        const suppliers = Storage.getSuppliers();
        return suppliers.map(s => `<option value="${s.id}" data-name="${s.name}" data-tax-status="${s.taxStatus || (s.is_pkp ? 'PKP' : 'NON_PKP')}">${s.code} - ${s.name}</option>`).join('');
    },

    getItemOptions() {
        const items = Storage.getItems();
        return items.map(i => `<option value="${i.id}" data-code="${i.code}" data-name="${i.name}" data-unit="${i.uom || i.unit || ''}">${i.code} - ${i.name}</option>`).join('');
    },

    onSupplierChange(select) {
        const option = select.options[select.selectedIndex];
        if (!option) return;
        // Store supplierName in dataset for form submission
        select.dataset.supplierName = option.dataset.name || '';

        // Enforce Tax Logic (POIN 3: Otomatisasi PPN, locked read-only)
        const taxStatus = option.dataset.taxStatus || 'NON_PKP';
        const taxInput = document.querySelector('[name="taxRate"]');
        const taxStatusLabel = document.getElementById('supplier-tax-status');

        if (taxInput) {
            if (taxStatus === 'PKP') {
                const defaultTaxRate = (typeof Storage !== 'undefined' && Storage.get && Storage.get('erp_settings')?.defaultTaxRate) ?? 11;
                taxInput.value = defaultTaxRate;
                taxInput.readOnly = true; // Auto-calculate & locked
                taxInput.style.backgroundColor = 'var(--color-gray-100, #f1f5f9)';
                if (taxStatusLabel) {
                    taxStatusLabel.innerHTML = `✓ Supplier adalah PKP (PPN ${defaultTaxRate}% Terhitung Otomatis)`;
                    taxStatusLabel.className = 'text-success';
                }
            } else {
                taxInput.value = 0;
                taxInput.readOnly = true; // Locked to 0%
                taxInput.style.backgroundColor = 'var(--color-gray-100, #f1f5f9)';
                if (taxStatusLabel) {
                    taxStatusLabel.innerHTML = '⚠️ Supplier Non-PKP (PPN 0%)';
                    taxStatusLabel.className = 'text-warning';
                }
            }
        }

        this.calculateTotals();
    },

    addItemRow() {
        const container = document.getElementById('po-items-container');
        if (!container) {
            console.warn('⚠️ PurchaseOrder: po-items-container not found. Modal might not be rendered yet.');
            return;
        }
        const row = document.createElement('div');
        row.className = 'po-item-row';
        row.style.cssText = 'display: grid; grid-template-columns: 2fr 1fr 1fr 1fr auto; gap: 8px; margin-bottom: 8px; align-items: end;';
        row.innerHTML = `
            <div class="form-group" style="margin: 0;">
                <select name="itemId[]" required onchange="PurchaseOrder.onItemChange(this)">
                    <option value="">Select Item</option>
                    ${this.getItemOptions()}
                </select>
            </div>
            <div class="form-group" style="margin: 0;">
                <input type="number" name="quantity[]" placeholder="Qty" required min="0.01" step="0.01" onchange="PurchaseOrder.calculateTotals()">
            </div>
            <div class="form-group" style="margin: 0;">
                <input type="number" name="unitPrice[]" placeholder="Unit Price" required min="0" step="0.01" onchange="PurchaseOrder.calculateTotals()">
            </div>
            <div class="form-group" style="margin: 0;">
                <input type="text" class="item-subtotal" readonly placeholder="Subtotal" style="background: #f5f5f5;">
            </div>
            <button type="button" onclick="this.parentElement.remove(); PurchaseOrder.calculateTotals();" class="btn btn-sm btn-danger">×</button>
        `;
        container.appendChild(row);
    },

    onItemChange(select) {
        const option = select.options[select.selectedIndex];
        const row = select.closest('.po-item-row');
        row.dataset.itemCode = option.dataset.code;
        row.dataset.itemName = option.dataset.name;
        row.dataset.unit = option.dataset.unit;
    },

    calculateTotals() {
        const rows = document.querySelectorAll('.po-item-row');
        let subtotal = 0;

        rows.forEach(row => {
            const qty = parseFloat(row.querySelector('[name="quantity[]"]').value) || 0;
            const price = parseFloat(row.querySelector('[name="unitPrice[]"]').value) || 0;
            const itemSubtotal = qty * price;

            row.querySelector('.item-subtotal').value = this.formatCurrency(itemSubtotal);
            subtotal += itemSubtotal;
        });

        const taxRate = parseFloat(document.querySelector('[name="taxRate"]')?.value) || 0;
        const taxAmount = Math.round(subtotal * (taxRate / 100));
        const total = subtotal + taxAmount;

        const subtotalEl = document.getElementById('po-subtotal');
        const taxEl = document.getElementById('po-tax');
        const totalEl = document.getElementById('po-total');

        if (subtotalEl) subtotalEl.textContent = this.formatCurrency(subtotal);
        if (taxEl) taxEl.textContent = this.formatCurrency(taxAmount);
        if (totalEl) totalEl.textContent = this.formatCurrency(total);
    },

    showCreateModal() {
        this._editMode = false;
        this._editingId = null;

        const titleEl = document.getElementById('po-modal-title');
        if (titleEl) titleEl.textContent = 'Create Purchase Order';
        const submitBtn = document.getElementById('po-submit-btn');
        if (submitBtn) submitBtn.textContent = 'Create Purchase Order';

        // Reset PRF reference box
        const prfBox = document.getElementById('po-prf-reference-box');
        if (prfBox) prfBox.style.display = 'none';

        // Reset the form
        const form = document.getElementById('po-create-form');
        if (form) form.reset();
        const container = document.getElementById('po-items-container');
        if (container) container.innerHTML = '';

        const modal = document.getElementById('po-create-modal');
        if (modal) modal.classList.remove('hidden');
        this.addItemRow(); // Add first item row
    },

    showEditModal(id) {
        const order = this.getOrder(id);
        if (!order) return;

        this._editMode = true;
        this._editingId = id;

        const titleEl = document.getElementById('po-modal-title');
        if (titleEl) titleEl.textContent = 'Edit PO: ' + order.poNumber;
        const submitBtn = document.getElementById('po-submit-btn');
        if (submitBtn) submitBtn.textContent = 'Update Purchase Order';

        // PRF reference note (Poin 2)
        const prfBox = document.getElementById('po-prf-reference-box');
        const prfText = document.getElementById('po-prf-reference-text');
        if (order.prfNotes && prfBox && prfText) {
            prfText.textContent = order.prfNotes;
            prfBox.style.display = 'block';
        } else if (prfBox) {
            prfBox.style.display = 'none';
        }

        const modal = document.getElementById('po-create-modal');
        if (modal) modal.classList.remove('hidden');

        // Reset items container then fill form
        const container = document.getElementById('po-items-container');
        if (container) container.innerHTML = '';

        const form = document.getElementById('po-create-form');
        if (!form) return;
        const supplierSelect = form.querySelector('[name="supplier"]');
        if (supplierSelect) {
            supplierSelect.value = order.supplier || '';
            this.onSupplierChange(supplierSelect);
        }
        form.querySelector('[name="orderDate"]').value = order.orderDate || '';
        form.querySelector('[name="expectedDate"]').value = order.expectedDate || '';
        form.querySelector('[name="reference"]').value = order.reference || '';
        form.querySelector('[name="taxRate"]').value = order.taxRate || 0;
        form.querySelector('[name="notes"]').value = order.notes || '';

        // Fill items
        (order.items || []).forEach(item => {
            this.addItemRow();
            const lastRow = container ? container.lastElementChild : null;
            if (!lastRow) return;
            const itemSelect = lastRow.querySelector('[name="itemId[]"]');
            const qtyInput = lastRow.querySelector('[name="quantity[]"]');
            const priceInput = lastRow.querySelector('[name="unitPrice[]"]');
            if (itemSelect) { itemSelect.value = item.itemId; this.onItemChange(itemSelect); }
            if (qtyInput) qtyInput.value = item.quantity;
            if (priceInput) priceInput.value = item.unitPrice;
        });

        this.calculateTotals();
    },

    closeModal() {
        const modal = document.getElementById('po-create-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
        const form = document.getElementById('po-create-form');
        if (form) form.reset();
        const container = document.getElementById('po-items-container');
        if (container) container.innerHTML = '';
    },

    async handleSubmit(event) {
        event.preventDefault();
        const form = event.target;
        const formData = new FormData(form);
        const submitBtn = document.getElementById('po-submit-btn');
        const originalBtnText = submitBtn ? submitBtn.textContent : 'Submit';
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Processing...';
        }

        try {
            // Collect items
            const items = [];
            const itemIds = formData.getAll('itemId[]');
            const quantities = formData.getAll('quantity[]');
            const unitPrices = formData.getAll('unitPrice[]');

            itemIds.forEach((itemId, index) => {
                if (itemId) {
                    const row = document.querySelectorAll('.po-item-row')[index];
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

            // Get supplierName from the select element's dataset
            const supplierSelect = form.querySelector('[name="supplier"]');
            const supplierName = supplierSelect?.dataset?.supplierName ||
                supplierSelect?.options[supplierSelect.selectedIndex]?.dataset?.name ||
                'Unknown Supplier';

            const orderData = {
                supplier: formData.get('supplier'),
                supplierName: supplierName,
                orderDate: formData.get('orderDate'),
                expectedDate: formData.get('expectedDate'),
                reference: formData.get('reference') || '',
                items: items,
                taxRate: formData.get('taxRate'),
                notes: formData.get('notes')
            };

            let result;
            if (this._editMode) {
                result = await this.updateOrder(this._editingId, orderData);
            } else {
                result = await this.createOrder(orderData);
            }

            if (result.success) {
                this.closeModal();
                alert(this._editMode ? 'Purchase Order updated successfully!' : 'Purchase Order created successfully!');
                App.navigateTo('purchase-order');
            } else if (result.errors) {
                alert('Error: ' + (typeof result.errors === 'string' ? result.errors : Object.values(result.errors).join(', ')));
            }
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
            }
        }
    },

    showDetail(id) {
        const order = this.getOrder(id);
        if (!order) return;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay'; // Use modal-overlay for backdrop
        modal.id = 'po-detail-modal';
        modal.innerHTML = `
            <style>
                .po-view-modal {
                    width: 98% !important;
                    max-width: 1600px !important;
                }
                .po-view-modal p {
                    font-size: 1.1rem;
                }
                .po-view-modal .table th,
                .po-view-modal .table td {
                    font-size: 1.1rem;
                    padding: 12px;
                }
            </style>
            <div class="modal-content po-view-modal" style="width: 98%; max-width: 1600px;">
                <div class="modal-header">
                    <h2>Purchase Order: ${order.poNumber}</h2>
                    <button onclick="this.closest('.modal-overlay').remove()" class="close-btn">×</button>
                </div>
                <div class="modal-body">
                    <!-- PRF Note Box (Poin 2) -->
                    ${order.prfNotes ? `
                        <div style="margin-bottom: 16px; padding: 12px 16px; background: rgba(59, 130, 246, 0.08); border-left: 4px solid #3b82f6; border-radius: 6px;">
                            <strong style="color: #1d4ed8;">📝 Catatan dari PRF (${order.prfNumber || '-'}):</strong> 
                            <span style="margin-left: 8px; color: #1e293b; font-style: italic;">${order.prfNotes}</span>
                        </div>
                    ` : ''}

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px;">
                        <div>
                            <h4>Supplier Information</h4>
                            <p><strong>${order.supplierName}</strong></p>
                        </div>
                        <div>
                            <h4>Order Information</h4>
                            <p>Date: ${new Date(order.orderDate).toLocaleDateString('id-ID')}</p>
                            <p>Status: ${this.renderStatusBadge(order.status)}</p>
                            ${order.reference ? `<p><strong>📎 Referensi:</strong> <span style="color: #60a5fa; font-weight: 600;">${order.reference}</span></p>` : ''}
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
                                    <td>${item.quantity} ${item.unit && item.unit !== 'undefined' ? item.unit : ''}</td>
                                    <td>${this.formatCurrency(item.unitPrice)}</td>
                                    <td>${this.formatCurrency(item.subtotal)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colspan="3" style="text-align: right;"><strong>Subtotal (DPP):</strong></td>
                                <td><strong>${this.formatCurrency(order.subtotal)}</strong></td>
                            </tr>
                            <tr>
                                <td colspan="3" style="text-align: right;">Tax PPN (${order.taxRate}%):</td>
                                <td>${this.formatCurrency(order.taxAmount)}</td>
                            </tr>
                            <tr>
                                <td colspan="3" style="text-align: right; font-size: 18px;"><strong>Total:</strong></td>
                                <td style="font-size: 18px;"><strong>${this.formatCurrency(order.total)}</strong></td>
                            </tr>
                        </tfoot>
                    </table>

                    ${order.notes ? `<p><strong>Notes:</strong> ${order.notes}</p>` : ''}

                    ${order.status === 'received' && order.journalStatus === 'pending_approval' ? `
                        <div style="margin-top: 24px; border: 2px solid #f57c00; border-radius: 8px; padding: 16px; background: rgba(245,124,0,0.07);">
                            <h4 style="margin: 0 0 12px; color: #f57c00;">⏳ Jurnal Menunggu Persetujuan Finance Manager</h4>
                            <p style="font-size: 13px; color: #aaa; margin-bottom: 12px;">
                                Stok gudang sudah diupdate. Jurnal berikut akan diposting setelah disetujui:
                            </p>
                            <table class="table" style="font-size: 13px;">
                                <thead>
                                    <tr>
                                        <th>Akun</th>
                                        <th>Keterangan</th>
                                        <th class="text-right">Debet</th>
                                        <th class="text-right">Kredit</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${(order.pendingJournalData?.lines || []).map(line => `
                                        <tr>
                                            <td style="font-family:monospace;">${line.accountCode} — ${line.accountName}</td>
                                            <td style="color:#aaa; font-size:12px;">${line.description || '-'}</td>
                                            <td class="text-right">${line.debit > 0 ? this.formatCurrency(line.debit) : '-'}</td>
                                            <td class="text-right">${line.credit > 0 ? this.formatCurrency(line.credit) : '-'}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : ''}

                    ${order.status === 'received' && order.journalStatus === 'posted' ? `
                        <div style="margin-top: 16px; padding: 12px 16px; background: rgba(56,142,60,0.1); border-left: 4px solid #388e3c; border-radius: 4px;">
                            ✅ <strong>Jurnal sudah diposting</strong> oleh ${order.journalApprovedBy || 'Finance Manager'}
                            ${order.journalPostedAt ? ` pada ${new Date(order.journalPostedAt).toLocaleString('id-ID')}` : ''}
                        </div>
                    ` : ''}
                </div>
                <div class="modal-footer">
                    ${order.status === 'draft' ? `
                        <button onclick="PurchaseOrder.changeStatus(${order.id}, 'submitted').then(() => { this.closest('.modal-overlay').remove(); App.navigateTo('purchase-order'); })" class="btn btn-primary">
                            Submit for Approval
                        </button>
                    ` : ''}
                    ${order.status === 'submitted' ? `
                        <button onclick="PurchaseOrder.changeStatus(${order.id}, 'approved').then(() => { this.closest('.modal-overlay').remove(); App.navigateTo('purchase-order'); })" class="btn btn-success">
                            Approve
                        </button>
                    ` : ''}
                    ${order.status === 'approved' ? `
                        <button onclick="PurchaseOrder.changeStatus(${order.id}, 'received').then(() => { this.closest('.modal-overlay').remove(); App.navigateTo('purchase-order'); })" class="btn btn-success">
                            Mark as Received
                        </button>
                    ` : ''}
                    ${['approved', 'partially_received', 'received'].includes(order.status) ? `
                        <button onclick="PurchaseOrder.createAssetFromPO(${order.id})" class="btn btn-info" style="font-weight:600;">
                            🏢 Jadikan Aset
                        </button>
                    ` : ''}
                    ${order.status === 'received' && order.journalStatus === 'pending_approval' ? `
                        <button onclick="PurchaseOrder.approveJournal(${order.id})" class="btn btn-warning" style="font-weight:bold;">
                            📋 Setujui & Posting Jurnal
                        </button>
                    ` : ''}
                    <button onclick="PDFExporter.exportPurchaseOrder(PurchaseOrder.getOrder(${order.id}), Storage.get(Storage.KEYS.CONFIG))" class="btn btn-info">
                        🖨️ Cetak PDF
                    </button>
                    <button onclick="this.closest('.modal-overlay').remove()" class="btn btn-secondary">Close</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    createAssetFromPO(poId) {
        const order = this.getOrder(poId);
        if (!order) {
            alert('PO tidak ditemukan');
            return;
        }
        if (typeof FixedAssets !== 'undefined' && typeof FixedAssets.showCreateFromPOModal === 'function') {
            const currentModal = document.getElementById('po-detail-modal');
            if (currentModal) currentModal.remove();
            FixedAssets.showCreateFromPOModal(order.id);
        } else {
            alert('Modul Fixed Assets belum dimuat');
        }
    },

    formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    }
};


// Explicitly make PurchaseOrder globally available
window.PurchaseOrder = PurchaseOrder;
