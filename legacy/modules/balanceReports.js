// ==========================================
// Inventory Valuation Report
// Total stock value for Balance Sheet accuracy
// ==========================================

const InventoryValuationReport = {
  items: [],
  warehouses: [],
  valuationData: [],
  asOfDate: new Date().toISOString().split('T')[0],

  init() {
    if (!Auth.isAuthenticated()) {
      window.location.href = 'login.html';
      return;
    }

    this.loadData();
    this.calculateValuation();
    this.render();
  },

  loadData() {
    this.items = Storage.getItems();
    this.warehouses = Storage.getWarehouses();
  },

  calculateValuation() {
    const journals = Storage.get(Storage.KEYS.JOURNAL_ENTRIES) || [];
    const inventoryAccounts = {
      '1151': 'Raw Materials - Gold',
      '1152': 'Lab Testing',
      '1153': 'Raw Materials - Silver',
      '1154': 'Chemicals',
      '1155': 'Consumables',
      '1156': 'Work in Progress',
      '1181': 'Finished Goods - Gold Bar',
      '1182': 'Finished Goods - Grain',
      '1183': 'Finished Goods - Sheet',
      '1184': 'Finished Goods - Wire',
      '1185': 'By-products'
    };

    const accountBalances = {};

    // Calculate balance for each inventory account
    journals.forEach(journal => {
      const journalDate = new Date(journal.date);
      const asOf = new Date(this.asOfDate);

      if (journalDate <= asOf) {
        journal.lines.forEach(line => {
          if (inventoryAccounts[line.accountCode]) {
            if (!accountBalances[line.accountCode]) {
              accountBalances[line.accountCode] = {
                accountCode: line.accountCode,
                accountName: inventoryAccounts[line.accountCode],
                balance: 0
              };
            }
            accountBalances[line.accountCode].balance += (line.debit || 0) - (line.credit || 0);
          }
        });
      }
    });

    this.valuationData = Object.values(accountBalances)
      .filter(a => a.balance > 0)
      .sort((a, b) => a.accountCode.localeCompare(b.accountCode));
  },

  render() {
    const content = document.getElementById('main-content');
    content.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">💎 Inventory Valuation</h1>
        <p class="page-description">Total stock value as of ${new Date(this.asOfDate).toLocaleDateString('id-ID')}</p>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Inventory by Category</h2>
          <div class="btn-group">
            <button class="btn btn-secondary" onclick="InventoryValuationReport.exportToCSV()">
              📊 Export CSV
            </button>
          </div>
        </div>
        <div class="card-body">
          ${this.renderValuationTable()}
        </div>
      </div>
    `;
  },

  renderValuationTable() {
    if (this.valuationData.length === 0) {
      return '<p class="text-center text-gray">No inventory value</p>';
    }

    const totalValue = this.valuationData.reduce((sum, a) => sum + a.balance, 0);

    // Group by category
    const categories = {
      'Raw Materials': this.valuationData.filter(a => a.accountCode.startsWith('115')),
      'Work in Progress': this.valuationData.filter(a => a.accountCode === '1156'),
      'Finished Goods': this.valuationData.filter(a => a.accountCode.startsWith('118'))
    };

    return `
      ${Object.entries(categories).map(([category, items]) => {
      if (items.length === 0) return '';
      const categoryTotal = items.reduce((sum, i) => sum + i.balance, 0);

      return `
          <h3 style="margin: 24px 0 12px 0; padding-bottom: 8px; border-bottom: 2px solid #e0e0e0;">
            ${category} (${this.formatCurrency(categoryTotal)})
          </h3>
          <div class="table-container">
            <table class="table">
              <thead>
                <tr>
                  <th>Account Code</th>
                  <th>Account Name</th>
                  <th class="text-right">Value</th>
                  <th class="text-right">% of Total</th>
                </tr>
              </thead>
              <tbody>
                ${items.map(item => `
                  <tr>
                    <td><span class="badge badge-primary">${item.accountCode}</span></td>
                    <td>${item.accountName}</td>
                    <td class="text-right"><strong>${this.formatCurrency(item.balance)}</strong></td>
                    <td class="text-right">${((item.balance / totalValue) * 100).toFixed(1)}%</td>
                  </tr>
                `).join('')}
                <tr style="background: var(--bg-tertiary); font-weight: bold;">
                  <td colspan="2" class="text-right">Subtotal ${category}:</td>
                  <td class="text-right">${this.formatCurrency(categoryTotal)}</td>
                  <td class="text-right">${((categoryTotal / totalValue) * 100).toFixed(1)}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        `;
    }).join('')}

      <div style="margin-top: 24px; padding: 16px; background: var(--bg-tertiary); border-radius: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h2 style="margin: 0;">TOTAL INVENTORY VALUE:</h2>
          <h2 style="margin: 0; color: #1976d2;">${this.formatCurrency(totalValue)}</h2>
        </div>
        <p style="margin: 8px 0 0 0; font-size: 13px; color: #666;">
          This value should match the total inventory in Balance Sheet
        </p>
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
    const headers = ['Account Code', 'Account Name', 'Value'];
    const rows = this.valuationData.map(a => [
      a.accountCode,
      a.accountName,
      a.balance
    ]);

    let csv = `Inventory Valuation as of ${this.asOfDate}\n\n`;
    csv += headers.join(',') + '\n';
    rows.forEach(row => {
      csv += row.map(cell => `"${cell}"`).join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-valuation-${this.asOfDate}.csv`;
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
};

// ==========================================
// Customer & Supplier Balance Reports
// Current balances for AR/AP management
// ==========================================

const CustomerBalance = {
  customers: [],
  balances: [],

  init() {
    if (!Auth.isAuthenticated()) {
      window.location.href = 'login.html';
      return;
    }

    this.loadData();
    this.calculateBalances();
    this.render();
  },

  loadData() {
    this.customers = Storage.getCustomers();
  },

  calculateBalances() {
    const journals = Storage.get(Storage.KEYS.JOURNAL_ENTRIES) || [];
    const customerBalances = {};

    // Get all AR transactions (account 1150)
    journals.forEach(journal => {
      journal.lines.forEach(line => {
        if (line.accountCode === '1150') { // Piutang Usaha
          // Extract customer from description
          const customer = line.description.split('-')[0]?.trim() || 'Unknown';

          if (!customerBalances[customer]) {
            customerBalances[customer] = {
              customerName: customer,
              balance: 0,
              lastTransaction: journal.date
            };
          }

          customerBalances[customer].balance += (line.debit || 0) - (line.credit || 0);

          if (new Date(journal.date) > new Date(customerBalances[customer].lastTransaction)) {
            customerBalances[customer].lastTransaction = journal.date;
          }
        }
      });
    });

    this.balances = Object.values(customerBalances)
      .filter(c => Math.abs(c.balance) > 0)
      .sort((a, b) => b.balance - a.balance);
  },

  render() {
    const content = document.getElementById('main-content');
    content.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">👥 Customer Balance</h1>
        <p class="page-description">Current receivables balance per customer</p>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Customer Balances (${this.balances.length})</h2>
          <div class="btn-group">
            <button class="btn btn-secondary" onclick="CustomerBalance.exportToCSV()">
              📊 Export CSV
            </button>
          </div>
        </div>
        <div class="card-body">
          ${this.renderBalanceTable()}
        </div>
      </div>
    `;
  },

  renderBalanceTable() {
    if (this.balances.length === 0) {
      return '<p class="text-center text-gray">No customer balances</p>';
    }

    const totalBalance = this.balances.reduce((sum, c) => sum + c.balance, 0);

    return `
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Customer Name</th>
              <th class="text-right">Balance</th>
              <th>Last Transaction</th>
            </tr>
          </thead>
          <tbody>
            ${this.balances.map(c => `
              <tr>
                <td><strong>${c.customerName}</strong></td>
                <td class="text-right">
                  <span style="color: ${c.balance > 0 ? '#d32f2f' : '#388e3c'}">
                    ${this.formatCurrency(c.balance)}
                  </span>
                </td>
                <td>${new Date(c.lastTransaction).toLocaleDateString('id-ID')}</td>
              </tr>
            `).join('')}
            <tr style="background: var(--bg-tertiary); font-weight: bold;">
              <td>TOTAL RECEIVABLES:</td>
              <td class="text-right">${this.formatCurrency(totalBalance)}</td>
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
    const headers = ['Customer Name', 'Balance', 'Last Transaction'];
    const rows = this.balances.map(c => [
      c.customerName,
      c.balance,
      new Date(c.lastTransaction).toLocaleDateString('id-ID')
    ]);

    let csv = `Customer Balance Report\n\n`;
    csv += headers.join(',') + '\n';
    rows.forEach(row => {
      csv += row.map(cell => `"${cell}"`).join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customer-balance-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
};

// Supplier Balance (similar to Customer Balance but for AP)
const SupplierBalance = {
  ...CustomerBalance,

  init() {
    if (!Auth.isAuthenticated()) {
      window.location.href = 'login.html';
      return;
    }

    this.loadData();
    this.calculateBalances();
    this.render();
  },

  loadData() {
    this.suppliers = Storage.getSuppliers();
  },

  calculateBalances() {
    const journals = Storage.get(Storage.KEYS.JOURNAL_ENTRIES) || [];
    const supplierBalances = {};

    // Get all AP transactions (account 2110)
    journals.forEach(journal => {
      journal.lines.forEach(line => {
        if (line.accountCode === '2110') { // Hutang Usaha
          const supplier = line.description.split('-')[0]?.trim() || 'Unknown';

          if (!supplierBalances[supplier]) {
            supplierBalances[supplier] = {
              supplierName: supplier,
              balance: 0,
              lastTransaction: journal.date
            };
          }

          // For payables, credit increases balance
          supplierBalances[supplier].balance += (line.credit || 0) - (line.debit || 0);

          if (new Date(journal.date) > new Date(supplierBalances[supplier].lastTransaction)) {
            supplierBalances[supplier].lastTransaction = journal.date;
          }
        }
      });
    });

    this.balances = Object.values(supplierBalances)
      .filter(s => Math.abs(s.balance) > 0)
      .sort((a, b) => b.balance - a.balance);
  },

  render() {
    const content = document.getElementById('main-content');
    content.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">🏢 Supplier Balance</h1>
        <p class="page-description">Current payables balance per supplier</p>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Supplier Balances (${this.balances.length})</h2>
          <div class="btn-group">
            <button class="btn btn-secondary" onclick="SupplierBalance.exportToCSV()">
              📊 Export CSV
            </button>
          </div>
        </div>
        <div class="card-body">
          ${this.renderBalanceTable()}
        </div>
      </div>
    `;
  },

  renderBalanceTable() {
    if (this.balances.length === 0) {
      return '<p class="text-center text-gray">No supplier balances</p>';
    }

    const totalBalance = this.balances.reduce((sum, s) => sum + s.balance, 0);

    return `
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Supplier Name</th>
              <th class="text-right">Balance</th>
              <th>Last Transaction</th>
            </tr>
          </thead>
          <tbody>
            ${this.balances.map(s => `
              <tr>
                <td><strong>${s.supplierName}</strong></td>
                <td class="text-right">
                  <span style="color: ${s.balance > 0 ? '#d32f2f' : '#388e3c'}">
                    ${this.formatCurrency(s.balance)}
                  </span>
                </td>
                <td>${new Date(s.lastTransaction).toLocaleDateString('id-ID')}</td>
              </tr>
            `).join('')}
            <tr style="background: var(--bg-tertiary); font-weight: bold;">
              <td>TOTAL PAYABLES:</td>
              <td class="text-right">${this.formatCurrency(totalBalance)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }
};
