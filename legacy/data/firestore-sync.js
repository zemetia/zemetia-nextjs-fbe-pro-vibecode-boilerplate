// ============================================== 
// Firestore to localStorage Sync
// Automatically sync Firestore data to localStorage on app load
// ==============================================

// IMMEDIATE window assignment for debugging
console.log('🔵 firestore-sync.js loading...');
console.log('🔵 Storage is:', typeof Storage);
console.log('🔵 Storage.KEYS is:', typeof Storage.KEYS);

const FirestoreSync = {
    listeners: {}, // Store unsubscribe functions

    async syncAll() {
        console.log('🔄 Starting Firestore → localStorage sync (Real-time)...');

        try {
            // Import required modules
            const { db } = await import('../firebase-config.js');

            // Set up real-time listeners for all collections
            this.syncCollection(db, 'chartOfAccounts', Storage.KEYS.CHART_OF_ACCOUNTS);
            this.syncCollection(db, 'journalEntries', Storage.KEYS.JOURNAL_ENTRIES);
            this.syncCollection(db, 'suppliers', Storage.KEYS.SUPPLIERS);
            this.syncCollection(db, 'customers', Storage.KEYS.CUSTOMERS);
            this.syncCollection(db, 'bankAccounts', Storage.KEYS.BANK_ACCOUNTS);
            this.syncCollection(db, 'paymentVouchers', Storage.KEYS.PAYMENT_VOUCHERS);
            this.syncCollection(db, 'receiptVouchers', Storage.KEYS.RECEIPT_VOUCHERS);
            this.syncCollection(db, 'bug_reports', Storage.KEYS.BUG_REPORTS);
            this.syncCollection(db, 'erp_master_shifts', Storage.KEYS.MASTER_SHIFTS);
            this.syncCollection(db, 'erp_work_calendar', Storage.KEYS.WORK_CALENDAR);
            this.syncCollection(db, 'leaveBalances', Storage.KEYS.LEAVE_BALANCES);
            this.syncCollection(db, 'leaveRequests', Storage.KEYS.LEAVE_REQUESTS);

            // Sync single documents
            this.syncCounters(db);
            this.syncConfig(db);

            console.log('✅ Firestore real-time sync listeners attached!');
            return true;
        } catch (error) {
            console.error('❌ Firestore sync error:', error);
            return false;
        }
    },

    async syncCollection(db, collectionName, storageKey) {
        if (this.listeners[collectionName]) {
            return; // Already listening
        }

        try {
            const { collection, onSnapshot } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
            
            this.listeners[collectionName] = onSnapshot(collection(db, collectionName), (snapshot) => {
                const data = [];
                snapshot.forEach((doc) => {
                    data.push(doc.data());
                });

                if (data.length > 0) {
                    Storage.set(storageKey, data, true); // true = skipCloud (data is already from Cloud)
                    console.log(`  ✓ Synced (Real-time) ${collectionName}: ${data.length} items`);
                    window.dispatchEvent(new CustomEvent('erp-sync-status-changed'));
                }
            }, (error) => {
                console.error(`  ✗ Error listening to ${collectionName}:`, error.message);
            });

        } catch (error) {
            console.error(`  ✗ Error setting up listener for ${collectionName}:`, error.message);
        }
    },

    async syncCounters(db) {
        if (this.listeners['transactionCounters']) return;

        try {
            const { doc, onSnapshot } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");

            this.listeners['transactionCounters'] = onSnapshot(doc(db, 'transactionCounters', 'counters'), (docSnap) => {
                if (docSnap.exists()) {
                    const counters = docSnap.data();
                    Storage.set(Storage.KEYS.TRANSACTION_COUNTERS, counters, true);
                    console.log(`  ✓ Synced (Real-time) transaction counters: ${Object.keys(counters).length} types`);
                }
            }, (error) => {
                console.error('  ✗ Error listening to counters:', error.message);
            });
        } catch (error) {
            console.error('  ✗ Error setting up listener for counters:', error.message);
        }
    },

    async syncConfig(db) {
        if (this.listeners['config']) return;

        try {
            const { doc, onSnapshot } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");

            this.listeners['config'] = onSnapshot(doc(db, 'config', 'app'), (docSnap) => {
                if (docSnap.exists()) {
                    const config = docSnap.data();
                    Storage.set(Storage.KEYS.CONFIG, config, true);
                    console.log('  ✓ Synced (Real-time) config');
                }
            }, (error) => {
                console.error('  ✗ Error listening to config:', error.message);
            });
        } catch (error) {
            console.error('  ✗ Error setting up listener for config:', error.message);
        }
    },

    // Optional: method to unsubscribe all listeners if needed (e.g. on logout)
    stopAllListeners() {
        for (const key in this.listeners) {
            if (typeof this.listeners[key] === 'function') {
                this.listeners[key](); // unsubscribe
            }
        }
        this.listeners = {};
        console.log('🛑 All Firestore listeners stopped.');
    }
};

// Export to global window for use in App.init()
window.FirestoreSync = FirestoreSync;
console.log('🟢 window.FirestoreSync assigned!', window.FirestoreSync);

