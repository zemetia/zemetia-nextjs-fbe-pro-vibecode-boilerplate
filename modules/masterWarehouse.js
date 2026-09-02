// ==========================================
// Master Warehouse Module
// Kelola data warehouse dengan CRUD operations
// ==========================================

const MasterWarehouse = {
    warehouses: [],
    _editMode: false,
    _editingId: null,

    init() {
        this.loadWarehouses();
        this.render();
    },

    loadWarehouses() {
        this.warehouses = Storage.getWarehouses();
    },

    render() {
        const content = document.getElementById('main-content');
        content.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">🏪 Master Warehouse</h1>
        <p class="page-description">Kelola data warehouse untuk transaksi pembelian</p>
      </div>

      <div class="card mb-3">
        <div class="card-header">
          <h2 class="card-title">${this._editMode ? 'Edit' : 'Tambah'} Warehouse</h2>
        </div>
        <div class="card-body">
          ${this.renderForm()}
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Daftar Warehouse</h2>
          <div class="btn-group">
            <button class="btn btn-secondary" onclick="MasterWarehouse.exportToCSV()">
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
        const warehouse = this._editMode && this._editingId
            ? this.warehouses.find(s => s.id === this._editingId)
            : {};

        return `
      <form id="warehouse-form" onsubmit="MasterWarehouse.handleSubmit(event)">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label required">Kode Warehouse</label>
            <input type="text" name="code" class="form-input" 
                   value="${warehouse.code || ''}" 
                   placeholder="Contoh: WH-001" required>
          </div>
          
          <div class="form-group">
            <label class="form-label required">Nama Warehouse</label>
            <input type="text" name="name" class="form-input" 
                   value="${warehouse.name || ''}" 
                   placeholder="Contoh: PT. Emas Murni" required>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Lokasi</label>
            <input type="text" name="location" class="form-input" 
                   value="${warehouse.location || ''}" 
                   placeholder="Nama location person">
          </div>
          
          <div class="form-group">
            <label class="form-label">Kapasitas</label>
            <input type="text" name="capacity" class="form-input" 
                   value="${warehouse.capacity || ''}" 
                   placeholder="1000 kg">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Penanggung Jawab</label>
          <textarea name="manager" class="form-textarea" rows="2" 
                    placeholder="Penanggung Jawab lengkap warehouse">${warehouse.manager || ''}</textarea>
        </div>

        <div class="form-group">
          <label class="form-label">Catatan</label>
          <textarea name="notes" class="form-textarea" rows="2" 
                    placeholder="Catatan tambahan (opsional)">${warehouse.notes || ''}</textarea>
        </div>

        <div class="flex justify-between align-center">
          ${this._editMode ? `
            <button type="button" class="btn btn-secondary" onclick="MasterWarehouse.cancelEdit()">
              Batal Edit
            </button>
          ` : '<div></div>'}
          <button type="submit" class="btn btn-success">
            💾 ${this._editMode ? 'Update' : 'Simpan'} Warehouse
          </button>
        </div>
      </form>
    `;
    },

    renderList() {
        if (this.warehouses.length === 0) {
            return '<p class="text-center text-gray">Belum ada warehouse. Tambahkan warehouse pertama Anda!</p>';
        }

        return `
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Kode</th>
              <th>Nama Warehouse</th>
              <th>Contact</th>
              <th>Telepon</th>
              <th>Penanggung Jawab</th>
              <th class="text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${this.warehouses.map(warehouse => `
              <tr>
                <td><span class="badge badge-primary">${warehouse.code}</span></td>
                <td><strong>${warehouse.name}</strong></td>
                <td>${warehouse.location || '-'}</td>
                <td>${warehouse.capacity || '-'}</td>
                <td>${warehouse.manager || '-'}</td>
                <td class="text-center">
                  <button class="btn btn-sm btn-primary" onclick="MasterWarehouse.editWarehouse('${warehouse.id}')" title="Edit">
                    ✏️
                  </button>
                  <button class="btn btn-sm btn-danger" onclick="MasterWarehouse.confirmDelete('${warehouse.id}')" title="Hapus">
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

        const warehouseData = {
            code: formData.get('code'),
            name: formData.get('name'),
            location: formData.get('location'),
            capacity: formData.get('capacity'),
            manager: formData.get('manager'),
            notes: formData.get('notes'),
        };

        try {
            if (this._editMode && this._editingId) {
                // Update existing warehouse
                const success = Storage.updateWarehouse(this._editingId, {
                    ...warehouseData,
                    id: this._editingId,
                    updatedAt: new Date().toISOString(),
                });

                if (success) {
                    this.showAlert('success', 'Warehouse berhasil diupdate!');
                    this.cancelEdit();
                } else {
                    this.showAlert('error', 'Warehouse tidak ditemukan');
                }
            } else {
                // Create new warehouse
                const newWarehouse = {
                    ...warehouseData,
                    id: `WH-${Date.now()}`,
                    createdAt: new Date().toISOString(),
                };

                Storage.addWarehouse(newWarehouse);
                this.showAlert('success', 'Warehouse berhasil ditambahkan!');
                document.getElementById('warehouse-form').reset();
            }

            this.loadWarehouses();
            this.render();
        } catch (error) {
            this.showAlert('error', error.message);
        }
    },

    editWarehouse(id) {
        this._editMode = true;
        this._editingId = id;
        this.render();
        document.getElementById('warehouse-form').scrollIntoView({ behavior: 'smooth' });
    },

    cancelEdit() {
        this._editMode = false;
        this._editingId = null;
        this.render();
    },

    confirmDelete(id) {
        const warehouse = this.warehouses.find(s => s.id === id);
        if (!warehouse) return;

        if (confirm(`Hapus warehouse "${warehouse.name}"?\n\nData yang sudah dihapus tidak dapat dikembalikan.`)) {
            Storage.deleteWarehouse(id);
            this.loadWarehouses();
            this.render();
            this.showAlert('success', 'Warehouse berhasil dihapus');
        }
    },

    exportToCSV() {
        if (this.warehouses.length === 0) {
            alert('Tidak ada data untuk diexport');
            return;
        }

        const headers = ['Kode', 'Nama', 'Contact', 'Telepon', 'Penanggung Jawab', 'Catatan'];
        const rows = this.warehouses.map(s => [
            s.code,
            s.name,
            s.location || '',
            s.capacity || '',
            s.manager || '',
            s.notes || ''
        ]);

        let csv = headers.join(',') + '\n';
        rows.forEach(row => {
            csv += row.map(cell => `"${cell}"`).join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `warehouse-${new Date().toISOString().split('T')[0]}.csv`;
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


// Explicitly make MasterWarehouse globally available
window.MasterWarehouse = MasterWarehouse;
