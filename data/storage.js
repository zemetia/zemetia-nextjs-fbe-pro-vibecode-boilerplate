// ==========================================
// Mini ERP - Data Storage Management
// LocalStorage wrapper with validation
// ==========================================

const Storage = {
    // ☁️ CLOUD-FIRST ARCHITECTURE (FORCED ON)
    // Pay-as-you-go Firebase enabled. localStorage is used only as a cache.
    USE_CLOUD_STORAGE: true,

    // ==========================================
    // 🔁 SYNC GUARD — Auto-Retry + Banner System
    // Prevents silent data loss when cloud sync fails
    // ==========================================
    SyncGuard: {
        _queue: {},          // { key: value } pairs pending retry
        _retryTimer: null,   // setInterval handle
        _retryCount: {},     // { key: number of attempts }
        MAX_RETRIES: 10,     // give up after 10 attempts (~5 min)
        RETRY_INTERVAL_MS: 30000, // retry every 30 seconds

        // Add a failed key+value to the retry queue
        add(key, value, silent = false) {
            this._queue[key] = value;
            this._retryCount[key] = (this._retryCount[key] || 0);
            if (!silent) this._updateBanner();
            this._startTimer();
        },

        // Remove a successfully synced key from queue
        remove(key) {
            delete this._queue[key];
            delete this._retryCount[key];
            this._updateBanner();
            if (Object.keys(this._queue).length === 0) {
                this._stopTimer();
            }
        },

        // Count how many items are pending sync
        pendingCount() {
            return Object.keys(this._queue).length;
        },

        // Start the background retry timer
        _startTimer() {
            if (this._retryTimer) return; // already running
            this._retryTimer = setInterval(() => this._retryAll(), this.RETRY_INTERVAL_MS);
            console.log('🔁 [SyncGuard] Retry timer started (every 30s).');
        },

        // Stop the retry timer when queue is empty
        _stopTimer() {
            if (this._retryTimer) {
                clearInterval(this._retryTimer);
                this._retryTimer = null;
                console.log('✅ [SyncGuard] All items synced. Retry timer stopped.');
            }
        },

        // Attempt to re-sync all queued items
        async _retryAll(isManual = false) {
            const keys = Object.keys(this._queue);
            if (keys.length === 0) { this._stopTimer(); return; }

            if (isManual) {
                console.log('🔄 [SyncGuard] Manual retry triggered. Resetting attempt limits.');
            }

            console.log(`🔁 [SyncGuard] Retrying ${keys.length} pending item(s)...`);
            for (const key of keys) {
                // If manual retry, reset the counter to 0 before incrementing
                if (isManual) this._retryCount[key] = 0;

                this._retryCount[key] = (this._retryCount[key] || 0) + 1;
                if (this._retryCount[key] > this.MAX_RETRIES) {
                    console.error(`❌ [SyncGuard] Gave up on '${key}' after ${this.MAX_RETRIES} retries.`);
                    continue;
                }
                try {
                    const success = await Storage.CloudStorage.save(key, this._queue[key]);
                    if (success) {
                        console.log(`✅ [SyncGuard] Retry succeeded for '${key}'.`);
                        this.remove(key);
                    }
                } catch (e) {
                    console.warn(`⚠️ [SyncGuard] Retry failed for '${key}':`, e.message);
                }
            }
            this._updateBanner();
        },

        // Show/hide/update the persistent warning banner
        _updateBanner() {
            // 🛡️ SAFETY BYPASS (HONEYPOT)
            // Never show the sync warning banner in safety mode
            const sessionStr = localStorage.getItem('erp_current_session');
            if (sessionStr && sessionStr.includes('GUEST_SAFETY')) {
                const existing = document.getElementById('sync-guard-banner');
                if (existing) existing.remove();
                return;
            }

            const count = this.pendingCount();
            let banner = document.getElementById('sync-guard-banner');

            if (count === 0) {
                if (banner) {
                    banner.style.transition = 'transform 0.4s ease, opacity 0.4s ease';
                    banner.style.transform = 'translateY(-100%)';
                    banner.style.opacity = '0';
                    setTimeout(() => banner && banner.remove(), 400);
                }
                return;
            }

            if (!banner) {
                banner = document.createElement('div');
                banner.id = 'sync-guard-banner';
                banner.style.cssText = [
                    'position: fixed',
                    'top: 0',
                    'left: 0',
                    'right: 0',
                    'z-index: 99999',
                    'background: linear-gradient(135deg, #c0392b, #e74c3c)',
                    'color: white',
                    'padding: 10px 20px',
                    'display: flex',
                    'align-items: center',
                    'justify-content: space-between',
                    'box-shadow: 0 3px 15px rgba(192,57,43,0.5)',
                    'font-family: sans-serif',
                    'font-size: 14px',
                    'animation: syncBannerPulse 2s infinite'
                ].join('; ');

                // Add pulse animation style if not present
                if (!document.getElementById('sync-guard-style')) {
                    const style = document.createElement('style');
                    style.id = 'sync-guard-style';
                    style.textContent = `
                        @keyframes syncBannerPulse {
                            0%, 100% { box-shadow: 0 3px 15px rgba(192,57,43,0.5); }
                            50% { box-shadow: 0 3px 25px rgba(231,76,60,0.9); }
                        }
                    `;
                    document.head.appendChild(style);
                }

                document.body.prepend(banner);
            }

            const nextRetryIn = Math.ceil(this.RETRY_INTERVAL_MS / 1000);
            banner.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-size:20px;">⚠️</span>
                    <div>
                        <strong>DATA BELUM TERSINKRONISASI KE CLOUD!</strong><br>
                        <span style="font-size:12px; opacity:0.9;">${count} kumpulan data belum berhasil dikirim ke server. Sistem akan mencoba lagi secara otomatis. Jangan tutup browser ini.</span>
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:12px; flex-shrink:0;">
                    <button onclick="Storage.SyncGuard._retryAll(true)" style="background:white; color:#c0392b; border:none; padding:6px 14px; border-radius:6px; cursor:pointer; font-weight:bold; font-size:13px;">🔄 Coba Sekarang</button>
                </div>
            `;
        }
    },

    KEYS: {
        CHART_OF_ACCOUNTS: 'erp_chart_of_accounts',
        JOURNAL_ENTRIES: 'erp_journal_entries',
        CONFIG: 'erp_config',
        TRANSACTION_COUNTERS: 'erp_transaction_counters',
        SUPPLIERS: 'erp_suppliers',
        CUSTOMERS: 'erp_customers',
        WAREHOUSES: 'erp_warehouses',
        ITEMS: 'erp_items',
        TAXES: 'erp_taxes',
        BANK_ACCOUNTS: 'erp_bank_accounts',
        PAYMENT_TERMS: 'erp_payment_terms',
        DEPARTMENTS: 'erp_departments',
        USERS: 'erp_users',
        ROLES: 'erp_roles',
        EMPLOYEES: 'erp_employees',
        ATTENDANCE: 'erp_attendance',
        PAYROLL: 'erp_payroll',
        ACCOUNT_MAPPING: 'erp_account_mapping',
        APPROVAL_LIMITS: 'erp_approval_limits',
        PAYMENT_VOUCHERS: 'payment_vouchers',
        RECEIPT_VOUCHERS: 'receipt_vouchers',
        PURCHASE_REQUISITIONS: 'purchase_requisitions',
        PRODUCTION_BATCHES: 'erp_production_batches',
        PRODUCTION_DETAILS: 'production_details',
        PACKAGING: 'packaging',
        SERIALIZED_ITEMS: 'serialized_items',
        DELETED_IDS: 'erp_deleted_ids',
        DELETED_RECORDS: 'deleted_records',
        BUG_REPORTS: 'erp_bug_reports',
        OVERTIME_SETTINGS: 'erp_overtime_settings',
        PRODUCTION_LOGS: 'erp_production_logs',
        PURCHASE_ORDERS: 'erp_purchase_orders',
        GOODS_RECEIPTS: 'goods_receipts',
        GOLD_DUST_RECOVERY: 'gold_dust_recovery',
        GOLD_TRANSACTIONS: 'gold_transactions',
        DIRECT_SWAPS: 'direct_swaps',
        SALES_ORDERS: 'erp_sales_orders',
        QUOTATIONS: 'erp_quotations',
        TTB_DOCUMENTS: 'ttb_documents',
        SUPPLIER_INVOICES: 'supplier_invoices',
        FIXED_ASSETS: 'erp_fixed_assets',
        KYC_RECORDS: 'kyc_records',
        CHECKS_GIRO: 'checks_giro',
        PAYMENT_SCHEDULES: 'payment_schedules',
        AUDIT_LOG: 'erp_audit_log',
        LAB_TESTS: 'lab_tests',
        SUPPLIER_RETURNS: 'supplier_returns',
        MASTER_SHIFTS: 'erp_master_shifts',
        WORK_CALENDAR: 'erp_work_calendar',
        STOCK_CARDS: 'stock_cards',
        PRODUCTION_ORDERS: 'erp_production_orders',
        WAREHOUSE_STOCK: 'erp_warehouse_stock',
        WAREHOUSE_STOCK_MOVEMENTS: 'erp_warehouse_stock_movements',
        HOLIDAYS: 'erp_holidays',
        JOB_ORDERS: 'erp_job_orders',
        CRM_PROSPECTS: 'crm_prospects',
        CRM_VISITS: 'crm_visits',
        CRM_SALES_TARGETS: 'crm_sales_targets',
        MASTER_PURITY_GRADES: 'erp_master_purity_grades',
        MASTER_REFINING_RULES: 'erp_master_refining_rules',
        AUTO_PURCHASE_REQUISITIONS: 'auto_purchase_requisitions',
        BOMS: 'BOMS',
        ELECTROLYSIS_LOGS: 'ELECTROLYSIS_LOGS',
        QC_LOGS: 'QC_LOGS',
        LEAVE_REQUESTS: 'LEAVE_REQUESTS',
        LEAVE_BALANCES: 'LEAVE_BALANCES',
        SETTINGS: 'erp_settings',
        SYSTEM_SETTINGS: 'erp_system_settings',
        REORDER_SETTINGS: 'reorder_settings',
        PAYROLL_WORKDAYS: 'erp_payroll_workdays',
        PAYROLL_WORKDAYS_AUDIT: 'erp_payroll_workdays_audit',
        PAYROLL_PERIODS: 'erp_payroll_periods',
        HOLIDAYS_WORKED: 'erp_holidays_worked'
    },

    // ☁️ ATOMIC CLOUD SEQUENCER
    // Prevents duplicate IDs (JRN-001, S-001) by using Firestore transactions.
    CloudSequencer: {
        async getNextID(type) {
            if (typeof window.db === 'undefined' || typeof window.firestore === 'undefined') {
                console.warn('⚠️ Cloud Sequencer unavailable. Falling back to Local Counter.');
                return null; // Signals fallback to caller
            }

            const { doc, runTransaction, serverTimestamp } = window.firestore;
            const db = window.db;
            const counterRef = doc(db, 'transactionCounters', 'counters');

            try {
                const nextId = await runTransaction(db, async (transaction) => {
                    const counterDoc = await transaction.get(counterRef);
                    if (!counterDoc.exists()) {
                        const initialData = { [type]: 1, updatedAt: serverTimestamp() };
                        transaction.set(counterRef, initialData);
                        return 1;
                    }

                    const data = counterDoc.data();
                    const newCount = (data[type] || 0) + 1;

                    transaction.update(counterRef, {
                        [type]: newCount,
                        updatedAt: serverTimestamp()
                    });

                    return newCount;
                });

                console.log(`📡 [CloudSequencer] Atomic ID for ${type}: ${nextId}`);
                return nextId;
            } catch (error) {
                console.error('❌ [CloudSequencer] Transaction failed:', error);
                return null;
            }
        }
    },

    // ☁️ INTERNAL ADAPTER: Cloud Storage Logic
    CloudStorage: {
        lastErrorCode: null,

        // ─── Strip undefined values recursively (Firestore rejects undefined) ─────────
        deepStripUndefined(obj) {
            if (Array.isArray(obj)) return obj.map(v => this.deepStripUndefined(v));
            if (obj !== null && typeof obj === 'object') {
                return Object.fromEntries(
                    Object.entries(obj)
                        .filter(([, v]) => v !== undefined)
                        .map(([k, v]) => [k, this.deepStripUndefined(v)])
                );
            }
            return obj;
        },

        async save(key, data) {
            this.lastErrorCode = null;

            if (typeof window.db === 'undefined' || typeof window.firestore === 'undefined') {
                console.warn('⚠️ Cloud Storage unavailable (Offline/No Init). Saving locally only.');
                this.lastErrorCode = 'cloud-unavailable';
                return false;
            }

            // Map key to collection name (reusing sync logic)
            const collectionName = (window.FirebaseSync && window.FirebaseSync.COLLECTION_MAP[key]) || key;
            const { doc, setDoc, writeBatch, collection } = window.firestore;
            const db = window.db;

            try {
                // Show Global Loading Spinner if available
                if (window.showLoading) window.showLoading(`Saving to Cloud...`);

                if (Array.isArray(data)) {
                    // Optimized Batch Write
                    // We only write the CHANGED items if possible, but for now we write all to be safe 
                    // (To minimize complexity of diffing in this phase)
                    // TODO: Optimization Phase - Only write dirty records

                    const batchSize = 240; // Max 500 ops per batch, we do 2 ops per item
                    let batch = writeBatch(db);
                    let count = 0;

                    // Reversed loop for Journal Entries (Newest First) -> Priority
                    // For others, normal loop
                    const items = data;

                    for (const item of items) {
                        // 🛡️ Safety guard against null/undefined in arrays
                        if (item === null || item === undefined) continue;

                        const docId = (typeof item === 'object')
                            ? String(item.id || item.code || item.reference || '').replace(/\//g, '_')
                            : String(item).replace(/\//g, '_');

                        if (!docId || docId === 'undefined') continue;

                        const docRef = doc(db, collectionName, docId);
                        
                        // Format payload appropriately based on type
                        // 🛡️ deepStripUndefined: Firestore rejects `undefined` field values
                        let payload = (typeof item === 'object') ? { ...item } : { value: item };
                        payload._syncedAt = new Date().toISOString();
                        payload = this.deepStripUndefined(payload);

                        batch.set(docRef, payload, { merge: true });

                        // ── Fix: Remove tombstone if we are actively saving this ID ──
                        const tombstoneRef = doc(db, 'deletedRecords', `${collectionName}_${docId}`);
                        batch.delete(tombstoneRef);

                        // ── Untrack local deletion ──
                        if (window.Storage && typeof window.Storage.untrackDeletion === 'function') {
                            window.Storage.untrackDeletion(docId);
                        }

                        if (collectionName === 'paymentVouchers') {
                            console.log(`🔥 [DIAGNOSTIC] Synced to Cloud: PV ${docId} / ${item.voucherNumber} (Amount: ${item.amount})`);
                        }

                        count += 2; // Two operations: set and delete
                        if (count >= batchSize) {
                            await batch.commit();
                            batch = writeBatch(db);
                            count = 0;
                        }
                    }

                    if (count > 0) await batch.commit();

                } else {
                    // Single Object — strip undefined before writing
                    const docId = key === Storage.KEYS.CONFIG ? 'config' : key;
                    const singlePayload = this.deepStripUndefined({
                        value: data,
                        _syncedAt: new Date().toISOString()
                    });
                    
                    let batch = writeBatch(db);
                    batch.set(doc(db, collectionName, docId), singlePayload);
                    
                    // Remove tombstone just in case
                    const tombstoneRef = doc(db, 'deletedRecords', `${collectionName}_${docId}`);
                    batch.delete(tombstoneRef);
                    if (window.Storage && typeof window.Storage.untrackDeletion === 'function') {
                        window.Storage.untrackDeletion(docId);
                    }
                    
                    await batch.commit();
                }

                if (window.hideLoading) window.hideLoading();
                console.log(`☁️ [CloudStorage] Saved ${key} to Firestore.`);
                return true;

            } catch (error) {
                console.error(`❌ [CloudStorage] Failed to save ${key}:`, error);
                if (window.hideLoading) window.hideLoading();

                // Check for specific error types
                const isQuotaError = error.code === 'resource-exhausted' ||
                    (error.message && error.message.includes('Quota exceeded'));
                const isPermissionError = error.code === 'permission-denied' ||
                    (error.message && error.message.includes('Permission denied'));

                if (isQuotaError) {
                    console.warn('⚠️ Firestore Quota Exceeded. Data is saved locally but not to Cloud.');
                    this.lastErrorCode = 'quota-exceeded';
                    if (window.showToast) {
                        window.showToast('Cloud Storage Penuh (Quota)! Data tersimpan di komputer ini saja.', 'warning');
                    }
                    return false;
                }

                if (isPermissionError) {
                    console.error('🛑 Firestore Permission Denied. Check Security Rules.');
                    this.lastErrorCode = 'permission-denied';
                    
                    // 🛡️ SAFETY BYPASS (HONEYPOT)
                    // If GUEST_SAFETY, do NOT show any alert. Just keep it quiet.
                    const sessionStr = localStorage.getItem('erp_current_session');
                    const isSafety = sessionStr && sessionStr.includes('GUEST_SAFETY');
                    const canWriteThisKey = Storage.canCurrentUserWriteKey(key);
                    
                    if (!isSafety && canWriteThisKey) {
                        if (window.showToast) {
                            window.showToast('Izin simpan Cloud ditolak! Hubungi Admin.', 'error');
                        }
                    } else {
                        console.log('🔇 Silencing permission alert for safety/read-only role.');
                    }
                    return false; // Don't crash the UI, let it save locally
                }

                // Show User Notification for other errors (Non-Blocking)
                if (window.showToast) {
                    window.showToast('Gagal sinkron Cloud! Data tersimpan lokal & masuk antrian sinkron.', 'warning');
                } else {
                    console.warn(`☁️ [CloudStorage] Failed to save ${key}. Data is safe in localStorage.`, error);
                }

                return false;
            }
        }
    },

    getCurrentUserRole() {
        const authModule = window.FirebaseAuth || window.Auth || (typeof Auth !== 'undefined' ? Auth : null);
        const user = authModule?.getCurrentUser?.();
        return String(user?.role || '').toUpperCase();
    },

    getPayrollSecurityRoles() {
        return ['ADMIN', 'DIRECTOR', 'DIREKTUR', 'OWNER', 'HR', 'HRD', 'HRD_MANAGER', 'MANAGER_FINANCE'];
    },

    isPayrollSecurityKey(key) {
        return [this.KEYS.PAYROLL, this.KEYS.EMPLOYEES].includes(key);
    },

    canCurrentUserReadKey(key) {
        if (!this.isPayrollSecurityKey(key)) return true;
        return this.getPayrollSecurityRoles().includes(this.getCurrentUserRole());
    },

    canCurrentUserWriteKey(key) {
        const role = this.getCurrentUserRole();
        const adminRoles = ['ADMIN', 'DIRECTOR', 'DIREKTUR', 'OWNER'];
        const roleAllowed = (roles) => adminRoles.includes(role) || roles.includes(role);

        const writeRules = {
            [this.KEYS.CHART_OF_ACCOUNTS]: ['MANAGER_FINANCE', 'FINANCE'],
            [this.KEYS.ACCOUNT_MAPPING]: ['MANAGER_FINANCE', 'FINANCE'],
            [this.KEYS.SUPPLIERS]: ['MANAGER_FINANCE', 'PURCHASING_HEAD'],
            [this.KEYS.BANK_ACCOUNTS]: ['MANAGER_FINANCE'],
            [this.KEYS.CUSTOMERS]: ['MANAGER_FINANCE'],
            [this.KEYS.WAREHOUSES]: [],
            [this.KEYS.TAXES]: ['MANAGER_FINANCE'],
            [this.KEYS.PAYMENT_TERMS]: [],
            [this.KEYS.DEPARTMENTS]: [],
            [this.KEYS.EMPLOYEES]: ['HR', 'HRD', 'HRD_MANAGER'],
            [this.KEYS.PAYROLL]: ['HR', 'HRD', 'HRD_MANAGER']
        };

        if (!Object.prototype.hasOwnProperty.call(writeRules, key)) return true;
        return roleAllowed(writeRules[key]);
    },

    // Initialize storage with default data if empty
    init() {
        // Run maintenance on load
        this.limitBugReports();

        if (!this.get(this.KEYS.CHART_OF_ACCOUNTS)) {
            this.set(this.KEYS.CHART_OF_ACCOUNTS, this.getDefaultChartOfAccounts(), true);
        }
        // Initialize all storage keys if they don't exist
        if (!localStorage.getItem(this.KEYS.JOURNAL_ENTRIES)) {
            localStorage.setItem(this.KEYS.JOURNAL_ENTRIES, JSON.stringify([]));
        }
        if (!localStorage.getItem(this.KEYS.TRANSACTION_COUNTERS)) {
            const defaultCounters = {
                CSH: 0,  // Cash transactions
                BNK: 0,  // Bank transactions
                JRN: 0,  // General journal entries
                SLS: 0,  // Sales
                PUR: 0,  // Purchases
                PMT: 0,  // Payments
                RCP: 0,  // Receipts
                S: 0  // Direct Swaps
            };
            localStorage.setItem(this.KEYS.TRANSACTION_COUNTERS, JSON.stringify(defaultCounters));
        }

        // AUTO-FIX: Recalculate counters to ensure they match actual data
        // This fixes issues where counters get reset or out of sync
        this.recalculateCounters();

        // Initialize Master Data with sample data if empty
            const sampleItems = [
                { id: 'LM-ANTAM-100G', code: 'LM-ANTAM-100G', name: 'Emas Batangan Antam 100g (999.9)', category: 'Emas Murni', unit: 'gram', weight: 100, purity: 99.99, minStock: 50, inventoryAccount: '1157', cogsAccount: '5114', salesAccount: '4110', description: 'Logam Mulia Lokal Antam 100g' },
                { id: 'LM-ANTAM-1000G', code: 'LM-ANTAM-1000G', name: 'Emas Batangan Antam 1kg (999.9)', category: 'Emas Murni', unit: 'gram', weight: 1000, purity: 99.99, minStock: 1000, inventoryAccount: '1157', cogsAccount: '5114', salesAccount: '4110', description: 'Logam Mulia Lokal Antam 1000g' },
                { id: 'LM-VALCAMBI-1KG', code: 'LM-VALCAMBI-1KG', name: 'Valcambi Suisse Gold Bar 1kg (999.9 LBMA)', category: 'Emas Impor', unit: 'gram', weight: 1000, purity: 99.99, minStock: 1000, inventoryAccount: '1158', cogsAccount: '5115', salesAccount: '4110', description: 'Logam Mulia Impor Valcambi Suisse LBMA' },
                { id: 'LM-PAMP-1KG', code: 'LM-PAMP-1KG', name: 'PAMP Suisse Gold Bar 1kg (999.9 LBMA)', category: 'Emas Impor', unit: 'gram', weight: 1000, purity: 99.99, minStock: 1000, inventoryAccount: '1158', cogsAccount: '5115', salesAccount: '4110', description: 'Logam Mulia Impor PAMP Suisse LBMA' },
                { id: 'GOLD-GRANULE-9999', code: 'GOLD-GRANULE-9999', name: 'Granul Emas Murni 999.9', category: 'Bahan Baku', unit: 'gram', purity: 99.99, minStock: 500, inventoryAccount: '1182', cogsAccount: '5111', salesAccount: '4110', description: 'Bahan baku granul emas murni untuk lebur & manufaktur' },
                { id: 'GOLD-SCRAP-VAR', code: 'GOLD-SCRAP-VAR', name: 'Pecahan Perhiasan Scrap (Kadar Variatif)', category: 'Scrap', unit: 'gram', purity: 0, minStock: 0, inventoryAccount: '1152', cogsAccount: '5111', salesAccount: '4110', description: 'Pecahan perhiasan rongsok/bekas hasil pembelian' }
            ];
            localStorage.setItem(this.KEYS.ITEMS, JSON.stringify(sampleItems));

        if (!localStorage.getItem(this.KEYS.TAXES) || JSON.parse(localStorage.getItem(this.KEYS.TAXES)).length === 0) {
            const sampleTaxes = [
                { code: 'PPN', name: 'PPN (Pajak Pertambahan Nilai)', type: 'PPN', rate: 11, glAccount: '2130', description: 'PPN 11% sesuai UU HPP' },
                { code: 'PPH23', name: 'PPh 23 - Jasa', type: 'PPh 23', rate: 2, glAccount: '2121', description: 'PPh 23 untuk jasa' },
                { code: 'PPH21', name: 'PPh 21 - Gaji Karyawan', type: 'PPh 21', rate: 5, glAccount: '2122', description: 'PPh 21 gaji karyawan' },
                { code: 'PPH22', name: 'PPh 22 - Impor', type: 'PPh 22', rate: 2.5, glAccount: '2123', description: 'PPh 22 impor barang' },
                { code: 'PPH4-2', name: 'PPh Pasal 4 Ayat 2 - Final', type: 'PPh Final', rate: 0.5, glAccount: '2124', description: 'PPh final untuk transaksi tertentu' }
            ];
            localStorage.setItem(this.KEYS.TAXES, JSON.stringify(sampleTaxes));
        }

        if (!localStorage.getItem(this.KEYS.BANK_ACCOUNTS) || JSON.parse(localStorage.getItem(this.KEYS.BANK_ACCOUNTS)).length === 0) {
            const sampleBanks = [
                { id: 'BANK-BCA-001', code: 'BCA-001', accountHolder: 'PT. Golden Alura Refinery', bankName: 'BCA', accountNumber: '1234567890', currency: 'IDR', branch: 'Jakarta Pusat', glAccount: '1121', notes: 'Rekening utama operasional', active: true, createdAt: new Date().toISOString() }
            ];
            localStorage.setItem(this.KEYS.BANK_ACCOUNTS, JSON.stringify(sampleBanks));
        }

        if (!localStorage.getItem(this.KEYS.PAYMENT_TERMS) || JSON.parse(localStorage.getItem(this.KEYS.PAYMENT_TERMS)).length === 0) {
            const samplePaymentTerms = [
                { code: 'NET-30', name: 'Net 30 Days', days: 30, discountPercent: 0, discountDays: 0, description: 'Pembayaran dalam 30 hari' },
                { code: 'NET-60', name: 'Net 60 Days', days: 60, discountPercent: 0, discountDays: 0, description: 'Pembayaran dalam 60 hari' },
                { code: '2-10-NET-30', name: '2/10 Net 30', days: 30, discountPercent: 2, discountDays: 10, description: 'Diskon 2% jika bayar dalam 10 hari, atau net 30 hari' },
                { code: 'COD', name: 'Cash on Delivery', days: 0, discountPercent: 0, discountDays: 0, description: 'Bayar saat terima barang' },
                { code: 'CBD', name: 'Cash Before Delivery', days: -1, discountPercent: 0, discountDays: 0, description: 'Bayar sebelum barang dikirim' }
            ];
            localStorage.setItem(this.KEYS.PAYMENT_TERMS, JSON.stringify(samplePaymentTerms));
        }

        if (!localStorage.getItem(this.KEYS.DEPARTMENTS) || JSON.parse(localStorage.getItem(this.KEYS.DEPARTMENTS)).length === 0) {
            localStorage.setItem(this.KEYS.DEPARTMENTS, JSON.stringify(this.getOfficialDepartments()));
        }

        if (!localStorage.getItem(this.KEYS.CUSTOMERS) || JSON.parse(localStorage.getItem(this.KEYS.CUSTOMERS)).length === 0) {
            const sampleCustomers = [
                { code: 'CUST-001', name: 'PT Indo Jaya Makmur', contactPerson: 'Budi Santoso', phone: '021-5551234', email: 'budi@indojaya.co.id', address: 'Jl. Sudirman No. 123, Jakarta', paymentTerms: 'NET-30', creditLimit: 500000000, description: 'Customer tetap - pembeli gold bar bulky' },
                { code: 'CUST-002', name: 'CV Mitra Emas Sejahtera', contactPerson: 'Siti Aminah', phone: '021-7778888', email: 'siti@mitraemas.com', address: 'Jl. Gatot Subroto 456, Jakarta', paymentTerms: 'NET-60', creditLimit: 300000000, description: 'Toko emas retail' },
                { code: 'CUST-003', name: 'Toko Emas Berkah', contactPerson: 'Ahmad Hidayat', phone: '021-9990000', email: 'ahmad@tokoemasberkah.com', address: 'Pasar Baru Blok A-12, Jakarta', paymentTerms: 'COD', creditLimit: 100000000, description: 'Toko emas - COD only' },
                { code: 'CUST-004', name: 'PT Manufaktur Indonesia', contactPerson: 'Dewi Kusuma', phone: '021-3334455', email: 'dewi@manufaktur.co.id', address: 'Kawasan Industri MM2100, Bekasi', paymentTerms: '2-10-NET-30', creditLimit: 750000000, description: 'Industri elektronik - perlu gold grain' },
                { code: 'CUST-005', name: 'Galeri Perhiasan Mewah', contactPerson: 'Rudi Hartono', phone: '021-6667788', email: 'rudi@galeriperhiasan.com', address: 'Plaza Indonesia Lt. 3, Jakarta', paymentTerms: 'NET-30', creditLimit: 400000000, description: 'Galeri perhiasan high-end' },
                { code: 'CUST-006', name: 'CV Emas Express', contactPerson: 'Andi Wijaya', phone: '021-1112233', email: 'andi@emasexpress.com', address: 'Jl. MH Thamrin 789, Jakarta', paymentTerms: 'NET-30', creditLimit: 250000000, description: 'Distributor emas untuk apotek dan pegadaian' }
            ];
            localStorage.setItem(this.KEYS.CUSTOMERS, JSON.stringify(sampleCustomers));
        }

        if (!localStorage.getItem(this.KEYS.SUPPLIERS) || JSON.parse(localStorage.getItem(this.KEYS.SUPPLIERS)).length === 0) {
            const sampleSuppliers = [
                { id: 'SUPP-001', code: 'SUPP-001', name: 'CV Pengepul Emas Nusantara', contactPerson: 'Hendra Wijaya', phone: '021-2223344', email: 'hendra@pengepulemas.com', address: 'Jl. Veteran No. 88, Jakarta', paymentTerms: 'COD', description: 'Supplier emas mentah/scrap regional' },
                { id: 'SUPP-002', code: 'SUPP-002', name: 'PT Chemical Indo', contactPerson: 'Lisa Marlina', phone: '021-5556677', email: 'lisa@chemindo.co.id', address: 'Jl. Industri Raya 234, Tangerang', paymentTerms: 'NET-30', description: 'Supplier chemicals untuk refinery' },
                { id: 'SUPP-003', code: 'SUPP-003', name: 'Toko Alat Lab Sejati', contactPerson: 'Benny Kusuma', phone: '021-8889900', email: 'benny@alatlabsejati.com', address: 'Jl. Kramat Raya 45, Jakarta', paymentTerms: 'NET-30', description: 'Supplier peralatan lab dan crucible' },
                { id: 'SUPP-004', code: 'SUPP-004', name: 'PT Tambang Emas Jaya', contactPerson: 'Indra Gunawan', phone: '0561-123456', email: 'indra@tambangemas.co.id', address: 'Pontianak, Kalimantan Barat', paymentTerms: 'CBD', description: 'Supplier emas dari tambang - payment upfront' },
                { id: 'SUPP-005', code: 'SUPP-005', name: 'CV Import Bahan Kimia', contactPerson: 'Jennifer Tan', phone: '021-4445566', email: 'jennifer@importkimia.com', address: 'Jl. Pluit Raya 789, Jakarta Utara', paymentTerms: 'NET-60', description: 'Import chemicals dari China' }
            ];
            localStorage.setItem(this.KEYS.SUPPLIERS, JSON.stringify(sampleSuppliers));
        }

        if (!localStorage.getItem(this.KEYS.WAREHOUSES) || JSON.parse(localStorage.getItem(this.KEYS.WAREHOUSES)).length === 0) {
            const sampleWarehouses = [
                { code: 'LAB-01', name: 'Lab & Quarantine Area', location: 'Lantai 2 - Bagian Timur', capacity: 500, currentStock: 0, description: 'Area khusus untuk emas pending lab test' },
                { code: 'VAULT-01', name: 'Main Gold Vault', location: 'Ruang Besi Lantai 1', capacity: 10000, currentStock: 0, description: 'Vault utama penyimpanan emas confirmed' },
                { code: 'PROD-01', name: 'Production Floor', location: 'Lantai 1 - Bagian Barat', capacity: 2000, currentStock: 0, description: 'Area produksi dan refining' },
                { code: 'CHEM-01', name: 'Chemical Storage', location: 'Gudang Samping', capacity: 5000, currentStock: 0, description: 'Gudang khusus chemicals dan bahan kimia' },
                { code: 'FG-01', name: 'Finished Goods Warehouse', location: 'Lantai 1 - Display Area', capacity: 3000, currentStock: 0, description: 'Gudang gold bar dan grain siap jual' },
                { code: 'SCRAP-01', name: 'Scrap Gold Storage', location: 'Ruang Sortir', capacity: 1000, currentStock: 0, description: 'Tempat penyimpanan sementara scrap gold sebelum diproses' }
            ];
            localStorage.setItem(this.KEYS.WAREHOUSES, JSON.stringify(sampleWarehouses));
        }

        // Initialize Roles with preset permissions
        if (!localStorage.getItem(this.KEYS.ROLES) || JSON.parse(localStorage.getItem(this.KEYS.ROLES)).length === 0) {
            const presetRoles = [
                {
                    roleCode: 'ADMIN',
                    roleName: 'Administrator',
                    description: 'Full system access - can manage users and all modules',
                    permissions: { /* Admin has all permissions - handled in Auth.hasPermission() */ }
                },
                {
                    roleCode: 'director',
                    roleName: 'Director',
                    description: 'Director - Unlimited approval authority',
                    permissions: {
                        dashboard: true,
                        chartOfAccounts: true,
                        journalEntry: true,
                        generalLedger: true,
                        balanceSheet: true,
                        incomeStatement: true,
                        cashFlow: true,
                        simpleTransaction: true,
                        paymentVoucher: true,
                        purchaseRequisition: true,
                        purchaseOrder: true,
                        masterCustomer: true,
                        masterSupplier: true,
                        masterEmployee: true,
                        attendance: true,
                        payroll: true,
                        leaveManagement: true
                    }
                },
                {
                    roleCode: 'manager_finance',
                    roleName: 'Finance Manager',
                    description: 'Finance Manager - Approve Payment Voucher & Purchase Requisition up to Rp 100 juta',
                    permissions: {
                        dashboard: true,
                        chartOfAccounts: true,
                        journalEntry: true,
                        generalLedger: true,
                        balanceSheet: true,
                        incomeStatement: true,
                        cashFlow: true,
                        simpleTransaction: true,
                        paymentVoucher: true,
                        purchaseRequisition: true,  // ADDED - Bisa approve PRF
                        purchaseOrder: true,         // ADDED - Bisa lihat PO
                        masterBank: true,
                        masterSupplier: true,
                        masterItem: true            // ADDED - Bisa lihat items
                    }
                },
                {
                    roleCode: 'purchasing_head',
                    roleName: 'Purchasing Head',
                    description: 'Purchasing Head - Approve PRF up to Rp 100 juta',
                    permissions: {
                        dashboard: true,
                        purchaseRequisition: true,
                        purchaseOrder: true,
                        masterSupplier: true,
                        masterItem: true
                    }
                },
                {
                    roleCode: 'FINANCE',
                    roleName: 'Finance Staff',
                    description: 'Access to accounting and financial modules',
                    permissions: {
                        dashboard: true,
                        chartOfAccounts: true,
                        journalEntry: true,
                        generalLedger: true,
                        balanceSheet: true,
                        incomeStatement: true,
                        cashFlow: true,
                        simpleTransaction: true,
                        paymentVoucher: true,
                        masterCustomer: true,
                        masterSupplier: true,
                        masterBank: true,
                        masterPaymentTerms: true,
                        masterTax: true
                    }
                },
                {
                    roleCode: 'PRODUCTION',
                    roleName: 'Production Staff',
                    description: 'Access to production and inventory modules',
                    permissions: {
                        dashboard: true,
                        simpleTransaction: true,
                        jobOrders: true,
                        productionBatches: true,
                        productionOrder: true,
                        bomManagement: true,
                        goldDustRecovery: true,
                        refineryKPI: true,
                        refineryForms: true,
                        aiAdvisor: true,
                        masterItem: true,
                        masterWarehouse: true,
                        masterSupplier: true
                    }
                },
                {
                    roleCode: 'SALES',
                    roleName: 'Sales Staff',
                    description: 'Access to sales modules',
                    permissions: {
                        dashboard: true,
                        simpleTransaction: true,
                        masterCustomer: true
                    }
                },
                {
                    roleCode: 'VIEWER',
                    roleName: 'Viewer (Read Only)',
                    description: 'Read-only access to all modules',
                    permissions: {
                        dashboard: true,
                        chartOfAccounts: true,
                        generalLedger: true,
                        balanceSheet: true,
                        incomeStatement: true,
                        cashFlow: true
                    }
                },
                {
                    roleCode: 'production_head',
                    roleName: 'Production Head',
                    description: 'Production Head - Approve PRF for Production Dept',
                    permissions: {
                        dashboard: true,
                        simpleTransaction: true,
                        purchaseRequisition: true,
                        jobOrders: true,
                        productionBatches: true,
                        productionOrder: true,
                        bomManagement: true,
                        goldDustRecovery: true,
                        refineryKPI: true,
                        refineryForms: true,
                        aiAdvisor: true,
                        masterItem: true,
                        masterWarehouse: true,
                        masterSupplier: true
                    }
                },
                {
                    roleCode: 'marketing',
                    roleName: 'Marketing Staff',
                    description: 'Access to customer management and KYC reviews',
                    permissions: {
                        dashboard: true,
                        masterCustomer: true,
                        customerKYC: true
                    }
                },
                {
                    roleCode: 'HRD_MANAGER',
                    roleName: 'HRD Manager',
                    description: 'HRD Manager - Full access to HR modules including approvals',
                    permissions: {
                        dashboard: true,
                        masterEmployee: true,
                        attendance: true,
                        payroll: true,
                        leaveManagement: true,
                        productionLog: true,
                        payrollSimulation: true
                    }
                },
                {
                    roleCode: 'HRD',
                    roleName: 'HRD Staff',
                    description: 'HRD Staff - Access to HR data entry and employee management',
                    permissions: {
                        dashboard: true,
                        masterEmployee: true,
                        attendance: true,
                        payroll: true,
                        leaveManagement: true,
                        productionLog: true,
                        payrollSimulation: true
                    }
                },
                {
                    roleCode: 'EMPLOYEE',
                    roleName: 'Employee',
                    description: 'Staff / Employee - Access to personal dashboard, payslips, and attendance',
                    permissions: {
                        staffDashboard: true
                    }
                }
            ];
            localStorage.setItem(this.KEYS.ROLES, JSON.stringify(presetRoles));
        }

        // Initialize Users with default admin and demo approval users
        if (!localStorage.getItem(this.KEYS.USERS) || JSON.parse(localStorage.getItem(this.KEYS.USERS)).length === 0) {
            // Password 'demo123' hashed = same as admin123 for simplicity
            const defaultUsers = [
                {
                    id: 'admin',
                    username: 'admin',
                    passwordHash: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
                    fullName: 'System Administrator',
                    email: 'admin@goalrefinery.id',
                    role: 'ADMIN',
                    status: 'active',
                    mustChangePassword: false,
                    createdAt: new Date().toISOString()
                },
                {
                    id: 'director',
                    username: 'director',
                    passwordHash: 'd3ad9315b7be5dd53b31a273b3b3aba5defe700808305aa16a3062b76658a791', // demo123
                    fullName: 'Direktur Utama',
                    email: 'director@goalrefinery.id',
                    role: 'director',
                    status: 'active',
                    mustChangePassword: false,
                    createdAt: new Date().toISOString()
                },
                {
                    id: 'refinery_user',
                    username: 'refinery_user',
                    passwordHash: '4def707556791f2b15a315d051dbf5cd39525510e6c5839d19e1dfcf41e60e67', // RefineryPassword123
                    fullName: 'User Laporan Refinery',
                    email: 'refinery@goalrefinery.id',
                    role: 'director',
                    reportProfile: 'refinery_only',
                    status: 'active',
                    mustChangePassword: false,
                    createdAt: new Date().toISOString()
                },
                {
                    id: 'finance_mgr',
                    username: 'finance',
                    passwordHash: 'd3ad9315b7be5dd53b31a273b3b3aba5defe700808305aa16a3062b76658a791', // demo123
                    fullName: 'Manager Keuangan',
                    email: 'finance@goalrefinery.id',
                    role: 'manager_finance',
                    status: 'active',
                    mustChangePassword: false,
                    createdAt: new Date().toISOString()
                },
                {
                    id: 'purchasing',
                    username: 'purchasing',
                    passwordHash: 'd3ad9315b7be5dd53b31a273b3b3aba5defe700808305aa16a3062b76658a791', // demo123
                    fullName: 'Kepala Purchasing',
                    email: 'purchasing@goalrefinery.id',
                    role: 'purchasing_head',
                    status: 'active',
                    mustChangePassword: false,
                    createdAt: new Date().toISOString()
                },
                {
                    id: 'staff',
                    username: 'staff',
                    passwordHash: 'd3ad9315b7be5dd53b31a273b3b3aba5defe700808305aa16a3062b76658a791', // demo123
                    fullName: 'Staff Finance',
                    email: 'staff@goalrefinery.id',
                    role: 'FINANCE',
                    status: 'active',
                    mustChangePassword: false,
                    createdAt: new Date().toISOString()
                },
                {
                    id: 'purchasing_staff',
                    username: 'purchasingstaff',
                    passwordHash: 'd3ad9315b7be5dd53b31a273b3b3aba5defe700808305aa16a3062b76658a791', // demo123
                    fullName: 'Staff Purchasing',
                    email: 'purchasingstaff@goalrefinery.id',
                    role: 'PRODUCTION',
                    status: 'active',
                    mustChangePassword: false,
                    createdAt: new Date().toISOString()
                },
                {
                    id: 'production_staff',
                    username: 'prodstaff',
                    passwordHash: 'd3ad9315b7be5dd53b31a273b3b3aba5defe700808305aa16a3062b76658a791', // demo123
                    fullName: 'Staff Produksi',
                    email: 'prodstaff@goalrefinery.id',
                    role: 'PRODUCTION',
                    status: 'active',
                    mustChangePassword: false,
                    createdAt: new Date().toISOString()
                },
                {
                    id: 'production_head',
                    username: 'prodhead',
                    passwordHash: 'd3ad9315b7be5dd53b31a273b3b3aba5defe700808305aa16a3062b76658a791', // demo123
                    fullName: 'Kepala Produksi',
                    email: 'prodhead@goalrefinery.id',
                    role: 'production_head',
                    status: 'active',
                    mustChangePassword: false,
                    createdAt: new Date().toISOString()
                },
                {
                    id: 'hrd_manager',
                    username: 'hrdmanager',
                    passwordHash: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', // demo123
                    fullName: 'Manager HRD',
                    email: 'hrdmanager@goalrefinery.id',
                    role: 'HRD_MANAGER',
                    status: 'active',
                    mustChangePassword: true,
                    createdAt: new Date().toISOString()
                },
                {
                    id: 'hrd_staff',
                    username: 'hrd',
                    passwordHash: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', // demo123
                    fullName: 'Staff HRD',
                    email: 'hrd@goalrefinery.id',
                    role: 'HRD',
                    status: 'active',
                    mustChangePassword: true,
                    createdAt: new Date().toISOString()
                }
            ];
            localStorage.setItem(this.KEYS.USERS, JSON.stringify(defaultUsers));
        }

        console.log('Storage initialized with sample data');
    },

    // Force load sample data (call from console: Storage.loadSampleData())
    loadSampleData() {
        const sampleItems = [];
        localStorage.setItem(this.KEYS.ITEMS, JSON.stringify(sampleItems));

        const sampleTaxes = [
            { code: 'PPN', name: 'PPN (Pajak Pertambahan Nilai)', type: 'PPN', rate: 11, glAccount: '2130', description: 'PPN 11% sesuai UU HPP' },
            { code: 'PPH23', name: 'PPh 23 - Jasa', type: 'PPh 23', rate: 2, glAccount: '2121', description: 'PPh 23 untuk jasa' },
            { code: 'PPH21', name: 'PPh 21 - Gaji Karyawan', type: 'PPh 21', rate: 5, glAccount: '2122', description: 'PPh 21 gaji karyawan' },
            { code: 'PPH22', name: 'PPh 22 - Impor', type: 'PPh 22', rate: 2.5, glAccount: '2123', description: 'PPh 22 impor barang' },
            { code: 'PPH4-2', name: 'PPh Pasal 4 Ayat 2 - Final', type: 'PPh Final', rate: 0.5, glAccount: '2124', description: 'PPh final untuk transaksi tertentu' }
        ];
        localStorage.setItem(this.KEYS.TAXES, JSON.stringify(sampleTaxes));

        const sampleBanks = [
            { id: 'BANK-BCA-001', code: 'BCA-001', accountHolder: 'PT. Golden Alura Refinery', bankName: 'BCA', accountNumber: '1234567890', currency: 'IDR', branch: 'Jakarta Pusat', glAccount: '1121', notes: 'Rekening utama operasional', active: true, createdAt: new Date().toISOString() }
        ];
        localStorage.setItem(this.KEYS.BANK_ACCOUNTS, JSON.stringify(sampleBanks));

        const samplePaymentTerms = [
            { code: 'NET-30', name: 'Net 30 Days', days: 30, discountPercent: 0, discountDays: 0, description: 'Pembayaran dalam 30 hari' },
            { code: 'NET-60', name: 'Net 60 Days', days: 60, discountPercent: 0, discountDays: 0, description: 'Pembayaran dalam 60 hari' },
            { code: '2-10-NET-30', name: '2/10 Net 30', days: 30, discountPercent: 2, discountDays: 10, description: 'Diskon 2% jika bayar dalam 10 hari, atau net 30 hari' },
            { code: 'COD', name: 'Cash on Delivery', days: 0, discountPercent: 0, discountDays: 0, description: 'Bayar saat terima barang' },
            { code: 'CBD', name: 'Cash Before Delivery', days: -1, discountPercent: 0, discountDays: 0, description: 'Bayar sebelum barang dikirim' }
        ];
        localStorage.setItem(this.KEYS.PAYMENT_TERMS, JSON.stringify(samplePaymentTerms));

        const sampleDepartments = [
            { code: 'PROD', name: 'Production / Refinery', budget: 500000000, description: 'Departemen produksi dan pemurnian emas' },
            { code: 'SALES', name: 'Sales & Marketing', budget: 200000000, description: 'Departemen penjualan dan marketing' },
            { code: 'FIN', name: 'Finance & Accounting', budget: 150000000, description: 'Departemen keuangan dan akuntansi' },
            { code: 'HR', name: 'Human Resources', budget: 100000000, description: 'Departemen SDM dan personalia' },
            { code: 'IT', name: 'Information Technology', budget: 75000000, description: 'Departemen IT dan sistem' },
            { code: 'QC', name: 'Quality Control & Lab', budget: 120000000, description: 'Lab testing dan quality control' }
        ];
        localStorage.setItem(this.KEYS.DEPARTMENTS, JSON.stringify(sampleDepartments));

        const sampleCustomers = [
            { code: 'CUST-001', name: 'PT Indo Jaya Makmur', contactPerson: 'Budi Santoso', phone: '021-5551234', email: 'budi@indojaya.co.id', address: 'Jl. Sudirman No. 123, Jakarta', paymentTerms: 'NET-30', creditLimit: 500000000, description: 'Customer tetap - pembeli gold bar bulky' },
            { code: 'CUST-002', name: 'CV Mitra Emas Sejahtera', contactPerson: 'Siti Aminah', phone: '021-7778888', email: 'siti@mitraemas.com', address: 'Jl. Gatot Subroto 456, Jakarta', paymentTerms: 'NET-60', creditLimit: 300000000, description: 'Toko emas retail' },
            { code: 'CUST-003', name: 'Toko Emas Berkah', contactPerson: 'Ahmad Hidayat', phone: '021-9990000', email: 'ahmad@tokoemasberkah.com', address: 'Pasar Baru Blok A-12, Jakarta', paymentTerms: 'COD', creditLimit: 100000000, description: 'Toko emas - COD only' },
            { code: 'CUST-004', name: 'PT Manufaktur Indonesia', contactPerson: 'Dewi Kusuma', phone: '021-3334455', email: 'dewi@manufaktur.co.id', address: 'Kawasan Industri MM2100, Bekasi', paymentTerms: '2-10-NET-30', creditLimit: 750000000, description: 'Industri elektronik - perlu gold grain' },
            { code: 'CUST-005', name: 'Galeri Perhiasan Mewah', contactPerson: 'Rudi Hartono', phone: '021-6667788', email: 'rudi@galeriperhiasan.com', address: 'Plaza Indonesia Lt. 3, Jakarta', paymentTerms: 'NET-30', creditLimit: 400000000, description: 'Galeri perhiasan high-end' },
            { code: 'CUST-006', name: 'CV Emas Express', contactPerson: 'Andi Wijaya', phone: '021-1112233', email: 'andi@emasexpress.com', address: 'Jl. MH Thamrin 789, Jakarta', paymentTerms: 'NET-30', creditLimit: 250000000, description: 'Distributor emas untuk apotek dan pegadaian' }
        ];
        localStorage.setItem(this.KEYS.CUSTOMERS, JSON.stringify(sampleCustomers));

        const sampleSuppliers = [
            { id: 'SUPP-001', code: 'SUPP-001', name: 'CV Pengepul Emas Nusantara', contactPerson: 'Hendra Wijaya', phone: '021-2223344', email: 'hendra@pengepulemas.com', address: 'Jl. Veteran No. 88, Jakarta', paymentTerms: 'COD', description: 'Supplier emas mentah/scrap regional' },
            { id: 'SUPP-002', code: 'SUPP-002', name: 'PT Chemical Indo', contactPerson: 'Lisa Marlina', phone: '021-5556677', email: 'lisa@chemindo.co.id', address: 'Jl. Industri Raya 234, Tangerang', paymentTerms: 'NET-30', description: 'Supplier chemicals untuk refinery' },
            { id: 'SUPP-003', code: 'SUPP-003', name: 'Toko Alat Lab Sejati', contactPerson: 'Benny Kusuma', phone: '021-8889900', email: 'benny@alatlabsejati.com', address: 'Jl. Kramat Raya 45, Jakarta', paymentTerms: 'NET-30', description: 'Supplier peralatan lab dan crucible' },
            { id: 'SUPP-004', code: 'SUPP-004', name: 'PT Tambang Emas Jaya', contactPerson: 'Indra Gunawan', phone: '0561-123456', email: 'indra@tambangemas.co.id', address: 'Pontianak, Kalimantan Barat', paymentTerms: 'CBD', description: 'Supplier emas dari tambang - payment upfront' },
            { id: 'SUPP-005', code: 'SUPP-005', name: 'CV Import Bahan Kimia', contactPerson: 'Jennifer Tan', phone: '021-4445566', email: 'jennifer@importkimia.com', address: 'Jl. Pluit Raya 789, Jakarta Utara', paymentTerms: 'NET-60', description: 'Import chemicals dari China' }
        ];
        localStorage.setItem(this.KEYS.SUPPLIERS, JSON.stringify(sampleSuppliers));

        const sampleWarehouses = [
            { code: 'LAB-01', name: 'Lab & Quarantine Area', location: 'Lantai 2 - Bagian Timur', capacity: 500, currentStock: 0, description: 'Area khusus untuk emas pending lab test' },
            { code: 'VAULT-01', name: 'Main Gold Vault', location: 'Ruang Besi Lantai 1', capacity: 10000, currentStock: 0, description: 'Vault utama penyimpanan emas confirmed' },
            { code: 'PROD-01', name: 'Production Floor', location: 'Lantai 1 - Bagian Barat', capacity: 2000, currentStock: 0, description: 'Area produksi dan refining' },
            { code: 'CHEM-01', name: 'Chemical Storage', location: 'Gudang Samping', capacity: 5000, currentStock: 0, description: 'Gudang khusus chemicals dan bahan kimia' },
            { code: 'FG-01', name: 'Finished Goods Warehouse', location: 'Lantai 1 - Display Area', capacity: 3000, currentStock: 0, description: 'Gudang gold bar dan grain siap jual' },
            { code: 'SCRAP-01', name: 'Scrap Gold Storage', location: 'Ruang Sortir', capacity: 1000, currentStock: 0, description: 'Tempat penyimpanan sementara scrap gold sebelum diproses' }
        ];
        localStorage.setItem(this.KEYS.WAREHOUSES, JSON.stringify(sampleWarehouses));

        console.log('✅ Sample data loaded successfully! Refresh the page to see changes.');
        alert('Sample data berhasil dimuat! Silakan refresh halaman (F5).');
        return 'Sample data loaded!';
    },

    // Get data from localStorage
    get(key) {
        try {
            // 🛡️ SAFETY BYPASS (CONTINGENCY / HONEYPOT)
            // If current user is in 'GUEST_SAFETY' mode, we return plausible dummy data.
            // This ensures the system looks like a populated startup but with ZERO stock.
            const sessionData = localStorage.getItem('erp_current_session');
            if (sessionData) {
                const session = JSON.parse(sessionData);
                if (session && session.role === 'GUEST_SAFETY') {
                    return this.getSafetySampleData(key);
                }
            }

            if (!this.canCurrentUserReadKey(key)) {
                console.warn(`[Security] Blocked local read for protected key '${key}'.`);
                return Array.isArray(JSON.parse(localStorage.getItem(key) || '[]')) ? [] : null;
            }

            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Error reading from storage:', error);
            return null;
        }
    },

    /**
     * 🛡️ GET SAFETY SAMPLE DATA (HONEYPOT / GUEST_SAFETY)
     * Provides a "Plausible Reality" for unauthorized visitors.
     */
    getSafetySampleData(key) {
        // STOCK IS ALWAYS ZERO
        if (key === this.KEYS.WAREHOUSE_STOCK) return {};
        if (key === this.KEYS.GOLD_TRANSACTIONS) return [];
        if (key === this.KEYS.JOURNAL_ENTRIES) return [];
        if (key === this.KEYS.PRODUCTION_BATCHES) return [];
        if (key === this.KEYS.STOCK_CARDS) return [];
        if (key === this.KEYS.PAYMENT_VOUCHERS) return [];
        if (key === this.KEYS.PURCHASE_ORDERS) return [];
        if (key === this.KEYS.SALES_ORDERS) return [];
        if (key === this.KEYS.AUDIT_LOG) return [];

        // POPULATED LOOK (DUMMY LISTS)
        const dummyItems = [
            { id: 101, code: 'FG-001', name: 'Fine Gold Bar 999.9 (1000g)', category: 'Finished Goods', unit: 'g', price: 1200000, stock: 0 },
            { id: 102, code: 'FG-002', name: 'Fine Gold Bar 999.9 (100g)', category: 'Finished Goods', unit: 'g', price: 1205000, stock: 0 },
            { id: 103, code: 'FG-003', name: 'Fine Gold Grain 99.9', category: 'Finished Goods', unit: 'g', price: 1195000, stock: 0 },
            { id: 104, code: 'RM-001', name: 'Scrap Gold (Mixed Purity)', category: 'Raw Materials', unit: 'g', price: 0, stock: 0 }
        ];

        const dummyCustomers = [
            { id: 201, code: 'CUST-001', name: 'PT. Logam Mulia Jaya', contact: 'Budi Santoso', status: 'active' },
            { id: 202, code: 'CUST-002', name: 'Toko Emas Sejahtera', contact: 'Haji Ahmad', status: 'active' },
            { id: 203, code: 'CUST-003', name: 'CV. Mitra Emas', contact: 'Siti Aminah', status: 'active' }
        ];

        const dummySuppliers = [
            { id: 301, code: 'SUPP-001', name: 'CV. Pengepul Emas Mandiri', type: 'Gold Source', status: 'active' },
            { id: 302, code: 'SUPP-002', name: 'PT. Kimia Industri Sejati', type: 'Refining Consumables', status: 'active' }
        ];

        const dummyEmployees = [
            { id: 'EMP-01', fullName: 'Ahmad Supardi', role: 'Staff Finance', status: 'active' },
            { id: 'EMP-02', fullName: 'Dewi Sartika', role: 'Staff Admin', status: 'active' },
            { id: 'EMP-03', fullName: 'Bambang Irawan', role: 'Security', status: 'active' }
        ];

        if (key === this.KEYS.ITEMS) return dummyItems;
        if (key === this.KEYS.CUSTOMERS) return dummyCustomers;
        if (key === this.KEYS.SUPPLIERS) return dummySuppliers;
        if (key === this.KEYS.EMPLOYEES) return dummyEmployees;

        // Otherwise return empty array for other transaction-like keys
        return [];
    },

    // Set data to storage (Handles both Cloud and Local)
    // For critical data that MUST reach cloud, use setWithCloudBlock() instead.
    // @param {boolean} skipCloud - If true, only saves locally (used for internal sync to avoid loops)
    async set(key, value, skipCloud = false, specificItem = null) {
        try {
            if (this.isPayrollSecurityKey(key) && !this.canCurrentUserWriteKey(key)) {
                console.warn(`[Security] Blocked write for protected key '${key}'.`);
                return false;
            }

            // 1. Save to LocalStorage (Always acts as cache/fallback)
            try {
                localStorage.setItem(key, JSON.stringify(value));
            } catch (localErr) {
                if (localErr.name === 'QuotaExceededError' || localErr.code === 22 || localErr.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                    console.error(`🚨 [Storage] LocalStorage quota exceeded for '${key}'. Skipping local cache.`);
                    if (window.showToast && !['erp_bug_reports', 'erp_audit_log'].includes(key)) {
                        window.showToast('Memori lokal penuh! Data akan disimpan langsung ke server.', 'warning');
                    }
                    if (!this.USE_CLOUD_STORAGE) throw localErr;
                } else {
                    throw localErr;
                }
            }

            // 2. Save to Cloud if enabled and NOT skipped
            if (this.USE_CLOUD_STORAGE && !skipCloud) {
                const dataToSync = specificItem ? [specificItem] : value;
                const cloudSuccess = await this.CloudStorage.save(key, dataToSync);

                if (!cloudSuccess) {
                    const permissionDenied = this.CloudStorage.lastErrorCode === 'permission-denied';
                    const currentUserCanWrite = this.canCurrentUserWriteKey(key);

                    if (permissionDenied && !currentUserCanWrite) {
                        console.warn(`⚠️ [Storage] Skipping retry queue for read-only role on '${key}'.`);
                        if (this.SyncGuard._queue[key]) this.SyncGuard.remove(key);
                        return true;
                    }

                    // Silent keys (config/session) — skip all alerts
                    const isSilent = [
                        Storage.KEYS.CONFIG,
                        Storage.KEYS.SETTINGS,
                        'erp_current_session',
                        Storage.KEYS.AUDIT_LOG,
                        Storage.KEYS.BUG_REPORTS
                    ].includes(key);

                    if (!isSilent) {
                        const isCloudInit = this.CloudStorage.lastErrorCode === 'cloud-unavailable';
                        this.SyncGuard.add(key, value, isCloudInit);
                        console.warn(`⚠️ [Storage] Cloud save pending for '${key}' (reason: ${this.CloudStorage.lastErrorCode}). Added to SyncGuard retry queue.`);
                    }
                } else {
                    // Cloud save succeeded — remove from retry queue if it was there
                    if (this.SyncGuard._queue[key]) {
                        this.SyncGuard.remove(key);
                    }
                }
            } else {
                if (window.FirebaseSync && FirebaseSync.isEnabled()) {
                    FirebaseSync.syncToFirestore(key, value).catch(err => {
                        console.warn(`⚠️ [Storage] Background sync failed for ${key}:`, err.message);
                    });
                }
            }

            return true;
        } catch (error) {
            console.error(`Error saving ${key} to storage:`, error);
            return false;
        }
    },

    // ==========================================
    // 🔒 SAVE WITH CLOUD BLOCK
    // Use this for critical transactions (BKK, Journal, TTB, etc.)
    // Saves locally AND to cloud, but RETURNS FAILURE if cloud rejected it.
    // The calling code must check the result and show an error to the user.
    // ==========================================
    async setWithCloudBlock(key, value, specificItem = null) {
        try {
            // 1. Always save locally first (as cache)
            try {
                localStorage.setItem(key, JSON.stringify(value));
            } catch (localErr) {
                if (localErr.name === 'QuotaExceededError' || localErr.code === 22 || localErr.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                    console.error(`🚨 [Storage] LocalStorage quota exceeded for '${key}'. Skipping local cache in setWithCloudBlock.`);
                    if (!this.USE_CLOUD_STORAGE) return { success: false, localSaved: false, cloudSaved: false, error: 'Memori lokal penuh dan Cloud nonaktif.' };
                } else {
                    throw localErr;
                }
            }

            // 2. Attempt cloud save
            if (this.USE_CLOUD_STORAGE) {
                const dataToSync = specificItem ? [specificItem] : value;
                const cloudSuccess = await this.CloudStorage.save(key, dataToSync);
                if (!cloudSuccess) {
                    const isCloudInit = this.CloudStorage.lastErrorCode === 'cloud-unavailable';
                    this.SyncGuard.add(key, value, isCloudInit);
                    return {
                        success: false, localSaved: true, cloudSaved: false,
                        error: 'Cloud sync gagal. Data tersimpan lokal dan akan dicoba kirim ulang otomatis.'
                    };
                }
                // Remove from queue if previously failed
                if (this.SyncGuard._queue[key]) this.SyncGuard.remove(key);
                return { success: true, localSaved: true, cloudSaved: true };
            }

            return { success: true, localSaved: true, cloudSaved: false };
        } catch (error) {
            console.error(`Error in setWithCloudBlock for ${key}:`, error);
            return { success: false, localSaved: false, cloudSaved: false, error: error.message };
        }
    },

    // Delete data from localStorage
    delete(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('Error deleting from storage:', error);
            return false;
        }
    },

    // Track a deleted ID to prevent it from being restored by sync
    trackDeletion(id) {
        try {
            const deletedIds = this.get(this.KEYS.DELETED_IDS) || [];
            if (!deletedIds.includes(id)) {
                deletedIds.push(id);
                // Keep only last 1000 deleted IDs for performance
                if (deletedIds.length > 1000) deletedIds.shift();
                this.set(this.KEYS.DELETED_IDS, deletedIds);
            }
        } catch (e) {
            console.warn('Error tracking deletion:', e);
        }
    },

    // Untrack a deleted ID when it is recreated to allow sync again
    untrackDeletion(id) {
        try {
            const deletedIds = this.get(this.KEYS.DELETED_IDS) || [];
            const index = deletedIds.indexOf(id);
            if (index !== -1) {
                deletedIds.splice(index, 1);
                // Set skipCloud = true since this is just a local tracker cache
                this.set(this.KEYS.DELETED_IDS, deletedIds, true);
            }
        } catch (e) {
            console.warn('Error untracking deletion:', e);
        }
    },

    // Check if an ID was recently deleted
    isDeleted(id) {
        try {
            const deletedIds = this.get(this.KEYS.DELETED_IDS) || [];
            return deletedIds.includes(id);
        } catch (e) {
            return false;
        }
    },

    // 🛡️ AUTO-MAINTENANCE: Limit storage-heavy items to prevent Storage Full
    limitBugReports() {
        try {
            // 1. Bug Reports - Stricter limit (30 items)
            const MAX_REPORTS = 30;
            const reportsKey = this.KEYS.BUG_REPORTS;
            let reports = this.get(reportsKey);

            if (Array.isArray(reports) && reports.length > MAX_REPORTS) {
                // First try optimizing (stripping screenshots/details)
                if (this.optimizeBugReports) {
                    reports = this.optimizeBugReports();
                }

                // Then hard trim if still too many
                if (reports.length > MAX_REPORTS) {
                    reports = reports.slice(reports.length - MAX_REPORTS);
                    localStorage.setItem(reportsKey, JSON.stringify(reports));
                    console.warn(`🧹 Storage Cleanup: Trimmed bug reports to ${MAX_REPORTS}`);
                }
            }

            // 2. Audit Logs - Truncate if too large (200 items)
            const MAX_AUDIT = 200;
            const auditKey = this.KEYS.AUDIT_LOG;
            const auditLogs = this.get(auditKey);
            if (Array.isArray(auditLogs) && auditLogs.length > MAX_AUDIT) {
                const trimmedAudit = auditLogs.slice(0, MAX_AUDIT); // Keep recent
                localStorage.setItem(auditKey, JSON.stringify(trimmedAudit));
                console.warn(`🧹 Storage Cleanup: Trimmed audit logs from ${auditLogs.length} to ${MAX_AUDIT}`);
            }
        } catch (e) {
            console.warn('Auto-cleanup failed:', e);
        }
    },

    // Clear all ERP data
    clearAll() {
        const confirmed = confirm('Apakah Anda yakin ingin menghapus semua data? Tindakan ini tidak dapat dibatalkan.');
        if (confirmed) {
            Object.values(this.KEYS).forEach(key => {
                this.delete(key);
            });
            this.init();
            return true;
        }
        return false;
    },

    // Export all data as JSON
    exportData() {
        const data = {
            chartOfAccounts: this.get(this.KEYS.CHART_OF_ACCOUNTS),
            journalEntries: this.get(this.KEYS.JOURNAL_ENTRIES),
            config: this.get(this.KEYS.CONFIG),
            transactionCounters: this.get(this.KEYS.TRANSACTION_COUNTERS),
            suppliers: this.get(this.KEYS.SUPPLIERS),
            customers: this.get(this.KEYS.CUSTOMERS),
            warehouses: this.get(this.KEYS.WAREHOUSES),
            items: this.get(this.KEYS.ITEMS),
            taxes: this.get(this.KEYS.TAXES),
            bankAccounts: this.get(this.KEYS.BANK_ACCOUNTS),
            paymentTerms: this.get(this.KEYS.PAYMENT_TERMS),
            departments: this.get(this.KEYS.DEPARTMENTS),
            users: this.get(this.KEYS.USERS),
            roles: this.get(this.KEYS.ROLES),
            paymentVouchers: this.get(this.KEYS.PAYMENT_VOUCHERS),  // ADDED
            purchaseRequisitions: this.get(this.KEYS.PURCHASE_REQUISITIONS),  // ADDED
            exportDate: new Date().toISOString(),
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `erp-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    // Export configuration and master data ONLY (no transactions)
    exportConfigOnly() {
        const data = {
            chartOfAccounts: this.get(this.KEYS.CHART_OF_ACCOUNTS),
            config: this.get(this.KEYS.CONFIG),
            suppliers: this.get(this.KEYS.SUPPLIERS),
            customers: this.get(this.KEYS.CUSTOMERS),
            warehouses: this.get(this.KEYS.WAREHOUSES),
            items: this.get(this.KEYS.ITEMS),
            taxes: this.get(this.KEYS.TAXES),
            bankAccounts: this.get(this.KEYS.BANK_ACCOUNTS),
            paymentTerms: this.get(this.KEYS.PAYMENT_TERMS),
            departments: this.get(this.KEYS.DEPARTMENTS),
            accountMapping: this.get(this.KEYS.ACCOUNT_MAPPING),
            exportType: 'config_only',
            exportDate: new Date().toISOString(),
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `erp-config-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    // Import data from JSON file
    importData(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);

                    // Validate required fields
                    if (!data.chartOfAccounts) {
                        throw new Error('Missing chartOfAccounts in backup file');
                    }
                    if (!data.journalEntries) {
                        throw new Error('Missing journalEntries in backup file');
                    }

                    // Validate data types
                    if (!Array.isArray(data.chartOfAccounts)) {
                        throw new Error('chartOfAccounts must be an array');
                    }
                    if (!Array.isArray(data.journalEntries)) {
                        throw new Error('journalEntries must be an array');
                    }

                    // Config can be null - that's OK (happens when company info not set)
                    // Show warning if config is null
                    let warningMessage = 'Import data akan menimpa data yang ada. Lanjutkan?';
                    if (!data.config) {
                        warningMessage = 'Import data akan menimpa data yang ada.\n\n' +
                            'Note: Backup ini tidak memiliki konfigurasi perusahaan.\n\n' +
                            'Lanjutkan?';
                    }

                    // Confirm before importing
                    const confirmed = confirm(warningMessage);
                    if (confirmed) {
                        // Import core data
                        this.set(this.KEYS.CHART_OF_ACCOUNTS, data.chartOfAccounts);
                        this.set(this.KEYS.JOURNAL_ENTRIES, data.journalEntries);
                        this.set(this.KEYS.CONFIG, data.config); // Can be null

                        // Import additional master data if available
                        if (data.transactionCounters) {
                            this.set(this.KEYS.TRANSACTION_COUNTERS, data.transactionCounters);
                        }
                        if (data.suppliers) {
                            this.set(this.KEYS.SUPPLIERS, data.suppliers);
                        }
                        if (data.customers) {
                            this.set(this.KEYS.CUSTOMERS, data.customers);
                        }
                        if (data.warehouses) {
                            this.set(this.KEYS.WAREHOUSES, data.warehouses);
                        }
                        if (data.items) {
                            this.set(this.KEYS.ITEMS, data.items);
                        }
                        if (data.taxes) {
                            this.set(this.KEYS.TAXES, data.taxes);
                        }
                        if (data.bankAccounts) {
                            this.set(this.KEYS.BANK_ACCOUNTS, data.bankAccounts);
                        }
                        if (data.paymentTerms) {
                            this.set(this.KEYS.PAYMENT_TERMS, data.paymentTerms);
                        }
                        if (data.departments) {
                            this.set(this.KEYS.DEPARTMENTS, data.departments);
                        }
                        if (data.users) {
                            this.set(this.KEYS.USERS, data.users);
                        }
                        if (data.roles) {
                            this.set(this.KEYS.ROLES, data.roles);
                        }
                        if (data.paymentVouchers) {
                            this.set(this.KEYS.PAYMENT_VOUCHERS, data.paymentVouchers);
                        }
                        if (data.purchaseRequisitions) {
                            this.set(this.KEYS.PURCHASE_REQUISITIONS, data.purchaseRequisitions);
                        }

                        resolve(data);
                    } else {
                        resolve(false);
                    }
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = () => reject(new Error('Error membaca file'));
            reader.readAsText(file);
        });
    },

    // ==========================================
    // Transaction Reference Number Management
    // Extension for storage.js
    // ==========================================

    // Add these methods to the Storage object in storage.js

    // Get available transaction types
    getTransactionTypes() {
        return [
            { code: 'JRN', name: 'Jurnal Umum', description: 'General journal entries' },
            { code: 'CSH', name: 'Cash Transaction', description: 'Cash in/out transactions' },
            { code: 'BNK', name: 'Bank Transaction', description: 'Bank transfers, deposits' },
            { code: 'SAL', name: 'Sales', description: 'Sales invoice/customer payment' },
            { code: 'PUR', name: 'Purchase', description: 'Purchase invoice/supplier payment' },
            { code: 'ADJ', name: 'Adjustment', description: 'Account adjustments, corrections' },
            { code: 'DEP', name: 'Depreciation', description: 'Monthly depreciation entries' },
            { code: 'CLS', name: 'Closing', description: 'Month/year-end closing entries' },
            { code: 'S', name: 'Direct Swap', description: 'Direct swap transactions' },
        ];
    },

    // Generate next reference number for a transaction type
    async getNextReferenceNumber(transactionType) {
        // Validate transaction type
        const validTypes = this.getTransactionTypes().map(t => t.code);
        if (!validTypes.includes(transactionType)) {
            console.error(`Invalid transaction type: ${transactionType}`);
            return null;
        }

        let nextCounter = null;

        // ☁️ TRY CLOUD SEQUENCER FIRST
        if (this.USE_CLOUD_STORAGE) {
            nextCounter = await this.CloudSequencer.getNextID(transactionType);
        }

        // FALLBACK TO LOCAL if cloud is slow/dead
        if (!nextCounter) {
            const counters = this.get(this.KEYS.TRANSACTION_COUNTERS) || {};
            const currentCounter = counters[transactionType] || 0;
            nextCounter = currentCounter + 1;

            // Save updated local counter
            counters[transactionType] = nextCounter;
            this.set(this.KEYS.TRANSACTION_COUNTERS, counters);
            console.warn(`🕒 [Storage] Using LOCAL counter for ${transactionType}: ${nextCounter}`);
        } else {
            // Update local counter to match cloud (keep them in sync)
            const counters = this.get(this.KEYS.TRANSACTION_COUNTERS) || {};
            counters[transactionType] = nextCounter;
            localStorage.setItem(this.KEYS.TRANSACTION_COUNTERS, JSON.stringify(counters));
        }

        // Check if counter exceeds maximum
        if (nextCounter >= 999999) {
            alert(`Counter for ${transactionType} has reached maximum (999999). Please use a different transaction type or contact administrator.`);
            return null;
        }

        // Format: TYPE-NNNNNN (6 digits, zero-padded)
        const refNumber = `${transactionType}-${String(nextCounter).padStart(6, '0')}`;
        return refNumber;
    },

    // Preview next reference number without incrementing counter
    previewNextReferenceNumber(transactionType) {
        const counters = this.get(this.KEYS.TRANSACTION_COUNTERS) || {};
        const currentCounter = counters[transactionType] || 0;
        const nextCounter = currentCounter + 1;
        return `${transactionType}-${String(nextCounter).padStart(6, '0')}`;
    },

    // Reset all transaction counters (admin function)
    resetCounters() {
        const confirmed = confirm('PERINGATAN: Reset semua counter transaksi? Counter akan kembali ke 0. Tindakan ini tidak dapat dibatalkan!');
        if (confirmed) {
            const doubleConfirm = confirm('Apakah Anda BENAR-BENAR yakin?');
            if (doubleConfirm) {
                this.set(this.KEYS.TRANSACTION_COUNTERS, {
                    JRN: 0,
                    CSH: 0,
                    BNK: 0,
                    SAL: 0,
                    PUR: 0,
                    ADJ: 0,
                    DEP: 0,
                    CLS: 0,
                });
                alert('Semua counter telah direset ke 0.');
                return true;
            }
        }
        return false;
    },

    // Get current counter value for a transaction type
    getCurrentCounter(transactionType) {
        const counters = this.get(this.KEYS.TRANSACTION_COUNTERS) || {};
        return counters[transactionType] || 0;
    },

    // Self-healing: Recalculate counters based on actual max reference numbers
    async recalculateCounters(syncToCloud = false) {
        const counters = this.get(this.KEYS.TRANSACTION_COUNTERS) || {};
        const entries = this.get(this.KEYS.JOURNAL_ENTRIES) || [];
        const pvs = this.get(this.KEYS.PAYMENT_VOUCHERS) || [];
        const rcvs = this.get(this.KEYS.RECEIPT_VOUCHERS) || [];
        
        let updated = false;

        // Map of prefix to transaction type code
        const typeMap = {
            'JRN': 'JRN', 'CSH': 'CSH', 'BNK': 'BNK',
            'SAL': 'SAL', 'PUR': 'PUR', 'PMT': 'PMT',
            'RCP': 'RCP', 'ADJ': 'ADJ', 'DEP': 'DEP', 'CLS': 'CLS',
            'S': 'S', 'BKK': 'BKK', 'BBK': 'BBK', 'BBM': 'BBM'
        };

        // Track max numbers found
        const maxNumbers = {};

        // 1. Scan Journal Entries
        entries.forEach(entry => {
            if (!entry.reference) return;
            const parts = entry.reference.split('-');
            if (parts.length < 2) return;
            const prefix = parts[0];
            const num = parseInt(parts[1], 10);
            if (!isNaN(num) && typeMap[prefix]) {
                const type = typeMap[prefix];
                if (!maxNumbers[type] || num > maxNumbers[type]) maxNumbers[type] = num;
            }
        });

        // 2. Scan Direct Swaps (Source of Truth for S)
        const swaps = this.get(this.KEYS.DIRECT_SWAPS) || [];
        swaps.forEach(swap => {
            if (!swap.id) return;
            const parts = swap.id.split('-');
            if (parts.length >= 2 && (parts[0] === 'S' || parts[0] === 'SWAP')) {
                const num = parseInt(parts[1], 10);
                if (!isNaN(num) && (!maxNumbers['S'] || num > maxNumbers['S'])) maxNumbers['S'] = num;
            }
        });

        // 3. Scan Payment Vouchers (BKK/BBK)
        pvs.forEach(pv => {
            if (!pv.voucherNumber) return;
            const parts = pv.voucherNumber.split('-');
            if (parts.length >= 2) {
                const type = parts[0]; // BKK or BBK
                const numPart = parts[parts.length - 1]; // NNNN
                const num = parseInt(numPart, 10);
                if (!isNaN(num) && (!maxNumbers[type] || num > maxNumbers[type])) maxNumbers[type] = num;
            }
        });

        // Update local counters
        Object.keys(maxNumbers).forEach(type => {
            if (!counters[type] || maxNumbers[type] > counters[type]) {
                console.log(`🔧 Auto-fixing local counter for ${type}: ${counters[type] || 0} -> ${maxNumbers[type]}`);
                counters[type] = maxNumbers[type];
                updated = true;
            }
        });

        if (updated) {
            localStorage.setItem(this.KEYS.TRANSACTION_COUNTERS, JSON.stringify(counters));
            console.log('✅ Local transaction counters synchronized.');
        }

        // ☁️ SYNC TO CLOUD (Force Repair Cloud Counters)
        if (syncToCloud && this.USE_CLOUD_STORAGE && typeof window.db !== 'undefined') {
            const { doc, setDoc, serverTimestamp } = window.firestore;
            const db = window.db;
            const counterRef = doc(db, 'transactionCounters', 'counters');
            
            console.log('📡 Repairing Cloud Counters via Transaction Data...');
            await setDoc(counterRef, {
                ...counters,
                repairedAt: serverTimestamp(),
                repairedBy: 'system_heal'
            }, { merge: true });
            console.log('✅ Cloud Counters repaired successfully.');
        }
    },

    // Default Chart of Accounts (SAK EMKM compliant) - Gold Refinery Edition
        getDefaultChartOfAccounts() {
  return [
    {
        "code": "1",
        "name": "Aktiva",
        "type": "header",
        "category": "aset",
        "balance": 0
    },
    {
        "code": "11",
        "name": "Aktiva Lancar",
        "type": "header",
        "category": "aset",
        "balance": 0
    },
    {
        "code": "1110",
        "name": "Kas",
        "type": "detail",
        "category": "aset",
        "balance": 0
    },
    {
        "code": "1110-1",
        "name": "Kas Kecil",
        "type": "detail",
        "category": "aset",
        "balance": 0
    },
    {
        "code": "1111",
        "name": "Bank",
        "type": "detail",
        "category": "aset",
        "balance": 0
    },
    {
        "code": "1112",
        "name": "Deposito",
        "type": "detail",
        "category": "aset",
        "balance": 0
    },
    {
        "code": "1113",
        "name": "Piutang Usaha",
        "type": "detail",
        "category": "aset",
        "balance": 0
    },
    {
        "code": "1113-1",
        "name": "Piutang usaha Lokal",
        "type": "detail",
        "category": "aset",
        "balance": 0
    },
    {
        "code": "1113-2",
        "name": "Piiutang Usaha Eksport",
        "type": "detail",
        "category": "aset",
        "balance": 0
    },
    {
        "code": "1114",
        "name": "Piutang Lain lain",
        "type": "detail",
        "category": "aset",
        "balance": 0
    },
    {
        "code": "1115",
        "name": "Persediaan",
        "type": "detail",
        "category": "aset",
        "balance": 0
    },
    {
        "code": "1115-1",
        "name": "Persediaan bahan",
        "type": "detail",
        "category": "aset",
        "balance": 0
    },
    {
        "code": "1115-2",
        "name": "Persediaan dalam proses",
        "type": "detail",
        "category": "aset",
        "balance": 0
    },
    {
        "code": "1115-3",
        "name": "Persediaan barang jadi",
        "type": "detail",
        "category": "aset",
        "balance": 0
    },
    {
        "code": "1116",
        "name": "Investasi",
        "type": "detail",
        "category": "aset",
        "balance": 0
    },
    {
        "code": "1116-1",
        "name": "Saham",
        "type": "detail",
        "category": "aset",
        "balance": 0
    },
    {
        "code": "1117",
        "name": "Perlengkapan Kantor",
        "type": "detail",
        "category": "aset",
        "balance": 0
    },
    {
        "code": "1117-1",
        "name": "Stasionery dan lain nya",
        "type": "detail",
        "category": "aset",
        "balance": 0
    },
    {
        "code": "1118",
        "name": "Biaya Dibayar dimuka",
        "type": "detail",
        "category": "aset",
        "balance": 0
    },
    {
        "code": "1118-1",
        "name": "Sewa dibayar dimuka",
        "type": "detail",
        "category": "aset",
        "balance": 0
    },
    {
        "code": "1118-2",
        "name": "Asuransi dibayar dimuka",
        "type": "detail",
        "category": "aset",
        "balance": 0
    },
    {
        "code": "1119",
        "name": "Uang titipan",
        "type": "detail",
        "category": "aset",
        "balance": 0
    },
    {
        "code": "1119-1",
        "name": "Uang titipan",
        "type": "detail",
        "category": "aset",
        "balance": 0
    },
    {
        "code": "1120",
        "name": "Pajak Dibayar dimuka",
        "type": "detail",
        "category": "aset",
        "balance": 0
    },
    {
        "code": "1120-1",
        "name": "PPN",
        "type": "detail",
        "category": "aset",
        "balance": 0
    },
    {
        "code": "1120-2",
        "name": "PPh 21",
        "type": "detail",
        "category": "aset",
        "balance": 0
    },
    {
        "code": "1120-3",
        "name": "PPh 22",
        "type": "detail",
        "category": "aset",
        "balance": 0
    },
    {
        "code": "1120-4",
        "name": "PPh 23",
        "type": "detail",
        "category": "aset",
        "balance": 0
    },
    {
        "code": "1120-5",
        "name": "PPh 25",
        "type": "detail",
        "category": "aset",
        "balance": 0
    },
    {
        "code": "12",
        "name": "Aktiva Tetap Berwujud",
        "type": "header",
        "category": "aset",
        "balance": 0
    },
    {
        "code": "1201",
        "name": "Harga Perolehan",
        "type": "detail",
        "category": "aset",
        "balance": 0
    },
    {
        "code": "1201-1",
        "name": "Tanah",
        "type": "detail",
        "category": "aset",
        "balance": 0
    },
    {
        "code": "1201-2",
        "name": "Bangunan",
        "type": "detail",
        "category": "aset",
        "balance": 0
    },
    {
        "code": "1201-3",
        "name": "Kendaraan",
        "type": "detail",
        "category": "aset",
        "balance": 0
    },
    {
        "code": "1201-4",
        "name": "Mesin",
        "type": "detail",
        "category": "aset",
        "balance": 0
    },
    {
        "code": "1201-5",
        "name": "Inventaris dan Peralatan Kantor",
        "type": "detail",
        "category": "aset",
        "balance": 0
    },
    {
        "code": "1202",
        "name": "Akumulasi Penyusutan",
        "type": "detail",
        "category": "aset",
        "balance": 0
    },
    {
        "code": "1202-1",
        "name": "Bangunan",
        "type": "detail",
        "category": "aset",
        "balance": 0
    },
    {
        "code": "1202-2",
        "name": "Kendaraan",
        "type": "detail",
        "category": "aset",
        "balance": 0
    },
    {
        "code": "1202-3",
        "name": "Mesin",
        "type": "detail",
        "category": "aset",
        "balance": 0
    },
    {
        "code": "1202-4",
        "name": "Inventaris dan Peralatan Kantor",
        "type": "detail",
        "category": "aset",
        "balance": 0
    },
    {
        "code": "13",
        "name": "Aktiva Tetap Tak Berwujud",
        "type": "header",
        "category": "aset",
        "balance": 0
    },
    {
        "code": "1301-1",
        "name": "Biaya Pra Operasi",
        "type": "detail",
        "category": "aset",
        "balance": 0
    },
    {
        "code": "1301-2",
        "name": "Goodwill",
        "type": "detail",
        "category": "aset",
        "balance": 0
    },
    {
        "code": "2",
        "name": "Passiva",
        "type": "header",
        "category": "kewajiban",
        "balance": 0
    },
    {
        "code": "21",
        "name": "Kewajiban Lancar",
        "type": "header",
        "category": "kewajiban",
        "balance": 0
    },
    {
        "code": "2110-1",
        "name": "Hutang bank BCA",
        "type": "detail",
        "category": "kewajiban",
        "balance": 0
    },
    {
        "code": "2111",
        "name": "Hutang Usaha",
        "type": "detail",
        "category": "kewajiban",
        "balance": 0
    },
    {
        "code": "2111-1",
        "name": "Hutang Dagang",
        "type": "detail",
        "category": "kewajiban",
        "balance": 0
    },
    {
        "code": "2112",
        "name": "Hutang lain lain",
        "type": "detail",
        "category": "kewajiban",
        "balance": 0
    },
    {
        "code": "2112-1",
        "name": "Hutang biaya lain lain",
        "type": "detail",
        "category": "kewajiban",
        "balance": 0
    },
    {
        "code": "2112-2",
        "name": "Hutang pembelian kendaraan",
        "type": "detail",
        "category": "kewajiban",
        "balance": 0
    },
    {
        "code": "2113",
        "name": "Biaya yang masih harus dibayar",
        "type": "detail",
        "category": "kewajiban",
        "balance": 0
    },
    {
        "code": "2113-1",
        "name": "Listrik",
        "type": "detail",
        "category": "kewajiban",
        "balance": 0
    },
    {
        "code": "2113-2",
        "name": "Air",
        "type": "detail",
        "category": "kewajiban",
        "balance": 0
    },
    {
        "code": "2113-3",
        "name": "Telp",
        "type": "detail",
        "category": "kewajiban",
        "balance": 0
    },
    {
        "code": "2113-4",
        "name": "Gaji",
        "type": "detail",
        "category": "kewajiban",
        "balance": 0
    },
    {
        "code": "2113-5",
        "name": "Lain lain",
        "type": "detail",
        "category": "kewajiban",
        "balance": 0
    },
    {
        "code": "2114",
        "name": "Hutang pajak",
        "type": "detail",
        "category": "kewajiban",
        "balance": 0
    },
    {
        "code": "2114-1",
        "name": "PPN",
        "type": "detail",
        "category": "kewajiban",
        "balance": 0
    },
    {
        "code": "2114-2",
        "name": "Hutang PPh 21",
        "type": "detail",
        "category": "kewajiban",
        "balance": 0
    },
    {
        "code": "2114-3",
        "name": "Hutang PPh 22",
        "type": "detail",
        "category": "kewajiban",
        "balance": 0
    },
    {
        "code": "2114-4",
        "name": "Hutang PPh 23",
        "type": "detail",
        "category": "kewajiban",
        "balance": 0
    },
    {
        "code": "2114-5",
        "name": "Hutang PPh Pasal 4 ayat 2",
        "type": "detail",
        "category": "kewajiban",
        "balance": 0
    },
    {
        "code": "2114-6",
        "name": "Hutang PPh Badan",
        "type": "detail",
        "category": "kewajiban",
        "balance": 0
    },
    {
        "code": "22",
        "name": "Hutang jangka Panjang",
        "type": "header",
        "category": "kewajiban",
        "balance": 0
    },
    {
        "code": "2211",
        "name": "Hutang Bank",
        "type": "detail",
        "category": "kewajiban",
        "balance": 0
    },
    {
        "code": "2211-1",
        "name": "Hutang bank \"X\"",
        "type": "detail",
        "category": "kewajiban",
        "balance": 0
    },
    {
        "code": "23",
        "name": "Ekuitas",
        "type": "header",
        "category": "kewajiban",
        "balance": 0
    },
    {
        "code": "2310",
        "name": "Modal Disetor",
        "type": "detail",
        "category": "kewajiban",
        "balance": 0
    },
    {
        "code": "2310-1",
        "name": "Modal disetor",
        "type": "detail",
        "category": "kewajiban",
        "balance": 0
    },
    {
        "code": "2311",
        "name": "Saldo Laba",
        "type": "detail",
        "category": "kewajiban",
        "balance": 0
    },
    {
        "code": "2311-1",
        "name": "Laba Berjalan",
        "type": "detail",
        "category": "kewajiban",
        "balance": 0
    },
    {
        "code": "2311-2",
        "name": "Saldo laba",
        "type": "detail",
        "category": "kewajiban",
        "balance": 0
    },
    {
        "code": "2312",
        "name": "Deviden",
        "type": "detail",
        "category": "kewajiban",
        "balance": 0
    },
    {
        "code": "2312-1",
        "name": "Deviden tunai",
        "type": "detail",
        "category": "kewajiban",
        "balance": 0
    },
    {
        "code": "3",
        "name": "Pendapatan",
        "type": "header",
        "category": "pendapatan",
        "balance": 0
    },
    {
        "code": "31",
        "name": "Penjualan",
        "type": "header",
        "category": "pendapatan",
        "balance": 0
    },
    {
        "code": "3110",
        "name": "Penjualan Lokal",
        "type": "detail",
        "category": "pendapatan",
        "balance": 0
    },
    {
        "code": "3110-1",
        "name": "Penjualan Lokal",
        "type": "detail",
        "category": "pendapatan",
        "balance": 0
    },
    {
        "code": "3120",
        "name": "Penjualan Export",
        "type": "detail",
        "category": "pendapatan",
        "balance": 0
    },
    {
        "code": "3120-1",
        "name": "Penjualan Export",
        "type": "detail",
        "category": "pendapatan",
        "balance": 0
    },
    {
        "code": "4",
        "name": "Harga Pokok Penjualan",
        "type": "header",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "41",
        "name": "Harga Pokok Penjualan",
        "type": "header",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "4110",
        "name": "Direct Labour",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "4110-1",
        "name": "Upah Buruh /Harian",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "4110-2",
        "name": "THR dan Bonus",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "4120",
        "name": "Pendapatan Ekspor Perhiasan Emas (PPN 0%)",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "4120-1",
        "name": "Gaji staf",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "4120-2",
        "name": "THR dan Bonus",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "4120-3",
        "name": "Lembur",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "4120-4",
        "name": "Tunjangan lainnya",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "4120-5",
        "name": "Listrik",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "4120-6",
        "name": "Air",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "4120-7",
        "name": "Gas",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "4120-8",
        "name": "Bahan pembantu",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "4120-9",
        "name": "Biaya Maintanance Mesin",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "4120-10",
        "name": "Biaya Maintanance Gedung",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "4120-11",
        "name": "Biaya Penyusutan Mesin",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "4120-12",
        "name": "Biaya Sewa Pabrik",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "4120-13",
        "name": "Biaya Bahan bakar Mesin",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "4120-14",
        "name": "Biaya Asuransi Mesin dan bangunan",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "4120-20",
        "name": "Biaya lain lain",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "42",
        "name": "HPP Penjualan Emas",
        "type": "header",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "4210",
        "name": "HPP Penjualan Emas",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "4210-1",
        "name": "HPP Penjualan Lokal",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "4210-2",
        "name": "HPP Penjualan Export",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5",
        "name": "Biaya Operasional",
        "type": "header",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "51",
        "name": "Biaya Penjualan",
        "type": "header",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5110",
        "name": "Biaya Gaji",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5110-1",
        "name": "Biaya Gaji Karyawan",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5110-2",
        "name": "THR dan Bonus",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5110-3",
        "name": "Tunjangan Transport",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5110-9",
        "name": "Tunjangan lainnya",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5111",
        "name": "Biaya kesejahteraan pegawai",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5111-1",
        "name": "BPJS",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5111-2",
        "name": "Uang Makan",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5111-9",
        "name": "Lainnya",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5112",
        "name": "Biaya Transportasi",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5112-1",
        "name": "Bahan bakar",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5112-2",
        "name": "Taxi dll",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5112-9",
        "name": "Lainnya",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5113",
        "name": "Biaya iklan dan Promosi",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5113-1",
        "name": "Biaya Promosi",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5113-2",
        "name": "Biaya Marketing Tools",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5113-3",
        "name": "Biaya iklan",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5114",
        "name": "HPP Penjualan LM Lokal",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5114-1",
        "name": "Sewa Stand",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5114-9",
        "name": "Sewa lainnya",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5115",
        "name": "HPP Penjualan LM Import (Landed Cost)",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5115-1",
        "name": "alat Tulis Stasionery",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5116",
        "name": "Biaya Pameran",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5116-1",
        "name": "Biaya Booth",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5116-2",
        "name": "Biaya cetakan",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5116-9",
        "name": "Biaya lainnya",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5117",
        "name": "Biaya lain lain",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5117-1",
        "name": "Biaya lainnya",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "52",
        "name": "Biaya Administrasi dan Umum",
        "type": "header",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5210",
        "name": "Biaya Gaji",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5210-1",
        "name": "Biaya Gaji Karyawan",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5210-2",
        "name": "THR dan Bonus",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5210-3",
        "name": "Tunjangan Transport",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5210-9",
        "name": "Tunjangan lainnya",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5211",
        "name": "Biaya kesejahteraan pegawai",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5211-1",
        "name": "BPJS",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5211-2",
        "name": "Uang Makan",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5211-9",
        "name": "Lainnya",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5212",
        "name": "Biaya Transportasi",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5212-1",
        "name": "Bahan bakar",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5212-2",
        "name": "Taxi dll",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5212-9",
        "name": "Lainnya",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5213",
        "name": "Biaya Utilitas",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5213-1",
        "name": "Listrik",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5213-2",
        "name": "Air",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5213-3",
        "name": "Telpon",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5214",
        "name": "Biaya Sewa",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5214-1",
        "name": "Sewa Kantor",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5214-9",
        "name": "Sewa lainnya",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5215",
        "name": "Biaya Perlengkapan kantor",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5215-1",
        "name": "alat Tulis Stasionery",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5215-2",
        "name": "Cetakan",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5216",
        "name": "Biaya Jasa profesional",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5216-1",
        "name": "Biaya Notaris dan Konsultan hukum",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5216-2",
        "name": "Biaya Akuntan",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5216-9",
        "name": "Biaya profesional lainnya",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5217",
        "name": "Biaya Penyusutan",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5217-1",
        "name": "Biaya Penyusutan Kendaraan",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5217-2",
        "name": "Biaya Penyusutan Inventaris Kantor",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5218",
        "name": "Biaya Amortisasi",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5218-1",
        "name": "Biaya Amortisasi Pra Operasi",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5218-9",
        "name": "Biaya Amortisasi Aktiva Tak berwujud lainnya",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5219",
        "name": "Biaya pajak bumi dan bangunan",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5219-1",
        "name": "PBB",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5220",
        "name": "Biaya pajak lainnya",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5220-1",
        "name": "PPh pasal 4 ayat 2",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5220-2",
        "name": "pajak penghasilan tahunan",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5220-9",
        "name": "Biaya pajak lainnya",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5225",
        "name": "Biaya operasional lainnya",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "5225-1",
        "name": "Biaya lainnya",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "6",
        "name": "Biaya dan Pendapatan diluar usaha",
        "type": "header",
        "category": "diluar_usaha",
        "balance": 0
    },
    {
        "code": "61",
        "name": "Biaya diluar usaha",
        "type": "header",
        "category": "diluar_usaha",
        "balance": 0
    },
    {
        "code": "6110",
        "name": "Laba / Rugi Selisih Kurs Valas USD & Biaya Bunga Bank",
        "type": "detail",
        "category": "diluar_usaha",
        "balance": 0
    },
    {
        "code": "6110-1",
        "name": "Biaya bunga bank",
        "type": "detail",
        "category": "diluar_usaha",
        "balance": 0
    },
    {
        "code": "6110-2",
        "name": "Pajak jasa giro",
        "type": "detail",
        "category": "diluar_usaha",
        "balance": 0
    },
    {
        "code": "6110-3",
        "name": "Biaya administrasi bank",
        "type": "detail",
        "category": "diluar_usaha",
        "balance": 0
    },
    {
        "code": "6110-9",
        "name": "Biaya bunga lainnya",
        "type": "detail",
        "category": "diluar_usaha",
        "balance": 0
    },
    {
        "code": "6111",
        "name": "Biaya selisih kurs",
        "type": "detail",
        "category": "diluar_usaha",
        "balance": 0
    },
    {
        "code": "6111-1",
        "name": "Selisih kurs",
        "type": "detail",
        "category": "diluar_usaha",
        "balance": 0
    },
    {
        "code": "6115",
        "name": "Biaya lain diluar usaha",
        "type": "detail",
        "category": "diluar_usaha",
        "balance": 0
    },
    {
        "code": "6115-1",
        "name": "Rugi penjualan aktiva",
        "type": "detail",
        "category": "diluar_usaha",
        "balance": 0
    },
    {
        "code": "6115-9",
        "name": "Biaya diluar usaha lainnya",
        "type": "detail",
        "category": "diluar_usaha",
        "balance": 0
    },
    {
        "code": "62",
        "name": "Pendapatan diluar usaha",
        "type": "header",
        "category": "diluar_usaha",
        "balance": 0
    },
    {
        "code": "6210",
        "name": "Pendapatan bunga",
        "type": "detail",
        "category": "diluar_usaha",
        "balance": 0
    },
    {
        "code": "6210-1",
        "name": "Pendapatan bunga bank",
        "type": "detail",
        "category": "diluar_usaha",
        "balance": 0
    },
    {
        "code": "6210-2",
        "name": "Pendapatan bunga lainnya",
        "type": "detail",
        "category": "diluar_usaha",
        "balance": 0
    },
    {
        "code": "6215",
        "name": "Pendapatan lainnya",
        "type": "detail",
        "category": "diluar_usaha",
        "balance": 0
    },
    {
        "code": "6215-1",
        "name": "Pendapatan jasa lainnya",
        "type": "detail",
        "category": "diluar_usaha",
        "balance": 0
    },
    {
        "code": "6215-2",
        "name": "Laba penjualan aktifa",
        "type": "detail",
        "category": "diluar_usaha",
        "balance": 0
    },
    {
        "code": "6215-9",
        "name": "Pendapatan lainnya",
        "type": "detail",
        "category": "diluar_usaha",
        "balance": 0
    },
    {
        "code": "1157",
        "name": "Persediaan Emas Murni 999.9 (LM Lokal - Vault Utama)",
        "type": "detail",
        "category": "aset",
        "balance": 0
    },
    {
        "code": "1158",
        "name": "Persediaan Emas Murni 999.9 (LM Import - Vault Impor)",
        "type": "detail",
        "category": "aset",
        "balance": 0
    },
    {
        "code": "1159",
        "name": "Persediaan Emas Dalam Perjalanan Kurir (Transit)",
        "type": "detail",
        "category": "aset",
        "balance": 0
    },
    {
        "code": "11502",
        "name": "Persediaan Emas WIP (Vault Production WIP)",
        "type": "detail",
        "category": "aset",
        "balance": 0
    },
    {
        "code": "1160",
        "name": "Persediaan Perhiasan Emas Siap Ekspor (Vault Ekspor)",
        "type": "detail",
        "category": "aset",
        "balance": 0
    },
    {
        "code": "1152",
        "name": "Persediaan Scrap Retur Leburan",
        "type": "detail",
        "category": "aset",
        "balance": 0
    },
    {
        "code": "1125",
        "name": "Bank Valas USD (Mandiri/BCA Ekspor)",
        "type": "detail",
        "category": "aset",
        "balance": 0
    },
    {
        "code": "5118",
        "name": "Biaya Susut Lebur Emas (Gold Loss)",
        "type": "detail",
        "category": "beban",
        "balance": 0
    },
    {
        "code": "1132",
        "name": "Piutang Usaha Ekspor USD",
        "type": "detail",
        "category": "aset",
        "balance": 0
    },
    {
        "code": "1135",
        "name": "PPh 22 Dibayar Di Muka (Impor Emas)",
        "type": "detail",
        "category": "aset",
        "balance": 0
    },
    {
        "code": "5150",
        "name": "Biaya Freight & Insurance Impor / Ekspor",
        "type": "detail",
        "category": "beban",
        "balance": 0
    }
];
}
,

    // --- CHART OF ACCOUNTS ---
        getChartOfAccounts() {
        // Always load official CFO Chart of Accounts from Excel
        const officialCoa = this.getDefaultChartOfAccounts();
        this.set(this.KEYS.CHART_OF_ACCOUNTS, officialCoa);
        return officialCoa;
    },

    // --- ITEMS ---
    getItems() {
        return this.get(this.KEYS.ITEMS) || [];
    },
    addItem(item) {
        const items = this.getItems();
        items.push(item);
        this.set(this.KEYS.ITEMS, items);
    },
    updateItem(id, updatedItem) {
        const items = this.getItems();
        const index = items.findIndex(i => i.id === id);
        if (index !== -1) {
            items[index] = updatedItem;
            this.set(this.KEYS.ITEMS, items);
            return true;
        }
        return false;
    },
    deleteItem(id) {
        const items = this.getItems();
        const filtered = items.filter(i => i.id !== id);
        this.set(this.KEYS.ITEMS, filtered);
    },

    // --- TAXES ---
    getTaxes() {
        return this.get(this.KEYS.TAXES) || [];
    },
    addTax(tax) {
        const taxes = this.getTaxes();
        taxes.push(tax);
        this.set(this.KEYS.TAXES, taxes);
    },
    updateTax(id, updatedTax) {
        const taxes = this.getTaxes();
        const index = taxes.findIndex(t => t.id === id);
        if (index !== -1) {
            taxes[index] = updatedTax;
            this.set(this.KEYS.TAXES, taxes);
            return true;
        }
        return false;
    },
    deleteTax(id) {
        const taxes = this.getTaxes();
        const filtered = taxes.filter(t => t.id !== id);
        this.set(this.KEYS.TAXES, filtered);
    },

    // --- BANK ACCOUNTS ---
    getBankAccounts() {
        const accounts = this.get(this.KEYS.BANK_ACCOUNTS) || [];
        // Deduplicate by id — guard against cloud sync race conditions
        const seen = new Map();
        for (const acc of accounts) {
            if (acc && acc.id && !seen.has(acc.id)) {
                seen.set(acc.id, acc);
            }
        }
        return Array.from(seen.values());
    },
    addBankAccount(account) {
        const accounts = this.getBankAccounts();
        accounts.push(account);
        this.set(this.KEYS.BANK_ACCOUNTS, accounts);
    },
    updateBankAccount(id, updatedAccount) {
        const accounts = this.getBankAccounts();
        const index = accounts.findIndex(a => a.id === id);
        if (index !== -1) {
            accounts[index] = updatedAccount;
            this.set(this.KEYS.BANK_ACCOUNTS, accounts);
            return true;
        }
        return false;
    },
    async deleteBankAccount(id) {
        // ── 1. Track deletion FIRST so onSnapshot merge will skip this id ──
        this.trackDeletion(id);

        // ── 2. Delete from Cloud FIRST (create tombstone + deleteDoc) ──
        //    This must happen BEFORE updating localStorage to avoid race condition
        //    where CloudStorage.save() re-uploads the full array (without deleting the doc)
        if (typeof FirebaseSync !== 'undefined' && FirebaseSync.isEnabled()) {
            try {
                await FirebaseSync.deleteFromCloud(this.KEYS.BANK_ACCOUNTS, id);
                console.log(`✅ [Bank] Deleted ${id} from cloud with tombstone.`);
            } catch (e) {
                console.warn('Tombstone write failed for bank account:', e);
            }
        }

        // ── 3. Update localStorage (skipCloud = true to avoid re-uploading) ──
        const accounts = this.getBankAccounts();
        const filtered = accounts.filter(a => a.id !== id);
        await this.set(this.KEYS.BANK_ACCOUNTS, filtered, true); // skipCloud!
        return true;
    },

    // Helper: Get next available bank GL code (112x series)
    getNextBankGLCode() {
        const coa = this.getChartOfAccounts() || [];

        // Collect ALL codes in CoA that are in the 112x bank range
        const allCoaCodes = coa
            .map(acc => String(acc.code))
            .filter(code => code.startsWith('112') && /^\d+$/.test(code))
            .map(code => parseInt(code));

        // Also collect all GL codes from active bank accounts
        const banks = this.getBankAccounts() || [];
        const activeBankGlCodes = banks
            .map(acc => acc.glAccount)
            .filter(code => code && String(code).startsWith('112') && /^\d+$/.test(String(code)))
            .map(code => parseInt(String(code)));

        // Union of both sets — never reuse anything seen in either
        const allUsedCodes = new Set([...allCoaCodes, ...activeBankGlCodes]);

        // Find the lowest available code starting from 1121
        let nextCode = 1121;
        while (allUsedCodes.has(nextCode)) {
            nextCode++;
        }

        return String(nextCode);
    },

    // Helper: Create GL Account entry for bank
    createBankGLAccount(bankName) {
        const glCode = this.getNextBankGLCode();
        const coa = this.getChartOfAccounts() || [];

        // Create new CoA entry for this bank
        const newAccount = {
            code: glCode,
            name: `Bank ${bankName}`,
            type: 'detail',
            category: 'aset',
            balance: 0
        };

        coa.push(newAccount);

        // Sort by code to maintain order
        coa.sort((a, b) => a.code.localeCompare(b.code));

        this.set(this.KEYS.CHART_OF_ACCOUNTS, coa);

        return glCode;
    },

    // Helper: Update GL Account name for bank
    updateBankGLAccount(glCode, newBankName) {
        if (!glCode) return false;
        const coa = this.getChartOfAccounts() || [];
        const index = coa.findIndex(acc => acc.code === glCode);

        if (index !== -1) {
            coa[index].name = `Bank ${newBankName}`;
            this.set(this.KEYS.CHART_OF_ACCOUNTS, coa);
            return true;
        }
        return false;
    },

    // Helper: Delete GL Account entry for bank (with safety check)
    async deleteBankGLAccount(glCode) {
        if (!glCode) return false;

        const coa = this.getChartOfAccounts() || [];
        const account = coa.find(acc => acc.code === glCode);

        if (!account) {
            console.warn(`GL Account ${glCode} not found`);
            return false;
        }

        // Safety: don't delete if account has balance
        if (account.balance !== 0) {
            console.error(`Cannot delete GL Account ${glCode}: has non-zero balance (${account.balance})`);
            return false;
        }

        // ── 1. Track deletion FIRST ──
        this.trackDeletion(glCode);

        // ── 2. Delete from Cloud FIRST (tombstone + deleteDoc) ──
        if (typeof FirebaseSync !== 'undefined' && FirebaseSync.isEnabled()) {
            try {
                await FirebaseSync.deleteFromCloud(this.KEYS.CHART_OF_ACCOUNTS, glCode);
                console.log(`✅ [GL] Deleted GL ${glCode} from cloud with tombstone.`);
            } catch (e) {
                console.warn('Tombstone write failed for GL account:', e);
            }
        }

        // ── 3. Update localStorage (skipCloud!) ──
        const filtered = coa.filter(acc => acc.code !== glCode);
        await this.set(this.KEYS.CHART_OF_ACCOUNTS, filtered, true);

        return true;
    },

    // --- PAYMENT TERMS ---
    getPaymentTerms() {
        return this.get(this.KEYS.PAYMENT_TERMS) || [];
    },
    addPaymentTerm(term) {
        const terms = this.getPaymentTerms();
        terms.push(term);
        this.set(this.KEYS.PAYMENT_TERMS, terms);
    },
    updatePaymentTerm(id, updatedTerm) {
        const terms = this.getPaymentTerms();
        const index = terms.findIndex(t => t.id === id);
        if (index !== -1) {
            terms[index] = updatedTerm;
            this.set(this.KEYS.PAYMENT_TERMS, terms);
            return true;
        }
        return false;
    },
    deletePaymentTerm(id) {
        const terms = this.getPaymentTerms();
        const filtered = terms.filter(t => t.id !== id);
        this.set(this.KEYS.PAYMENT_TERMS, filtered);
    },

    // --- DEPARTMENTS ---
    getOfficialDepartments() {
        return [
            { code: 'FIN', name: 'Finance & Accounting (including Tax)', budget: 150000000, description: 'Finance, Accounting & Tax' },
            { code: 'HR', name: 'HR / Personalia', budget: 100000000, description: 'HRD, Recruitment, Performance, Security & GA' },
            { code: 'LEGAL', name: 'Corporate Legal', budget: 100000000, description: 'Regulatory, Litigation & IP, Paralegal' },
            { code: 'SALES', name: 'Sales & Marketing', budget: 200000000, description: 'Sales, Marketing & Brand Strategy' },
            { code: 'IT', name: 'Information Technology', budget: 75000000, description: 'IT Infrastructure, Security & Software Development' },
            { code: 'PROC', name: 'Procurement', budget: 100000000, description: 'Raw Material, Production Supply & General Procurement' },
            { code: 'PROD', name: 'Production & Operations', budget: 500000000, description: 'QC Receiving, Lab, Production Process, Finishing & Warehouse' }
        ];
    },

    getDepartmentCode(nameOrCode) {
        if (!nameOrCode) return 'PROD';
        const str = String(nameOrCode).trim().toUpperCase();
        if (str.includes('FIN') || str.includes('ACCOUNTING') || str.includes('TAX')) return 'FIN';
        if (str.includes('HR') || str.includes('HUMAN') || str.includes('PERSONALIA') || str.includes('SECURITY')) return 'HR';
        if (str.includes('LEGAL') || str.includes('HUKUM')) return 'LEGAL';
        if (str.includes('SALE') || str.includes('MARKETING') || str.includes('SLS') || str.includes('MKT')) return 'SALES';
        if (str.includes('IT') || str.includes('INFORMATION') || str.includes('SOFTWARE')) return 'IT';
        if (str.includes('PROC') || str.includes('PURCHASING') || str.includes('BUYING')) return 'PROC';
        if (str.includes('PROD') || str.includes('REFIN') || str.includes('QC') || str.includes('LAB') || str.includes('WAREHOUSE') || str.includes('GUDANG')) return 'PROD';
        return nameOrCode;
    },

    isSecurityEmployee(emp) {
        if (!emp) return false;
        const dept = String(emp.department || '').toLowerCase();
        const div = String(emp.division || emp.job_level || '').toLowerCase();
        const pos = String(emp.position || '').toLowerCase();
        return dept.includes('security') || div.includes('security') || pos.includes('security') || pos.includes('satpam');
    },

    getDepartments() {
        const official = this.getOfficialDepartments();
        // Always persist the clean 7 official departments list without duplicates
        this.set(this.KEYS.DEPARTMENTS, official);
        return official;
    },
    addDepartment(dept) {
        const departments = this.getDepartments();
        departments.push(dept);
        this.set(this.KEYS.DEPARTMENTS, departments);
    },
    updateDepartment(id, updatedDept) {
        const departments = this.getDepartments();
        const index = departments.findIndex(d => d.id === id);
        if (index !== -1) {
            departments[index] = updatedDept;
            this.set(this.KEYS.DEPARTMENTS, departments);
            return true;
        }
        return false;
    },
    deleteDepartment(id) {
        const departments = this.getDepartments();
        const filtered = departments.filter(d => d.id !== id);
        this.set(this.KEYS.DEPARTMENTS, filtered);
    },
    // --- CUSTOMERS ---
    getCustomers() {
        return this.get(this.KEYS.CUSTOMERS) || [];
    },
    addCustomer(customer) {
        const customers = this.getCustomers();
        customers.push(customer);
        this.set(this.KEYS.CUSTOMERS, customers);
    },
    updateCustomer(id, updatedCustomer) {
        const customers = this.getCustomers();
        const index = customers.findIndex(c => c.id === id);
        if (index !== -1) {
            customers[index] = updatedCustomer;
            this.set(this.KEYS.CUSTOMERS, customers);
            return true;
        }
        return false;
    },
    deleteCustomer(id) {
        const customers = this.getCustomers();
        const filtered = customers.filter(c => String(c.id) !== String(id));
        this.set(this.KEYS.CUSTOMERS, filtered);
    },

    // --- SUPPLIERS ---
    getSuppliers() {
        return this.get(this.KEYS.SUPPLIERS) || [];
    },
    async addSupplier(supplier) {
        const suppliers = this.getSuppliers();

        // Check for duplicate by code
        const existingByCode = suppliers.find(s => s.code === supplier.code);
        if (existingByCode) {
            console.warn(`⚠️  Supplier with code ${supplier.code} already exists`);
            throw new Error(`Supplier dengan kode ${supplier.code} sudah ada`);
        }

        // Check for duplicate by name (case-insensitive)
        const existingByName = suppliers.find(s =>
            s.name.toLowerCase() === supplier.name.toLowerCase()
        );
        if (existingByName) {
            console.warn(`⚠️  Supplier with name "${supplier.name}" already exists`);
            throw new Error(`Supplier dengan nama "${supplier.name}" sudah ada`);
        }

        suppliers.push(supplier);

        // Use setWithCloudBlock to guarantee cloud save even if localStorage is full
        const result = await this.setWithCloudBlock(this.KEYS.SUPPLIERS, suppliers);
        if (result && result.success === false) {
            throw new Error('Gagal menyimpan ke server: ' + (result.error || 'Unknown error'));
        }

        console.log('✅ Supplier added and saved to cloud.');
        return true;
    },
    async updateSupplier(id, updatedSupplier) {
        const suppliers = this.getSuppliers();
        const index = suppliers.findIndex(s => s.id === id);

        if (index !== -1) {
            suppliers[index] = updatedSupplier;

            // Use setWithCloudBlock to guarantee cloud save even if localStorage is full
            const result = await this.setWithCloudBlock(this.KEYS.SUPPLIERS, suppliers);
            if (result && result.success === false) {
                throw new Error('Gagal menyimpan ke server: ' + (result.error || 'Unknown error'));
            }

            console.log('✅ Supplier updated and saved to cloud.');
            return true;
        }

        return false;
    },
    async deleteSupplier(id) {
        const suppliers = this.getSuppliers();
        const filtered = suppliers.filter(s => s.id !== id);

        // Use setWithCloudBlock to guarantee cloud save even if localStorage is full
        const result = await this.setWithCloudBlock(this.KEYS.SUPPLIERS, filtered);
        if (result && result.success === false) {
            throw new Error('Gagal menghapus dari server: ' + (result.error || 'Unknown error'));
        }

        // Also delete from cloud individually via tombstone for cross-user safety
        if (typeof FirebaseSync !== 'undefined' && FirebaseSync.isEnabled()) {
            await FirebaseSync.deleteFromCloud(this.KEYS.SUPPLIERS, id).catch(e =>
                console.warn('Tombstone write failed for supplier:', e)
            );
        }

        this.trackDeletion(id);
        console.log('✅ Supplier deleted and removed from cloud.');
        return true;
    },

    // Fix missing IDs in suppliers (safe migration)
    fixMissingIds() {
        console.log('🔧 Fixing missing IDs in master data...');

        // Fix Suppliers
        const suppliers = this.getSuppliers();
        let suppliersFixed = 0;
        suppliers.forEach((s, i) => {
            if (!s.id) {
                s.id = s.code || `SUP-${Date.now()}-${i}`;
                suppliersFixed++;
            }
        });
        if (suppliersFixed > 0) {
            this.set(this.KEYS.SUPPLIERS, suppliers);
            console.log(`✅ Fixed ${suppliersFixed} suppliers`);
        }

        // Fix Customers
        const customers = this.getCustomers();
        let customersFixed = 0;
        customers.forEach((c, i) => {
            if (!c.id) {
                c.id = c.code || `CUST-${Date.now()}-${i}`;
                customersFixed++;
            }
        });
        if (customersFixed > 0) {
            this.set(this.KEYS.CUSTOMERS, customers);
            console.log(`✅ Fixed ${customersFixed} customers`);
        }

        const totalFixed = suppliersFixed + customersFixed;
        if (totalFixed > 0) {
            alert(`✅ Berhasil memperbaiki ${totalFixed} data (${suppliersFixed} supplier, ${customersFixed} customer).\n\nSilakan refresh halaman (F5).`);
        } else {
            alert('ℹ️ Semua data sudah memiliki ID, tidak ada yang perlu diperbaiki.');
        }

        return { suppliersFixed, customersFixed, totalFixed };
    },

    // Remove duplicate suppliers (keep the one with proper ID format)
    async removeDuplicateSuppliers() {
        const suppliers = this.getSuppliers();
        const seen = new Map();
        const unique = [];

        suppliers.forEach(supplier => {
            const key = `${supplier.code}-${supplier.name}`;

            if (!seen.has(key)) {
                // First occurrence - keep it
                seen.set(key, supplier);
                unique.push(supplier);
            } else {
                // Duplicate found - keep the one with proper ID format (SUPP-XXX)
                const existing = seen.get(key);
                if (supplier.id && supplier.id.startsWith('SUPP-') && supplier.id.length <= 8) {
                    // This one has proper format, replace existing
                    const index = unique.findIndex(s => s.id === existing.id);
                    if (index !== -1) {
                        unique[index] = supplier;
                        seen.set(key, supplier);
                    }
                }
                // Otherwise skip this duplicate
            }
        });

        console.log(`🧹 Removed ${suppliers.length - unique.length} duplicate suppliers`);
        console.log(`   Before: ${suppliers.length} suppliers`);
        console.log(`   After: ${unique.length} suppliers`);

        // Save cleaned data
        this.set(this.KEYS.SUPPLIERS, unique);

        // Sync to Firestore
        if (typeof FirebaseSync !== 'undefined' && FirebaseSync.isEnabled()) {
            try {
                await FirebaseSync.syncToFirestore('suppliers', unique);
                console.log('✅ Cleaned suppliers synced to Firestore');
            } catch (error) {
                console.error('Error syncing cleaned suppliers:', error);
            }
        }

        return { removed: suppliers.length - unique.length, total: unique.length };
    },

    // --- PRODUCTION BATCHES ---
    getBatches() {
        return this.get(this.KEYS.PRODUCTION_BATCHES) || [];
    },
    async addBatch(batch) {
        const batches = this.getBatches();
        batches.unshift(batch); // Match the unshift logic from the other version
        return await this.set(this.KEYS.PRODUCTION_BATCHES, batches);
    },

    // --- SHIFTS ---
    getMasterShifts() {
        const list = this.get(this.KEYS.MASTER_SHIFTS) || [];
        let updated = false;

        // Auto-inject missing core shifts requested by HRD
        const defaultShifts = [
            {
                code: 'OFFICE',
                name: 'Office (Senin-Jumat)',
                startTime: '08:30',
                endTime: '16:30',
                breakDuration: 60,
                isNight: false,
                notes: 'Shift standar Office Senin - Jumat.'
            },
            {
                code: 'SABTU',
                name: 'Office (Sabtu)',
                startTime: '08:00',
                endTime: '13:00',
                breakDuration: 0,
                isNight: false,
                notes: 'Shift setengah hari untuk hari Sabtu.'
            },
            {
                code: 'OB',
                name: 'Office Boy (OB)',
                startTime: '07:30',
                endTime: '15:30',
                breakDuration: 60,
                isNight: false,
                notes: 'Shift khusus Office Boy.'
            },
            {
                code: 'SEC-PAGI',
                name: 'Security Pagi (12 Jam)',
                startTime: '08:00', // Note: as per existing default
                endTime: '16:00',
                breakDuration: 60,
                isNight: false,
                notes: 'Shift Security Siang/Pagi. Total 12 jam (08:00 - 20:00). 8 Jam Kerja + 4 Jam Lembur.'
            },
            {
                code: 'SEC-MLM',
                name: 'Security Malam (12 Jam)',
                startTime: '20:00',
                endTime: '04:00',
                breakDuration: 60,
                isNight: true,
                notes: 'Shift Security Malam. Total 12 jam (20:00 - 08:00). 8 Jam Kerja + 4 Jam Lembur.'
            }
        ];

        for (const def of defaultShifts) {
            if (!list.some(s => s.code === def.code)) {
                list.push({
                    id: 'SHF-' + def.code + '-AUTO',
                    code: def.code,
                    name: def.name,
                    startTime: def.startTime,
                    endTime: def.endTime,
                    breakDuration: def.breakDuration,
                    isNight: def.isNight,
                    notes: def.notes,
                    createdAt: new Date().toISOString()
                });
                updated = true;
            }
        }

        if (updated) {
            this.set(this.KEYS.MASTER_SHIFTS, list);
        }
        return list;
    },
    async saveMasterShifts(shifts) {
        await this.set(this.KEYS.MASTER_SHIFTS, shifts);
        return true;
    },

    // --- WORK CALENDAR ---
    getWorkCalendar() {
        const raw = this.get(this.KEYS.WORK_CALENDAR);
        if (!raw) return {};
        // Guard: pullAllFromCloud stores objects as [{value:{...}, _syncedAt:"..."}]
        // We must unwrap this format to get the real object.
        if (Array.isArray(raw)) {
            // Find the document that contains our value wrapper
            const wrapped = raw.find(d => d && typeof d === 'object' && d.value && typeof d.value === 'object' && !Array.isArray(d.value));
            if (wrapped) {
                console.warn('⚠️ [WorkCalendar] Detected wrapped format from cloud pull. Unwrapping...');
                // Re-save in correct format to heal localStorage for next time
                const healed = wrapped.value;
                try { localStorage.setItem(this.KEYS.WORK_CALENDAR, JSON.stringify(healed)); } catch(e) {}
                return healed;
            }
            // If array but no value wrapper, check if it's keyed year-month objects
            // e.g. [{"2026-06": {...}}] — unlikely but guard it
            const merged = {};
            raw.forEach(d => { if (d && typeof d === 'object') Object.assign(merged, d); });
            return merged;
        }
        // Normal case: already a plain object
        return typeof raw === 'object' ? raw : {};
    },
    async saveWorkCalendar(calendar) {
        // Always save as plain object to localStorage directly first for speed
        try { localStorage.setItem(this.KEYS.WORK_CALENDAR, JSON.stringify(calendar)); } catch(e) {}
        // Then sync to cloud
        await this.set(this.KEYS.WORK_CALENDAR, calendar);
        return true;
    },

    // --- EMPLOYEES ---
    getEmployees() {
        const raw = this.get(this.KEYS.EMPLOYEES) || [];
        const filtered = raw.filter(e => {
            if (!e) return false;
            const name = String(e.name || '').toLowerCase();
            const id = String(e.id || '').toLowerCase();
            const nik = String(e.nik || '').toLowerCase();
            const isDummy = name.includes('andi pratama') || 
                            name.includes('siti aminah') || 
                            name.includes('budi baru') || 
                            name.includes('cici baru') || 
                            id.includes('emp-2024-00') ||
                            nik.includes('emp-2024-00') ||
                            id === 'emp-001' || id === 'emp-002' || id === 'emp-003' ||
                            nik === '001' || nik === '002' || nik === '003';
            return !isDummy;
        });
        if (filtered.length !== raw.length) {
            this.set(this.KEYS.EMPLOYEES, filtered);
        }
        return filtered;
    },
    async addEmployee(employee) {
        const employees = this.getEmployees();
        employees.push(employee);
        await this.set(this.KEYS.EMPLOYEES, employees);
        return true;
    },
    async updateEmployee(id, updatedEmployee) {
        const employees = this.getEmployees();
        const index = employees.findIndex(e => String(e.id) === String(id));
        if (index !== -1) {
            employees[index] = updatedEmployee;
            await this.set(this.KEYS.EMPLOYEES, employees);
            return true;
        }
        return false;
    },
    async deleteEmployee(id) {
        const employees = this.getEmployees();
        const filtered = employees.filter(e => String(e.id) !== String(id));
        await this.set(this.KEYS.EMPLOYEES, filtered);
        this.trackDeletion(id);
        return true;
    },

    // --- ATTENDANCE ---
    getAttendance() {
        return this.get(this.KEYS.ATTENDANCE) || [];
    },
    async saveAttendance(records) {
        await this.set(this.KEYS.ATTENDANCE, records);
        return true;
    },

    calculateLatePenalty(clockInStr, shiftStartStr, baseSalary = 5000000) {
        if (!clockInStr || !shiftStartStr) {
            return { isLate: false, lateMinutes: 0, penalty: 0, tier: 0 };
        }

        const timePart = String(clockInStr).includes(' ') ? String(clockInStr).split(' ')[1] : String(clockInStr);
        const [inH, inM] = timePart.split(':').map(Number);
        const [shiftH, shiftM] = String(shiftStartStr).split(':').map(Number);

        if (isNaN(inH) || isNaN(inM) || isNaN(shiftH) || isNaN(shiftM)) {
            return { isLate: false, lateMinutes: 0, penalty: 0, tier: 0 };
        }

        const inMinutes = inH * 60 + inM;
        const shiftMinutes = shiftH * 60 + shiftM;

        if (inMinutes <= shiftMinutes) {
            return { isLate: false, lateMinutes: 0, penalty: 0, tier: 0 };
        }

        const lateMinutes = inMinutes - shiftMinutes;

        if (lateMinutes <= 5) {
            // Grace Period (0-5 mins late): Do NOT flag as late, do NOT apply penalty, do NOT increment late count
            return { isLate: false, lateMinutes, penalty: 0, tier: 0 };
        } else if (lateMinutes <= 60) {
            // Tier 1 (6-60 mins late): Rp 10.000
            return { isLate: true, lateMinutes, penalty: 10000, tier: 1 };
        } else if (lateMinutes <= 120) {
            // Tier 2 (61-120 mins late): Rp 20.000
            return { isLate: true, lateMinutes, penalty: 20000, tier: 2 };
        } else {
            // Tier 3 (>120 mins late): 1/2 day salary deduction
            const dailySalary = (Number(baseSalary) || 5000000) / 25;
            const halfDayDeduction = Math.round(0.5 * dailySalary);
            return { isLate: true, lateMinutes, penalty: halfDayDeduction, tier: 3 };
        }
    },

    getAttendanceImportBatches() {
        return this.get('erp_attendance_import_batches') || [];
    },

    async saveAttendanceImportBatch(batchInfo) {
        const batches = this.getAttendanceImportBatches();
        batches.unshift(batchInfo);
        await this.set('erp_attendance_import_batches', batches);
        return true;
    },

    async undoAttendanceImportBatch(batchId) {
        let batches = this.getAttendanceImportBatches();
        const batchToUndo = batches.find(b => b.batchId === batchId);
        if (!batchToUndo) return false;

        // 1. Remove batch from batches list
        batches = batches.filter(b => b.batchId !== batchId);
        await this.set('erp_attendance_import_batches', batches);

        // 2. Remove raw logs created by this batch from local overrides
        const rawOverrides = this.get('erp_attendance_raw_overrides') || [];
        const filteredOverrides = rawOverrides.filter(r => r.batchId !== batchId);
        await this.set('erp_attendance_raw_overrides', filteredOverrides);

        // 3. Remove raw logs from attendance_raw in Firestore if connected
        if (typeof window.db !== 'undefined' && typeof window.firestore !== 'undefined') {
            try {
                const { collection, getDocs, query, where, deleteDoc, doc } = window.firestore;
                const snap = await getDocs(query(collection(window.db, "attendance_raw"), where("batchId", "==", batchId)));
                const deletePromises = [];
                snap.forEach(d => {
                    deletePromises.push(deleteDoc(doc(window.db, "attendance_raw", d.id)));
                });
                await Promise.all(deletePromises);
            } catch (err) {
                console.warn('⚠️ Cloud batch delete warning:', err.message);
            }
        }

        return true;
    },

    // --- PAYROLL ---
    getPayroll() {
        return this.get(this.KEYS.PAYROLL) || [];
    },
    async addPayroll(payroll) {
        const list = this.getPayroll();
        list.push(payroll);
        await this.set(this.KEYS.PAYROLL, list);
        return true;
    },

    // --- BUG REPORTS ---
    getBugReports() {
        return this.get(this.KEYS.BUG_REPORTS) || [];
    },
    async saveBugReport(report) {
        const reports = this.getBugReports();
        reports.push(report);

        // Try saving
        let success = await this.set(this.KEYS.BUG_REPORTS, reports);

        // If it fails (likely QuotaExceededError), try optimizing
        if (!success) {
            console.warn('⚠️ Storage full, attempting bug report optimization...');
            const optimizedReports = this.optimizeBugReports();
            // Try adding the new report again to the optimized list
            optimizedReports.push(report);
            success = await this.set(this.KEYS.BUG_REPORTS, optimizedReports);
        }

        return success;
    },

    // Reduces storage footprint of bug reports
    optimizeBugReports() {
        let reports = this.getBugReports();
        console.log(`🧹 Optimizing bug reports. Current count: ${reports.length}`);

        // 1. Remove oldest RESOLVED reports first (keep max 10 resolved)
        const resolved = reports.filter(r => r.status === 'resolved');
        if (resolved.length > 10) {
            const toRemove = resolved.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
                .slice(0, resolved.length - 10)
                .map(r => r.id);
            reports = reports.filter(r => !toRemove.includes(r.id));
            console.log(`   - Removed ${toRemove.length} old resolved reports`);
        }

        // 2. Remove screenshots from ANY report older than 3 days to save space
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

        let screenshotsRemoved = 0;
        reports.forEach(r => {
            if (r.screenshot && new Date(r.createdAt) < threeDaysAgo) {
                r.screenshot = ''; // Clear base64 data
                r.description += '\n\n[SYSTEM: Screenshot removed to save storage space]';
                screenshotsRemoved++;
            }
        });
        if (screenshotsRemoved > 0) {
            console.log(`   - Stripped screenshots from ${screenshotsRemoved} old reports`);
        }

        // 3. Final cap: hard limit of 30 total reports
        if (reports.length > 30) {
            reports = reports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 30);
            console.log(`   - Capped total reports to 30`);
        }

        this.set(this.KEYS.BUG_REPORTS, reports);
        return reports;
    },
    async updateBugReport(updatedReport) {
        const reports = this.getBugReports();
        const index = reports.findIndex(r => r.id === updatedReport.id);
        if (index !== -1) {
            reports[index] = updatedReport;
            return this.set(this.KEYS.BUG_REPORTS, reports);
        }
        return false;
    },

    // Overtime & Production Settings Helpers
    getOvertimeSettings() {
        const defaultSettings = {
            caps: {
                'PROD': 2,
                'QC': 3,
                'DEFAULT': 1
            },
            productionRate: 25000, // Rp per gram
            bpjs_health_emp: 1.0,  // %
            jht_emp: 2.0,          // %
            bpjs_health_comp: 4.0, // %
            jht_comp: 3.7,         // %
            jkk_comp: 0.24,        // %
            jkm_comp: 0.3          // %
        };
        return this.get(this.KEYS.OVERTIME_SETTINGS) || defaultSettings;
    },

    saveOvertimeSettings(settings) {
        return this.set(this.KEYS.OVERTIME_SETTINGS, settings);
    },

    // System Settings - Loss Tolerance (PRD-GAR-PROD-2026-08-03-v1.1)
    getLossTolerancePercent() {
        const settings = this.get(this.KEYS.SYSTEM_SETTINGS) || {};
        return typeof settings.loss_tolerance_percent === 'number' ? settings.loss_tolerance_percent : 0.5;
    },

    saveLossTolerancePercent(val, updatedBy = '608') {
        const numVal = parseFloat(val);
        if (isNaN(numVal) || numVal < 0.1 || numVal > 2.0) {
            throw new Error('Toleransi susut harus berada dalam rentang 0.1% s/d 2.0%');
        }
        const settings = this.get(this.KEYS.SYSTEM_SETTINGS) || {};
        const oldVal = settings.loss_tolerance_percent || 0.5;
        settings.loss_tolerance_percent = numVal;
        settings.updated_by = updatedBy;
        settings.updated_at = new Date().toISOString();
        this.set(this.KEYS.SYSTEM_SETTINGS, settings);

        if (typeof AuditLog !== 'undefined' && AuditLog.log) {
            AuditLog.log('system_settings', 'update_loss_tolerance', 'loss_tolerance_percent', {
                oldValue: oldVal,
                newValue: numVal,
                updatedBy: updatedBy
            });
        }
        return settings;
    },


    // Production Logs Helpers
    getProductionLogs() {
        return this.get(this.KEYS.PRODUCTION_LOGS) || [];
    },

    saveProductionLog(log) {
        const logs = this.getProductionLogs();
        const index = logs.findIndex(l => l.id === log.id);
        if (index !== -1) {
            logs[index] = log;
        } else {
            logs.push(log);
        }
        return this.set(this.KEYS.PRODUCTION_LOGS, logs);
    },

    deleteProductionLog(id) {
        const logs = this.getProductionLogs();
        const filtered = logs.filter(l => l.id !== id);
        return this.set(this.KEYS.PRODUCTION_LOGS, filtered);
    },

    async updatePayroll(id, updated) {
        const list = this.getPayroll();
        const index = list.findIndex(p => p.id === id);
        if (index !== -1) {
            list[index] = { ...list[index], ...updated };
            await this.set(this.KEYS.PAYROLL, list);
        }
        return true;
    },

    async updateBatch(id, updatedBatch) {
        const batches = this.getBatches();
        const index = batches.findIndex(b => b.id === id);

        if (index !== -1) {
            batches[index] = updatedBatch;

            // Update localStorage
            this.set(this.KEYS.PRODUCTION_BATCHES, batches);

            // Sync to Firestore if available
            if (typeof FirebaseSync !== 'undefined' && FirebaseSync.isEnabled()) {
                try {
                    await FirebaseSync.syncToFirestore('productionBatches', batches);
                    console.log('✅ Batch updated and synced to Firestore');
                } catch (error) {
                    console.error('Error syncing batch update to Firestore:', error);
                }
            }

            return true;
        }

        return false;
    },
    async deleteBatch(id) {
        const batches = this.getBatches();
        const filtered = batches.filter(b => b.id !== id);

        // Update localStorage
        this.set(this.KEYS.PRODUCTION_BATCHES, filtered);

        // Sync to Firestore if available
        if (typeof FirebaseSync !== 'undefined' && FirebaseSync.isEnabled()) {
            try {
                await FirebaseSync.syncToFirestore('productionBatches', filtered);
                console.log('✅ Batch deleted and synced to Firestore');
            } catch (error) {
                console.error('Error syncing batch deletion to Firestore:', error);
            }
        }

        return true;
    },


    // --- WAREHOUSES ---
    getWarehouses() {
        return this.get(this.KEYS.WAREHOUSES) || [];
    },
    addWarehouse(warehouse) {
        const warehouses = this.getWarehouses();
        warehouses.push(warehouse);
        this.set(this.KEYS.WAREHOUSES, warehouses);
    },
    updateWarehouse(id, updatedWarehouse) {
        const warehouses = this.getWarehouses();
        const index = warehouses.findIndex(w => w.id === id);
        if (index !== -1) {
            warehouses[index] = updatedWarehouse;
            this.set(this.KEYS.WAREHOUSES, warehouses);
            return true;
        }
        return false;
    },
    deleteWarehouse(id) {
        const warehouses = this.getWarehouses();
        const filtered = warehouses.filter(w => w.id !== id);
        this.set(this.KEYS.WAREHOUSES, filtered);
    },

    // User CRUD helper methods
    getUsers() {
        return this.get(this.KEYS.USERS) || [];
    },
    createUser(user) {
        const users = this.getUsers();
        users.push({ ...user, id: Date.now().toString(), createdAt: new Date().toISOString() });
        this.set(this.KEYS.USERS, users);
    },
    updateUser(username, updatedUser) {
        const users = this.getUsers();
        const index = users.findIndex(u => u.username === username);
        if (index !== -1) {
            users[index] = { ...users[index], ...updatedUser, updatedAt: new Date().toISOString() };
            this.set(this.KEYS.USERS, users);
            return true;
        }
        return false;
    },
    deleteUser(username) {
        const users = this.getUsers();
        const filtered = users.filter(u => u.username !== username);
        this.set(this.KEYS.USERS, filtered);
    },

    // Role CRUD helper methods
    getRoles() {
        return this.get(this.KEYS.ROLES) || [];
    },
    createRole(role) {
        const roles = this.getRoles();
        roles.push({ ...role, createdAt: new Date().toISOString() });
        this.set(this.KEYS.ROLES, roles);
    },
    updateRole(roleCode, updatedRole) {
        const roles = this.getRoles();
        const index = roles.findIndex(r => r.roleCode === roleCode);
        if (index !== -1) {
            roles[index] = { ...roles[index], ...updatedRole, updatedAt: new Date().toISOString() };
            this.set(this.KEYS.ROLES, roles);
            return true;
        }
        return false;
    },
    deleteRole(roleCode) {
        const roles = this.getRoles();
        const filtered = roles.filter(r => r.roleCode !== roleCode);
        this.set(this.KEYS.ROLES, filtered);
    },

    // ==========================================
    // Account Mapping Configuration
    // For Simple Transaction Templates
    // ==========================================

    // Default account mapping for Simple Transaction templates
    getDefaultAccountMapping() {
        return {
            // ASSETS
            cash: '1110',                    // Kas
            bank: '1121',                    // Bank BCA (atau bisa pilih bank lain)
            accounts_receivable: '1130',     // Piutang Usaha
            inventory: '1140',               // Persediaan (General/ATK)
            raw_gold_inventory: '1151',      // Emas Mentah
            gold_in_lab: '1152',            // Scrap Gold / Emas Dalam Lab
            gold_bar_inventory: '1181',     // Persediaan Gold Bar / Polos
            gold_bar_inventory_cert: '1183', // Persediaan Gold Bar Sertifikat
            chemicals_inventory: '1154',     // Chemicals & Flux Materials
            consumables_inventory: '1155',   // Consumables (Crucibles, Molds)
            wip: '1161',                    // WIP - Melting Stage
            gold_consignment: '1172',       // Emas Titipan Customer
            tax_in: '11901',                // PPN Masukan

            // LIABILITIES
            accounts_payable: '2110',        // Hutang Usaha
            gold_payable: '2111',           // Hutang Supplier Emas
            gold_payable_pending: '2113',   // Hutang Pembelian Emas (Pending Confirmation)
            customer_gold_liability: '2112', // Emas Titipan Customer (Liability)
            long_term_debt: '2210',         // Hutang Bank Jangka Panjang
            tax_out: '2130',                // Hutang Pajak / PPN Keluaran

            // EQUITY
            capital: '3100',                // Modal Disetor
            drawings: '3200',               // Laba Ditahan (untuk prive)

            // REVENUE
            sales_revenue: '4111',          // Penjualan Gold Bar
            gold_bar_revenue: '4111',       // Penjualan Gold Bar
            gold_grain_revenue: '4112',     // Penjualan Gold Grain
            refining_service_revenue: '4121', // Pendapatan Jasa Refining
            other_income: '4210',           // Pendapatan Bunga

            // EXPENSES - COGS
            cogs: '5111',                   // Biaya Bahan Baku Emas

            // EXPENSES - Production
            production_electricity: '5131',  // Listrik Produksi
            production_gas: '5132',         // Gas & Fuel
            assay_lab: '5134',              // Assay & Lab Testing
            production_safety: '5135',      // Safety & PPE
            production_loss_normal: '5141', // Susut Normal
            production_loss_abnormal: '5142', // Susut Abnormal
            revaluation_gain: '4202',       // Gain on Revaluation
            revaluation_loss: '5143',       // Loss on Revaluation

            // EXPENSES - Operating
            salary_expense: '5210',         // Beban Gaji Administrasi
            rent_expense: '5220',           // Beban Sewa
            utilities_expense: '5230',      // Beban Listrik/Air (Office)
            phone_expense: '5240',          // Beban Telepon
            supplies_expense: '5250',       // Beban Perlengkapan
            maintenance_expense: '5270',    // Beban Pemeliharaan
            transport_expense: '5280',      // Beban Transport
            other_expense: '5290',          // Beban Operasional Lain
            interest_expense: '5900',       // Beban Bunga

            // FIXED ASSETS (untuk pembelian aset)
            land: '1210',
            building: '1220',
            vehicle: '1230',
            equipment: '1241',              // Furnace & Melting Equipment
            furniture: '1235',              // Peralatan Kantor
            furnace_equipment: '1241',
            assay_equipment: '1242',
            refining_equipment: '1243',
            casting_equipment: '1244',
            testing_equipment: '1245',
            safety_equipment: '1250'
        };
    },

    // Get account mapping (with defaults if not set)
    getAccountMapping() {
        const saved = this.get(this.KEYS.ACCOUNT_MAPPING);
        const defaults = this.getDefaultAccountMapping();
        const mapping = { ...defaults, ...saved };

        // PPN Masukan was previously mapped to 1174. New purchase journals must use 11901.
        if (!saved || !saved.tax_in || saved.tax_in === '1174') {
            mapping.tax_in = defaults.tax_in;
        }

        if (mapping.tax_in === '11901') {
            const coa = this.getChartOfAccounts();
            if (Array.isArray(coa) && !coa.some(acc => String(acc.code) === '11901')) {
                coa.push({ code: '11901', name: 'PPN Masukan', type: 'detail', category: 'aset', balance: 0 });
                coa.sort((a, b) => String(a.code).localeCompare(String(b.code)));
                this.set(this.KEYS.CHART_OF_ACCOUNTS, coa, true);
            }
        }

        return mapping;
    },

    // Update account mapping
    setAccountMapping(mapping) {
        this.set(this.KEYS.ACCOUNT_MAPPING, mapping);
        return true;
    },

    // Get specific account code by purpose
    getAccountByPurpose(purpose) {
        const mapping = this.getAccountMapping();
        const accountCode = mapping[purpose];

        if (!accountCode) {
            console.warn(`Account mapping untuk '${purpose}' tidak ditemukan, menggunakan default`);
            return null;
        }

        return accountCode;
    },

    // Get specific account code by purpose with validation
    getAccountByPurposeValidated(purpose) {
        const accountCode = this.getAccountByPurpose(purpose);

        if (!accountCode) {
            throw new Error(`Account mapping untuk '${purpose}' tidak ditemukan`);
        }

        // Validasi dengan Master COA (jika ChartOfAccounts tersedia)
        if (typeof ChartOfAccounts !== 'undefined') {
            const account = ChartOfAccounts.getAccount(accountCode);
            if (!account) {
                throw new Error(`Account ${accountCode} (${purpose}) tidak ditemukan di Master COA. Silakan update Account Mapping di Settings.`);
            }

            // Validasi KYC untuk transaksi yang memerlukan (e.g., Direct Swap)
            if (customerId && typeof CustomerKYC !== 'undefined') {
                const kycCheck = CustomerKYC.checkKYCStatus(customerId);

                // RELAXED VALIDATION:
                // 1. Skip check for DRAFTs
                // 2. Allow manual override for COMPLETED in Emergency Local Mode if no record found
                if (dataStatus !== 'DRAFT') {
                    if (!kycCheck.approved) {
                        alert(`⚠️ Transaksi Ditolak: KYC ${kycCheck.reason}.\nCustomer harus terverifikasi untuk melakukan transaksi.`);
                        throw new Error(`KYC check failed: ${kycCheck.reason}`);
                    }
                }
            }

            if (account.type !== 'detail') {
                throw new Error(`Account ${accountCode} (${purpose}) adalah ${account.type} account. Harus menggunakan detail account. Silakan update Account Mapping di Settings.`);
            }
        }

        return accountCode;
    },

    // Reset account mapping to defaults
    resetAccountMapping() {
        const confirmed = confirm('Reset Account Mapping ke default? Konfigurasi custom Anda akan hilang.');
        if (confirmed) {
            this.set(this.KEYS.ACCOUNT_MAPPING, this.getDefaultAccountMapping());
            return true;
        }
        return false;
    },

    // Validate all account mappings against Master COA
    validateAccountMapping() {
        const mapping = this.getAccountMapping();
        const errors = [];
        const warnings = [];

        if (typeof ChartOfAccounts === 'undefined') {
            warnings.push('ChartOfAccounts module not loaded, skipping validation');
            return { valid: true, errors, warnings };
        }

        for (const [purpose, code] of Object.entries(mapping)) {
            const account = ChartOfAccounts.getAccount(code);

            if (!account) {
                errors.push({
                    purpose,
                    code,
                    error: 'Account not found in Master COA'
                });
            } else if (account.type !== 'detail') {
                errors.push({
                    purpose,
                    code,
                    error: `Account type is '${account.type}', must be 'detail'`
                });
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    },
    // ==========================================
    // ERP - Data Storage Management
    // ==========================================

    // Items
    getItems() { return this.get(this.KEYS.ITEMS) || []; },
    addItem(item) {
        const items = this.getItems();
        items.unshift(item);
        return this.set(this.KEYS.ITEMS, items);
    },
    updateItem(id, updates) {
        const items = this.getItems();
        const index = items.findIndex(i => i.id === id);
        if (index === -1) return false;
        items[index] = { ...items[index], ...updates };
        return this.set(this.KEYS.ITEMS, items);
    },
    deleteItem(id) {
        const items = this.getItems().filter(i => i.id !== id);
        this.trackDeletion(id);
        return this.set(this.KEYS.ITEMS, items);
    },

    // Suppliers
    getSuppliers() { return this.get(this.KEYS.SUPPLIERS) || []; },
    getSupplier(id) {
        return this.getSuppliers().find(s => s.id === id || s.code === id);
    },
    addSupplier(supplier) {
        const suppliers = this.getSuppliers();
        suppliers.unshift(supplier);
        return this.set(this.KEYS.SUPPLIERS, suppliers);
    },
    updateSupplier(id, updates) {
        const suppliers = this.getSuppliers();
        const index = suppliers.findIndex(s => s.id === id);
        if (index === -1) return false;
        suppliers[index] = { ...suppliers[index], ...updates };
        return this.set(this.KEYS.SUPPLIERS, suppliers);
    },


    // Customers
    getCustomers() { return this.get(this.KEYS.CUSTOMERS) || []; },
    getCustomer(id) {
        return this.getCustomers().find(c => c.id === id || c.code === id);
    },
    addCustomer(customer) {
        const customers = this.getCustomers();
        customers.unshift(customer);
        return this.set(this.KEYS.CUSTOMERS, customers);
    },
    updateCustomer(id, updates) {
        const customers = this.getCustomers();
        const index = customers.findIndex(c => c.id === id);
        if (index === -1) return false;
        customers[index] = { ...customers[index], ...updates };
        return this.set(this.KEYS.CUSTOMERS, customers);
    },
    deleteCustomer(id) {
        const customers = this.getCustomers().filter(c => String(c.id) !== String(id));
        this.trackDeletion(id);
        return this.set(this.KEYS.CUSTOMERS, customers);
    },

    // Generic Getters for other Master Data
    getWarehouses() { return this.get(this.KEYS.WAREHOUSES) || []; },
    getItems() { return this.get(this.KEYS.ITEMS) || []; },
    getItem(id) {
        return this.getItems().find(i => i.id === id || i.code === id);
    },
    getTaxes() { return this.get(this.KEYS.TAXES) || []; },
    getBankAccounts() { return this.get(this.KEYS.BANK_ACCOUNTS) || []; },
    getPaymentTerms() { return this.get(this.KEYS.PAYMENT_TERMS) || []; },
    getUsers() { return this.get(this.KEYS.USERS) || []; },
    getRoles() { return this.get(this.KEYS.ROLES) || []; },
    getEmployees() { return this.get(this.KEYS.EMPLOYEES) || []; },


    // Sales Orders
    getSalesOrders() { return this.get(this.KEYS.SALES_ORDERS) || []; },
    saveSalesOrders(orders) { return this.set(this.KEYS.SALES_ORDERS, orders); },

    // Quotations
    getQuotations() { return this.get(this.KEYS.QUOTATIONS) || []; },
    saveQuotations(quotes) { return this.set(this.KEYS.QUOTATIONS, quotes); },

    // TTB
    getTTBs() { return this.get(this.KEYS.TTB_DOCUMENTS) || []; },
    saveTTBs(docs) { return this.set(this.KEYS.TTB_DOCUMENTS, docs); },

    // Supplier Invoices
    getSupplierInvoices() { return this.get(this.KEYS.SUPPLIER_INVOICES) || []; },
    saveSupplierInvoices(invoices) { return this.set(this.KEYS.SUPPLIER_INVOICES, invoices); },

    // Fixed Assets
    getFixedAssets() { return this.get(this.KEYS.FIXED_ASSETS) || []; },
    saveFixedAssets(assets) { return this.set(this.KEYS.FIXED_ASSETS, assets); },

    // KYC Records
    getKYCRecords() { return this.get(this.KEYS.KYC_RECORDS) || []; },
    saveKYCRecords(records) { return this.set(this.KEYS.KYC_RECORDS, records); },

    // Check/Giro
    getChecks() { return this.get(this.KEYS.CHECKS_GIRO) || []; },
    saveChecks(checks) { return this.set(this.KEYS.CHECKS_GIRO, checks); },

    // Payment Schedules
    getSchedules() { return this.get(this.KEYS.PAYMENT_SCHEDULES) || []; },
    saveSchedules(schedules) { return this.set(this.KEYS.PAYMENT_SCHEDULES, schedules); },

    // Get all journal entries
    getJournalEntries() {
        return this.get(this.KEYS.JOURNAL_ENTRIES) || [];
    },

    // Save all journal entries
    setJournalEntries(entries) {
        return this.set(this.KEYS.JOURNAL_ENTRIES, entries);
    },

    // Lab Tests
    getLabTests() { return this.get(this.KEYS.LAB_TESTS) || []; },
    saveLabTests(tests) { return this.set(this.KEYS.LAB_TESTS, tests); },

    // Supplier Returns
    getSupplierReturns() { return this.get(this.KEYS.SUPPLIER_RETURNS) || []; },
    saveSupplierReturns(returns) { return this.set(this.KEYS.SUPPLIER_RETURNS, returns); },

    // Stock Cards (Legacy UI)
    getStockCards() { return this.get(this.KEYS.STOCK_CARDS) || []; },
    saveStockCards(cards) { return this.set(this.KEYS.STOCK_CARDS, cards); },

    // Goods Receipts
    getGoodsReceipts() { return this.get(this.KEYS.GOODS_RECEIPTS) || []; },
    saveGoodsReceipts(receipts) { return this.set(this.KEYS.GOODS_RECEIPTS, receipts); },

    // Receipt Vouchers
    getReceiptVouchers() { return this.get(this.KEYS.RECEIPT_VOUCHERS) || []; },
    saveReceiptVouchers(vouchers, specificItem = null) { return this.set(this.KEYS.RECEIPT_VOUCHERS, vouchers, false, specificItem); },

    // Production Orders
    getProductionOrders() { return this.get(this.KEYS.PRODUCTION_ORDERS) || []; },
    saveProductionOrders(orders) { return this.set(this.KEYS.PRODUCTION_ORDERS, orders); },

    // Warehouse Stock Helpers
    getWarehouseStock() { return this.get(this.KEYS.WAREHOUSE_STOCK) || {}; },
    saveWarehouseStock(stock) { 
        stock.id = 'MASTER_STOCK'; // Prevent infinite new random documents in Firestore
        return this.set(this.KEYS.WAREHOUSE_STOCK, stock); 
    },

    getWarehouseStockMovements() { return this.get(this.KEYS.WAREHOUSE_STOCK_MOVEMENTS) || []; },
    saveWarehouseStockMovements(movements) { return this.set(this.KEYS.WAREHOUSE_STOCK_MOVEMENTS, movements); },

    // Gold Dust Recovery Helpers
    getGoldDustRecovery() { return this.get(this.KEYS.GOLD_DUST_RECOVERY) || []; },
    saveGoldDustRecovery(records) { return this.set(this.KEYS.GOLD_DUST_RECOVERY, records); },

    updateBatch(id, updates) {
        const batches = this.getBatches();
        const index = batches.findIndex(b => b.id === id);
        if (index === -1) return false;
        batches[index] = { ...batches[index], ...updates };
        return this.set(this.KEYS.PRODUCTION_BATCHES, batches);
    },
    deleteBatch(id) {
        const batches = this.getBatches().filter(b => b.id !== id);
        this.trackDeletion(id);
        return this.set(this.KEYS.PRODUCTION_BATCHES, batches);
    },

    // Holiday Management
    DEFAULT_2026_HOLIDAYS: [
        { date: '2026-01-01', name: 'Tahun Baru 2026 Masehi', type: 'Libur Nasional', isNationalHoliday: true },
        { date: '2026-01-16', name: 'Isra Mi\'raj Nabi Muhammad SAW', type: 'Libur Nasional', isNationalHoliday: true },
        { date: '2026-02-17', name: 'Tahun Baru Imlek 2577 Kongzili', type: 'Libur Nasional', isNationalHoliday: true },
        { date: '2026-03-18', name: 'Cuti Bersama Hari Suci Nyepi', type: 'Cuti Bersama', isNationalHoliday: false },
        { date: '2026-03-19', name: 'Hari Suci Nyepi Tahun Baru Saka 1948', type: 'Libur Nasional', isNationalHoliday: true },
        { date: '2026-03-20', name: 'Cuti Bersama Hari Raya Idul Fitri 1447H', type: 'Cuti Bersama', isNationalHoliday: false },
        { date: '2026-03-21', name: 'Hari Raya Idul Fitri 1447H', type: 'Libur Nasional', isNationalHoliday: true },
        { date: '2026-03-22', name: 'Hari Raya Idul Fitri 1447H', type: 'Libur Nasional', isNationalHoliday: true },
        { date: '2026-03-23', name: 'Cuti Bersama Hari Raya Idul Fitri 1447H', type: 'Cuti Bersama', isNationalHoliday: false },
        { date: '2026-03-24', name: 'Cuti Bersama Hari Raya Idul Fitri 1447H', type: 'Cuti Bersama', isNationalHoliday: false },
        { date: '2026-04-03', name: 'Wafat Yesus Kristus / Jumat Agung', type: 'Libur Nasional', isNationalHoliday: true },
        { date: '2026-04-05', name: 'Kebangkitan Yesus Kristus (Paskah)', type: 'Libur Nasional', isNationalHoliday: true },
        { date: '2026-05-01', name: 'Hari Buruh Internasional', type: 'Libur Nasional', isNationalHoliday: true },
        { date: '2026-05-14', name: 'Kenaikan Yesus Kristus', type: 'Libur Nasional', isNationalHoliday: true },
        { date: '2026-05-15', name: 'Cuti Bersama Kenaikan Yesus Kristus', type: 'Cuti Bersama', isNationalHoliday: false },
        { date: '2026-05-27', name: 'Hari Raya Idul Adha 1447H', type: 'Libur Nasional', isNationalHoliday: true },
        { date: '2026-05-28', name: 'Cuti Bersama Hari Raya Idul Adha 1447H', type: 'Cuti Bersama', isNationalHoliday: false },
        { date: '2026-05-31', name: 'Hari Raya Waisak 2570 BE', type: 'Libur Nasional', isNationalHoliday: true },
        { date: '2026-06-01', name: 'Hari Lahir Pancasila', type: 'Libur Nasional', isNationalHoliday: true },
        { date: '2026-06-16', name: 'Tahun Baru Islam 1448H', type: 'Libur Nasional', isNationalHoliday: true },
        { date: '2026-08-17', name: 'Hari Kemerdekaan Republik Indonesia', type: 'Libur Nasional', isNationalHoliday: true },
        { date: '2026-08-25', name: 'Maulid Nabi Muhammad SAW', type: 'Libur Nasional', isNationalHoliday: true },
        { date: '2026-12-24', name: 'Cuti Bersama Hari Raya Natal', type: 'Cuti Bersama', isNationalHoliday: false },
        { date: '2026-12-25', name: 'Hari Raya Natal', type: 'Libur Nasional', isNationalHoliday: true }
    ],

    getHolidays() {
        const stored = this.get(this.KEYS.HOLIDAYS);
        if (stored && Array.isArray(stored) && stored.length > 0) return stored;
        // Default seed if empty
        return this.DEFAULT_2026_HOLIDAYS;
    },

    saveHolidays(holidays) { return this.set(this.KEYS.HOLIDAYS, holidays); },

    async syncHolidaysFromAPI(year = new Date().getFullYear()) {
        const endpoints = [
            `https://api-hari-libur.vercel.app/api?year=${year}`,
            `https://libur.deno.dev/api?year=${year}`
        ];

        for (const url of endpoints) {
            try {
                const response = await fetch(url);
                if (!response.ok) continue;
                const resData = await response.json();
                const rawList = Array.isArray(resData) ? resData : (resData.data || []);
                if (rawList.length === 0) continue;

                const existing = this.getHolidays();
                const updated = [...existing];
                let addedCount = 0;

                rawList.forEach(item => {
                    const date = item.holiday_date || item.date;
                    const name = item.holiday_name || item.description || item.name;
                    if (!date || !name) return;

                    const isCutiBersama = String(name).toLowerCase().includes('cuti bersama') || item.is_national_holiday === false;
                    const type = isCutiBersama ? 'Cuti Bersama' : 'Libur Nasional';

                    const idx = updated.findIndex(h => h.date === date);
                    if (idx >= 0) {
                        updated[idx] = { name, date, type, isNationalHoliday: !isCutiBersama };
                    } else {
                        updated.push({ name, date, type, isNationalHoliday: !isCutiBersama });
                        addedCount++;
                    }
                });

                await this.saveHolidays(updated);
                console.log(`✅ [Storage] Synced ${addedCount} new holidays from ${url} for year ${year}`);
                return true;
            } catch (err) {
                console.warn(`⚠️ [Storage] Could not fetch holidays from ${url}:`, err.message);
            }
        }
        return false;
    },

    // Payroll Calendar, Periods, Workdays Helpers
    getPayrollPeriods() { return this.get(this.KEYS.PAYROLL_PERIODS) || []; },
    savePayrollPeriods(periods) { return this.set(this.KEYS.PAYROLL_PERIODS, periods); },
    getPayrollWorkdays() { return this.get(this.KEYS.PAYROLL_WORKDAYS) || []; },
    savePayrollWorkdays(workdays) { return this.set(this.KEYS.PAYROLL_WORKDAYS, workdays); },
    getPayrollWorkdaysAudit() { return this.get(this.KEYS.PAYROLL_WORKDAYS_AUDIT) || []; },
    savePayrollWorkdaysAudit(audit) { return this.set(this.KEYS.PAYROLL_WORKDAYS_AUDIT, audit); },

    // Leave & Master Cuti Ledger Management
    getLeaveBalances() { return this.get(this.KEYS.LEAVE_BALANCES) || []; },
    saveLeaveBalances(balances) { return this.set(this.KEYS.LEAVE_BALANCES, balances); },

    getCollectiveLeaveDays(year = new Date().getFullYear()) {
        const holidays = this.getHolidays();
        return holidays.filter(h => {
            if (!h.date) return false;
            const hYear = new Date(h.date).getFullYear();
            return hYear === year && (h.type === 'Cuti Bersama' || String(h.name || '').toLowerCase().includes('cuti bersama'));
        }).length;
    },

    calculateLeaveEntitlement(hireDateStr, targetYear = new Date().getFullYear()) {
        if (!hireDateStr) return 12;
        const hireDate = new Date(hireDateStr);
        const hireYear = hireDate.getFullYear();
        const hireMonth = hireDate.getMonth() + 1;
        const hireDay = hireDate.getDate();

        // Probation & Tenure Restriction: 0 annual leave during first year
        if (targetYear <= hireYear) return 0;

        const collectiveLeaveDays = this.getCollectiveLeaveDays(targetYear);
        const baseEntitlement = Math.max(0, 12 - collectiveLeaveDays);

        if (targetYear > hireYear + 1) return baseEntitlement;

        let monthsWorked = hireDay <= 15 ? (12 - hireMonth + 1) : (12 - hireMonth);
        return Math.max(0, Math.min(baseEntitlement, monthsWorked - collectiveLeaveDays));
    },

    deductMasterCuti(nik, days, year = new Date().getFullYear()) {
        let balances = this.getLeaveBalances();
        let record = balances.find(b => String(b.employeeNik) === String(nik) && b.year === year);
        if (!record) {
            record = { employeeNik: nik, year: year, annualLeaveQuota: 12, usedLeave: 0, remainingLeave: 12 };
            balances.push(record);
        }
        record.usedLeave = (record.usedLeave || 0) + days;
        record.remainingLeave = Math.max(0, record.annualLeaveQuota - record.usedLeave);
        this.saveLeaveBalances(balances);

        const employees = this.getEmployees();
        const empIndex = employees.findIndex(e => String(e.nik) === String(nik));
        if (empIndex !== -1) {
            employees[empIndex].leave_balance = record.remainingLeave;
            employees[empIndex].annual_leave_quota = record.remainingLeave;
            this.set(this.KEYS.EMPLOYEES, employees);
        }
        return record;
    },

    setOpeningLeaveBalance(nik, year = new Date().getFullYear(), annualLeaveQuota = 12, usedLeave = 0, notes = "Migrasi Saldo Awal") {
        let balances = this.getLeaveBalances();
        let record = balances.find(b => String(b.employeeNik) === String(nik) && b.year === year);
        const quotaNum = Number(annualLeaveQuota);
        const usedNum = Number(usedLeave);
        const remainingLeave = quotaNum - usedNum;

        if (!record) {
            record = {
                employeeNik: nik,
                year: year,
                annualLeaveQuota: quotaNum,
                usedLeave: usedNum,
                remainingLeave: remainingLeave,
                isOpeningBalance: true,
                notes: notes,
                updatedAt: new Date().toISOString()
            };
            balances.push(record);
        } else {
            record.annualLeaveQuota = quotaNum;
            record.usedLeave = usedNum;
            record.remainingLeave = remainingLeave;
            record.isOpeningBalance = true;
            record.notes = notes;
            record.updatedAt = new Date().toISOString();
        }
        this.saveLeaveBalances(balances);

        const employees = this.getEmployees();
        const empIndex = employees.findIndex(e => String(e.nik) === String(nik));
        if (empIndex !== -1) {
            employees[empIndex].leave_balance = remainingLeave;
            employees[empIndex].annual_leave_quota = quotaNum;
            this.set(this.KEYS.EMPLOYEES, employees);
        }
        return record;
    }
};

// Initialize storage on load
Storage.init();


// Explicitly make Storage globally available
window.Storage = Storage;

// Automatically retry SyncGuard pending items once Firebase is initialized
window.addEventListener('firebase-initialized', () => {
    console.log('⚡ [Storage] Firebase initialized event received. Triggering SyncGuard retry...');
    if (typeof Storage !== 'undefined' && Storage.SyncGuard) {
        Storage.SyncGuard._retryAll(true);
    }
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Storage;
}
