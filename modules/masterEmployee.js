// ==========================================
// Master Employee Module (Expanded)
// PT. GOLDEN ALURA - HR System Foundation
// ==========================================

const MasterEmployee = {
  employees: [],
  departments: [],
  _editMode: false,
  _editingId: null,
  _activeTab: 'personal',
  _pendingImportRows: null,
  _listTab: 'active',

  DEPARTMENTS: [
    "Finance & Accounting (including Tax)",
    "HR / Personalia",
    "Corporate Legal",
    "Sales & Marketing",
    "Information Technology",
    "Procurement",
    "Production & Operations"
  ],

  DIVISIONS_BY_DEPARTMENT: {
    "Finance & Accounting (including Tax)": [
      "Finance & Treasury",
      "Accounting & General Ledger",
      "Tax & Compliance",
      "Audit & Internal Control"
    ],
    "HR / Personalia": [
      "Recruitment",
      "Performance Management",
      "HR Administration",
      "Security",
      "Maintenance & General Services"
    ],
    "Corporate Legal": [
      "Regulatory",
      "Litigation & IP",
      "Paralegal / Support"
    ],
    "Sales & Marketing": [
      "Sales & Account Management",
      "Marketing & Brand Strategy",
      "Customer Relationship (CRM)",
      "Digital Marketing"
    ],
    "Information Technology": [
      "Infrastructure & Security",
      "Software Development (ERP)",
      "IT Support & Helpdesk"
    ],
    "Procurement": [
      "Raw Material Procurement",
      "Production Supply Procurement",
      "General Procurement"
    ],
    "Production & Operations": [
      "QC Receiving",
      "Laboratory",
      "Production Process",
      "Finishing",
      "Warehouse (Raw Material)",
      "Warehouse (Finished Goods)"
    ]
  },

  normalizeDept(d) {
    if (!d) return "";
    const str = String(d).trim();
    if (str === "PROD" || str === "Produksi" || str === "Production" || str.includes("Production") || str.includes("Operations")) return "Production & Operations";
    if (str === "FIN" || str === "Finance" || str.includes("Finance") || str.includes("Accounting") || str.includes("Tax")) return "Finance & Accounting (including Tax)";
    if (str === "HRD" || str === "HR" || str.includes("Human") || str.includes("Personalia")) return "HR / Personalia";
    if (str === "LEGAL" || str === "Legal" || str.includes("Legal") || str.includes("Regulatory") || str.includes("Corporate Legal")) return "Corporate Legal";
    if (str === "MKT" || str === "SLS" || str === "Sales" || str.includes("Sales") || str.includes("Marketing")) return "Sales & Marketing";
    if (str === "IT" || str.includes("Information") || str.includes("Technology")) return "Information Technology";
    if (str === "PUR" || str === "Purchasing" || str === "PROC" || str.includes("Procurement")) return "Procurement";
    if (this.DEPARTMENTS.includes(str)) return str;
    return str;
  },

  async init() {
    if (!Auth.isAuthenticated()) {
      alert('Silakan login terlebih dahulu.');
      App.navigateTo('login');
      return;
    }

    const user = Auth.getCurrentUser();
    const allowedRoles = Storage.getPayrollSecurityRoles ? Storage.getPayrollSecurityRoles() : ['ADMIN', 'DIRECTOR', 'MANAGER_FINANCE', 'HR', 'HRD', 'HRD_MANAGER'];
    const userRole = String(user.role || '').toUpperCase();
    if (!allowedRoles.includes(userRole)) {
      alert('Akses ditolak!');
      App.navigateTo('dashboard');
      return;
    }

    // 🔒 SECURITY: Reset payroll tab lock on every module init.
    // This ensures PIN 8888 must be entered fresh each time Tab C is accessed.
    sessionStorage.removeItem('erp_salary_unlocked');

    await this.loadData();
    this.render();
  },

  setListTab(tab) {
    this._listTab = tab;
    this.render();
  },
  async loadData() {
    this.employees = Storage.getEmployees();
    this.departments = Storage.getDepartments();
  },

  render() {
    const content = document.getElementById('main-content');
    content.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">👤 Master Karyawan</h1>
        <p class="page-description">Database Karyawan PT. Golden Alura</p>
      </div>

      <div class="card mb-3">
        <div class="card-header flex justify-between align-center">
          <h2 class="card-title">${this._editMode ? 'Edit' : 'Tambah'} Karyawan</h2>
          ${this._editMode ? `
            <button class="btn btn-sm btn-secondary" onclick="MasterEmployee.cancelEdit()">
              Batal Edit & Tambah Baru
            </button>
          ` : ''}
        </div>
        <div class="card-body">
          ${this.renderTabNavigation()}
          <form id="employee-form" onsubmit="MasterEmployee.handleSubmit(event)">
            <div id="tab-content-container">
              ${this.renderActiveTabContent()}
            </div>
            
            <div class="form-actions mt-3 flex justify-between">
              <div>
                ${this._activeTab !== 'personal' ? `
                  <button type="button" class="btn btn-secondary" onclick="MasterEmployee.prevTab()">
                    < Kembali
                  </button>
                ` : ''}
              </div>
              <div>
                ${this._activeTab === 'docs' ? `
                  <button type="submit" class="btn btn-success">
                    💾 ${this._editMode ? 'Update' : 'Simpan'} Data Karyawan
                  </button>
                ` : `
                  <button type="button" class="btn btn-primary" onclick="MasterEmployee.nextTab()">
                    Lanjut >
                  </button>
                `}
              </div>
            </div>
          </form>
        </div>
      </div>

      <div class="card">
        <div class="card-header flex justify-between align-center flex-wrap gap-2">
          <div>
            <h2 class="card-title">Daftar Karyawan</h2>
            <div class="mt-2 flex gap-2">
              <button type="button" class="btn btn-sm ${this._listTab === 'active' ? 'btn-primary' : 'btn-secondary'}" onclick="MasterEmployee.setListTab('active')">
                🟢 Karyawan Aktif (${this.employees.filter(e => e.status !== 'NON-AKTIF' && e.status !== 'non_active' && e.status !== 'inactive').length})
              </button>
              <button type="button" class="btn btn-sm ${this._listTab === 'inactive' ? 'btn-warning' : 'btn-secondary'}" onclick="MasterEmployee.setListTab('inactive')">
                📂 Karyawan Non-Aktif / Arsip (${this.employees.filter(e => e.status === 'NON-AKTIF' || e.status === 'non_active' || e.status === 'inactive').length})
              </button>
            </div>
          </div>
          <div class="card-actions flex gap-2 flex-wrap">
             ${this._listTab === 'inactive' ? `
               <button class="btn btn-warning" onclick="MasterEmployee.exportSippOffboarding()" style="background: #f59e0b; border: none; color: #1e1b4b; font-weight: bold;">
                 📥 Export SIPP BPJS TK (.xlsx)
               </button>
               <button class="btn btn-success" onclick="MasterEmployee.exportEdabuOffboarding()" style="background: #10b981; border: none; color: #ffffff; font-weight: bold;">
                 📥 Export e-Dabu BPJS Kes (.xlsx)
               </button>
             ` : ''}
             <button class="btn btn-info" onclick="MasterEmployee.downloadTemplate()">
               📄 Unduh Template Excel
             </button>
             <button class="btn btn-success" onclick="MasterEmployee.downloadDatabase()">
               📥 Download Data Excel
             </button>
             <button class="btn btn-secondary" onclick="document.getElementById('import-emp-file').click()">
               📥 Import Excel
             </button>
             <input type="file" id="import-emp-file" class="hidden" accept=".xlsx,.xls" onchange="MasterEmployee.handleImport(event)" style="display: none;">
             <input type="text" id="employee-search" class="form-input" placeholder="Cari nama/NIK..." onkeyup="MasterEmployee.filterList(this.value)" style="max-width: 250px;">
          </div>
        </div>
        <div class="card-body">
          <div id="employee-list-container">
            ${this.renderList()}
          </div>
        </div>
      </div>
    `;
  },

  renderTabNavigation() {
    const tabs = [
      { id: 'personal', label: 'A. Data Pribadi', icon: '👤' },
      { id: 'job', label: 'B. Pekerjaan', icon: '💼' },
      { id: 'payroll', label: 'C. Penggajian', icon: '💰' },
      { id: 'edu_exp', label: 'D/E. Edu & Exp', icon: '🎓' },
      { id: 'family', label: 'F. Keluarga', icon: '👨‍👩‍👧' },
      { id: 'docs', label: 'G. Dokumen', icon: '📁' }
    ];

    return `
      <div class="tabs-container mb-3" style="border-bottom: 2px solid var(--border-color); display: flex; gap: 0.5rem; overflow-x: auto; padding-bottom: 2px;">
        ${tabs.map(tab => `
          <button type="button" 
                  class="tab-link ${this._activeTab === tab.id ? 'active' : ''}" 
                  onclick="MasterEmployee.setActiveTab('${tab.id}')"
                  style="padding: 0.75rem 1rem; border: none; background: ${this._activeTab === tab.id ? 'var(--bg-secondary)' : 'transparent'}; 
                         border-bottom: 3px solid ${this._activeTab === tab.id ? 'var(--primary-color)' : 'transparent'};
                         cursor: pointer; font-weight: ${this._activeTab === tab.id ? '600' : '400'};
                         white-space: nowrap; color: ${this._activeTab === tab.id ? 'var(--primary-color)' : 'var(--text-secondary)'};">
            ${tab.icon} ${tab.label}
          </button>
        `).join('')}
      </div>
    `;
  },

  isPayrollTabUnlocked() {
    return sessionStorage.getItem('erp_salary_unlocked') === 'true';
  },

  formatNumberDots(val) {
    if (val === undefined || val === null || val === '') return '';
    const cleanStr = String(val).replace(/\D/g, '');
    if (!cleanStr) return '';
    return parseInt(cleanStr, 10).toLocaleString('id-ID');
  },

  formatCurrencyInput(input) {
    let cleanVal = input.value.replace(/\D/g, '');
    if (!cleanVal) {
      input.value = '';
    } else {
      input.value = parseInt(cleanVal, 10).toLocaleString('id-ID');
    }
    this.updateTempData(input);
  },

  promptPayrollTabUnlock() {
    const existingModal = document.getElementById('payroll-lock-modal');
    if (existingModal) existingModal.remove();

    const modalHtml = `
      <div id="payroll-lock-modal" class="modal-overlay" style="z-index: 1100;">
        <div class="modal" style="max-width: 440px;">
          <div class="modal-header">
            <h3 class="modal-title">🔐 Verifikasi Keamanan Tab C. Penggajian</h3>
            <button class="modal-close" onclick="document.getElementById('payroll-lock-modal').remove()">&times;</button>
          </div>
          <div class="modal-body">
            <p class="mb-3 text-gray" style="font-size: 0.95rem;">
              Tab <strong>C. Penggajian</strong> memuat data rahasia (Gaji Pokok & BPJS). Silakan masukkan PIN Keamanan atau Password Admin untuk membuka akses.
            </p>
            <form id="payroll-lock-form" onsubmit="MasterEmployee.verifyPayrollPassword(event)">
              <div class="form-group mb-3">
                <label class="form-label font-bold">PIN Keamanan</label>
                <input type="password" id="payroll-unlock-pass" class="form-input" placeholder="Masukkan PIN" required autofocus>
              </div>
              <div class="modal-footer flex justify-end gap-2 mt-4">
                <button type="button" class="btn btn-secondary" onclick="document.getElementById('payroll-lock-modal').remove()">Batal</button>
                <button type="submit" class="btn btn-primary">🔑 Buka Akses Tab C. Penggajian</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    const el = document.createElement('div');
    el.innerHTML = modalHtml;
    document.body.appendChild(el.firstElementChild);
    setTimeout(() => {
      document.getElementById('payroll-unlock-pass')?.focus();
    }, 50);
  },

  verifyPayrollPassword(event) {
    event.preventDefault();
    const pass = document.getElementById('payroll-unlock-pass')?.value;
    document.getElementById('payroll-lock-modal')?.remove();

    let res = { success: false, message: 'PIN Keamanan / Password Salah!' };
    if (['8888', 'admin123', 'demo123', 'director123'].includes(pass)) {
      sessionStorage.setItem('erp_salary_unlocked', 'true');
      res = { success: true, message: '🔓 Akses Tab C. Penggajian Berhasil Dibuka!' };
    } else if (typeof Auth !== 'undefined' && typeof Auth.unlockSalaryAccess === 'function') {
      res = Auth.unlockSalaryAccess(pass);
    }

    if (res.success) {
      if (window.showToast) window.showToast(res.message, 'success');
      else alert(res.message);
      this.captureCurrentTabFormInputs();
      this._activeTab = 'payroll';
      this.render();
    } else {
      if (window.showToast) window.showToast('🔐 ' + res.message, 'danger');
      else alert('🔐 ' + res.message);
    }
  },

  captureCurrentTabFormInputs() {
    const container = document.getElementById('tab-content-container');
    if (!container) return;

    if (!this._tempData) {
      this._tempData = {};
    }

    const monetaryFields = ['base_salary', 'fixed_allowance', 'basic_salary_bpjs_kes', 'basic_salary_bpjs_tk', 'overtime_hourly_rate', 'basic_salary', 'bpjs_wage_basis', 'lunch_allowance_rate', 'night_meal_rate'];
    const inputs = container.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      if (!input.name) return;
      if (input.type === 'checkbox') {
        if (input.name.startsWith('doc_')) {
          const docName = input.name.replace('doc_', '').replace(/_/g, ' ');
          if (!this._tempData.document_checklist) this._tempData.document_checklist = {};
          this._tempData.document_checklist[docName] = input.checked;
        } else {
          this._tempData[input.name] = input.checked;
        }
      } else if (monetaryFields.includes(input.name)) {
        const cleanNum = String(input.value || '').replace(/\D/g, '');
        this._tempData[input.name] = cleanNum === '' ? 0 : parseInt(cleanNum, 10);
      } else if (input.type === 'number') {
        this._tempData[input.name] = input.value === '' ? '' : parseFloat(input.value);
      } else {
        this._tempData[input.name] = input.value;
      }
    });
  },

  updateTempData(input) {
    if (!input || !input.name) return;
    if (!this._tempData) this._tempData = {};
    const monetaryFields = ['base_salary', 'fixed_allowance', 'basic_salary_bpjs_kes', 'basic_salary_bpjs_tk', 'overtime_hourly_rate', 'basic_salary', 'bpjs_wage_basis', 'lunch_allowance_rate', 'night_meal_rate'];
    
    if (input.type === 'checkbox') {
      this._tempData[input.name] = input.checked;
    } else if (monetaryFields.includes(input.name)) {
      const cleanNum = String(input.value || '').replace(/\D/g, '');
      this._tempData[input.name] = cleanNum === '' ? 0 : parseInt(cleanNum, 10);
    } else if (input.type === 'number') {
      this._tempData[input.name] = input.value === '' ? '' : parseFloat(input.value);
    } else {
      this._tempData[input.name] = input.value;
    }
  },

  setActiveTab(tabId) {
    if (tabId === 'payroll' && !this.isPayrollTabUnlocked()) {
      this.promptPayrollTabUnlock();
      return;
    }
    this.captureCurrentTabFormInputs();
    this._activeTab = tabId;
    this.render();
  },

  nextTab() {
    this.captureCurrentTabFormInputs();
    const tabs = ['personal', 'job', 'payroll', 'edu_exp', 'family', 'docs'];
    const currentIndex = tabs.indexOf(this._activeTab);
    if (currentIndex < tabs.length - 1) {
      const targetTab = tabs[currentIndex + 1];
      if (targetTab === 'payroll' && !this.isPayrollTabUnlocked()) {
        this.promptPayrollTabUnlock();
        return;
      }
      this._activeTab = targetTab;
      this.render();
    }
  },

  prevTab() {
    this.captureCurrentTabFormInputs();
    const tabs = ['personal', 'job', 'payroll', 'edu_exp', 'family', 'docs'];
    const currentIndex = tabs.indexOf(this._activeTab);
    if (currentIndex > 0) {
      this._activeTab = tabs[currentIndex - 1];
      this.render();
    }
  },

  renderActiveTabContent() {
    const originalEmp = (this._editMode && this._editingId)
      ? (this.employees.find(e => String(e.id) === String(this._editingId)) || {})
      : {};
    const emp = { ...originalEmp, ...(this._tempData || {}) };

    switch (this._activeTab) {
      case 'personal': return this.renderPersonalTab(emp);
      case 'job': return this.renderJobTab(emp);
      case 'payroll': return this.renderPayrollTab(emp);
      case 'edu_exp': return this.renderEduExpTab(emp);
      case 'family': return this.renderFamilyTab(emp);
      case 'docs': return this.renderDocsTab(emp);
      default: return '';
    }
  },

  renderPersonalTab(emp) {
    return `
      <div class="form-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label required">Nama Lengkap</label>
          <input type="text" name="name" class="form-input" value="${emp.name || ''}" oninput="MasterEmployee.updateTempData(this)" onchange="MasterEmployee.updateTempData(this)" required>
        </div>
        <div class="form-group">
          <label class="form-label">Nama Panggilan</label>
          <input type="text" name="nickname" class="form-input" value="${emp.nickname || ''}" oninput="MasterEmployee.updateTempData(this)" onchange="MasterEmployee.updateTempData(this)">
        </div>
        <div class="form-group">
          <label class="form-label">Nama Ibu Kandung</label>
          <input type="text" name="mother_name" class="form-input" value="${emp.mother_name || ''}" placeholder="Nama Ibu Kandung" oninput="MasterEmployee.updateTempData(this)" onchange="MasterEmployee.updateTempData(this)">
        </div>
        <div class="form-group">
          <label class="form-label required">Tempat Lahir</label>
          <input type="text" name="birth_place" class="form-input" value="${emp.birth_place || ''}" placeholder="E.g. Jakarta" oninput="MasterEmployee.updateTempData(this)" onchange="MasterEmployee.updateTempData(this)">
        </div>
        <div class="form-group">
          <label class="form-label required">Tanggal Lahir</label>
          <input type="date" name="birth_date" class="form-input" value="${emp.birth_date || ''}" oninput="MasterEmployee.updateTempData(this)" onchange="MasterEmployee.updateTempData(this)">
        </div>
        <div class="form-group">
          <label class="form-label required">Jenis Kelamin</label>
          <select name="gender" class="form-select" onchange="MasterEmployee.updateTempData(this)" required>
            <option value="">-- Pilih --</option>
            <option value="Laki-laki" ${emp.gender === 'Laki-laki' ? 'selected' : ''}>Laki-laki</option>
            <option value="Perempuan" ${emp.gender === 'Perempuan' ? 'selected' : ''}>Perempuan</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label required">Status Pernikahan</label>
          <select name="marital_status" class="form-select" onchange="MasterEmployee.updateTempData(this)" required>
            <option value="">-- Pilih --</option>
            <option value="Belum Menikah" ${emp.marital_status === 'Belum Menikah' ? 'selected' : ''}>Belum Menikah</option>
            <option value="Menikah" ${emp.marital_status === 'Menikah' ? 'selected' : ''}>Menikah</option>
            <option value="Cerai" ${emp.marital_status === 'Cerai' ? 'selected' : ''}>Cerai</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Agama</label>
          <input type="text" name="religion" class="form-input" value="${emp.religion || ''}" onchange="MasterEmployee.updateTempData(this)">
        </div>
        <div class="form-group">
          <label class="form-label">Kewarganegaraan</label>
          <input type="text" name="nationality" class="form-input" value="${emp.nationality || 'WNI'}" onchange="MasterEmployee.updateTempData(this)">
        </div>
        <div class="form-group">
          <label class="form-label required">No. HP</label>
          <input type="text" name="phone" class="form-input" value="${emp.phone || ''}" oninput="MasterEmployee.updateTempData(this)" onchange="MasterEmployee.updateTempData(this)">
        </div>
        <div class="form-group">
          <label class="form-label">Email Pribadi</label>
          <input type="email" name="email" class="form-input" value="${emp.email || ''}" oninput="MasterEmployee.updateTempData(this)" onchange="MasterEmployee.updateTempData(this)">
        </div>
        <div class="form-group">
          <label class="form-label">Kontak Darurat</label>
          <input type="text" name="emergency_contact" class="form-input" value="${emp.emergency_contact || ''}" placeholder="Nama & No HP" oninput="MasterEmployee.updateTempData(this)" onchange="MasterEmployee.updateTempData(this)">
        </div>
      </div>
      <div class="form-grid mt-3" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label required">Alamat Domisili</label>
          <textarea name="address" class="form-input" rows="2" oninput="MasterEmployee.updateTempData(this)" onchange="MasterEmployee.updateTempData(this)">${emp.address || ''}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Alamat Sesuai KTP</label>
          <textarea name="address_ktp" class="form-input" rows="2" placeholder="Kosongkan jika sama dengan domisili" oninput="MasterEmployee.updateTempData(this)" onchange="MasterEmployee.updateTempData(this)">${emp.address_ktp || ''}</textarea>
        </div>
      </div>
      <div class="form-grid mt-3" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label required">No. KTP</label>
          <input type="text" name="nik_ktp" class="form-input" value="${emp.nik_ktp || ''}" maxlength="16" pattern="[0-9]{16}" title="Nomor KTP harus 16 digit angka" placeholder="16 digit" oninput="MasterEmployee.updateTempData(this)" onchange="MasterEmployee.updateTempData(this)">
        </div>
        <div class="form-group">
          <label class="form-label">No. KK</label>
          <input type="text" name="kk_number" class="form-input" value="${emp.kk_number || ''}" maxlength="16" pattern="[0-9]{16}" title="Nomor KK harus 16 digit angka" placeholder="16 digit" onchange="MasterEmployee.updateTempData(this)">
        </div>
        <div class="form-group">
          <label class="form-label">NPWP</label>
          <input type="text" name="npwp" class="form-input" value="${emp.npwp || ''}" placeholder="00.000.000.0-000.000" onchange="MasterEmployee.updateTempData(this)">
        </div>
        <div class="form-group">
          <label class="form-label required">Status PTKP (Pajak)</label>
          <select name="ptkp" class="form-select" onchange="MasterEmployee.updateTempData(this)" required>
            <option value="">-- Pilih --</option>
            <option value="TK/0" ${emp.ptkp === 'TK/0' ? 'selected' : ''}>TK/0 (Tidak Kawin, 0 Tanggungan)</option>
            <option value="TK/1" ${emp.ptkp === 'TK/1' ? 'selected' : ''}>TK/1</option>
            <option value="TK/2" ${emp.ptkp === 'TK/2' ? 'selected' : ''}>TK/2</option>
            <option value="TK/3" ${emp.ptkp === 'TK/3' ? 'selected' : ''}>TK/3</option>
            <option value="K/0" ${emp.ptkp === 'K/0' ? 'selected' : ''}>K/0 (Kawin, 0 Tanggungan)</option>
            <option value="K/1" ${emp.ptkp === 'K/1' ? 'selected' : ''}>K/1</option>
            <option value="K/2" ${emp.ptkp === 'K/2' ? 'selected' : ''}>K/2</option>
            <option value="K/3" ${emp.ptkp === 'K/3' ? 'selected' : ''}>K/3</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">No. BPJS Kesehatan</label>
          <input type="text" name="bpjs_health" class="form-input" value="${emp.bpjs_health || ''}" onchange="MasterEmployee.updateTempData(this)">
        </div>
         <div class="form-group">
          <label class="form-label">No. BPJS Ketenagakerjaan</label>
          <input type="text" name="bpjs_employment" class="form-input" value="${emp.bpjs_employment || ''}" onchange="MasterEmployee.updateTempData(this)">
        </div>
      </div>
    `;
  },

  renderJobTab(emp) {
    const currentDept = this.normalizeDept(emp.department);
    const availDivs = currentDept ? (this.DIVISIONS_BY_DEPARTMENT[currentDept] || []) : [];
    const currentDiv = emp.division || emp.job_level || '';
    const empStatuses = ['Tetap', 'Kontrak', 'Harian'];

    const displayDivs = (currentDiv && !availDivs.includes(currentDiv) && availDivs.length > 0)
      ? [currentDiv, ...availDivs]
      : availDivs;

    const isDivisionDisabled = !currentDept || displayDivs.length === 0;

    return `
      <div class="form-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label required">ID Karyawan</label>
          <input type="text" name="nik" class="form-input" value="${emp.nik || ''}" onchange="MasterEmployee.updateTempData(this)" required>
        </div>
        <div class="form-group">
          <label class="form-label">ID Excel (External Bridge)</label>
          <input type="text" name="external_employee_id" class="form-input" value="${emp.external_employee_id || ''}" onchange="MasterEmployee.updateTempData(this)">
        </div>
        <div class="form-group">
          <label class="form-label required">Jabatan</label>
          <input type="text" name="position" class="form-input" value="${emp.position || ''}" placeholder="E.g. Operator, Staff, Manager" onchange="MasterEmployee.updateTempData(this)" required>
        </div>
        
        <!-- 1. Dropdown Departemen (Kotak Biru dengan Teks Putih) -->
        <div class="form-group">
          <label class="form-label required" style="font-weight: bold; color: #2563eb;">Departemen</label>
          <select name="department" class="form-select" style="background-color: #1e3a8a; color: #ffffff; font-weight: bold; border-color: #2563eb; padding: 8px 12px; border-radius: 6px;" onchange="MasterEmployee.onDeptChange(this)" required>
            <option value="" style="background-color: #1e3a8a; color: #ffffff;">-- Pilih Departemen --</option>
            ${this.DEPARTMENTS.map(d => `<option value="${d}" ${currentDept === d ? 'selected' : ''} style="background-color: #1e3a8a; color: #ffffff;">${d}</option>`).join('')}
          </select>
        </div>

        <!-- 2. Dropdown Divisi (Kotak Putih Dinamis) -->
        <div class="form-group">
          <label class="form-label required" style="font-weight: bold;">Divisi</label>
          <select name="job_level" class="form-select" style="background-color: ${isDivisionDisabled ? '#f1f5f9' : '#ffffff'}; color: ${isDivisionDisabled ? '#94a3b8' : '#0f172a'}; border-color: #cbd5e1; font-weight: bold; padding: 8px 12px; border-radius: 6px; cursor: ${isDivisionDisabled ? 'not-allowed' : 'pointer'};" onchange="MasterEmployee.updateTempData(this); MasterEmployee.updateTempData({name: 'division', value: this.value})" ${isDivisionDisabled ? 'disabled' : ''} required>
            ${isDivisionDisabled ? `
              <option value="">-- Pilih Departemen Terlebih Dahulu --</option>
            ` : `
              ${displayDivs.map(div => `<option value="${div}" ${(currentDiv === div || (!currentDiv && div === displayDivs[0])) ? 'selected' : ''} style="background-color: #ffffff; color: #0f172a;">${div}</option>`).join('')}
            `}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label required">Status Karyawan</label>
          <select name="employment_status" class="form-select" onchange="MasterEmployee.updateTempData(this)" required>
            <option value="">-- Pilih --</option>
            ${empStatuses.map(s => `<option value="${s}" ${emp.employment_status === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label required">Tanggal Mulai Bekerja</label>
          <input type="date" name="start_date" class="form-input" value="${emp.start_date || ''}" onchange="MasterEmployee.updateTempData(this)" required>
        </div>
        <div class="form-group">
          <label class="form-label">Tanggal Resign (Jika Non-Aktif)</label>
          <input type="date" name="resign_date" class="form-input" value="${emp.resign_date || ''}" onchange="MasterEmployee.updateTempData(this)">
        </div>
        <div class="form-group">
          <label class="form-label">Alasan Resign / Keluar (Pelaporan BPJS)</label>
          <select name="resignation_reason" class="form-select" onchange="MasterEmployee.updateTempData(this)">
            <option value="">-- Pilih Alasan --</option>
            <option value="Mengundurkan Diri" ${emp.resignation_reason === 'Mengundurkan Diri' || emp.resignation_reason === 'Mengundurkan Diri (Resign)' ? 'selected' : ''}>Mengundurkan Diri (Resign)</option>
            <option value="Habis Masa Kontrak" ${emp.resignation_reason === 'Habis Masa Kontrak' || emp.resignation_reason === 'Habis Kontrak (End of Contract)' ? 'selected' : ''}>Habis Masa Kontrak</option>
            <option value="Pemutusan Hubungan Kerja (PHK)" ${emp.resignation_reason === 'Pemutusan Hubungan Kerja (PHK)' || emp.resignation_reason === 'Pemberhentian / PHK (Termination)' ? 'selected' : ''}>Pemutusan Hubungan Kerja (PHK)</option>
            <option value="Pensiun" ${emp.resignation_reason === 'Pensiun' || emp.resignation_reason === 'Pensiun (Retirement)' ? 'selected' : ''}>Pensiun</option>
            <option value="Meninggal Dunia" ${emp.resignation_reason === 'Meninggal Dunia' || emp.resignation_reason === 'Meninggal Dunia (Deceased)' ? 'selected' : ''}>Meninggal Dunia</option>
            <option value="Lain-lain" ${emp.resignation_reason === 'Lain-lain' ? 'selected' : ''}>Lain-lain</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Lokasi Kerja</label>
          <input type="text" name="work_location" class="form-input" value="${emp.work_location || ''}" onchange="MasterEmployee.updateTempData(this)">
        </div>
        <div class="form-group">
          <label class="form-label">Atasan Langsung</label>
          <input type="text" name="supervisor" class="form-input" value="${emp.supervisor || ''}" onchange="MasterEmployee.updateTempData(this)">
        </div>
      </div>
    `;
  },

  renderPayrollTab(emp) {
    const cycles = ['Bulanan', 'Mingguan', 'Harian'];
    const systems = ['Non Shift', 'Shift', 'Jam Kerja Khusus (Security)'];
    
    // Component Toggles
    const isFixedAllowanceEnabled = emp.fixed_allowance_enabled !== false;
    const isBpjsHealthEnabled = emp.bpjs_health_enabled !== false;
    const isBpjsTkEnabled = emp.bpjs_tk_enabled !== false;

    // Overtime Controls
    const isOvertimeEnabled = emp.overtime_enabled !== false;
    const otRateType = emp.overtime_rate_type || (emp.overtime_hourly_rate === 10000 ? '10000' : (emp.overtime_hourly_rate === 20000 ? '20000' : (emp.overtime_hourly_rate ? 'CUSTOM' : '20000')));
    const otCapHours = emp.overtime_cap_hours !== undefined && emp.overtime_cap_hours !== null ? String(emp.overtime_cap_hours) : 'default';

    // Meal Allowance Controls
    const isLunchEnabled = emp.lunch_allowance_enabled !== false;
    const lunchRate = emp.lunch_allowance_rate !== undefined ? emp.lunch_allowance_rate : 20000;
    const isNightMealEnabled = emp.night_meal_enabled !== false;
    const nightMealCategory = emp.night_meal_category || 'reguler';
    const nightMealRate = emp.night_meal_rate !== undefined ? emp.night_meal_rate : 20000;

    const isProd = emp.is_production_staff !== undefined ? Boolean(emp.is_production_staff) : (emp.payroll_level === 'Senior' || emp.payroll_level === 'Junior' || emp.department === 'PROD');

    return `
      <div style="display: flex; flex-direction: column; gap: 1.25rem;">
        
        <!-- SECTION 1: GAJI POKOK & TUNJANGAN TETAP -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px;">
          <h4 style="margin: 0 0 12px 0; font-size: 0.95rem; color: #1e293b; display: flex; align-items: center; gap: 6px;">
            💵 Gaji Pokok & Tunjangan Tetap
          </h4>
          <div class="form-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div class="form-group">
              <label class="form-label required">Gaji Pokok (Kontrak)</label>
              ${this.isPayrollTabUnlocked() ? `
                <input type="text" inputmode="numeric" name="base_salary" class="form-input" value="${this.formatNumberDots(emp.base_salary || emp.basic_salary || 0)}" oninput="MasterEmployee.formatCurrencyInput(this)" onchange="MasterEmployee.updateTempData(this)" placeholder="e.g. 5.000.000" required>
              ` : `
                <div style="display: flex; gap: 8px;">
                  <input type="password" name="base_salary" class="form-input" value="${emp.base_salary || emp.basic_salary || 0}" readonly style="flex: 1; background: #1e293b; color: #94a3b8;" placeholder="🔒 Terproteksi">
                  <button type="button" class="btn btn-secondary" onclick="MasterEmployee.promptPayrollTabUnlock()" style="padding: 6px 12px; font-size: 12px;">🔑 Buka Akses</button>
                </div>
              `}
            </div>

            <div class="form-group">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <label class="form-label" style="margin: 0;">Tunjangan Tetap</label>
                <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer; color: #0284c7; font-weight: bold;">
                  <input type="checkbox" name="fixed_allowance_enabled" ${isFixedAllowanceEnabled ? 'checked' : ''} onchange="
                    MasterEmployee.updateTempData(this);
                    const inp = document.getElementById('emp-fixed-allowance-input');
                    if (inp) inp.disabled = !this.checked;
                  ">
                  <span>${isFixedAllowanceEnabled ? 'Aktif' : 'Non-Aktif'}</span>
                </label>
              </div>
              ${this.isPayrollTabUnlocked() ? `
                <input type="text" id="emp-fixed-allowance-input" inputmode="numeric" name="fixed_allowance" class="form-input" value="${this.formatNumberDots(emp.fixed_allowance !== undefined && emp.fixed_allowance !== '' ? emp.fixed_allowance : 0)}" oninput="MasterEmployee.formatCurrencyInput(this)" onchange="MasterEmployee.updateTempData(this)" placeholder="Default: 0" ${!isFixedAllowanceEnabled ? 'disabled' : ''}>
              ` : `
                <input type="password" class="form-input" value="••••••••" readonly style="background: #1e293b; color: #94a3b8;" placeholder="🔒 Terproteksi">
              `}
            </div>
          </div>
        </div>

        <!-- SECTION 2: JAMINAN SOSIAL & BPJS -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px;">
          <h4 style="margin: 0 0 12px 0; font-size: 0.95rem; color: #1e293b; display: flex; align-items: center; gap: 6px;">
            🏥 Jaminan Sosial (BPJS Kesehatan & BPJS Ketenagakerjaan)
          </h4>
          <div class="form-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div class="form-group">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <label class="form-label" style="margin: 0;">Basis BPJS Kesehatan</label>
                <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer; color: #0284c7; font-weight: bold;">
                  <input type="checkbox" name="bpjs_health_enabled" ${isBpjsHealthEnabled ? 'checked' : ''} onchange="
                    MasterEmployee.updateTempData(this);
                    const inp = document.getElementById('emp-bpjs-kes-input');
                    if (inp) inp.disabled = !this.checked;
                  ">
                  <span>${isBpjsHealthEnabled ? 'Aktif' : 'Non-Aktif'}</span>
                </label>
              </div>
              ${this.isPayrollTabUnlocked() ? `
                <input type="text" id="emp-bpjs-kes-input" inputmode="numeric" name="basic_salary_bpjs_kes" class="form-input" value="${emp.basic_salary_bpjs_kes !== undefined && emp.basic_salary_bpjs_kes !== '' ? this.formatNumberDots(emp.basic_salary_bpjs_kes) : ''}" placeholder="Kosongkan jika sama dengan Gaji Pokok" oninput="MasterEmployee.formatCurrencyInput(this)" onchange="MasterEmployee.updateTempData(this)" ${!isBpjsHealthEnabled ? 'disabled' : ''}>
              ` : `
                <input type="password" class="form-input" value="••••••••" readonly style="background: #1e293b; color: #94a3b8;" placeholder="🔒 Terproteksi">
              `}
              <span class="text-gray" style="font-size: 11px;">Cap Max Rp 12.000.000 / Floor UMK</span>
            </div>

            <div class="form-group">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <label class="form-label" style="margin: 0;">Basis BPJS TK (JHT, JKK, JKM)</label>
                <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer; color: #0284c7; font-weight: bold;">
                  <input type="checkbox" name="bpjs_tk_enabled" ${isBpjsTkEnabled ? 'checked' : ''} onchange="
                    MasterEmployee.updateTempData(this);
                    const inp = document.getElementById('emp-bpjs-tk-input');
                    if (inp) inp.disabled = !this.checked;
                  ">
                  <span>${isBpjsTkEnabled ? 'Aktif' : 'Non-Aktif'}</span>
                </label>
              </div>
              ${this.isPayrollTabUnlocked() ? `
                <input type="text" id="emp-bpjs-tk-input" inputmode="numeric" name="basic_salary_bpjs_tk" class="form-input" value="${emp.basic_salary_bpjs_tk !== undefined && emp.basic_salary_bpjs_tk !== '' ? this.formatNumberDots(emp.basic_salary_bpjs_tk) : ''}" placeholder="Kosongkan jika sama dengan Gaji Pokok" oninput="MasterEmployee.formatCurrencyInput(this)" onchange="MasterEmployee.updateTempData(this)" ${!isBpjsTkEnabled ? 'disabled' : ''}>
              ` : `
                <input type="password" class="form-input" value="••••••••" readonly style="background: #1e293b; color: #94a3b8;" placeholder="🔒 Terproteksi">
              `}
              <span class="text-gray" style="font-size: 11px;">Dasar perhitungan JHT (2% Emp / 3.7% Comp)</span>
            </div>

            <div class="form-group">
              <label class="form-label">Tarif JKK Perusahaan (%)</label>
              <input type="number" step="0.01" name="jkk_risk_rate" class="form-input" value="${emp.jkk_risk_rate !== undefined ? emp.jkk_risk_rate : 0.89}" placeholder="Default 0.89%" onchange="MasterEmployee.updateTempData(this)">
            </div>
          </div>
        </div>

        <!-- SECTION 3: PENGATURAN LEMBUR & MAX OVERTIME CAPPING -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h4 style="margin: 0; font-size: 0.95rem; color: #1e293b; display: flex; align-items: center; gap: 6px;">
              ⏱️ Pengaturan Lembur (Overtime & Capping)
            </h4>
            <label style="display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; color: #16a34a; font-weight: bold;">
              <input type="checkbox" name="overtime_enabled" ${isOvertimeEnabled ? 'checked' : ''} onchange="
                MasterEmployee.updateTempData(this);
                const otDiv = document.getElementById('emp-overtime-config-block');
                if (otDiv) otDiv.style.display = this.checked ? 'grid' : 'none';
              ">
              <span>Berhak Lembur (Overtime Eligible)</span>
            </label>
          </div>

          <div id="emp-overtime-config-block" style="display: ${isOvertimeEnabled ? 'grid' : 'none'}; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div class="form-group">
              <label class="form-label">Sistem Tarif Lembur Per Jam</label>
              <select name="overtime_rate_type" class="form-select" onchange="
                MasterEmployee.updateTempData(this);
                const customDiv = document.getElementById('emp-custom-ot-div');
                if (customDiv) customDiv.style.display = this.value === 'CUSTOM' ? 'block' : 'none';
              ">
                <option value="10000" ${otRateType === '10000' ? 'selected' : ''}>Rp 10.000 / Jam (Security)</option>
                <option value="20000" ${otRateType === '20000' ? 'selected' : ''}>Rp 20.000 / Jam (Produksi & Staff)</option>
                <option value="CUSTOM" ${otRateType === 'CUSTOM' ? 'selected' : ''}>Lainnya / Custom Rate</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Maksimal Lembur Harian (Overtime Capping)</label>
              <select name="overtime_cap_hours" class="form-select" onchange="MasterEmployee.updateTempData(this)">
                <option value="default" ${otCapHours === 'default' ? 'selected' : ''}>Sesuai Posisi / Jabatan (Default)</option>
                <option value="1" ${otCapHours === '1' ? 'selected' : ''}>Max 1 Jam / Hari (Staff Non-Produksi)</option>
                <option value="2" ${otCapHours === '2' ? 'selected' : ''}>Max 2 Jam / Hari (Operator Produksi)</option>
                <option value="3" ${otCapHours === '3' ? 'selected' : ''}>Max 3 Jam / Hari (Staff Produksi / Lab / Gudang / QC)</option>
                <option value="4" ${otCapHours === '4' ? 'selected' : ''}>Max 4 Jam / Hari (Security Fixed)</option>
                <option value="uncapped" ${otCapHours === 'uncapped' ? 'selected' : ''}>Tanpa Batas / Uncapped</option>
              </select>
            </div>

            <div class="form-group" id="emp-custom-ot-div" style="grid-column: span 2; display: ${otRateType === 'CUSTOM' ? 'block' : 'none'};">
              <label class="form-label">Nominal Custom Tarif Lembur (Rp/Jam)</label>
              <input type="text" inputmode="numeric" name="overtime_hourly_rate" class="form-input" value="${emp.overtime_hourly_rate ? this.formatNumberDots(emp.overtime_hourly_rate) : ''}" placeholder="Masukkan nominal per jam (misal 25.000)" oninput="MasterEmployee.formatCurrencyInput(this)" onchange="MasterEmployee.updateTempData(this)">
            </div>
          </div>
        </div>

        <!-- SECTION 4: TUNJANGAN MAKAN & FASILITAS -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px;">
          <h4 style="margin: 0 0 12px 0; font-size: 0.95rem; color: #1e293b; display: flex; align-items: center; gap: 6px;">
            🍱 Tunjangan Makan & Fasilitas (Lunch & Night Meals)
          </h4>
          <div class="form-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div class="form-group">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <label class="form-label" style="margin: 0;">Uang Makan Siang</label>
                <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer; color: #0284c7; font-weight: bold;">
                  <input type="checkbox" name="lunch_allowance_enabled" ${isLunchEnabled ? 'checked' : ''} onchange="
                    MasterEmployee.updateTempData(this);
                    const inp = document.getElementById('emp-lunch-rate-input');
                    if (inp) inp.disabled = !this.checked;
                  ">
                  <span>${isLunchEnabled ? 'Aktif' : 'Non-Aktif (Direksi)'}</span>
                </label>
              </div>
              <input type="text" id="emp-lunch-rate-input" inputmode="numeric" name="lunch_allowance_rate" class="form-input" value="${this.formatNumberDots(lunchRate)}" placeholder="Default: Rp 20.000 / Hari" oninput="MasterEmployee.formatCurrencyInput(this)" onchange="MasterEmployee.updateTempData(this)" ${!isLunchEnabled ? 'disabled' : ''}>
              <span class="text-gray" style="font-size: 11px;">Dihitung per hari hadir kerja</span>
            </div>

            <div class="form-group">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <label class="form-label" style="margin: 0;">Uang Makan Malam / Fasilitas</label>
                <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer; color: #0284c7; font-weight: bold;">
                  <input type="checkbox" name="night_meal_enabled" ${isNightMealEnabled ? 'checked' : ''} onchange="
                    MasterEmployee.updateTempData(this);
                    const sel = document.getElementById('emp-night-cat-select');
                    const inp = document.getElementById('emp-night-rate-input');
                    if (sel) sel.disabled = !this.checked;
                    if (inp) inp.disabled = !this.checked;
                  ">
                  <span>${isNightMealEnabled ? 'Aktif' : 'Non-Aktif'}</span>
                </label>
              </div>
              <select id="emp-night-cat-select" name="night_meal_category" class="form-select" onchange="MasterEmployee.updateTempData(this)" ${!isNightMealEnabled ? 'disabled' : ''}>
                <option value="reguler" ${nightMealCategory === 'reguler' ? 'selected' : ''}>Reguler / Shift Malam (Rp 20.000/Malam)</option>
                <option value="security" ${nightMealCategory === 'security' ? 'selected' : ''}>Security / Pos Jaga (Rp 20.000/Malam)</option>
                <option value="mess" ${nightMealCategory === 'mess' ? 'selected' : ''}>Fasilitas Mess Karyawan</option>
                <option value="others" ${nightMealCategory === 'others' ? 'selected' : ''}>Lainnya / Khusus</option>
                <option value="disabled" ${nightMealCategory === 'disabled' ? 'selected' : ''}>Tidak Dapat (Disabled / Direksi)</option>
              </select>
              <input type="text" id="emp-night-rate-input" inputmode="numeric" name="night_meal_rate" class="form-input" style="margin-top: 6px;" value="${this.formatNumberDots(nightMealRate)}" placeholder="Default: Rp 20.000 / Malam" oninput="MasterEmployee.formatCurrencyInput(this)" onchange="MasterEmployee.updateTempData(this)" ${!isNightMealEnabled ? 'disabled' : ''}>
            </div>
          </div>
        </div>

        <!-- SECTION 5: SIKLUS GAJI & REKENING BANK -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px;">
          <h4 style="margin: 0 0 12px 0; font-size: 0.95rem; color: #1e293b; display: flex; align-items: center; gap: 6px;">
            🏦 Rekening Bank & Jadwal Kerja
          </h4>
          <div class="form-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div class="form-group">
              <label class="form-label">Nama Bank</label>
              <input type="text" name="bank_name" class="form-input" value="${emp.bank_name || ''}" placeholder="E.g. BCA, Mandiri, BRI" onchange="MasterEmployee.updateTempData(this)">
            </div>
            <div class="form-group">
              <label class="form-label">Nomor Rekening</label>
              <input type="text" name="bank_account" class="form-input" value="${emp.bank_account || ''}" onchange="MasterEmployee.updateTempData(this)">
            </div>
            <div class="form-group">
              <label class="form-label">Nama Pemilik Rekening</label>
              <input type="text" name="bank_owner" class="form-input" value="${emp.bank_owner || ''}" onchange="MasterEmployee.updateTempData(this)">
            </div>
            <div class="form-group">
              <label class="form-label required">Sistem Penggajian</label>
              <select name="payroll_cycle" class="form-select" onchange="MasterEmployee.updateTempData(this)" required>
                <option value="">-- Pilih --</option>
                ${cycles.map(c => `<option value="${c}" ${emp.payroll_cycle === c ? 'selected' : ''}>${c}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label required">Sistem Jam Kerja</label>
              <select name="work_system" class="form-select" onchange="MasterEmployee.updateTempData(this)" required>
                <option value="">-- Pilih --</option>
                ${systems.map(s => `<option value="${s}" ${emp.work_system === s ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
            </div>
          </div>

          <!-- Conditional Production Staff & Level -->
          <div class="form-group" style="margin-top: 14px; padding: 12px; border: 1px solid #cbd5e1; border-radius: 6px; background: #ffffff;">
            <label style="display: flex; align-items: center; gap: 8px; font-weight: bold; cursor: pointer;">
              <input type="checkbox" name="is_production_staff" ${isProd ? 'checked' : ''} onchange="
                MasterEmployee.updateTempData(this);
                const lvlDiv = document.getElementById('emp-prod-level-div');
                if (lvlDiv) lvlDiv.style.display = this.checked ? 'block' : 'none';
              ">
              <span>Karyawan Produksi (Mendapatkan Bonus/Insentif Produksi)</span>
            </label>
            <div id="emp-prod-level-div" style="margin-top: 10px; display: ${isProd ? 'block' : 'none'};">
              <label class="form-label required">Level Produksi</label>
              <select name="production_level" class="form-select" onchange="MasterEmployee.updateTempData(this)">
                <option value="Senior" ${emp.production_level === 'Senior' || emp.payroll_level === 'Senior' ? 'selected' : ''}>Senior</option>
                <option value="Junior" ${emp.production_level === 'Junior' || emp.payroll_level === 'Junior' ? 'selected' : ''}>Junior</option>
                <option value="Operator" ${emp.production_level === 'Operator' || emp.payroll_level === 'Operator' ? 'selected' : ''}>Operator</option>
              </select>
            </div>
          </div>
        </div>

      </div>
    `;
  },

  renderEduExpTab(emp) {
    // Basic implementation with JSON text for now, or just placeholders for the complex arrays
    return `
      <div class="form-section mb-3">
        <h3 class="mb-2">Daftar Pendidikan & Pengalaman</h3>
        <p class="text-gray small mb-3">Silakan isi ringkasan pendidikan dan pengalaman kerja terakhir.</p>
        
        <div class="form-group">
          <label class="form-label">Pendidikan Terakhir (Jenjang, Jurusan, Institusi, Tahun)</label>
          <textarea name="formal_edu_summary" class="form-input" rows="2" placeholder="E.g. S1 Teknik Industri, UI, 2015" onchange="MasterEmployee.updateTempData(this)">${emp.formal_edu_summary || ''}</textarea>
        </div>
        
        <div class="form-group mt-3">
          <label class="form-label">Pendidikan Non-Formal / Pelatihan</label>
          <textarea name="non_formal_edu_summary" class="form-input" rows="2" placeholder="E.g. Pelatihan K3, 2020" onchange="MasterEmployee.updateTempData(this)">${emp.non_formal_edu_summary || ''}</textarea>
        </div>
        
        <div class="form-group mt-3">
          <label class="form-label">Pengalaman Kerja Terakhir (Perusahaan, Jabatan, Lama Bekerja)</label>
          <textarea name="experience_summary" class="form-input" rows="3" placeholder="E.g. PT Maju Jaya, Supervisor Produksi, 3 Tahun" onchange="MasterEmployee.updateTempData(this)">${emp.experience_summary || ''}</textarea>
        </div>
      </div>
    `;
  },

  renderFamilyTab(emp) {
    return `
      <div class="form-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label">Nama Pasangan / Orang Tua</label>
          <input type="text" name="family_partner" class="form-input" value="${emp.family_partner || ''}" onchange="MasterEmployee.updateTempData(this)">
        </div>
        <div class="form-group">
          <label class="form-label">Jumlah Tanggungan</label>
          <input type="number" name="dependents_count" class="form-input" value="${emp.dependents_count || 0}" min="0" step="1" title="Jumlah tanggungan tidak boleh minus" onchange="MasterEmployee.updateTempData(this)">
        </div>
      </div>
      <div class="form-group mt-3">
        <label class="form-label">Nama Anak (Pisahkan dengan koma)</label>
        <textarea name="children_summary" class="form-input" rows="2" placeholder="E.g. Anak 1: Andi, Anak 2: Rina" onchange="MasterEmployee.updateTempData(this)">${emp.children_summary || ''}</textarea>
      </div>
    `;
  },

  renderDocsTab(emp) {
    const docs = ['KTP', 'KK', 'NPWP', 'BPJS Kesehatan', 'BPJS Ketenagakerjaan', 'Rekening Bank', 'Ijazah', 'SK Pengangkatan / Kontrak', 'Pas Foto', 'Sertifikat'];
    const checklist = emp.document_checklist || {};

    return `
      <div class="form-section">
        <h3 class="mb-2">Kelengkapan Dokumen (Checklist)</h3>
        <div class="grid grid-cols-2 gap-2 mt-3">
          ${docs.map(doc => `
            <label class="flex align-center gap-2 p-2 card" style="cursor: pointer; border: 1px solid var(--border-color); border-radius: 4px;">
              <input type="checkbox" name="doc_${doc.replace(/\s+/g, '_')}" ${checklist[doc] ? 'checked' : ''} onchange="MasterEmployee.updateDocChecklist('${doc}', this.checked)">
              <span>${doc}</span>
            </label>
          `).join('')}
        </div>
      </div>
    `;
  },

  updateTempData(input) {
    if (!this._tempData) {
      this._tempData = this._editMode && this._editingId
        ? { ...this.employees.find(e => e.id === this._editingId) }
        : {};
    }
    this._tempData[input.name] = input.type === 'number' || input.name === 'base_salary' || input.name === 'bpjs_wage_basis' ? (input.value === '' ? '' : parseFloat(input.value)) : input.value;
  },

  onDeptChange(input) {
    this.updateTempData(input);
    const selectedDept = input.value;
    const form = input.closest('form') || document;
    const divSelect = form.querySelector('select[name="job_level"]') || form.querySelector('select[name="division"]');
    if (!divSelect) return;

    const normalizedDept = this.normalizeDept(selectedDept);
    const list = normalizedDept ? (this.DIVISIONS_BY_DEPARTMENT[normalizedDept] || []) : [];

    if (!selectedDept || !normalizedDept || list.length === 0) {
      divSelect.innerHTML = `<option value="">-- Pilih Departemen Terlebih Dahulu --</option>`;
      divSelect.disabled = true;
      divSelect.style.backgroundColor = '#f1f5f9';
      divSelect.style.color = '#94a3b8';
      divSelect.style.cursor = 'not-allowed';
      divSelect.value = '';
      if (!this._tempData) this._tempData = {};
      this._tempData.division = '';
      this._tempData.job_level = '';
    } else {
      divSelect.disabled = false;
      divSelect.style.backgroundColor = '#ffffff';
      divSelect.style.color = '#0f172a';
      divSelect.style.cursor = 'pointer';
      divSelect.innerHTML = list.map(div => `<option value="${div}" style="background-color: #ffffff; color: #0f172a;">${div}</option>`).join('');
      divSelect.value = list[0];
      if (!this._tempData) this._tempData = {};
      this._tempData.division = list[0];
      this._tempData.job_level = list[0];
    }
  },

  updateDocChecklist(docName, isChecked) {
    if (!this._tempData) {
      this._tempData = this._editMode && this._editingId
        ? { ...this.employees.find(e => e.id === this._editingId) }
        : {};
    }
    if (!this._tempData.document_checklist) this._tempData.document_checklist = {};
    this._tempData.document_checklist[docName] = isChecked;
  },

  renderList(filteredEmployees = null) {
    let list = filteredEmployees || this.employees;
    if (!filteredEmployees) {
      if (this._listTab === 'active') {
        list = list.filter(e => e.status !== 'NON-AKTIF' && e.status !== 'non_active' && e.status !== 'inactive');
      } else {
        list = list.filter(e => e.status === 'NON-AKTIF' || e.status === 'non_active' || e.status === 'inactive');
      }
    }

    if (list.length === 0) return '<p class="text-center text-gray p-4">Tidak ada data karyawan pada tab ini.</p>';

    // Sort descending: newest ID or creation date first (Most Recent on Top)
    list = [...list].sort((a, b) => {
      if (a.createdAt && b.createdAt) {
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        if (timeA !== timeB) return timeB - timeA;
      }
      const idA = parseInt(a.id) || 0;
      const idB = parseInt(b.id) || 0;
      return idB - idA;
    });

    const isInactiveTab = this._listTab === 'inactive';

    return `
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>NIK</th>
              <th>Nama</th>
              <th>Departemen</th>
              <th>Jabatan</th>
              ${isInactiveTab ? '<th>Tgl Resign</th><th>Alasan Resign</th>' : '<th>Level</th>'}
              <th>Status</th>
              <th class="text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${list.map(emp => {
      const dept = this.departments.find(d => d.code === emp.department);
      const isInactive = emp.status === 'NON-AKTIF' || emp.status === 'non_active' || emp.status === 'inactive';
      const hasTx = Storage.hasEmployeeTransactions ? Storage.hasEmployeeTransactions(emp.id) : false;
      const upperName = String(emp.name || '').toUpperCase();
      const formattedNik = this.formatEmployeeNIK(emp);
      return `
                  <tr>
                    <td><span class="badge badge-primary badge-emp-id">${formattedNik}</span></td>
                    <td><strong>${upperName}</strong></td>
                    <td>${dept ? dept.name : emp.department}</td>
                    <td>${emp.position}</td>
                    ${isInactiveTab ? `
                      <td>${emp.resignation_date || '-'}</td>
                      <td>${emp.resignation_reason || '-'}</td>
                    ` : `
                      <td>${emp.job_level || '-'}</td>
                    `}
                    <td>
                      <span class="badge ${!isInactive ? 'badge-success' : 'badge-danger'}">
                        ${!isInactive ? 'Aktif' : 'Non-Aktif'}
                      </span>
                    </td>
                    <td class="text-center">
                      <button class="btn btn-sm btn-info" onclick="MasterEmployee.viewDetail('${emp.id}')" title="Detail / Paklaring">👁️</button>
                      ${!isInactive ? `
                        <button class="btn btn-sm btn-primary" onclick="MasterEmployee.editEmployee('${emp.id}')" title="Edit">✏️</button>
                        <button class="btn btn-sm btn-dark" onclick="MasterEmployee.pushToMachine('${emp.id}')" title="Kirim ke Mesin Absensi">📟</button>
                        <button class="btn btn-sm btn-danger" onclick="MasterEmployee.confirmDelete('${emp.id}')" title="Hapus Data Karyawan">🗑️</button>
                      ` : `
                        <button class="btn btn-sm btn-secondary" onclick="MasterEmployee.editEmployee('${emp.id}')" title="Edit Data Historical">✏️</button>
                        <button class="btn btn-sm btn-warning" onclick="MasterEmployee.promptBpjsOffboardingModal('${emp.id}')" title="Unduh Form Mutasi BPJS (SIPP & e-Dabu)">📑 BPJS</button>
                        ${!hasTx ? `
                          <button class="btn btn-sm btn-danger" onclick="MasterEmployee.executeHardPurge('${emp.id}')" title="Hapus Permanen Dummy">🗑️ Purge</button>
                        ` : ''}
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

  async handleSubmit(event) {
    event.preventDefault();
    this.captureCurrentTabFormInputs();

    const originalEmp = (this._editMode && this._editingId)
      ? (this.employees.find(e => String(e.id) === String(this._editingId)) || {})
      : {};
    const empData = { ...originalEmp, ...(this._tempData || {}) };
    delete empData.is_production;
    empData.updatedAt = new Date().toISOString();

    if (!empData.name || !empData.nik || !empData.position || !empData.department) {
      alert('Mohon lengkapi setidaknya Nama Lengkap, NIK, Departemen, dan Jabatan karyawan.');
      return;
    }

    // Enforce UPPERCASE formatting for employee names
    empData.name = String(empData.name).trim().toUpperCase();

    // Ensure status defaults to active for new employees
    if (!empData.status) {
      empData.status = 'active';
    }

    try {
      if (this._editMode && this._editingId) {
        empData.id = this._editingId;
        await Storage.updateEmployee(this._editingId, empData);
        alert('Data karyawan berhasil diperbarui!');
        this.cancelEdit();
      } else {
        const currentEmployees = Storage.getEmployees();
        let maxId = 0;
        currentEmployees.forEach(e => {
          const parsed = parseInt(e.id);
          if (!isNaN(parsed) && parsed > maxId) {
            maxId = parsed;
          }
        });
        empData.id = maxId + 1;
        if (!empData.nik || /^\d+$/.test(String(empData.nik).trim())) {
          const numVal = empData.nik || empData.id;
          const year = new Date().getFullYear();
          empData.nik = `EMP-${year}-${String(numVal).padStart(3, '0')}`;
        }
        empData.createdAt = new Date().toISOString();
        await Storage.addEmployee(empData);
        alert('Karyawan berhasil didaftarkan!');
        this._tempData = null;
        this._activeTab = 'personal';
      }

      await this.loadData();
      this.render();
    } catch (error) {
      alert('Error: ' + error.message);
    }
  },

  editEmployee(id) {
    // 🔒 Reset payroll lock when switching to a different employee
    sessionStorage.removeItem('erp_salary_unlocked');
    this._editMode = true;
    this._editingId = id;
    const emp = this.employees.find(e => String(e.id) === String(id));
    this._tempData = emp ? { ...emp } : { id };
    this._activeTab = 'personal';
    this.render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  cancelEdit() {
    // 🔒 Reset payroll lock when cancelling edit
    sessionStorage.removeItem('erp_salary_unlocked');
    this._editMode = false;
    this._editingId = null;
    // Initialize with default status for new employees
    this._tempData = { status: 'active' };
    this._activeTab = 'personal';
    this.render();
  },

  formatEmployeeNIK(emp) {
    if (!emp) return '1';
    let nikStr = String(emp.nik || emp.external_employee_id || emp.id || '').trim();
    if (!nikStr) {
      nikStr = String(emp.id || '1');
    }
    // Revert/strip any EMP-YYYY- prefix back to simple numeric ID (e.g., 39, 38, 1)
    nikStr = nikStr.replace(/^EMP-\d{4}-0*/i, '').replace(/^EMP-0*/i, '');
    return nikStr || String(emp.id || '1');
  },

  confirmDelete(id) {
    const emp = this.employees.find(e => String(e.id) === String(id));
    if (!emp) return;

    const hasTx = Storage.hasEmployeeTransactions ? Storage.hasEmployeeTransactions(id) : false;
    const empNameUpper = String(emp.name || '').toUpperCase();
    const formattedNik = this.formatEmployeeNIK(emp);
    const todayStr = new Date().toISOString().split('T')[0];

    const resignReasonOptions = `
      <option value="Mengundurkan Diri (Resign)" selected>Mengundurkan Diri (Resign)</option>
      <option value="Habis Kontrak (End of Contract)">Habis Kontrak (End of Contract)</option>
      <option value="Pemberhentian / PHK (Termination)">Pemberhentian / PHK (Termination)</option>
      <option value="Mutasi Antar Entitas (Entity Transfer)">Mutasi Antar Entitas (Entity Transfer)</option>
      <option value="Pensiun (Retirement)">Pensiun (Retirement)</option>
      <option value="Meninggal Dunia (Deceased)">Meninggal Dunia (Deceased)</option>
    `;

    let modalHtml = '';
    if (!hasTx) {
      // Zero transactions attached! Allow Hard Delete (Purge Dummy) or Soft Delete
      modalHtml = `
        <div id="delete-option-modal" class="modal-overlay" style="z-index: 1000;">
          <div class="modal" style="max-width: 520px;">
            <div class="modal-header">
              <h3 class="modal-title">🗑️ Hapus / Non-Aktifkan Karyawan</h3>
              <button class="modal-close" onclick="document.getElementById('delete-option-modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
              <p class="mb-2">Karyawan <strong>${empNameUpper} (${formattedNik})</strong> tidak memiliki riwayat transaksi (absensi/payroll).</p>
              <div class="alert alert-info mb-3" style="background-color: var(--bg-secondary); border-left: 4px solid var(--info-color); padding: 8px 12px;">
                ℹ️ Karena ini data dummy / baru tanpa transaksi, Anda dapat <strong>Hapus Permanen (Purge)</strong> atau <strong>Soft Delete (Non-Aktif)</strong>.
              </div>
              <form id="soft-delete-form" onsubmit="MasterEmployee.executeSoftDelete(event, '${id}')">
                <div class="form-group mb-3">
                  <label class="form-label font-bold">Tanggal Efektif Resign / Non-Aktif (Jika Soft Delete)</label>
                  <input type="date" id="soft-resign-date" class="form-input" value="${todayStr}">
                </div>
                <div class="form-group mb-3">
                  <label class="form-label font-bold">Alasan Resign / Non-Aktif</label>
                  <select id="soft-resign-reason" class="form-select" required style="width: 100%; padding: 8px 12px; border-radius: 6px;">
                    ${resignReasonOptions}
                  </select>
                </div>
                <div class="modal-footer flex justify-between gap-2 mt-4">
                  <button type="button" class="btn btn-danger" onclick="MasterEmployee.executeHardPurge('${id}')">
                    🚀 Hapus Permanen (Purge Dummy)
                  </button>
                  <div class="flex gap-2">
                    <button type="button" class="btn btn-secondary" onclick="document.getElementById('delete-option-modal').remove()">Batal</button>
                    <button type="submit" class="btn btn-warning">🚫 Soft Delete (Arsip)</button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      `;
    } else {
      // Transactions exist! Block hard delete and enforce Soft Delete
      modalHtml = `
        <div id="soft-delete-modal" class="modal-overlay" style="z-index: 1000;">
          <div class="modal" style="max-width: 500px;">
            <div class="modal-header">
              <h3 class="modal-title">🚫 Non-Aktifkan Karyawan (Soft Delete)</h3>
              <button class="modal-close" onclick="document.getElementById('soft-delete-modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
              <p class="mb-2">Karyawan <strong>${empNameUpper} (${formattedNik})</strong> memiliki riwayat transaksi aktif.</p>
              <div class="alert alert-warning mb-3" style="background-color: var(--bg-secondary); border-left: 4px solid var(--warning-color); padding: 8px 12px;">
                🔒 <strong>Aturan Audit ERP:</strong> Data karyawan ber-transaksi tidak dapat dihapus permanen dan hanya dipindahkan ke status <strong>NON-AKTIF (Arsip)</strong>.
              </div>
              <form id="soft-delete-form" onsubmit="MasterEmployee.executeSoftDelete(event, '${id}')">
                <div class="form-group mb-3">
                  <label class="form-label font-bold">Tanggal Efektif Resign / Non-Aktif</label>
                  <input type="date" id="soft-resign-date" class="form-input" value="${todayStr}" required>
                </div>
                <div class="form-group mb-3">
                  <label class="form-label font-bold">Alasan Resign / Non-Aktif</label>
                  <select id="soft-resign-reason" class="form-select" required style="width: 100%; padding: 8px 12px; border-radius: 6px;">
                    ${resignReasonOptions}
                  </select>
                </div>
                <div class="modal-footer flex justify-end gap-2 mt-4">
                  <button type="button" class="btn btn-secondary" onclick="document.getElementById('soft-delete-modal').remove()">Batal</button>
                  <button type="submit" class="btn btn-danger">🚫 Konfirmasi Non-Aktifkan</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      `;
    }

    const el = document.createElement('div');
    el.innerHTML = modalHtml;
    document.body.appendChild(el.firstElementChild);
  },

  async executeHardPurge(id) {
    const emp = this.employees.find(e => String(e.id) === String(id));
    const empNameUpper = emp ? String(emp.name || '').toUpperCase() : '';
    if (confirm(`Hapus permanen data dummy "${empNameUpper}" dari database?`)) {
      document.getElementById('delete-option-modal')?.remove();
      document.getElementById('soft-delete-modal')?.remove();
      await Storage.hardDeleteEmployee(id);
      await this.loadData();
      this.render();
      if (window.showToast) window.showToast('✅ Data dummy berhasil dihapus permanen dari database.', 'success');
      else alert('✅ Data dummy berhasil dihapus permanen dari database.');
    }
  },

  async executeSoftDelete(event, id) {
    event.preventDefault();
    const resDate = document.getElementById('soft-resign-date')?.value;
    const resReason = document.getElementById('soft-resign-reason')?.value || 'Resign';

    document.getElementById('delete-option-modal')?.remove();
    document.getElementById('soft-delete-modal')?.remove();

    await Storage.deleteEmployee(id, resDate, resReason);
    await this.loadData();
    this._listTab = 'inactive';
    this.render();

    // 🛡️ Auto prompt BPJS offboarding download
    this.promptBpjsOffboardingModal(id);
  },

  promptBpjsOffboardingModal(id) {
    const emp = this.employees.find(e => String(e.id) === String(id));
    if (!emp) return;

    const existingModal = document.getElementById('bpjs-offboard-modal');
    if (existingModal) existingModal.remove();

    const empNameUpper = String(emp.name || '').toUpperCase();
    const formattedNik = this.formatEmployeeNIK(emp);

    const modalHtml = `
      <div id="bpjs-offboard-modal" class="modal-overlay" style="z-index: 1200;">
        <div class="modal" style="max-width: 520px; border-top: 5px solid #f59e0b;">
          <div class="modal-header">
            <h3 class="modal-title" style="display: flex; align-items: center; gap: 8px;">
              🛡️ Pelaporan Mutasi Non-Aktif BPJS
            </h3>
            <button class="modal-close" onclick="document.getElementById('bpjs-offboard-modal').remove()">&times;</button>
          </div>
          <div class="modal-body">
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
              <p style="margin: 0 0 4px 0; font-size: 14px;"><strong>${empNameUpper}</strong> (${formattedNik})</p>
              <p style="margin: 0; font-size: 12px; color: #64748b;">
                Tgl Resign: <strong>${emp.resignation_date || emp.resign_date || '-'}</strong> | Alasan: <strong>${emp.resignation_reason || emp.resign_reason || 'Resign'}</strong>
              </p>
            </div>

            <div class="alert alert-warning" style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 10px 12px; margin-bottom: 16px; font-size: 12px; color: #92400e;">
              ⚠️ <strong>Penting:</strong> Agar iuran bulan depan <strong>tidak tertagih oleh BPJS</strong>, segera laporkan mutasi keluar tenaga kerja ke portal <strong>SIPP Online (BPJS TK)</strong> dan <strong>e-Dabu (BPJS Kesehatan)</strong> sebelum tanggal 25.
            </div>

            <p style="font-size: 13px; margin-bottom: 12px; font-weight: 600; color: #334155;">
              Unduh format pelaporan resmi untuk karyawan ini:
            </p>

            <div style="display: flex; flex-direction: column; gap: 10px;">
              <button class="btn btn-warning" onclick="MasterEmployee.exportSippOffboarding(null, '${emp.id}');" style="display: flex; justify-content: space-between; align-items: center; background: #f59e0b; color: #000; font-weight: bold; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer;">
                <span>📄 Format SIPP Online (BPJS TK Keluar)</span>
                <span>📥 Unduh .xlsx</span>
              </button>

              <button class="btn btn-success" onclick="MasterEmployee.exportEdabuOffboarding(null, '${emp.id}');" style="display: flex; justify-content: space-between; align-items: center; background: #10b981; color: #fff; font-weight: bold; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer;">
                <span>📄 Format e-Dabu (BPJS Kes Non-Aktif)</span>
                <span>📥 Unduh .xlsx</span>
              </button>
            </div>
          </div>
          <div class="modal-footer flex justify-end mt-4">
            <button type="button" class="btn btn-secondary" onclick="document.getElementById('bpjs-offboard-modal').remove()">Tutup</button>
          </div>
        </div>
      </div>
    `;

    const el = document.createElement('div');
    el.innerHTML = modalHtml;
    document.body.appendChild(el.firstElementChild);
  },

  viewDetail(id) {
    const emp = this.employees.find(e => String(e.id) === String(id));
    if (!emp) return;

    const dept = this.departments.find(d => d.code === emp.department);

    // Simple detail view using alert/dialog for now, but a modal would be better
    const detailHtml = `
      <div id="detail-modal" class="modal-overlay" style="z-index: 1000;">
        <div class="modal" style="max-width: 800px; max-height: 90vh; overflow-y: auto;">
            <div class="modal-header">
                <h3 class="modal-title">Biodata Karyawan: ${emp.name}</h3>
                <button class="modal-close" onclick="document.getElementById('detail-modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <h4 class="border-b mb-2 pb-1">Data Pribadi</h4>
                        <p><strong>NIK KTP:</strong> ${emp.nik_ktp || '-'}</p>
                        <p><strong>Nama Ibu Kandung:</strong> ${emp.mother_name || '-'}</p>
                        <p><strong>Tempat, Tgl Lahir:</strong> ${emp.birth_place || '-'}, ${emp.birth_date ? new Date(emp.birth_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}</p>
                        <p><strong>Jenis Kelamin:</strong> ${emp.gender || '-'}</p>
                        <p><strong>No. HP Utama:</strong> ${emp.phone || '-'}</p>
                        <p><strong>Kontak Darurat:</strong> ${emp.emergency_contact || '-'}</p>
                        <p><strong>Alamat Domisili:</strong> ${emp.address || '-'}</p>
                        <p><strong>Alamat KTP:</strong> ${emp.address_ktp || emp.address || '-'}</p>
                    </div>
                    <div>
                        <h4 class="border-b mb-2 pb-1">Data Pekerjaan</h4>
                        <p><strong>System ID (Internal):</strong> ${emp.id || '-'}</p>
                        <p><strong>NIK (ID Karyawan):</strong> ${emp.nik || '-'}</p>
                        <p><strong>ID Excel (External):</strong> ${emp.external_employee_id || '-'}</p>
                        <p><strong>Dept:</strong> ${dept ? dept.name : (emp.department || '-')}</p>
                        <p><strong>Jabatan:</strong> ${emp.position || '-'} (${emp.job_level || '-'})</p>
                        <p><strong>Status:</strong> ${emp.employment_status || '-'}</p>
                    </div>
                </div>
                <div class="mt-4">
                        <h4 class="border-b mb-2 pb-1">Data Penggajian</h4>
                        <p><strong>Bank:</strong> ${emp.bank_name || '-'} / ${emp.bank_account || '-'} / ${emp.bank_owner || '-'}</p>
                        <p><strong>Gaji Pokok:</strong> ${App.formatSalary(emp.base_salary || 0)}</p>
                        <p><strong>Upah Dasar BPJS:</strong> ${App.canViewSalary() ? (emp.bpjs_wage_basis !== undefined && emp.bpjs_wage_basis !== '' ? App.formatCurrency(emp.bpjs_wage_basis) : '(Sama dengan Gaji Pokok)') : '🔒 •••••••• [Terproteksi]'}</p>
                </div>
            </div>
            <div class="modal-footer flex justify-between">
                <button class="btn btn-primary" onclick="MasterEmployee.createLoginAccount('${emp.id}')">
                  🔑 Buat Akun Login
                </button>
                <button class="btn btn-secondary" onclick="document.getElementById('detail-modal').remove()">Tutup</button>
            </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', detailHtml);
  },

  filterList(query) {
    const q = (query || '').toLowerCase();
    const filtered = this.employees.filter(e =>
      String(e.name || '').toLowerCase().includes(q) ||
      String(e.nik || '').toLowerCase().includes(q) ||
      String(e.department || '').toLowerCase().includes(q) ||
      String(e.position || '').toLowerCase().includes(q)
    );
    document.getElementById('employee-list-container').innerHTML = this.renderList(filtered);
  },

  formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  },

  async createLoginAccount(employeeId) {
    const emp = this.employees.find(e => e.id === employeeId);
    if (!emp) return;

    if (!emp.nik) {
      alert('Karyawan harus memiliki NIK untuk dibuatkan akun login.');
      return;
    }

    if (!confirm(`Buat akun login untuk ${emp.name}?\nUsername: ${emp.nik}\nPassword Default: staff123`)) {
      return;
    }

    try {
      const users = Storage.getUsers();
      if (users.find(u => u.username === emp.nik)) {
        alert('Username sudah terdaftar!');
        return;
      }

      const newUser = {
        id: 'USER-' + Date.now(),
        username: emp.nik,
        passwordHash: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', // admin123 (hashed)
        fullName: emp.name,
        email: emp.email || `${emp.nik}@goalrefinery.id`,
        role: 'EMPLOYEE',
        status: 'active',
        mustChangePassword: true,
        createdAt: new Date().toISOString(),
        employeeId: emp.id
      };

      users.push(newUser);
      await Storage.set(Storage.KEYS.USERS, users);
      alert(`Akun login berhasil dibuat!\nUsername: ${newUser.username}\nPassword: admin123`);
    } catch (error) {
      console.error('Error creating login account:', error);
      alert('Gagal membuat akun: ' + error.message);
    }
  },

  downloadDatabase() {
    try {
      if (typeof XLSX === 'undefined') {
        alert('SheetJS (XLSX) library not found. Please refresh the page.');
        return;
      }

      const headers = [
        ['Master Karyawan Database - PT. Golden Alura'],
        ['Data seluruh karyawan yang terdaftar.'],
        [
          'Employee ID', 'Full Name', 'Organization', 'Job Position', 'Job Level', 'Join Date', 'Resign Date', 
          'Status Employee', 'Email', 'Birth Date', 'Birth Place', 'Residential Address', 'NPWP', 
          'Bank Account', 'Bank Account Holder', 'BPJS Ketenagakerjaan', 'BPJS Kesehatan', 
          'NIK (NPWP 16 Digit)', 'Mobile Phone', 'Kontak darurat', 'Religion', 'Gender', 'Marital Status',
          'BPJS Wage Basis'
        ]
      ];

      const rows = this.employees.map(emp => {
          const dept = this.departments.find(d => d.code === emp.department);
          return [
              emp.nik || '', emp.name || '', dept ? dept.name : (emp.department || ''), emp.position || '',
              emp.job_level || '', emp.start_date || '', emp.resign_date || '', emp.employment_status || '', emp.email || '',
              emp.birth_date || '', emp.birth_place || '', emp.address || '', emp.npwp || '',
              emp.bank_account || '', emp.bank_owner || '', emp.bpjs_employment || '', emp.bpjs_health || '',
              emp.nik_ktp || '', emp.phone || '', emp.emergency_contact || '', emp.religion || '',
              emp.gender || '', emp.marital_status || '', emp.bpjs_wage_basis !== undefined ? emp.bpjs_wage_basis : ''
          ];
      });

      const worksheetData = [...headers, ...rows];
      const ws = XLSX.utils.aoa_to_sheet(worksheetData);
      
      ws['!cols'] = [
        { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 20 }, { wch: 12 }, 
        { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 25 }, { wch: 12 }, { wch: 15 },
        { wch: 35 }, { wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 20 },
        { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 25 }, { wch: 15 },
        { wch: 12 }, { wch: 15 }, { wch: 15 }
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Database Karyawan");
      XLSX.writeFile(wb, "Database_Karyawan.xlsx");
    } catch (e) {
      console.error(e);
      alert('Gagal mendownload data');
    }
  },

  exportSippOffboarding(targetMonth = null, targetEmpId = null) {
    try {
      if (typeof XLSX === 'undefined') {
        alert('Library XLSX belum termuat. Mohon refresh halaman.');
        return;
      }

      let list = this.employees || [];
      if (targetEmpId) {
        list = list.filter(e => String(e.id) === String(targetEmpId));
      } else {
        list = list.filter(e => e.status === 'NON-AKTIF' || e.status === 'non_active' || e.status === 'inactive' || e.resign_date || e.resignation_date);
        if (targetMonth) {
          list = list.filter(e => {
            const rDate = e.resignation_date || e.resign_date;
            return rDate && rDate.startsWith(targetMonth);
          });
        }
      }

      if (list.length === 0) {
        alert('Tidak ada data karyawan non-aktif/resign untuk diexport.');
        return;
      }

      const headers = [
        ['BPJS KETENAGAKERJAAN - FORMULIR TENAGA KERJA KELUAR (SIPP ONLINE)'],
        ['PT GOLDEN ALURA', `Periode Mutasi: ${targetMonth || 'Semua Non-Aktif'}`, `Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}`],
        [],
        ['No', 'Nomor KPJ', 'NIK KTP', 'Nama Tenaga Kerja', 'Tanggal Lahir', 'Tanggal Keluar', 'Sebab Keluar', 'Departemen', 'Keterangan']
      ];

      const rows = list.map((e, idx) => {
        const dept = this.departments.find(d => d.code === e.department);
        return [
          idx + 1,
          e.bpjs_employment || '-',
          e.ktp || e.nik_ktp || e.id_card || '-',
          String(e.name || '').toUpperCase(),
          e.birth_date || '-',
          e.resignation_date || e.resign_date || '-',
          e.resignation_reason || e.resign_reason || 'Mengundurkan Diri',
          dept ? dept.name : (e.department || '-'),
          'Mutasi Tenaga Kerja Keluar (Non-Aktifkan Iuran)'
        ];
      });

      const ws = XLSX.utils.aoa_to_sheet([...headers, ...rows]);
      ws['!cols'] = [{ wch: 6 }, { wch: 18 }, { wch: 20 }, { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 25 }, { wch: 20 }, { wch: 35 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'SIPP_TK_Keluar');
      XLSX.writeFile(wb, `SIPP_BPJSTK_Tenaga_Kerja_Keluar_${targetMonth || (targetEmpId ? 'NIK_' + targetEmpId : 'All')}.xlsx`);
    } catch (err) {
      console.error('Error export SIPP:', err);
      alert('Gagal export data SIPP: ' + err.message);
    }
  },

  exportEdabuOffboarding(targetMonth = null, targetEmpId = null) {
    try {
      if (typeof XLSX === 'undefined') {
        alert('Library XLSX belum termuat. Mohon refresh halaman.');
        return;
      }

      let list = this.employees || [];
      if (targetEmpId) {
        list = list.filter(e => String(e.id) === String(targetEmpId));
      } else {
        list = list.filter(e => e.status === 'NON-AKTIF' || e.status === 'non_active' || e.status === 'inactive' || e.resign_date || e.resignation_date);
        if (targetMonth) {
          list = list.filter(e => {
            const rDate = e.resignation_date || e.resign_date;
            return rDate && rDate.startsWith(targetMonth);
          });
        }
      }

      if (list.length === 0) {
        alert('Tidak ada data karyawan non-aktif/resign untuk diexport.');
        return;
      }

      const headers = [
        ['BPJS KESEHATAN - FORMULIR MUTASI PESERTA NON-AKTIF (e-DABU)'],
        ['PT GOLDEN ALURA', `Periode Mutasi: ${targetMonth || 'Semua Non-Aktif'}`, `Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}`],
        [],
        ['No', 'Nomor Kartu BPJS Kesehatan', 'NIK KTP', 'Nomor Kartu Keluarga (KK)', 'Nama Peserta', 'Tanggal Berhenti', 'Alasan Non-Aktif', 'Status Kepesertaan', 'Keterangan']
      ];

      const rows = list.map((e, idx) => {
        return [
          idx + 1,
          e.bpjs_health || '-',
          e.ktp || e.nik_ktp || e.id_card || '-',
          e.kk_number || '-',
          String(e.name || '').toUpperCase(),
          e.resignation_date || e.resign_date || '-',
          e.resignation_reason || e.resign_reason || 'Resign / Berhenti Bekerja',
          'Non-Aktif Badan Usaha',
          'Mutasi Peserta Non-Aktif (Stop Tagihan Iuran)'
        ];
      });

      const ws = XLSX.utils.aoa_to_sheet([...headers, ...rows]);
      ws['!cols'] = [{ wch: 6 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 28 }, { wch: 14 }, { wch: 25 }, { wch: 22 }, { wch: 35 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'eDabu_NonAktif');
      XLSX.writeFile(wb, `eDabu_BPJSKes_Mutasi_NonAktif_${targetMonth || (targetEmpId ? 'NIK_' + targetEmpId : 'All')}.xlsx`);
    } catch (err) {
      console.error('Error export e-Dabu:', err);
      alert('Gagal export data e-Dabu: ' + err.message);
    }
  },

  handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { range: 2 });

        if (jsonData.length === 0) {
          alert('File Excel kosong!');
          return;
        }

        // Generate sync preview
        this.generateImportPreview(jsonData);

      } catch (error) {
        console.error('Import error:', error);
        alert('Gagal memproses file Excel: ' + error.message);
      }
    };
    reader.readAsArrayBuffer(file);
    // Reset input
    event.target.value = '';
  },

  generateImportPreview(jsonData) {
    const currentEmployees = Storage.getEmployees();
    const previewRows = [];
    let hasConflicts = false;

    for (const row of jsonData) {
      if (!row['Full Name']) continue;

      const excelName = row['Full Name'].toString().trim();
      const excelId = row['Employee ID'] ? row['Employee ID'].toString().trim() : '';

      let resolvedId = null;
      let status = 'New Entry';
      let errorMsg = '';

      // 1. Search by external_employee_id
      let match = null;
      if (excelId) {
        match = currentEmployees.find(e => e.external_employee_id && e.external_employee_id.toString().trim() === excelId);
      }

      if (match) {
        resolvedId = match.id;
        if (match.name.toLowerCase() === excelName.toLowerCase()) {
          status = 'Update';
        } else {
          status = 'Conflict';
          errorMsg = `Nama berbeda di DB: "${match.name}"`;
          hasConflicts = true;
        }
      } else {
        // 2. Look for record by Full Name or NIK (NIK in DB is employee.nik)
        const matchByName = currentEmployees.find(e => e.name.toLowerCase() === excelName.toLowerCase());
        const matchByNik = excelId ? currentEmployees.find(e => e.nik && e.nik.toString().trim() === excelId) : null;
        const dbMatch = matchByName || matchByNik;

        if (dbMatch) {
          resolvedId = dbMatch.id;
          if (!dbMatch.external_employee_id) {
            status = 'Update';
          } else {
            if (dbMatch.external_employee_id.toString().trim() !== excelId) {
              status = 'Conflict';
              errorMsg = `Nama sama tapi ID berbeda (Sistem: ${dbMatch.external_employee_id}, Excel: ${excelId})`;
              hasConflicts = true;
            } else {
              status = 'Update';
            }
          }
        } else {
          status = 'New Entry';
        }
      }

      previewRows.push({
        row,
        excelName,
        excelId,
        resolvedId,
        status,
        errorMsg
      });
    }

    this._pendingImportRows = previewRows;

    // Render Preview Modal
    const modalHtml = `
      <div id="import-preview-modal" class="modal-overlay" style="z-index: 1100;">
        <div class="modal" style="max-width: 900px; max-height: 90vh; display: flex; flex-direction: column;">
          <div class="modal-header">
            <h3 class="modal-title">Pratinjau Sinkronisasi Impor Karyawan (Ghost Sync)</h3>
            <button class="modal-close" onclick="document.getElementById('import-preview-modal').remove()">&times;</button>
          </div>
          <div class="modal-body" style="overflow-y: auto; flex-grow: 1; padding: 1.5rem;">
            <p class="mb-4 text-sm text-gray">Berikut adalah pemetaan data antara file Excel dan database sistem. Baris konflik disorot dengan warna merah.</p>
            
            <div class="table-container" style="max-height: 400px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 6px;">
              <table class="table" style="width: 100%; border-collapse: collapse;">
                <thead style="position: sticky; top: 0; background: #f8fafc; z-index: 10;">
                  <tr>
                    <th style="padding: 10px; border-bottom: 2px solid #cbd5e1; text-align: left;">Nama (Excel)</th>
                    <th style="padding: 10px; border-bottom: 2px solid #cbd5e1; text-align: left;">ID (Excel)</th>
                    <th style="padding: 10px; border-bottom: 2px solid #cbd5e1; text-align: left;">System Link (ID)</th>
                    <th style="padding: 10px; border-bottom: 2px solid #cbd5e1; text-align: center;">Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${previewRows.map((r, idx) => {
                    let rowBg = '';
                    let badgeClass = 'badge-success';
                    let statusLabel = 'Baru';

                    if (r.status === 'Conflict') {
                      rowBg = 'style="background-color: #fee2e2; color: #991b1b;"';
                      badgeClass = 'badge-danger';
                      statusLabel = 'Konflik';
                    } else if (r.status === 'Update') {
                      badgeClass = 'badge-info';
                      statusLabel = 'Update';
                    }

                    return `
                      <tr ${rowBg}>
                        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0;">
                          <strong>${r.excelName}</strong>
                          ${r.errorMsg ? `<div style="font-size: 0.75rem; color: #dc2626; margin-top: 2px;">⚠️ ${r.errorMsg}</div>` : ''}
                        </td>
                        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0;">${r.excelId || '-'}</td>
                        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0;">
                          ${r.resolvedId ? `<span class="badge badge-secondary" style="font-family: monospace;">ID: ${r.resolvedId}</span>` : '<span class="text-gray">-</span>'}
                        </td>
                        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">
                          <span class="badge ${badgeClass}">${statusLabel}</span>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>

            ${hasConflicts ? `
              <div class="mt-4 p-3 bg-red-50 border border-red-200 rounded-md" style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 12px; color: #991b1b;">
                <p class="text-sm font-semibold">⚠️ Terdeteksi Konflik Nama & ID!</p>
                <p class="text-xs mt-1">Sistem mendeteksi adanya ketidakcocokan antara ID/Nama di Excel dengan database. Silakan centang kotak di bawah untuk mengonfirmasi bahwa Anda bersedia melanjutkan dan baris konflik tersebut akan <strong>diabaikan (skip)</strong> agar tidak merusak data.</p>
                <label class="flex items-center gap-2 mt-3 cursor-pointer" style="display: flex; align-items: center; gap: 8px; margin-top: 10px; cursor: pointer;">
                  <input type="checkbox" id="confirm-conflict-checkbox" onchange="document.getElementById('btn-execute-import').disabled = !this.checked" style="width: 16px; height: 16px;">
                  <span class="text-xs font-bold">Ya, saya konfirmasi dan setuju untuk mengabaikan baris konflik.</span>
                </label>
              </div>
            ` : ''}
          </div>
          <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 10px; padding: 1rem 1.5rem; background: #f8fafc; border-top: 1px solid #e2e8f0;">
            <button class="btn btn-secondary" onclick="document.getElementById('import-preview-modal').remove()">Batal</button>
            <button id="btn-execute-import" class="btn btn-primary" ${hasConflicts ? 'disabled' : ''} onclick="MasterEmployee.executeImport()">
              📥 Impor Data
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  },

  async executeImport() {
    if (!this._pendingImportRows) return;

    try {
      let importedCount = 0;
      let updatedCount = 0;
      const currentEmployees = Storage.getEmployees();
      const departments = Storage.getDepartments();

      // Find max integer ID
      let maxId = 0;
      currentEmployees.forEach(e => {
        const parsed = parseInt(e.id);
        if (!isNaN(parsed) && parsed > maxId) {
          maxId = parsed;
        }
      });

      for (const item of this._pendingImportRows) {
        if (item.status === 'Conflict') {
          // Skip conflict rows
          continue;
        }

        const row = item.row;

        // Map Organization to Department Code
        let deptCode = '';
        if (row['Organization']) {
          const orgName = row['Organization'].toString().toLowerCase();
          const dept = departments.find(d =>
            d.name.toLowerCase().includes(orgName) ||
            orgName.includes(d.name.toLowerCase()) ||
            d.code.toLowerCase() === orgName
          );
          if (dept) deptCode = dept.code;
        }

        const parsedWageBasis = row['BPJS Wage Basis'] !== undefined && row['BPJS Wage Basis'] !== '' ? parseFloat(row['BPJS Wage Basis']) : undefined;

        if (item.status === 'Update' && item.resolvedId) {
          // Update existing employee
          const idx = currentEmployees.findIndex(e => e.id === item.resolvedId);
          if (idx !== -1) {
            const existing = currentEmployees[idx];
            
            // Keep original ID intact, but update fields
            existing.external_employee_id = item.excelId || existing.external_employee_id || '';
            existing.nik = item.excelId || existing.nik || ''; // Excel ID goes into nik as display ID
            existing.name = row['Full Name'] || existing.name;
            existing.department = deptCode || existing.department;
            existing.position = row['Job Position'] || existing.position;
            existing.job_level = row['Job Level'] || existing.job_level;
            existing.start_date = row['Join Date'] || existing.start_date;
            existing.resign_date = row['Resign Date'] || existing.resign_date;
            existing.employment_status = row['Status Employee'] || existing.employment_status;
            existing.email = row['Email'] || existing.email;
            existing.birth_date = row['Birth Date'] || existing.birth_date;
            existing.birth_place = row['Birth Place'] || existing.birth_place;
            existing.address = row['Residential Address'] || existing.address;
            existing.npwp = row['NPWP'] || existing.npwp;
            existing.bank_account = row['Bank Account'] || existing.bank_account;
            existing.bank_owner = row['Bank Account Holder'] || existing.bank_owner;
            existing.bpjs_employment = row['BPJS Ketenagakerjaan'] || existing.bpjs_employment;
            existing.bpjs_health = row['BPJS Kesehatan'] || existing.bpjs_health;
            existing.nik_ktp = row['NIK (NPWP 16 Digit)'] || existing.nik_ktp;
            existing.phone = row['Mobile Phone'] || existing.phone;
            existing.emergency_contact = row['Kontak darurat'] || existing.emergency_contact;
            existing.religion = row['Religion'] || existing.religion;
            existing.gender = row['Gender'] || existing.gender;
            existing.marital_status = row['Marital Status'] || existing.marital_status;
            if (parsedWageBasis !== undefined) {
              existing.bpjs_wage_basis = parsedWageBasis;
            }
            existing.updatedAt = new Date().toISOString();
            
            updatedCount++;
          }
        } else if (item.status === 'New Entry') {
          // New Employee
          maxId++;
          const newEmp = {
            id: maxId, // Internal ID is an Integer (1, 2, 3...)
            external_employee_id: item.excelId || '',
            nik: item.excelId || '', // Excel ID goes into nik as display ID
            name: row['Full Name'],
            department: deptCode,
            position: row['Job Position'] || '',
            job_level: row['Job Level'] || '',
            start_date: row['Join Date'] || '',
            resign_date: row['Resign Date'] || '',
            employment_status: row['Status Employee'] || 'Active',
            email: row['Email'] || '',
            birth_date: row['Birth Date'] || '',
            birth_place: row['Birth Place'] || '',
            address: row['Residential Address'] || '',
            npwp: row['NPWP'] || '',
            bank_account: row['Bank Account'] || '',
            bank_owner: row['Bank Account Holder'] || '',
            bpjs_employment: row['BPJS Ketenagakerjaan'] || '',
            bpjs_health: row['BPJS Kesehatan'] || '',
            nik_ktp: row['NIK (NPWP 16 Digit)'] || '',
            phone: row['Mobile Phone'] || '',
            emergency_contact: row['Kontak darurat'] || '',
            religion: row['Religion'] || '',
            gender: row['Gender'] || '',
            marital_status: row['Marital Status'] || '',
            bpjs_wage_basis: parsedWageBasis,
            createdAt: new Date().toISOString(),
            status: 'active'
          };
          
          currentEmployees.push(newEmp);
          importedCount++;
        }
      }

      await Storage.set(Storage.KEYS.EMPLOYEES, currentEmployees);
      alert(`Berhasil mengimpor data karyawan:\n- Baru: ${importedCount} orang\n- Diperbarui: ${updatedCount} orang`);
      
      // Close modal
      document.getElementById('import-preview-modal').remove();
      this._pendingImportRows = null;

      await this.loadData();
      this.render();

    } catch (error) {
      console.error('Import confirmation error:', error);
      alert('Gagal menyimpan data impor: ' + error.message);
    }
  },

  /**
   * 📄 GENERATE & DOWNLOAD EXCEL TEMPLATE
   * Creates a pre-formatted XLSX file with correct headers for import.
   */
  downloadTemplate() {
    try {
      if (typeof XLSX === 'undefined') {
        alert('SheetJS (XLSX) library not found. Please refresh the page.');
        return;
      }

      const headers = [
        ['Master Karyawan Template - PT. Golden Alura'],
        ['Silakan isi data mulai dari baris 3. Header tidak boleh diubah.'],
        [
          'Employee ID', 
          'Full Name', 
          'Organization', 
          'Job Position', 
          'Job Level', 
          'Join Date', 
          'Resign Date', 
          'Status Employee', 
          'Email', 
          'Birth Date', 
          'Birth Place', 
          'Residential Address', 
          'NPWP', 
          'Bank Account', 
          'Bank Account Holder', 
          'BPJS Ketenagakerjaan', 
          'BPJS Kesehatan', 
          'NIK (NPWP 16 Digit)', 
          'Mobile Phone', 
          'Kontak darurat', 
          'Religion', 
          'Gender', 
          'Marital Status',
          'BPJS Wage Basis'
        ]
      ];

      // Sample data
      const sampleData = [
        [
          'EMP-2024-001', 
          'Andi Wijaya', 
          'PROD', 
          'Operator Refinery', 
          'Operator', 
          '2024-01-01', 
          'Tetap', 
          'andi@goalrefinery.id', 
          '1995-05-15', 
          'Jakarta', 
          'Jl. Mawar No. 123, Jakarta Barat', 
          '12.345.678.9-000.000', 
          '1234567890', 
          'Andi Wijaya', 
          '9876543210', 
          '1122334455', 
          '3171012345678901', 
          '08123456789', 
          'Istri: Rina (08129999000)', 
          'Islam', 
          'Laki-laki', 
          'Menikah',
          '5288000'
        ]
      ];

      const worksheetData = [...headers, ...sampleData];
      const ws = XLSX.utils.aoa_to_sheet(worksheetData);

      // Add styles or column widths if possible
      ws['!cols'] = [
        { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 20 }, { wch: 12 }, 
        { wch: 12 }, { wch: 15 }, { wch: 25 }, { wch: 12 }, { wch: 15 },
        { wch: 40 }, { wch: 20 }, { wch: 18 }, { wch: 25 }, { wch: 20 },
        { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 30 }, { wch: 10 },
        { wch: 10 }, { wch: 12 }, { wch: 15 }
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Template Karyawan');

      // Export file
      XLSX.writeFile(wb, 'template_master_karyawan.xlsx');

      console.log('✅ Master Karyawan Template generated successfully');
    } catch (error) {
      console.error('Template Download Error:', error);
      alert('Gagal mengunduh template: ' + error.message);
    }
  },

  async pushToMachine(id) {
    const emp = this.employees.find(e => String(e.id) === String(id));
    if (!emp) return;

    if (!emp.nik || !emp.name) {
      alert('NIK dan Nama Karyawan harus diisi untuk kirim ke mesin!');
      return;
    }

    const machineSN = prompt("Masukkan Serial Number Mesin (Lihat di stiker belakang mesin):", "UCR6255000393");
    if (!machineSN) return;

    if (confirm(`Kirim data "${emp.name}" (ID: ${emp.nik}) ke mesin ${machineSN}?`)) {
      try {
        const db = window.db;
        const { collection, addDoc, serverTimestamp } = window.firestore;

        // ADMS Command for User Data (Using Tab \t as separator)
        // Format: DATA USER PIN=101\tName=Budi\tPri=0
        const commandText = `DATA USER PIN=${emp.nik}\tName=${emp.name}\tPri=0`;

        await addDoc(collection(db, "machine_commands"), {
          sn: machineSN,
          command: commandText,
          status: 'pending',
          createdAt: serverTimestamp(),
          employeeId: emp.id,
          employeeNik: emp.nik,
          employeeName: emp.name
        });

        alert(`✅ Perintah kirim data berhasil dijadwalkan.\nMesin akan otomatis mengupdate data saat sinkronisasi berikutnya.`);
      } catch (error) {
        console.error("Error pushing to machine:", error);
        alert("Gagal mengirim perintah: " + error.message);
      }
    }
  }
};

window.MasterEmployee = MasterEmployee;
if (typeof module !== 'undefined') module.exports = MasterEmployee;
