// ==========================================
// Change Password Module
// Allow users to change their own password
// ==========================================

const ChangePassword = {
    init() {
        // Any logged in user can change their password
        if (!Auth.isAuthenticated()) {
            window.location.href = 'login.html';
            return;
        }

        this.render();
    },

    render() {
        const user = Auth.getCurrentUser();
        const content = document.getElementById('main-content');

        content.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">🔑 Change Password</h1>
        <p class="page-description">Ubah password Anda untuk keamanan akun</p>
      </div>

      <div class="card" style="max-width: 600px;">
        <div class="card-header">
          <h2 class="card-title">Ganti Password untuk: ${user.fullName}</h2>
        </div>
        <div class="card-body">
          ${this.renderForm()}
        </div>
      </div>

      <div class="card" style="max-width: 600px; margin-top: 24px;">
        <div class="card-header">
          <h2 class="card-title">💡 Tips Keamanan Password</h2>
        </div>
        <div class="card-body">
          <ul style="line-height: 1.8; color: #666;">
            <li>Gunakan minimal 8 karakter</li>
            <li>Kombinasikan huruf besar, huruf kecil, angka</li>
            <li>Jangan gunakan password yang sama dengan aplikasi lain</li>
            <li>Ganti password secara berkala (setiap 3-6 bulan)</li>
            <li>Jangan share password ke siapapun</li>
          </ul>
        </div>
      </div>
    `;
    },

    renderForm() {
        return `
      <form id="change-password-form" onsubmit="ChangePassword.handleSubmit(event)">
        <div class="form-group">
          <label class="form-label required">Password Lama</label>
          <input type="password" name="oldPassword" class="form-input" 
                 placeholder="Masukkan password lama Anda"
                 required
                 autocomplete="current-password">
        </div>

        <div class="form-group">
          <label class="form-label required">Password Baru</label>
          <input type="password" name="newPassword" class="form-input" 
                 placeholder="Minimal 8 karakter"
                 minlength="8"
                 required
                 autocomplete="new-password">
          <small class="text-gray">Minimal 8 karakter</small>
        </div>

        <div class="form-group">
          <label class="form-label required">Konfirmasi Password Baru</label>
          <input type="password" name="confirmPassword" class="form-input" 
                 placeholder="Ketik ulang password baru"
                 minlength="8"
                 required
                 autocomplete="new-password">
        </div>

        <div class="flex justify-end" style="margin-top: 24px;">
          <button type="submit" class="btn btn-success">
            🔐 Ganti Password
          </button>
        </div>
      </form>
    `;
    },

    async handleSubmit(event) {
        event.preventDefault();
        const formData = new FormData(event.target);

        const oldPassword = formData.get('oldPassword');
        const newPassword = formData.get('newPassword');
        const confirmPassword = formData.get('confirmPassword');

        // Validate new passwords match
        if (newPassword !== confirmPassword) {
            alert('Password baru dan konfirmasi tidak sama!');
            return;
        }

        // Validate password length
        if (newPassword.length < 8) {
            alert('Password baru harus minimal 8 karakter!');
            return;
        }

        const user = Auth.getCurrentUser();
        if (!user) {
            alert('Session tidak valid. Silakan login kembali.');
            return;
        }

        // Change password
        const result = await Auth.changePassword(user.username, oldPassword, newPassword);

        if (result.success) {
            alert('✅ Password berhasil diubah!\n\nSilakan login kembali dengan password baru.');
            // Logout and redirect to login
            Auth.logout();
        } else {
            alert('❌ Gagal mengubah password!\n\n' + result.message);
        }
    },
};


// Explicitly make ChangePassword globally available
window.ChangePassword = ChangePassword;
