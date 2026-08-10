// ==========================================
// Production Log Module
// PT. GOLDEN ALURA - Team Incentive Recording
// ==========================================

const ProductionLog = {
    logs: [],
    employees: [],
    _editMode: false,
    _editingId: null,

    async init() {
        if (!Auth.isAuthenticated()) {
            App.navigateTo('login');
            return;
        }

        await this.loadData();
        this.render();
    },

    async loadData() {
        this.employees = Storage.getEmployees().filter(e => e.status === 'active');
        this.logs = Storage.getProductionLogs();
    },

    render() {
        const content = document.getElementById('main-content');
        content.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">📝 Log Insentif Produksi</h1>
                <p class="page-description">Pencatatan aktivitas tim dan pembagian bonus per gram/kg</p>
            </div>

            <div class="card mb-4">
                <div class="card-header flex justify-between align-center">
                    <h2 class="card-title">${this._editMode ? 'Edit' : 'Tambah'} Log Aktivitas</h2>
                    ${this._editMode ? `<button class="btn btn-sm btn-secondary" onclick="ProductionLog.cancelEdit()">Batal</button>` : ''}
                </div>
                <div class="card-body">
                    <form onsubmit="ProductionLog.handleSubmit(event)">
                        <div class="form-grid" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
                            <div class="form-group">
                                <label class="form-label required">Tanggal Aktivitas</label>
                                <input type="date" name="date" class="form-input" value="${this._editMode ? this.getEditingLog().date : new Date().toISOString().split('T')[0]}" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label required">Pekerjaan / Kategori</label>
                                <input type="text" name="category" class="form-input" placeholder="Misal: BAKAR & FINISHING" value="${this._editMode ? this.getEditingLog().category : ''}" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label required">Total Berat (Gram / KG)</label>
                                <input type="number" name="total_weight" class="form-input" step="0.01" value="${this._editMode ? this.getEditingLog().total_weight : ''}" required>
                            </div>
                        </div>

                        <div class="form-grid mt-3" style="display: grid; grid-template-columns: 1fr 2fr; gap: 1rem;">
                            <div class="form-group">
                                <label class="form-label required">Bonus Rate (Rp per unit)</label>
                                <div class="input-group">
                                    <span class="input-group-text">Rp</span>
                                    <input type="number" name="bonus_rate" class="form-input" value="${this._editMode ? this.getEditingLog().bonus_rate : '25000'}" required>
                                </div>
                                <small class="text-gray">Contoh: 25,000 / gram atau 12,500 / KG</small>
                            </div>
                            <div class="form-group">
                                <label class="form-label required">Pilih Operator (Bisa banyak)</label>
                                <div id="operator-selection" class="card p-2" style="max-height: 150px; overflow-y: auto; border: 1px solid var(--border-color);">
                                    ${this.renderOperatorCheckboxes()}
                                </div>
                            </div>
                        </div>

                        <div class="mt-4 flex justify-end">
                            <button type="submit" class="btn btn-primary">
                                💾 ${this._editMode ? 'Perbarui' : 'Simpan'} Log Aktivitas
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <div class="card">
                <div class="card-header pb-0">
                    <h2 class="card-title">Riwayat Log Produksi</h2>
                </div>
                <div class="card-body">
                    <div class="table-container">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Tanggal</th>
                                    <th>Kategori</th>
                                    <th>Berat</th>
                                    <th>Rate</th>
                                    <th>Total Bonus</th>
                                    <th>Operator</th>
                                    <th>Per Orang</th>
                                    <th class="text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${this.renderLogRows()}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    },

    renderOperatorCheckboxes() {
        const editingLog = this.getEditingLog();
        const selectedNiks = editingLog ? editingLog.operators.map(o => o.nik) : [];

        return this.employees
            .filter(e => e.department === 'PROD' || e.department === 'QC' || e.job_level === 'Operator')
            .map(emp => `
                <label class="flex align-center gap-2 p-1 hover-bg-light" style="cursor: pointer;">
                    <input type="checkbox" name="operator_niks" value="${emp.nik}" ${selectedNiks.includes(emp.nik) ? 'checked' : ''}>
                    <span><strong>${emp.nik}</strong> - ${emp.name}</span>
                </label>
            `).join('') || '<p class="text-gray small p-2">Tidak ada operator aktif ditemukan.</p>';
    },

    renderLogRows() {
        if (this.logs.length === 0) return '<tr><td colspan="8" class="text-center text-gray">Belum ada riwayat log.</td></tr>';

        return this.logs
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .map(log => {
                const totalBonus = log.total_weight * log.bonus_rate;
                const perPerson = totalBonus / (log.operators.length || 1);
                const names = log.operators.map(o => o.name).join(', ');

                return `
                    <tr>
                        <td>${log.date}</td>
                        <td><strong>${log.category}</strong></td>
                        <td>${log.total_weight.toLocaleString()}</td>
                        <td>${App.formatCurrency(log.bonus_rate)}</td>
                        <td>${App.formatCurrency(totalBonus)}</td>
                        <td><small title="${names}">${log.operators.length} Org: ${names.length > 30 ? names.substring(0, 30) + '...' : names}</small></td>
                        <td><strong>${App.formatCurrency(perPerson)}</strong></td>
                        <td class="text-center">
                            <button class="btn btn-sm btn-primary" onclick="ProductionLog.editLog('${log.id}')">✏️</button>
                            <button class="btn btn-sm btn-danger" onclick="ProductionLog.deleteLog('${log.id}')">🗑️</button>
                        </td>
                    </tr>
                `;
            }).join('');
    },

    async handleSubmit(event) {
        event.preventDefault();
        const formData = new FormData(event.target);

        const operatorNiks = formData.getAll('operator_niks');
        if (operatorNiks.length === 0) {
            alert('Minimal pilih 1 operator!');
            return;
        }

        const operators = operatorNiks.map(nik => {
            const emp = this.employees.find(e => e.nik === nik);
            return { nik: nik, name: emp ? emp.name : 'Unknown' };
        });

        const logData = {
            id: this._editMode ? this._editingId : `LOG-${Date.now()}`,
            date: formData.get('date'),
            category: formData.get('category'),
            total_weight: parseFloat(formData.get('total_weight')),
            bonus_rate: parseFloat(formData.get('bonus_rate')),
            operators: operators,
            createdAt: this._editMode ? this.getEditingLog().createdAt : new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await Storage.saveProductionLog(logData);
        alert('Log produksi berhasil disimpan!');

        this._editMode = false;
        this._editingId = null;
        await this.loadData();
        this.render();
    },

    editLog(id) {
        this._editMode = true;
        this._editingId = id;
        this.render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    async deleteLog(id) {
        if (confirm('Hapus log aktivitas ini?')) {
            await Storage.deleteProductionLog(id);
            await this.loadData();
            this.render();
        }
    },

    cancelEdit() {
        this._editMode = false;
        this._editingId = null;
        this.render();
    },

    getEditingLog() {
        return this.logs.find(l => l.id === this._editingId);
    }
};

window.ProductionLog = ProductionLog;
