// ==========================================
// Transaction Registers - Sales & Purchase
// Consolidated module for transaction listing
// ==========================================

const SalesRegister = {
    transactions: [],
    startDate: new Date(new Date().setDate(1)).toISOString().split('T')[0],
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
        // Get all sales transactions (revenue account 4xxx)
        const journals = Storage.get(Storage.KEYS.JOURNAL_ENTRIES) || [];
        this.transactions = [];

        journals.forEach(journal => {
            const hasRevenue = journal.lines.some(l => l.accountCode.startsWith('4'));
            if (hasRevenue) {
                const revenueAmount = journal.lines
                    .filter(l => l.accountCode.startsWith('4'))
                    .reduce((sum, l) => sum + (l.credit || 0), 0);

                this.transactions.push({
                    date: journal.date,
                    refNo: journal.referenceNumber,
                    description: journal.description,
                    amount: revenueAmount
                });
            }
        });

        this.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    },

    render() {
        const content = document.getElementById('main-content');
        content.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">💰 Sales Register</h1>
        <p class="page-description">Complete list of all sales transactions</p>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Sales Transactions (${this.transactions.length})</h2>
          <div class="btn-group">
            <button class="btn btn-secondary" onclick="SalesRegister.exportToCSV()">
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
        if (this.transactions.length === 0) {
            return '<p class="text-center text-gray">No sales transactions found</p>';
        }

        const total = this.transactions.reduce((sum, t) => sum + t.amount, 0);

        return `
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Ref No</th>
              <th>Description</th>
              <th class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${this.transactions.map(t => `
              <tr>
                <td>${new Date(t.date).toLocaleDateString('id-ID')}</td>
                <td><span class="badge badge-primary">${t.refNo}</span></td>
                <td>${t.description}</td>
                <td class="text-right">${this.formatCurrency(t.amount)}</td>
              </tr>
            `).join('')}
            <tr style="background: var(--bg-tertiary); font-weight: bold;">
              <td colspan="3" class="text-right">TOTAL SALES:</td>
              <td class="text-right">${this.formatCurrency(total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
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
        const headers = ['Date', 'Ref No', 'Description', 'Amount'];
        const rows = this.transactions.map(t => [
            new Date(t.date).toLocaleDateString('id-ID'),
            t.refNo,
            t.description,
            t.amount
        ]);

        let csv = `Sales Register\n\n`;
        csv += headers.join(',') + '\n';
        rows.forEach(row => {
            csv += row.map(cell => `"${cell}"`).join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sales-register-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }
};

// Purchase Register (similar to Sales but for expenses)
const PurchaseRegister = {
    ...SalesRegister,

    init() {
        if (!Auth.isAuthenticated()) {
            window.location.href = 'login.html';
            return;
        }

        this.loadData();
        this.render();
    },

    loadData() {
        // Get all purchase transactions (expense account 5xxx)
        const journals = Storage.get(Storage.KEYS.JOURNAL_ENTRIES) || [];
        this.transactions = [];

        journals.forEach(journal => {
            const hasExpense = journal.lines.some(l => l.accountCode.startsWith('5'));
            if (hasExpense) {
                const expenseAmount = journal.lines
                    .filter(l => l.accountCode.startsWith('5'))
                    .reduce((sum, l) => sum + (l.debit || 0), 0);

                this.transactions.push({
                    date: journal.date,
                    refNo: journal.referenceNumber,
                    description: journal.description,
                    amount: expenseAmount
                });
            }
        });

        this.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    },

    render() {
        const content = document.getElementById('main-content');
        content.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">🛒 Purchase Register</h1>
        <p class="page-description">Complete list of all purchase transactions</p>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Purchase Transactions (${this.transactions.length})</h2>
          <div class="btn-group">
            <button class="btn btn-secondary" onclick="PurchaseRegister.exportToCSV()">
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
        if (this.transactions.length === 0) {
            return '<p class="text-center text-gray">No purchase transactions found</p>';
        }

        const total = this.transactions.reduce((sum, t) => sum + t.amount, 0);

        return `
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Ref No</th>
              <th>Description</th>
              <th class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${this.transactions.map(t => `
              <tr>
                <td>${new Date(t.date).toLocaleDateString('id-ID')}</td>
                <td><span class="badge badge-primary">${t.refNo}</span></td>
                <td>${t.description}</td>
                <td class="text-right">${this.formatCurrency(t.amount)}</td>
              </tr>
            `).join('')}
            <tr style="background: var(--bg-tertiary); font-weight: bold;">
              <td colspan="3" class="text-right">TOTAL PURCHASES:</td>
              <td class="text-right">${this.formatCurrency(total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
    }
};
