// ==========================================
// Master Bank Account Module
// Kelola data rekening bank dengan CRUD operations
// ==========================================

const MasterBank = {
  accounts: [],
  _editMode: false,
  _editingId: null,

  init() {
    this.loadAccounts();
    this.render();
  },

  loadAccounts() {
    this.accounts = Storage.getBankAccounts();
  },

  render() {
    const content = document.getElementById('main-content');
    content.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">🏦 Master Rekening Bank</h1>
        <p class="page-description">Kelola data rekening bank untuk transaksi keuangan</p>
      </div>

      <div class="card mb-3">
        <div class="card-header">
          <h2 class="card-title">${this._editMode ? 'Edit' : 'Tambah'} Rekening Bank</h2>
        </div>
        <div class="card-body">
          ${this.renderForm()}
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Daftar Rekening Bank</h2>
          <div class="btn-group">
            <button class="btn btn-secondary" onclick="MasterBank.exportToCSV()">
              📄 Export CSV
            </button>
          </div>
        </div>
        <div class="card-body">
          ${this.renderList()}
        </div>
      </div>
    `;
  },

  renderForm() {
    const account = this._editMode && this._editingId
      ? this.accounts.find(a => a.id === this._editingId)
      : {};

    // Get Chart of Accounts for GL Account dropdown
    const chartOfAccounts = Storage.getChartOfAccounts() || [];
    const bankAccounts = chartOfAccounts.filter(acc =>
      acc.type === 'detail' &&
      acc.category === 'aset' &&
      acc.code.startsWith('11')
    );

    return `
      <form id="bank-form" onsubmit="MasterBank.handleSubmit(event)">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label required">Nama Bank</label>
            <select name="bankName" class="form-select" required>
              <option value="">-- Pilih Bank --</option>
              <option value="BCA" ${account.bankName === 'BCA' ? 'selected' : ''}>BCA - Bank Central Asia</option>
              <option value="Mandiri" ${account.bankName === 'Mandiri' ? 'selected' : ''}>Bank Mandiri</option>
              <option value="BNI" ${account.bankName === 'BNI' ? 'selected' : ''}>BNI - Bank Negara Indonesia</option>
              <option value="BRI" ${account.bankName === 'BRI' ? 'selected' : ''}>BRI - Bank Rakyat Indonesia</option>
              <option value="BSI" ${account.bankName === 'BSI' ? 'selected' : ''}>Bank Syariah Indonesia (BSI)</option>
              <option value="CIMB" ${account.bankName === 'CIMB' ? 'selected' : ''}>CIMB Niaga</option>
              <option value="Permata" ${account.bankName === 'Permata' ? 'selected' : ''}>Bank Permata</option>
              <option value="Danamon" ${account.bankName === 'Danamon' ? 'selected' : ''}>Bank Danamon</option>
              <option value="BTN" ${account.bankName === 'BTN' ? 'selected' : ''}>BTN - Bank Tabungan Negara</option>
              <option value="OCBC" ${account.bankName === 'OCBC' ? 'selected' : ''}>OCBC NISP</option>
              <option value="Panin" ${account.bankName === 'Panin' ? 'selected' : ''}>Bank Panin</option>
              <option value="Other" ${account.bankName === 'Other' ? 'selected' : ''}>Bank Lainnya</option>
            </select>
          </div>
          
          <div class="form-group">
            <label class="form-label">Cabang/Branch</label>
            <input type="text" name="branch" class="form-input" 
                   value="${account.branch || ''}" 
                   placeholder="Contoh: Jakarta Pusat">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label required">Nomor Rekening</label>
            <input type="text" name="accountNumber" class="form-input" 
                   value="${account.accountNumber || ''}" 
                   placeholder="Contoh: 1234567890" required>
          </div>

          <div class="form-group">
            <label class="form-label required">Nama Pemilik Rekening</label>
            <input type="text" name="accountHolder" class="form-input" 
                   value="${account.accountHolder || ''}" 
                   placeholder="Contoh: PT. Contoh Indonesia" required>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label required">Mata Uang</label>
            <select name="currency" class="form-select" required>
              <option value="IDR" ${account.currency === 'IDR' || !account.currency ? 'selected' : ''}>IDR - Rupiah</option>
              <option value="USD" ${account.currency === 'USD' ? 'selected' : ''}>USD - US Dollar</option>
              <option value="SGD" ${account.currency === 'SGD' ? 'selected' : ''}>SGD - Singapore Dollar</option>
              <option value="EUR" ${account.currency === 'EUR' ? 'selected' : ''}>EUR - Euro</option>
              <option value="CNY" ${account.currency === 'CNY' ? 'selected' : ''}>CNY - Chinese Yuan</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Akun GL (Auto-Generated)</label>
            ${this._editMode && account.glAccount ? `
              <input type="text" class="form-input" value="${account.glAccount} - Bank ${account.bankName}" readonly disabled>
              <small class="text-gray">✓ GL Account sudah dibuat otomatis</small>
            ` : `
              <input type="text" class="form-input" value="Akan dibuat otomatis setelah simpan" readonly disabled>
              <small class="text-gray">💡 Sistem akan membuat GL Account baru di Chart of Accounts</small>
            `}
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">
            <input type="checkbox" name="active" ${account.active !== false ? 'checked' : ''}>
            Status Aktif
          </label>
        </div>

        <div class="form-group">
          <label class="form-label">Catatan</label>
          <textarea name="notes" class="form-textarea" rows="2" 
                    placeholder="Catatan tambahan (opsional)">${account.notes || ''}</textarea>
        </div>

        <div class="flex justify-between align-center">
          ${this._editMode ? `
            <button type="button" class="btn btn-secondary" onclick="MasterBank.cancelEdit()">
              Batal Edit
            </button>
          ` : '<div></div>'}
          <button type="submit" class="btn btn-success">
            💾 ${this._editMode ? 'Update' : 'Simpan'} Rekening
          </button>
        </div>
      </form>
    `;
  },

  renderList() {
    if (this.accounts.length === 0) {
      return '<p class="text-center text-gray">Belum ada rekening bank. Tambahkan rekening pertama Anda!</p>';
    }

    return `
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Bank</th>
              <th>Cabang</th>
              <th>No. Rekening</th>
              <th>GL Account</th>
              <th>Pemilik Rekening</th>
              <th>Mata Uang</th>
              <th class="text-center">Status</th>
              <th class="text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${this.accounts.map(acc => `
              <tr>
                <td><strong>${acc.bankName}</strong></td>
                <td>${acc.branch || '-'}</td>
                <td><span class="badge badge-primary">${acc.accountNumber}</span></td>
                <td><code>${acc.glAccount || '-'}</code></td>
                <td>${acc.accountHolder}</td>
                <td>${acc.currency}</td>
                <td class="text-center">
                  ${acc.active !== false ? '<span class="badge badge-success">Aktif</span>' : '<span class="badge badge-secondary">Nonaktif</span>'}
                </td>
                <td class="text-center">
                  <button class="btn btn-sm btn-primary" onclick="MasterBank.editAccount('${acc.id}')" title="Edit">
                    ✏️
                  </button>
                  <button class="btn btn-sm btn-danger" onclick="MasterBank.confirmDelete('${acc.id}')" title="Hapus">
                    🗑️
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  handleSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.target);

    const accountData = {
      bankName: formData.get('bankName'),
      branch: formData.get('branch'),
      accountNumber: formData.get('accountNumber'),
      accountHolder: formData.get('accountHolder'),
      currency: formData.get('currency'),
      active: formData.get('active') === 'on',
      notes: formData.get('notes'),
    };

    try {
      if (this._editMode && this._editingId) {
        // EDIT MODE: Keep existing GL account
        const existingAccount = this.accounts.find(a => a.id === this._editingId);

        const success = Storage.updateBankAccount(this._editingId, {
          ...accountData,
          id: this._editingId,
          glAccount: existingAccount.glAccount, // Preserve existing GL
          updatedAt: new Date().toISOString(),
        });

        if (success) {
          // Sync GL Account name if bank name changed
          if (existingAccount.bankName !== accountData.bankName && existingAccount.glAccount) {
            Storage.updateBankGLAccount(existingAccount.glAccount, accountData.bankName);
          }
          this.showAlert('success', 'Rekening bank berhasil diupdate!');
          this.cancelEdit();
        } else {
          this.showAlert('error', 'Rekening tidak ditemukan');
        }
      } else {
        // CREATE MODE: Auto-create GL account
        const glCode = Storage.createBankGLAccount(accountData.bankName);

        const newAccount = {
          ...accountData,
          id: `BANK-${Date.now()}`,
          glAccount: glCode, // Assign auto-generated GL code
          createdAt: new Date().toISOString(),
        };

        Storage.addBankAccount(newAccount);
        this.showAlert('success', `Rekening bank berhasil ditambahkan! GL Account: ${glCode} - Bank ${accountData.bankName}`);
        document.getElementById('bank-form').reset();
      }

      this.loadAccounts();
      this.render();
    } catch (error) {
      this.showAlert('error', error.message);
    }
  },

  editAccount(id) {
    this._editMode = true;
    this._editingId = id;
    this.render();
    document.getElementById('bank-form').scrollIntoView({ behavior: 'smooth' });
  },

  cancelEdit() {
    this._editMode = false;
    this._editingId = null;
    this.render();
  },

  async confirmDelete(id) {
    const account = this.accounts.find(a => a.id === id);
    if (!account) return;

    const confirmMsg = `Hapus rekening "${account.bankName} - ${account.accountNumber}"?\n\n` +
      `GL Account ${account.glAccount} juga akan dihapus dari Chart of Accounts.\n\n` +
      `Data yang sudah dihapus tidak dapat dikembalikan.`;

    if (confirm(confirmMsg)) {
      // Delete bank account
      await Storage.deleteBankAccount(id);

      // Try to delete GL account (will fail if has non-zero balance)
      if (account.glAccount) {
        const glDeleted = await Storage.deleteBankGLAccount(account.glAccount);
        if (!glDeleted) {
          this.showAlert('warning', `Rekening bank dihapus, tapi GL Account ${account.glAccount} tidak bisa dihapus (mungkin memiliki saldo)`);
        } else {
          this.showAlert('success', `Rekening bank dan GL Account ${account.glAccount} berhasil dihapus`);
        }
      } else {
        this.showAlert('success', 'Rekening bank berhasil dihapus');
      }

      this.loadAccounts();
      this.render();
    }
  },

  exportToCSV() {
    if (this.accounts.length === 0) {
      alert('Tidak ada data untuk diexport');
      return;
    }

    const headers = ['Bank', 'Cabang', 'No. Rekening', 'Pemilik', 'Mata Uang', 'GL Account', 'Status', 'Catatan'];
    const rows = this.accounts.map(a => [
      a.bankName,
      a.branch || '',
      a.accountNumber,
      a.accountHolder,
      a.currency,
      a.glAccount || '',
      a.active !== false ? 'Aktif' : 'Nonaktif',
      a.notes || ''
    ]);

    let csv = headers.join(',') + '\n';
    rows.forEach(row => {
      csv += row.map(cell => `"${cell}"`).join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bank-accounts-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },

  showAlert(type, message) {
    if (typeof ChartOfAccounts !== 'undefined') {
      ChartOfAccounts.showAlert(type, message);
    } else {
      alert(message);
    }
  },
};


// Explicitly make MasterBank globally available
window.MasterBank = MasterBank;
