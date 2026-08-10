// ==========================================
// HR - Master Shift Module
// ==========================================

const MasterShift = {
    shifts: [],

    init() {
        this.loadShifts();
        this.checkAndSeedSecurity();
        this.render();
        console.log('🕒 Master Shift module initialized');
    },

    async checkAndSeedSecurity() {
        const existingPagi = this.shifts.find(s => s.code === 'SEC-PAGI');
        if (!existingPagi) {
            await this.addShift({
                code: 'SEC-PAGI',
                name: 'Security Pagi (12 Jam)',
                startTime: '08:00',
                endTime: '16:00',
                breakDuration: 60,
                isNight: false,
                notes: 'Shift Security Siang/Pagi. Total 12 jam (08:00 - 20:00). 8 Jam Kerja + 4 Jam Lembur.'
            });
        }
        const existingMalam = this.shifts.find(s => s.code === 'SEC-MLM');
        if (!existingMalam) {
            await this.addShift({
                code: 'SEC-MLM',
                name: 'Security Malam (12 Jam)',
                startTime: '20:00',
                endTime: '04:00',
                breakDuration: 60,
                isNight: true,
                notes: 'Shift Security Malam. Total 12 jam (20:00 - 08:00). 8 Jam Kerja + 4 Jam Lembur.'
            });
        }
    },

    loadShifts() {
        this.shifts = Storage.getMasterShifts();
    },

    async saveShifts() {
        await Storage.saveMasterShifts(this.shifts);
        AuditLog.log('hr_master_shift', 'save_all', 'all', { count: this.shifts.length });
    },

    async addShift(shift) {
        this.shifts.push({
            id: 'SHF-' + Date.now(),
            ...shift,
            createdAt: new Date().toISOString()
        });
        await this.saveShifts();
        this.render();
    },

    // ─── Quick Seed: tambah shift OB sekaligus ────────────────────
    async seedOBShift() {
        const existing = this.shifts.find(s => (s.code || '').toUpperCase() === 'OB');
        if (existing) {
            if (window.showToast) window.showToast('⚠️ Shift dengan kode OB sudah ada.', 'warning');
            else alert('Shift dengan kode OB sudah ada.');
            return;
        }
        await this.addShift({
            code: 'OB',
            name: 'OB - Cleaning Service (Weekday)',
            startTime: '07:30',
            endTime: '15:30',
            breakDuration: 60,
            isNight: false,
            notes: 'Jadwal Senin–Jumat. Sabtu menyesuaikan shift normal.'
        });
        if (window.showToast) window.showToast('✅ Shift OB (Cleaning Service) berhasil ditambahkan!', 'success');
        else alert('✅ Shift OB berhasil ditambahkan!');
    },

    async updateShift(id, updatedData) {
        const index = this.shifts.findIndex(s => s.id === id);
        if (index !== -1) {
            this.shifts[index] = { ...this.shifts[index], ...updatedData, updatedAt: new Date().toISOString() };
            await this.saveShifts();
            this.render();
        }
    },

    async deleteShift(id) {
        if (!confirm('Hapus shift ini?')) return;
        this.shifts = this.shifts.filter(s => s.id !== id);
        await this.saveShifts();
        this.render();
    },

    render() {
        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">🕒 Master Shift</h1>
                <p class="page-subtitle">Kelola daftar jam kerja (shift) karyawan</p>
            </div>

            <div class="action-bar" style="margin-bottom: 1.5rem; display: flex; gap: 0.75rem; flex-wrap: wrap;">
                <button class="btn btn-primary" onclick="MasterShift.showAddModal()">
                    ➕ Tambah Shift Baru
                </button>
                <button class="btn btn-secondary" onclick="MasterShift.seedOBShift()"
                        title="Tambah otomatis Shift OB (Cleaning Service) 07:30–15:30"
                        style="background: linear-gradient(135deg,#059669,#047857); color:#fff; border-color:transparent;">
                    🧹 Quick Add: Shift OB
                </button>
            </div>

            <div class="card">
                <div class="card-body">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Kode</th>
                                <th>Nama Shift</th>
                                <th>Jam Mulai</th>
                                <th>Jam Selesai</th>
                                <th>Istirahat (m)</th>
                                <th>Malam?</th>
                                <th>Catatan</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.shifts.length === 0 ? '<tr><td colspan="6" style="text-align:center; padding: 2rem;">Belum ada shift. Klik "Tambah Shift Baru".</td></tr>' :
                this.shifts.map(shift => `
                                <tr>
                                    <td><span class="badge badge-primary" style="font-family:monospace;font-size:0.85rem;">${shift.code || '-'}</span></td>
                                    <td><strong>${shift.name}</strong></td>
                                    <td>${shift.startTime}</td>
                                    <td>${shift.endTime}</td>
                                    <td>${shift.breakDuration || 0}</td>
                                    <td>${shift.isNight ? '🌙' : '-'}</td>
                                    <td style="font-size:0.8rem;color:var(--text-secondary);max-width:200px;">${shift.notes || '-'}</td>
                                    <td>
                                        <button class="btn btn-sm btn-info" onclick="MasterShift.showEditModal('${shift.id}')">✏️</button>
                                        <button class="btn btn-sm btn-danger" onclick="MasterShift.deleteShift('${shift.id}')">🗑️</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Modal Placeholder -->
            <div id="shift-modal-container"></div>
        `;
    },

    showAddModal() {
        this.renderModal('Tambah Shift Baru');
    },

    showEditModal(id) {
        const shift = this.shifts.find(s => s.id === id);
        if (shift) {
            this.renderModal('Edit Shift', shift);
        }
    },

    renderModal(title, shift = null) {
        const container = document.getElementById('shift-modal-container');
        container.innerHTML = `
            <div class="modal-overlay">
                <div class="modal" style="max-width: 400px;">
                    <div class="modal-header">
                        <h3 class="modal-title">${title}</h3>
                        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="shift-form">
                            <input type="hidden" id="shift-id" value="${shift ? shift.id : ''}">
                            <div class="form-row" style="display: grid; grid-template-columns: 120px 1fr; gap: 1rem;">
                                <div class="form-group">
                                    <label class="form-label">Kode Shift</label>
                                    <input type="text" id="shift-code" class="form-input" placeholder="OB, S1, PAGI" value="${shift ? (shift.code || '') : ''}" style="text-transform:uppercase;font-family:monospace;">
                                </div>
                                <div class="form-group">
                                    <label class="form-label required">Nama Shift</label>
                                    <input type="text" id="shift-name" class="form-input" placeholder="Misal: Shift 1 (Pagi)" value="${shift ? shift.name : ''}" required>
                                </div>
                            </div>
                            <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <div class="form-group">
                                    <label class="form-label required">Jam Mulai</label>
                                    <input type="time" id="shift-start" class="form-input" value="${shift ? shift.startTime : '08:00'}" required>
                                </div>
                                <div class="form-group">
                                    <label class="form-label required">Jam Selesai</label>
                                    <input type="time" id="shift-end" class="form-input" value="${shift ? shift.endTime : '17:00'}" required>
                                </div>
                            </div>
                            <div class="form-group" style="margin-top: 1rem;">
                                <label class="form-label">Durasi Istirahat (menit)</label>
                                <input type="number" id="shift-break" class="form-input" value="${shift ? shift.breakDuration : 60}">
                            </div>
                            <div class="form-group" style="margin-top: 1rem;">
                                <label class="form-label">Catatan / Keterangan</label>
                                <input type="text" id="shift-notes" class="form-input" placeholder="Misal: Senin–Jumat saja" value="${shift ? (shift.notes || '') : ''}">
                            </div>
                            <div class="form-group" style="margin-top: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                                <input type="checkbox" id="shift-night" ${shift && shift.isNight ? 'checked' : ''}>
                                <label for="shift-night" class="form-label" style="margin-bottom: 0;">Shift Malam (Berhak Tunjangan Malam)</label>
                            </div>
                            <div class="form-actions" style="margin-top: 1.5rem; display: flex; justify-content: flex-end; gap: 0.5rem;">
                                <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Batal</button>
                                <button type="submit" class="btn btn-primary">Simpan</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;

        const form = document.getElementById('shift-form');
        form.onsubmit = async (e) => {
            e.preventDefault();
            const rawCode = document.getElementById('shift-code').value.trim().toUpperCase();
            const formData = {
                code: rawCode || null,
                name: document.getElementById('shift-name').value,
                startTime: document.getElementById('shift-start').value,
                endTime: document.getElementById('shift-end').value,
                breakDuration: parseInt(document.getElementById('shift-break').value) || 0,
                isNight: document.getElementById('shift-night').checked,
                notes: document.getElementById('shift-notes').value.trim()
            };

            const id = document.getElementById('shift-id').value;
            if (id) {
                await this.updateShift(id, formData);
            } else {
                await this.addShift(formData);
            }
            container.innerHTML = '';
        };
    }
};
