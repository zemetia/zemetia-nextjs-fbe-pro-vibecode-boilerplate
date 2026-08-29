// ==========================================
// Master User Module
// Kelola user accounts dengan CRUD operations (Admin only)
// ==========================================

const MasterUser = {
  users: [],
  roles: [],
  _editMode: false,
  _editingUsername: null,

  async init() {
    // Check if user has admin permission
    if (!Auth.isAuthenticated() || Auth.getCurrentUser().role !== 'ADMIN') {
      alert('Akses ditolak! Hanya Admin yang dapat mengelola users.');
      App.navigateTo('dashboard');
      return;
    }

    this.loadData();
    this.render();
  },

  loadData() {
    this.users = Storage.getUsers();
    this.roles = Storage.getRoles();
  },

  render() {
    const content = document.getElementById('main-content');
    content.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">👥 Master User</h1>
        <p class="page-description">Kelola user accounts dan assign roles</p>
      </div>

      <div class="card mb-3">
        <div class="card-header">
          <h2 class="card-title">${this._editMode ? 'Edit' : 'Tambah'} User</h2>
        </div>
        <div class="card-body">
          ${this.renderForm()}
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Daftar User (${this.users.length})</h2>
        </div>
        <div class="card-body">
          ${this.renderList()}
        </div>
      </div>
    `;
  },

  renderForm() {
    const user = this._editMode && this._editingUsername
      ? this.users.find(u => u.username === this._editingUsername)
      : {};

    return `
      <form id="user-form" onsubmit="MasterUser.handleSubmit(event)">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label required">Username</label>
            <input type="text" name="username" class="form-input" 
                   value="${user.username || ''}" 
                   placeholder="Username untuk login"
                   ${this._editMode ? 'readonly' : ''}
                   required>
            <small class="text-gray">Username tidak bisa diubah setelah dibuat</small>
          </div>
          
          <div class="form-group">
            <label class="form-label required">Full Name</label>
            <input type="text" name="fullName" class="form-input" 
                   value="${user.fullName || ''}" 
                   placeholder="Nama lengkap user"
                   required>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label required">Email</label>
            <input type="email" name="email" class="form-input" 
                   value="${user.email || ''}" 
                   placeholder="user@goalrefinery.id"
                   required>
          </div>
          
          <div class="form-group">
            <label class="form-label required">Role</label>
            <select name="role" class="form-select" required>
              <option value="">-- Pilih Role --</option>
              ${this.roles.map(role => `
                <option value="${role.roleCode}" ${user.role === role.roleCode ? 'selected' : ''}>
                  ${role.roleName}
                </option>
              `).join('')}
            </select>
          </div>
        </div>

        ${!this._editMode ? `
        <div class="form-row">
          <div class="form-group">
            <label class="form-label required">Password</label>
            <input type="password" name="password" class="form-input" 
                   placeholder="Minimum 8 karakter"
                   minlength="8"
                   required>
          </div>
          
          <div class="form-group">
            <label class="form-label required">Konfirmasi Password</label>
            <input type="password" name="confirmPassword" class="form-input" 
                   placeholder="Ketik ulang password"
                   minlength="8"
                   required>
          </div>
        </div>
        ` : ''}

        <div class="form-row">
          <div class="form-group">
            <label class="form-label required">Status</label>
            <select name="status" class="form-select" required>
              <option value="active" ${user.status === 'active' ? 'selected' : ''}>Active</option>
              <option value="inactive" ${user.status === 'inactive' ? 'selected' : ''}>Inactive</option>
            </select>
          </div>
        </div>

        <div class="flex justify-between align-center">
          ${this._editMode ? `
            <button type="button" class="btn btn-secondary" onclick="MasterUser.cancelEdit()">
              Batal Edit
            </button>
          ` : '<div></div>'}
          <button type="submit" class="btn btn-success">
            💾 ${this._editMode ? 'Update' : 'Simpan'} User
          </button>
        </div>
      </form>
    `;
  },

  renderList() {
    if (this.users.length === 0) {
      return '<p class="text-center text-gray">Belum ada user. Tambahkan user pertama!</p>';
    }

    return `
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Full Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Created</th>
              <th class="text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${this.users.map(user => {
      const role = this.roles.find(r => r.roleCode === user.role);
      return `
              <tr>
                <td><span class="badge badge-primary">${user.username}</span></td>
                <td><strong>${user.fullName}</strong></td>
                <td>${user.email}</td>
                <td>${role ? role.roleName : user.role}</td>
                <td>
                  <span class="badge ${user.status === 'active' ? 'badge-success' : 'badge-secondary'}">
                    ${user.status}
                  </span>
                </td>
                <td>${new Date(user.createdAt).toLocaleDateString('id-ID')}</td>
                <td class="text-center">
                  <button class="btn btn-sm btn-primary" onclick="MasterUser.editUser('${user.username}')" title="Edit">
                    ✏️
                  </button>
                  ${user.username !== 'admin' ? `
                  <button class="btn btn-sm btn-warning" onclick="MasterUser.resetPassword('${user.username}')" title="Reset Password">
                    🔑
                  </button>
                  <button class="btn btn-sm btn-danger" onclick="MasterUser.confirmDelete('${user.username}')" title="Hapus">
                    🗑️
                  </button>
                  ` : ''}
                </td>
              </tr>
            `;
    }).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  async handleSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.target);

    // Validate passwords match (for new users)
    if (!this._editMode) {
      const password = formData.get('password');
      const confirmPassword = formData.get('confirmPassword');

      if (password !== confirmPassword) {
        alert('Password dan konfirmasi password tidak sama!');
        return;
      }
    }

    const userData = {
      username: formData.get('username'),
      fullName: formData.get('fullName'),
      email: formData.get('email'),
      role: formData.get('role'),
      status: formData.get('status'),
    };

    try {
      if (this._editMode && this._editingUsername) {
        // Update existing user (without changing password)
        const success = Storage.updateUser(this._editingUsername, userData);

        if (success) {
          alert('User berhasil diupdate!');
          this.cancelEdit();
        } else {
          alert('User tidak ditemukan');
        }
      } else {
        // CREATE NEW USER (Firebase Sync)
        const password = formData.get('password');

        // Use the new FirebaseAuth register method
        const result = await Auth.register(userData, password);

        if (result.success) {
          alert('User berhasil ditambahkan ke Cloud & Local!');
          document.getElementById('user-form').reset();
        } else {
          alert('Gagal daftar ke Cloud: ' + result.message);
          return;
        }
      }

      this.loadData();
      this.render();
    } catch (error) {
      alert('Error: ' + error.message);
    }
  },

  editUser(username) {
    this._editMode = true;
    this._editingUsername = username;
    this.render();
    document.getElementById('user-form').scrollIntoView({ behavior: 'smooth' });
  },

  cancelEdit() {
    this._editMode = false;
    this._editingUsername = null;
    this.render();
  },

  async resetPassword(username) {
    const newPassword = prompt(`Reset password untuk user "${username}"?\n\nMasukkan password baru (min. 8 karakter):`);

    if (!newPassword) return;

    if (newPassword.length < 8) {
      alert('Password harus minimal 8 karakter!');
      return;
    }

    const passwordHash = await Auth.hashPassword(newPassword);
    const success = Storage.updateUser(username, { passwordHash, mustChangePassword: true });

    if (success) {
      alert(`Password untuk "${username}" berhasil direset!\nUser harus ganti password saat login.`);
    } else {
      alert('Gagal reset password');
    }
  },

  async confirmDelete(username) {
    const user = this.users.find(u => u.username === username);
    if (!user) return;

    if (confirm(`Hapus user "${user.fullName}" (${username})?\n\nData yang sudah dihapus tidak dapat dikembalikan.\n(Catatan: Akun Firebase Auth harus dihapus manual oleh Admin Firebase Console)`)) {
      // Delete from Firestore/Local
      if (user.id) {
        await Auth.deleteUser(user.id);
      }
      Storage.deleteUser(username);

      this.loadData();
      this.render();
      alert('User berhasil dihapus');
    }
  },
};


// Explicitly make MasterUser globally available
window.MasterUser = MasterUser;
