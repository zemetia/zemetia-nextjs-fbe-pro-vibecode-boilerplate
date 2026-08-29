// ==========================================
// Cash Flow Statement Module
// Laporan Arus Kas sesuai SAK
// ==========================================

const CashFlow = {
  init() {
    this.render();
  },

  calculateCashFlow(startDate, endDate) {
    const entries = Storage.get(Storage.KEYS.JOURNAL_ENTRIES) || [];
    const cashAccounts = ['1110', '1120']; // Kas dan Bank

    const result = {
      operating: [],
      investing: [],
      financing: [],
      totalOperating: 0,
      totalInvesting: 0,
      totalFinancing: 0,
      netCashFlow: 0,
      beginningBalance: 0,
      endingBalance: 0,
    };

    // Get beginning balance
    result.beginningBalance = this.getCashBalance(cashAccounts, startDate);

    // Process each entry
    entries.forEach(entry => {
      if (entry.date < startDate || entry.date > endDate) return;

      entry.lines.forEach(line => {
        if (!cashAccounts.includes(line.accountCode)) return;

        const amount = line.debit - line.credit;
        if (amount === 0) return;

        // Classify transaction
        const category = this.classifyTransaction(line, entry);

        const transaction = {
          date: entry.date,
          description: entry.description,
          amount: amount,
        };

        if (category === 'operating') {
          result.operating.push(transaction);
          result.totalOperating += amount;
        } else if (category === 'investing') {
          result.investing.push(transaction);
          result.totalInvesting += amount;
        } else if (category === 'financing') {
          result.financing.push(transaction);
          result.totalFinancing += amount;
        }
      });
    });

    result.netCashFlow = result.totalOperating + result.totalInvesting + result.totalFinancing;
    result.endingBalance = result.beginningBalance + result.netCashFlow;

    return result;
  },

  getCashBalance(cashAccounts, beforeDate) {
    let balance = 0;
    const entries = Storage.get(Storage.KEYS.JOURNAL_ENTRIES) || [];

    entries.forEach(entry => {
      if (entry.date >= beforeDate) return; // Skip entries on or after start date

      entry.lines.forEach(line => {
        if (cashAccounts.includes(line.accountCode)) {
          balance += (line.debit - line.credit);
        }
      });
    });

    return balance;
  },

  classifyTransaction(line, entry) {
    // Simple classification based on contra accounts
    // This is a simplified version - real classification would be more complex

    const contraAccounts = entry.lines.filter(l => l.accountCode !== line.accountCode);

    for (let contra of contraAccounts) {
      const account = ChartOfAccounts.getAccount(contra.accountCode);
      if (!account) continue;

      // Operating activities - revenue and expenses
      if (account.category === 'pendapatan' || account.category === 'beban') {
        return 'operating';
      }

      // Operating activities - current assets and liabilities
      if (account.code.startsWith('11') || account.code.startsWith('21')) {
        return 'operating';
      }

      // Investing activities - non-current assets
      if (account.code.startsWith('12')) {
        return 'investing';
      }

      // Financing activities - equity and long-term liabilities
      if (account.code.startsWith('22') || account.code.startsWith('3')) {
        return 'financing';
      }
    }

    return 'operating'; // Default
  },

  render() {
    const content = document.getElementById('main-content');
    content.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Laporan Arus Kas</h1>
        <p class="page-description">Cash Flow Statement sesuai SAK</p>
      </div>

      <div class="card mb-3">
        <div class="card-body">
          ${this.renderPeriodSelector()}
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title" id="report-company-name"></h2>
            <p class="text-gray">LAPORAN ARUS KAS</p>
            <p class="text-gray" id="report-period"></p>
          </div>
          <button class="btn btn-secondary" onclick="CashFlow.exportToPDF()">
            📄 Export PDF
          </button>
        </div>
        <div class="card-body" id="cashflow-content">
          <p class="text-center text-gray">Pilih periode untuk melihat laporan</p>
        </div>
      </div>
    `;

    this.loadReport();
  },

  renderPeriodSelector() {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

    return `
      <form id="period-form" onsubmit="CashFlow.loadReport(event)">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Dari Tanggal</label>
            <input type="date" name="startDate" class="form-input" value="${firstDayOfMonth}" required>
          </div>
          
          <div class="form-group">
            <label class="form-label">Sampai Tanggal</label>
            <input type="date" name="endDate" class="form-input" value="${lastDayOfMonth}" required>
          </div>

          <div class="form-group flex align-center">
            <button type="submit" class="btn btn-primary" style="margin-top: auto;">
              Tampilkan Laporan
            </button>
          </div>
        </div>
      </form>
    `;
  },

  loadReport(event) {
    if (event) event.preventDefault();

    const form = document.getElementById('period-form');
    const formData = new FormData(form);
    const startDate = formData.get('startDate');
    const endDate = formData.get('endDate');

    const config = Storage.get(Storage.KEYS.CONFIG);
    const data = this.calculateCashFlow(startDate, endDate);

    document.getElementById('report-company-name').textContent = config.companyName || 'Perusahaan';
    document.getElementById('report-period').textContent = `Periode: ${this.formatDate(startDate)} s/d ${this.formatDate(endDate)}`;

    const content = document.getElementById('cashflow-content');
    content.innerHTML = this.renderReport(data);
  },

  renderReport(data) {
    return `
      <div class="table-container">
        <table class="table">
          <tbody>
            <!-- Saldo Awal -->
            <tr style="background: var(--bg-tertiary); font-weight: 600;">
              <td>Saldo Kas Awal Periode</td>
              <td class="text-right">${this.formatCurrency(data.beginningBalance)}</td>
            </tr>

            <!-- Spacing -->
            <tr><td colspan="2" style="height: var(--spacing-md);"></td></tr>

            <!-- AKTIVITAS OPERASI -->
            <tr style="background: var(--bg-tertiary);">
              <td colspan="2" style="font-weight: 700; font-size: var(--font-size-lg);">
                ARUS KAS DARI AKTIVITAS OPERASI
              </td>
            </tr>
            ${data.operating.length > 0 ? data.operating.map(txn => `
              <tr>
                <td style="padding-left: var(--spacing-xl);">${txn.description}</td>
                <td class="text-right ${txn.amount >= 0 ? 'text-success' : 'text-error'}">
                  ${this.formatCurrency(txn.amount)}
                </td>
              </tr>
            `).join('') : '<tr><td style="padding-left: var(--spacing-xl);" class="text-gray">Tidak ada transaksi</td><td class="text-right text-gray">Rp 0</td></tr>'}
            
            <tr style="background: var(--bg-secondary); font-weight: 700;">
              <td>Kas Bersih dari Aktivitas Operasi</td>
              <td class="text-right ${data.totalOperating >= 0 ? 'text-success' : 'text-error'}">
                ${this.formatCurrency(data.totalOperating)}
              </td>
            </tr>

            <!-- Spacing -->
            <tr><td colspan="2" style="height: var(--spacing-md);"></td></tr>

            <!-- AKTIVITAS INVESTASI -->
            <tr style="background: var(--bg-tertiary);">
              <td colspan="2" style="font-weight: 700; font-size: var(--font-size-lg);">
                ARUS KAS DARI AKTIVITAS INVESTASI
              </td>
            </tr>
            ${data.investing.length > 0 ? data.investing.map(txn => `
              <tr>
                <td style="padding-left: var(--spacing-xl);">${txn.description}</td>
                <td class="text-right ${txn.amount >= 0 ? 'text-success' : 'text-error'}">
                  ${this.formatCurrency(txn.amount)}
                </td>
              </tr>
            `).join('') : '<tr><td style="padding-left: var(--spacing-xl);" class="text-gray">Tidak ada transaksi</td><td class="text-right text-gray">Rp 0</td></tr>'}
            
            <tr style="background: var(--bg-secondary); font-weight: 700;">
              <td>Kas Bersih dari Aktivitas Investasi</td>
              <td class="text-right ${data.totalInvesting >= 0 ? 'text-success' : 'text-error'}">
                ${this.formatCurrency(data.totalInvesting)}
              </td>
            </tr>

            <!-- Spacing -->
            <tr><td colspan="2" style="height: var(--spacing-md);"></td></tr>

            <!-- AKTIVITAS PENDANAAN -->
            <tr style="background: var(--bg-tertiary);">
              <td colspan="2" style="font-weight: 700; font-size: var(--font-size-lg);">
                ARUS KAS DARI AKTIVITAS PENDANAAN
              </td>
            </tr>
            ${data.financing.length > 0 ? data.financing.map(txn => `
              <tr>
                <td style="padding-left: var(--spacing-xl);">${txn.description}</td>
                <td class="text-right ${txn.amount >= 0 ? 'text-success' : 'text-error'}">
                  ${this.formatCurrency(txn.amount)}
                </td>
              </tr>
            `).join('') : '<tr><td style="padding-left: var(--spacing-xl);" class="text-gray">Tidak ada transaksi</td><td class="text-right text-gray">Rp 0</td></tr>'}
            
            <tr style="background: var(--bg-secondary); font-weight: 700;">
              <td>Kas Bersih dari Aktivitas Pendanaan</td>
              <td class="text-right ${data.totalFinancing >= 0 ? 'text-success' : 'text-error'}">
                ${this.formatCurrency(data.totalFinancing)}
              </td>
            </tr>

            <!-- Spacing -->
            <tr><td colspan="2" style="height: var(--spacing-lg);"></td></tr>

            <!-- KENAIKAN/PENURUNAN KAS -->
            <tr style="background: var(--color-primary); color: var(--color-white); font-weight: 700;">
              <td>${data.netCashFlow >= 0 ? 'KENAIKAN' : 'PENURUNAN'} KAS BERSIH</td>
              <td class="text-right">${this.formatCurrency(data.netCashFlow)}</td>
            </tr>

            <!-- SALDO AKHIR -->
            <tr style="background: var(--color-secondary); color: var(--color-white); font-weight: 700; font-size: var(--font-size-xl);">
              <td>SALDO KAS AKHIR PERIODE</td>
              <td class="text-right">${this.formatCurrency(data.endingBalance)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="alert ${data.netCashFlow >= 0 ? 'alert-success' : 'alert-warning'} mt-2">
        ${data.netCashFlow >= 0 ? '✓' : '⚠️'}
        ${data.netCashFlow >= 0
        ? `Kenaikan kas bersih sebesar ${this.formatCurrency(data.netCashFlow)}`
        : `Penurunan kas bersih sebesar ${this.formatCurrency(Math.abs(data.netCashFlow))}`
      }
      </div>
    `;
  },

  exportToPDF() {
    const form = document.getElementById('period-form');
    if (!form) return;

    const formData = new FormData(form);
    const startDate = formData.get('startDate');
    const endDate = formData.get('endDate');

    const cashFlowData = this.calculateCashFlow(startDate, endDate);

    // Transform data to match PDFExporter expected format
    const data = {
      operasi: cashFlowData.operating,
      investasi: cashFlowData.investing,
      pendanaan: cashFlowData.financing,
      totalOperasi: cashFlowData.totalOperating,
      totalInvestasi: cashFlowData.totalInvesting,
      totalPendanaan: cashFlowData.totalFinancing,
    };

    const config = Storage.get(Storage.KEYS.CONFIG);
    PDFExporter.exportCashFlow(data, startDate, endDate, config);
  },

  formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  },

  formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  },
};


// Explicitly make CashFlow globally available
window.CashFlow = CashFlow;
