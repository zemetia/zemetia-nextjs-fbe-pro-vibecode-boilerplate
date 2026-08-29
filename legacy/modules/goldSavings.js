// ==========================================
// Gold Savings Module (Tabungan/Hutang Emas)
// Mengelola saldo emas customer (Gramasi)
// ==========================================

const GoldSavings = {
    transactions: [],

    init() {
        this.loadTransactions();
    },

    loadTransactions() {
        this.transactions = Storage.get(Storage.KEYS.GOLD_TRANSACTIONS) || [];
    },

    saveTransactions() {
        return Storage.set(Storage.KEYS.GOLD_TRANSACTIONS, this.transactions);
    },

    /**
     * Get current gold balance for a customer (in grams)
     * Positive = Customer has gold (We owe them)
     * Negative = Customer owes gold (They owe us)
     */
    getBalance(customerId) {
        if (!customerId) return 0;

        const customerTrx = this.transactions.filter(t => t.customerId === customerId);
        return customerTrx.reduce((sum, t) => sum + (parseFloat(t.weight) || 0), 0);
    },

    /**
     * Add a gold transaction
     * @param {Object} data
     * @param {string} data.customerId
     * @param {string} data.type - 'DEPOSIT', 'WITHDRAW', 'OBLIGATION', 'PAYMENT', 'JOB_ORDER_VARIANCE', 'SWAP_VARIANCE'
     * @param {number} data.weight - Grams (Positive adds to balance, Negative subtracts)
     * @param {string} data.description
     * @param {string} data.referenceId - Optional (JobOrderID, SwapID)
     */
    async addTransaction(data) {
        if (!data.customerId || data.weight === undefined) {
            console.error('GoldSavings: Invalid transaction data', data);
            return false;
        }

        const transaction = {
            id: `GS-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            date: new Date().toISOString(),
            customerId: data.customerId,
            type: data.type || 'MANUAL',
            weight: parseFloat(data.weight),
            description: data.description || '',
            referenceId: data.referenceId || null,
            createdBy: (typeof Auth !== 'undefined' && Auth.getCurrentUser()) ? Auth.getCurrentUser().name : 'System'
        };

        this.transactions.push(transaction);
        await this.saveTransactions();

        console.log(`✅ Gold Transaction Added: ${transaction.type} ${transaction.weight}g for ${transaction.customerId}`);
        return transaction;
    },

    /**
     * Get all transactions for a customer
     */
    getHistory(customerId) {
        return this.transactions
            .filter(t => t.customerId === customerId)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    },

    /**
     * Render the Gold Savings card in Customer Detail
     */
    renderCustomerCard(customerId) {
        const balance = this.getBalance(customerId);
        const history = this.getHistory(customerId);

        let balanceClass = 'text-gray';
        let statusText = 'NIL';

        if (balance > 0.001) {
            balanceClass = 'text-success'; // Customer punya simpanan
            statusText = 'Simpanan';
        } else if (balance < -0.001) {
            balanceClass = 'text-danger'; // Customer hutang emas
            statusText = 'Hutang';
        }

        return `
            <div class="card mt-3">
                <div class="card-header bg-gold text-white" style="background: linear-gradient(45deg, #b48811, #ebd197);">
                    <h3 class="card-title text-white">🏆 Gold Balance (Tabungan Emas)</h3>
                </div>
                <div class="card-body">
                    <div class="text-center p-3 mb-3" style="background: #fffbf0; border-radius: 8px; border: 1px solid #e2c069;">
                        <small class="text-secondary text-uppercase font-bold">${statusText}</small>
                        <div class="text-3xl font-bold ${balanceClass}">${balance.toFixed(3)} <span class="text-sm text-gray">gram</span></div>
                    </div>

                    <h4 class="mb-2">Riwayat Mutasi</h4>
                    <div class="table-container" style="max-height: 200px; overflow-y: auto;">
                        <table class="table table-sm table-striped">
                            <thead>
                                <tr>
                                    <th>Tanggal</th>
                                    <th>Tipe</th>
                                    <th>Ref</th>
                                    <th class="text-right">Mutasi</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${history.length > 0 ? history.map(t => `
                                    <tr>
                                        <td>${new Date(t.date).toLocaleDateString()}</td>
                                        <td><span class="badge ${t.weight >= 0 ? 'badge-success' : 'badge-danger'}">${t.type}</span></td>
                                        <td><small>${t.referenceId || '-'}</small></td>
                                        <td class="text-right font-bold ${t.weight >= 0 ? 'text-success' : 'text-danger'}">
                                            ${t.weight > 0 ? '+' : ''}${t.weight.toFixed(3)}
                                        </td>
                                    </tr>
                                `).join('') : '<tr><td colspan="4" class="text-center text-gray">Belum ada transaksi emas</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }
};

// Make globally available
window.GoldSavings = GoldSavings;
