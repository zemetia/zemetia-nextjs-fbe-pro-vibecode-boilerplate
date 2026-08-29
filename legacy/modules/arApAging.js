// ==========================================
// AR Aging Report - Accounts Receivable Aging
// Track outstanding customer payments by aging period
// ==========================================

const ARAging = {
    customers: [],
    transactions: [],
    asOfDate: new Date().toISOString().split('T')[0],
    agingData: [],

    init() {
        if (!Auth.isAuthenticated()) {
            window.location.href = 'login.html';
            return;
        }

        this.loadData();
        this.calculateAging();
        this.render();
    },

    loadData() {
        this.customers = Storage.getCustomers();
        this.transactions = this.getARTransactions();
    },

    getARTransactions() {
        // Get all journal entries affecting AR (1150 - Piutang Usaha)
        const journals = Storage.get(Storage.KEYS.JOURNAL_ENTRIES) || [];
        const arTransactions = [];

        journals.forEach(journal => {
            journal.lines.forEach(line => {
                if (line.accountCode === '1150') { // Piutang Usaha
                    arTransactions.push({
                        date: journal.date,
                        refNo: journal.referenceNumber,
                        description: journal.description,
                        debit: line.debit || 0,
                        credit: line.credit || 0,
                        balance: (line.debit || 0) - (line.credit || 0)
                    });
                }
            });
        });

        return arTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));
    },

    calculateAging() {
        // Calculate aging for each customer
        const customerBalances = {};

        this.transactions.forEach(t => {
            // Simple: group by first word of description as customer
            const customer = t.description.split(' ')[0] || 'Unknown';

            if (!customerBalances[customer]) {
                customerBalances[customer] = {
                    customerName: customer,
                    total: 0,
                    current: 0,
                    days1_30: 0,
                    days31_60: 0,
                    days61_90: 0,
                    daysOver90: 0,
                    transactions: []
                };
            }

            const balance = t.balance;
            if (balance > 0) { // Only outstanding (positive balance)
                const daysDiff = this.getDaysDiff(t.date, this.asOfDate);

                customerBalances[customer].total += balance;
                customerBalances[customer].transactions.push({
                    ...t,
                    daysOld: daysDiff
                });

                if (daysDiff <= 0) {
                    customerBalances[customer].current += balance;
                } else if (daysDiff <= 30) {
                    customerBalances[customer].days1_30 += balance;
                } else if (daysDiff <= 60) {
                    customerBalances[customer].days31_60 += balance;
                } else if (daysDiff <= 90) {
                    customerBalances[customer].days61_90 += balance;
                } else {
                    customerBalances[customer].daysOver90 += balance;
                }
            }
        });

        this.agingData = Object.values(customerBalances).filter(c => c.total > 0);
    },

    getDaysDiff(fromDate, toDate) {
        const from = new Date(fromDate);
        const to = new Date(toDate);
        return Math.floor((to - from) / (1000 * 60 * 60 * 24));
    },

    render() {
        const content = document.getElementById('main-content');
        content.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">💵 AR Aging Report</h1>
        <p class="page-description">Accounts Receivable aging analysis as of ${new Date(this.asOfDate).toLocaleDateString('id-ID')}</p>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Outstanding Receivables (${this.agingData.length} customers)</h2>
          <div class="btn-group">
            <button class="btn btn-secondary" onclick="ARAging.exportToCSV()">
              📊 Export CSV
            </button>
          </div>
        </div>
        <div class="card-body">
          ${this.renderAgingTable()}
        </div>
      </div>
    `;
    },

    renderAgingTable() {
        if (this.agingData.length === 0) {
            return '<p class="text-center text-gray">No outstanding receivables</p>';
        }

        const totals = this.agingData.reduce((acc, c) => ({
            total: acc.total + c.total,
            current: acc.current + c.current,
            days1_30: acc.days1_30 + c.days1_30,
            days31_60: acc.days31_60 + c.days31_60,
            days61_90: acc.days61_90 + c.days61_90,
            daysOver90: acc.daysOver90 + c.daysOver90
        }), { total: 0, current: 0, days1_30: 0, days31_60: 0, days61_90: 0, daysOver90: 0 });

        return `
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Customer</th>
              <th class="text-right">Total</th>
              <th class="text-right">Current</th>
              <th class="text-right">1-30 Days</th>
              <th class="text-right">31-60 Days</th>
              <th class="text-right" style="background: hsl(45, 100%, 20%);">61-90 Days</th>
              <th class="text-right" style="background: hsl(0, 72%, 25%);">&gt;90 Days</th>
            </tr>
          </thead>
          <tbody>
            ${this.agingData.map(c => `
              <tr>
                <td><strong>${c.customerName}</strong></td>
                <td class="text-right">${this.formatCurrency(c.total)}</td>
                <td class="text-right">${this.formatCurrency(c.current)}</td>
                <td class="text-right">${this.formatCurrency(c.days1_30)}</td>
                <td class="text-right">${this.formatCurrency(c.days31_60)}</td>
                <td class="text-right" style="background: ${c.days61_90 > 0 ? '#fff3cd' : ''}">
                  ${this.formatCurrency(c.days61_90)}
                </td>
                <td class="text-right" style="background: ${c.daysOver90 > 0 ? '#f8d7da' : ''}">
                  ${this.formatCurrency(c.daysOver90)}
                </td>
              </tr>
            `).join('')}
            <tr style="background: var(--bg-tertiary); font-weight: bold;">
              <td>TOTAL</td>
              <td class="text-right">${this.formatCurrency(totals.total)}</td>
              <td class="text-right">${this.formatCurrency(totals.current)}</td>
              <td class="text-right">${this.formatCurrency(totals.days1_30)}</td>
              <td class="text-right">${this.formatCurrency(totals.days31_60)}</td>
              <td class="text-right" style="background: hsl(45, 100%, 20%);">${this.formatCurrency(totals.days61_90)}</td>
              <td class="text-right" style="background: hsl(0, 72%, 25%);">${this.formatCurrency(totals.daysOver90)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      ${totals.daysOver90 > 0 ? `
        <div style="margin-top: 16px; padding: 12px; background: hsl(0, 72%, 25%); border-radius: 8px; border-left: 4px solid #dc3545;">
          <strong>⚠️ Alert:</strong> Ada ${this.formatCurrency(totals.daysOver90)} piutang &gt;90 hari yang perlu follow-up segera!
        </div>
      ` : ''}
    `;
    },

    formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    },

    exportToCSV() {
        const headers = ['Customer', 'Total', 'Current', '1-30 Days', '31-60 Days', '61-90 Days', '>90 Days'];
        const rows = this.agingData.map(c => [
            c.customerName,
            c.total,
            c.current,
            c.days1_30,
            c.days31_60,
            c.days61_90,
            c.daysOver90
        ]);

        let csv = `AR Aging Report as of ${this.asOfDate}\n\n`;
        csv += headers.join(',') + '\n';
        rows.forEach(row => {
            csv += row.map(cell => `"${cell}"`).join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ar-aging-${this.asOfDate}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }
};

// AP Aging (similar structure for Accounts Payable)
const APAging = {
    ...ARAging,

    init() {
        if (!Auth.isAuthenticated()) {
            window.location.href = 'login.html';
            return;
        }

        this.loadData();
        this.calculateAging();
        this.render();
    },

    getARTransactions() {
        // Override to use AP account (2110 - Hutang Usaha)
        const journals = Storage.get(Storage.KEYS.JOURNAL_ENTRIES) || [];
        const apTransactions = [];

        journals.forEach(journal => {
            journal.lines.forEach(line => {
                if (line.accountCode === '2110') { // Hutang Usaha
                    apTransactions.push({
                        date: journal.date,
                        refNo: journal.referenceNumber,
                        description: journal.description,
                        debit: line.debit || 0,
                        credit: line.credit || 0,
                        balance: (line.credit || 0) - (line.debit || 0) // Reverse for AP
                    });
                }
            });
        });

        return apTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));
    },

    render() {
        const content = document.getElementById('main-content');
        content.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">💸 AP Aging Report</h1>
        <p class="page-description">Accounts Payable aging analysis as of ${new Date(this.asOfDate).toLocaleDateString('id-ID')}</p>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Outstanding Payables (${this.agingData.length} suppliers)</h2>
          <div class="btn-group">
            <button class="btn btn-secondary" onclick="APAging.exportToCSV()">
              📊 Export CSV
            </button>
          </div>
        </div>
        <div class="card-body">
          ${this.renderAgingTable()}
        </div>
      </div>
    `;
    }
};
