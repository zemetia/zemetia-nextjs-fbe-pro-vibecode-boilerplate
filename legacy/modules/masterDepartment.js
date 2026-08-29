// ==========================================
// Master Department Module
// Kelola data departemen dengan CRUD operations
// ==========================================

const MasterDepartment = {
    departments: [],
    _editMode: false,
    _editingId: null,

    init() {
        this.loadDepartments();
        this.checkAndSeedSecurity();
        this.render();
    },

    async checkAndSeedSecurity() {
        const existing = this.departments.find(d => d.code === 'SEC');
        if (!existing) {
            const newDept = {
                id: `DEPT-${Date.now()}`,
                code: 'SEC',
                name: 'Security',
                manager: '',
                budget: 0,
                active: true,
                description: 'Departemen Keamanan / Security',
                createdAt: new Date().toISOString()
            };
            Storage.addDepartment(newDept);
            this.loadDepartments();
        }
    },

    // ─── Quick Seed: tambah dept OB Cleaning Service ────────────
    async seedOBDepartment() {
        this.loadDepartments();
        const existing = this.departments.find(d => d.code === 'OB');
        if (existing) {
            if (window.showToast) window.showToast('⚠️ Departemen dengan kode OB sudah ada.', 'warning');
            else alert('Departemen dengan kode OB sudah ada.');
            return;
        }
        const newDept = {
            id: `DEPT-${Date.now()}`,
            code: 'OB',
            name: 'Cleaning Service',
            manager: '',
            budget: 0,
            active: true,
            description: 'Office Boy / Cleaning Service',
            createdAt: new Date().toISOString()
        };
        Storage.addDepartment(newDept);
        this.loadDepartments();
        this.render();
        if (window.showToast) window.showToast('✅ Departemen Cleaning Service (OB) berhasil ditambahkan!', 'success');
        else alert('✅ Departemen Cleaning Service (OB) berhasil ditambahkan!');
    },


    loadDepartments() {
        this.departments = Storage.getDepartments();
    },

    render() {
        const content = document.getElementById('main-content');
        content.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">🏗️ Master Departemen</h1>
        <p class="page-description">Kelola data departemen untuk cost tracking dan reporting</p>
      </div>

      <div class="card mb-3">
        <div class="card-header">
          <h2 class="card-title">${this._editMode ? 'Edit' : 'Tambah'} Departemen</h2>
        </div>
        <div class="card-body">
          ${this.renderForm()}
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Daftar Departemen</h2>
          <div class="btn-group">
            <button class="btn btn-secondary" onclick="MasterDepartment.exportToCSV()">
              📄 Export CSV
            </button>
            <button class="btn btn-secondary" onclick="MasterDepartment.seedOBDepartment()"
                    title="Tambah otomatis Departemen Cleaning Service (kode: OB)"
                    style="background:linear-gradient(135deg,#059669,#047857);color:#fff;border-color:transparent;">
              🧹 Quick Add: Dept OB
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
        const dept = this._editMode && this._editingId
            ? this.departments.find(d => d.id === this._editingId)
            : {};

        return `
      <form id="dept-form" onsubmit="MasterDepartment.handleSubmit(event)">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label required">Kode Departemen</label>
            <input type="text" name="code" class="form-input" 
                   value="${dept.code || ''}" 
                   placeholder="Contoh: PROD, ADMIN, SALES" required>
          </div>
          
          <div class="form-group">
            <label class="form-label required">Nama Departemen</label>
            <input type="text" name="name" class="form-input" 
                   value="${dept.name || ''}" 
                   placeholder="Contoh: Production, Administration" required>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Kepala Departemen/Manager</label>
            <input type="text" name="manager" class="form-input" 
                   value="${dept.manager || ''}" 
                   placeholder="Nama manager/kepala departemen">
          </div>

          <div class="form-group">
            <label class="form-label">Budget Allocation</label>
            <input type="number" name="budget" class="form-input" 
                   value="${dept.budget || 0}" 
                   placeholder="0" min="0" step="1000000">
            <small class="text-gray">Budget alokasi per tahun (opsional)</small>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">
            <input type="checkbox" name="active" ${dept.active !== false ? 'checked' : ''}>
            Status Aktif
          </label>
        </div>

        <div class="form-group">
          <label class="form-label">Deskripsi</label>
          <textarea name="description" class="form-textarea" rows="3" 
                    placeholder="Deskripsi fungsi atau tanggung jawab departemen">${dept.description || ''}</textarea>
        </div>

        <div class="flex justify-between align-center">
          ${this._editMode ? `
            <button type="button" class="btn btn-secondary" onclick="MasterDepartment.cancelEdit()">
              Batal Edit
            </button>
          ` : '<div></div>'}
          <button type="submit" class="btn btn-success">
            💾 ${this._editMode ? 'Update' : 'Simpan'} Departemen
          </button>
        </div>
      </form>
    `;
    },

    renderList() {
        if (this.departments.length === 0) {
            return '<p class="text-center text-gray">Belum ada departemen. Tambahkan departemen pertama Anda!</p>';
        }

        return `
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Kode</th>
              <th>Nama Departemen</th>
              <th>Manager</th>
              <th class="text-right">Budget Allocation</th>
              <th class="text-center">Status</th>
              <th class="text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${this.departments.map(dept => `
              <tr>
                <td><span class="badge badge-primary">${dept.code}</span></td>
                <td><strong>${dept.name}</strong></td>
                <td>${dept.manager || '-'}</td>
                <td class="text-right">${dept.budget > 0 ? this.formatCurrency(dept.budget) : '-'}</td>
                <td class="text-center">
                  ${dept.active !== false ? '<span class="badge badge-success">Aktif</span>' : '<span class="badge badge-secondary">Nonaktif</span>'}
                </td>
                <td class="text-center">
                  <button class="btn btn-sm btn-primary" onclick="MasterDepartment.editDepartment('${dept.id}')" title="Edit">
                    ✏️
                  </button>
                  <button class="btn btn-sm btn-danger" onclick="MasterDepartment.confirmDelete('${dept.id}')" title="Hapus">
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

        const deptData = {
            code: formData.get('code'),
            name: formData.get('name'),
            manager: formData.get('manager'),
            budget: parseFloat(formData.get('budget')) || 0,
            active: formData.get('active') === 'on',
            description: formData.get('description'),
        };

        try {
            if (this._editMode && this._editingId) {
                const success = Storage.updateDepartment(this._editingId, {
                    ...deptData,
                    id: this._editingId,
                    updatedAt: new Date().toISOString(),
                });

                if (success) {
                    this.showAlert('success', 'Departemen berhasil diupdate!');
                    this.cancelEdit();
                } else {
                    this.showAlert('error', 'Departemen tidak ditemukan');
                }
            } else {
                const newDept = {
                    ...deptData,
                    id: `DEPT-${Date.now()}`,
                    createdAt: new Date().toISOString(),
                };

                Storage.addDepartment(newDept);
                this.showAlert('success', 'Departemen berhasil ditambahkan!');
                document.getElementById('dept-form').reset();
            }

            this.loadDepartments();
            this.render();
        } catch (error) {
            this.showAlert('error', error.message);
        }
    },

    editDepartment(id) {
        this._editMode = true;
        this._editingId = id;
        this.render();
        document.getElementById('dept-form').scrollIntoView({ behavior: 'smooth' });
    },

    cancelEdit() {
        this._editMode = false;
        this._editingId = null;
        this.render();
    },

    confirmDelete(id) {
        const dept = this.departments.find(d => d.id === id);
        if (!dept) return;

        if (confirm(`Hapus departemen "${dept.name}"?\n\nData yang sudah dihapus tidak dapat dikembalikan.`)) {
            Storage.deleteDepartment(id);
            this.loadDepartments();
            this.render();
            this.showAlert('success', 'Departemen berhasil dihapus');
        }
    },

    exportToCSV() {
        if (this.departments.length === 0) {
            alert('Tidak ada data untuk diexport');
            return;
        }

        const headers = ['Kode', 'Nama', 'Manager', 'Budget', 'Status', 'Deskripsi'];
        const rows = this.departments.map(d => [
            d.code,
            d.name,
            d.manager || '',
            d.budget || 0,
            d.active !== false ? 'Aktif' : 'Nonaktif',
            d.description || ''
        ]);

        let csv = headers.join(',') + '\n';
        rows.forEach(row => {
            csv += row.map(cell => `"${cell}"`).join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `departments-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    },

    formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    },

    showAlert(type, message) {
        if (typeof ChartOfAccounts !== 'undefined') {
            ChartOfAccounts.showAlert(type, message);
        } else {
            alert(message);
        }
    },
};


// Explicitly make MasterDepartment globally available
window.MasterDepartment = MasterDepartment;
