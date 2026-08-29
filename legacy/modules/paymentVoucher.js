// ==========================================
// Payment Voucher Module (BKK/BBK)
// Bukti Kas Keluar / Bukti Bank Keluar
// Multi-level approval workflow for cash control
// ==========================================

const PaymentVoucher = {
    vouchers: [],
    currentVoucher: null,
    _editMode: false,
    _editingId: null,
    filters: {
        startDate: '',
        endDate: '',
        status: 'all',
        voucherType: 'all'
    },

    // Voucher types
    voucherTypes: {
        BKK: 'Bukti Kas Keluar',
        BBK: 'Bukti Bank Keluar'
    },

    // Voucher statuses
    statuses: {
        draft: 'Draft',
        verified: 'Verified',
        finance_approved: 'Finance Approved',
        director_approved: 'Director Approved',
        payment_issued: 'Payment Issued',
        posted: 'Posted to Journal',
        rejected: 'Rejected',
        VOIDED: 'Voided',
        voided: 'Voided'
    },

    // Payment methods
    paymentMethods: {
        cash: 'Cash',
        check: 'Check',
        giro: 'Giro',
        transfer: 'Bank Transfer'
    },

    // Approval limits (in Rupiah)
    approvalLimits: {
        KASIR: { canCreate: true, canVerify: true, canApprove: false, maxAmount: 0 },
        FINANCE: { canCreate: true, canVerify: true, canApprove: true, maxAmount: 50000000 },
        MANAGER_FINANCE: { canCreate: false, canVerify: true, canApprove: true, maxAmount: 100000000 },
        DIRECTOR: { canCreate: false, canVerify: true, canApprove: true, maxAmount: Infinity },
        ADMIN: { canCreate: true, canVerify: true, canApprove: true, maxAmount: Infinity }
    },

    // Amount-based approval thresholds (Indonesian best practice)
    approvalThresholds: {
        petty_cash: 500000,      // < 500K: Auto-post after kasir verify (DEFAULT)
        small_expense: 5000000,   // < 5M: Skip director, finance only (DEFAULT)
        medium_expense: 50000000, // < 50M: Full approval (finance + director) (DEFAULT)
        large_expense: Infinity   // >= 50M: May need board approval (DEFAULT)
    },

    // Get required approval levels based on amount
    getRequiredApprovals(amount) {
        // Get thresholds from config (dynamic) or use defaults
        const config = Storage.get(Storage.KEYS.CONFIG) || {};
        const pettyCashLimit = config.payment_petty_cash || this.approvalThresholds.petty_cash;
        const smallExpenseLimit = config.payment_small_expense || this.approvalThresholds.small_expense;
        const mediumExpenseLimit = config.payment_medium_expense || this.approvalThresholds.medium_expense;

        if (amount < pettyCashLimit) {
            return ['KASIR']; // Petty cash: kasir verify → auto-post
        } else if (amount < smallExpenseLimit) {
            return ['KASIR', 'FINANCE']; // Small: skip director
        } else if (amount < mediumExpenseLimit) {
            return ['KASIR', 'FINANCE', 'DIRECTOR']; // Medium: full approval
        } else {
            return ['KASIR', 'FINANCE', 'DIRECTOR']; // Large: full + may need board
        }
    },

    async init() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');

        // Show all vouchers from 2 years ago to today (covers all historical data)
        this.filters.startDate = `${year - 2}-01-01`;
        this.filters.endDate = `${year}-${month}-${day}`;

        console.log('🔍 [DIAGNOSTIC] PaymentVoucher.init() started');
        await this.loadVouchers();
        console.log(`🔍 [DIAGNOSTIC] PaymentVoucher.init() calling render with ${this.vouchers.length} vouchers`);
        this.render();
    },

    async loadVouchers() {
        try {
            // Now using central sync from app.js 'Cloud Master' strategy.
            // We just load the mirrored data from localStorage.
            const vouchers = Storage.get(Storage.KEYS.PAYMENT_VOUCHERS);
            // Guard: ensure we always have an array (localStorage corruption check)
            if (Array.isArray(vouchers)) {
                this.vouchers = vouchers;
            } else {
                console.warn(`⚠️ [PaymentVoucher] localStorage data is not an array (got: ${typeof vouchers}). Resetting.`);
                this.vouchers = [];
            }
            console.log(`📦 [DIAGNOSTIC] Loaded ${this.vouchers.length} vouchers from Local Mirror (Key: ${Storage.KEYS.PAYMENT_VOUCHERS})`);
            if (this.vouchers.length > 0) {
                console.log('🔍 [DIAGNOSTIC] First voucher sample:', JSON.stringify(this.vouchers[0]).substring(0, 100));
            }

        } catch (error) {
            console.error('Error loading vouchers:', error);
            this.vouchers = [];
        }
    },

    async syncLocalToFirestore(localVouchers, firestoreVouchers) {
        try {
            const firestoreIds = new Set(firestoreVouchers.map(v => v.id));
            const localOnlyVouchers = localVouchers.filter(v => !firestoreIds.has(v.id));

            if (localOnlyVouchers.length > 0) {
                console.log(`🔄 Syncing ${localOnlyVouchers.length} local-only vouchers to Firestore...`);

                const { collection, doc, setDoc } = window.firestore;
                for (const voucher of localOnlyVouchers) {
                    const voucherData = { ...voucher };
                    delete voucherData.firestoreId;

                    await setDoc(doc(window.db, 'paymentVouchers', voucher.id.toString()), voucherData);
                }
                console.log(`✅ Synced ${localOnlyVouchers.length} vouchers to Firestore`);
            }
        } catch (error) {
            console.error('Error syncing local vouchers to Firestore:', error);
        }
    },

    async saveVouchers(specificVoucher = null) {
        // 🛡️ Sanitize: ensure no `undefined` fields that Firestore will reject
        this.vouchers.forEach(v => this.sanitizeVoucher(v));

        // 🔒 Use setWithCloudBlock for BKK/BBK — payment vouchers MUST reach cloud.
        // Returns { success, localSaved, cloudSaved, error }
        const result = await Storage.setWithCloudBlock(Storage.KEYS.PAYMENT_VOUCHERS, this.vouchers, specificVoucher);
        if (!result.cloudSaved) {
            console.warn('⚠️ [PaymentVoucher] Cloud save failed. SyncGuard banner shown, auto-retry queued.');
        }
        return result;
    },

    // 🛡️ Ensure all nullable fields are null (not undefined) before Firestore write
    sanitizeVoucher(v) {
        if (!v || typeof v !== 'object') return v;
        const nullables = [
            'journalEntryId', 'reversalJournalEntryId', 'postedAt', 'postedBy', 'postedByName',
            'checkNumber', 'giroDate', 'bankAccountId', 'rejectionReason',
            'financeApprovedBy', 'financeApprovedByName', 'financeApprovedAt',
            'directorApprovedBy', 'directorApprovedByName', 'directorApprovedAt',
            'verifiedBy', 'verifiedByName', 'verifiedAt',
            'paymentIssuedAt', 'paymentIssuedBy', 'paymentIssuedByName',
            'voidedAt', 'voidedBy', 'voidedByName', 'voidReason',
            'paymentDetails', 'documents'
        ];
        nullables.forEach(f => {
            if (v[f] === undefined) v[f] = null;
        });
        // Ensure arrays are never undefined
        if (!Array.isArray(v.lineItems)) v.lineItems = [];
        if (!Array.isArray(v.approvalHistory)) v.approvalHistory = [];
        // Ensure booleans
        if (v.autoPostJournal === undefined || v.autoPostJournal === null) v.autoPostJournal = true;
        return v;
    },



    // ... (rest of methods)

    async deleteVoucher(id) {
        const voucher = this.getVoucher(id);
        if (!voucher) return { success: false, errors: { voucher: 'Voucher not found' } };

        const permission = this.canUserDelete(voucher);
        if (!permission.allowed) return { success: false, errors: { permission: permission.reason } };

        // Delete journal entry if exists
        if (voucher.journalEntryId && typeof JournalEntry !== 'undefined') {
            try {
                await JournalEntry.deleteEntry(voucher.journalEntryId);
            } catch (e) {
                console.warn("Failed to delete associated journal", e);
            }
        }

        const originalVouchers = [...this.vouchers];
        this.vouchers = this.vouchers.filter(v => v.id !== id);

        try {
            await this.saveVouchers();
            if (typeof FirebaseSync !== 'undefined' && FirebaseSync.isEnabled()) {
                await FirebaseSync.deleteFromCloud(Storage.KEYS.PAYMENT_VOUCHERS, id).catch(e => {
                    console.warn("⚠️ Cloud delete failed (e.g. quota), but deleted locally:", e.message);
                });
            }
            AuditLog.log('delete', 'payment_voucher', id, `Deleted voucher: ${voucher.voucherNumber}`);
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

        // Fallback for offline/error
        const prefix = type; // 'BKK' or 'BBK'
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

    detectHabitAnomaly(voucher, otherVouchers) {
        if (!voucher) return null;
        
        const rules = [
            { keywords: ['kopi', 'coffee'], days: 3, label: 'Kopi / Kebutuhan Kafein' },
            { keywords: ['bensin', 'solar', 'fuel', 'bbm'], days: 2, label: 'Bahan Bakar Minyak (BBM)' },
            { keywords: ['galon', 'air minum', 'aqua'], days: 3, label: 'Air Minum Galon' },
            { keywords: ['kertas', 'paper', 'hvs'], days: 7, label: 'Kertas / ATK Kantor' },
            { keywords: ['tissue', 'tisu'], days: 5, label: 'Tissue Toilet / Kantor' }
        ];

        let combinedText = ((voucher.purpose || '') + ' ' + (voucher.description || '')).toLowerCase();
        if (voucher.lineItems && Array.isArray(voucher.lineItems)) {
            voucher.lineItems.forEach(item => {
                combinedText += ' ' + (item.description || '').toLowerCase();
                combinedText += ' ' + (item.accountName || '').toLowerCase();
            });
        }

        const voucherDate = new Date(voucher.date || new Date().toISOString().split('T')[0]);

        for (const rule of rules) {
            const matchedKeyword = rule.keywords.find(kw => combinedText.includes(kw));
            if (matchedKeyword) {
                const matches = otherVouchers.filter(v => {
                    if (v.id === voucher.id) return false;
                    if (v.status === 'void' || v.status === 'cancelled') return false;
                    
                    let histText = ((v.purpose || '') + ' ' + (v.description || '')).toLowerCase();
                    if (v.lineItems && Array.isArray(v.lineItems)) {
                        v.lineItems.forEach(item => {
                            histText += ' ' + (item.description || '').toLowerCase();
                            histText += ' ' + (item.accountName || '').toLowerCase();
                        });
                    }
                    return rule.keywords.some(kw => histText.includes(kw));
                });

                if (matches.length > 0) {
                    matches.sort((a, b) => new Date(b.date) - new Date(a.date));
                    const latestMatch = matches[0];
                    const latestDate = new Date(latestMatch.date);
                    
                    const diffTime = voucherDate - latestDate;
                    const diffDays = diffTime / (1000 * 60 * 60 * 24);

                    if (diffDays >= 0 && diffDays < rule.days) {
                        return {
                            detected: true,
                            message: `Pembelian '${rule.label}' terlalu cepat. Transaksi terakhir pada ${latestMatch.date} (selisih ${diffDays.toFixed(0)} hari, batas wajar min ${rule.days} hari sekali).`,
                            previousVoucherNumber: latestMatch.voucherNumber || 'N/A',
                            previousDate: latestMatch.date
                        };
                    }
                }
            }
        }
        return null;
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
            if (!data.type || !data.payTo || !data.amount || !data.purpose) {
                return {
                    success: false,
                    errors: { validation: 'Type, Pay To, Amount, and Purpose are required' }
                };
            }
            // Convert single line to lineItems format
            lineItems = [{
                accountCode: data.expenseAccount || '2110',
                accountName: data.expenseName || 'Expense',
                description: data.purpose,
                amount: parseFloat(data.amount)
            }];
            totalAmount = parseFloat(data.amount);
        }

        // Validate documents for supplier payment
        if (data.paymentCategory === 'supplier') {
            const requiredDocs = ['poNumber', 'sjNumber', 'invoiceNumber'];
            const missingDocs = requiredDocs.filter(doc => !data.documents || !data.documents[doc]);

            if (missingDocs.length > 0) {
                return {
                    success: false,
                    errors: { documents: `Missing documents: ${missingDocs.join(', ')}` }
                };
            }
        }

        const voucher = {
            id: Date.now(),
            voucherNumber: await this.generateVoucherNumber(data.type),
            type: data.type,
            date: data.date || new Date().toISOString().split('T')[0],
            payTo: data.payTo,
            purpose: data.purpose,
            paymentCategory: data.paymentCategory || 'other',

            // NEW: Multi-line items support
            lineItems: lineItems,
            totalAmount: totalAmount,

            // OLD: Keep for backward compatibility
            amount: totalAmount,
            expenseAccount: data.expenseAccount || (lineItems[0]?.accountCode),

            // Supporting documents
            documents: data.documents || {},

            // Payment details
            paymentMethod: data.paymentMethod || 'cash',
            bankAccountId: data.bankAccountId || null,
            checkNumber: data.checkNumber || null,
            giroDate: data.giroDate || null,

            // Workflow
            status: data.status || 'draft',
            createdBy: Auth.getCurrentUser().id,
            createdByName: Auth.getCurrentUser().name,
            createdAt: new Date().toISOString(),

            // Approvals
            approvalHistory: [],

            // Accounting
            journalEntryId: null,
            postedAt: null,
            autoPostJournal: data.autoPostJournal !== false, // Default: true

            // Account codes
            cashBankAccount: data.type === 'BKK' ? '11101' : data.bankAccountId
        };

        // AUTO-APPROVE for petty cash (< threshold)
        const pettyCashLimit = (Storage.get(Storage.KEYS.CONFIG) || {}).payment_petty_cash || this.approvalThresholds.petty_cash;
        if (totalAmount < pettyCashLimit) {
            console.log(`💰 Petty cash detected (${this.formatCurrency(totalAmount)} < ${this.formatCurrency(pettyCashLimit)})`);
            console.log(`   Auto-approving voucher...`);

            // Set as verified and approved
            voucher.status = 'director_approved';
            voucher.verifiedBy = Auth.getCurrentUser().id;
            voucher.verifiedByName = Auth.getCurrentUser().name;
            voucher.verifiedAt = new Date().toISOString();
            voucher.financeApprovedBy = 'AUTO-SKIP';
            voucher.financeApprovedByName = `Auto-skipped (petty cash < ${this.formatCurrency(pettyCashLimit)})`;
            voucher.financeApprovedAt = new Date().toISOString();
            voucher.directorApprovedBy = 'AUTO-SKIP';
            voucher.directorApprovedByName = `Auto-skipped (petty cash < ${this.formatCurrency(pettyCashLimit)})`;
            voucher.directorApprovedAt = new Date().toISOString();

            voucher.approvalHistory.push({
                action: 'auto_approved',
                role: 'system',
                userId: 'SYSTEM',
                userName: 'Auto-Approval',
                timestamp: new Date().toISOString(),
                notes: `Petty cash auto-approved (amount < ${this.formatCurrency(pettyCashLimit)})`
            });

            console.log(`   ✅ Status: ${voucher.status}`);
        }

        // Detect habit anomalies
        const habitAnomaly = this.detectHabitAnomaly(voucher, this.vouchers);
        if (habitAnomaly) {
            voucher.habitAnomaly = habitAnomaly;
        }

        this.vouchers.push(voucher);
        const saveResult = await this.saveVouchers();

        // Log audit
        AuditLog.log('create', 'payment_voucher', voucher.id,
            `Created ${voucher.type} ${voucher.voucherNumber}`);

        // AUTO-POST: If voucher was auto-approved, trigger auto-post
        if (voucher.status === 'director_approved' && voucher.autoPostJournal) {
            console.log(`🚀 Auto-posting petty cash voucher ${voucher.voucherNumber}...`);

            // Change status to payment_issued
            voucher.status = 'payment_issued';
            voucher.paymentIssuedAt = new Date().toISOString();
            voucher.paymentIssuedBy = Auth.getCurrentUser().id;
            voucher.paymentIssuedByName = Auth.getCurrentUser().name;

            // Post to journal
            try {
                const journalResult = await this.postToJournal(voucher.id);
                if (journalResult.success) {
                    voucher.status = 'posted';
                    voucher.journalEntryId = journalResult.entry ? journalResult.entry.id : null;
                    voucher.postedAt = new Date().toISOString();
                    console.log(`   ✅ Auto-posted to journal: ${journalResult.entry ? journalResult.entry.id : null}`);
                } else {
                    console.error(`   ❌ Failed to auto-post: ${JSON.stringify(journalResult.errors)}`);
                }
            } catch (error) {
                console.error(`   ❌ Error during auto-post: ${error.message}`);
            }

            await this.saveVouchers();
            AuditLog.log('update', 'payment_voucher', voucher.id, 'Auto-posted (petty cash)');
        }

        // Surface cloud sync warning to caller if cloud failed
        if (saveResult && !saveResult.cloudSaved) {
            return {
                success: true, voucher, cloudSyncFailed: true,
                warning: 'BKK tersimpan di komputer ini. Sistem akan mencoba kirim ke cloud otomatis. Jangan tutup browser.'
            };
        }

        return { success: true, voucher };

    },

    async verifyDocuments(voucherId) {
        const voucher = this.getVoucher(voucherId);
        if (!voucher) {
            return { success: false, errors: { voucher: 'Voucher not found' } };
        }

        if (voucher.status !== 'draft') {
            return { success: false, errors: { status: 'Can only verify draft vouchers' } };
        }

        // Check user permission
        const userRole = String(Auth.getCurrentUser().role).toUpperCase();
        if (!this.approvalLimits[userRole]?.canVerify) {
            return { success: false, errors: { permission: 'You do not have permission to verify' } };
        }

        // Verify document completeness
        if (voucher.paymentCategory === 'supplier') {
            const requiredDocs = ['poNumber', 'sjNumber', 'invoiceNumber'];
            const missingDocs = requiredDocs.filter(doc => !voucher.documents[doc]);

            if (missingDocs.length > 0) {
                return {
                    success: false,
                    errors: { documents: `Missing: ${missingDocs.join(', ')}` }
                };
            }
        }

        voucher.status = 'verified';
        voucher.verifiedBy = Auth.getCurrentUser().id;
        voucher.verifiedByName = Auth.getCurrentUser().name;
        voucher.verifiedAt = new Date().toISOString();

        voucher.approvalHistory.push({
            role: userRole,
            action: 'verified',
            userId: Auth.getCurrentUser().id,
            userName: Auth.getCurrentUser().name,
            timestamp: new Date().toISOString(),
            notes: 'Documents verified and complete'
        });

        // Ensure critical fields are never undefined for Firebase sync
        voucher.rejectionReason = voucher.rejectionReason || '';
        voucher.journalEntryId = voucher.journalEntryId || null;
        voucher.approvalHistory = voucher.approvalHistory || [];

        await this.saveVouchers();
        AuditLog.log('update', 'payment_voucher', voucherId, 'Verified documents');

        return { success: true, voucher };
    },

    async approveVoucher(voucherId, approved, notes) {
        const voucher = this.getVoucher(voucherId);
        if (!voucher) {
            return { success: false, errors: { voucher: 'Voucher not found' } };
        }

        const userRole = String(Auth.getCurrentUser().role).toUpperCase();

        // Check permission
        if (!this.approvalLimits[userRole]?.canApprove) {
            return { success: false, errors: { permission: 'You do not have permission to approve' } };
        }

        // Check approval limit
        if (voucher.amount > this.approvalLimits[userRole].maxAmount) {
            return {
                success: false,
                errors: { limit: `Amount exceeds your approval limit of ${this.formatCurrency(this.approvalLimits[userRole].maxAmount)}` }
            };
        }

        // Check status
        if ((userRole === 'MANAGER_FINANCE' || userRole === 'FINANCE') && voucher.status !== 'verified') {
            return { success: false, errors: { status: 'Voucher must be verified first' } };
        }
        if (userRole === 'DIRECTOR') {
            const isAmountExceedingFinance = voucher.amount > this.approvalLimits.MANAGER_FINANCE.maxAmount;
            if (voucher.status === 'verified' && !isAmountExceedingFinance) {
                return { success: false, errors: { status: 'Voucher must be finance approved first' } };
            }
            if (voucher.status !== 'finance_approved' && voucher.status !== 'verified') {
                return { success: false, errors: { status: 'Voucher status is not valid for director approval' } };
            }
        }

        // Record approval
        voucher.approvalHistory.push({
            role: userRole,
            action: approved ? 'approved' : 'rejected',
            userId: Auth.getCurrentUser().id,
            userName: Auth.getCurrentUser().name,
            timestamp: new Date().toISOString(),
            notes: notes || ''
        });

        // Ensure critical fields are never undefined for Firebase sync
        voucher.rejectionReason = voucher.rejectionReason || '';
        voucher.journalEntryId = voucher.journalEntryId || null;
        voucher.reversalJournalEntryId = voucher.reversalJournalEntryId || null;

        if (!approved) {
            voucher.status = 'rejected';
            voucher.rejectionReason = notes || '';
            await this.saveVouchers(voucher);
            AuditLog.log('update', 'payment_voucher', voucherId, 'Rejected');
            return { success: true, voucher };
        }


        // Update status based on role
        const voucherAmount = voucher.totalAmount || voucher.amount;
        const requiredApprovals = this.getRequiredApprovals(voucherAmount);

        if (userRole === 'MANAGER_FINANCE' || userRole === 'FINANCE' || (userRole === 'ADMIN' && voucher.status === 'verified')) {
            voucher.status = 'finance_approved';
            voucher.financeApprovedBy = Auth.getCurrentUser().id;
            voucher.financeApprovedByName = Auth.getCurrentUser().name;
            voucher.financeApprovedAt = new Date().toISOString();

            // AUTO-SKIP: If director not required, skip to director_approved
            if (!requiredApprovals.includes('director')) {
                voucher.status = 'director_approved';
                voucher.directorApprovedBy = 'AUTO-SKIP';
                voucher.directorApprovedByName = 'Auto-skipped (amount < 5M)';
                voucher.directorApprovedAt = new Date().toISOString();
                AuditLog.log('update', 'payment_voucher', voucherId, 'Director approval auto-skipped (small amount)');
            }
        } else if (userRole === 'DIRECTOR' || (userRole === 'ADMIN' && voucher.status === 'finance_approved')) {
            voucher.status = 'director_approved';
            voucher.directorApprovedBy = Auth.getCurrentUser().id;
            voucher.directorApprovedByName = Auth.getCurrentUser().name;
            voucher.directorApprovedAt = new Date().toISOString();
            
            // If Director approves directly from verified state, mark finance as bypassed
            if (!voucher.financeApprovedBy) {
                voucher.financeApprovedBy = Auth.getCurrentUser().id;
                voucher.financeApprovedByName = 'Bypassed by ' + Auth.getCurrentUser().name;
                voucher.financeApprovedAt = new Date().toISOString();
            }
        } else if (userRole === 'KASIR') {
            // Kasir verification
            voucher.status = 'verified';
            voucher.verifiedBy = Auth.getCurrentUser().id;
            voucher.verifiedByName = Auth.getCurrentUser().name;
            voucher.verifiedAt = new Date().toISOString();

            console.log(`✅ Kasir verified voucher ${voucherId}, amount: ${this.formatCurrency(voucherAmount)}`);
            console.log(`🔍 Petty Cash Check for voucher ${voucherId}:`);
            console.log(`   Amount: ${this.formatCurrency(voucherAmount)}`);
            console.log(`   Required Approvals: ${JSON.stringify(requiredApprovals)}`);
            console.log(`   Current Status: ${voucher.status}`);
            console.log(`   autoPostJournal: ${voucher.autoPostJournal}`);

            // AUTO-SKIP: If only kasir required (petty cash < threshold)
            if (requiredApprovals.length === 1 && requiredApprovals[0] === 'kasir') {
                const config = Storage.get(Storage.KEYS.CONFIG) || {};
                const pettyCashLimit = config.payment_petty_cash || this.approvalThresholds.petty_cash;
                const limitText = this.formatCurrency(pettyCashLimit);

                console.log(`🚀 PETTY CASH AUTO-SKIP triggered for voucher ${voucherId}`);
                console.log(`   Amount: ${this.formatCurrency(voucherAmount)} < Limit: ${limitText}`);
                console.log(`   autoPostJournal flag (before): ${voucher.autoPostJournal}`);

                // Skip all approvals, go straight to director_approved
                voucher.status = 'director_approved';
                voucher.financeApprovedBy = 'AUTO-SKIP';
                voucher.financeApprovedByName = `Auto-skipped (petty cash < ${limitText})`;
                voucher.financeApprovedAt = new Date().toISOString();
                voucher.directorApprovedBy = 'AUTO-SKIP';
                voucher.directorApprovedByName = `Auto-skipped (petty cash < ${limitText})`;
                voucher.directorApprovedAt = new Date().toISOString();
                AuditLog.log('update', 'payment_voucher', voucherId, `Auto-approved (petty cash < ${limitText})`);

                console.log(`   ✅ Status set to: ${voucher.status}`);
            }
        }

        await this.saveVouchers(voucher);
        AuditLog.log('update', 'payment_voucher', voucherId, `Approved by ${userRole}`);

        // DEFENSIVE: Ensure autoPostJournal defaults to true if not set (for existing vouchers)
        if (voucher.autoPostJournal === undefined || voucher.autoPostJournal === null) {
            console.log(`⚠️  autoPostJournal was undefined/null, defaulting to true`);
            voucher.autoPostJournal = true;
            await this.saveVouchers(voucher);
        }

        // NEW: Auto-post to journal if configured
        console.log(`🔍 Checking auto-post conditions for voucher ${voucherId}:`);
        console.log(`   autoPostJournal: ${voucher.autoPostJournal}`);
        console.log(`   status: ${voucher.status}`);

        if (voucher.autoPostJournal && voucher.status === 'director_approved') {
            console.log(`🚀 AUTO-POST triggered for voucher ${voucherId}`);

            // Also set as payment issued (skip manual payment step for auto-post)
            voucher.status = 'payment_issued';
            voucher.paymentIssuedAt = new Date().toISOString();
            voucher.paymentIssuedBy = Auth.getCurrentUser().id;
            voucher.paymentIssuedByName = Auth.getCurrentUser().name;
            await this.saveVouchers(voucher);

            console.log(`   ✅ Status changed to: payment_issued`);
            console.log(`   📝 Attempting to post to journal...`);

            // Auto-post to journal
            try {
                const postResult = await this.postToJournal(voucherId);
                if (postResult.success) {
                    console.log(`   ✅ Successfully posted to journal! Entry ID: ${postResult.entry?.id}`);
                    AuditLog.log('update', 'payment_voucher', voucherId, 'Auto-posted to journal after approval');
                } else {
                    console.error(`   ❌ Failed to post to journal:`, postResult.errors);
                    AuditLog.log('error', 'payment_voucher', voucherId, `Auto-post failed: ${JSON.stringify(postResult.errors)}`);
                }
            } catch (error) {
                console.error(`   ❌ Exception during auto-post:`, error);
                AuditLog.log('error', 'payment_voucher', voucherId, `Auto-post exception: ${error.message}`);
            }
        } else {
            console.log(`   ⏭️  Auto-post skipped (conditions not met)`);
        }

        return { success: true, voucher };
    },

    async issuePayment(voucherId, paymentDetails) {
        const voucher = this.getVoucher(voucherId);
        if (!voucher) {
            return { success: false, errors: { voucher: 'Voucher not found' } };
        }

        // Check if voucher needs director approval
        const needsDirectorApproval = voucher.amount > this.approvalLimits.MANAGER_FINANCE.maxAmount;
        const requiredStatus = needsDirectorApproval ? 'director_approved' : 'finance_approved';

        if (voucher.status !== requiredStatus) {
            return {
                success: false,
                errors: { approval: `Voucher must be ${requiredStatus} before issuing payment` }
            };
        }

        voucher.paymentIssuedAt = new Date().toISOString();
        voucher.paymentIssuedBy = Auth.getCurrentUser().id;
        voucher.paymentIssuedByName = Auth.getCurrentUser().name;
        voucher.paymentDetails = paymentDetails;
        voucher.status = 'payment_issued';

        // If payment method is check or giro, track it
        if (voucher.paymentMethod === 'check' || voucher.paymentMethod === 'giro') {
            CheckGiroTracking.createCheckGiro({
                voucherId: voucherId,
                voucherNumber: voucher.voucherNumber,
                type: voucher.paymentMethod,
                number: voucher.checkNumber,
                date: voucher.paymentMethod === 'giro' ? voucher.giroDate : voucher.date,
                amount: voucher.amount,
                payee: voucher.payTo,
                bankAccountId: voucher.bankAccountId
            });
        }

        await this.saveVouchers();
        AuditLog.log('update', 'payment_voucher', voucherId, 'Payment issued');

        return { success: true, voucher };
    },

    async postToJournal(voucherId) {
        const voucher = this.getVoucher(voucherId);
        if (!voucher) {
            return { success: false, errors: { voucher: 'Voucher not found' } };
        }

        if (voucher.status !== 'payment_issued') {
            return { success: false, errors: { status: 'Payment must be issued first' } };
        }

        // Generate journal entry
        const journalEntry = {
            date: voucher.date,
            description: `${voucher.type} - ${voucher.voucherNumber} - ${voucher.purpose}`,
            reference: voucher.voucherNumber,
            lines: []
        };

        // NEW: Multi-line support - Add debit lines for each expense item
        if (voucher.lineItems && Array.isArray(voucher.lineItems) && voucher.lineItems.length > 0) {
            voucher.lineItems.forEach(item => {
                journalEntry.lines.push({
                    accountCode: item.accountCode,
                    accountName: item.accountName || ChartOfAccounts.getAccount(item.accountCode)?.name || '',
                    debit: parseFloat(item.amount),
                    credit: 0,
                    description: item.description || voucher.purpose
                });
            });
        } else {
            // OLD: Backward compatible - single line
            journalEntry.lines.push({
                accountCode: voucher.expenseAccount,
                accountName: typeof ChartOfAccounts !== 'undefined' ? (ChartOfAccounts.getAccount(voucher.expenseAccount)?.name || '') : '',
                debit: voucher.amount,
                credit: 0,
                description: voucher.purpose
            });
        }

        // Credit: Cash or Bank (same for both multi-line and single-line)
        let cashBankAccountCode = voucher.type === 'BKK' ? '11101' : voucher.cashBankAccount;
        const totalAmount = voucher.totalAmount || voucher.amount;
        let cashBankAccountName = '';

        if (voucher.type === 'BBK' && typeof Storage !== 'undefined') {
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
            debit: 0,
            credit: totalAmount,
            description: `Payment via ${voucher.paymentMethod}`
        });

        // Post to journal
        try {
            const entry = await JournalEntry.createEntry(journalEntry);

            // createEntry returns the raw entry object on success
            voucher.status = 'posted';
            voucher.journalEntryId = entry.id;
            voucher.postedAt = new Date().toISOString();
            voucher.postedBy = Auth.getCurrentUser().id;
            voucher.postedByName = Auth.getCurrentUser().name;

            await this.saveVouchers();
            AuditLog.log('update', 'payment_voucher', voucherId, 'Posted to journal');

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

    getPendingApprovals() {
        const user = Auth.getCurrentUser();
        const userRole = user ? String(user.role).toUpperCase() : '';

        // ADMIN can approve all pending vouchers
        if (userRole === 'ADMIN') {
            return this.vouchers.filter(v =>
                v.status === 'verified' ||
                v.status === 'finance_approved'
            );
        }

        if (userRole === 'MANAGER_FINANCE' || userRole === 'FINANCE') {
            return this.vouchers.filter(v => v.status === 'verified');
        } else if (userRole === 'DIRECTOR') {
            // Get threshold from config
            const config = Storage.get(Storage.KEYS.CONFIG) || {};
            const smallExpenseLimit = config.payment_small_expense || this.approvalThresholds.small_expense;

            return this.vouchers.filter(v => {
                if (v.status !== 'finance_approved') return false;
                const voucherAmount = v.totalAmount || v.amount || 0;
                // Director approves if amount >= small_expense threshold
                return voucherAmount >= smallExpenseLimit;
            });
        }

        return [];
    }
    ,



    async voidVoucher(id, reason) {
        const voucher = this.getVoucher(id);
        if (!voucher) {
            return { success: false, errors: { voucher: 'Voucher not found' } };
        }

        // Check permission
        const permission = this.canUserVoid(voucher);
        if (!permission.allowed) {
            return { success: false, errors: { permission: permission.reason } };
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
                    sourceDocument: 'payment_voucher_void',
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

                AuditLog.log('create', 'journal_entry', reversalEntry.id, `Reversal entry for voided BKK: ${voucher.voucherNumber}`);
            }
        }

        // Update voucher to voided status
        voucher.status = 'VOIDED';
        voucher.voidedAt = new Date().toISOString();
        voucher.voidedBy = currentUser.id;
        voucher.voidedByName = currentUser.name;
        voucher.voidReason = reason;

        // Initialize modification history if it doesn't exist
        if (!voucher.modificationHistory) {
            voucher.modificationHistory = [];
        }

        // Add to modification history
        voucher.modificationHistory.push({
            timestamp: new Date().toISOString(),
            userId: currentUser.id,
            userName: currentUser.name,
            userRole: currentUser.role,
            action: 'VOID',
            previousStatus: oldStatus,
            newStatus: 'VOIDED',
            reason: reason
        });

        await this.saveVouchers();
        AuditLog.log('void', 'payment_voucher', id, `Voided ${voucher.voucherNumber}: ${reason}`);

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

    getStatusBadgeClass(status) {
        const classes = {
            draft: 'badge-secondary',
            verified: 'badge-info',
            finance_approved: 'badge-primary',
            director_approved: 'badge-success',
            payment_issued: 'badge-warning',
            posted: 'badge-success',
            rejected: 'badge-danger',
            VOIDED: 'badge-danger',
            voided: 'badge-danger'
        };
        return classes[status] || 'badge-secondary';
    },

    getStatusLabel(status) {
        return this.statuses[status] || status;
    },

    render() {
        const content = document.getElementById('main-content');
        content.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">💳 Payment Voucher (BKK/BBK)</h1>
                <p class="page-description">Payment voucher management with multi-level approval workflow</p>
            </div>

            ${this.renderFilterTabs()}
            ${this.renderVoucherList()}
            ${this.renderCreateModal()}
            ${this.renderViewModal()}
        `;

        this.attachEventListeners();
    },

    renderFilterTabs() {
        const currentUser = Auth.getCurrentUser();
        const allVouchers = this.getAllVouchers();
        const myVouchers = allVouchers.filter(v => v.createdBy === currentUser.id);
        const pendingApprovals = this.getPendingApprovals();
        const drafts = this.getVouchersByStatus('draft');
        const posted = this.getVouchersByStatus('posted');

        return `
            <div class="card">
                <div class="card-header" style="flex-wrap: wrap; gap: 15px;">
                    <div class="btn-group" role="tablist" id="voucher-tabs">
                        <button class="btn btn-sm active" data-tab="all">
                            All Vouchers (${allVouchers.length})
                        </button>
                        <button class="btn btn-sm" data-tab="my-vouchers">
                            My Vouchers (${myVouchers.length})
                        </button>
                        <button class="btn btn-sm" data-tab="pending-approval">
                            Pending My Approval (${pendingApprovals.length})
                        </button>
                        <button class="btn btn-sm" data-tab="drafts">
                            Drafts (${drafts.length})
                        </button>
                        <button class="btn btn-sm" data-tab="posted">
                            Posted (${posted.length})
                        </button>
                    </div>
                    
                    <div class="filter-group" style="display: flex; align-items: center; gap: 15px;">
                        <div style="display: flex; align-items: center; gap: 5px;">
                            <label style="font-size: 12px; white-space: nowrap;">Type:</label>
                            <select id="filter-voucher-type" class="form-select" style="padding: 5px; width: auto;">
                                <option value="all" ${this.filters.voucherType === 'all' ? 'selected' : ''}>All Types</option>
                                <option value="BKK" ${this.filters.voucherType === 'BKK' ? 'selected' : ''}>BKK (Cash)</option>
                                <option value="BBK" ${this.filters.voucherType === 'BBK' ? 'selected' : ''}>BBK (Bank)</option>
                            </select>
                        </div>
                        <div style="display: flex; align-items: center; gap: 5px;">
                            <label style="font-size: 12px; white-space: nowrap;">Period:</label>
                            <input type="date" id="filter-start-date" class="form-input" style="padding: 5px; width: auto;" 
                                   value="${this.filters.startDate}">
                            <span>to</span>
                            <input type="date" id="filter-end-date" class="form-input" style="padding: 5px; width: auto;" 
                                   value="${this.filters.endDate}">
                        </div>
                    </div>

                    <button class="btn btn-primary" onclick="PaymentVoucher.showCreateModal()" style="margin-left: auto;">
                        ➕ New Voucher
                    </button>
                </div>
            </div>
        `;
    },

    renderVoucherList() {
        // Force initial render with 'all' filter
        const initialFilter = 'all';

        return `
            <div class="card">
                <div class="card-body">
                    <div class="table-container">
                        <table class="table" id="voucher-table">
                            <thead>
                                <tr>
                                    <th>Voucher Number</th>
                                    <th>Type</th>
                                    <th>Date</th>
                                    <th style="min-width: 200px;">Purpose / Description</th>
                                    <th>Pay To</th>
                                    <th class="text-right">Amount</th>
                                    <th>Status</th>
                                    <th class="text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="voucher-table-body">
                                ${this.renderVoucherRows(initialFilter)}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    },

    renderVoucherRows(filter) {
        let vouchers = [];
        const currentUser = Auth.getCurrentUser();

        // Apply status filter first
        switch (filter) {
            case 'all':
                vouchers = this.getAllVouchers();
                break;
            case 'my-vouchers':
                vouchers = this.getAllVouchers().filter(v => v.createdBy === currentUser.id);
                break;
            case 'pending-approval':
                vouchers = this.getPendingApprovals();
                break;
            case 'drafts':
                vouchers = this.getVouchersByStatus('draft');
                break;
            case 'posted':
                vouchers = this.getVouchersByStatus('posted');
                break;
        }

        // NEW: Apply date range filter
        if (this.filters.startDate && this.filters.endDate) {
            vouchers = vouchers.filter(v => {
                const voucherDate = v.date;
                return voucherDate >= this.filters.startDate && voucherDate <= this.filters.endDate;
            });
        }

        // NEW: Apply type filter
        if (this.filters.voucherType && this.filters.voucherType !== 'all') {
            vouchers = vouchers.filter(v => v.type === this.filters.voucherType);
        }

        if (vouchers.length === 0) {
            console.log(`🔍 [DIAGNOSTIC] renderVoucherRows filtered down to 0 vouchers. (Raw count: ${this.vouchers.length}, Filter: ${filter})`);
            return `
                <tr>
                    <td colspan="8" class="text-center" style="padding: 40px; color: var(--text-secondary);">
                        No vouchers found
                    </td>
                </tr>
            `;
        }

        return vouchers.map(voucher => {
            // Use new permission check methods
            const editPermission = this.canUserEdit(voucher);
            const voidPermission = this.canUserVoid(voucher);
            const deletePermission = this.canUserDelete(voucher);

            const userRole = currentUser ? String(currentUser.role).toUpperCase() : '';
            const canVerify = voucher.status === 'draft' && this.approvalLimits[userRole]?.canVerify;
            const canApprove = this.canUserApprove(voucher);
            const canIssuePayment = (voucher.status === 'finance_approved' || voucher.status === 'director_approved') && userRole === 'KASIR';
            const canPost = voucher.status === 'payment_issued' && userRole === 'MANAGER_FINANCE';

            // Check if voucher is voided
            const isVoided = voucher.status === 'VOIDED' || voucher.status === 'voided';

            return `
                <tr ${isVoided ? 'style="background-color: var(--bg-tertiary); opacity: 0.7;"' : ''}>
                    <td ${isVoided ? 'style="text-decoration: line-through;"' : ''}>
                        <strong>${voucher.voucherNumber}</strong>
                        ${isVoided ? '<br><small style="color: var(--danger);">⚠️ VOIDED</small>' : ''}
                    </td>
                    <td><span class="badge badge-info">${voucher.type}</span></td>
                    <td>${this.formatDate(voucher.date)}</td>
                    <td style="font-size: 13px; max-width: 300px; white-space: normal;">
                        ${voucher.purpose || '-'}
                        ${voucher.habitAnomaly ? `<br><span class="badge badge-warning" style="font-size: 10px; margin-top: 4px; display: inline-block; text-transform: none; background: rgba(245, 158, 11, 0.2); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); font-weight: bold; padding: 2px 6px; border-radius: 4px;" title="${voucher.habitAnomaly.message}">⚠️ Anomali Frekuensi</span>` : ''}
                    </td>
                    <td>${voucher.payTo}</td>
                    <td class="text-right">${this.formatCurrency(voucher.amount)}</td>
                    <td>
                        <span class="badge ${this.getStatusBadgeClass(voucher.status)}">
                            ${this.getStatusLabel(voucher.status)}
                        </span>
                        ${voucher.voidReason ? `<br><small title="${voucher.voidReason}">🔍 Reason</small>` : ''}
                    </td>
                    <td class="text-center">
                        <div class="btn-group">
                            <button class="btn btn-sm btn-secondary" onclick="PaymentVoucher.showViewModal(${voucher.id})" title="View Details">
                                👁️
                            </button>
                            <button class="btn btn-sm btn-secondary" onclick="PaymentVoucher.printVoucher(${voucher.id})" title="Print Voucher">
                                🖨️
                            </button>
                            ${editPermission.allowed ? `
                                <button class="btn btn-sm btn-secondary" onclick="PaymentVoucher.showEditModal(${voucher.id})" title="Edit">
                                    ✏️
                                </button>
                            ` : ''}
                            ${canVerify ? `
                                <button class="btn btn-sm btn-primary" onclick="PaymentVoucher.showVerifyModal(${voucher.id})" title="Verify">
                                    ✓
                                </button>
                            ` : ''}
                            ${canApprove ? `
                                <button class="btn btn-sm btn-success" onclick="PaymentVoucher.showApproveModal(${voucher.id})" title="Approve">
                                    ✅
                                </button>
                            ` : ''}
                            ${voidPermission.allowed ? `
                                <button class="btn btn-sm btn-warning" onclick="PaymentVoucher.showVoidModal(${voucher.id})" title="Void Voucher">
                                    🚫
                                </button>
                            ` : ''}
                            ${canIssuePayment ? `
                                <button class="btn btn-sm btn-warning" onclick="PaymentVoucher.showIssuePaymentModal(${voucher.id})" title="Issue Payment">
                                    💰
                                </button>
                            ` : ''}
                            ${canPost ? `
                                <button class="btn btn-sm btn-success" onclick="PaymentVoucher.confirmPostToJournal(${voucher.id})" title="Post to Journal">
                                    📝
                                </button>
                            ` : ''}
                            ${deletePermission.allowed ? `
                                <button class="btn btn-sm btn-danger" onclick="PaymentVoucher.confirmDelete(${voucher.id})" title="Delete">
                                    🗑️
                                </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    canUserApprove(voucher) {
        const currentUser = Auth.getCurrentUser();
        if (!currentUser) return false;

        const userRole = String(currentUser.role).toUpperCase();

        // ADMIN can approve anything that's pending
        if (userRole === 'ADMIN') {
            return voucher.status === 'verified' ||
                voucher.status === 'finance_approved';
        }

        if ((userRole === 'MANAGER_FINANCE' || userRole === 'FINANCE') && voucher.status === 'verified') {
            return (voucher.totalAmount || voucher.amount) <= this.approvalLimits.MANAGER_FINANCE.maxAmount;
        }

        if (userRole === 'DIRECTOR') {
            // Get threshold from config
            const config = Storage.get(Storage.KEYS.CONFIG) || {};
            const smallExpenseLimit = config.payment_small_expense || this.approvalThresholds.small_expense;
            const voucherAmount = voucher.totalAmount || voucher.amount || 0;

            if (voucher.status === 'finance_approved') {
                // Director approves if amount >= small_expense threshold (default 5M)
                return voucherAmount >= smallExpenseLimit;
            }
            if (voucher.status === 'verified') {
                // If amount > Finance limit, Finance CANNOT approve it.
                // Director MUST be able to approve it directly from 'verified' state.
                return voucherAmount > this.approvalLimits.MANAGER_FINANCE.maxAmount;
            }
        }

        return false;
    },

    // Permission check: Can user edit this voucher?
    canUserEdit(voucher) {
        const currentUser = Auth.getCurrentUser();
        if (!currentUser) {
            return { allowed: false, reason: 'Session not found. Please log in again.' };
        }
        const userRole = String(currentUser.role).toUpperCase();

        // Cannot edit if already posted to journal
        if (voucher.status === 'posted' || voucher.journalPosted) {
            return {
                allowed: false,
                reason: 'Cannot edit voucher that has been posted to journal'
            };
        }

        // Cannot edit if voided
        if (voucher.status === 'VOIDED' || voucher.status === 'voided') {
            return {
                allowed: false,
                reason: 'Cannot edit voided voucher'
            };
        }

        // ADMIN can edit anything except posted
        if (userRole === 'ADMIN') {
            return { allowed: true };
        }

        // Director can edit anything except posted
        if (userRole === 'DIRECTOR') {
            return { allowed: true };
        }

        // Finance Manager can edit DRAFT, VERIFIED, FINANCE_APPROVED
        if (userRole === 'MANAGER_FINANCE' || userRole === 'FINANCE') {
            if (['draft', 'verified', 'PENDING_VERIFICATION', 'finance_approved'].includes(voucher.status)) {
                return { allowed: true };
            }
            return {
                allowed: false,
                reason: 'Finance manager can only edit draft, verified, or finance-approved vouchers'
            };
        }

        // Staff can only edit DRAFT and only if they created it
        if (userRole === 'STAFF' || userRole === 'KASIR') {
            if (voucher.status !== 'draft') {
                return {
                    allowed: false,
                    reason: 'Staff can only edit draft vouchers'
                };
            }
            if (voucher.createdBy !== currentUser.id) {
                return {
                    allowed: false,
                    reason: 'You can only edit vouchers you created'
                };
            }
            return { allowed: true };
        }

        return {
            allowed: false,
            reason: 'You do not have permission to edit vouchers'
        };
    },

    // Permission check: Can user void this voucher?
    canUserVoid(voucher) {
        const currentUser = Auth.getCurrentUser();
        if (!currentUser) {
            return { allowed: false, needsReason: false, reason: 'Session not found.' };
        }
        const userRole = String(currentUser.role).toUpperCase();

        // Cannot void if already posted (except ADMIN and Finance Manager)
        if ((voucher.status === 'posted' || voucher.journalPosted) && userRole !== 'ADMIN' && userRole !== 'MANAGER_FINANCE' && userRole !== 'FINANCE' && userRole !== 'DIRECTOR') {
            return {
                allowed: false,
                needsReason: false,
                reason: 'Cannot void voucher that has been posted to journal'
            };
        }

        // Cannot void if already voided
        if (voucher.status === 'VOIDED' || voucher.status === 'voided') {
            return {
                allowed: false,
                needsReason: false,
                reason: 'Voucher is already voided'
            };
        }

        // ADMIN can void anything except posted
        if (userRole === 'ADMIN') {
            return {
                allowed: true,
                needsReason: true
            };
        }

        // Director can void anything except posted
        if (userRole === 'DIRECTOR') {
            return {
                allowed: true,
                needsReason: true
            };
        }

        // Staff/Kasir CANNOT void (even if they have FINANCE or other role)
        // Explicitly block these roles first before checking manager_finance
        if (['KASIR', 'STAFF', 'FINANCE_STAFF', 'PRODUCTION', 'SALES', 'VIEWER', 'PURCHASING_HEAD'].includes(userRole)) {
            return {
                allowed: false,
                needsReason: false,
                reason: 'Staff members cannot void vouchers. Please contact your manager.'
            };
        }

        // Finance Manager can void DRAFT, VERIFIED, FINANCE_APPROVED, and POSTED
        if (userRole === 'MANAGER_FINANCE' || userRole === 'FINANCE') {
            if (['draft', 'verified', 'PENDING_VERIFICATION', 'finance_approved', 'posted'].includes(voucher.status)) {
                return {
                    allowed: true,
                    needsReason: true
                };
            }
            return {
                allowed: false,
                needsReason: false,
                reason: 'Finance manager can only void draft, verified, or finance-approved vouchers'
            };
        }

        // Default: deny
        return {
            allowed: false,
            needsReason: false,
            reason: 'You do not have permission to void vouchers'
        };
    },

    // Permission check: Can user delete this voucher?
    canUserDelete(voucher) {
        const currentUser = Auth.getCurrentUser();
        if (!currentUser) {
            return { allowed: false, reason: 'Session not found.' };
        }
        const userRole = String(currentUser.role).toUpperCase();

        // Can only delete DRAFT vouchers (Except Admin, Director, Manager Finance who can delete posted for correction)
        if (voucher.status !== 'draft' && userRole !== 'ADMIN' && userRole !== 'MANAGER_FINANCE' && userRole !== 'FINANCE' && userRole !== 'DIRECTOR') {
            return {
                allowed: false,
                reason: 'Can only delete draft vouchers. Use Void for approved vouchers.'
            };
        }

        // Cannot delete if posted (except Admin, Director, Manager Finance)
        if (voucher.journalPosted && userRole !== 'ADMIN' && userRole !== 'MANAGER_FINANCE' && userRole !== 'FINANCE' && userRole !== 'DIRECTOR') {
            return {
                allowed: false,
                reason: 'Cannot delete voucher that has been posted to journal'
            };
        }

        // ADMIN can delete draft vouchers
        if (userRole === 'ADMIN') {
            return { allowed: true };
        }

        // Staff can delete their own draft vouchers
        if (userRole === 'STAFF' || userRole === 'KASIR') {
            if (voucher.createdBy === currentUser.id) {
                return { allowed: true };
            }
            return {
                allowed: false,
                reason: 'You can only delete vouchers you created'
            };
        }

        // Finance and Director can delete any draft
        if (userRole === 'MANAGER_FINANCE' || userRole === 'FINANCE' || userRole === 'DIRECTOR') {
            return { allowed: true };
        }

        return {
            allowed: false,
            reason: 'You do not have permission to delete vouchers'
        };
    },

    renderCreateModal() {
        return `
            <div id="create-voucher-modal" class="modal-overlay hidden">
                <div class="modal-content" style="max-width: 900px;">
                    <div class="modal-header">
                        <h3 class="modal-title" id="voucher-modal-title">Create New Payment Voucher</h3>
                        <button class="modal-close" onclick="PaymentVoucher.closeCreateModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="voucher-form">
                            <input type="hidden" id="voucher-id" value="">
                            
                            <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
                                <div class="form-group">
                                    <label class="form-label required">Type</label>
                                    <select id="voucher-type" class="form-select" required>
                                        <option value="">Select Type</option>
                                        <option value="BKK">BKK - Bukti Kas Keluar</option>
                                        <option value="BBK">BBK - Bukti Bank Keluar</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Voucher Number</label>
                                    <input type="text" id="voucher-number" class="form-input" readonly style="background: var(--bg-tertiary);">
                                </div>
                                <div class="form-group">
                                    <label class="form-label required">Date</label>
                                    <input type="date" id="voucher-date" class="form-input" required>
                                </div>
                            </div>

                            <div class="form-row" style="display: grid; grid-template-columns: 2fr 1fr; gap: 1rem;">
                                <div class="form-group">
                                    <label class="form-label required">Pay To</label>
                                    <input type="text" id="voucher-payto" class="form-input" required placeholder="Supplier/Employee name">
                                </div>
                                <div class="form-group">
                                    <label class="form-label required">Amount</label>
                                    <input type="number" id="voucher-amount" class="form-input" required min="0" step="1000">
                                </div>
                            </div>

                            <div class="form-group">
                                <label class="form-label required">Purpose</label>
                                <textarea id="voucher-purpose" class="form-input" rows="2" required placeholder="Payment purpose/description"></textarea>
                            </div>

                            <!-- NEW: Multi-Line Expense Items -->
                            <div class="form-group" style="border: 1px solid var(--color-gray-800); border-radius: 8px; padding: 16px; background: var(--bg-tertiary);">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                                    <label class="form-label" style="margin: 0;">Expense Line Items</label>
                                    <button type="button" class="btn btn-sm btn-secondary" onclick="PaymentVoucher.addLineItem()">
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
                                        <tbody id="line-items-body">
                                            <!-- Dynamic line items will be added here -->
                                        </tbody>
                                        <tfoot>
                                            <tr style="font-weight: 600; background: var(--bg-secondary);">
                                                <td colspan="2" class="text-right">Total:</td>
                                                <td class="text-right" id="line-items-total" style="width: 200px; min-width: 200px;">Rp 0</td>
                                                <td style="width: 60px; min-width: 60px;"></td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                                
                                <div style="font-size: 12px; color: var(--text-secondary);">
                                    💡 Tip: Add multiple expense line items with different account codes (e.g., Biaya Meterai, Biaya Transport) for one voucher
                                </div>
                            </div>

                            <!-- Auto-Post Journal Checkbox -->
                            <div class="form-group">
                                <label style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
                                    <input type="checkbox" id="auto-post-journal" checked style="width: 18px; height: 18px; cursor: pointer;">
                                    <span>
                                        <strong>Auto-post to journal when approved</strong>
                                        <br>
                                        <small style="color: var(--text-secondary);">Journal entry will be automatically created after director approval</small>
                                    </span>
                                </label>
                            </div>

                            <div class="form-group">
                                <label class="form-label">Payment Category</label>
                                <select id="voucher-category" class="form-select">
                                    <option value="supplier">Supplier Payment</option>
                                    <option value="employee">Employee Payment</option>
                                    <option value="expense">General Expense</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>

                            <div id="supplier-docs-section" class="form-group" style="display: none;">
                                <label class="form-label">Supporting Documents (Required for Supplier Payment)</label>
                                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
                                    <input type="text" id="doc-po" class="form-input" placeholder="PO Number">
                                    <input type="text" id="doc-sj" class="form-input" placeholder="SJ Number">
                                    <input type="text" id="doc-invoice" class="form-input" placeholder="Invoice Number">
                                </div>
                            </div>

                            <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <div class="form-group">
                                    <label class="form-label">Payment Method</label>
                                    <select id="voucher-payment-method" class="form-select">
                                        <option value="cash">Cash</option>
                                        <option value="transfer">Bank Transfer</option>
                                        <option value="check">Check</option>
                                        <option value="giro">Giro</option>
                                    </select>
                                </div>
                                <div class="form-group" id="bank-account-section" style="display: none;">
                                    <label class="form-label">Bank Account</label>
                                    <select id="voucher-bank" class="form-select">
                                        <option value="">Select Bank</option>
                                    </select>
                                </div>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" id="btn-cancel-voucher" class="btn btn-secondary" onclick="PaymentVoucher.closeCreateModal()">
                            Cancel
                        </button>
                        <button type="button" id="btn-draft-voucher" class="btn btn-secondary" onclick="PaymentVoucher.saveAsDraft()">
                            Save as Draft
                        </button>
                        <button type="button" id="btn-submit-voucher" class="btn btn-primary" onclick="PaymentVoucher.submitForVerification()">
                            Submit for Verification
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    updatePaymentMethodOptions() {
        const typeSelect = document.getElementById('voucher-type');
        const methodSelect = document.getElementById('voucher-payment-method');
        if (!typeSelect || !methodSelect) return;

        const type = typeSelect.value;
        const cashOption = methodSelect.querySelector('option[value="cash"]');

        if (type === 'BBK') {
            if (cashOption) {
                cashOption.disabled = true;
                cashOption.style.display = 'none';
            }
            if (methodSelect.value === 'cash') {
                methodSelect.value = 'transfer';
                methodSelect.dispatchEvent(new Event('change'));
            }
        } else {
            if (cashOption) {
                cashOption.disabled = false;
                cashOption.style.display = 'block';
            }
        }
    },

    renderViewModal() {
        return `
            <div id="view-voucher-modal" class="modal-overlay hidden">
                <div class="modal-content" style="max-width: 800px;">
                    <div class="modal-header">
                        <h3 class="modal-title">Voucher Details</h3>
                        <button class="modal-close" onclick="PaymentVoucher.closeViewModal()">&times;</button>
                    </div>
                    <div class="modal-body" id="view-voucher-content">
                    </div>
                    <div class="modal-footer" id="view-voucher-footer">
                        <button type="button" class="btn btn-secondary" onclick="PaymentVoucher.closeViewModal()">
                            Close
                        </button>
                    </div>
                </div>
            </div>

            <!-- Void Voucher Modal -->
            <div id="void-voucher-modal" class="modal-overlay hidden">
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <h3 class="modal-title">⚠️ Void Payment Voucher</h3>
                        <button class="modal-close" onclick="PaymentVoucher.closeVoidModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div style="padding: 1rem; background: var(--warning-bg, #fff3cd); color: #856404; border: 1px solid var(--warning, #ffc107); border-radius: 4px; margin-bottom: 1rem;">
                            <strong>⚠️ Warning:</strong> This will mark the voucher as VOIDED. This action cannot be undone.
                            The voucher will remain in the system for audit purposes but will be marked as voided.
                        </div>
                        <div id="void-voucher-details" style="margin-bottom: 1.5rem;">
                        </div>
                        <div class="form-group">
                            <label class="form-label" style="font-weight: bold;">Reason for Voiding *</label>
                            <textarea id="void-reason" class="form-input" rows="4" required
                                placeholder="Please enter a detailed reason for voiding this voucher..."></textarea>
                            <small style="color: var(--text-secondary);">This reason will be recorded in the audit trail.</small>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="PaymentVoucher.closeVoidModal()">
                            Cancel
                        </button>
                        <button type="button" class="btn btn-danger" onclick="PaymentVoucher.confirmVoid()">
                            ⚠️ Void Voucher
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    // UI Helper Functions
    // ========================================
    // PRINT VOUCHER
    // ========================================
    printVoucher(voucherId) {
        const voucher = this.getVoucher(voucherId);
        if (!voucher) {
            alert('Voucher not found');
            return;
        }

        // Generate print content
        const printContent = this.generatePrintTemplate(voucher);

        // Open print window
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        printWindow.document.write(printContent);
        printWindow.document.close();

        // Auto print after load
        printWindow.onload = function () {
            printWindow.print();
        };

        // Log audit
        AuditLog.log('print', 'payment_voucher', voucherId, `Printed ${voucher.voucherNumber}`);
    },

    generatePrintTemplate(voucher) {
        const isMultiLine = voucher.lineItems && voucher.lineItems.length > 0;
        const companyName = "PT. GOLDEN ALURA REFINERI"; // TODO: Get from settings

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${voucher.voucherNumber}</title>
    <style>
        @page {
            size: A5 portrait; /* Setengah A4 - HEMAT! */
            margin: 10mm;
        }
        
        @media print {
            body { 
                margin: 0;
                padding: 0;
            }
            .no-print { display: none; }
            .page-break { page-break-after: always; }
        }
        
        body {
            font-family: 'Arial', sans-serif;
            font-size: 11pt;
            line-height: 1.4;
            color: #000;
            max-width: 14.85cm;
            margin: 0 auto;
            padding: 10px;
        }
        
        .header {
            text-align: center;
            border-bottom: 2px solid #000;
            padding-bottom: 8px;
            margin-bottom: 12px;
        }
        
        .company-name {
            font-size: 14pt;
            font-weight: bold;
            margin: 0;
        }
        
        .voucher-title {
            font-size: 13pt;
            font-weight: bold;
            margin: 4px 0 0 0;
        }
        
        .voucher-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 12px;
            font-size: 10pt;
        }
        
        .detail-box {
            border: 1px solid #000;
            padding: 10px;
            margin-bottom: 12px;
        }
        
        .detail-row {
            display: flex;
            margin-bottom: 6px;
        }
        
        .detail-label {
            width: 40%;
            font-weight: bold;
        }
        
        .detail-value {
            width: 60%;
        }
        
        .amount-box {
            background: #f0f0f0;
            border: 2px solid #000;
            padding: 8px;
            text-align: right;
            margin: 12px 0;
        }
        
        .amount-label {
            font-weight: bold;
            font-size: 10pt;
        }
        
        .amount-value {
            font-size: 16pt;
            font-weight: bold;
        }
        
        .line-items {
            border: 1px solid #000;
            margin: 10px 0;
        }
        
        .line-items table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9pt;
        }
        
        .line-items th {
            background: #e0e0e0;
            padding: 4px;
            border: 1px solid #000;
            font-weight: bold;
        }
        
        .line-items td {
            padding: 4px;
            border: 1px solid #000;
        }
        
        .signature-section {
            display: flex;
            justify-content: space-between;
            margin-top: 20px;
        }
        
        .signature-box {
            width: 48%;
            border: 1px solid #000;
            padding: 8px;
            text-align: center;
            min-height: 60px;
        }
        
        /* 3-column signature for cash BKK */
        .signature-section-cash {
            display: flex;
            justify-content: space-between;
            margin-top: 20px;
            gap: 5px;
        }
        
        .signature-box-cash {
            width: 32%;
            border: 1px solid #000;
            padding: 8px;
            text-align: center;
            min-height: 60px;
        }
        
        .signature-label {
            font-size: 9pt;
            margin-top: 30px;
            border-top: 1px solid #000;
            padding-top: 4px;
        }
        
        .footer {
            margin-top: 10px;
            font-size: 8pt;
            text-align: center;
            color: #666;
        }
        
        .text-right {
            text-align: right;
        }
    </style>
</head>
<body>
    <!-- HEADER -->
    <div class="header">
        <p class="company-name">${companyName}</p>
        <p class="voucher-title">BUKTI ${voucher.type === 'BKK' ? 'KAS' : 'BANK'} KELUAR</p>
    </div>
    
    <!-- VOUCHER INFO -->
    <div class="voucher-info">
        <div><strong>No:</strong> ${voucher.voucherNumber}</div>
        <div><strong>Tanggal:</strong> ${this.formatDate(voucher.date)}</div>
    </div>
    
    <!-- PAYMENT DETAILS -->
    <div class="detail-box">
        <div class="detail-row">
            <div class="detail-label">Dibayarkan kepada:</div>
            <div class="detail-value"><strong>${voucher.payTo}</strong></div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Untuk pembayaran:</div>
            <div class="detail-value">${voucher.purpose}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Metode Bayar:</div>
            <div class="detail-value">${this.paymentMethods[voucher.paymentMethod] || voucher.paymentMethod}</div>
        </div>
        ${voucher.checkNumber ? `
        <div class="detail-row">
            <div class="detail-label">No. Cek/Giro:</div>
            <div class="detail-value">${voucher.checkNumber}</div>
        </div>
        ` : ''}
        ${voucher.paymentCategory === 'supplier' && voucher.documents ? `
        <div class="detail-row">
            <div class="detail-label">Dokumen:</div>
            <div class="detail-value">
                PO: ${voucher.documents.poNumber || '-'}, 
                SJ: ${voucher.documents.sjNumber || '-'}, 
                INV: ${voucher.documents.invoiceNumber || '-'}
            </div>
        </div>
        ` : ''}
    </div>
    
    <!-- LINE ITEMS (if multi-line) -->
    ${isMultiLine ? `
    <div class="line-items">
        <table>
            <thead>
                <tr>
                    <th style="width: 15%;">Akun</th>
                    <th style="width: 50%;">Keterangan</th>
                    <th style="width: 35%;" class="text-right">Jumlah</th>
                </tr>
            </thead>
            <tbody>
                ${voucher.lineItems.map(item => `
                <tr>
                    <td>${item.accountCode}</td>
                    <td>${item.description || item.accountName}</td>
                    <td class="text-right">${this.formatCurrency(item.amount)}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
    ` : ''}
    
    <!-- TOTAL AMOUNT -->
    <div class="amount-box">
        <div class="amount-label">JUMLAH:</div>
        <div class="amount-value">${this.formatCurrency(voucher.totalAmount || voucher.amount)}</div>
    </div>
    
    <!-- SIGNATURE SECTION -->
    ${voucher.type === 'BKK' && voucher.paymentMethod === 'cash' ? `
    <!-- 3 SIGNATURE BOXES FOR CASH BKK -->
    <div class="signature-section-cash">
        <div class="signature-box-cash">
            <div style="font-weight: bold; font-size: 9pt; margin-bottom: 8px;">Dibuat oleh:</div>
            <div style="font-size: 10pt; padding-top: 15px;">
                <strong>${voucher.createdByName || 'N/A'}</strong><br>
                <small style="font-size: 8pt;">${this.formatDate(voucher.createdAt)}</small>
            </div>
        </div>
        
        <div class="signature-box-cash" style="background: #f9f9f9;">
            <div style="font-weight: bold; font-size: 9pt; margin-bottom: 8px;">Penerima Uang:</div>
            <div style="margin-top: 10px; font-size: 9pt;">
                <div style="height: 35px;"></div>
                <div style="border-top: 1px solid #000; padding-top: 4px;">
                    ( __________________ )
                </div>
                <div style="margin-top: 2px; font-size: 8pt; color: #666;">
                    Tanda Tangan & Nama Jelas
                </div>
            </div>
        </div>
        
        <div class="signature-box-cash">
            <div style="font-weight: bold; font-size: 9pt; margin-bottom: 8px;">Disetujui oleh:</div>
            <div style="font-size: 10pt; padding-top: 15px;">
                <strong>${voucher.directorApprovedByName || voucher.financeApprovedByName || '___________'}</strong><br>
                <small style="font-size: 8pt;">${this.formatDate(voucher.directorApprovedAt || voucher.financeApprovedAt)}</small>
            </div>
        </div>
    </div>
    ` : `
    <!-- 2 SIGNATURE BOXES FOR BANK TRANSFER -->
    <div class="signature-section">
        <div class="signature-box">
            <div style="font-weight: bold; font-size: 9pt;">Dibuat oleh:</div>
            <div style="margin-top: 30px; font-size: 9pt;">
                <div style="border-top: 1px solid #000; padding-top: 4px;">
                    ${voucher.createdByName || 'N/A'}<br>
                    <small>${this.formatDate(voucher.createdAt)}</small>
                </div>
            </div>
        </div>
        
        <div class="signature-box">
            <div style="font-weight: bold; font-size: 9pt;">Disetujui oleh:</div>
            <div style="margin-top: 30px; font-size: 9pt;">
                <div style="border-top: 1px solid #000; padding-top: 4px;">
                    ${voucher.directorApprovedByName || voucher.financeApprovedByName || '___________'}<br>
                    <small>${this.formatDate(voucher.directorApprovedAt || voucher.financeApprovedAt)}</small>
                </div>
            </div>
        </div>
    </div>
    `}
    
    <!-- FOOTER -->
    <div class="footer">
        Dicetak: ${new Date().toLocaleString('id-ID')} | Status: ${this.getStatusLabel(voucher.status)}
        ${voucher.status === 'VOIDED' || voucher.status === 'voided' ? `<br><strong style="color: red;">⚠️ VOUCHER TELAH DI-VOID: ${voucher.voidReason || 'No reason'}</strong>` : ''}
    </div>
    
    <!-- PRINT BUTTON (hidden when printing) -->
    <div class="no-print" style="text-align: center; margin-top: 20px; border-top: 1px solid #ccc; padding-top: 10px;">
        <button onclick="window.print()" style="padding: 10px 20px; font-size: 14px; cursor: pointer; background: #4CAF50; color: white; border: none; border-radius: 4px; margin-right: 10px;">
            🖨️ Print
        </button>
        <button onclick="window.close()" style="padding: 10px 20px; font-size: 14px; cursor: pointer; background: #f44336; color: white; border: none; border-radius: 4px;">
            ❌ Close
        </button>
    </div>
</body>
</html>
        `;
    },

    attachEventListeners() {
        // Tab switching
        document.querySelectorAll('#voucher-tabs button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('#voucher-tabs button').forEach(b => b.classList.remove('active'));
                const target = e.currentTarget;
                target.classList.add('active');

                const filter = target.dataset.tab;
                this.filters.status = filter;
                document.getElementById('voucher-table-body').innerHTML = this.renderVoucherRows(filter);
            });
        });

        // NEW: Date filter listeners
        const startDateInput = document.getElementById('filter-start-date');
        const endDateInput = document.getElementById('filter-end-date');

        if (startDateInput) {
            startDateInput.addEventListener('change', (e) => {
                this.filters.startDate = e.target.value;
                const activeTab = document.querySelector('#voucher-tabs button.active')?.dataset.tab || 'all';
                document.getElementById('voucher-table-body').innerHTML = this.renderVoucherRows(activeTab);
            });
        }

        if (endDateInput) {
            endDateInput.addEventListener('change', (e) => {
                this.filters.endDate = e.target.value;
                const activeTab = document.querySelector('#voucher-tabs button.active')?.dataset.tab || 'all';
                document.getElementById('voucher-table-body').innerHTML = this.renderVoucherRows(activeTab);
            });
        }

        // NEW: Type filter listener
        const typeFilterSelect = document.getElementById('filter-voucher-type');
        if (typeFilterSelect) {
            typeFilterSelect.addEventListener('change', (e) => {
                this.filters.voucherType = e.target.value;
                const activeTab = document.querySelector('#voucher-tabs button.active')?.dataset.tab || 'all';
                document.getElementById('voucher-table-body').innerHTML = this.renderVoucherRows(activeTab);
            });
        }

        // Payment category change
        const categorySelect = document.getElementById('voucher-category');
        if (categorySelect) {
            categorySelect.addEventListener('change', (e) => {
                const supplierDocs = document.getElementById('supplier-docs-section');
                if (e.target.value === 'supplier') {
                    supplierDocs.style.display = 'block';
                } else {
                    supplierDocs.style.display = 'none';
                }
            });
        }

        // Payment method change
        const paymentMethodSelect = document.getElementById('voucher-payment-method');
        if (paymentMethodSelect) {
            paymentMethodSelect.addEventListener('change', (e) => {
                const bankSection = document.getElementById('bank-account-section');
                if (e.target.value === 'transfer' || e.target.value === 'check' || e.target.value === 'giro') {
                    bankSection.style.display = 'block';
                } else {
                    bankSection.style.display = 'none';
                }
            });
        }

        // NEW: Voucher type change for payment method restriction
        const modalTypeSelect = document.getElementById('voucher-type');
        if (modalTypeSelect) {
            modalTypeSelect.addEventListener('change', (e) => {
                this.updatePaymentMethodOptions();
            });
        }
    },

    loadBankOptions() {
        const banks = Storage.getBankAccounts() || [];
        const bankSelect = document.getElementById('voucher-bank');

        if (bankSelect) {
            const currentValue = bankSelect.value;
            // Clear existing options except the first one (placeholder)
            bankSelect.innerHTML = '<option value="">Select Bank Account</option>';

            // Add bank options
            banks.forEach(bank => {
                const option = document.createElement('option');
                option.value = bank.id;
                option.textContent = `${bank.bankName} - ${bank.accountNumber} (${bank.currency})`;
                bankSelect.appendChild(option);
            });

            if (currentValue) {
                bankSelect.value = currentValue;
            }
        }
    },

    // NEW: Line Items Management Functions
    addLineItem() {
        const accounts = ChartOfAccounts.getDetailAccounts();
        const row = `
            <tr>
                <td>
                    <select class="form-select line-account" required style="width: 100%;">
                        <option value="">-- Select Account --</option>
                        ${accounts.map(acc =>
            `<option value="${acc.code}">${acc.code} - ${acc.name}</option>`
        ).join('')}
                    </select>
                </td>
                <td>
                    <input type="text" class="form-input line-description" 
                           placeholder="Description" style="width: 100%;">
                </td>
                <td style="width: 200px; min-width: 200px;">
                    <input type="number" class="form-input line-amount" 
                           placeholder="0" min="0" step="1000" required
                           onchange="PaymentVoucher.calculateTotal()"
                           style="width: 100%; text-align: right;">
                </td>
                <td class="text-center" style="width: 60px; min-width: 60px;">
                    <button type="button" class="btn btn-sm btn-danger" 
                            onclick="this.closest('tr').remove(); PaymentVoucher.calculateTotal();"
                            title="Remove line item">
                        🗑️
                    </button>
                </td>
            </tr>
        `;

        const tbody = document.getElementById('line-items-body');
        if (tbody) {
            tbody.insertAdjacentHTML('beforeend', row);
        }
    },

    calculateTotal() {
        const amounts = document.querySelectorAll('.line-amount');
        const total = Array.from(amounts).reduce((sum, input) => {
            return sum + (parseFloat(input.value) || 0);
        }, 0);

        const totalElement = document.getElementById('line-items-total');
        if (totalElement) {
            totalElement.textContent = this.formatCurrency(total);
        }

        // Also update the main amount field (for backward compatibility)
        const amountField = document.getElementById('voucher-amount');
        if (amountField) {
            amountField.value = total;
        }
    },

    getLineItems() {
        const rows = document.querySelectorAll('#line-items-body tr');
        const lineItems = [];

        rows.forEach(row => {
            const accountSelect = row.querySelector('.line-account');
            const accountCode = accountSelect?.value;

            if (accountCode) {
                const account = ChartOfAccounts.getAccount(accountCode);
                lineItems.push({
                    accountCode: accountCode,
                    accountName: account?.name || '',
                    description: row.querySelector('.line-description')?.value || '',
                    amount: parseFloat(row.querySelector('.line-amount')?.value) || 0
                });
            }
        });

        return lineItems;
    },

    validateDataIntegrity() {
        const requiredIds = [
            'voucher-date', 'voucher-type', 'voucher-payment-method',
            'voucher-payto', 'voucher-amount'
        ];

        for (const id of requiredIds) {
            if (!document.getElementById(id)) {
                console.error(`🛑 [Integrity Guard] Missing critical UI element: #${id}`);
                alert(`⚠️ Sistem Tidak Stabil: Komponen #${id} hilang. Harap refresh halaman.`);
                return false;
            }
        }

        const lineItems = this.getLineItems();
        if (lineItems.length === 0) {
            alert('⚠️ Harap tambahkan minimal satu baris pengeluaran.');
            return false;
        }

        return true;
    },

    async handleSubmit(event) {
        if (!this.validateDataIntegrity()) return;
        event.preventDefault();

        // 1. UI LOCK
        const btn = document.getElementById('btn-save-voucher');
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '⏳ Processing...';

        try {
            // Collect Form Data
            const type = document.getElementById('voucher-type').value;
            const payTo = document.getElementById('voucher-payto').value; // Corrected from voucher-pay-to
            const amount = document.getElementById('voucher-amount').value;
            const purpose = document.getElementById('voucher-purpose').value;
            const category = document.getElementById('voucher-category').value;
            const paymentMethod = document.getElementById('voucher-payment-method').value;

            // ... (validation) ... // Validation logic would go here

            // Construct Data Object
            const data = {
                type,
                payTo,
                amount: parseFloat(amount), // Ensure amount is a number
                purpose,
                paymentCategory: category,
                paymentMethod,
                // ... (other fields) ...
                lineItems: this.getLineItems() // Use getLineItems() to retrieve current line items
            };

            // Add breakdown if exists
            const bankAccountId = document.getElementById('voucher-bank').value; // Corrected from voucher-bank-account
            if (bankAccountId) data.bankAccountId = bankAccountId;

            // These fields might not exist in the current form, but keeping them for completeness if they are added later
            const checkNumberInput = document.getElementById('voucher-check-number');
            if (checkNumberInput) {
                const checkNumber = checkNumberInput.value;
                if (checkNumber) data.checkNumber = checkNumber;
            }

            const giroNumberInput = document.getElementById('voucher-giro-number');
            if (giroNumberInput) {
                const giroNumber = giroNumberInput.value;
                if (giroNumber) data.giroNumber = giroNumber;
            }

            const giroDateInput = document.getElementById('voucher-giro-date');
            if (giroDateInput) {
                const giroDate = giroDateInput.value;
                if (giroDate) data.giroDate = giroDate;
            }

            // Document references
            const docs = {};
            const po = document.getElementById('doc-po').value;
            if (po) docs.poNumber = po;
            const sj = document.getElementById('doc-sj').value;
            if (sj) docs.sjNumber = sj;
            const inv = document.getElementById('doc-invoice').value;
            if (inv) docs.invoiceNumber = inv;
            data.documents = docs;

            // Assuming createVoucher is a method that handles saving the data
            // This method needs to be implemented or adjusted to use the new data structure
            const result = await this.createVoucher(data);

            if (result.success) {
                this.closeCreateModal();
                alert('Voucher created successfully');
                this.render(); // Re-render the list to show the new voucher
            } else {
                if (result.errors) {
                    let msg = 'Validation Failed:\n';
                    for (const [key, val] of Object.entries(result.errors)) {
                        msg += `- ${val}\n`;
                    }
                    alert(msg);
                } else {
                    alert(result.error || 'Failed to create voucher');
                }
            }
        } catch (error) {
            console.error('Voucher Submit Error:', error);
            alert('An unexpected error occurred. Please try again.');
        } finally {
            // RELEASE LOCK
            if (btn) {
                btn.disabled = false;
                btn.textContent = originalText;
            }
        }
    },

    getFormData() {
        const type = document.getElementById('voucher-type').value;
        if (!type) {
            alert('⚠️ Silakan pilih tipe voucher (BKK atau BBK) terlebih dahulu!');
            const selectEl = document.getElementById('voucher-type');
            if (selectEl) selectEl.focus();
            return null;
        }
        const date = document.getElementById('voucher-date').value;
        const payTo = document.getElementById('voucher-payto').value;
        const purpose = document.getElementById('voucher-purpose').value;
        const paymentCategory = document.getElementById('voucher-category').value;
        const paymentMethod = document.getElementById('voucher-payment-method').value;
        const bankAccountId = document.getElementById('voucher-bank').value;
        const autoPostJournal = document.getElementById('auto-post-journal')?.checked !== false;

        // NEW: Get line items
        const lineItems = this.getLineItems();

        // Validate: either lineItems OR single amount must be provided
        if (lineItems.length === 0) {
            const amount = parseFloat(document.getElementById('voucher-amount').value);
            if (!type || !date || !payTo || !amount || !purpose) {
                alert('Please fill in all required fields or add at least one line item');
                return null;
            }

            // Return old format for backward compatibility
            return {
                type,
                date,
                payTo,
                amount,
                purpose,
                paymentCategory,
                paymentMethod,
                bankAccountId: (paymentMethod === 'transfer' || paymentMethod === 'check' || paymentMethod === 'giro') ? bankAccountId : null,
                autoPostJournal,
                documents: paymentCategory === 'supplier' ? {
                    poNumber: document.getElementById('doc-po').value,
                    sjNumber: document.getElementById('doc-sj').value,
                    invoiceNumber: document.getElementById('doc-invoice').value
                } : {}
            };
        }

        // NEW: Multi-line format
        const data = {
            type,
            date,
            payTo,
            purpose,
            paymentCategory,
            paymentMethod,
            bankAccountId: (paymentMethod === 'transfer' || paymentMethod === 'check' || paymentMethod === 'giro') ? bankAccountId : null,
            lineItems: lineItems,
            autoPostJournal,
            documents: {}
        };

        if (paymentCategory === 'supplier') {
            data.documents = {
                poNumber: document.getElementById('doc-po').value,
                sjNumber: document.getElementById('doc-sj').value,
                invoiceNumber: document.getElementById('doc-invoice').value
            };
        }

        return data;
    },

    showCreateModal() {
        this._editMode = false;
        this._editingId = null;

        const modal = document.getElementById('create-voucher-modal');
        const modalTitle = document.getElementById('voucher-modal-title');
        if (modalTitle) modalTitle.textContent = 'Create New Payment Voucher';
        document.getElementById('voucher-id').value = '';
        document.getElementById('voucher-type').value = '';
        this.updatePaymentMethodOptions();
        document.getElementById('voucher-number').value = 'Auto-generated';
        document.getElementById('voucher-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('voucher-payto').value = '';
        document.getElementById('voucher-amount').value = '';
        document.getElementById('voucher-purpose').value = '';
        document.getElementById('voucher-category').value = 'other';
        document.getElementById('voucher-payment-method').value = 'cash';

        // Reset visibility
        document.getElementById('supplier-docs-section').style.display = 'none';
        document.getElementById('bank-account-section').style.display = 'none';

        // NEW: Clear and initialize line items table
        const lineItemsBody = document.getElementById('line-items-body');
        if (lineItemsBody) {
            lineItemsBody.innerHTML = ''; // Clear existing rows
            this.addLineItem(); // Add one initial row
        }

        // Reset total
        const totalElement = document.getElementById('line-items-total');
        if (totalElement) {
            totalElement.textContent = 'Rp 0';
        }

        // Check auto-post checkbox by default
        const autoPostCheckbox = document.getElementById('auto-post-journal');
        if (autoPostCheckbox) {
            autoPostCheckbox.checked = true;
        }

        // Load fresh bank data every time modal opens
        this.loadBankOptions();

        modal.classList.remove('hidden');
    },

    closeCreateModal() {
        document.getElementById('create-voucher-modal').classList.add('hidden');
        this._editMode = false;
        this._editingId = null;
    },

    showEditModal(voucherId) {
        const voucher = this.getVoucher(voucherId);
        if (!voucher) return;

        this._editMode = true;
        this._editingId = voucherId;

        const modal = document.getElementById('create-voucher-modal');
        const modalTitle = document.getElementById('voucher-modal-title');
        if (modalTitle) modalTitle.textContent = 'Edit Payment Voucher';
        document.getElementById('voucher-id').value = voucher.id;
        document.getElementById('voucher-type').value = voucher.type;
        this.updatePaymentMethodOptions();
        document.getElementById('voucher-number').value = voucher.voucherNumber;
        document.getElementById('voucher-date').value = voucher.date;
        document.getElementById('voucher-payto').value = voucher.payTo;
        document.getElementById('voucher-amount').value = voucher.amount;
        document.getElementById('voucher-purpose').value = voucher.purpose;
        document.getElementById('voucher-category').value = voucher.paymentCategory || 'other';
        document.getElementById('voucher-payment-method').value = voucher.paymentMethod || 'cash';

        // Load fresh bank data
        this.loadBankOptions();

        if (voucher.bankAccountId) {
            document.getElementById('voucher-bank').value = voucher.bankAccountId;
        }

        // Trigger visibility logic
        document.getElementById('supplier-docs-section').style.display =
            (voucher.paymentCategory === 'supplier') ? 'block' : 'none';

        const showBank = ['transfer', 'check', 'giro'].includes(voucher.paymentMethod);
        document.getElementById('bank-account-section').style.display = showBank ? 'block' : 'none';

        if (voucher.paymentCategory === 'supplier' && voucher.documents) {
            document.getElementById('doc-po').value = voucher.documents.poNumber || '';
            document.getElementById('doc-sj').value = voucher.documents.sjNumber || '';
            document.getElementById('doc-invoice').value = voucher.documents.invoiceNumber || '';
        }

        // ==============================================================
        // Populate Line Items - BULLETPROOF VERSION
        // ==============================================================
        const lineItemsBody = document.getElementById('line-items-body');
        if (lineItemsBody) {
            // 1. Clear all existing rows
            lineItemsBody.innerHTML = '';

            // 2. Ensure COA is loaded (reload if accounts is empty)
            if (!ChartOfAccounts.accounts || ChartOfAccounts.accounts.length === 0) {
                ChartOfAccounts.loadAccounts();
            }

            // 3. Determine items to render
            const items = Array.isArray(voucher.lineItems) ? voucher.lineItems.filter(i => i) : [];

            if (items.length > 0) {
                // CASE A: voucher has lineItems → render each one
                items.forEach(item => {
                    this.addLineItem();
                    const allRows = lineItemsBody.querySelectorAll('tr');
                    const lastRow = allRows[allRows.length - 1];
                    if (!lastRow) return;

                    const accountSelect = lastRow.querySelector('.line-account');
                    if (accountSelect) {
                        accountSelect.value = item.accountCode || '';
                    }

                    const descInput = lastRow.querySelector('.line-description');
                    if (descInput) {
                        descInput.value = item.description || '';
                    }

                    const amtInput = lastRow.querySelector('.line-amount');
                    if (amtInput) {
                        amtInput.value = item.amount != null ? item.amount : 0;
                        // Trigger oninput so calculateTotal fires
                        amtInput.dispatchEvent(new Event('change'));
                    }
                });
            } else {
                // CASE B: old voucher without lineItems → pre-fill from amount + purpose
                this.addLineItem();
                const allRows = lineItemsBody.querySelectorAll('tr');
                if (allRows.length > 0) {
                    const firstRow = allRows[0];
                    const descInput = firstRow.querySelector('.line-description');
                    if (descInput) {
                        descInput.value = voucher.purpose || '';
                    }
                    const amtInput = firstRow.querySelector('.line-amount');
                    if (amtInput) {
                        amtInput.value = voucher.amount || 0;
                        amtInput.dispatchEvent(new Event('change'));
                    }
                }
            }

            // 4. Always recalculate total after populating
            this.calculateTotal();
        }

        // Adjust modal buttons based on status
        const btnSubmit = document.getElementById('btn-submit-voucher');
        const btnDraft = document.getElementById('btn-draft-voucher');
        if (btnSubmit) {
            if (voucher.status !== 'draft') {
                btnSubmit.textContent = 'Save Changes';
                btnSubmit.classList.remove('btn-primary');
                btnSubmit.classList.add('btn-success');
                if (btnDraft) btnDraft.style.display = 'none';
            } else {
                btnSubmit.textContent = 'Submit for Verification';
                btnSubmit.classList.remove('btn-success');
                btnSubmit.classList.add('btn-primary');
                if (btnDraft) btnDraft.style.display = 'inline-block';
            }
        }

        modal.classList.remove('hidden');
    },

    showViewModal(voucherId) {
        const voucher = this.getVoucher(voucherId);
        if (!voucher) return;

        const content = document.getElementById('view-voucher-content');
        content.innerHTML = `
            ${voucher.habitAnomaly ? `
                <div style="background: rgba(245, 158, 11, 0.15); border: 1px solid var(--color-warning); padding: 12px; border-radius: 6px; margin-bottom: 1.5rem; display: flex; gap: 8px; align-items: flex-start; color: #f59e0b;">
                    <div style="font-size: 1.25rem;">⚠️</div>
                    <div>
                        <strong style="display: block; margin-bottom: 4px; color: #f59e0b;">Peringatan Pengeluaran Tidak Biasa (Frequency Anomaly)</strong>
                        <span style="font-size: 13px; line-height: 1.4; color: var(--text-primary);">${voucher.habitAnomaly.message}</span>
                    </div>
                </div>
            ` : ''}
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
                    <label class="form-label">Amount</label>
                    <p><strong>${this.formatCurrency(voucher.amount)}</strong></p>
                </div>
                <div>
                    <label class="form-label">Pay To</label>
                    <p>${voucher.payTo}</p>
                </div>
                <div>
                    <label class="form-label">Status</label>
                    <p><span class="badge ${this.getStatusBadgeClass(voucher.status)}">${this.getStatusLabel(voucher.status)}</span></p>
                </div>
            </div>

            <div class="form-group">
                <label class="form-label">Purpose</label>
                <p>${voucher.purpose}</p>
            </div>

            <!-- NEW: Display Line Items if exists -->
            ${voucher.lineItems && voucher.lineItems.length > 0 ? `
                <div class="form-group" style="border: 1px solid var(--color-gray-800); border-radius: 8px; padding: 16px; background: var(--bg-tertiary);">
                    <label class="form-label" style="margin-bottom: 12px;">Expense Line Items</label>
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
            ` : ''}

            ${voucher.approvalHistory.length > 0 ? `
                <div class="form-group">
                    <label class="form-label">Approval History</label>
                    <div class="table-container">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Role</th>
                                    <th>Action</th>
                                    <th>By</th>
                                    <th>Date</th>
                                    <th>Notes</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${voucher.approvalHistory.map(h => `
                                    <tr>
                                        <td>${h.role}</td>
                                        <td><span class="badge ${h.action === 'approved' ? 'badge-success' : 'badge-danger'}">${h.action}</span></td>
                                        <td>${h.userName}</td>
                                        <td>${this.formatDate(h.timestamp)}</td>
                                        <td>${h.notes || '-'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            ` : ''}

            ${voucher.modificationHistory && voucher.modificationHistory.length > 0 ? `
                <div class="form-group" style="margin-top: 2rem;">
                    <label class="form-label">📝 Modification History</label>
                    <div class="table-container">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Date/Time</th>
                                    <th>Action</th>
                                    <th>By</th>
                                    <th>Changes</th>
                                    <th>Reason</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${voucher.modificationHistory.map(h => {
            let changesHtml = '-';
            if (h.changes && Object.keys(h.changes).length > 0) {
                changesHtml = Object.entries(h.changes).map(([field, change]) => {
                    let oldVal = change.old;
                    let newVal = change.new;

                    // Format currency fields
                    if (field === 'amount') {
                        oldVal = this.formatCurrency(change.old);
                        newVal = this.formatCurrency(change.new);
                    }

                    return `<div style="margin-bottom: 0.25rem;"><strong>${field}:</strong> ${oldVal} → ${newVal}</div>`;
                }).join('');
            }

            const actionBadge = h.action === 'EDIT' ? 'badge-info' : h.action === 'VOID' ? 'badge-danger' : 'badge-secondary';

            return `
                                        <tr>
                                            <td>${this.formatDate(h.timestamp)}</td>
                                            <td><span class="badge ${actionBadge}">${h.action}</span></td>
                                            <td>${h.userName || 'Unknown'}<br><small>${h.userRole || ''}</small></td>
                                            <td>${changesHtml}</td>
                                            <td>${h.reason || '-'}</td>
                                        </tr>
                                    `;
        }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            ` : ''}

            ${voucher.status === 'VOIDED' && voucher.voidReason ? `
                <div style="padding: 1rem; background: var(--danger-bg, #f8d7da); border: 1px solid var(--danger, #dc3545); border-radius: 4px; margin-top: 1rem;">
                    <strong>⚠️ Voided:</strong> ${voucher.voidReason}<br>
                    <small>Voided by ${voucher.voidedByName || 'Unknown'} on ${this.formatDate(voucher.voidedAt)}</small>
                </div>
            ` : ''}
        `;

        document.getElementById('view-voucher-modal').classList.remove('hidden');
    },

    closeViewModal() {
        document.getElementById('view-voucher-modal').classList.add('hidden');
    },

    async saveAsDraft() {
        const btnSubmit = document.getElementById('btn-submit-voucher');
        const btnDraft = document.getElementById('btn-draft-voucher');
        const originalDraftText = btnDraft ? btnDraft.textContent : '';

        if (btnSubmit) { btnSubmit.disabled = true; }
        if (btnDraft) { btnDraft.disabled = true; btnDraft.textContent = '⏳ Saving...'; }

        try {
            const formData = this.getFormData();
            if (!formData) return;

            const data = {
                ...formData,
                status: 'draft'
            };

            // Check habit anomaly before saving draft
            const habitAnomaly = this.detectHabitAnomaly(data, this.vouchers);
            if (habitAnomaly) {
                const confirmed = confirm(`⚠️ ANOMALI FREKUENSI PENGELUARAN DETECTED\n\n${habitAnomaly.message}\n\nApakah Anda yakin ingin menyimpan draft ini?`);
                if (!confirmed) {
                    if (btnSubmit) { btnSubmit.disabled = false; }
                    if (btnDraft) { btnDraft.disabled = false; btnDraft.textContent = originalDraftText; }
                    return;
                }
            }

            let result;
            if (this._editMode && this._editingId) {
                result = await this.updateVoucher(this._editingId, data);
            } else {
                result = await this.createVoucher(data);
            }

            if (result.success) {
                if (result.cloudSyncFailed) {
                    alert('✅ Draft tersimpan di komputer ini.\n\n⚠️ PERHATIAN: Data sedang dalam antrian sinkronisasi ke Cloud. Jangan tutup browser ini sampai banner merah di atas hilang.');
                } else {
                    alert('Draft saved successfully!');
                }
                this.closeCreateModal();
                this.render();
            } else {
                alert('Error: ' + JSON.stringify(result.errors));
            }
        } catch (error) {
            console.error('Draft voucher error:', error);
            alert('Terjadi kesalahan saat menyimpan draft: ' + error.message);
        } finally {
            if (btnSubmit) { btnSubmit.disabled = false; }
            if (btnDraft) { btnDraft.disabled = false; btnDraft.textContent = originalDraftText; }
        }
    },

    async submitForVerification() {
        if (!this.validateDataIntegrity()) return;

        const btnSubmit = document.getElementById('btn-submit-voucher');
        const btnDraft = document.getElementById('btn-draft-voucher');
        const originalSubmitText = btnSubmit ? btnSubmit.textContent : '';

        if (btnSubmit) { btnSubmit.disabled = true; btnSubmit.textContent = '⏳ Submitting...'; }
        if (btnDraft) { btnDraft.disabled = true; }

        try {
            const formData = this.getFormData();
            if (!formData) return;

            const data = {
                ...formData,
                status: 'verified'  // Changed from pending_verification - go straight to verified for approval
            };

            // Check habit anomaly before submitting
            const habitAnomaly = this.detectHabitAnomaly(data, this.vouchers);
            if (habitAnomaly) {
                const confirmed = confirm(`⚠️ ANOMALI FREKUENSI PENGELUARAN DETECTED\n\n${habitAnomaly.message}\n\nApakah Anda yakin ingin melanjutkan pengiriman voucher ini?`);
                if (!confirmed) {
                    if (btnSubmit) { btnSubmit.disabled = false; btnSubmit.textContent = originalSubmitText; }
                    if (btnDraft) { btnDraft.disabled = false; }
                    return;
                }
            }

            if (data.paymentCategory === 'supplier') {
                const docs = data.documents;
                if (!docs.poNumber || !docs.sjNumber || !docs.invoiceNumber) {
                    alert('Supplier payments require PO, SJ, and Invoice numbers');
                    return;
                }
            }

            let result;
            if (this._editMode && this._editingId) {
                result = await this.updateVoucher(this._editingId, data);
            } else {
                result = await this.createVoucher(data);
            }

            if (result.success) {
                if (result.cloudSyncFailed) {
                    alert(`✅ Voucher ${this._editMode ? 'diperbarui' : 'dibuat'} dan disimpan di komputer ini.\n\n⚠️ PERHATIAN: Sinkronisasi ke Cloud GAGAL. Data ada di antrian dan akan dicoba ulang otomatis. Jangan tutup browser ini sampai banner merah di atas hilang.`);
                } else {
                    alert(`✅ Voucher ${this._editMode ? 'updated' : 'created'} and submitted for verification!`);
                }
                this.closeCreateModal();
                this.render();
            } else {
                alert('Error: ' + JSON.stringify(result.errors));
            }
        } catch (error) {
            console.error('Submit voucher error:', error);
            alert('Terjadi kesalahan saat mengirim voucher: ' + error.message);
        } finally {
            if (btnSubmit) { btnSubmit.disabled = false; btnSubmit.textContent = originalSubmitText; }
            if (btnDraft) { btnDraft.disabled = false; }
        }
    },

    async updateVoucher(id, data) {
        const index = this.vouchers.findIndex(v => v.id === id);
        if (index === -1) return { success: false, errors: { voucher: 'Voucher not found' } };

        const oldVoucher = this.vouchers[index];

        // Check permission to edit
        const permission = this.canUserEdit(oldVoucher);
        if (!permission.allowed) {
            return { success: false, errors: { permission: permission.reason } };
        }

        const currentUser = Auth.getCurrentUser();

        // Track field changes for modification history
        const changes = {};
        const fieldsToTrack = ['amount', 'payTo', 'purpose', 'date', 'paymentMethod', 'paymentCategory', 'bankAccountId'];

        fieldsToTrack.forEach(field => {
            if (data[field] !== undefined && oldVoucher[field] !== data[field]) {
                changes[field] = {
                    old: oldVoucher[field],
                    new: data[field]
                };
            }
        });

        // Update the voucher
        this.vouchers[index] = {
            ...oldVoucher,
            ...data,
            cashBankAccount: data.type === 'BKK' ? '11101' : data.bankAccountId,
            updatedAt: new Date().toISOString(),
            updatedBy: currentUser.id,
            updatedByName: currentUser.name
        };

        // NEW: Recalculate totalAmount to prevent debit/credit imbalance after edit
        if (this.vouchers[index].lineItems && this.vouchers[index].lineItems.length > 0) {
            const sum = this.vouchers[index].lineItems.reduce((acc, item) => acc + parseFloat(item.amount || 0), 0);
            this.vouchers[index].totalAmount = sum;
            this.vouchers[index].amount = sum;
        } else if (this.vouchers[index].amount) {
            this.vouchers[index].totalAmount = parseFloat(this.vouchers[index].amount);
        }

        // Initialize modification history if it doesn't exist
        if (!this.vouchers[index].modificationHistory) {
            this.vouchers[index].modificationHistory = [];
        }

        // Add to modification history if there were changes
        if (Object.keys(changes).length > 0) {
            this.vouchers[index].modificationHistory.push({
                timestamp: new Date().toISOString(),
                userId: currentUser.id,
                userName: currentUser.name,
                userRole: currentUser.role,
                action: 'EDIT',
                changes: changes,
                reason: data.editReason || 'Updated by user'
            });
        }

        // Detect habit anomalies after edit
        const habitAnomaly = this.detectHabitAnomaly(this.vouchers[index], this.vouchers);
        if (habitAnomaly) {
            this.vouchers[index].habitAnomaly = habitAnomaly;
        } else {
            delete this.vouchers[index].habitAnomaly;
        }

        await this.saveVouchers();

        AuditLog.log('update', 'payment_voucher', id,
            `Updated ${this.vouchers[index].type} ${this.vouchers[index].voucherNumber}`);

        return { success: true, voucher: this.vouchers[index] };
    },

    showVerifyModal(voucherId) {
        if (confirm('Verify this voucher as complete and ready for approval?')) {
            const result = this.verifyDocuments(voucherId);
            if (result.success) {
                alert('Voucher verified successfully!');
                this.render();
            } else {
                alert('Error: ' + (result.errors.documents || result.errors.permission || 'Unknown error'));
            }
        }
    },

    async showApproveModal(voucherId) {
        const notes = prompt('Enter approval notes (optional):');
        if (notes !== null) {
            // OPTIONAL: Show a "Processing" overlay if possible, or just change cursor
            document.body.style.cursor = 'wait';

            try {
                const result = await this.approveVoucher(voucherId, true, notes);
                if (result.success) {
                    alert('Voucher approved successfully!');
                    this.render();
                } else {
                    alert('Error: ' + (result.errors.limit || result.errors.permission || result.errors.status || 'Unknown error'));
                }
            } catch (e) {
                console.error(e);
                alert('Approval failed: ' + e.message);
            } finally {
                document.body.style.cursor = 'default';
            }
        }
    },

    async showIssuePaymentModal(voucherId) {
        if (confirm('Issue payment for this voucher?')) {
            const result = await this.issuePayment(voucherId, {});
            if (result.success) {
                alert('Payment issued successfully!');
                this.render();
            } else {
                alert('Error: ' + (result.errors?.approval || 'Unknown error'));
            }
        }
    },

    async confirmPostToJournal(voucherId) {
        if (confirm('Post this voucher to journal? This action cannot be undone.')) {
            const result = await this.postToJournal(voucherId);
            if (result.success) {
                alert('Voucher posted to journal successfully!');
                this.render();
            } else {
                alert('Error: ' + (result.errors.status || 'Unknown error'));
            }
        }
    },

    async confirmDelete(voucherId) {
        const voucher = this.getVoucher(voucherId);
        if (!voucher) return;

        if (confirm(`Are you sure you want to delete voucher ${voucher.voucherNumber}?\n\nThis action cannot be undone.`)) {
            const result = await this.deleteVoucher(voucherId);
            if (result.success) {
                alert('Voucher deleted successfully!');
                this.render();
            } else {
                alert('Error: ' + (result.errors?.status || result.errors?.permission || 'Unknown error'));
            }
        }
    },

    showVoidModal(voucherId) {
        const voucher = this.getVoucher(voucherId);
        if (!voucher) return;

        const permission = this.canUserVoid(voucher);
        if (!permission.allowed) {
            alert(`Cannot void: ${permission.reason}`);
            return;
        }

        this._voidingId = voucherId;

        // Populate voucher details
        const detailsHtml = `
            <div style="background: var(--bg-secondary); padding: 1rem; border-radius: 4px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                    <div><strong>Voucher Number:</strong></div>
                    <div>${voucher.voucherNumber}</div>
                    <div><strong>Type:</strong></div>
                    <div>${voucher.type}</div>
                    <div><strong>Amount:</strong></div>
                    <div>${this.formatCurrency(voucher.amount)}</div>
                    <div><strong>Pay To:</strong></div>
                    <div>${voucher.payTo}</div>
                    <div><strong>Current Status:</strong></div>
                    <div><span class="badge ${this.getStatusBadgeClass(voucher.status)}">${this.getStatusLabel(voucher.status)}</span></div>
                </div>
            </div>
        `;
        document.getElementById('void-voucher-details').innerHTML = detailsHtml;
        document.getElementById('void-reason').value = '';

        document.getElementById('void-voucher-modal').classList.remove('hidden');
    },

    closeVoidModal() {
        document.getElementById('void-voucher-modal').classList.add('hidden');
        this._voidingId = null;
    },

    async confirmVoid() {
        if (!this._voidingId) return;

        const reason = document.getElementById('void-reason').value.trim();

        if (!reason) {
            alert('Please provide a reason for voiding this voucher.');
            document.getElementById('void-reason').focus();
            return;
        }

        if (reason.length < 10) {
            alert('Please provide a more detailed reason (at least 10 characters).');
            document.getElementById('void-reason').focus();
            return;
        }

        try {
            const result = await this.voidVoucher(this._voidingId, reason);

            if (result.success) {
                alert(`Voucher ${result.voucher.voucherNumber} has been voided successfully.`);
                this.closeVoidModal();
                this.render();
            } else {
                alert('Error: ' + (result.errors?.permission || result.errors?.reason || result.errors?.voucher || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error voiding voucher:', error);
            alert('An unexpected error occurred while voiding the voucher.');
        }
    },

    // Utility function to fix existing vouchers with missing autoPostJournal flag
    fixExistingVouchers() {
        let fixed = 0;
        this.vouchers.forEach(voucher => {
            if (voucher.autoPostJournal === undefined || voucher.autoPostJournal === null) {
                voucher.autoPostJournal = true;
                fixed++;
            }
        });
        if (fixed > 0) {
            this.saveVouchers();
            console.log(`✅ Fixed ${fixed} vouchers with missing autoPostJournal flag`);
            AuditLog.log('system', 'payment_voucher', null, `Fixed ${fixed} vouchers with missing autoPostJournal flag`);
        }
        return { success: true, fixed };
    }
};


// Explicitly make PaymentVoucher globally available
if (typeof window !== 'undefined') {
    window.PaymentVoucher = PaymentVoucher;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PaymentVoucher;
}
