// ==========================================
// Lab Test Register - Gold-Specific Report
// Track gold pending lab test (in LAB warehouse/account 1152)
// ==========================================

const LabTestRegister = {
    pendingTests: [],

    init() {
        if (!Auth.isAuthenticated()) {
            window.location.href = 'login.html';
            return;
        }

        this.loadData();
        this.render();
    },

    loadData() {
        // Get all transactions in Lab Test account (1152 - Emas Dalam Pemeriksaan Lab)
        const journals = Storage.get(Storage.KEYS.JOURNAL_ENTRIES) || [];
        const labTransactions = [];

        journals.forEach(journal => {
            journal.lines.forEach(line => {
                if (line.accountCode === '1152') {
                    const amount = (line.debit || 0) - (line.credit || 0);
                    if (amount !== 0) { // Only if there's a balance
                        labTransactions.push({
                            date: journal.date,
                            refNo: journal.referenceNumber,
                            description: journal.description,
                            amount: Math.abs(amount),
                            status: amount > 0 ? 'PENDING' : 'COMPLETED',
                            daysOld: this.getDaysOld(journal.date)
                        });
                    }
                }
            });
        });

        this.pendingTests = labTransactions.filter(t => t.status === 'PENDING');
    },

    getDaysOld(date) {
        const now = new Date();
        const testDate = new Date(date);
        return Math.floor((now - testDate) / (1000 * 60 * 60 * 24));
    },

    render() {
        const content = document.getElementById('main-content');
        content.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">🔬 Lab Test Register</h1>
        <p class="page-description">Gold pending lab test - Monitoring and alerts</p>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Pending Lab Tests (${this.pendingTests.length})</h2>
          <div class="btn-group">
            <button class="btn btn-secondary" onclick="LabTestRegister.exportToCSV()">
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
        if (this.pendingTests.length === 0) {
            return '<p class="text-center text-gray">✅ No pending lab tests - Good!</p>';
        }

        const totalValue = this.pendingTests.reduce((sum, t) => sum + t.amount, 0);
        const overdue = this.pendingTests.filter(t => t.daysOld > 7);

        return `
      ${overdue.length > 0 ? `
        <div style="margin-bottom: 16px; padding: 12px; background: hsl(45, 100%, 20%); border-radius: 8px; border-left: 4px solid #ffc107;">
          <strong>⚠️ Alert:</strong> ${overdue.length} lab test(s) lebih dari 7 hari pending!
        </div>
      ` : ''}

      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Receipt Date</th>
              <th>Ref No</th>
              <th>Description</th>
              <th class="text-right">Est. Value</th>
              <th class="text-center">Days Pending</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${this.pendingTests.map(t => `
              <tr style="${t.daysOld > 7 ? 'background: hsl(45, 100%, 20%);' : ''}">
                <td>${new Date(t.date).toLocaleDateString('id-ID')}</td>
                <td><span class="badge badge-primary">${t.refNo}</span></td>
                <td>${t.description}</td>
                <td class="text-right">${this.formatCurrency(t.amount)}</td>
                <td class="text-center">
                  <span class="badge ${t.daysOld > 7 ? 'badge-danger' : 'badge-info'}">
                    ${t.daysOld} days
                  </span>
                </td>
                <td>
                  <span class="badge badge-warning">PENDING</span>
                </td>
              </tr>
            `).join('')}
            <tr style="background: var(--bg-tertiary); font-weight: bold;">
              <td colspan="3" class="text-right">TOTAL PENDING VALUE:</td>
              <td class="text-right">${this.formatCurrency(totalValue)}</td>
              <td colspan="2"></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style="margin-top: 16px; padding: 12px; background: var(--bg-tertiary); border-radius: 8px;">
        <strong>💡 Tip:</strong> Lab tests should be completed within 3-5 business days for optimal cash flow.
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
        const headers = ['Receipt Date', 'Ref No', 'Description', 'Est. Value', 'Days Pending', 'Status'];
        const rows = this.pendingTests.map(t => [
            new Date(t.date).toLocaleDateString('id-ID'),
            t.refNo,
            t.description,
            t.amount,
            t.daysOld,
            t.status
        ]);

        let csv = `Lab Test Register - Pending Tests\n\n`;
        csv += headers.join(',') + '\n';
        rows.forEach(row => {
            csv += row.map(cell => `"${cell}"`).join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lab-test-register-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }
};


// Explicitly make LabTestRegister globally available
window.LabTestRegister = LabTestRegister;
