// ==========================================
// Direct Swap Analysis Report
// Physical Grammage Comparison (In vs Out)
// ==========================================

const SwapAnalysis = {
    transactions: [],
    startDate: new Date(new Date().setDate(1)).toISOString().split('T')[0], // First day of month
    endDate: new Date().toISOString().split('T')[0],

    init() {
        if (!Auth.isAuthenticated()) {
            window.location.href = 'login.html';
            return;
        }
        this.loadData();
        this.render();
    },

    loadData() {
        // Use Storage.get to find direct swaps
        const rawData = Storage.get('direct_swaps') || [];

        // Filter by date range
        this.transactions = rawData.filter(trx => {
            const date = trx.date;
            return date >= this.startDate && date <= this.endDate;
        }).sort((a, b) => new Date(b.date) - new Date(a.date));
    },

    render() {
        const content = document.getElementById('main-content');
        if (!content) return;

        const totals = this.calculateTotals();

        content.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">⚜️ Direct Swap Analysis</h1>
                <p class="page-description">Perbandingan fisik gramase Emas (Masuk vs Keluar)</p>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <div class="grid grid-3 gap-2 align-end">
                        <div class="form-group">
                            <label class="form-label">Tanggal Mulai</label>
                            <input type="date" id="report-start" class="form-input" value="${this.startDate}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Tanggal Selesai</label>
                            <input type="date" id="report-end" class="form-input" value="${this.endDate}">
                        </div>
                        <div class="form-group">
                            <button class="btn btn-primary" onclick="SwapAnalysis.updateFilters()">
                                🔍 Refresh Laporan
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="grid grid-4 gap-3 mb-3">
                <div class="card bg-light p-3 border-left-success">
                    <small class="text-gray bold">TOTAL MASUK (IN)</small>
                    <h2 class="text-success mt-1">${totals.weightIn.toFixed(2)}g</h2>
                </div>
                <div class="card bg-light p-3 border-left-danger">
                    <small class="text-gray bold">TOTAL KELUAR (OUT)</small>
                    <h2 class="text-danger mt-1">${totals.weightOut.toFixed(2)}g</h2>
                </div>
                <div class="card bg-light p-3 border-left-primary">
                    <small class="text-gray bold">NET GAIN (PHYSICAL PROFIT)</small>
                    <h2 class="text-primary mt-1">${totals.netGain.toFixed(2)}g</h2>
                </div>
                <div class="card bg-light p-3 border-left-warning">
                    <small class="text-gray bold">TOTAL SERVICE REVENUE</small>
                    <h2 class="mt-1">${this.formatCurrency(totals.revenue)}</h2>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">Rincian Perbandingan Swap</h2>
                    <div class="btn-group">
                        <button class="btn btn-secondary" onclick="SwapAnalysis.exportToCSV()">
                            📊 Export CSV
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Tanggal</th>
                                    <th>Customer</th>
                                    <th>Item IN (Scrap)</th>
                                    <th class="text-right">Berat IN</th>
                                    <th>Item OUT (Pure)</th>
                                    <th class="text-right">Berat OUT</th>
                                    <th class="text-right">Gain (g)</th>
                                    <th class="text-right">Revenue</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${this.renderRows()}
                            </tbody>
                            <tfoot>
                                <tr style="background: var(--bg-tertiary); font-weight: bold;">
                                    <td colspan="3">TOTAL</td>
                                    <td class="text-right text-success">${totals.weightIn.toFixed(2)}g</td>
                                    <td></td>
                                    <td class="text-right text-danger">${totals.weightOut.toFixed(2)}g</td>
                                    <td class="text-right text-primary">${totals.netGain.toFixed(2)}g</td>
                                    <td class="text-right">${this.formatCurrency(totals.revenue)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>
        `;
    },

    renderRows() {
        if (this.transactions.length === 0) {
            return '<tr><td colspan="8" class="text-center">Tidak ada transaksi dalam periode ini.</td></tr>';
        }

        return this.transactions.map(trx => {
            const gain = trx.itemIn.weight - trx.itemOut.weight;
            return `
                <tr>
                    <td>${trx.date}</td>
                    <td>${trx.customer.name}</td>
                    <td><small>${trx.itemIn.code}</small><br>${trx.itemIn.name}</td>
                    <td class="text-right bold text-success">${trx.itemIn.weight.toFixed(2)}g</td>
                    <td><small>${trx.itemOut.code}</small><br>${trx.itemOut.name}</td>
                    <td class="text-right bold text-danger">${trx.itemOut.weight.toFixed(2)}g</td>
                    <td class="text-right bold ${gain >= 0 ? 'text-primary' : 'text-danger'}">
                        ${gain.toFixed(2)}g
                    </td>
                    <td class="text-right bold">${this.formatCurrency(trx.serviceRevenue)}</td>
                </tr>
            `;
        }).join('');
    },

    calculateTotals() {
        return this.transactions.reduce((acc, trx) => {
            acc.weightIn += trx.itemIn.weight;
            acc.weightOut += trx.itemOut.weight;
            acc.revenue += trx.serviceRevenue;
            acc.netGain += (trx.itemIn.weight - trx.itemOut.weight);
            return acc;
        }, { weightIn: 0, weightOut: 0, revenue: 0, netGain: 0 });
    },

    updateFilters() {
        this.startDate = document.getElementById('report-start').value;
        this.endDate = document.getElementById('report-end').value;
        this.loadData();
        this.render();
    },

    formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    },

    exportToCSV() {
        const headers = ['Tanggal', 'Customer', 'Item IN', 'Berat IN (g)', 'Item OUT', 'Berat OUT (g)', 'Gain (g)', 'Revenue'];
        const rows = this.transactions.map(trx => [
            trx.date,
            trx.customer.name,
            `${trx.itemIn.code} - ${trx.itemIn.name}`,
            trx.itemIn.weight,
            `${trx.itemOut.code} - ${trx.itemOut.name}`,
            trx.itemOut.weight,
            trx.itemIn.weight - trx.itemOut.weight,
            trx.serviceRevenue
        ]);

        let csv = `Direct Swap Analysis (${this.startDate} to ${this.endDate})\n\n`;
        csv += headers.join(',') + '\n';
        rows.forEach(row => {
            csv += row.map(cell => `"${cell}"`).join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `swap-analysis-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }
};

window.SwapAnalysis = SwapAnalysis;
