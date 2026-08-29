// ==========================================
// Master Tax Module
// Kelola data pajak dengan CRUD operations
// ==========================================

const MasterTax = {
    taxes: [],
    _editMode: false,
    _editingId: null,

    init() {
        this.loadTaxes();
        this.render();
    },

    loadTaxes() {
        this.taxes = Storage.getTaxes();
    },

    render() {
        const content = document.getElementById('main-content');
        content.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">🧾 Master Pajak</h1>
        <p class="page-description">Kelola data pajak untuk transaksi dan kepatuhan perpajakan Indonesia</p>
      </div>

      <div class="card mb-3">
        <div class="card-header">
          <h2 class="card-title">${this._editMode ? 'Edit' : 'Tambah'} Pajak</h2>
        </div>
        <div class="card-body">
          ${this.renderForm()}
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Daftar Pajak</h2>
        </div>
        <div class="card-body">
          ${this.renderList()}
        </div>
      </div>
    `;
    },

    renderForm() {
        const tax = this._editMode && this._editingId
            ? this.taxes.find(t => t.id === this._editingId)
            : {};

        return `
      <form id="tax-form" onsubmit="MasterTax.handleSubmit(event)">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label required">Kode Pajak</label>
            <input type="text" name="code" class="form-input" 
                   value="${tax.code || ''}" 
                   placeholder="Contoh: PPN" required>
          </div>
          
          <div class="form-group">
            <label class="form-label required">Nama Pajak</label>
            <input type="text" name="name" class="form-input" 
                   value="${tax.name || ''}" 
                   placeholder="Contoh: Pajak Pertambahan Nilai" required>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label required">Tipe Pajak</label>
            <select name="type" class="form-select" required>
              <option value="">-- Pilih Tipe --</option>
              <option value="VAT" ${tax.type === 'VAT' ? 'selected' : ''}>PPN (VAT)</option>
              <option value="WHT_21" ${tax.type === 'WHT_21' ? 'selected' : ''}>PPh 21 (Withholding)</option>
              <option value="WHT_23" ${tax.type === 'WHT_23' ? 'selected' : ''}>PPh 23 (Withholding)</option>
              <option value="WHT_4_2" ${tax.type === 'WHT_4_2' ? 'selected' : ''}>PPh 4(2) (Withholding)</option>
              <option value="WHT_26" ${tax.type === 'WHT_26' ? 'selected' : ''}>PPh 26 (Withholding)</option>
              <option value="SALES" ${tax.type === 'SALES' ? 'selected' : ''}>Sales Tax</option>
              <option value="OTHER" ${tax.type === 'OTHER' ? 'selected' : ''}>Lainnya</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label required">Tarif Pajak (%)</label>
            <input type="number" name="rate" class="form-input" 
                   value="${tax.rate || 0}" 
                   placeholder="11" min="0" max="100" step="0.01" required>
            <small class="text-gray">Contoh: 11 untuk PPN 11%</small>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Akun GL - Pajak Dibayar Dimuka</label>
            <input type="text" name="glAccountPayable" class="form-input" 
                   value="${tax.glAccountPayable || ''}" 
                   placeholder="Contoh: 2130">
            <small class="text-gray">Kode akun untuk hutang pajak</small>
          </div>

          <div class="form-group">
            <label class="form-label">Akun GL - Pajak Masukan</label>
            <input type="text" name="glAccountReceivable" class="form-input" 
                   value="${tax.glAccountReceivable || ''}" 
                   placeholder="Contoh: 1140">
            <small class="text-gray">Kode akun untuk piutang pajak</small>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">
            <input type="checkbox" name="active" ${tax.active !== false ? 'checked' : ''}>
            Status Aktif
          </label>
        </div>

        <div class="form-group">
          <label class="form-label">Deskripsi</label>
          <textarea name="description" class="form-textarea" rows="2" 
                    placeholder="Deskripsi atau catatan tambahan">${tax.description || ''}</textarea>
        </div>

        <div class="flex justify-between align-center">
          ${this._editMode ? `
            <button type="button" class="btn btn-secondary" onclick="MasterTax.cancelEdit()">
              Batal Edit
            </button>
          ` : '<div></div>'}
          <button type="submit" class="btn btn-success">
            💾 ${this._editMode ? 'Update' : 'Simpan'} Pajak
          </button>
        </div>
      </form>
    `;
    },

    renderList() {
        if (this.taxes.length === 0) {
            return '<p class="text-center text-gray">Belum ada pajak. Tambahkan pajak pertama Anda!</p>';
        }

        return `
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Kode</th>
              <th>Nama Pajak</th>
              <th>Tipe</th>
              <th class="text-right">Tarif (%)</th>
              <th class="text-center">Status</th>
              <th class="text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${this.taxes.map(tax => `
              <tr>
                <td><span class="badge badge-primary">${tax.code}</span></td>
                <td><strong>${tax.name}</strong></td>
                <td>${tax.type}</td>
                <td class="text-right">${tax.rate}%</td>
                <td class="text-center">
                  ${tax.active !== false ? '<span class="badge badge-success">Aktif</span>' : '<span class="badge badge-secondary">Nonaktif</span>'}
                </td>
                <td class="text-center">
                  <button class="btn btn-sm btn-primary" onclick="MasterTax.editTax('${tax.id}')" title="Edit">
                    ✏️
                  </button>
                  <button class="btn btn-sm btn-danger" onclick="MasterTax.confirmDelete('${tax.id}')" title="Hapus">
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

        const taxData = {
            code: formData.get('code'),
            name: formData.get('name'),
            type: formData.get('type'),
            rate: parseFloat(formData.get('rate')),
            glAccountPayable: formData.get('glAccountPayable'),
            glAccountReceivable: formData.get('glAccountReceivable'),
            active: formData.get('active') === 'on',
            description: formData.get('description'),
        };

        try {
            if (this._editMode && this._editingId) {
                const success = Storage.updateTax(this._editingId, {
                    ...taxData,
                    id: this._editingId,
                    updatedAt: new Date().toISOString(),
                });

                if (success) {
                    this.showAlert('success', 'Pajak berhasil diupdate!');
                    this.cancelEdit();
                } else {
                    this.showAlert('error', 'Pajak tidak ditemukan');
                }
            } else {
                const newTax = {
                    ...taxData,
                    id: `TAX-${Date.now()}`,
                    createdAt: new Date().toISOString(),
                };

                Storage.addTax(newTax);
                this.showAlert('success', 'Pajak berhasil ditambahkan!');
                document.getElementById('tax-form').reset();
            }

            this.loadTaxes();
            this.render();
        } catch (error) {
            this.showAlert('error', error.message);
        }
    },

    editTax(id) {
        this._editMode = true;
        this._editingId = id;
        this.render();
        document.getElementById('tax-form').scrollIntoView({ behavior: 'smooth' });
    },

    cancelEdit() {
        this._editMode = false;
        this._editingId = null;
        this.render();
    },

    confirmDelete(id) {
        const tax = this.taxes.find(t => t.id === id);
        if (!tax) return;

        if (confirm(`Hapus pajak "${tax.name}"?\n\nData yang sudah dihapus tidak dapat dikembalikan.`)) {
            Storage.deleteTax(id);
            this.loadTaxes();
            this.render();
            this.showAlert('success', 'Pajak berhasil dihapus');
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


// Explicitly make MasterTax globally available
window.MasterTax = MasterTax;
