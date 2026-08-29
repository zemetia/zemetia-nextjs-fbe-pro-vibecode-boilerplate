// ==========================================
// Gold Balance Report
// Consolidated view of customer gold balances
// ==========================================

const GoldBalanceReport = {
    balances: [],

    init() {
        if (!Auth.isAuthenticated()) {
            window.location.href = 'login.html';
            return;
        }

        this.loadData();
        this.render();
    },

    loadData() {
        const customers = Storage.getCustomers() || [];
        const balances = [];

        customers.forEach(customer => {
            if (typeof GoldSavings !== 'undefined') {
                const balance = GoldSavings.getBalance(customer.id);
                if (Math.abs(balance) > 0.0001) { // Only show customers with balance
                    balances.push({
                        customerId: customer.id,
                        customerName: customer.name,
                        balance: balance,
                        type: balance > 0 ? 'SIMPANAN' : 'OBLIGATION'
                    });
                }
            }
        });

        this.balances = balances.sort((a, b) => b.balance - a.balance);
    },

    render() {
        const content = document.getElementById('main-content');
        if (!content) return;

        content.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">🏆 Gold Balance Report</h1>
                <p class="page-description">Laporan saldo emas (Hutang/Piutang) per customer</p>
            </div>

            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">Gold Balances (${this.balances.length})</h2>
                    <div class="btn-group">
                        <button class="btn btn-secondary" onclick="GoldBalanceReport.exportToCSV()">
                            📊 Export CSV
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    ${this.renderTable()}
                </div>
            </div>
        `;
    },

    renderTable() {
        if (this.balances.length === 0) {
            return '<p class="text-center text-gray">Tidak ada saldo emas yang menggantung.</p>';
        }

        const totalGold = this.balances.reduce((sum, b) => sum + b.balance, 0);

        return `
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Customer Name</th>
                            <th class="text-right">Balance (Gram)</th>
                            <th class="text-center">Status</th>
                            <th class="text-right">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.balances.map(b => `
                            <tr>
                                <td><strong>${b.customerName}</strong></td>
                                <td class="text-right" style="color: ${b.balance > 0 ? '#388e3c' : '#d32f2f'};">
                                    <strong>${b.balance > 0 ? '+' : ''}${b.balance.toFixed(3)} g</strong>
                                </td>
                                <td class="text-center">
                                    <span class="badge ${b.balance > 0 ? 'badge-success' : 'badge-danger'}">
                                        ${b.balance > 0 ? 'Simpanan (Hutang Kami)' : 'Bon (Piutang Kami)'}
                                    </span>
                                </td>
                                <td class="text-right">
                                    <button class="btn btn-sm btn-outline" onclick="App.navigateTo('master-customer'); setTimeout(() => MasterCustomer.viewCustomer('${b.customerId}'), 100)">
                                        👁️ Detail
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                        <tr style="background: var(--bg-tertiary); font-weight: bold;">
                            <td>TOTAL NET BALANCE:</td>
                            <td class="text-right" style="color: ${totalGold >= 0 ? '#388e3c' : '#d32f2f'}">
                                ${totalGold.toFixed(3)} gram
                            </td>
                            <td></td>
                            <td></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
    },

    exportToCSV() {
        const headers = ['Customer Name', 'Balance (Gram)', 'Status'];
        const rows = this.balances.map(b => [
            b.customerName,
            b.balance.toFixed(3),
            b.balance > 0 ? 'Simpanan' : 'Bon'
        ]);

        let csv = `Gold Balance Report - ${new Date().toLocaleDateString('id-ID')}\n\n`;
        csv += headers.join(',') + '\n';
        rows.forEach(row => {
            csv += row.map(cell => `"${cell}"`).join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gold-balance-report-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }
};

window.GoldBalanceReport = GoldBalanceReport;
