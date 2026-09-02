// ==========================================
// Chart of Accounts Module
// Manajemen Kode Akun sesuai SAK
// ==========================================

const ChartOfAccounts = {
  accounts: [],

  init() {
    this.loadAccounts();
    this.render();
  },

  loadAccounts() {
    this.accounts = Storage.get(Storage.KEYS.CHART_OF_ACCOUNTS) || [];

    // Recalculate balances dynamically from Journal Entries (Source of Truth)
    const entries = Storage.get(Storage.KEYS.JOURNAL_ENTRIES) || [];
    const balances = {}; // Map code -> stored balance

    entries.forEach(entry => {
      entry.lines.forEach(line => {
        if (!balances[line.accountCode]) balances[line.accountCode] = 0;
        balances[line.accountCode] += (line.debit || 0) - (line.credit || 0);
      });
    });

    // Apply calculated balances to account objects
    this.accounts.forEach(acc => {
      const rawBalance = balances[acc.code] || 0;

      // Determine normal balance direction
      // Debit Normal: Asset (1), Expense (5)
      // Credit Normal: Liability (2), Equity (3), Revenue (4)
      const isDebitNormal = acc.category === 'aset' || acc.category === 'beban';

      if (isDebitNormal) {
        acc.balance = rawBalance;
      } else {
        acc.balance = -rawBalance; // Flip for credit normal accounts
      }

      // Auto-fix: remap akun dengan category 'other' yang kodenya dimulai dengan '6'
      // ke kategori 'diluar_usaha' (Pendapatan/Beban Di Luar Usaha)
      if (acc.category === 'other' && acc.code && acc.code[0] === '6') {
        acc.category = 'diluar_usaha';
      }
    });

    // Always sort by code after loading to ensure consistent UI
    this.accounts.sort((a, b) => a.code.localeCompare(b.code));

    // Filter accounts for refinery only profile
    const user = Auth.getCurrentUser();
    if (user?.reportProfile === 'refinery_only') {
      const refineryAccountPrefixes = ['412', '1172', '2112', '11301', '2142', '1163'];
      this.accounts = this.accounts.filter(acc => 
        refineryAccountPrefixes.some(prefix => acc.code.startsWith(prefix)) ||
        acc.name.toLowerCase().includes('refin') ||
        acc.name.toLowerCase().includes('jasa')
      );
    }
  },

  async saveAccounts() {
    await Storage.set(Storage.KEYS.CHART_OF_ACCOUNTS, this.accounts);
  },

  getAccount(code) {
    return this.accounts.find(acc => acc.code === code);
  },

  getDetailAccounts() {
    return this.accounts.filter(acc => acc.type === 'detail');
  },

  getAccountsByCategory(category) {
    return this.accounts.filter(acc => acc.category === category);
  },

  addAccount(accountData) {
    // Validate code
    if (!accountData.code || accountData.code.length < 4) {
      throw new Error('Kode akun harus minimal 4 digit');
    }

    // Check if code already exists
    if (this.getAccount(accountData.code)) {
      throw new Error('Kode akun sudah digunakan');
    }

    // Determine category from code
    const firstDigit = accountData.code[0];
    const categoryMap = {
      '1': 'aset',
      '2': 'kewajiban',
      '3': 'ekuitas',
      '4': 'pendapatan',
      '5': 'beban',
      '6': 'diluar_usaha',
    };

    const account = {
      code: accountData.code,
      name: accountData.name,
      type: accountData.type || 'detail',
      category: categoryMap[firstDigit] || 'other',
      balance: 0,
    };

    this.accounts.push(account);
    this.accounts.sort((a, b) => a.code.localeCompare(b.code));
    this.saveAccounts();
    return account;
  },

  updateAccount(code, updates) {
    const account = this.getAccount(code);
    if (!account) {
      throw new Error('Akun tidak ditemukan');
    }

    Object.assign(account, updates);
    this.saveAccounts();
    return account;
  },

  deleteAccount(code) {
    const index = this.accounts.findIndex(acc => acc.code === code);
    if (index === -1) {
      throw new Error('Akun tidak ditemukan');
    }

    // Check if account has transactions
    const hasTransactions = this.accountHasTransactions(code);
    if (hasTransactions) {
      throw new Error('Akun tidak dapat dihapus karena memiliki transaksi');
    }

    this.accounts.splice(index, 1);
    this.saveAccounts();
  },

  accountHasTransactions(code) {
    const entries = Storage.get(Storage.KEYS.JOURNAL_ENTRIES) || [];
    return entries.some(entry =>
      entry.lines.some(line => line.accountCode === code)
    );
  },

  updateBalance(code, amount, type) {
    const account = this.getAccount(code);
    if (!account) return;

    // Debit increases: Aset, Beban
    // Credit increases: Kewajiban, Ekuitas, Pendapatan
    const debitCategories = ['aset', 'beban'];
    const creditCategories = ['kewajiban', 'ekuitas', 'pendapatan'];

    if (type === 'debit') {
      if (debitCategories.includes(account.category)) {
        account.balance += amount;
      } else {
        account.balance -= amount;
      }
    } else if (type === 'credit') {
      if (creditCategories.includes(account.category)) {
        account.balance += amount;
      } else {
        account.balance -= amount;
      }
    }

    this.saveAccounts();
  },

  render() {
    const content = document.getElementById('main-content');
    content.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Kode Akun (Chart of Accounts)</h1>
        <p class="page-description">Daftar akun sesuai Standar Akuntansi Keuangan Indonesia</p>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Daftar Akun</h2>
          <div class="btn-group">
            <button class="btn btn-secondary" onclick="ChartOfAccounts.exportToPDF()">
              📄 Export PDF
            </button>
            <button class="btn btn-primary" onclick="ChartOfAccounts.showAddModal()">
              <span>➕</span> Tambah Akun
            </button>
          </div>
        </div>
        <div class="card-body">
          <div class="table-container">
            <table class="table" id="accounts-table">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Nama Akun</th>
                  <th>Tipe</th>
                  <th>Kategori</th>
                  <th class="text-right">Saldo</th>
                  <th class="text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                ${this.renderAccountRows()}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      ${this.renderAddModal()}
    `;
  },

  renderAccountRows() {
    // Get bank accounts to match with GL codes
    const bankAccounts = Storage.getBankAccounts();

    return this.accounts.map(account => {
      const isHeader = account.type === 'header';
      const rowClass = isHeader ? 'style="font-weight: 600; background: var(--bg-tertiary);"' : '';
      const balanceFormatted = this.formatCurrency(account.balance || 0);

      // Check if this is a bank GL account and find the matching bank account
      let displayName = account.name;
      if (account.code.startsWith('112') && !isHeader) {
        const bankAccount = bankAccounts.find(b => b.glAccount === account.code);
        if (bankAccount && bankAccount.accountNumber) {
          displayName = `${account.name} (${bankAccount.accountNumber})`;
        }
      }

      return `
        <tr ${rowClass}>
          <td>${account.code}</td>
          <td>${isHeader ? account.name.toUpperCase() : displayName}</td>
          <td>
            <span class="badge ${isHeader ? 'badge-primary' : 'badge-secondary'}">
              ${account.type === 'header' ? 'Header' : 'Detail'}
            </span>
          </td>
          <td>
            <span class="badge badge-success">
              ${account.category}
            </span>
          </td>
          <td class="text-right">${isHeader ? '-' : balanceFormatted}</td>
          <td class="text-center">
            ${!isHeader ? `
              <div class="btn-group">
                <button class="btn btn-sm btn-secondary" onclick="ChartOfAccounts.showEditModal('${account.code}')">
                  ✏️ Edit
                </button>
                <button class="btn btn-sm btn-danger" onclick="ChartOfAccounts.confirmDelete('${account.code}')">
                  🗑️
                </button>
              </div>
            ` : `<span style="color: var(--text-secondary); font-size: 0.85em;" title="Akun Header tidak dapat diedit/dihapus karena merupakan struktur organisasi COA">🔒 Terkunci</span>`}
          </td>
        </tr>
      `;
    }).join('');
  },

  renderAddModal() {
    return `
      <div id="add-account-modal" class="modal-overlay hidden">
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title">Tambah Akun Baru</h3>
            <button class="modal-close" onclick="ChartOfAccounts.closeModal()">&times;</button>
          </div>
          <div class="modal-body">
            <form id="add-account-form" onsubmit="ChartOfAccounts.handleSubmit(event)">
              <div class="form-group">
                <label class="form-label required">Kode Akun</label>
                <input type="text" name="code" class="form-input" placeholder="Contoh: 1110" required pattern="[0-9]{4,}" title="Minimal 4 digit angka">
                <small class="text-gray">Format: 1xxx (Aset), 2xxx (Kewajiban), 3xxx (Ekuitas), 4xxx (Pendapatan), 5xxx (Beban)</small>
              </div>
              
              <div class="form-group">
                <label class="form-label required">Nama Akun</label>
                <input type="text" name="name" class="form-input" placeholder="Contoh: Kas" required>
              </div>
              
              <div class="form-group">
                <label class="form-label required">Tipe Akun</label>
                <select name="type" class="form-select" required>
                  <option value="detail">Detail (Dapat dipakai untuk transaksi)</option>
                  <option value="header">Header (Hanya untuk grup)</option>
                </select>
              </div>
              
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onclick="ChartOfAccounts.closeModal()">
                  Batal
                </button>
                <button type="submit" class="btn btn-primary">
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div id="edit-account-modal" class="modal-overlay hidden">
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title">Edit Akun</h3>
            <button class="modal-close" onclick="ChartOfAccounts.closeEditModal()">&times;</button>
          </div>
          <div class="modal-body">
            <form id="edit-account-form" onsubmit="ChartOfAccounts.handleEditSubmit(event)">
              <input type="hidden" name="code" id="edit-code">
              
              <div class="form-group">
                <label class="form-label">Kode Akun</label>
                <input type="text" id="edit-code-display" class="form-input" disabled>
                <small class="text-gray">Kode akun tidak dapat diubah</small>
              </div>
              
              <div class="form-group">
                <label class="form-label required">Nama Akun</label>
                <input type="text" name="name" id="edit-name" class="form-input" required>
              </div>
              
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onclick="ChartOfAccounts.closeEditModal()">
                  Batal
                </button>
                <button type="submit" class="btn btn-primary">
                  Update
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
  },

  showAddModal() {
    document.getElementById('add-account-modal').classList.remove('hidden');
  },

  closeModal() {
    document.getElementById('add-account-modal').classList.add('hidden');
    document.getElementById('add-account-form').reset();
  },

  closeEditModal() {
    document.getElementById('edit-account-modal').classList.add('hidden');
    document.getElementById('edit-account-form').reset();
  },

  handleSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.target);

    try {
      this.addAccount({
        code: formData.get('code'),
        name: formData.get('name'),
        type: formData.get('type'),
      });

      this.closeModal();
      this.render();
      this.showAlert('success', 'Akun berhasil ditambahkan');
    } catch (error) {
      this.showAlert('error', error.message);
    }
  },

  confirmDelete(code) {
    const account = this.getAccount(code);
    if (confirm(`Hapus akun ${account.code} - ${account.name}?`)) {
      try {
        this.deleteAccount(code);
        this.render();
        this.showAlert('success', 'Akun berhasil dihapus');
      } catch (error) {
        this.showAlert('error', error.message);
      }
    }
  },

  showEditModal(code) {
    const account = this.getAccount(code);
    if (!account) return;

    // Populate form
    document.getElementById('edit-code').value = account.code;
    document.getElementById('edit-code-display').value = account.code;
    document.getElementById('edit-name').value = account.name;

    // Show modal
    document.getElementById('edit-account-modal').classList.remove('hidden');
  },

  handleEditSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.target);

    try {
      this.updateAccount(formData.get('code'), {
        name: formData.get('name')
      });

      this.closeEditModal();
      this.render();
      this.showAlert('success', 'Akun berhasil diupdate');
    } catch (error) {
      this.showAlert('error', error.message);
    }
  },

  showAlert(type, message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    alertDiv.style.position = 'fixed';
    alertDiv.style.top = '20px';
    alertDiv.style.right = '20px';
    alertDiv.style.zIndex = '9999';
    alertDiv.style.minWidth = '300px';

    document.body.appendChild(alertDiv);

    setTimeout(() => {
      alertDiv.style.opacity = '0';
      alertDiv.style.transition = 'opacity 0.3s';
      setTimeout(() => alertDiv.remove(), 300);
    }, 3000);
  },

  exportToPDF() {
    const config = Storage.get(Storage.KEYS.CONFIG);
    PDFExporter.exportChartOfAccounts(this.accounts, config);
  },

  formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  },
};


// Explicitly make ChartOfAccounts globally available
window.ChartOfAccounts = ChartOfAccounts;
