// ==========================================
// Master Role Module
// Kelola roles dan permissions (Admin only)
// ==========================================

const MasterRole = {
    roles: [],
    _editMode: false,
    _editingCode: null,

    // All available modules for permission assignment
    availableModules: {
        'Dashboard': 'dashboard',
        'Chart of Accounts': 'chartOfAccounts',
        'Journal Entry': 'journalEntry',
        'General Ledger': 'generalLedger',
        'Balance Sheet': 'balanceSheet',
        'Income Statement': 'incomeStatement',
        'Cash Flow': 'cashFlow',
        'Simple Transaction': 'simpleTransaction',
        'Master Customer': 'masterCustomer',
        'Master Supplier': 'masterSupplier',
        'Master Warehouse': 'masterWarehouse',
        'Master Item': 'masterItem',
        'Master Tax': 'masterTax',
        'Master Bank': 'masterBank',
        'Master Payment Terms': 'masterPaymentTerms',
        'Master Department': 'masterDepartment',
        'Master User': 'masterUser',
        'Master Role': 'masterRole',
    },

    init() {
        // Check if user has admin permission
        if (!Auth.isAuthenticated() || Auth.getCurrentUser().role !== 'ADMIN') {
            alert('Akses ditolak! Hanya Admin yang dapat mengelola roles.');
            App.navigateTo('dashboard');
            return;
        }

        this.loadRoles();
        this.render();
    },

    loadRoles() {
        this.roles = Storage.getRoles();
    },

    render() {
        const content = document.getElementById('main-content');
        content.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">🎭 Master Role</h1>
        <p class="page-description">Kelola roles dan module permissions</p>
      </div>

      <div class="card mb-3">
        <div class="card-header">
          <h2 class="card-title">${this._editMode ? 'Edit' : 'Tambah'} Role</h2>
        </div>
        <div class="card-body">
          ${this.renderForm()}
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Daftar Role (${this.roles.length})</h2>
        </div>
        <div class="card-body">
          ${this.renderList()}
        </div>
      </div>
    `;
    },

    renderForm() {
        const role = this._editMode && this._editingCode
            ? this.roles.find(r => r.roleCode === this._editingCode)
            : {};

        const permissions = role.permissions || {};

        return `
      <form id="role-form" onsubmit="MasterRole.handleSubmit(event)">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label required">Role Code</label>
            <input type="text" name="roleCode" class="form-input" 
                   value="${role.roleCode || ''}" 
                   placeholder="Contoh: MANAGER"
                   ${this._editMode ? 'readonly' : ''}
                   required>
            <small class="text-gray">Role code tidak bisa diubah setelah dibuat</small>
          </div>
          
          <div class="form-group">
            <label class="form-label required">Role Name</label>
            <input type="text" name="roleName" class="form-input" 
                   value="${role.roleName || ''}" 
                   placeholder="Contoh: Manager"
                   required>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea name="description" class="form-textarea" rows="2" 
                    placeholder="Deskripsi role dan tanggung jawabnya">${role.description || ''}</textarea>
        </div>

        <div class="form-group">
          <label class="form-label required">Module Permissions</label>
          <div class="permission-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 12px; margin-top: 12px;">
            ${Object.entries(this.availableModules).map(([label, value]) => `
              <div class="permission-item" style="background: var(--bg-tertiary); padding: 12px; border-radius: 6px;">
                <label style="display: flex; align-items: center; cursor: pointer;">
                  <input type="checkbox" 
                         name="permission_${value}" 
                         value="${value}"
                         ${permissions[value] ? 'checked' : ''}
                         style="margin-right: 8px;">
                  <span>${label}</span>
                </label>
              </div>
            `).join('')}
          </div>
          <small class="text-gray">Select modules yang dapat diakses oleh role ini (Admin selalu full access)</small>
        </div>

        <div class="flex justify-between align-center">
          ${this._editMode ? `
            <button type="button" class="btn btn-secondary" onclick="MasterRole.cancelEdit()">
              Batal Edit
            </button>
          ` : '<div></div>'}
          <button type="submit" class="btn btn-success">
            💾 ${this._editMode ? 'Update' : 'Simpan'} Role
          </button>
        </div>
      </form>
    `;
    },

    renderList() {
        if (this.roles.length === 0) {
            return '<p class="text-center text-gray">Belum ada role custom. Role default sudah tersedia.</p>';
        }

        return `
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Role Name</th>
              <th>Description</th>
              <th>Permissions</th>
              <th class="text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${this.roles.map(role => {
            const permCount = role.permissions ? Object.values(role.permissions).filter(v => v).length : 0;
            const isPreset = ['ADMIN', 'FINANCE', 'PRODUCTION', 'SALES', 'VIEWER'].includes(role.roleCode);

            return `
              <tr>
                <td><span class="badge badge-primary">${role.roleCode}</span></td>
                <td><strong>${role.roleName}</strong></td>
                <td>${role.description || '-'}</td>
                <td>
                  <span class="badge badge-info">${role.roleCode === 'ADMIN' ? 'All' : permCount} modules</span>
                </td>
                <td class="text-center">
                  <button class="btn btn-sm btn-primary" onclick="MasterRole.viewPermissions('${role.roleCode}')" title="View Permissions">
                    👁️
                  </button>
                  ${!isPreset ? `
                  <button class="btn btn-sm btn-primary" onclick="MasterRole.editRole('${role.roleCode}')" title="Edit">
                    ✏️
                  </button>
                  <button class="btn btn-sm btn-danger" onclick="MasterRole.confirmDelete('${role.roleCode}')" title="Hapus">
                    🗑️
                  </button>
                  ` : `
                  <span class="badge badge-secondary">Preset</span>
                  `}
                </td>
              </tr>
            `;
        }).join('')}
          </tbody>
        </table>
      </div>
    `;
    },

    handleSubmit(event) {
        event.preventDefault();
        const formData = new FormData(event.target);

        // Collect all permissions
        const permissions = {};
        Object.values(this.availableModules).forEach(module => {
            permissions[module] = formData.get(`permission_${module}`) === module;
        });

        const roleData = {
            roleCode: formData.get('roleCode'),
            roleName: formData.get('roleName'),
            description: formData.get('description'),
            permissions,
        };

        try {
            if (this._editMode && this._editingCode) {
                // Update existing role
                const success = Storage.updateRole(this._editingCode, roleData);

                if (success) {
                    alert('Role berhasil diupdate!');
                    this.cancelEdit();
                } else {
                    alert('Role tidak ditemukan');
                }
            } else {
                // Create new role
                Storage.createRole(roleData);
                alert('Role berhasil ditambahkan!');
                document.getElementById('role-form').reset();
            }

            this.loadRoles();
            this.render();
        } catch (error) {
            alert('Error: ' + error.message);
        }
    },

    editRole(roleCode) {
        // Prevent editing preset roles
        if (['ADMIN', 'FINANCE', 'PRODUCTION', 'SALES', 'VIEWER'].includes(roleCode)) {
            alert('Preset role tidak dapat diedit. Buat role baru atau clone.');
            return;
        }

        this._editMode = true;
        this._editingCode = roleCode;
        this.render();
        document.getElementById('role-form').scrollIntoView({ behavior: 'smooth' });
    },

    cancelEdit() {
        this._editMode = false;
        this._editingCode = null;
        this.render();
    },

    viewPermissions(roleCode) {
        const role = this.roles.find(r => r.roleCode === roleCode);
        if (!role) return;

        const permissions = role.permissions || {};
        const enabledModules = Object.entries(permissions)
            .filter(([_, enabled]) => enabled)
            .map(([module,]) => {
                const label = Object.entries(this.availableModules).find(([_, val]) => val === module);
                return label ? label[0] : module;
            });

        const message = `Role: ${role.roleName}\n\nModule Permissions:\n${roleCode === 'ADMIN' ? '✅ ALL MODULES (Full Access)' : enabledModules.length > 0 ? enabledModules.map(m => `✅ ${m}`).join('\n') : '❌ No permissions assigned'}`;

        alert(message);
    },

    confirmDelete(roleCode) {
        const role = this.roles.find(r => r.roleCode === roleCode);
        if (!role) return;

        // Check if any users are using this role
        const users = Storage.getUsers();
        const usersWithRole = users.filter(u => u.role === roleCode);

        if (usersWithRole.length > 0) {
            alert(`Cannot delete role "${role.roleName}"!\n\n${usersWithRole.length} user(s) masih menggunakan role ini:\n${usersWithRole.map(u => `- ${u.fullName} (${u.username})`).join('\n')}\n\nUbah role users tersebut terlebih dahulu.`);
            return;
        }

        if (confirm(`Hapus role "${role.roleName}" (${roleCode})?\n\nData yang sudah dihapus tidak dapat dikembalikan.`)) {
            Storage.deleteRole(roleCode);
            this.loadRoles();
            this.render();
            alert('Role berhasil dihapus');
        }
    },
};


// Explicitly make MasterRole globally available
window.MasterRole = MasterRole;
