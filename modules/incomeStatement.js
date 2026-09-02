// ==========================================
// Income Statement Module
// Laporan Laba Rugi sesuai SAK
// ==========================================

const IncomeStatement = {
  init() {
    this.render();
  },

  calculateProfitLoss(startDate, endDate) {
    // 1. Get filtered journal entries
    const allEntries = Storage.get(Storage.KEYS.JOURNAL_ENTRIES) || [];
    const filteredEntries = allEntries.filter(entry => {
      return entry.date >= startDate && entry.date <= endDate;
    });

    // 2. Initialize account balances map
    const accountBalances = {};
    const accounts = ChartOfAccounts.accounts.filter(a => a.type === 'detail');

    accounts.forEach(acc => {
      accountBalances[acc.code] = {
        ...acc,
        balance: 0
      };
    });

    // 3. Aggregate Debits and Credits
    filteredEntries.forEach(entry => {
      entry.lines.forEach(line => {
        const acc = accountBalances[line.accountCode];
        if (acc) {
          // Standard Normal Balance:
          // Revenue (Pendapatan) = Credit - Debit
          // Expense (Beban) = Debit - Credit
          // Diluar Usaha (6xxx) = ditentukan dari tanda saldo akhir
          if (acc.category === 'pendapatan') {
            acc.balance += (line.credit || 0) - (line.debit || 0);
          } else if (acc.category === 'beban' || acc.category === 'other') {
            acc.balance += (line.debit || 0) - (line.credit || 0);
          } else if (acc.category === 'diluar_usaha') {
            // Simpan sebagai debit - credit; nanti tentukan arah dari tanda saldo
            acc.balance += (line.debit || 0) - (line.credit || 0);
          }
        }
      });
    });

    const result = {
      pendapatan: [],
      beban: [],
      pendapatanLuarUsaha: [],
      bebanLuarUsaha: [],
      totalPendapatan: 0,
      totalBeban: 0,
      totalPendapatanLuarUsaha: 0,
      totalBebanLuarUsaha: 0,
      labaRugi: 0,
    };

    // 4. Categorize results
    const isRefineryOnly = Auth.getCurrentUser()?.reportProfile === 'refinery_only';

    Object.values(accountBalances).forEach(acc => {
      if (acc.balance === 0) return; // Skip zero balances

      if (acc.category === 'pendapatan') {
        // If refinery only, only show service revenue (412x)
        if (isRefineryOnly && !acc.code.startsWith('412')) return;
        
        result.pendapatan.push({ ...acc, amount: acc.balance });
        result.totalPendapatan += acc.balance;
      } else if (acc.category === 'beban' || acc.category === 'other') {
        // If refinery only, maybe we should also filter expenses?
        // User said "omzet ... murni berdasarkan jasa refinery", usually implies the whole P&L
        // We'll keep expenses as is or filter them if there's a specific tag
        result.beban.push({ ...acc, amount: acc.balance });
        result.totalBeban += acc.balance;
      } else if (acc.category === 'diluar_usaha') {
        // Akun 6xxx: arah ditentukan dari tanda saldo
        // Saldo negatif (credit net) = pendapatan di luar usaha
        // Saldo positif (debit net)  = beban di luar usaha
        if (acc.balance < 0) {
          const amount = Math.abs(acc.balance);
          result.pendapatanLuarUsaha.push({ ...acc, amount });
          result.totalPendapatanLuarUsaha += amount;
        } else {
          result.bebanLuarUsaha.push({ ...acc, amount: acc.balance });
          result.totalBebanLuarUsaha += acc.balance;
        }
      }
    });

    // 5. Sort by account code
    result.pendapatan.sort((a, b) => a.code.localeCompare(b.code));
    result.beban.sort((a, b) => a.code.localeCompare(b.code));
    result.pendapatanLuarUsaha.sort((a, b) => a.code.localeCompare(b.code));
    result.bebanLuarUsaha.sort((a, b) => a.code.localeCompare(b.code));

    // Laba Usaha = Pendapatan Usaha - Beban Usaha
    result.labaUsaha = result.totalPendapatan - result.totalBeban;

    // Net Income = Laba Usaha + Pendapatan Luar Usaha - Beban Luar Usaha
    result.labaRugi = result.labaUsaha
      + result.totalPendapatanLuarUsaha
      - result.totalBebanLuarUsaha;

    return result;
  },

  render() {
    const content = document.getElementById('main-content');
    content.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Laporan Laba Rugi</h1>
        <p class="page-description">Income Statement sesuai SAK</p>
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
            <p class="text-gray">LAPORAN LABA RUGI</p>
            <p class="text-gray" id="report-period"></p>
          </div>
          <button class="btn btn-secondary" onclick="IncomeStatement.exportToPDF()">
            📄 Export PDF
          </button>
        </div>
        <div class="card-body" id="income-statement-content">
          <p class="text-center text-gray">Pilih periode untuk melihat laporan</p>
        </div>
      </div>
    `;

    // Auto-load current month
    this.loadReport();
  },

  renderPeriodSelector() {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

    return `
      <form id="period-form" onsubmit="IncomeStatement.loadReport(event)">
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

    const config = Storage.get(Storage.KEYS.CONFIG) || {};
    const data = this.calculateProfitLoss(startDate, endDate);

    document.getElementById('report-company-name').textContent = config.companyName || 'Perusahaan';
    document.getElementById('report-period').textContent = `Periode: ${this.formatDate(startDate)} s/d ${this.formatDate(endDate)}`;

    const content = document.getElementById('income-statement-content');
    content.innerHTML = this.renderReport(data);
  },

  renderReport(data) {
    const isProfit = data.labaRugi >= 0;
    const isUsahaProfit = data.labaUsaha >= 0;
    const hasLuarUsaha = (data.pendapatanLuarUsaha.length + data.bebanLuarUsaha.length) > 0;

    return `
      <div class="table-container">
        <table class="table">
          <tbody>
            <!-- PENDAPATAN USAHA -->
            <tr style="background: var(--bg-tertiary);">
              <td colspan="2" style="font-weight: 700; font-size: var(--font-size-lg);">
                PENDAPATAN USAHA
              </td>
            </tr>
            ${data.pendapatan.map(acc => `
              <tr>
                <td style="padding-left: var(--spacing-xl);">${acc.name}</td>
                <td class="text-right">${this.formatCurrency(acc.amount)}</td>
              </tr>
            `).join('')}
            ${data.pendapatan.length === 0 ? '<tr><td style="padding-left: var(--spacing-xl);" class="text-gray">Tidak ada pendapatan</td><td class="text-right text-gray">Rp 0</td></tr>' : ''}
            
            <tr style="background: var(--color-primary); color: var(--color-white); font-weight: 700;">
              <td>TOTAL PENDAPATAN USAHA</td>
              <td class="text-right">${this.formatCurrency(data.totalPendapatan)}</td>
            </tr>

            <!-- Spacing -->
            <tr><td colspan="2" style="height: var(--spacing-lg);"></td></tr>

            <!-- BEBAN USAHA -->
            <tr style="background: var(--bg-tertiary);">
              <td colspan="2" style="font-weight: 700; font-size: var(--font-size-lg);">
                BEBAN USAHA
              </td>
            </tr>
            ${data.beban.map(acc => `
              <tr>
                <td style="padding-left: var(--spacing-xl);">${acc.name}</td>
                <td class="text-right">${this.formatCurrency(acc.amount)}</td>
              </tr>
            `).join('')}
            ${data.beban.length === 0 ? '<tr><td style="padding-left: var(--spacing-xl);" class="text-gray">Tidak ada beban</td><td class="text-right text-gray">Rp 0</td></tr>' : ''}
            
            <tr style="background: var(--color-error); color: var(--color-white); font-weight: 700;">
              <td>TOTAL BEBAN USAHA</td>
              <td class="text-right">${this.formatCurrency(data.totalBeban)}</td>
            </tr>

            <!-- Spacing -->
            <tr><td colspan="2" style="height: var(--spacing-lg);"></td></tr>

            <!-- LABA / RUGI USAHA (subtotal) -->
            <tr style="background: var(--bg-secondary); font-weight: 700; font-size: var(--font-size-lg); border-top: 2px solid var(--border-color);">
              <td>${isUsahaProfit ? 'LABA USAHA' : 'RUGI USAHA'}</td>
              <td class="text-right">${this.formatCurrency(Math.abs(data.labaUsaha))}</td>
            </tr>

            ${hasLuarUsaha ? `
            <!-- Spacing -->
            <tr><td colspan="2" style="height: var(--spacing-lg);"></td></tr>

            <!-- PENDAPATAN DI LUAR USAHA -->
            ${data.pendapatanLuarUsaha.length > 0 ? `
            <tr style="background: var(--bg-tertiary);">
              <td colspan="2" style="font-weight: 700;">PENDAPATAN DI LUAR USAHA (6xxx)</td>
            </tr>
            ${data.pendapatanLuarUsaha.map(acc => `
              <tr>
                <td style="padding-left: var(--spacing-xl);">${acc.code} – ${acc.name}</td>
                <td class="text-right">${this.formatCurrency(acc.amount)}</td>
              </tr>
            `).join('')}
            <tr style="font-weight: 600;">
              <td style="padding-left: var(--spacing-xl);">Total Pendapatan Luar Usaha</td>
              <td class="text-right">${this.formatCurrency(data.totalPendapatanLuarUsaha)}</td>
            </tr>
            ` : ''}

            <!-- BEBAN DI LUAR USAHA -->
            ${data.bebanLuarUsaha.length > 0 ? `
            <tr style="background: var(--bg-tertiary);">
              <td colspan="2" style="font-weight: 700;">BEBAN DI LUAR USAHA (6xxx)</td>
            </tr>
            ${data.bebanLuarUsaha.map(acc => `
              <tr>
                <td style="padding-left: var(--spacing-xl);">${acc.code} – ${acc.name}</td>
                <td class="text-right">${this.formatCurrency(acc.amount)}</td>
              </tr>
            `).join('')}
            <tr style="font-weight: 600;">
              <td style="padding-left: var(--spacing-xl);">Total Beban Luar Usaha</td>
              <td class="text-right">${this.formatCurrency(data.totalBebanLuarUsaha)}</td>
            </tr>
            ` : ''}

            <!-- Spacing -->
            <tr><td colspan="2" style="height: var(--spacing-lg);"></td></tr>
            ` : ''}

            <!-- LABA / RUGI BERSIH -->
            <tr style="background: ${isProfit ? 'var(--color-success)' : 'var(--color-error)'}; color: var(--color-white); font-weight: 700; font-size: var(--font-size-xl);">
              <td>${isProfit ? 'LABA BERSIH' : 'RUGI BERSIH'}</td>
              <td class="text-right">${this.formatCurrency(Math.abs(data.labaRugi))}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="alert ${isProfit ? 'alert-success' : 'alert-warning'} mt-2">
        ${isProfit ? '✓' : '⚠️'} 
        ${isProfit
        ? `Perusahaan menghasilkan laba bersih sebesar ${this.formatCurrency(data.labaRugi)}`
        : `Perusahaan mengalami rugi bersih sebesar ${this.formatCurrency(Math.abs(data.labaRugi))}`
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
    const data = this.calculateProfitLoss(startDate, endDate);
    const config = Storage.get(Storage.KEYS.CONFIG) || {};
    PDFExporter.exportIncomeStatement(data, startDate, endDate, config);
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


// Explicitly make IncomeStatement globally available
window.IncomeStatement = IncomeStatement;
