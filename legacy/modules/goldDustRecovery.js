// ==========================================
// Gold Dust Recovery System
// Track recoverable gold dust from production
// ==========================================

const GoldDustRecovery = {
    recoveryRecords: [],

    init() {
        const auth = window.FirebaseAuth || window.Auth;
        if (!auth || !auth.isAuthenticated()) {
            window.location.href = 'login.html';
            return;
        }

        this.loadData();
        this.render();
    },

    loadData() {
        this.recoveryRecords = Storage.getGoldDustRecovery();
    },

    // ...

    recordDustRecovery(batchNumber, stage, dustWeight, estimatedPurity, warehouse) {
        // Calculate estimated value (assume gold price Rp 1,000,000/gram at 100% purity)
        const goldPricePerGram = 1000000;
        const purity = estimatedPurity || 90;
        const dustValue = (dustWeight * purity / 100) * goldPricePerGram;

        const record = {
            id: `DUST-${Date.now()}`,
            date: new Date().toISOString().split('T')[0],
            batchNumber: batchNumber,
            stage: stage,
            dustWeight: dustWeight,
            estimatedPurity: purity,
            dustValue: dustValue,
            warehouse: warehouse || 'RECOVERY-01',
            status: 'PENDING', // PENDING, COLLECTED, PROCESSED
            recordedBy: Auth.getCurrentUser()?.username || 'system'
        };

        this.recoveryRecords.push(record);
        Storage.saveGoldDustRecovery(this.recoveryRecords);

        // Generate journal entry
        this.generateDustRecoveryJournal(record);

        return record;
    },

    generateDustRecoveryJournal(record) {
        const journal = {
            date: record.date,
            referenceNumber: `DUST-${record.batchNumber}`,
            description: `Gold Dust Recovery - ${record.batchNumber} (${record.stage})`,
            lines: [
                {
                    accountCode: '1157', // Gold Dust Inventory (new account)
                    accountName: 'Gold Dust - Recoverable',
                    description: `Recovery ${record.dustWeight.toFixed(2)}g from ${record.stage}`,
                    debit: record.dustValue,
                    credit: 0
                },
                {
                    accountCode: '116X', // WIP stage (will be determined by stage)
                    accountName: 'WIP - Production Stage',
                    description: `Dust transferred to recovery`,
                    debit: 0,
                    credit: record.dustValue
                }
            ]
        };

        const journals = Storage.getJournalEntries();
        journals.push(journal);
        Storage.setJournalEntries(journals);
    }
};


// Explicitly make GoldDustRecovery globally available
window.GoldDustRecovery = GoldDustRecovery;
