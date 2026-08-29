// ==========================================
// Inventory Optimization Reports
// Slow Moving Items & Stock In/Out Detail
// ==========================================

const SlowMovingItems = {
    slowItems: [],
    daysThreshold: 30, // Items with no movement in last 30 days

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
        const today = new Date();
        const thresholdDate = new Date(today.setDate(today.getDate() - this.daysThreshold));

        const inventoryAccounts = ['1151', '1152', '1153', '1154', '1155', '1156', '1181', '1182', '1183', '1184', '1185'];
        const itemActivity = {};

        // Track last movement date per item
        journals.forEach(journal => {
            journal.lines.forEach(line => {
                if (inventoryAccounts.includes(line.accountCode)) {
                    const itemCode = line.description;
                    const journalDate = new Date(journal.date);

                    if (!itemActivity[itemCode]) {
                        itemActivity[itemCode] = {
                            itemCode: itemCode,
                            itemName: line.description,
                            lastMovement: journalDate,
                            currentValue: 0
                        };
                    }

                    if (journalDate > itemActivity[itemCode].lastMovement) {
                        itemActivity[itemCode].lastMovement = journalDate;
                    }

                    itemActivity[itemCode].currentValue += (line.debit || 0) - (line.credit || 0);
                }
            });
        });

        // Filter slow moving items
        this.slowItems = Object.values(itemActivity)
            .filter(item => {
                return item.lastMovement < thresholdDate && item.currentValue > 0;
            })
            .map(item => ({
                ...item,
                daysSinceMovement: Math.floor((new Date() - item.lastMovement) / (1000 * 60 * 60 * 24))
            }))
            .sort((a, b) => b.daysSinceMovement - a.daysSinceMovement);
    },

    render() {
        const content = document.getElementById('main-content');
        content.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">⏱️ Slow Moving Items</h1>
        <p class="page-description">Items with no movement in last ${this.daysThreshold} days</p>
      </div>

      <div class="card mb-3">
        <div class="card-body">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Days Threshold</label>
              <select class="form-select" onchange="SlowMovingItems.daysThreshold = parseInt(this.value); SlowMovingItems.init();">
                <option value="30" ${this.daysThreshold === 30 ? 'selected' : ''}>30 days</option>
                <option value="60" ${this.daysThreshold === 60 ? 'selected' : ''}>60 days</option>
                <option value="90" ${this.daysThreshold === 90 ? 'selected' : ''}>90 days</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Slow Moving Items (${this.slowItems.length})</h2>
          <div class="btn-group">
            <button class="btn btn-secondary" onclick="SlowMovingItems.exportToCSV()">
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
        if (this.slowItems.length === 0) {
            return '<p class="text-center text-gray">✅ No slow moving items - Great inventory turnover!</p>';
        }

        const totalValue = this.slowItems.reduce((sum, item) => sum + item.currentValue, 0);

        return `
      <div style="margin-bottom: 16px; padding: 12px; background: hsl(45, 100%, 20%); border-radius: 8px;">
        <strong>⚠️ Alert:</strong> ${this.slowItems.length} items with no movement ${this.daysThreshold}+ days. 
        Total value tied up: ${this.formatCurrency(totalValue)}
      </div>

      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Last Movement</th>
              <th class="text-center">Days Inactive</th>
              <th class="text-right">Current Value</th>
              <th class="text-right">% of Total</th>
            </tr>
          </thead>
          <tbody>
            ${this.slowItems.map(item => `
              <tr style="${item.daysSinceMovement > 90 ? 'background: hsl(0, 72%, 25%);' : item.daysSinceMovement > 60 ? 'background: hsl(45, 100%, 20%);' : ''}">
                <td><strong>${item.itemName}</strong></td>
                <td>${item.lastMovement.toLocaleDateString('id-ID')}</td>
                <td class="text-center">
                  <span class="badge ${item.daysSinceMovement > 90 ? 'badge-danger' : item.daysSinceMovement > 60 ? 'badge-warning' : 'badge-secondary'}">
                    ${item.daysSinceMovement} days
                  </span>
                </td>
                <td class="text-right">${this.formatCurrency(item.currentValue)}</td>
                <td class="text-right">${((item.currentValue / totalValue) * 100).toFixed(1)}%</td>
              </tr>
            `).join('')}
            <tr style="background: var(--bg-tertiary); font-weight: bold;">
              <td colspan="3">TOTAL VALUE TIED UP:</td>
              <td class="text-right">${this.formatCurrency(totalValue)}</td>
              <td class="text-right">100%</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style="margin-top: 16px; padding: 12px; background: var(--bg-tertiary); border-radius: 8px;">
        <strong>💡 Recommendation:</strong> Consider promotional campaigns or production planning to move these items.
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
        const headers = ['Item', 'Last Movement', 'Days Inactive', 'Current Value'];
        const rows = this.slowItems.map(item => [
            item.itemName,
            item.lastMovement.toLocaleDateString('id-ID'),
            item.daysSinceMovement,
            item.currentValue
        ]);

        let csv = `Slow Moving Items (${this.daysThreshold}+ days)\n\n`;
        csv += headers.join(',') + '\n';
        rows.forEach(row => {
            csv += row.map(cell => `"${cell}"`).join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `slow-moving-items-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }
};

// ==========================================
// Stock In Report (Receipts Detail)
// ==========================================

const StockInReport = {
    receipts: [],
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
        this.receipts = [];

        const inventoryAccounts = ['1151', '1152', '1153', '1154', '1155', '1156', '1181', '1182', '1183', '1184', '1185'];

        journals.forEach(journal => {
            const journalDate = new Date(journal.date);
            if (journalDate >= new Date(this.startDate) && journalDate <= new Date(this.endDate)) {
                journal.lines.forEach(line => {
                    if (inventoryAccounts.includes(line.accountCode) && line.debit > 0) {
                        this.receipts.push({
                            date: journal.date,
                            refNo: journal.referenceNumber,
                            item: line.description,
                            accountCode: line.accountCode,
                            value: line.debit
                        });
                    }
                });
            }
        });

        this.receipts.sort((a, b) => new Date(b.date) - new Date(a.date));
    },

    render() {
        const content = document.getElementById('main-content');
        content.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">📥 Stock In Report</h1>
        <p class="page-description">All inventory receipts (purchases, returns, production)</p>
      </div>

      <div class="card mb-3">
        <div class="card-body">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Start Date</label>
              <input type="date" class="form-input" value="${this.startDate}" 
                     onchange="StockInReport.startDate = this.value; StockInReport.init();">
            </div>
            <div class="form-group">
              <label class="form-label">End Date</label>
              <input type="date" class="form-input" value="${this.endDate}"
                     onchange="StockInReport.endDate = this.value; StockInReport.init();">
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Stock Receipts (${this.receipts.length})</h2>
          <div class="btn-group">
            <button class="btn btn-secondary" onclick="StockInReport.exportToCSV()">
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
        if (this.receipts.length === 0) {
            return '<p class="text-center text-gray">No stock receipts in period</p>';
        }

        const totalValue = this.receipts.reduce((sum, r) => sum + r.value, 0);

        return `
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Ref No</th>
              <th>Item</th>
              <th>Account</th>
              <th class="text-right">Value</th>
            </tr>
          </thead>
          <tbody>
            ${this.receipts.map(r => `
              <tr>
                <td>${new Date(r.date).toLocaleDateString('id-ID')}</td>
                <td><span class="badge badge-success">${r.refNo}</span></td>
                <td>${r.item}</td>
                <td><span class="badge badge-secondary">${r.accountCode}</span></td>
                <td class="text-right">${this.formatCurrency(r.value)}</td>
              </tr>
            `).join('')}
            <tr style="background: var(--bg-tertiary); font-weight: bold;">
              <td colspan="4">TOTAL RECEIPTS:</td>
              <td class="text-right">${this.formatCurrency(totalValue)}</td>
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
        const headers = ['Date', 'Ref No', 'Item', 'Account', 'Value'];
        const rows = this.receipts.map(r => [
            new Date(r.date).toLocaleDateString('id-ID'),
            r.refNo,
            r.item,
            r.accountCode,
            r.value
        ]);

        let csv = `Stock In Report (${this.startDate} to ${this.endDate})\n\n`;
        csv += headers.join(',') + '\n';
        rows.forEach(row => {
            csv += row.map(cell => `"${cell}"`).join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `stock-in-report-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }
};

// Stock Out Report (Issues Detail)
const StockOutReport = {
    ...StockInReport,

    loadData() {
        const journals = Storage.get(Storage.KEYS.JOURNAL_ENTRIES) || [];
        this.receipts = []; // Reusing same structure

        const inventoryAccounts = ['1151', '1152', '1153', '1154', '1155', '1156', '1181', '1182', '1183', '1184', '1185'];

        journals.forEach(journal => {
            const journalDate = new Date(journal.date);
            if (journalDate >= new Date(this.startDate) && journalDate <= new Date(this.endDate)) {
                journal.lines.forEach(line => {
                    if (inventoryAccounts.includes(line.accountCode) && line.credit > 0) {
                        this.receipts.push({
                            date: journal.date,
                            refNo: journal.referenceNumber,
                            item: line.description,
                            accountCode: line.accountCode,
                            value: line.credit
                        });
                    }
                });
            }
        });

        this.receipts.sort((a, b) => new Date(b.date) - new Date(a.date));
    },

    render() {
        const content = document.getElementById('main-content');
        content.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">📤 Stock Out Report</h1>
        <p class="page-description">All inventory issues (sales, production usage, transfers)</p>
      </div>

      <div class="card mb-3">
        <div class="card-body">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Start Date</label>
              <input type="date" class="form-input" value="${this.startDate}" 
                     onchange="StockOutReport.startDate = this.value; StockOutReport.init();">
            </div>
            <div class="form-group">
              <label class="form-label">End Date</label>
              <input type="date" class="form-input" value="${this.endDate}"
                     onchange="StockOutReport.endDate = this.value; StockOutReport.init();">
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Stock Issues (${this.receipts.length})</h2>
          <div class="btn-group">
            <button class="btn btn-secondary" onclick="StockOutReport.exportToCSV()">
              📊 Export CSV
            </button>
          </div>
        </div>
        <div class="card-body">
          ${this.renderOutTable()}
        </div>
      </div>
    `;
    },

    renderOutTable() {
        if (this.receipts.length === 0) {
            return '<p class="text-center text-gray">No stock issues in period</p>';
        }

        const totalValue = this.receipts.reduce((sum, r) => sum + r.value, 0);

        return `
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Ref No</th>
              <th>Item</th>
              <th>Account</th>
              <th class="text-right">Value</th>
            </tr>
          </thead>
          <tbody>
            ${this.receipts.map(r => `
              <tr>
                <td>${new Date(r.date).toLocaleDateString('id-ID')}</td>
                <td><span class="badge badge-danger">${r.refNo}</span></td>
                <td>${r.item}</td>
                <td><span class="badge badge-secondary">${r.accountCode}</span></td>
                <td class="text-right">${this.formatCurrency(r.value)}</td>
              </tr>
            `).join('')}
            <tr style="background: var(--bg-tertiary); font-weight: bold;">
              <td colspan="4">TOTAL ISSUES:</td>
              <td class="text-right">${this.formatCurrency(totalValue)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
    }
};
