// ==========================================
// Master Karat & Purity UI Module
// Manages UI for MasterPurity (Grades) and MasterRefiningRules (Fees/Returns)
// ==========================================

const MasterKaratUI = {
    activeTab: 'grades', // 'grades' or 'rules'
    editingGradeId: null,
    editingRuleIndex: null,

    init() {
        console.log('MasterKaratUI initialized');
        this.render();
    },

    switchTab(tab) {
        this.activeTab = tab;
        this.editingGradeId = null;
        this.editingRuleIndex = null;
        this.render();
    },

    render() {
        const content = document.getElementById('main-content');
        if (!content) return;

        content.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">🥇 Master Karat & Refining Rules</h1>
                <p class="page-description">Kelola tingkatan kadar emas (Grade) dan aturan potongan/fee pemurnian.</p>
            </div>

            <div class="tabs mb-3">
                <button class="tab-btn ${this.activeTab === 'grades' ? 'active' : ''}" onclick="MasterKaratUI.switchTab('grades')">Master Grade (Karat)</button>
                <button class="tab-btn ${this.activeTab === 'rules' ? 'active' : ''}" onclick="MasterKaratUI.switchTab('rules')">Refining Rules (Potongan)</button>
            </div>

            <div class="card">
                <div class="card-header flex justify-between align-center">
                    <h2 class="card-title">
                        ${this.activeTab === 'grades' ? 'Daftar Grade (Karat)' : 'Aturan Refining & Return'}
                    </h2>
                    <button class="btn btn-primary" onclick="MasterKaratUI.showAddModal()">
                        + Tambah ${this.activeTab === 'grades' ? 'Grade' : 'Rule'}
                    </button>
                </div>
                <div class="card-body">
                    ${this.activeTab === 'grades' ? this.renderGradesTable() : this.renderRulesTable()}
                </div>
            </div>
            
            <!-- Modal Container (Hidden by default) -->
            <div id="master-karat-modal" class="modal-overlay hidden"></div>
        `;
    },

    renderGradesTable() {
        const grades = MasterPurity.getAllGrades();

        if (grades.length === 0) {
            return '<div class="text-center p-3 text-gray">Belum ada data grade.</div>';
        }

        return `
            <div class="table-responsive">
                <table class="table table-striped">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Grade Name</th>
                            <th>Min %</th>
                            <th>Max %</th>
                            <th>Metal</th>
                            <th>Description</th>
                            <th class="text-right">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${grades.map(g => `
                            <tr>
                                <td>${g.id}</td>
                                <td><span class="badge badge-warning">${g.grade}</span></td>
                                <td>${g.min.toFixed(2)}%</td>
                                <td>${g.max.toFixed(2)}%</td>
                                <td>${g.metal}</td>
                                <td>${g.description || '-'}</td>
                                <td class="text-right">
                                    <button class="btn btn-sm btn-outline" onclick="MasterKaratUI.editGrade('${g.id}')">✏️</button>
                                    <button class="btn btn-sm btn-danger" onclick="MasterKaratUI.deleteGrade('${g.id}')">🗑️</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    renderRulesTable() {
        const rules = MasterRefiningRules.getAllRules();

        if (rules.length === 0) {
            return '<div class="text-center p-3 text-gray">Belum ada aturan refining.</div>';
        }

        return `
            <div class="table-responsive">
                <table class="table table-striped">
                    <thead>
                        <tr>
                            <th>Grade ID</th>
                            <th>Berat Min (g)</th>
                            <th>Berat Max (g)</th>
                            <th>Return Au (%)</th>
                            <th>Fee (Rp/g)</th>
                            <th class="text-right">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rules.map((r, index) => `
                            <tr>
                                <td><strong>${r.grade_id}</strong></td>
                                <td>${r.min_weight.toLocaleString()}</td>
                                <td>${r.max_weight >= 99999 ? '∞' : r.max_weight.toLocaleString()}</td>
                                <td class="text-success font-bold">${r.au_return.toFixed(2)}%</td>
                                <td>Rp ${r.fee.toLocaleString()}</td>
                                <td class="text-right">
                                    <button class="btn btn-sm btn-outline" onclick="MasterKaratUI.editRule(${index})">✏️</button>
                                    <button class="btn btn-sm btn-danger" onclick="MasterKaratUI.deleteRule(${index})">🗑️</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    // ==========================================
    // Modal & Form Handling
    // ==========================================

    showAddModal() {
        if (this.activeTab === 'grades') {
            this.editingGradeId = null;
            this.renderGradeModal();
        } else {
            this.editingRuleIndex = null;
            this.renderRuleModal();
        }
    },

    closeModal() {
        const modal = document.getElementById('master-karat-modal');
        if (modal) modal.classList.add('hidden');
    },

    // --- GRADES ---

    editGrade(id) {
        this.editingGradeId = id;
        this.renderGradeModal();
    },

    deleteGrade(id) {
        if (confirm('Yakin ingin menghapus grade ini?')) {
            MasterPurity.deleteGrade(id);
            this.render();
        }
    },

    renderGradeModal() {
        const isEdit = !!this.editingGradeId;
        const grade = isEdit ? MasterPurity.getAllGrades().find(g => g.id === this.editingGradeId) : {};

        const modal = document.getElementById('master-karat-modal');
        modal.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <h3 class="modal-title">${isEdit ? 'Edit' : 'Tambah'} Grade</h3>
                    <button class="modal-close" onclick="MasterKaratUI.closeModal()">×</button>
                </div>
                <div class="modal-body">
                    <form id="grade-form" onsubmit="MasterKaratUI.handleGradeSubmit(event)">
                        <div class="form-group mb-2">
                            <label class="form-label">Grade ID</label>
                            <input type="text" name="id" class="form-input" value="${grade.id || ''}" ${isEdit ? 'readonly' : ''} required placeholder="e.g. P-24K">
                        </div>
                        <div class="form-group mb-2">
                            <label class="form-label">Display Name</label>
                            <input type="text" name="grade" class="form-input" value="${grade.grade || ''}" required placeholder="e.g. 24K">
                        </div>
                        <div class="grid grid-2 gap-2 mb-2">
                            <div class="form-group">
                                <label class="form-label">Min Purity (%)</label>
                                <input type="number" name="min" class="form-input" value="${grade.min || ''}" step="0.01" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Max Purity (%)</label>
                                <input type="number" name="max" class="form-input" value="${grade.max || ''}" step="0.01" required>
                            </div>
                        </div>
                        <div class="form-group mb-2">
                            <label class="form-label">Metal Type</label>
                            <select name="metal" class="form-select">
                                <option value="GOLD" ${grade.metal === 'GOLD' ? 'selected' : ''}>GOLD</option>
                                <option value="SILVER" ${grade.metal === 'SILVER' ? 'selected' : ''}>SILVER</option>
                            </select>
                        </div>
                        <div class="form-group mb-3">
                            <label class="form-label">Description</label>
                            <input type="text" name="description" class="form-input" value="${grade.description || ''}">
                        </div>
                        <div class="flex justify-end gap-2">
                            <button type="button" class="btn btn-secondary" onclick="MasterKaratUI.closeModal()">Batal</button>
                            <button type="submit" class="btn btn-primary">Simpan</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        modal.classList.remove('hidden');
    },

    handleGradeSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = {
            id: formData.get('id'),
            grade: formData.get('grade'),
            min: parseFloat(formData.get('min')),
            max: parseFloat(formData.get('max')),
            metal: formData.get('metal'),
            description: formData.get('description')
        };

        if (this.editingGradeId) {
            MasterPurity.updateGrade(this.editingGradeId, data);
        } else {
            // Check ID uniqueness
            if (MasterPurity.getAllGrades().find(g => g.id === data.id)) {
                alert('Grade ID already exists!');
                return;
            }
            MasterPurity.addGrade(data);
        }
        this.closeModal();
        this.render();
    },

    // --- RULES ---

    editRule(index) {
        this.editingRuleIndex = index;
        this.renderRuleModal();
    },

    deleteRule(index) {
        if (confirm('Yakin ingin menghapus aturan ini?')) {
            MasterRefiningRules.deleteRule(index);
            this.render();
        }
    },

    renderRuleModal() {
        const isEdit = this.editingRuleIndex !== null;
        const rule = isEdit ? MasterRefiningRules.getAllRules()[this.editingRuleIndex] : {};
        const grades = MasterPurity.getAllGrades();

        const modal = document.getElementById('master-karat-modal');
        modal.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <h3 class="modal-title">${isEdit ? 'Edit' : 'Tambah'} Refining Rule</h3>
                    <button class="modal-close" onclick="MasterKaratUI.closeModal()">×</button>
                </div>
                <div class="modal-body">
                    <form id="rule-form" onsubmit="MasterKaratUI.handleRuleSubmit(event)">
                        <div class="form-group mb-2">
                            <label class="form-label">Grade Reference</label>
                            <select name="grade_id" class="form-select" required>
                                <option value="">-- Pilih Grade --</option>
                                ${grades.map(g => `
                                    <option value="${g.id}" ${rule.grade_id === g.id ? 'selected' : ''}>
                                        ${g.id} - ${g.grade} (${g.min}-${g.max}%)
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="grid grid-2 gap-2 mb-2">
                            <div class="form-group">
                                <label class="form-label">Min Weight (g)</label>
                                <input type="number" name="min_weight" class="form-input" value="${rule.min_weight !== undefined ? rule.min_weight : 0}" step="0.001" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Max Weight (g)</label>
                                <input type="number" name="max_weight" class="form-input" value="${rule.max_weight !== undefined ? rule.max_weight : 99999}" step="0.001" required>
                                <small class="text-gray">Use 99999 for infinity</small>
                            </div>
                        </div>
                        <div class="grid grid-2 gap-2 mb-3">
                            <div class="form-group">
                                <label class="form-label">Return Au (%)</label>
                                <input type="number" name="au_return" class="form-input" value="${rule.au_return || ''}" step="0.01" required placeholder="e.g 99.5">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Refining Fee (Rp/g)</label>
                                <input type="number" name="fee" class="form-input" value="${rule.fee || ''}" required placeholder="e.g 1000">
                            </div>
                        </div>
                        <div class="flex justify-end gap-2">
                            <button type="button" class="btn btn-secondary" onclick="MasterKaratUI.closeModal()">Batal</button>
                            <button type="submit" class="btn btn-primary">Simpan</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        modal.classList.remove('hidden');
    },

    handleRuleSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = {
            grade_id: formData.get('grade_id'),
            min_weight: parseFloat(formData.get('min_weight')),
            max_weight: parseFloat(formData.get('max_weight')),
            au_return: parseFloat(formData.get('au_return')),
            // Default Ag Return if likely to be used later
            ag_return: 0,
            fee: parseFloat(formData.get('fee')),
            // Default Tax logic if needed, can add inputs later
            ppn: 0,
            pph: 0
        };

        if (this.editingRuleIndex !== null) {
            MasterRefiningRules.updateRule(this.editingRuleIndex, data);
        } else {
            MasterRefiningRules.addRule(data);
        }
        this.closeModal();
        this.render();
    }
};

window.MasterKaratUI = MasterKaratUI;
