// ==========================================
// Balance Sheet Module
// Laporan Neraca sesuai SAK
// ==========================================

const BalanceSheet = {
  _filterStartDate: null,
  _filterEndDate: null,
  _hideZeroAccounts: false,  // Checkbox: Abaikan akun kosong/0

  init() {
    // Check authentication
    if (!Auth.isAuthenticated()) {
      window.location.href = 'login.html';
      return;
    }

    // Ensure chart of accounts is loaded
    if (!ChartOfAccounts.accounts || ChartOfAccounts.accounts.length === 0) {
      ChartOfAccounts.loadAccounts();
    }

    // Set default date range: Cumulative from beginning to today
    const today = new Date();
    this._filterStartDate = '2000-01-01'; // Default to "Beginning of Time" for Balance Sheet
    this._filterEndDate = today.toISOString().split('T')[0];

    this.render();
  },

  calculateBalances(startDate = null, endDate = null) {
    const accounts = ChartOfAccounts.accounts;
    const journals = Storage.get(Storage.KEYS.JOURNAL_ENTRIES) || [];

    // Use provided dates or instance filter dates
    const filterStartDate = startDate || this._filterStartDate;
    const filterEndDate = endDate || this._filterEndDate;

    // Initialize balances from account master data
    const accountBalances = {};
    accounts.forEach(account => {
      if (account.type === 'detail') {
        accountBalances[account.code] = 0;
      }
    });

    // Calculate balances from journal entries
    journals.forEach(journal => {
      const journalDate = new Date(journal.date);
      const endFilter = new Date(filterEndDate);

      // Balance Sheet Principle: Include ALL journals UP TO the end date
      // (Starting from beginning of time, regardless of startDate filter)
      if (journalDate <= endFilter) {
        journal.lines.forEach(line => {
          if (accountBalances[line.accountCode] !== undefined) {
            accountBalances[line.accountCode] += (line.debit || 0) - (line.credit || 0);
          }
        });
      }
    });

    const balances = {
      aset: { current: [], nonCurrent: [], total: 0 },
      kewajiban: { current: [], longTerm: [], total: 0 },
      ekuitas: { items: [], total: 0 },
      netIncome: 0
    };

    let totalRevenue = 0;
    let totalExpenses = 0;

    accounts.forEach(account => {
      if (account.type !== 'detail') return;

      // Get raw balance (debit - credit)
      const rawBalance = accountBalances[account.code] || 0;

      // Apply normal balance convention:
      // - Assets (aset) and Expenses (beban): Debit balance is normal (positive)
      // - Liabilities (kewajiban), Equity (ekuitas), Revenue (pendapatan): Credit balance is normal (positive)
      let balance;

      if (account.category === 'aset' || account.category === 'beban') {
        // Debit balance normal: use rawBalance as-is
        balance = rawBalance;
      } else if (account.category === 'kewajiban' || account.category === 'ekuitas' || account.category === 'pendapatan') {
        // Credit balance normal: negate rawBalance (credit increases = positive)
        balance = -rawBalance;
      } else {
        balance = rawBalance;
      }

      if (account.category === 'aset') {
        const isRefineryOnly = Auth.getCurrentUser()?.reportProfile === 'refinery_only';
        if (isRefineryOnly) {
          // Filter Assets for refinery only: 11301 (Piutang Refineri), 1172 (Titipan), 1163 (Refining WIP)
          const refineryAssetCodes = ['11301', '1172', '1163'];
          const isRefineryAsset = refineryAssetCodes.some(c => account.code.startsWith(c)) || 
                                  account.name.toLowerCase().includes('refin') || 
                                  account.name.toLowerCase().includes('jasa');
          if (!isRefineryAsset) return;
        }

        // Classify as current or non-current based on code
        if (account.code.startsWith('11')) {
          balances.aset.current.push({ ...account, balance });
        } else {
          balances.aset.nonCurrent.push({ ...account, balance });
        }
        balances.aset.total += balance;
      } else if (account.category === 'kewajiban') {
        const isRefineryOnly = Auth.getCurrentUser()?.reportProfile === 'refinery_only';
        if (isRefineryOnly) {
          // Filter Liabilities for refinery only: 2112 (Titipan), 2142 (Assay service debt)
          const refineryLiabCodes = ['2112', '2142'];
          const isRefineryLiab = refineryLiabCodes.some(c => account.code.startsWith(c)) || 
                                 account.name.toLowerCase().includes('refin');
          if (!isRefineryLiab) return;
        }

        // Classify as current or long-term based on code
        if (account.code.startsWith('21')) {
          balances.kewajiban.current.push({ ...account, balance });
        } else {
          balances.kewajiban.longTerm.push({ ...account, balance });
        }
        balances.kewajiban.total += balance;
      } else if (account.category === 'ekuitas') {
        balances.ekuitas.items.push({ ...account, balance });
        balances.ekuitas.total += balance;
      } else if (account.category === 'pendapatan') {
        const isRefineryOnly = Auth.getCurrentUser()?.reportProfile === 'refinery_only';
        if (isRefineryOnly && !account.code.startsWith('412')) return;

        // Revenue accounts have credit balance normal (positive when credited)
        totalRevenue += balance;
      } else if (account.category === 'beban' || account.category === 'other') {
        // Expense accounts have debit balance normal (positive when debited)
        totalExpenses += balance;
      } else if (account.category === 'diluar_usaha') {
        // Pendapatan/Beban Di Luar Usaha (akun 6xxx)
        // balance sudah di-flip berdasarkan rawBalance:
        //   credit-normal (pendapatan luar usaha) → balance positif → kurangi beban
        //   debit-normal  (beban luar usaha)      → balance positif → tambah beban
        // Karena 6xxx umumnya dipakai untuk kedua arah, gunakan tanda saldo:
        if (balance < 0) {
          // Credit net → pendapatan di luar usaha
          totalRevenue += Math.abs(balance);
        } else {
          // Debit net → beban di luar usaha
          totalExpenses += balance;
        }
      }
    });

    // Calculate net income (revenue - expenses)
    balances.netIncome = totalRevenue - totalExpenses;

    // Add net income to equity total to balance the equation
    balances.ekuitas.total += balances.netIncome;

    // Add totals for P&L (Used by Dashboard)
    balances.totalRevenue = totalRevenue;
    balances.totalExpenses = totalExpenses;

    return balances;
  },

  applyFilter(event) {
    if (event) event.preventDefault();
    const formData = new FormData(event.target);
    this._filterStartDate = formData.get('startDate');
    this._filterEndDate = formData.get('endDate');
    this._hideZeroAccounts = formData.get('hideZeroAccounts') === 'on';
    this.renderBalances();
  },

  clearFilter() {
    const today = new Date();
    this._filterStartDate = '2000-01-01';
    this._filterEndDate = today.toISOString().split('T')[0];
    document.querySelector('[name="startDate"]').value = this._filterStartDate;
    document.querySelector('[name="endDate"]').value = this._filterEndDate;
    this.renderBalances();
  },

  renderBalances() {
    const balances = this.calculateBalances();
    const container = document.getElementById('balance-sheet-content');
    if (container) {
      container.innerHTML = this.renderBalanceSheet(balances, this._hideZeroAccounts);
    }
  },

  render() {
    const content = document.getElementById('main-content');
    const balances = this.calculateBalances();
    const config = Storage.get(Storage.KEYS.CONFIG) || {};

    content.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Neraca (Balance Sheet)</h1>
        <p class="page-description">Laporan Posisi Keuangan sesuai SAK</p>
      </div>

      <div class="card mb-3">
        <div class="card-header">
          <h2 class="card-title">Filter Periode</h2>
        </div>
        <div class="card-body">
          <form id="balance-filter-form" class="mb-0" onsubmit="BalanceSheet.applyFilter(event)">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Dari Tanggal</label>
                <input type="date" name="startDate" class="form-input" value="${this._filterStartDate}" required>
              </div>
              <div class="form-group">
                <label class="form-label">Sampai Tanggal</label>
                <input type="date" name="endDate" class="form-input" value="${this._filterEndDate}" required>
              </div>
              <div class="form-group flex align-center" style="gap: 0.75rem;">
                <button type="submit" class="btn btn-primary" style="margin-top: auto;">
                  🔍 Filter
                </button>
                <button type="button" class="btn btn-secondary" style="margin-top: auto;" onclick="BalanceSheet.clearFilter()">
                  ↺ Reset
                </button>
              </div>
            </div>
            <div class="form-row" style="margin-top: 0.5rem;">
              <div class="form-group" style="display: flex; align-items: center; gap: 0.5rem;">
                <input type="checkbox" id="hide-zero-accounts" name="hideZeroAccounts"
                       ${this._hideZeroAccounts ? 'checked' : ''}
                       style="width: 16px; height: 16px; cursor: pointer;">
                <label for="hide-zero-accounts" class="form-label mb-0" style="cursor: pointer; margin: 0;">
                  🚫 Abaikan akun kosong (saldo Rp 0)
                </label>
              </div>
            </div>
          </form>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div>
            <h2 class="card-title">${config.companyName || 'PT. Golden Alura Refineri'}</h2>
            <p class="text-gray">NERACA</p>
            <p class="text-gray">Periode: ${this.formatDate(this._filterStartDate)} s/d ${this.formatDate(this._filterEndDate)}</p>
          </div>
          <button class="btn btn-secondary" onclick="BalanceSheet.exportToPDF()">
            📄 Export PDF
          </button>
        </div>
        <div class="card-body" id="balance-sheet-content">
          ${this.renderBalanceSheet(balances, this._hideZeroAccounts)}
        </div>
      </div>
    `;
  },

  renderBalanceSheet(balances, hideZero = false) {
    // Filter helper: if hideZero is true, exclude accounts with balance = 0
    const filterAccounts = (arr) => hideZero ? arr.filter(a => a.balance !== 0) : arr;
    const totalLiabilitiesEquity = balances.kewajiban.total + balances.ekuitas.total;
    const isBalanced = Math.abs(balances.aset.total - totalLiabilitiesEquity) < 0.01;

    return `
      <div class="table-container">
        <table class="table">
          <tbody>
            <!-- ASET -->
            <tr style="background: var(--bg-tertiary);">
              <td colspan="2" style="font-weight: 700; font-size: var(--font-size-lg);">
                ASET
              </td>
            </tr>
            
            <!-- Aset Lancar -->
            <tr style="background: var(--bg-secondary);">
              <td colspan="2" style="font-weight: 600; padding-left: var(--spacing-xl);">
                Aset Lancar
              </td>
            </tr>
            ${filterAccounts(balances.aset.current).map(acc => `
              <tr>
                <td style="padding-left: calc(var(--spacing-xl) * 2);">${acc.name}</td>
                <td class="text-right">${this.formatCurrency(acc.balance)}</td>
              </tr>
            `).join('')}
            <tr style="font-weight: 600;">
              <td style="padding-left: var(--spacing-xl);">Total Aset Lancar</td>
              <td class="text-right">
                ${this.formatCurrency(balances.aset.current.reduce((s, a) => s + a.balance, 0))}
              </td>
            </tr>
            
            <!-- Aset Tidak Lancar -->
            <tr style="background: var(--bg-secondary);">
              <td colspan="2" style="font-weight: 600; padding-left: var(--spacing-xl);">
                Aset Tidak Lancar
              </td>
            </tr>
            ${filterAccounts(balances.aset.nonCurrent).map(acc => `
              <tr>
                <td style="padding-left: calc(var(--spacing-xl) * 2);">${acc.name}</td>
                <td class="text-right">${this.formatCurrency(acc.balance)}</td>
              </tr>
            `).join('')}
            <tr style="font-weight: 600;">
              <td style="padding-left: var(--spacing-xl);">Total Aset Tidak Lancar</td>
              <td class="text-right">
                ${this.formatCurrency(balances.aset.nonCurrent.reduce((s, a) => s + a.balance, 0))}
              </td>
            </tr>
            
            <tr style="background: var(--color-primary); color: var(--color-white); font-weight: 700; font-size: var(--font-size-lg);">
              <td>TOTAL ASET</td>
              <td class="text-right">${this.formatCurrency(balances.aset.total)}</td>
            </tr>
            
            <!-- Spacing -->
            <tr><td colspan="2" style="height: var(--spacing-lg);"></td></tr>
            
            <!-- KEWAJIBAN -->
            <tr style="background: var(--bg-tertiary);">
              <td colspan="2" style="font-weight: 700; font-size: var(--font-size-lg);">
                KEWAJIBAN
              </td>
            </tr>
            
            <!-- Kewajiban Jangka Pendek -->
            <tr style="background: var(--bg-secondary);">
              <td colspan="2" style="font-weight: 600; padding-left: var(--spacing-xl);">
                Kewajiban Jangka Pendek
              </td>
            </tr>
            ${filterAccounts(balances.kewajiban.current).map(acc => `
              <tr>
                <td style="padding-left: calc(var(--spacing-xl) * 2);">${acc.name}</td>
                <td class="text-right">${this.formatCurrency(acc.balance)}</td>
              </tr>
            `).join('')}
            ${filterAccounts(balances.kewajiban.current).length === 0 ? '<tr><td style="padding-left: calc(var(--spacing-xl) * 2);" class="text-gray">-</td><td class="text-right text-gray">Rp 0</td></tr>' : ''}
            <tr style="font-weight: 600;">
              <td style="padding-left: var(--spacing-xl);">Total Kewajiban Jangka Pendek</td>
              <td class="text-right">
                ${this.formatCurrency(balances.kewajiban.current.reduce((s, a) => s + a.balance, 0))}
              </td>
            </tr>
            
            <!-- Kewajiban Jangka Panjang -->
            <tr style="background: var(--bg-secondary);">
              <td colspan="2" style="font-weight: 600; padding-left: var(--spacing-xl);">
                Kewajiban Jangka Panjang
              </td>
            </tr>
            ${filterAccounts(balances.kewajiban.longTerm).map(acc => `
              <tr>
                <td style="padding-left: calc(var(--spacing-xl) * 2);">${acc.name}</td>
                <td class="text-right">${this.formatCurrency(acc.balance)}</td>
              </tr>
            `).join('')}
            ${filterAccounts(balances.kewajiban.longTerm).length === 0 ? '<tr><td style="padding-left: calc(var(--spacing-xl) * 2);" class="text-gray">-</td><td class="text-right text-gray">Rp 0</td></tr>' : ''}
            <tr style="font-weight: 600;">
              <td style="padding-left: var(--spacing-xl);">Total Kewajiban Jangka Panjang</td>
              <td class="text-right">
                ${this.formatCurrency(balances.kewajiban.longTerm.reduce((s, a) => s + a.balance, 0))}
              </td>
            </tr>
            
            <tr style="background: var(--bg-tertiary); font-weight: 700;">
              <td>TOTAL KEWAJIBAN</td>
              <td class="text-right">${this.formatCurrency(balances.kewajiban.total)}</td>
            </tr>
            
            <!-- Spacing -->
            <tr><td colspan="2" style="height: var(--spacing-md);"></td></tr>
            
            <!-- EKUITAS -->
            <tr style="background: var(--bg-tertiary);">
              <td colspan="2" style="font-weight: 700; font-size: var(--font-size-lg);">
                EKUITAS
              </td>
            </tr>
            ${filterAccounts(balances.ekuitas.items).map(acc => `
              <tr>
                <td style="padding-left: var(--spacing-xl);">${acc.name}</td>
                <td class="text-right">${this.formatCurrency(acc.balance)}</td>
              </tr>
            `).join('')}
            ${filterAccounts(balances.ekuitas.items).length === 0 ? '<tr><td style="padding-left: var(--spacing-xl);" class="text-gray">-</td><td class="text-right text-gray">Rp 0</td></tr>' : ''}
            <tr>
              <td style="padding-left: var(--spacing-xl);">Laba Berjalan (Current Year Earnings)</td>
              <td class="text-right">${this.formatCurrency(balances.netIncome)}</td>
            </tr>
            
            <tr style="background: var(--bg-tertiary); font-weight: 700;">
              <td>TOTAL EKUITAS</td>
              <td class="text-right">${this.formatCurrency(balances.ekuitas.total)}</td>
            </tr>
            
            <!-- TOTAL LIABILITIES + EQUITY -->
            <tr style="background: var(--color-primary); color: var(--color-white); font-weight: 700; font-size: var(--font-size-lg);">
              <td>TOTAL KEWAJIBAN + EKUITAS</td>
              <td class="text-right">${this.formatCurrency(totalLiabilitiesEquity)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      ${!isBalanced ? `
        <div class="alert alert-warning mt-2">
          ⚠️ Perhatian: Neraca tidak seimbang. Total Aset harus sama dengan Total Kewajiban + Ekuitas.
          Selisih: ${this.formatCurrency(balances.aset.total - totalLiabilitiesEquity)}
        </div>
      ` : `
        <div class="alert alert-success mt-2">
          ✓ Neraca seimbang (Total Aset = Total Kewajiban + Ekuitas)
        </div>
      `}
    `;
  },

  exportToPDF() {
    const balances = this.calculateBalances();
    const config = Storage.get(Storage.KEYS.CONFIG);
    const hideZero = this._hideZeroAccounts;

    // Filter zero-balance accounts if checkbox is checked
    const filterAccounts = (arr) => hideZero ? arr.filter(a => a.balance !== 0) : arr;

    // Transform balances to format PDFExporter expects
    const pdfData = {
      aset: filterAccounts([...balances.aset.current, ...balances.aset.nonCurrent]),
      kewajiban: filterAccounts([...balances.kewajiban.current, ...balances.kewajiban.longTerm]),
      ekuitas: filterAccounts(balances.ekuitas.items),
      totalAset: balances.aset.total,
      totalKewajiban: balances.kewajiban.total,
      totalEkuitas: balances.ekuitas.total,
      netIncome: balances.netIncome,
      hideZeroAccounts: hideZero,  // Pass flag so PDF can show note at bottom
    };

    // For Balance Sheet (Point in Time), we use the End Date as "As Of" date
    PDFExporter.exportBalanceSheet(pdfData, this._filterEndDate, config);
  },

  formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  },

  formatDate(date) {
    return new Date(date).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  },
};


// Explicitly make BalanceSheet globally available
window.BalanceSheet = BalanceSheet;
