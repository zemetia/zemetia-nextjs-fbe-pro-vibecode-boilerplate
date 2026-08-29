// ==========================================
// Receipt Voucher Module (BKM/BBM)
// Bukti Kas Masuk / Bukti Bank Masuk  
// Cash and bank receipts with multi-line items and auto journal posting
// ==========================================

const ReceiptVoucher = {
    vouchers: [],
    currentVoucher: null,
    _editMode: false,
    _editingId: null,

    // Voucher types
    voucherTypes: {
        BKM: 'Bukti Kas Masuk',
        BBM: 'Bukti Bank Masuk'
    },

    // Voucher statuses - SIMPLIFIED: No multi-level approval for receipts
    statuses: {
        draft: 'Draft',
        verified: 'Verified',  // Verified by Kasir
        director_approved: 'Approved by Director',
        posted: 'Posted to Journal',
        voided: 'Voided'
    },

    // Approval limits
    approvalLimits: {
        kasir: { canCreate: true, canVerify: true },
        manager_finance: { canCreate: true, canVerify: true, canApprove: true },
        finance: { canCreate: true, canVerify: true },
        director: { canCreate: true, canVerify: true, canApprove: true },
        ADMIN: { canCreate: true, canVerify: true, canApprove: true }
    },

    // Approval thresholds
    approvalThresholds: {
        director: 10000000 // 10 Million
    },

    // Get required approval
    getRequiredApprovals(amount) {
        const approvals = ['kasir'];
        if (amount >= this.approvalThresholds.director) {
            approvals.push('director');
        }
        return approvals;
    },

    // Receipt methods
    receiptMethods: {
        cash: 'Cash',
        check: 'Check',
        giro: 'Giro',
        transfer: 'Bank Transfer'
    },

    // Receipt categories  
    receiptCategories: {
        customer: 'Customer Payment',
        capital: 'Capital Injection',
        loan: 'Loan Receipt',
        other: 'Other Income'
    },

    async init() {
        await this.loadVouchers();
        this.render();
    },

    async loadVouchers() {
        try {
            // Using central sync strategy
            const vouchers = Storage.getReceiptVouchers();
            this.vouchers = vouchers || [];
            console.log(`📦 Loaded ${this.vouchers.length} receipt vouchers from Local Mirror`);
        } catch (error) {
            console.error('Error loading vouchers:', error);
            this.vouchers = [];
        }
    },

    async saveVouchers(specificVoucher = null) {
        return await Storage.saveReceiptVouchers(this.vouchers, specificVoucher);
    },

    // ... (rest of methods)

    async deleteVoucher(id) {
        const voucher = this.getVoucher(id);
        if (!voucher) return { success: false, errors: { voucher: 'Voucher not found' } };

        if (voucher.status !== 'draft') {
            return { success: false, errors: { status: 'Can only delete draft vouchers' } };
        }

        const originalVouchers = [...this.vouchers];
        this.vouchers = this.vouchers.filter(v => v.id !== id);

        try {
            await this.saveVouchers();
            if (typeof FirebaseSync !== 'undefined' && FirebaseSync.isEnabled()) {
                await FirebaseSync.deleteFromCloud(Storage.KEYS.RECEIPT_VOUCHERS, id);
            }
            AuditLog.log('delete', 'receipt_voucher', id, `Deleted voucher: ${voucher.voucherNumber}`);
            return { success: true };
        } catch (error) {
            this.vouchers = originalVouchers;
            return { success: false, errors: { sync: error.message } };
        }
    },

    async generateVoucherNumber(type) {
        // ☁️ Use Atomic Cloud Sequencer
        const nextRef = await Storage.getNextReferenceNumber(type);
        if (nextRef) return nextRef;

        const prefix = type; // 'BKM' or 'BBM'
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');

        const vouchers = this.vouchers.filter(v =>
            v.type === type &&
            v.voucherNumber && v.voucherNumber.startsWith(`${prefix}-${year}${month}`)
        );

        const nextNum = String(vouchers.length + 1).padStart(4, '0');
        return `${prefix}-${year}${month}-${nextNum}`;
    },

    async createVoucher(data) {
        // Support both multi-line and single-line format
        let lineItems = [];
        let totalAmount = 0;

        // NEW: Multi-line items support
        if (data.lineItems && Array.isArray(data.lineItems) && data.lineItems.length > 0) {
            // Validate each line item
            for (const item of data.lineItems) {
                if (!item.accountCode || !item.amount) {
                    return {
                        success: false,
                        errors: { validation: 'Each line item must have account code and amount' }
                    };
                }
            }
            lineItems = data.lineItems;
            totalAmount = lineItems.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
        } else {
            // OLD: Backward compatible - single line format
            if (!data.type || !data.receiveFrom || !data.amount || !data.purpose) {
                return {
                    success: false,
                    errors: { validation: 'Type, Receive From, Amount, and Purpose are required' }
                };
            }
            // Convert single line to lineItems format
            lineItems = [{
                accountCode: data.revenueAccount || '41101',
                accountName: data.revenueName || 'Revenue',
                description: data.purpose,
                amount: parseFloat(data.amount)
            }];
            totalAmount = parseFloat(data.amount);
        }

        const voucher = {
            id: Date.now(),
            voucherNumber: await this.generateVoucherNumber(data.type),
            type: data.type,
            date: data.date || new Date().toISOString().split('T')[0],
            receiveFrom: data.receiveFrom,
            purpose: data.purpose,
            receiptCategory: data.receiptCategory || 'other',

            // NEW: Multi-line items support
            lineItems: lineItems,
            totalAmount: totalAmount,

            // OLD: Keep for backward compatibility
            amount: totalAmount,
            revenueAccount: data.revenueAccount || (lineItems[0]?.accountCode),

            // Receipt details
            receiptMethod: data.receiptMethod || 'cash',
            bankAccountId: data.bankAccountId || null,
            checkNumber: data.checkNumber || null,
            giroDate: data.giroDate || null,

            // Workflow
            status: data.status || 'draft',
            createdBy: Auth.getCurrentUser().id,
            createdByName: Auth.getCurrentUser().name,
            createdAt: new Date().toISOString(),

            // Accounting
            journalEntryId: null,
            reversalJournalEntryId: null,
            postedAt: null,
            autoPostJournal: data.autoPostJournal !== false, // Default: true

            // Account codes
            cashBankAccount: data.type === 'BKM' ? '11101' : data.bankAccountId
        };

        this.vouchers.push(voucher);
        await this.saveVouchers();

        // Log audit
        AuditLog.log('create', 'receipt_voucher', voucher.id,
            `Created ${voucher.type} ${voucher.voucherNumber}`);

        // Auto-post if enabled and verified
        if (voucher.autoPostJournal && voucher.status === 'verified') {
            await this.postToJournal(voucher.id);
        }

        return { success: true, voucher };
    },

    // SIMPLIFIED: verifyVoucher - kasir verifies and auto-posts to journal
    async verifyVoucher(voucherId) {
        const voucher = this.getVoucher(voucherId);
        if (!voucher) {
            return { success: false, errors: { voucher: 'Voucher not found' } };
        }

        if (voucher.status !== 'draft') {
            return { success: false, errors: { status: 'Can only verify draft vouchers' } };
        }

        const currentUser = Auth.getCurrentUser();
        const userRole = currentUser.role;

        // Any authorized user can verify receipts
        const canVerify = this.approvalLimits[userRole]?.canVerify || userRole === 'ADMIN';
        if (!canVerify) {
            return { success: false, errors: { permission: 'You do not have permission to verify receipts' } };
        }

        // Set as verified
        voucher.status = 'verified';
        voucher.verifiedBy = currentUser.id;
        voucher.verifiedByName = currentUser.name;
        voucher.verifiedAt = new Date().toISOString();
        AuditLog.log('update', 'receipt_voucher', voucherId, 'Verified by Kasir');

        await this.saveVouchers();

        // Check if director approval is needed
        const reqApprovals = this.getRequiredApprovals(voucher.totalAmount || voucher.amount);
        
        // AUTO-POST only if ONLY kasir is needed
        if (voucher.autoPostJournal && reqApprovals.length === 1 && reqApprovals.includes('kasir')) {
            console.log(`🚀 AUTO-POST triggered for receipt ${voucher.voucherNumber}`);
            const postResult = await this.postToJournal(voucherId);
            if (postResult.success) {
                AuditLog.log('update', 'receipt_voucher', voucherId, 'Auto-posted to journal after verification');
            }
        }

        return { success: true, voucher };
    },

    async approveByDirector(voucherId) {
        const voucher = this.getVoucher(voucherId);
        if (!voucher) return { success: false, errors: { voucher: 'Voucher not found' } };

        if (voucher.status !== 'verified') {
            return { success: false, errors: { status: 'Voucher must be verified by Kasir first' } };
        }

        const currentUser = Auth.getCurrentUser();
        const userRole = currentUser.role;

        // Director or Admin or Manager Finance can approve 10M+ receipts
        const canApprove = this.approvalLimits[userRole]?.canApprove || userRole === 'ADMIN';
        if (!canApprove) {
            return { success: false, errors: { permission: 'Hanya Direktur yang dapat menyetujui transaksi ini.' } };
        }

        voucher.status = 'director_approved';
        voucher.approvedBy = currentUser.id;
        voucher.approvedByName = currentUser.name;
        voucher.approvedAt = new Date().toISOString();
        AuditLog.log('update', 'receipt_voucher', voucherId, 'Approved by Director');

        await this.saveVouchers();

        // Auto-post after director approval if enabled
        if (voucher.autoPostJournal) {
            await this.postToJournal(voucherId);
        }

        return { success: true, voucher };
    },

    // Legacy function - redirects to verifyVoucher
    approveVoucher(voucherId, approved = true, reason = '') {
        return this.verifyVoucher(voucherId);
    },

    async postToJournal(voucherId) {
        const voucher = this.getVoucher(voucherId);
        if (!voucher) {
            return { success: false, errors: { voucher: 'Voucher not found' } };
        }

        // SIMPLIFIED: Accept 'verified' or 'director_approved' status
        const allowedStatuses = ['verified', 'director_approved'];
        if (!allowedStatuses.includes(voucher.status)) {
            return { success: false, errors: { status: 'Voucher must be verified or approved first' } };
        }

        // Generate journal entry
        const journalEntry = {
            date: voucher.date,
            description: `${voucher.type} - ${voucher.voucherNumber} - ${voucher.purpose}`,
            reference: voucher.voucherNumber,
            lines: []
        };

        // DEBIT: Cash or Bank
        let cashBankAccountCode = voucher.type === 'BKM' ? '11101' : voucher.cashBankAccount;
        const totalAmount = voucher.totalAmount || voucher.amount;
        let cashBankAccountName = '';

        if (voucher.type === 'BBM' && typeof Storage !== 'undefined') {
            const banks = Storage.getBankAccounts() || [];
            const bank = banks.find(b => b.id === voucher.cashBankAccount);
            if (bank && bank.glAccount) {
                cashBankAccountCode = bank.glAccount;
            }
        }
        
        if (typeof ChartOfAccounts !== 'undefined') {
            const acc = ChartOfAccounts.getAccount(cashBankAccountCode);
            if (acc) cashBankAccountName = acc.name;
        }

        journalEntry.lines.push({
            accountCode: cashBankAccountCode,
            accountName: cashBankAccountName,
            debit: totalAmount,  // DEBIT to cash/bank
            credit: 0,
            description: `Receipt via ${voucher.receiptMethod}`
        });

        // CREDIT: Revenue/AR line items (OPPOSITE of payment!)
        if (voucher.lineItems && Array.isArray(voucher.lineItems) && voucher.lineItems.length > 0) {
            voucher.lineItems.forEach(item => {
                journalEntry.lines.push({
                    accountCode: item.accountCode,
                    accountName: item.accountName || ChartOfAccounts.getAccount(item.accountCode)?.name || '',
                    debit: 0,
                    credit: parseFloat(item.amount),  // CREDIT to revenue/AR
                    description: item.description || voucher.purpose
                });
            });
        } else {
            // OLD: Backward compatible - single line
            journalEntry.lines.push({
                accountCode: voucher.revenueAccount,
                accountName: typeof ChartOfAccounts !== 'undefined' ? (ChartOfAccounts.getAccount(voucher.revenueAccount)?.name || '') : '',
                debit: 0,
                credit: voucher.amount,
                description: voucher.purpose
            });
        }

        // Post to journal
        try {
            const entry = await JournalEntry.createEntry(journalEntry);

            // createEntry returns the raw entry object on success
            voucher.status = 'posted';
            voucher.journalEntryId = entry.id;
            voucher.postedAt = new Date().toISOString();
            voucher.postedBy = Auth.getCurrentUser().id;
            voucher.postedByName = Auth.getCurrentUser().name;

            await this.saveVouchers(voucher);
            AuditLog.log('update', 'receipt_voucher', voucherId, 'Posted to journal');

            return { success: true, entry };
        } catch (error) {
            console.error('Failed to post journal:', error);
            return { success: false, errors: { journal: error.message } };
        }
    },

    getVoucher(id) {
        return this.vouchers.find(v => v.id === id);
    },

    getAllVouchers() {
        return this.vouchers;
    },

    getVouchersByStatus(status) {
        return this.vouchers.filter(v => v.status === status);
    },



    async voidVoucher(id, reason) {
        const voucher = this.getVoucher(id);
        if (!voucher) {
            return { success: false, errors: { voucher: 'Voucher not found' } };
        }

        // Cannot void if already voided
        if (voucher.status === 'voided') {
            return { success: false, errors: { status: 'Voucher is already voided' } };
        }

        // Mandatory reason for void
        if (!reason || reason.trim() === '') {
            return { success: false, errors: { reason: 'Please provide a reason for voiding this voucher' } };
        }

        const currentUser = Auth.getCurrentUser();
        const oldStatus = voucher.status;

        // CRITICAL: Create reversal journal entry if posted
        if (voucher.journalEntryId) {
            console.log(`🔄 Creating reversal journal entry for ${voucher.voucherNumber}`);

            const journalEntries = Storage.getJournalEntries();
            const originalEntry = journalEntries.find(e => e.id === voucher.journalEntryId);

            if (originalEntry) {
                // Create reversal entry (swap debit/credit)
                const reversalLines = originalEntry.lines.map(line => ({
                    accountCode: line.accountCode,
                    accountName: line.accountName,
                    description: line.description,
                    debit: line.credit || 0,  // Swap: original credit becomes debit
                    credit: line.debit || 0   // Swap: original debit becomes credit
                }));
                const totalDebit = reversalLines.reduce((sum, line) => sum + (line.debit || 0), 0);
                const totalCredit = reversalLines.reduce((sum, line) => sum + (line.credit || 0), 0);

                const reversalEntry = {
                    id: 'JE-' + Date.now() + '-REV',
                    date: new Date().toISOString().split('T')[0],
                    description: `REVERSAL: ${originalEntry.description} (Voided: ${reason})`,
                    reference: `REV-${voucher.voucherNumber}`,
                    transactionType: originalEntry.transactionType || 'JRN',
                    sourceDocument: 'receipt_voucher_void',
                    sourceDocumentId: id,
                    createdBy: currentUser.id,
                    createdByName: currentUser.name,
                    createdAt: new Date().toISOString(),
                    isReversal: true,
                    reversalOf: voucher.journalEntryId,
                    lines: reversalLines,
                    totalDebit: totalDebit,
                    totalCredit: totalCredit
                };

                journalEntries.push(reversalEntry);
                await Storage.setJournalEntries(journalEntries);
                
                if (typeof JournalEntry !== 'undefined') {
                    JournalEntry.loadEntries();
                    if (typeof JournalEntry.updateAccountBalances === 'function') {
                        JournalEntry.updateAccountBalances(reversalEntry);
                    }
                }

                // Store reversal entry ID
                voucher.reversalJournalEntryId = reversalEntry.id;
            }
        }

        // Update voucher to voided status
        voucher.status = 'voided';
        voucher.voidedAt = new Date().toISOString();
        voucher.voidedBy = currentUser.id;
        voucher.voidedByName = currentUser.name;
        voucher.voidReason = reason;

        await this.saveVouchers();
        AuditLog.log('void', 'receipt_voucher', id, `Voided ${voucher.voucherNumber}: ${reason}`);

        return { success: true, voucher };
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

    printVoucher(id) {
        const voucher = this.getVoucher(id);
        if (!voucher) return;
        
        if (typeof PDFExporter !== 'undefined' && typeof PDFExporter.exportReceiptVoucher === 'function') {
            const config = Storage.get(Storage.KEYS.CONFIG) || {};
            PDFExporter.exportReceiptVoucher(voucher, config);
        } else {
            alert('PDF Exporter module is not ready. Please try again.');
        }
    },

    getStatusBadgeClass(status) {
        const classes = {
            draft: 'badge-secondary',
            verified: 'badge-info',
            director_approved: 'badge-primary',
            posted: 'badge-success',
            voided: 'badge-danger'
        };
        return classes[status] || 'badge-secondary';
    },

    getStatusLabel(status) {
        return this.statuses[status] || status;
    },

    // UI Rendering continues in next section...
    render() {
        const content = document.getElementById('main-content');
        content.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">📥 Receipt Voucher (BKM/BBM)</h1>
                <p class="page-description">Cash and bank receipt management with auto journal posting</p>
            </div>

            ${this.renderFilterTabs()}
            ${this.renderVoucherList()}
            ${this.renderCreateModal()}
            ${this.renderViewModal()}
        `;

        this.attachEventListeners();
    },

    renderFilterTabs() {
        const statusCounts = {
            all: this.vouchers.length,
            draft: this.getVouchersByStatus('draft').length,
            posted: this.getVouchersByStatus('posted').length,
            voided: this.getVouchersByStatus('voided').length
        };

        return `
            <div class="tabs">
                <button class="tab-btn active" data-status="all">
                    All (${statusCounts.all})
                </button>
                <button class="tab-btn" data-status="draft">
                    Draft (${statusCounts.draft})
                </button>
                <button class="tab-btn" data-status="posted">
                    Posted (${statusCounts.posted})
                </button>
                <button class="tab-btn" data-status="voided">
                    Voided (${statusCounts.voided})
                </button>
            </div>
        `;
    },

    renderVoucherList() {
        const vouchers = this.vouchers.sort((a, b) => b.id - a.id);

        return `
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">Receipt Vouchers</h2>
                    <button class="btn btn-primary" onclick="ReceiptVoucher.showCreateModal()">
                        ➕ New Receipt Voucher
                    </button>
                </div>
                <div class="card-body">
                    <div class="table-container">
                        <table class="table" id="vouchers-table">
                            <thead>
                                <tr>
                                    <th>Voucher #</th>
                                    <th>Type</th>
                                    <th>Date</th>
                                    <th>Receive From</th>
                                    <th>Amount</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${vouchers.length === 0 ? `
                                    <tr>
                                        <td colspan="7" class="text-center" style="padding: 3rem;">
                                            <p style="color: var(--text-secondary);">No receipt vouchers yet</p>
                                            <button class="btn btn-primary" onclick="ReceiptVoucher.showCreateModal()">
                                                Create First Voucher
                                            </button>
                                        </td>
                                    </tr>
                                ` : vouchers.map(v => `
                                    <tr data-status="${v.status}">
                                        <td><strong>${v.voucherNumber}</strong></td>
                                        <td><span class="badge badge-info">${v.type}</span></td>
                                        <td>${this.formatDate(v.date)}</td>
                                        <td>${v.receiveFrom}</td>
                                        <td><strong>${this.formatCurrency(v.totalAmount || v.amount)}</strong></td>
                                        <td><span class="badge ${this.getStatusBadgeClass(v.status)}">${this.getStatusLabel(v.status)}</span></td>
                                        <td>
                                            <div class="btn-group">
                                                <button class="btn btn-sm btn-secondary" onclick="ReceiptVoucher.showViewModal(${v.id})" title="View">
                                                    👁️
                                                </button>
                                                <button class="btn btn-sm btn-outline" onclick="ReceiptVoucher.printVoucher(${v.id})" title="Print PDF">
                                                    🖨️
                                                </button>
                                                ${v.status === 'draft' ? `
                                                    <button class="btn btn-sm btn-secondary" onclick="ReceiptVoucher.showEditModal(${v.id})" title="Edit">
                                                        ✏️
                                                    </button>
                                                    <button class="btn btn-sm btn-danger" onclick="if(confirm('Delete this voucher?')) { ReceiptVoucher.deleteVoucher(${v.id}).then(() => ReceiptVoucher.render()); }" title="Delete">
                                                        🗑️
                                                    </button>
                                                    <button class="btn btn-sm btn-success" onclick="ReceiptVoucher.verifyVoucher(${v.id}).then(() => ReceiptVoucher.render());" title="Verify & Post">
                                                        ✓ Verify ${ (v.totalAmount || v.amount) >= 10000000 ? '' : '& Post' }
                                                    </button>
                                                ` : ''}
                                                ${v.status === 'verified' && (v.totalAmount || v.amount) >= 10000000 ? `
                                                    <button class="btn btn-sm btn-primary" onclick="ReceiptVoucher.approveByDirector(${v.id}).then(() => ReceiptVoucher.render());" title="Approve">
                                                        ⭐ Approve (Director)
                                                    </button>
                                                ` : ''}
                                                ${(v.status === 'verified' || v.status === 'director_approved') && !v.journalEntryId ? `
                                                    <button class="btn btn-sm btn-info" onclick="ReceiptVoucher.postToJournal(${v.id}).then(() => ReceiptVoucher.render());" title="Post to Journal">
                                                        🚀 Post to Journal
                                                    </button>
                                                ` : ''}
                                            </div>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    },

    renderCreateModal() {
        return `
            <div id="create-receipt-modal" class="modal-overlay hidden">
        <div class="modal" style="max-width: 900px;">
            <div class="modal-header">
                <h3 id="receipt-modal-title" class="modal-title">Create New Receipt Voucher</h3>
                <button class="modal-close" onclick="ReceiptVoucher.closeCreateModal()">×</button>
            </div>
            <div class="modal-body">
                <form id="receipt-form">
                    <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
                        <div class="form-group">
                            <label class="form-label required">Type</label>
                            <select id="receipt-type" class="form-select" required>
                                <option value="">Select Type</option>
                                <option value="BKM">BKM - Bukti Kas Masuk</option>
                                <option value="BBM">BBM - Bukti Bank Masuk</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Voucher Number</label>
                            <input type="text" id="receipt-number" class="form-input" readonly style="background: var(--bg-tertiary);" value="Auto-generated">
                        </div>
                        <div class="form-group">
                            <label class="form-label required">Date</label>
                            <input type="date" id="receipt-date" class="form-input" required>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label required">Receive From</label>
                        <input type="text" id="receipt-from" class="form-input" required placeholder="Customer/Investor name">
                    </div>

                    <div class="form-group">
                        <label class="form-label required">Purpose</label>
                        <textarea id="receipt-purpose" class="form-input" rows="2" required placeholder="Receipt purpose/description"></textarea>
                    </div>

                    <!-- Multi-Line Income Items -->
                    <div class="form-group" style="border: 1px solid var(--color-gray-800); border-radius: 8px; padding: 16px; background: var(--bg-tertiary);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                            <label class="form-label" style="margin: 0;">Income Line Items</label>
                            <button type="button" class="btn btn-sm btn-secondary" onclick="ReceiptVoucher.addLineItem()">
                                ➕ Add Line Item
                            </button>
                        </div>

                        <div class="table-container" style="margin-bottom: 12px;">
                            <table class="table table-sm">
                                <thead>
                                    <tr>
                                        <th style="width: 40%;">Account</th>
                                        <th style="width: 60%;">Description</th>
                                        <th style="width: 200px; min-width: 200px;" class="text-right">Amount</th>
                                        <th style="width: 60px; min-width: 60px;" class="text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody id="receipt-line-items-body">
                                    <!-- Dynamic line items -->
                                </tbody>
                                <tfoot>
                                    <tr style="font-weight: 600; background: var(--bg-secondary);">
                                        <td colspan="2" class="text-right">Total:</td>
                                        <td class="text-right" id="receipt-line-items-total" style="width: 200px; min-width: 200px;">Rp 0</td>
                                        <td style="width: 60px; min-width: 60px;"></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        <div style="font-size: 12px; color: var(--text-secondary);">
                            💡 Tip: Add multiple income sources with different account codes (e.g., Revenue, AR Reduction)
                        </div>
                    </div>

                    <!-- Auto-Post Journal -->
                    <div class="form-group">
                        <label style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
                            <input type="checkbox" id="receipt-auto-post-journal" checked style="width: 18px; height: 18px;">
                                <span>
                                    <strong>Auto-post to journal when verified</strong>
                                    <br>
                                        <small style="color: var(--text-secondary);">Journal entry will be automatically created</small>
                                </span>
                        </label>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Receipt Category</label>
                        <select id="receipt-category" class="form-select">
                            <option value="customer">Customer Payment</option>
                            <option value="capital">Capital Injection</option>
                            <option value="loan">Loan Receipt</option>
                            <option value="other">Other Income</option>
                        </select>
                    </div>

                    <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div class="form-group">
                            <label class="form-label">Receipt Method</label>
                            <select id="receipt-method" class="form-select">
                                <option value="cash">Cash</option>
                                <option value="transfer">Bank Transfer</option>
                                <option value="check">Check</option>
                                <option value="giro">Giro</option>
                            </select>
                        </div>
                        <div class="form-group" id="receipt-bank-section" style="display: none;">
                            <label class="form-label">Bank Account</label>
                            <select id="receipt-bank" class="form-select">
                                <option value="">Select Bank</option>
                            </select>
                        </div>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onclick="ReceiptVoucher.closeCreateModal()">
                    Cancel
                </button>
                <button type="button" id="btn-submit-receipt" class="btn btn-primary" onclick="ReceiptVoucher.submitReceiptForm()">
                    Create Receipt
                </button>
            </div>
        </div>
            </div>
    `;
    },

    renderViewModal() {
        return `
            <div id="view-receipt-modal" class="modal-overlay hidden">
        <div class="modal" style="max-width: 800px;">
            <div class="modal-header">
                <h3 class="modal-title">Receipt Voucher Details</h3>
                <button class="modal-close" onclick="ReceiptVoucher.closeViewModal()">×</button>
            </div>
            <div class="modal-body" id="view-receipt-content">
                <!-- Dynamic content -->
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onclick="ReceiptVoucher.closeViewModal()">
                    Close
                </button>
            </div>
        </div>
        </div>
    `;
    },

    // Line Items Management
    addLineItem() {
        const accounts = ChartOfAccounts.getDetailAccounts();
        const row = `
            <tr>
                <td>
                    <select class="form-select receipt-line-account" required style="width: 100%;">
                        <option value="">-- Select Account --</option>
                        ${accounts.map(acc =>
            `<option value="${acc.code}">${acc.code} - ${acc.name}</option>`
        ).join('')}
                    </select>
                </td>
                <td>
                    <input type="text" class="form-input receipt-line-description" 
                           placeholder="Description" style="width: 100%;">
                </td>
                <td style="width: 200px; min-width: 200px;">
                    <input type="number" class="form-input receipt-line-amount" 
                           placeholder="0" min="0" step="1000" required
                           onchange="ReceiptVoucher.calculateTotal()"
                           style="width: 100%; text-align: right;">
                </td>
                <td class="text-center" style="width: 60px; min-width: 60px;">
                    <button type="button" class="btn btn-sm btn-danger" 
                            onclick="this.closest('tr').remove(); ReceiptVoucher.calculateTotal();"
                            title="Remove line item">
                        🗑️
                    </button>
                </td>
            </tr>
    `;

        const tbody = document.getElementById('receipt-line-items-body');
        if (tbody) {
            tbody.insertAdjacentHTML('beforeend', row);
        }
    },

    calculateTotal() {
        const amounts = document.querySelectorAll('.receipt-line-amount');
        const total = Array.from(amounts).reduce((sum, input) => {
            return sum + (parseFloat(input.value) || 0);
        }, 0);

        const totalElement = document.getElementById('receipt-line-items-total');
        if (totalElement) {
            totalElement.textContent = this.formatCurrency(total);
        }
    },

    getLineItems() {
        const rows = document.querySelectorAll('#receipt-line-items-body tr');
        const lineItems = [];

        rows.forEach(row => {
            const accountSelect = row.querySelector('.receipt-line-account');
            const accountCode = accountSelect?.value;

            if (accountCode) {
                const account = ChartOfAccounts.getAccount(accountCode);
                lineItems.push({
                    accountCode: accountCode,
                    accountName: account?.name || '',
                    description: row.querySelector('.receipt-line-description')?.value || '',
                    amount: parseFloat(row.querySelector('.receipt-line-amount')?.value) || 0
                });
            }
        });

        return lineItems;
    },

    getFormData() {
        const type = document.getElementById('receipt-type').value;
        const date = document.getElementById('receipt-date').value;
        const receiveFrom = document.getElementById('receipt-from').value;
        const purpose = document.getElementById('receipt-purpose').value;
        const receiptCategory = document.getElementById('receipt-category').value;
        const receiptMethod = document.getElementById('receipt-method').value;
        const bankAccountId = document.getElementById('receipt-bank').value;
        const autoPostJournal = document.getElementById('receipt-auto-post-journal')?.checked !== false;

        const lineItems = this.getLineItems();

        if (lineItems.length === 0) {
            alert('Please add at least one line item');
            return null;
        }

        if (!type || !date || !receiveFrom || !purpose) {
            alert('Please fill in all required fields');
            return null;
        }

        const data = {
            type,
            date,
            receiveFrom,
            purpose,
            receiptCategory,
            receiptMethod,
            bankAccountId: (receiptMethod === 'transfer' || receiptMethod === 'check' || receiptMethod === 'giro') ? bankAccountId : null,
            lineItems: lineItems,
            autoPostJournal
        };

        return data;
    },

    showCreateModal() {
        this._editMode = false;
        this._editingId = null;

        const modal = document.getElementById('create-receipt-modal');
        
        // Reset Title and Button
        const titleEl = document.getElementById('receipt-modal-title');
        if (titleEl) titleEl.textContent = 'Create New Receipt Voucher';

        const btnSubmit = document.getElementById('btn-submit-receipt');
        if (btnSubmit) btnSubmit.textContent = 'Create Receipt';

        document.getElementById('receipt-type').value = '';
        document.getElementById('receipt-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('receipt-from').value = '';
        document.getElementById('receipt-purpose').value = '';
        document.getElementById('receipt-category').value = 'other';
        document.getElementById('receipt-method').value = 'cash';

        // Clear and initialize line items
        const lineItemsBody = document.getElementById('receipt-line-items-body');
        if (lineItemsBody) {
            lineItemsBody.innerHTML = '';
            this.addLineItem(); // Add one initial row
        }

        const totalElement = document.getElementById('receipt-line-items-total');
        if (totalElement) {
            totalElement.textContent = 'Rp 0';
        }

        const autoPostCheckbox = document.getElementById('receipt-auto-post-journal');
        if (autoPostCheckbox) {
            autoPostCheckbox.checked = true;
        }

        this.loadBankOptions();
        modal.classList.remove('hidden');
    },

    addLineItemWithValue(accountCode, description, amount) {
        const accounts = ChartOfAccounts.getDetailAccounts();
        const row = `
            <tr>
                <td>
                    <select class="form-select receipt-line-account" required style="width: 100%;">
                        <option value="">-- Select Account --</option>
                        ${accounts.map(acc =>
            `<option value="${acc.code}" ${acc.code === accountCode ? 'selected' : ''}>${acc.code} - ${acc.name}</option>`
        ).join('')}
                    </select>
                </td>
                <td>
                    <input type="text" class="form-input receipt-line-description" 
                           value="${description || ''}"
                           placeholder="Description" style="width: 100%;">
                </td>
                <td style="width: 200px; min-width: 200px;">
                    <input type="number" class="form-input receipt-line-amount" 
                           value="${amount || 0}"
                           placeholder="0" min="0" step="1000" required
                           onchange="ReceiptVoucher.calculateTotal()"
                           style="width: 100%; text-align: right;">
                </td>
                <td class="text-center" style="width: 60px; min-width: 60px;">
                    <button type="button" class="btn btn-sm btn-danger" 
                            onclick="this.closest('tr').remove(); ReceiptVoucher.calculateTotal();"
                            title="Remove line item">
                        🗑️
                    </button>
                </td>
            </tr>
        `;

        const tbody = document.getElementById('receipt-line-items-body');
        if (tbody) {
            tbody.insertAdjacentHTML('beforeend', row);
        }
    },

    showEditModal(voucherId) {
        const voucher = this.getVoucher(voucherId);
        if (!voucher) return;

        this._editMode = true;
        this._editingId = voucherId;

        const modal = document.getElementById('create-receipt-modal');
        
        // Update Title and Button
        const titleEl = document.getElementById('receipt-modal-title');
        if (titleEl) titleEl.textContent = '✏️ Edit Receipt Voucher';
        
        const btnSubmit = document.getElementById('btn-submit-receipt');
        if (btnSubmit) btnSubmit.textContent = '💾 Update Receipt Voucher';

        document.getElementById('receipt-type').value = voucher.type || '';
        document.getElementById('receipt-date').value = voucher.date || new Date().toISOString().split('T')[0];
        document.getElementById('receipt-from').value = voucher.receiveFrom || '';
        document.getElementById('receipt-purpose').value = voucher.purpose || '';
        document.getElementById('receipt-category').value = voucher.receiptCategory || 'other';
        document.getElementById('receipt-method').value = voucher.receiptMethod || 'cash';

        const bankSelect = document.getElementById('receipt-bank');
        this.loadBankOptions();
        if (bankSelect && voucher.bankAccountId) {
            bankSelect.value = voucher.bankAccountId;
        }

        // Populate line items
        const lineItemsBody = document.getElementById('receipt-line-items-body');
        if (lineItemsBody) {
            lineItemsBody.innerHTML = '';
            if (voucher.lineItems && voucher.lineItems.length > 0) {
                voucher.lineItems.forEach(item => {
                    this.addLineItemWithValue(item.accountCode, item.description, item.amount);
                });
            } else {
                const amt = voucher.amount || voucher.totalAmount || 0;
                this.addLineItemWithValue('41101', voucher.purpose, amt);
            }
        }

        this.calculateTotal();

        const autoPostCheckbox = document.getElementById('receipt-auto-post-journal');
        if (autoPostCheckbox) {
            autoPostCheckbox.checked = voucher.autoPostJournal !== false;
        }

        modal.classList.remove('hidden');
    },

    async updateVoucher(id, data) {
        const index = this.vouchers.findIndex(v => v.id === id);
        if (index === -1) return { success: false, errors: { voucher: 'Voucher not found' } };

        const oldVoucher = this.vouchers[index];

        if (oldVoucher.status !== 'draft') {
            return { success: false, errors: { status: 'Only draft vouchers can be updated' } };
        }

        let lineItems = [];
        let totalAmount = 0;

        if (data.lineItems && Array.isArray(data.lineItems) && data.lineItems.length > 0) {
            for (const item of data.lineItems) {
                if (!item.accountCode || !item.amount) {
                    return {
                        success: false,
                        errors: { validation: 'Each line item must have account code and amount' }
                    };
                }
            }
            lineItems = data.lineItems;
            totalAmount = lineItems.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
        } else {
            lineItems = [{
                accountCode: data.revenueAccount || '41101',
                accountName: data.revenueName || 'Revenue',
                description: data.purpose,
                amount: parseFloat(data.amount || 0)
            }];
            totalAmount = parseFloat(data.amount || 0);
        }

        this.vouchers[index] = {
            ...oldVoucher,
            type: data.type,
            date: data.date,
            receiveFrom: data.receiveFrom,
            purpose: data.purpose,
            receiptCategory: data.receiptCategory,
            receiptMethod: data.receiptMethod,
            bankAccountId: data.bankAccountId,
            autoPostJournal: data.autoPostJournal,
            lineItems: lineItems,
            totalAmount: totalAmount,
            amount: totalAmount,
            updatedAt: new Date().toISOString()
        };

        await this.saveVouchers(this.vouchers[index]);

        AuditLog.log('update', 'receipt_voucher', id,
            `Updated receipt voucher ${this.vouchers[index].voucherNumber}`);

        return { success: true, voucher: this.vouchers[index] };
    },

    closeCreateModal() {
        document.getElementById('create-receipt-modal').classList.add('hidden');
    },

    showViewModal(voucherId) {
        const voucher = this.getVoucher(voucherId);
        if (!voucher) return;

        const content = document.getElementById('view-receipt-content');
        content.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
                <div>
                    <label class="form-label">Voucher Number</label>
                    <p><strong>${voucher.voucherNumber}</strong></p>
                </div>
                <div>
                    <label class="form-label">Type</label>
                    <p><span class="badge badge-info">${voucher.type}</span></p>
                </div>
                <div>
                    <label class="form-label">Date</label>
                    <p>${this.formatDate(voucher.date)}</p>
                </div>
                <div>
                    <label class="form-label">Status</label>
                    <p><span class="badge ${this.getStatusBadgeClass(voucher.status)}">${this.getStatusLabel(voucher.status)}</span></p>
                </div>
            </div>

            <div class="form-group">
                <label class="form-label">Receive From</label>
                <p>${voucher.receiveFrom}</p>
            </div>

            <div class="form-group">
                <label class="form-label">Purpose</label>
                <p>${voucher.purpose}</p>
            </div>

            ${voucher.lineItems && voucher.lineItems.length > 0 ? `
                <div class="form-group" style="border: 1px solid var(--color-gray-800); border-radius: 8px; padding: 16px; background: var(--bg-tertiary);">
                    <label class="form-label" style="margin-bottom: 12px;">Income Line Items</label>
                    <div class="table-container">
                        <table class="table table-sm">
                            <thead>
                                <tr>
                                    <th>Account</th>
                                    <th>Description</th>
                                    <th class="text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${voucher.lineItems.map(item => `
                                    <tr>
                                        <td><strong>${item.accountCode}</strong> - ${item.accountName}</td>
                                        <td>${item.description || '-'}</td>
                                        <td class="text-right">${this.formatCurrency(item.amount)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                            <tfoot style="font-weight: 600; background: var(--bg-secondary);">
                                <tr>
                                    <td colspan="2" class="text-right">Total:</td>
                                    <td class="text-right">${this.formatCurrency(voucher.totalAmount || voucher.amount)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            ` : ''
            }

<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1.5rem;">
    <div>
        <label class="form-label">Receipt Method</label>
        <p>${voucher.receiptMethod}</p>
    </div>
    <div>
        <label class="form-label">Created By</label>
        <p>${voucher.createdByName} on ${this.formatDate(voucher.createdAt)}</p>
    </div>
</div>

            ${voucher.journalEntryId ? `
                <div class="alert alert-success" style="margin-top: 1rem;">
                    ✅ Posted to Journal Entry #${voucher.journalEntryId}
                </div>
            ` : ''
            }
`;

        document.getElementById('view-receipt-modal').classList.remove('hidden');
    },

    closeViewModal() {
        document.getElementById('view-receipt-modal').classList.add('hidden');
    },

    loadBankOptions() {
        const banks = Storage.getBankAccounts() || [];
        const bankSelect = document.getElementById('receipt-bank');

        if (bankSelect) {
            bankSelect.innerHTML = '<option value="">Select Bank Account</option>';
            banks.forEach(bank => {
                const option = document.createElement('option');
                option.value = bank.id;
                option.textContent = `${bank.bankName} - ${bank.accountNumber} `;
                bankSelect.appendChild(option);
            });
        }
    },

    async submitReceiptForm() {
        const data = this.getFormData();
        if (!data) return;

        let result;
        if (this._editMode && this._editingId) {
            result = await this.updateVoucher(this._editingId, data);
        } else {
            result = await this.createVoucher(data);
        }

        if (result.success) {
            this.closeCreateModal();
            this.render();
            alert(`Receipt voucher ${result.voucher.voucherNumber} ${this._editMode ? 'updated' : 'created'} successfully!`);
        } else {
            alert(`Error: ${JSON.stringify(result.errors)}`);
        }
    },

    attachEventListeners() {
        // Filter tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');

                const status = e.target.dataset.status;
                const rows = document.querySelectorAll('#vouchers-table tbody tr[data-status]');

                rows.forEach(row => {
                    if (status === 'all' || row.dataset.status === status) {
                        row.style.display = '';
                    } else {
                        row.style.display = 'none';
                    }
                });
            });
        });

        // Receipt method change
        const methodSelect = document.getElementById('receipt-method');
        if (methodSelect) {
            methodSelect.addEventListener('change', (e) => {
                const bankSection = document.getElementById('receipt-bank-section');
                if (e.target.value === 'transfer' || e.target.value === 'check' || e.target.value === 'giro') {
                    bankSection.style.display = 'block';
                } else {
                    bankSection.style.display = 'none';
                }
            });
        }
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReceiptVoucher;
}


// Explicitly make ReceiptVoucher globally available
window.ReceiptVoucher = ReceiptVoucher;
