// ==========================================
// General Ledger Module
// Buku Besar untuk melihat transaksi per akun
// ==========================================

const GeneralLedger = {
  init() {
    this.render();
  },

  getTransactionsByAccount(accountCode, startDate = null, endDate = null) {
    const entries = Storage.get(Storage.KEYS.JOURNAL_ENTRIES) || [];
    const transactions = [];

    entries.forEach(entry => {
      // Filter by date if provided
      if (startDate && entry.date < startDate) return;
      if (endDate && entry.date > endDate) return;

      entry.lines.forEach(line => {
        if (line.accountCode === accountCode) {
          transactions.push({
            date: entry.date,
            reference: entry.reference,
            description: entry.description,
            lineDescription: line.description,
            debit: line.debit,
            credit: line.credit,
            entryId: entry.id,
          });
        }
      });
    });

    // Sort by date
    transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate running balance
    const account = ChartOfAccounts.getAccount(accountCode);
    const debitCategories = ['aset', 'beban'];
    const isDebitAccount = debitCategories.includes(account?.category);

    let balance = 0;
    transactions.forEach(txn => {
      if (isDebitAccount) {
        balance += txn.debit - txn.credit;
      } else {
        balance += txn.credit - txn.debit;
      }
      txn.balance = balance;
    });

    return transactions;
  },

  render() {
    const content = document.getElementById('main-content');
    content.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Buku Besar (General Ledger)</h1>
        <p class="page-description">Rincian transaksi per akun dengan saldo berjalan</p>
      </div>

      <div class="card mb-3">
        <div class="card-body">
          ${this.renderFilters()}
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title" id="ledger-title">Pilih Akun</h2>
        </div>
        <div class="card-body">
          <div id="ledger-content">
            <p class="text-center text-gray">Pilih akun untuk melihat transaksi</p>
          </div>
        </div>
      </div>
    `;
  },

  renderFilters() {
    const accounts = ChartOfAccounts.getDetailAccounts();
    const today = new Date().toISOString().split('T')[0];
    const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    return `
      <form id="ledger-filter-form" onsubmit="GeneralLedger.applyFilters(event)">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label required">Akun</label>
            <select name="accountCode" class="form-select" required onchange="GeneralLedger.applyFilters(event)">
              <option value="">Pilih Akun...</option>
              ${accounts.map(acc => `
                <option value="${acc.code}">${acc.code} - ${acc.name}</option>
              `).join('')}
            </select>
          </div>
          
          <div class="form-group">
            <label class="form-label">Dari Tanggal</label>
            <input type="date" name="startDate" class="form-input" value="${firstDayOfMonth}" onchange="GeneralLedger.applyFilters(event)">
          </div>
          
          <div class="form-group">
            <label class="form-label">Sampai Tanggal</label>
            <input type="date" name="endDate" class="form-input" value="${today}" onchange="GeneralLedger.applyFilters(event)">
          </div>

          <div class="form-group" style="display: flex; align-items: flex-end; padding-bottom: 8px;">
            <label class="form-label" style="display: flex; align-items: center; gap: 8px; cursor: pointer; margin-bottom: 0;">
              <input type="checkbox" id="hide-print-date" onchange="GeneralLedger.applyFilters(event)">
              Sembunyikan Tanggal Cetak
            </label>
          </div>
        </div>

        <div class="mt-3">
            <label class="form-label">Cetak Banyak (Bulk):</label>
            <div id="bulk-account-selection" style="max-height: 150px; overflow-y: auto; border: 1px solid var(--border-color); padding: 10px; border-radius: 4px; background: var(--bg-secondary);">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">
                    <input type="checkbox" onchange="GeneralLedger.toggleAllBulk(this)"> Pilih Semua Akun
                </label>
                ${accounts.map(acc => `
                    <label style="display: block; margin-bottom: 3px; font-weight: normal; cursor: pointer;">
                        <input type="checkbox" class="bulk-acc-checkbox" value="${acc.code}" data-name="${acc.name}"> ${acc.code} - ${acc.name}
                    </label>
                `).join('')}
            </div>
        </div>
      </form>
    `;
  },

  applyFilters(event) {
    if (event) event.preventDefault();

    const form = document.getElementById('ledger-filter-form');
    const formData = new FormData(form);
    const accountCode = formData.get('accountCode');

    if (!accountCode) return;

    const startDate = formData.get('startDate');
    const endDate = formData.get('endDate');

    this.showLedger(accountCode, startDate, endDate);
  },

  showLedger(accountCode, startDate, endDate) {
    const account = ChartOfAccounts.getAccount(accountCode);
    if (!account) return;

    const transactions = this.getTransactionsByAccount(accountCode, startDate, endDate);

    // Store current state for PDF export
    this._currentAccountCode = accountCode;
    this._currentAccountName = account.name;
    this._currentTransactions = transactions;
    this._currentStartDate = startDate;
    this._currentEndDate = endDate;

    const titleHtml = `
            Buku Besar: ${account.code} - ${account.name}
            <div style="float: right; display: flex; gap: 8px;">
                <button class="btn btn-secondary" onclick="GeneralLedger.exportBulk()">
                    📄 Cetak Terpilih (Bulk)
                </button>
                <button class="btn btn-primary" onclick="GeneralLedger.exportToPDF()">
                    📄 Export PDF
                </button>
            </div>
        `;
    document.getElementById('ledger-title').innerHTML = titleHtml;

    const content = document.getElementById('ledger-content');

    if (transactions.length === 0) {
      content.innerHTML = '<p class="text-center text-gray">Tidak ada transaksi dalam periode ini</p>';
      return;
    }

    content.innerHTML = `
      <div class="mb-2">
        <div class="flex justify-between align-center">
          <div>
            <div class="text-gray">Kategori: <span class="badge badge-success">${account.category}</span></div>
          </div>
          <div class="text-right">
            <div class="text-gray">Saldo Akhir:</div>
            <div class="text-xl" style="font-size: var(--font-size-2xl); font-weight: 700;">
              ${this.formatCurrency(transactions[transactions.length - 1].balance)}
            </div>
          </div>
        </div>
      </div>

      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Ref</th>
              <th>Keterangan</th>
              <th class="text-right">Debit (Rp)</th>
              <th class="text-right">Kredit (Rp)</th>
              <th class="text-right">Saldo (Rp)</th>
            </tr>
          </thead>
          <tbody>
            ${transactions.map(txn => `
              <tr>
                <td>${this.formatDate(txn.date)}</td>
                <td>${txn.reference || '-'}</td>
                <td>
                  ${txn.description}
                  ${txn.lineDescription ? `<br><small class="text-gray">${txn.lineDescription}</small>` : ''}
                </td>
                <td class="text-right">${txn.debit > 0 ? this.formatCurrency(txn.debit) : '-'}</td>
                <td class="text-right">${txn.credit > 0 ? this.formatCurrency(txn.credit) : '-'}</td>
                <td class="text-right" style="font-weight: 600;">
                  ${this.formatCurrency(txn.balance)}
                </td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="background: var(--bg-tertiary); font-weight: 700;">
              <td colspan="3" class="text-right">TOTAL:</td>
              <td class="text-right">
                ${this.formatCurrency(transactions.reduce((sum, t) => sum + t.debit, 0))}
              </td>
              <td class="text-right">
                ${this.formatCurrency(transactions.reduce((sum, t) => sum + t.credit, 0))}
              </td>
              <td class="text-right">
                ${this.formatCurrency(transactions[transactions.length - 1].balance)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
  },

  exportToPDF() {
    if (!this._currentTransactions || this._currentTransactions.length === 0) {
      alert('Tidak ada data untuk diekspor. Pilih akun terlebih dahulu.');
      return;
    }

    const config = Storage.get(Storage.KEYS.CONFIG);
    const hidePrintDate = document.getElementById('hide-print-date')?.checked || false;

    PDFExporter.exportGeneralLedger(
      this._currentAccountCode,
      this._currentAccountName,
      this._currentTransactions,
      this._currentStartDate,
      this._currentEndDate,
      config,
      { hidePrintDate }
    );
  },

  exportBulk() {
    const selectedCheckboxes = document.querySelectorAll('.bulk-acc-checkbox:checked');
    if (selectedCheckboxes.length === 0) {
      alert('Pilih setidaknya satu akun dari daftar checklist untuk cetak bulk.');
      return;
    }

    const form = document.getElementById('ledger-filter-form');
    const formData = new FormData(form);
    const startDate = formData.get('startDate');
    const endDate = formData.get('endDate');
    const hidePrintDate = document.getElementById('hide-print-date')?.checked || false;

    const bulkData = Array.from(selectedCheckboxes).map(cb => {
      const accountCode = cb.value;
      const accountName = cb.getAttribute('data-name');
      const transactions = this.getTransactionsByAccount(accountCode, startDate, endDate);
      return { accountCode, accountName, transactions };
    }).filter(d => d.transactions.length > 0);

    if (bulkData.length === 0) {
      alert('Tidak ada transaksi untuk akun-akun yang dipilih dalam periode ini.');
      return;
    }

    const config = Storage.get(Storage.KEYS.CONFIG);
    PDFExporter.exportGeneralLedgerBulk(
      bulkData,
      startDate,
      endDate,
      config,
      { hidePrintDate }
    );
  },

  toggleAllBulk(masterCheckbox) {
    const checkboxes = document.querySelectorAll('.bulk-acc-checkbox');
    checkboxes.forEach(cb => {
      cb.checked = masterCheckbox.checked;
    });
  },

  formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  },

  formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const d = date.getDate();
    const m = months[date.getMonth()];
    const y = date.getFullYear();
    return `${d} ${m} ${y}`;
  },
};


// Explicitly make GeneralLedger globally available
window.GeneralLedger = GeneralLedger;
