// ==========================================
// Production WIP Report - Gold-Specific
// Track work in progress by production stage
// ==========================================

const ProductionWIP = {
    wipData: [],
    totalWIP: 0,

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

        // WIP accounts from COA
        const wipAccounts = {
            '1156': 'Work in Progress - General',
            '1161': 'WIP - Melting Stage',
            '1162': 'WIP - Assay & Testing',
            '1163': 'WIP - Refining/Electrolysis',
            '1164': 'WIP - Casting Stage',
            '1165': 'WIP - Quality Control'
        };

        const wipBalances = {};

        journals.forEach(journal => {
            journal.lines.forEach(line => {
                if (wipAccounts[line.accountCode]) {
                    if (!wipBalances[line.accountCode]) {
                        wipBalances[line.accountCode] = {
                            accountCode: line.accountCode,
                            stage: wipAccounts[line.accountCode],
                            balance: 0,
                            lastUpdate: journal.date
                        };
                    }
                    wipBalances[line.accountCode].balance += (line.debit || 0) - (line.credit || 0);

                    if (new Date(journal.date) > new Date(wipBalances[line.accountCode].lastUpdate)) {
                        wipBalances[line.accountCode].lastUpdate = journal.date;
                    }
                }
            });
        });

        this.wipData = Object.values(wipBalances)
            .filter(w => w.balance > 0)
            .sort((a, b) => a.accountCode.localeCompare(b.accountCode));

        this.totalWIP = this.wipData.reduce((sum, w) => sum + w.balance, 0);
    },

    render() {
        const content = document.getElementById('main-content');
        content.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">⚙️ Production WIP Report</h1>
        <p class="page-description">Work in Progress tracking by production stage</p>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">WIP by Production Stage</h2>
          <div class="btn-group">
            <button class="btn btn-secondary" onclick="ProductionWIP.exportToCSV()">
              📊 Export CSV
            </button>
          </div>
        </div>
        <div class="card-body">
          ${this.renderWIPTable()}
        </div>
      </div>
    `;
    },

    renderWIPTable() {
        if (this.wipData.length === 0) {
            return '<p class="text-center text-gray">✅ No work in progress - All batches completed!</p>';
        }

        return `
      <div style="margin-bottom: 24px; padding: 16px; background: var(--bg-tertiary); border-radius: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h3 style="margin: 0; color: #1976d2;">Total WIP Value</h3>
            <p style="margin: 4px 0 0 0; font-size: 13px; color: #666;">
              ${this.wipData.length} active production stage(s)
            </p>
          </div>
          <h2 style="margin: 0; color: #1976d2;">${this.formatCurrency(this.totalWIP)}</h2>
        </div>
      </div>

      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Stage</th>
              <th>Account Code</th>
              <th class="text-right">Value</th>
              <th class="text-right">% of WIP</th>
              <th>Last Updated</th>
            </tr>
          </thead>
          <tbody>
            ${this.wipData.map(w => `
              <tr>
                <td><strong>${w.stage}</strong></td>
                <td><span class="badge badge-primary">${w.accountCode}</span></td>
                <td class="text-right">${this.formatCurrency(w.balance)}</td>
                <td class="text-right">${((w.balance / this.totalWIP) * 100).toFixed(1)}%</td>
                <td>${new Date(w.lastUpdate).toLocaleDateString('id-ID')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div style="margin-top: 16px; padding: 12px; background: hsl(45, 100%, 20%); border-radius: 8px;">
        <strong>💡 Production Flow:</strong> Raw Materials → Melting → Assay → Refining → Casting → QC → Finished Goods
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
        const headers = ['Stage', 'Account Code', 'Value', '% of WIP', 'Last Updated'];
        const rows = this.wipData.map(w => [
            w.stage,
            w.accountCode,
            w.balance,
            ((w.balance / this.totalWIP) * 100).toFixed(1),
            new Date(w.lastUpdate).toLocaleDateString('id-ID')
        ]);

        let csv = `Production WIP Report\n\n`;
        csv += headers.join(',') + '\n';
        rows.forEach(row => {
            csv += row.map(cell => `"${cell}"`).join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `production-wip-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }
};

// ==========================================
// Sales Analysis - By Customer & By Item
// ==========================================

const SalesByCustomer = {
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
        const customerSales = {};

        journals.forEach(journal => {
            const journalDate = new Date(journal.date);
            if (journalDate >= new Date(this.startDate) && journalDate <= new Date(this.endDate)) {
                const hasRevenue = journal.lines.some(l => l.accountCode.startsWith('4'));

                if (hasRevenue) {
                    const customer = journal.description.split('-')[0]?.trim() || 'Walk-in Customer';
                    const amount = journal.lines
                        .filter(l => l.accountCode.startsWith('4'))
                        .reduce((sum, l) => sum + (l.credit || 0), 0);

                    if (!customerSales[customer]) {
                        customerSales[customer] = {
                            customer: customer,
                            totalSales: 0,
                            transactionCount: 0
                        };
                    }

                    customerSales[customer].totalSales += amount;
                    customerSales[customer].transactionCount++;
                }
            }
        });

        this.salesData = Object.values(customerSales)
            .sort((a, b) => b.totalSales - a.totalSales);
    },

    render() {
        const content = document.getElementById('main-content');
        const total = this.salesData.reduce((sum, s) => sum + s.totalSales, 0);

        content.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">👥 Sales by Customer</h1>
        <p class="page-description">Customer ranking by sales value</p>
      </div>

      <div class="card mb-3">
        <div class="card-body">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Start Date</label>
              <input type="date" class="form-input" value="${this.startDate}" 
                     onchange="SalesByCustomer.startDate = this.value; SalesByCustomer.init();">
            </div>
            <div class="form-group">
              <label class="form-label">End Date</label>
              <input type="date" class="form-input" value="${this.endDate}"
                     onchange="SalesByCustomer.endDate = this.value; SalesByCustomer.init();">
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Top Customers (${this.salesData.length})</h2>
          <div class="btn-group">
            <button class="btn btn-secondary" onclick="SalesByCustomer.exportToCSV()">
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
              <th>Customer</th>
              <th class="text-right">Total Sales</th>
              <th class="text-right">% of Total</th>
              <th class="text-center">Transactions</th>
              <th class="text-right">Avg per Transaction</th>
            </tr>
          </thead>
          <tbody>
            ${this.salesData.map((s, idx) => `
              <tr>
                <td><span class="badge ${idx < 3 ? 'badge-success' : 'badge-secondary'}">#${idx + 1}</span></td>
                <td><strong>${s.customer}</strong></td>
                <td class="text-right">${this.formatCurrency(s.totalSales)}</td>
                <td class="text-right">${((s.totalSales / total) * 100).toFixed(1)}%</td>
                <td class="text-center">${s.transactionCount}</td>
                <td class="text-right">${this.formatCurrency(s.totalSales / s.transactionCount)}</td>
              </tr>
            `).join('')}
            <tr style="background: var(--bg-tertiary); font-weight: bold;">
              <td colspan="2">TOTAL</td>
              <td class="text-right">${this.formatCurrency(total)}</td>
              <td class="text-right">100%</td>
              <td class="text-center">${this.salesData.reduce((sum, s) => sum + s.transactionCount, 0)}</td>
              <td></td>
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
        const headers = ['Rank', 'Customer', 'Total Sales', '% of Total', 'Transactions', 'Avg per Transaction'];
        const total = this.salesData.reduce((sum, s) => sum + s.totalSales, 0);
        const rows = this.salesData.map((s, idx) => [
            idx + 1,
            s.customer,
            s.totalSales,
            ((s.totalSales / total) * 100).toFixed(1),
            s.transactionCount,
            s.totalSales / s.transactionCount
        ]);

        let csv = `Sales by Customer (${this.startDate} to ${this.endDate})\n\n`;
        csv += headers.join(',') + '\n';
        rows.forEach(row => {
            csv += row.map(cell => `"${cell}"`).join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sales-by-customer-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }
};

// Purchase by Supplier (similar structure)
const PurchaseBySupplier = {
    ...SalesByCustomer,

    loadData() {
        const journals = Storage.get(Storage.KEYS.JOURNAL_ENTRIES) || [];
        const supplierPurchases = {};

        journals.forEach(journal => {
            const journalDate = new Date(journal.date);
            if (journalDate >= new Date(this.startDate) && journalDate <= new Date(this.endDate)) {
                const hasExpense = journal.lines.some(l => l.accountCode.startsWith('5'));

                if (hasExpense) {
                    const supplier = journal.description.split('-')[0]?.trim() || 'Unknown Supplier';
                    const amount = journal.lines
                        .filter(l => l.accountCode.startsWith('5'))
                        .reduce((sum, l) => sum + (l.debit || 0), 0);

                    if (!supplierPurchases[supplier]) {
                        supplierPurchases[supplier] = {
                            supplier: supplier,
                            totalPurchases: 0,
                            transactionCount: 0
                        };
                    }

                    supplierPurchases[supplier].totalPurchases += amount;
                    supplierPurchases[supplier].transactionCount++;
                }
            }
        });

        this.salesData = Object.values(supplierPurchases)
            .sort((a, b) => b.totalPurchases - a.totalPurchases);
    },

    render() {
        const content = document.getElementById('main-content');
        const total = this.salesData.reduce((sum, s) => sum + s.totalPurchases, 0);

        content.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">🏢 Purchase by Supplier</h1>
        <p class="page-description">Supplier ranking by purchase value</p>
      </div>

      <div class="card mb-3">
        <div class="card-body">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Start Date</label>
              <input type="date" class="form-input" value="${this.startDate}" 
                     onchange="PurchaseBySupplier.startDate = this.value; PurchaseBySupplier.init();">
            </div>
            <div class="form-group">
              <label class="form-label">End Date</label>
              <input type="date" class="form-input" value="${this.endDate}"
                     onchange="PurchaseBySupplier.endDate = this.value; PurchaseBySupplier.init();">
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Top Suppliers (${this.salesData.length})</h2>
          <div class="btn-group">
            <button class="btn btn-secondary" onclick="PurchaseBySupplier.exportToCSV()">
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
              <th>Supplier</th>
              <th class="text-right">Total Purchases</th>
              <th class="text-right">% of Total</th>
              <th class="text-center">Transactions</th>
              <th class="text-right">Avg per Transaction</th>
            </tr>
          </thead>
          <tbody>
            ${this.salesData.map((s, idx) => `
              <tr>
                <td><span class="badge ${idx < 3 ? 'badge-success' : 'badge-secondary'}">#${idx + 1}</span></td>
                <td><strong>${s.supplier}</strong></td>
                <td class="text-right">${this.formatCurrency(s.totalPurchases)}</td>
                <td class="text-right">${((s.totalPurchases / total) * 100).toFixed(1)}%</td>
                <td class="text-center">${s.transactionCount}</td>
                <td class="text-right">${this.formatCurrency(s.totalPurchases / s.transactionCount)}</td>
              </tr>
            `).join('')}
            <tr style="background: var(--bg-tertiary); font-weight: bold;">
              <td colspan="2">TOTAL</td>
              <td class="text-right">${this.formatCurrency(total)}</td>
              <td class="text-right">100%</td>
              <td class="text-center">${this.salesData.reduce((sum, s) => sum + s.transactionCount, 0)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
    }
};
