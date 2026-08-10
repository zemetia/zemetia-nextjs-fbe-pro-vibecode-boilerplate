// ==========================================
// Bank Reconciliation Report
// Compare book balance vs bank statement
// ==========================================

const BankReconciliation = {
    banks: [],
    selectedBank: '',
    asOfDate: new Date().toISOString().split('T')[0],
    bookBalance: 0,
    bankBalance: 0,
    outstandingChecks: [],
    depositsInTransit: [],

    init() {
        if (!Auth.isAuthenticated()) {
            window.location.href = 'login.html';
            return;
        }

        this.loadData();
        this.render();
    },

    loadData() {
        this.banks = Storage.getBankAccounts();
    },

    calculateReconciliation() {
        if (!this.selectedBank) return;

        const journals = Storage.get(Storage.KEYS.JOURNAL_ENTRIES) || [];
        let balance = 0;

        // Calculate book balance from journal entries
        journals.forEach(journal => {
            const journalDate = new Date(journal.date);
            if (journalDate <= new Date(this.asOfDate)) {
                journal.lines.forEach(line => {
                    // Bank accounts start with 112x
                    if (line.accountCode.startsWith('112')) {
                        balance += (line.debit || 0) - (line.credit || 0);
                    }
                });
            }
        });

        this.bookBalance = balance;
        // In MVP, assume bank balance = book balance (user can manually enter difference)
        this.bankBalance = balance;
    },

    render() {
        const content = document.getElementById('main-content');
        content.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">🏦 Bank Reconciliation</h1>
        <p class="page-description">Reconcile book balance with bank statement</p>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Bank Reconciliation</h2>
        </div>
        <div class="card-body">
          ${this.renderForm()}
        </div>
      </div>
    `;
    },

    renderForm() {
        if (this.banks.length === 0) {
            return '<p class="text-center text-gray">No bank accounts found. Please add bank accounts in Master Data.</p>';
        }

        this.calculateReconciliation();

        return `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Bank Account</label>
          <select class="form-select" onchange="BankReconciliation.selectedBank = this.value; BankReconciliation.init();">
            <option value="">-- Select Bank --</option>
            ${this.banks.map(bank => `
              <option value="${bank.accountNumber}" ${this.selectedBank === bank.accountNumber ? 'selected' : ''}>
                ${bank.bankName} - ${bank.accountNumber}
              </option>
            `).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">As of Date</label>
          <input type="date" class="form-input" value="${this.asOfDate}"
                 onchange="BankReconciliation.asOfDate = this.value; BankReconciliation.init();">
        </div>
      </div>

      ${this.selectedBank ? `
        <div style="margin-top: 24px;">
          <h3 style="margin-bottom: 16px;">Reconciliation Summary</h3>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px;">
            <div style="padding: 16px; background: var(--bg-tertiary); border-radius: 8px;">
              <div style="font-size: 13px; color: #666; margin-bottom: 4px;">Book Balance</div>
              <div style="font-size: 24px; font-weight: bold; color: #1976d2;">
                ${this.formatCurrency(this.bookBalance)}
              </div>
            </div>

            <div style="padding: 16px; background: hsl(291, 47%, 20%); border-radius: 8px;">
              <div style="font-size: 13px; color: #666; margin-bottom: 4px;">Bank Statement Balance</div>
              <div style="font-size: 24px; font-weight: bold; color: #7b1fa2;">
                ${this.formatCurrency(this.bankBalance)}
              </div>
            </div>
          </div>

          <div style="padding: 16px; background: ${Math.abs(this.bookBalance - this.bankBalance) < 1 ? '#e8f5e9' : '#fff3cd'}; border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong>Difference:</strong>
                ${Math.abs(this.bookBalance - this.bankBalance) < 1 ?
                    '✅ Books and bank are reconciled!' :
                    '⚠️ Books and bank do not match'
                }
              </div>
              <div style="font-size: 20px; font-weight: bold;">
                ${this.formatCurrency(Math.abs(this.bookBalance - this.bankBalance))}
              </div>
            </div>
          </div>

          <div style="margin-top: 24px; padding: 12px; background: var(--bg-secondary); border-radius: 8px;">
            <strong>📝 Note:</strong> In production, you would manually enter outstanding checks and deposits in transit to reconcile the difference.
          </div>
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
    }
};

// ==========================================
// Stock Movement Summary
// All items movement in a period
// ==========================================

const StockMovementSummary = {
    movementData: [],
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
        const items = Storage.getItems();
        const inventoryAccounts = ['1151', '1152', '1153', '1154', '1155', '1156', '1181', '1182', '1183', '1184', '1185'];

        const itemMovements = {};

        journals.forEach(journal => {
            const journalDate = new Date(journal.date);
            if (journalDate >= new Date(this.startDate) && journalDate <= new Date(this.endDate)) {
                journal.lines.forEach(line => {
                    if (inventoryAccounts.includes(line.accountCode)) {
                        const itemCode = 'ITEM-' + line.accountCode; // Simplified

                        if (!itemMovements[itemCode]) {
                            itemMovements[itemCode] = {
                                itemCode: itemCode,
                                itemName: line.description,
                                inQty: 0,
                                outQty: 0,
                                inValue: 0,
                                outValue: 0
                            };
                        }

                        if (line.debit > 0) {
                            itemMovements[itemCode].inValue += line.debit;
                        } else if (line.credit > 0) {
                            itemMovements[itemCode].outValue += line.credit;
                        }
                    }
                });
            }
        });

        this.movementData = Object.values(itemMovements)
            .filter(m => m.inValue > 0 || m.outValue > 0)
            .sort((a, b) => (b.inValue + b.outValue) - (a.inValue + a.outValue));
    },

    render() {
        const content = document.getElementById('main-content');
        content.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">📊 Stock Movement Summary</h1>
        <p class="page-description">All inventory movements in period</p>
      </div>

      <div class="card mb-3">
        <div class="card-body">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Start Date</label>
              <input type="date" class="form-input" value="${this.startDate}" 
                     onchange="StockMovementSummary.startDate = this.value; StockMovementSummary.init();">
            </div>
            <div class="form-group">
              <label class="form-label">End Date</label>
              <input type="date" class="form-input" value="${this.endDate}"
                     onchange="StockMovementSummary.endDate = this.value; StockMovementSummary.init();">
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Stock Movements (${this.movementData.length} items)</h2>
          <div class="btn-group">
            <button class="btn btn-secondary" onclick="StockMovementSummary.exportToCSV()">
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
        if (this.movementData.length === 0) {
            return '<p class="text-center text-gray">No stock movements in selected period</p>';
        }

        const totalIn = this.movementData.reduce((sum, m) => sum + m.inValue, 0);
        const totalOut = this.movementData.reduce((sum, m) => sum + m.outValue, 0);

        return `
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Item</th>
              <th class="text-right">IN Value</th>
              <th class="text-right">OUT Value</th>
              <th class="text-right">Net Movement</th>
            </tr>
          </thead>
          <tbody>
            ${this.movementData.map(m => `
              <tr>
                <td><strong>${m.itemName}</strong></td>
                <td class="text-right" style="color: #388e3c;">${this.formatCurrency(m.inValue)}</td>
                <td class="text-right" style="color: #d32f2f;">${this.formatCurrency(m.outValue)}</td>
                <td class="text-right">
                  <span style="color: ${m.inValue - m.outValue >= 0 ? '#388e3c' : '#d32f2f'}">
                    ${this.formatCurrency(m.inValue - m.outValue)}
                  </span>
                </td>
              </tr>
            `).join('')}
            <tr style="background: var(--bg-tertiary); font-weight: bold;">
              <td>TOTAL</td>
              <td class="text-right" style="color: #388e3c;">${this.formatCurrency(totalIn)}</td>
              <td class="text-right" style="color: #d32f2f;">${this.formatCurrency(totalOut)}</td>
              <td class="text-right">
                <span style="color: ${totalIn - totalOut >= 0 ? '#388e3c' : '#d32f2f'}">
                  ${this.formatCurrency(totalIn - totalOut)}
                </span>
              </td>
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
        const headers = ['Item', 'IN Value', 'OUT Value', 'Net Movement'];
        const rows = this.movementData.map(m => [
            m.itemName,
            m.inValue,
            m.outValue,
            m.inValue - m.outValue
        ]);

        let csv = `Stock Movement Summary (${this.startDate} to ${this.endDate})\n\n`;
        csv += headers.join(',') + '\n';
        rows.forEach(row => {
            csv += row.map(cell => `"${cell}"`).join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `stock-movement-summary-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }
};
