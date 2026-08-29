// ==========================================
// Firebase Storage Wrapper
// ==========================================
// This replaces localStorage with Firestore
// Maintains same interface for backward compatibility

import { db, auth } from '../firebase-config.js';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    writeBatch,
    runTransaction,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const FirebaseStorage = {
    // ☁️ CLOUD-FIRST ARCHITECTURE (FORCED ON)
    USE_FIREBASE: true,

    // Cache for real-time listeners
    listeners: {},

    // Collection names mapping
    COLLECTIONS: {
        chartOfAccounts: 'chartOfAccounts',
        journalEntries: 'journalEntries',
        paymentVouchers: 'paymentVouchers',
        purchaseRequisitions: 'purchaseRequisitions',
        suppliers: 'suppliers',
        customers: 'customers',
        users: 'erp_users',
        roles: 'erp_roles',
        items: 'items',
        warehouses: 'warehouses',
        taxes: 'taxes',
        bankAccounts: 'bankAccounts',
        paymentTerms: 'paymentTerms',
        departments: 'departments',
        config: 'config'
    },

    /**
     * Get data from Firestore
     * @param {string} key - Storage key (collection name)
     * @returns {Promise<any>} Data from Firestore
     */
    async get(key) {
        // Mandatory Firebase
        try {
            const collectionName = this.getCollectionName(key);

            // For config, get single document
            if (collectionName === 'config') {
                const docRef = doc(db, collectionName, key);
                const docSnap = await getDoc(docRef);
                return docSnap.exists() ? docSnap.data().value : null;
            }

            // For collections, get all documents
            const querySnapshot = await getDocs(collection(db, collectionName));
            const data = [];
            querySnapshot.forEach((doc) => {
                data.push({ id: doc.id, ...doc.data() });
            });

            return data.length > 0 ? data : null;
        } catch (error) {
            console.error(`Error getting ${key} from Firestore:`, error);
            throw error; // No silent local fallback
        }
    },

    /**
     * Set data to Firestore
     * @param {string} key - Storage key
     * @param {any} value - Data to store
     * @returns {Promise<boolean>} Success status
     */
    async set(key, value) {
        // Mandatory Firebase
        try {
            const collectionName = this.getCollectionName(key);

            // For config, set single document
            if (collectionName === 'config') {
                const docRef = doc(db, collectionName, key);
                await setDoc(docRef, {
                    value,
                    updatedAt: serverTimestamp(),
                    updatedBy: auth.currentUser?.uid
                });
                return true;
            }

            // For arrays/collections, use batch write with diffing strategy
            if (Array.isArray(value)) {
                console.log(`🔄 FirebaseStorage: Bulk setting ${key} via Diff Strategy...`);

                // 1. Fetch current IDs from Firestore to identify deletions
                const existingDocs = await getDocs(collection(db, collectionName));
                const cloudIds = new Set();
                existingDocs.forEach(d => cloudIds.add(d.id));

                const localIds = new Set();
                value.forEach((item, index) => {
                    const docId = String(item.id || item.code || `item_${index}`).replace(/\//g, '_');
                    localIds.add(docId);
                });

                // Identify IDs to delete
                const idsToDelete = [...cloudIds].filter(id => !localIds.has(id));

                // 2. Prepare operations
                const ops = [];

                // Add deletes
                idsToDelete.forEach(id => {
                    ops.push({ type: 'delete', ref: doc(db, collectionName, id) });
                });

                // Add upserts
                value.forEach((item, index) => {
                    const docId = String(item.id || item.code || `item_${index}`).replace(/\//g, '_');
                    const docRef = doc(db, collectionName, docId);
                    ops.push({
                        type: 'set',
                        ref: docRef,
                        data: {
                            ...item,
                            updatedAt: serverTimestamp(),
                            updatedBy: auth.currentUser?.uid
                        }
                    });
                });

                // 3. Execute in chunks
                const CHUNK_SIZE = 450;
                for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
                    const chunk = ops.slice(i, i + CHUNK_SIZE);
                    const batch = writeBatch(db);

                    chunk.forEach(op => {
                        if (op.type === 'delete') {
                            batch.delete(op.ref);
                        } else {
                            batch.set(op.ref, op.data);
                        }
                    });

                    await batch.commit();
                }

                console.log(`✅ FirebaseStorage: Bulk set ${key} success (${value.length} items)`);
                return true;
            }

            // For single object
            const docId = value.id || doc(collection(db, collectionName)).id;
            const docRef = doc(db, collectionName, docId);
            await setDoc(docRef, {
                ...value,
                id: docId,
                updatedAt: serverTimestamp(),
                updatedBy: auth.currentUser?.uid
            }, { merge: true });
            return true;

        } catch (error) {
            console.error(`Error setting ${key} to Firestore:`, error);
            throw error; // No silent local fallback
        }
    },

    /**
     * Alias for set (used by FirebaseAuth for compatibility)
     * @param {string} key - Storage key
     * @param {object} data - Data to add
     * @returns {Promise<boolean>} Success status
     */
    async save(key, data) {
        return this.set(key, data);
    },

    /**
     * Add single item to collection
     * @param {string} collectionName - Collection name
     * @param {object} data - Data to add
     * @returns {Promise<string>} Document ID
     */
    async addItem(collectionName, data) {
        try {
            const docRef = doc(collection(db, collectionName));
            await setDoc(docRef, {
                ...data,
                id: docRef.id,
                createdAt: serverTimestamp(),
                createdBy: auth.currentUser?.uid
            });
            return docRef.id;
        } catch (error) {
            console.error('Error adding item:', error);
            throw error;
        }
    },

    /**
     * Update single item in collection
     * @param {string} collectionName - Collection name
     * @param {string} docId - Document ID
     * @param {object} data - Data to update
     * @returns {Promise<boolean>} Success status
     */
    async updateItem(collectionName, docId, data) {
        try {
            const docRef = doc(db, collectionName, docId);
            await updateDoc(docRef, {
                ...data,
                updatedAt: serverTimestamp(),
                updatedBy: auth.currentUser?.uid
            });
            return true;
        } catch (error) {
            console.error('Error updating item:', error);
            throw error;
        }
    },

    /**
     * Delete single item from collection
     * @param {string} collectionName - Collection name
     * @param {string} docId - Document ID
     * @returns {Promise<boolean>} Success status
     */
    async deleteItem(collectionName, docId) {
        try {
            const docRef = doc(db, collectionName, docId);
            await deleteDoc(docRef);
            return true;
        } catch (error) {
            console.error('Error deleting item:', error);
            throw error;
        }
    },

    /**
     * Subscribe to real-time updates
     * @param {string} key - Storage key
     * @param {function} callback - Callback function for updates
     * @returns {function} Unsubscribe function
     */
    subscribe(key, callback) {
        if (!this.USE_FIREBASE) {
            return () => { }; // No-op for localStorage
        }

        const collectionName = this.getCollectionName(key);

        const unsubscribe = onSnapshot(
            collection(db, collectionName),
            (snapshot) => {
                const data = [];
                snapshot.forEach((doc) => {
                    data.push({ id: doc.id, ...doc.data() });
                });
                callback(data);
            },
            (error) => {
                console.error(`Error in subscription for ${key}:`, error);
            }
        );

        // Store unsubscribe function
        this.listeners[key] = unsubscribe;

        return unsubscribe;
    },

    /**
     * Unsubscribe from all listeners
     */
    unsubscribeAll() {
        Object.values(this.listeners).forEach(unsubscribe => unsubscribe());
        this.listeners = {};
    },

    /**
     * Query collection with filters
     * @param {string} collectionName - Collection name
     * @param {Array} filters - Array of filter objects [{field, operator, value}]
     * @param {string} orderByField - Field to order by
     * @param {string} orderDirection - 'asc' or 'desc'
     * @returns {Promise<Array>} Query results
     */
    async query(key, filters = [], orderByField = null, orderDirection = 'asc') {
        try {
            const collectionName = this.getCollectionName(key);
            let q = collection(db, collectionName);

            // Apply filters
            filters.forEach(filter => {
                q = query(q, where(filter.field, filter.operator, filter.value));
            });

            // Apply ordering
            if (orderByField) {
                q = query(q, orderBy(orderByField, orderDirection));
            }

            const querySnapshot = await getDocs(q);
            const results = [];
            querySnapshot.forEach((doc) => {
                results.push({ id: doc.id, ...doc.data() });
            });

            return results;
        } catch (error) {
            console.error('Error querying Firestore:', error);
            return [];
        }
    },

    /**
     * Run transaction for atomic operations
     * @param {function} updateFunction - Function that performs transaction
     * @returns {Promise<any>} Transaction result
     */
    async transaction(updateFunction) {
        try {
            return await runTransaction(db, updateFunction);
        } catch (error) {
            console.error('Transaction error:', error);
            throw error;
        }
    },

    // Helper methods

    getCollectionName(key) {
        // Map storage keys to collection names
        const keyMap = {
            'erp_chart_of_accounts': 'chartOfAccounts',
            'erp_journal_entries': 'journalEntries',
            'payment_vouchers': 'paymentVouchers',
            'receipt_vouchers': 'receiptVouchers',
            'purchase_requisitions': 'purchaseRequisitions',
            'erp_suppliers': 'suppliers',
            'erp_customers': 'customers',
            'erp_users': 'erp_users',
            'erp_roles': 'erp_roles',
            'erp_items': 'items',
            'erp_warehouses': 'warehouses',
            'erp_taxes': 'taxes',
            'erp_bank_accounts': 'bankAccounts',
            'erp_payment_terms': 'paymentTerms',
            'erp_departments': 'departments',
            'erp_config': 'config',
            'erp_transaction_counters': 'config',
            'erp_account_mapping': 'config',
            'erp_approval_limits': 'config',
            'direct_swaps': 'directSwaps',
            'goods_receipts': 'goodsReceipts',
            'erp_production_batches': 'productionBatches',
            'erp_sales_orders': 'salesOrders',
            'erp_quotations': 'quotations',
            'ttb_documents': 'ttbDocuments',
            'supplier_invoices': 'supplierInvoices',
            'erp_fixed_assets': 'fixedAssets',
            'erp_production_orders': 'productionOrders',
            'erp_warehouse_stock': 'warehouseStock',
            'erp_warehouse_stock_movements': 'warehouseStockMovements',
            'erp_audit_log': 'auditLog'
        };

        return keyMap[key] || key;
    },

    // Fallback to localStorage
    getFromLocalStorage(key) {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
    },

    setToLocalStorage(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    },

    // Migration helper
    async migrateFromLocalStorage() {
        console.log('🔄 Starting migration from localStorage to Firestore...');

        const keys = [
            'erp_chart_of_accounts',
            'erp_journal_entries',
            'payment_vouchers',
            'purchase_requisitions',
            'erp_suppliers',
            'erp_customers',
            'erp_users',
            'erp_roles',
            'erp_items',
            'erp_warehouses',
            'erp_taxes',
            'erp_bank_accounts',
            'erp_payment_terms',
            'erp_departments',
            'erp_config'
        ];

        let success = 0;
        let failed = 0;

        for (const key of keys) {
            try {
                const data = this.getFromLocalStorage(key);
                if (data) {
                    await this.set(key, data);
                    console.log(`✅ Migrated ${key}`);
                    success++;
                } else {
                    console.log(`⏭️  Skipped ${key} (no data)`);
                }
            } catch (error) {
                console.error(`❌ Failed to migrate ${key}:`, error);
                failed++;
            }
        }

        console.log(`\n✅ Migration complete! Success: ${success}, Failed: ${failed}`);
        return { success, failed };
    }
};

export default FirebaseStorage;
