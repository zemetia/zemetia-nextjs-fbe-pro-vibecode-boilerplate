/**
 * FirebaseSync Utility
 * Bridges localStorage data to Firestore for real-time persistence.
 * Uses window.db and window.firestore (initialized in firebase-config.js/app.js)
 */
const FirebaseSync = {
    // Mapping from localStorage keys to Firestore collection names
    COLLECTION_MAP: {
        'erp_chart_of_accounts': 'chartOfAccounts',
        'erp_journal_entries': 'journalEntries',
        'erp_suppliers': 'suppliers',
        'erp_customers': 'customers',
        'erp_bank_accounts': 'bankAccounts',
        'erp_items': 'items',
        'erp_warehouses': 'warehouses',
        'erp_taxes': 'taxes',
        'erp_payment_terms': 'paymentTerms',
        'erp_departments': 'departments',
        'erp_config': 'config',
        'erp_account_mapping': 'accountMapping',
        // NOTE: erp_transaction_counters is intentionally EXCLUDED from this map.
        // Transaction counters are managed exclusively by Storage.CloudSequencer
        // which writes atomically to Firestore doc transactionCounters/counters.
        // If synced here as a single-object, the wrapper doc grows beyond
        // Firestore’s 1 MB per-document limit.
        'erp_users': 'erp_users',
        'erp_roles': 'erp_roles',
        'payment_vouchers': 'paymentVouchers',
        'purchase_requisitions': 'purchaseRequisitions',
        'erp_employees': 'employees',
        'erp_attendance': 'attendance',
        'erp_payroll': 'payroll',
        'erp_production_batches': 'productionBatches',
        'packaging': 'packaging',
        'serialized_items': 'serializedItems',
        'deleted_records': 'deletedRecords',
        'erp_bug_reports': 'bugReports',
        'erp_purchase_orders': 'purchaseOrders',
        'goods_receipts': 'goodsReceipts',
        'gold_dust_recovery': 'goldDustRecovery',
        'gold_transactions': 'goldTransactions',
        'direct_swaps': 'directSwaps',
        'erp_sales_orders': 'salesOrders',
        'erp_quotations': 'quotations',
        'ttb_documents': 'ttbDocuments',
        'supplier_invoices': 'supplierInvoices',
        'erp_fixed_assets': 'fixedAssets',
        'kyc_records': 'kycRecords',
        'checks_giro': 'checksGiro',
        'payment_schedules': 'paymentSchedules',
        'lab_tests': 'labTests',
        'supplier_returns': 'supplierReturns',
        'stock_cards': 'stockCards',
        'receipt_vouchers': 'receiptVouchers',
        'erp_production_orders': 'productionOrders',
        'erp_warehouse_stock': 'warehouseStock',
        'erp_warehouse_stock_movements': 'warehouseStockMovements',
        'erp_audit_log': 'auditLog',
        'erp_job_orders': 'jobOrders',
        'BOMS': 'boms',
        'LAB_QUALITY_SAMPLES': 'labQualitySamples',
        'ELECTROLYSIS_LOGS': 'electrolysisLogs',
        'QC_LOGS': 'qcLogs',
        'LEAVE_REQUESTS': 'leaveRequests',
        'LEAVE_BALANCES': 'leaveBalances',
        'erp_master_shifts': 'masterShifts',
        'erp_work_calendar': 'workCalendar',
        'production_details': 'productionDetails',
        'erp_production_logs': 'productionLogs'
    },

    // Track errors shown to user to prevent spam
    _shownErrors: new Set(),
    _isProcessingQueue: false,

    // ─── Strip undefined values (Firestore rejects undefined) ───────────────────
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

    // Check if Firebase is initialized and available
    isEnabled() {
        return typeof window.db !== 'undefined' && typeof window.firestore !== 'undefined';
    },

    /**
     * Get the current sync status
     * @returns {string} - 'synced', 'syncing', or 'pending'
     */
    getStatus() {
        const queue = this.getQueue();
        if (this._isProcessingQueue) return 'syncing';
        return queue.length > 0 ? 'pending' : 'synced';
    },

    /**
     * Get pending sync queue from localStorage
     */
    getQueue() {
        try {
            const queue = JSON.parse(localStorage.getItem('erp_sync_queue') || '[]');
            return this.sanitizeQueue(queue);
        } catch (e) {
            return [];
        }
    },

    sanitizeQueue(queue) {
        const excludedKeys = this.getExcludedKeys();
        const sanitized = (Array.isArray(queue) ? queue : []).filter(key => {
            if (excludedKeys.includes(key)) return false;
            if (window.Storage && typeof Storage.canCurrentUserWriteKey === 'function' && !Storage.canCurrentUserWriteKey(key)) {
                return false;
            }
            return true;
        });

        if (sanitized.length !== queue.length) {
            localStorage.setItem('erp_sync_queue', JSON.stringify(sanitized));
            if (window.dispatchEvent && typeof CustomEvent !== 'undefined') {
                window.dispatchEvent(new CustomEvent('erp-sync-status-changed'));
            }
        }

        return sanitized;
    },

    getExcludedKeys() {
        // These keys are NEVER synced through the standard FirebaseSync pipeline:
        // - erp_users / erp_roles / erp_audit_log : cloud-authoritative, admin-only
        // - erp_transaction_counters : managed by Storage.CloudSequencer which writes
        //   directly to transactionCounters/counters atomically. Syncing it here would
        //   create a fat wrapper document that exceeds Firestore’s 1 MB limit.
        return ['erp_users', 'erp_roles', 'erp_audit_log', 'erp_transaction_counters'];
    },

    /**
     * Add a key to the sync queue
     */
    addToQueue(key) {
        if (this.getExcludedKeys().includes(key)) return;
        if (window.Storage && typeof Storage.canCurrentUserWriteKey === 'function' && !Storage.canCurrentUserWriteKey(key)) return;

        const queue = this.getQueue();
        if (!queue.includes(key)) {
            queue.push(key);
            localStorage.setItem('erp_sync_queue', JSON.stringify(queue));
            // Trigger UI update if possible
            window.dispatchEvent(new CustomEvent('erp-sync-status-changed'));
        }
    },

    /**
     * Remove a key from the sync queue
     */
    removeFromQueue(key) {
        let queue = this.getQueue();
        queue = queue.filter(k => k !== key);
        localStorage.setItem('erp_sync_queue', JSON.stringify(queue));
        window.dispatchEvent(new CustomEvent('erp-sync-status-changed'));
    },

    /**
     * Background process to retry failed syncs
     */
    async processQueue() {
        if (!this.isEnabled() || this._isProcessingQueue) return;

        const queue = this.getQueue();
        if (queue.length === 0) return;

        this._isProcessingQueue = true;
        window.dispatchEvent(new CustomEvent('erp-sync-status-changed'));
        console.log(`🔄 [Sync] Processing queue: ${queue.length} items...`);

        for (const key of queue) {
            try {
                const data = JSON.parse(localStorage.getItem(key));
                if (data) {
                    const success = await this.syncToFirestore(key, data, true); // true = called from queue
                    if (success) {
                        this.removeFromQueue(key);
                        console.log(`✅ [Sync] Successfully synced queued item: ${key}`);
                    }
                } else {
                    // Data gone from local? Remove from queue
                    this.removeFromQueue(key);
                }
            } catch (e) {
                console.warn(`⚠️ [Sync] Failed to process queued item ${key}:`, e.message);
            }
        }

        this._isProcessingQueue = false;
        window.dispatchEvent(new CustomEvent('erp-sync-status-changed'));
    },

    /**
     * Delete a specific document from Cloud and record a Tombstone
     * to prevent it from being restored by stale sessions.
     */
    async deleteFromCloud(key, id) {
        if (!this.isEnabled()) return;

        const collectionName = this.COLLECTION_MAP[key] || key;
        const db = window.db;
        const { doc, deleteDoc, setDoc } = window.firestore;

        const docId = String(id).replace(/\//g, '_');
        const docRef = doc(db, collectionName, docId);
        const tombstoneRef = doc(db, 'deletedRecords', `${collectionName}_${docId}`);

        try {
            console.log(`🗑️ [Sync] ABSOLUTE DELETE: ${collectionName}/${docId}`);
            // 1. Delete the actual record
            await deleteDoc(docRef);
            // 2. Create a tombstone (Record of deletion)
            await setDoc(tombstoneRef, {
                collection: collectionName,
                docId: docId,
                deletedAt: new Date().toISOString(),
                deletedBy: window.auth?.currentUser?.uid || 'unknown'
            });
            return true;
        } catch (error) {
            console.error(`❌ [Sync] Failed to delete or tombstone ${docId}:`, error);
            throw error;
        }
    },

    /**
     * Push data to Firestore based on localStorage key
     * @param {string} key - localStorage key
     * @param {Array|Object} data - Data to sync
     * @param {boolean} fromQueue - Whether this call is from the retry queue
     */
    async syncToFirestore(key, data, fromQueue = false) {
        if (!this.isEnabled()) {
            if (!fromQueue) this.addToQueue(key);
            return false;
        }
        if (key === 'erp_deleted_ids') return true;
        if (this.getExcludedKeys().includes(key)) {
            this.removeFromQueue(key);
            return true;
        }
        if (window.Storage && typeof Storage.canCurrentUserWriteKey === 'function' && !Storage.canCurrentUserWriteKey(key)) {
            this.removeFromQueue(key);
            console.warn(`⚠️ [Sync] Skipping ${key}: current role is read-only for this collection.`);
            return true;
        }

        if (!fromQueue) {
            window.dispatchEvent(new CustomEvent('erp-sync-status-changed'));
        }

        const collectionName = this.COLLECTION_MAP[key] || key;
        const db = window.db;
        const { collection, doc, setDoc, deleteDoc, writeBatch, getDocs, query, limit } = window.firestore;
        const auth = window.auth;

        const currentUser = auth.currentUser;
        console.log(`🔍 [Sync] Starting Sync for ${key} -> ${collectionName}`);

        try {
            if (Array.isArray(data)) {
                // 0. Fetch Tombstones (Deleted IDs) to ensure we don't restore them
                const tombstoneSnapshot = await getDocs(collection(db, 'deletedRecords'));
                const tombstones = new Set();
                tombstoneSnapshot.forEach(d => {
                    const t = d.data();
                    if (t.collection === collectionName) tombstones.add(t.docId);
                });

                // Generic key identifier
                const getItemKey = (item, idx) => {
                    return String(
                        item.id || item.code || item.reference || item.orderNumber || item.bomId || 
                        item.voucherNumber || item.prNumber || item.poNumber || item.soNumber || 
                        item.quotationNumber || item.grNumber || item.ttbNumber || item.invoiceNumber || 
                        item.batchNumber || item.name || item.username || item.roleCode || 
                        `item_${idx}`
                    ).replace(/\//g, '_');
                };

                // 1. Build local ID set (excluding tombstoned items)
                const localIds = new Set();
                data.forEach((item, index) => {
                    const docId = getItemKey(item, index);
                    if (!tombstones.has(docId)) {
                        localIds.add(docId);
                    }
                });

                // ============================================================
                // ADDITIVE-ONLY SYNC (Cross-User Safe)
                // ============================================================
                // NEVER delete cloud data during regular sync. This prevents
                // User A's save from deleting User B's new entries that haven't
                // been pulled to User A's localStorage yet.
                //
                // Deletion ONLY happens via explicit deleteFromCloud() which
                // properly creates tombstones.
                //
                // Only tombstone cleanup is allowed here — remove items from
                // cloud that were explicitly deleted via deleteFromCloud().
                // ============================================================

                const ops = [];

                // Tombstone cleanup: delete items that were explicitly marked for deletion
                const cloudSnapshot = await getDocs(collection(db, collectionName));
                cloudSnapshot.forEach(d => {
                    if (tombstones.has(d.id)) {
                        ops.push({ type: 'delete', ref: doc(db, collectionName, d.id), id: d.id });
                    }
                });

                // Upsert: add/update local items to cloud
                data.forEach((item, index) => {
                    const docId = getItemKey(item, index);
                    if (localIds.has(docId)) {
                        const docRef = doc(db, collectionName, docId);
                        // 🛡️ Strip undefined: Firestore rejects undefined field values
                        const payload = this.deepStripUndefined({
                            ...item,
                            _syncedAt: new Date().toISOString()
                        });
                        ops.push({ type: 'set', ref: docRef, data: payload });
                    }
                });

                // Execute in chunks
                const CHUNK_SIZE = 450;
                for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
                    const chunk = ops.slice(i, i + CHUNK_SIZE);
                    const batch = writeBatch(db);
                    chunk.forEach(op => {
                        if (op.type === 'delete') batch.delete(op.ref);
                        else batch.set(op.ref, op.data);
                    });
                    await batch.commit();
                }
            } else {
                // Single object — strip undefined before writing
                const docRef = doc(db, collectionName === 'config' ? 'config' : collectionName, key);
                const singlePayload = this.deepStripUndefined({
                    value: data,
                    _syncedAt: new Date().toISOString()
                });
                await setDoc(docRef, singlePayload);
            }

            if (!fromQueue) this.removeFromQueue(key);
            console.log(`✅ [Sync] Sync Complete for ${collectionName}`);
            return true;
        } catch (error) {
            console.error(`❌ [Sync] Sync failed for ${collectionName}:`, error);
            const isPermissionError = error.code === 'permission-denied' ||
                (error.message && error.message.includes('insufficient permissions'));

            if (isPermissionError && window.Storage && typeof Storage.canCurrentUserWriteKey === 'function' && !Storage.canCurrentUserWriteKey(key)) {
                this.removeFromQueue(key);
                return true;
            }

            if (!fromQueue) this.addToQueue(key);
            return false;
        }
    },

    /**
     * Force push all local data for a specific key to Firestore.
     */
    async pushLocalToCloud(key) {
        if (!this.isEnabled()) return { success: false, error: 'Firebase not enabled' };
        
        // Skip collections that are cloud-authoritative or strictly admin-only
        // to prevent "Missing or insufficient permissions" errors for normal users
        const EXCLUDED_KEYS = this.getExcludedKeys();
        if (EXCLUDED_KEYS.includes(key)) {
            this.removeFromQueue(key);
            return { success: true, count: 0, skipped: true };
        }
        if (window.Storage && typeof Storage.canCurrentUserWriteKey === 'function' && !Storage.canCurrentUserWriteKey(key)) {
            this.removeFromQueue(key);
            return { success: true, count: 0, skipped: true, readOnly: true };
        }

        const collectionName = this.COLLECTION_MAP[key] || key;
        const localData = JSON.parse(localStorage.getItem(key) || '[]');

        if (localData.length === 0) return { success: true, count: 0 };

        const db = window.db;
        const { doc, setDoc, writeBatch } = window.firestore;
        const batchSize = 450;

        try {
            let batch = writeBatch(db);
            let count = 0;
            let totalPushed = 0;

            for (const item of (Array.isArray(localData) ? localData : [localData])) {
                const docId = String(item.id || (typeof localData === 'object' ? key : 'default')).replace(/\//g, '_');
                const docRef = doc(db, collectionName, docId);

                const payload = this.deepStripUndefined({
                    ...(typeof item === 'object' ? item : { value: item }),
                    _syncedAt: new Date().toISOString()
                });

                batch.set(docRef, payload, { merge: true });

                count++;
                if (count >= batchSize) {
                    await batch.commit();
                    totalPushed += count;
                    batch = writeBatch(db);
                    count = 0;
                }
            }

            if (count > 0) {
                await batch.commit();
                totalPushed += count;
            }

            return { success: true, count: totalPushed };
        } catch (error) {
            console.error(`❌ [Sync] Push failed:`, error);
            return { success: false, error: error.message };
        }
    },

    // Keys that store a single plain OBJECT (not an array of records).
    // These are stored in Firestore as one document with { value: {...} } wrapper.
    SINGLE_OBJECT_KEYS: [
        'erp_work_calendar',
        'erp_config'
    ],

    async pullAllFromCloud() {
        if (!this.isEnabled()) return 0;
        const collections = Object.keys(this.COLLECTION_MAP);
        let totalPulled = 0;

        // ── 1. Load tombstones first so we can filter deleted records ─────────
        let tombstonesByCollection = {};
        try {
            const { getDocs, collection } = window.firestore;
            const db = window.db;
            const tombstoneSnapshot = await getDocs(collection(db, 'deletedRecords'));
            tombstoneSnapshot.forEach(doc => {
                const t = doc.data();
                if (t.collection && t.docId) {
                    if (!tombstonesByCollection[t.collection]) {
                        tombstonesByCollection[t.collection] = new Set();
                    }
                    tombstonesByCollection[t.collection].add(t.docId);
                }
            });
            console.log(`🗑️ [Sync] Loaded tombstones for ${Object.keys(tombstonesByCollection).length} collections`);
        } catch (e) {
            console.warn('[Sync] Could not load tombstones during pull:', e);
        }

        for (const key of collections) {
            if (window.Storage && typeof Storage.canCurrentUserReadKey === 'function' && !Storage.canCurrentUserReadKey(key)) {
                localStorage.removeItem(key);
                continue;
            }

            try {
                const collectionName = this.COLLECTION_MAP[key];
                const { getDocs, collection } = window.firestore;
                const db = window.db;
                const snapshot = await getDocs(collection(db, collectionName));
                const tombstones = tombstonesByCollection[collectionName] || new Set();

                if (this.SINGLE_OBJECT_KEYS.includes(key)) {
                    // These collections hold ONE document with a `value` wrapper
                    // e.g. workCalendar doc: { value: { '2026-06': { ... } }, _syncedAt: '...' }
                    let unwrapped = null;
                    snapshot.forEach(doc => {
                        const d = doc.data();
                        if (d && d.value !== undefined) {
                            // Merge all value fields (there should only be 1 doc)
                            unwrapped = (typeof d.value === 'object' && !Array.isArray(d.value))
                                ? { ...(unwrapped || {}), ...d.value }
                                : d.value;
                        }
                    });
                    if (unwrapped !== null) {
                        localStorage.setItem(key, JSON.stringify(unwrapped));
                        totalPulled++;
                        console.log(`✅ [Sync] Pulled single-object '${key}' from cloud (unwrapped).`);
                    }
                } else {
                    const remoteData = [];
                    snapshot.forEach(doc => {
                        // ── Filter out tombstoned records ──────────────────────
                        if (!tombstones.has(doc.id)) {
                            remoteData.push(doc.data());
                        } else {
                            console.log(`🗑️ [Sync] Skipping tombstoned record: ${collectionName}/${doc.id}`);
                        }
                    });
                    if (remoteData.length > 0) {
                        localStorage.setItem(key, JSON.stringify(remoteData));
                        totalPulled += remoteData.length;
                    } else {
                        // If cloud collection is empty or all records were deleted/tombstoned, clear local too
                        localStorage.setItem(key, JSON.stringify([]));
                    }
                }
            } catch (error) { console.error(`[Sync] Pull error for ${key}:`, error); }
        }

        // 🛡️ Post-pull hygiene: Purge target dummy employees if any returned from old cloud state
        if (window.Storage && typeof Storage.purgeTargetDummyEmployees === 'function') {
            await Storage.purgeTargetDummyEmployees();
        }

        return totalPulled;
    },

    async migrateAllToCloud() {
        if (!this.isEnabled()) return;
        const collections = Object.keys(this.COLLECTION_MAP);
        for (const key of collections) {
            await this.pushLocalToCloud(key);
        }
        this.sanitizeQueue(this.getQueue());
    },

    async getCloudStats() {
        if (!this.isEnabled()) return {};
        const stats = {};
        const db = window.db;
        const { getCountFromServer, collection } = window.firestore;
        for (const key of Object.keys(this.COLLECTION_MAP)) {
            const collectionName = this.COLLECTION_MAP[key];
            try {
                const snapshot = await getCountFromServer(collection(db, collectionName));
                const cloudCount = snapshot.data().count;
                const localCount = JSON.parse(localStorage.getItem(key) || '[]').length || 0;
                stats[key] = { cloud: cloudCount, local: localCount };
            } catch (e) { }
        }
        return stats;
    }
};

window.FirebaseSync = FirebaseSync;
