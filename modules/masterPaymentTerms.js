// ==========================================
// Master Payment Terms Module
// Kelola data termin pembayaran dengan CRUD operations
// ==========================================

const MasterPaymentTerms = {
    terms: [],
    _editMode: false,
    _editingId: null,

    init() {
        this.loadTerms();
        this.render();
    },

    loadTerms() {
        this.terms = Storage.getPaymentTerms();
    },

    render() {
        const content = document.getElementById('main-content');
        content.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">📋 Master Termin Pembayaran</h1>
        <p class="page-description">Kelola data termin pembayaran untuk transaksi customer dan supplier</p>
      </div>

      <div class="card mb-3">
        <div class="card-header">
          <h2 class="card-title">${this._editMode ? 'Edit' : 'Tambah'} Termin Pembayaran</h2>
        </div>
        <div class="card-body">
          ${this.renderForm()}
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Daftar Termin Pembayaran</h2>
        </div>
        <div class="card-body">
          ${this.renderList()}
        </div>
      </div>
    `;
    },

    renderForm() {
        const term = this._editMode && this._editingId
            ? this.terms.find(t => t.id === this._editingId)
            : {};

        return `
      <form id="terms-form" onsubmit="MasterPaymentTerms.handleSubmit(event)">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label required">Kode</label>
            <input type="text" name="code" class="form-input" 
                   value="${term.code || ''}" 
                   placeholder="Contoh: NET30, COD, 2/10N30" required>
          </div>
          
          <div class="form-group">
            <label class="form-label required">Nama/Deskripsi</label>
            <input type="text" name="name" class="form-input" 
                   value="${term.name || ''}" 
                   placeholder="Contoh: Net 30 Days, Cash on Delivery" required>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label required">Jangka Waktu (Hari)</label>
            <input type="number" name="days" class="form-input" 
                   value="${term.days || 0}" 
                   placeholder="0" min="0" required>
            <small class="text-gray">0 = COD, 30 = Net 30 Days, dll</small>
          </div>

          <div class="form-group">
            <label class="form-label">Diskon Early Payment (%)</label>
            <input type="number" name="discountPercent" class="form-input" 
                   value="${term.discountPercent || 0}" 
                   placeholder="0" min="0" max="100" step="0.1">
            <small class="text-gray">Opsional, untuk insentif bayar cepat</small>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Diskon Berlaku Jika Bayar Dalam (Hari)</label>
            <input type="number" name="discountDays" class="form-input" 
                   value="${term.discountDays || 0}" 
                   placeholder="0" min="0">
            <small class="text-gray">Contoh: Diskon 2% jika bayar dalam 10 hari</small>
          </div>

          <div class="form-group">
            <label class="form-label">
              <input type="checkbox" name="active" ${term.active !== false ? 'checked' : ''}>
              Status Aktif
            </label>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Catatan</label>
          <textarea name="notes" class="form-textarea" rows="2" 
                    placeholder="Catatan atau syarat & ketentuan tambahan">${term.notes || ''}</textarea>
        </div>

        <div class="flex justify-between align-center">
          ${this._editMode ? `
            <button type="button" class="btn btn-secondary" onclick="MasterPaymentTerms.cancelEdit()">
              Batal Edit
            </button>
          ` : '<div></div>'}
          <button type="submit" class="btn btn-success">
            💾 ${this._editMode ? 'Update' : 'Simpan'} Termin
          </button>
        </div>
      </form>
    `;
    },

    renderList() {
        if (this.terms.length === 0) {
            return '<p class="text-center text-gray">Belum ada termin pembayaran. Tambahkan termin pertama Anda!</p>';
        }

        return `
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Kode</th>
              <th>Nama/Deskripsi</th>
              <th class="text-right">Jangka Waktu</th>
              <th class="text-right">Diskon</th>
              <th class="text-center">Status</th>
              <th class="text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${this.terms.map(term => `
              <tr>
                <td><span class="badge badge-primary">${term.code}</span></td>
                <td><strong>${term.name}</strong></td>
                <td class="text-right">${term.days} hari</td>
                <td class="text-right">
                  ${term.discountPercent > 0
                ? `${term.discountPercent}% / ${term.discountDays} hari`
                : '-'}
                </td>
                <td class="text-center">
                  ${term.active !== false ? '<span class="badge badge-success">Aktif</span>' : '<span class="badge badge-secondary">Nonaktif</span>'}
                </td>
                <td class="text-center">
                  <button class="btn btn-sm btn-primary" onclick="MasterPaymentTerms.editTerm('${term.id}')" title="Edit">
                    ✏️
                  </button>
                  <button class="btn btn-sm btn-danger" onclick="MasterPaymentTerms.confirmDelete('${term.id}')" title="Hapus">
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

        const termData = {
            code: formData.get('code'),
            name: formData.get('name'),
            days: parseInt(formData.get('days')),
            discountPercent: parseFloat(formData.get('discountPercent')) || 0,
            discountDays: parseInt(formData.get('discountDays')) || 0,
            active: formData.get('active') === 'on',
            notes: formData.get('notes'),
        };

        try {
            if (this._editMode && this._editingId) {
                const success = Storage.updatePaymentTerm(this._editingId, {
                    ...termData,
                    id: this._editingId,
                    updatedAt: new Date().toISOString(),
                });

                if (success) {
                    this.showAlert('success', 'Termin pembayaran berhasil diupdate!');
                    this.cancelEdit();
                } else {
                    this.showAlert('error', 'Termin tidak ditemukan');
                }
            } else {
                const newTerm = {
                    ...termData,
                    id: `TERM-${Date.now()}`,
                    createdAt: new Date().toISOString(),
                };

                Storage.addPaymentTerm(newTerm);
                this.showAlert('success', 'Termin pembayaran berhasil ditambahkan!');
                document.getElementById('terms-form').reset();
            }

            this.loadTerms();
            this.render();
        } catch (error) {
            this.showAlert('error', error.message);
        }
    },

    editTerm(id) {
        this._editMode = true;
        this._editingId = id;
        this.render();
        document.getElementById('terms-form').scrollIntoView({ behavior: 'smooth' });
    },

    cancelEdit() {
        this._editMode = false;
        this._editingId = null;
        this.render();
    },

    confirmDelete(id) {
        const term = this.terms.find(t => t.id === id);
        if (!term) return;

        if (confirm(`Hapus termin "${term.name}"?\n\nData yang sudah dihapus tidak dapat dikembalikan.`)) {
            Storage.deletePaymentTerm(id);
            this.loadTerms();
            this.render();
            this.showAlert('success', 'Termin pembayaran berhasil dihapus');
        }
    },

    showAlert(type, message) {
        if (typeof ChartOfAccounts !== 'undefined') {
            ChartOfAccounts.showAlert(type, message);
        } else {
            alert(message);
        }
    },
};


// Explicitly make MasterPaymentTerms globally available
window.MasterPaymentTerms = MasterPaymentTerms;
