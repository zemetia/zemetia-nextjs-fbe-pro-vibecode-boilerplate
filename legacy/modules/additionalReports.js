// ==========================================
// Item Analysis Reports
// Sales by Item & Purchase by Item
// ==========================================

const SalesByItem = {
    salesData: [],
    startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
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
        const journals = Storage.get(Storage.KEYS.JOURNAL_ENTRIES) || [];
        const items = Storage.getItems();
        const itemSales = {};

        journals.forEach(journal => {
            const journalDate = new Date(journal.date);
            if (journalDate >= new Date(this.startDate) && journalDate <= new Date(this.endDate)) {
                const hasRevenue = journal.lines.some(l => l.accountCode.startsWith('4'));

                if (hasRevenue) {
                    // Extract item from description (simplified)
                    const itemCode = journal.description.match(/ITEM-\w+/)?.[0] || 'UNKNOWN';
                    const amount = journal.lines
                        .filter(l => l.accountCode.startsWith('4'))
                        .reduce((sum, l) => sum + (l.credit || 0), 0);

                    if (!itemSales[itemCode]) {
                        itemSales[itemCode] = {
                            itemCode: itemCode,
                            itemName: journal.description.split('-')[1]?.trim() || itemCode,
                            totalSales: 0,
                            quantity: 0,
                            transactionCount: 0
                        };
                    }

                    itemSales[itemCode].totalSales += amount;
                    itemSales[itemCode].transactionCount++;
                    itemSales[itemCode].quantity += 1; // Simplified qty
                }
            }
        });

        this.salesData = Object.values(itemSales)
            .sort((a, b) => b.totalSales - a.totalSales);
    },

    render() {
        const content = document.getElementById('main-content');
        const total = this.salesData.reduce((sum, s) => sum + s.totalSales, 0);

        content.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">📦 Sales by Item</h1>
        <p class="page-description">Best selling items analysis</p>
      </div>

      <div class="card mb-3">
        <div class="card-body">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Start Date</label>
              <input type="date" class="form-input" value="${this.startDate}" 
                     onchange="SalesByItem.startDate = this.value; SalesByItem.init();">
            </div>
            <div class="form-group">
              <label class="form-label">End Date</label>
              <input type="date" class="form-input" value="${this.endDate}"
                     onchange="SalesByItem.endDate = this.value; SalesByItem.init();">
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Item Performance (${this.salesData.length})</h2>
          <div class="btn-group">
            <button class="btn btn-secondary" onclick="SalesByItem.exportToCSV()">
              📊 Export CSV
            </button>
          </div>
        </div>
        <div class="card-body">
          ${this.renderTable(total)}
        </div>
      </div>
    `;
    },

    renderTable(total) {
        if (this.salesData.length === 0) {
            return '<p class="text-center text-gray">No sales in selected period</p>';
        }

        return `
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Item</th>
              <th class="text-right">Total Sales</th>
              <th class="text-right">% of Total</th>
              <th class="text-center">Qty Sold</th>
              <th class="text-center">Transactions</th>
              <th class="text-right">Avg Price</th>
            </tr>
          </thead>
          <tbody>
            ${this.salesData.map((s, idx) => `
              <tr>
                <td>
                  <span class="badge ${idx < 3 ? 'badge-success' : idx < 10 ? 'badge-primary' : 'badge-secondary'}">
                    #${idx + 1}
                  </span>
                </td>
                <td><strong>${s.itemName}</strong></td>
                <td class="text-right">${this.formatCurrency(s.totalSales)}</td>
                <td class="text-right">${((s.totalSales / total) * 100).toFixed(1)}%</td>
                <td class="text-center">${s.quantity}</td>
                <td class="text-center">${s.transactionCount}</td>
                <td class="text-right">${this.formatCurrency(s.totalSales / s.quantity)}</td>
              </tr>
            `).join('')}
            <tr style="background: var(--bg-tertiary); font-weight: bold;">
              <td colspan="2">TOTAL</td>
              <td class="text-right">${this.formatCurrency(total)}</td>
              <td class="text-right">100%</td>
              <td class="text-center">${this.salesData.reduce((sum, s) => sum + s.quantity, 0)}</td>
              <td class="text-center">${this.salesData.reduce((sum, s) => sum + s.transactionCount, 0)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style="margin-top: 16px; padding: 12px; background: var(--bg-tertiary); border-radius: 8px;">
        <strong>💡 Insight:</strong> Top 3 items contribute ${((this.salesData.slice(0, 3).reduce((sum, s) => sum + s.totalSales, 0) / total) * 100).toFixed(1)}% of total sales
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
        const headers = ['Rank', 'Item', 'Total Sales', '% of Total', 'Qty Sold', 'Transactions', 'Avg Price'];
        const total = this.salesData.reduce((sum, s) => sum + s.totalSales, 0);
        const rows = this.salesData.map((s, idx) => [
            idx + 1,
            s.itemName,
            s.totalSales,
            ((s.totalSales / total) * 100).toFixed(1),
            s.quantity,
            s.transactionCount,
            s.totalSales / s.quantity
        ]);

        let csv = `Sales by Item (${this.startDate} to ${this.endDate})\n\n`;
        csv += headers.join(',') + '\n';
        rows.forEach(row => {
            csv += row.map(cell => `"${cell}"`).join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sales-by-item-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }
};

// Purchase by Item (similar structure)
const PurchaseByItem = {
    ...SalesByItem,

    loadData() {
        const journals = Storage.get(Storage.KEYS.JOURNAL_ENTRIES) || [];
        const itemPurchases = {};

        journals.forEach(journal => {
            const journalDate = new Date(journal.date);
            if (journalDate >= new Date(this.startDate) && journalDate <= new Date(this.endDate)) {
                const hasExpense = journal.lines.some(l => l.accountCode.startsWith('5'));

                if (hasExpense) {
                    const itemCode = journal.description.match(/ITEM-\w+/)?.[0] || 'UNKNOWN';
                    const amount = journal.lines
                        .filter(l => l.accountCode.startsWith('5'))
                        .reduce((sum, l) => sum + (l.debit || 0), 0);

                    if (!itemPurchases[itemCode]) {
                        itemPurchases[itemCode] = {
                            itemCode: itemCode,
                            itemName: journal.description.split('-')[1]?.trim() || itemCode,
                            totalSales: 0, // Reusing same structure
                            quantity: 0,
                            transactionCount: 0
                        };
                    }

                    itemPurchases[itemCode].totalSales += amount;
                    itemPurchases[itemCode].transactionCount++;
                    itemPurchases[itemCode].quantity += 1;
                }
            }
        });

        this.salesData = Object.values(itemPurchases)
            .sort((a, b) => b.totalSales - a.totalSales);
    },

    render() {
        const content = document.getElementById('main-content');
        const total = this.salesData.reduce((sum, s) => sum + s.totalSales, 0);

        content.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">🛒 Purchase by Item</h1>
        <p class="page-description">Most purchased items analysis</p>
      </div>

      <div class="card mb-3">
        <div class="card-body">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Start Date</label>
              <input type="date" class="form-input" value="${this.startDate}" 
                     onchange="PurchaseByItem.startDate = this.value; PurchaseByItem.init();">
            </div>
            <div class="form-group">
              <label class="form-label">End Date</label>
              <input type="date" class="form-input" value="${this.endDate}"
                     onchange="PurchaseByItem.endDate = this.value; PurchaseByItem.init();">
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Purchase Performance (${this.salesData.length})</h2>
          <div class="btn-group">
            <button class="btn btn-secondary" onclick="PurchaseByItem.exportToCSV()">
              📊 Export CSV
            </button>
          </div>
        </div>
        <div class="card-body">
          ${this.renderPurchaseTable(total)}
        </div>
      </div>
    `;
    },

    renderPurchaseTable(total) {
        if (this.salesData.length === 0) {
            return '<p class="text-center text-gray">No purchases in selected period</p>';
        }

        return `
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Item</th>
              <th class="text-right">Total Purchases</th>
              <th class="text-right">% of Total</th>
              <th class="text-center">Qty Purchased</th>
              <th class="text-center">Transactions</th>
              <th class="text-right">Avg Cost</th>
            </tr>
          </thead>
          <tbody>
            ${this.salesData.map((s, idx) => `
              <tr>
                <td>
                  <span class="badge ${idx < 3 ? 'badge-success' : idx < 10 ? 'badge-primary' : 'badge-secondary'}">
                    #${idx + 1}
                  </span>
                </td>
                <td><strong>${s.itemName}</strong></td>
                <td class="text-right">${this.formatCurrency(s.totalSales)}</td>
                <td class="text-right">${((s.totalSales / total) * 100).toFixed(1)}%</td>
                <td class="text-center">${s.quantity}</td>
                <td class="text-center">${s.transactionCount}</td>
                <td class="text-right">${this.formatCurrency(s.totalSales / s.quantity)}</td>
              </tr>
            `).join('')}
            <tr style="background: var(--bg-tertiary); font-weight: bold;">
              <td colspan="2">TOTAL</td>
              <td class="text-right">${this.formatCurrency(total)}</td>
              <td class="text-right">100%</td>
              <td class="text-center">${this.salesData.reduce((sum, s) => sum + s.quantity, 0)}</td>
              <td class="text-center">${this.salesData.reduce((sum, s) => sum + s.transactionCount, 0)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
    }
};

// ==========================================
// Cash & Bank Books
// ==========================================

const CashBook = {
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
        const journals = Storage.get(Storage.KEYS.JOURNAL_ENTRIES) || [];
        this.transactions = [];

        journals.forEach(journal => {
            const journalDate = new Date(journal.date);
            if (journalDate >= new Date(this.startDate) && journalDate <= new Date(this.endDate)) {
                journal.lines.forEach(line => {
                    if (line.accountCode === '1110') { // Kas
                        this.transactions.push({
                            date: journal.date,
                            refNo: journal.referenceNumber,
                            description: line.description || journal.description,
                            debit: line.debit || 0,
                            credit: line.credit || 0
                        });
                    }
                });
            }
        });

        this.transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
    },

    render() {
        const content = document.getElementById('main-content');
        content.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">💵 Cash Book</h1>
        <p class="page-description">Daily cash movements (IN/OUT)</p>
      </div>

      <div class="card mb-3">
        <div class="card-body">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Start Date</label>
              <input type="date" class="form-input" value="${this.startDate}" 
                     onchange="CashBook.startDate = this.value; CashBook.init();">
            </div>
            <div class="form-group">
              <label class="form-label">End Date</label>
              <input type="date" class="form-input" value="${this.endDate}"
                     onchange="CashBook.endDate = this.value; CashBook.init();">
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Cash Transactions (${this.transactions.length})</h2>
          <div class="btn-group">
            <button class="btn btn-secondary" onclick="CashBook.exportToCSV()">
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
            return '<p class="text-center text-gray">No cash transactions in period</p>';
        }

        let runningBalance = 0;
        const totalIn = this.transactions.reduce((sum, t) => sum + t.debit, 0);
        const totalOut = this.transactions.reduce((sum, t) => sum + t.credit, 0);

        return `
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Ref No</th>
              <th>Description</th>
              <th class="text-right">Cash IN</th>
              <th class="text-right">Cash OUT</th>
              <th class="text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            ${this.transactions.map(t => {
            runningBalance += t.debit - t.credit;
            return `
                  <tr>
                    <td>${new Date(t.date).toLocaleDateString('id-ID')}</td>
                    <td><span class="badge badge-primary">${t.refNo}</span></td>
                    <td>${t.description}</td>
                    <td class="text-right" style="color: #388e3c;">${t.debit > 0 ? this.formatCurrency(t.debit) : '-'}</td>
                    <td class="text-right" style="color: #d32f2f;">${t.credit > 0 ? this.formatCurrency(t.credit) : '-'}</td>
                    <td class="text-right"><strong>${this.formatCurrency(runningBalance)}</strong></td>
                  </tr>
                `;
        }).join('')}
            <tr style="background: var(--bg-tertiary); font-weight: bold;">
              <td colspan="3">TOTAL</td>
              <td class="text-right" style="color: #388e3c;">${this.formatCurrency(totalIn)}</td>
              <td class="text-right" style="color: #d32f2f;">${this.formatCurrency(totalOut)}</td>
              <td class="text-right">${this.formatCurrency(runningBalance)}</td>
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
        const headers = ['Date', 'Ref No', 'Description', 'Cash IN', 'Cash OUT', 'Balance'];
        let runningBalance = 0;
        const rows = this.transactions.map(t => {
            runningBalance += t.debit - t.credit;
            return [
                new Date(t.date).toLocaleDateString('id-ID'),
                t.refNo,
                t.description,
                t.debit,
                t.credit,
                runningBalance
            ];
        });

        let csv = `Cash Book (${this.startDate} to ${this.endDate})\n\n`;
        csv += headers.join(',') + '\n';
        rows.forEach(row => {
            csv += row.map(cell => `"${cell}"`).join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cash-book-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }
};

// Bank Book (similar to Cash Book but for bank accounts 112x)
const BankBook = {
    ...CashBook,

    loadData() {
        const journals = Storage.get(Storage.KEYS.JOURNAL_ENTRIES) || [];
        this.transactions = [];

        journals.forEach(journal => {
            const journalDate = new Date(journal.date);
            if (journalDate >= new Date(this.startDate) && journalDate <= new Date(this.endDate)) {
                journal.lines.forEach(line => {
                    if (line.accountCode.startsWith('112')) { // Bank accounts
                        this.transactions.push({
                            date: journal.date,
                            refNo: journal.referenceNumber,
                            description: line.description || journal.description,
                            debit: line.debit || 0,
                            credit: line.credit || 0
                        });
                    }
                });
            }
        });

        this.transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
    },

    render() {
        const content = document.getElementById('main-content');
        content.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">🏦 Bank Book</h1>
        <p class="page-description">Bank account movements</p>
      </div>

      <div class="card mb-3">
        <div class="card-body">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Start Date</label>
              <input type="date" class="form-input" value="${this.startDate}" 
                     onchange="BankBook.startDate = this.value; BankBook.init();">
            </div>
            <div class="form-group">
              <label class="form-label">End Date</label>
              <input type="date" class="form-input" value="${this.endDate}"
                     onchange="BankBook.endDate = this.value; BankBook.init();">
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Bank Transactions (${this.transactions.length})</h2>
          <div class="btn-group">
            <button class="btn btn-secondary" onclick="BankBook.exportToCSV()">
              📊 Export CSV
            </button>
          </div>
        </div>
        <div class="card-body">
          ${this.renderBankTable()}
        </div>
      </div>
    `;
    },

    renderBankTable() {
        if (this.transactions.length === 0) {
            return '<p class="text-center text-gray">No bank transactions in period</p>';
        }

        let runningBalance = 0;
        const totalIn = this.transactions.reduce((sum, t) => sum + t.debit, 0);
        const totalOut = this.transactions.reduce((sum, t) => sum + t.credit, 0);

        return `
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Ref No</th>
              <th>Description</th>
              <th class="text-right">Debit</th>
              <th class="text-right">Credit</th>
              <th class="text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            ${this.transactions.map(t => {
            runningBalance += t.debit - t.credit;
            return `
                  <tr>
                    <td>${new Date(t.date).toLocaleDateString('id-ID')}</td>
                    <td><span class="badge badge-primary">${t.refNo}</span></td>
                    <td>${t.description}</td>
                    <td class="text-right" style="color: #388e3c;">${t.debit > 0 ? this.formatCurrency(t.debit) : '-'}</td>
                    <td class="text-right" style="color: #d32f2f;">${t.credit > 0 ? this.formatCurrency(t.credit) : '-'}</td>
                    <td class="text-right"><strong>${this.formatCurrency(runningBalance)}</strong></td>
                  </tr>
                `;
        }).join('')}
            <tr style="background: var(--bg-tertiary); font-weight: bold;">
              <td colspan="3">TOTAL</td>
              <td class="text-right" style="color: #388e3c;">${this.formatCurrency(totalIn)}</td>
              <td class="text-right" style="color: #d32f2f;">${this.formatCurrency(totalOut)}</td>
              <td class="text-right">${this.formatCurrency(runningBalance)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
    }
};
