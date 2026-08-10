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

    await this.loadData();
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
        <div class="card-header flex justify-between align-center">
          <h2 class="card-title">Daftar Karyawan (${this.employees.length})</h2>
          <div class="card-actions flex gap-2">
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

  captureCurrentTabFormInputs() {
    const container = document.getElementById('tab-content-container');
    if (!container) return;

    if (!this._tempData) {
      this._tempData = {};
    }

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
      } else if (input.type === 'number' || input.name === 'base_salary' || input.name === 'bpjs_wage_basis') {
        this._tempData[input.name] = input.value === '' ? '' : parseFloat(input.value);
      } else {
        this._tempData[input.name] = input.value;
      }
    });
  },

  setActiveTab(tabId) {
    this.captureCurrentTabFormInputs();
    this._activeTab = tabId;
    this.render();
  },

  nextTab() {
    this.captureCurrentTabFormInputs();
    const tabs = ['personal', 'job', 'payroll', 'edu_exp', 'family', 'docs'];
    const currentIndex = tabs.indexOf(this._activeTab);
    if (currentIndex < tabs.length - 1) {
      this._activeTab = tabs[currentIndex + 1];
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
    const departments = [
      "Finance & Accounting (including Tax)",
      "HR / Personalia",
      "Corporate Legal",
      "Sales & Marketing",
      "Information Technology",
      "Procurement",
      "Production & Operations"
    ];

    const divisionsByDept = {
      "Finance & Accounting (including Tax)": ["Finance & Treasury", "Accounting & General Ledger", "Tax & Compliance", "Audit & Internal Control"],
      "HR / Personalia": ["Recruitment", "Performance Management", "HR Administration", "Security", "Maintenance & General Services"],
      "Corporate Legal": ["Regulatory", "Litigation & IP", "Paralegal / Support"],
      "Sales & Marketing": ["Sales & Account Management", "Marketing & Brand Strategy", "Customer Relationship (CRM)", "Digital Marketing"],
      "Information Technology": ["Infrastructure & Security", "Software Development (ERP)", "IT Support & Helpdesk"],
      "Procurement": ["Raw Material Procurement", "Production Supply Procurement", "General Procurement"],
      "Production & Operations": ["QC Receiving", "Laboratory", "Production Process", "Finishing", "Warehouse (Raw Material)", "Warehouse (Finished Goods)"]
    };

    const normalizeDept = (d) => {
      if (!d) return "Production & Operations";
      if (d === "PROD" || d === "Produksi" || d === "Production" || String(d).includes("Production")) return "Production & Operations";
      if (d === "FIN" || d === "Finance" || String(d).includes("Finance")) return "Finance & Accounting (including Tax)";
      if (d === "HRD" || d === "HR" || String(d).includes("Human") || String(d).includes("Personalia")) return "HR / Personalia";
      if (d === "LEGAL" || d === "Legal" || String(d).includes("Legal")) return "Corporate Legal";
      if (d === "MKT" || d === "SLS" || d === "Sales" || String(d).includes("Sales")) return "Sales & Marketing";
      if (d === "IT" || String(d).includes("Information")) return "Information Technology";
      if (d === "PUR" || d === "Purchasing" || d === "PROC" || String(d).includes("Procurement")) return "Procurement";
      return d;
    };

    const currentDept = normalizeDept(emp.department);
    const availDivs = divisionsByDept[currentDept] || [];
    const currentDiv = emp.division || emp.job_level || availDivs[0] || '';
    const empStatuses = ['Tetap', 'Kontrak', 'Harian'];

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
            ${departments.map(d => `<option value="${d}" ${currentDept === d ? 'selected' : ''} style="background-color: #1e3a8a; color: #ffffff;">${d}</option>`).join('')}
          </select>
        </div>

        <!-- 2. Dropdown Divisi (Kotak Putih Dinamis) -->
        <div class="form-group">
          <label class="form-label required" style="font-weight: bold;">Divisi</label>
          <select name="job_level" class="form-select" style="background-color: #ffffff; color: #0f172a; border-color: #cbd5e1; font-weight: bold; padding: 8px 12px; border-radius: 6px;" onchange="MasterEmployee.updateTempData(this)" required>
            ${availDivs.map(div => `<option value="${div}" ${currentDiv === div ? 'selected' : ''} style="background-color: #ffffff; color: #0f172a;">${div}</option>`).join('')}
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
    const otRateType = emp.overtime_rate_type || (emp.overtime_hourly_rate === 10000 ? '10000' : (emp.overtime_hourly_rate === 20000 ? '20000' : (emp.overtime_hourly_rate ? 'CUSTOM' : '20000')));
    const isProd = emp.is_production_staff !== undefined ? Boolean(emp.is_production_staff) : (emp.payroll_level === 'Senior' || emp.payroll_level === 'Junior' || emp.department === 'PROD');

    return `
      <div class="form-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label">Nama Bank</label>
          <input type="text" name="bank_name" class="form-input" value="${emp.bank_name || ''}" onchange="MasterEmployee.updateTempData(this)">
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
          <label class="form-label required">Gaji Pokok (Kontrak)</label>
          ${App.canViewSalary() ? `
            <input type="number" name="base_salary" class="form-input" value="${emp.base_salary || emp.basic_salary || 0}" onchange="MasterEmployee.updateTempData(this)" required>
          ` : `
            <div style="display: flex; gap: 8px;">
              <input type="password" name="base_salary" class="form-input" value="${emp.base_salary || emp.basic_salary || 0}" readonly style="flex: 1; background: #1e293b; color: #94a3b8;" placeholder="🔒 Terproteksi">
              <button type="button" class="btn btn-secondary" onclick="App.promptSalaryUnlock()" style="padding: 6px 12px; font-size: 12px;">🔑 Buka Akses</button>
            </div>
          `}
        </div>
        <div class="form-group">
          <label class="form-label">Basis BPJS Kesehatan (Cap Max Rp 12.000.000)</label>
          ${App.canViewSalary() ? `
            <input type="number" name="basic_salary_bpjs_kes" class="form-input" value="${emp.basic_salary_bpjs_kes !== undefined ? emp.basic_salary_bpjs_kes : (emp.base_salary || '')}" placeholder="Kosongkan jika sama dengan Gaji Pokok" onchange="MasterEmployee.updateTempData(this)">
          ` : `
            <input type="password" class="form-input" value="••••••••" readonly style="background: #1e293b; color: #94a3b8;" placeholder="🔒 Terproteksi">
          `}
        </div>
        <div class="form-group">
          <label class="form-label">Basis BPJS TK (JHT, JKK, JKM)</label>
          ${App.canViewSalary() ? `
            <input type="number" name="basic_salary_bpjs_tk" class="form-input" value="${emp.basic_salary_bpjs_tk !== undefined ? emp.basic_salary_bpjs_tk : (emp.base_salary || '')}" placeholder="Kosongkan jika sama dengan Gaji Pokok" onchange="MasterEmployee.updateTempData(this)">
          ` : `
            <input type="password" class="form-input" value="••••••••" readonly style="background: #1e293b; color: #94a3b8;" placeholder="🔒 Terproteksi">
          `}
        </div>
        
        <!-- Overtime Rate System -->
        <div class="form-group">
          <label class="form-label">Sistem Tarif Lembur Per Jam</label>
          <select name="overtime_rate_type" class="form-select" onchange="
            MasterEmployee.updateTempData(this);
            const customDiv = document.getElementById('emp-custom-ot-div');
            if (customDiv) customDiv.style.display = this.value === 'CUSTOM' ? 'block' : 'none';
          ">
            <option value="10000" ${otRateType === '10000' ? 'selected' : ''}>Rp 10.000 / Jam (Security)</option>
            <option value="20000" ${otRateType === '20000' ? 'selected' : ''}>Rp 20.000 / Jam (Produksi)</option>
            <option value="CUSTOM" ${otRateType === 'CUSTOM' ? 'selected' : ''}>Lainnya / Custom Rate</option>
          </select>
        </div>
        <div class="form-group" id="emp-custom-ot-div" style="display: ${otRateType === 'CUSTOM' ? 'block' : 'none'};">
          <label class="form-label">Nominal Custom Tarif Lembur (Rp/Jam)</label>
          <input type="number" name="overtime_hourly_rate" class="form-input" value="${emp.overtime_hourly_rate || ''}" placeholder="Masukkan nominal per jam" onchange="MasterEmployee.updateTempData(this)">
        </div>

        <div class="form-group">
          <label class="form-label">Tarif JKK Perusahaan (%)</label>
          <input type="number" step="0.01" name="jkk_risk_rate" class="form-input" value="${emp.jkk_risk_rate !== undefined ? emp.jkk_risk_rate : 0.89}" placeholder="Default 0.89%" onchange="MasterEmployee.updateTempData(this)">
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

        <!-- Conditional Production Staff & Level -->
        <div class="form-group" style="grid-column: span 2; margin-top: 10px; padding: 12px; border: 1px solid #ddd; border-radius: 6px; background: #fafafa;">
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
    const divSelect = form.querySelector('select[name="job_level"]');
    if (!divSelect) return;

    const divisionsByDept = {
      "Finance, Accounting & Tax": ["Finance & Treasury", "Accounting & General Ledger", "Tax & Compliance", "Audit & Internal Control"],
      "Legal": ["Legal Corporate & Licensing", "Industrial Relations", "Compliance & Regulatory"],
      "Human Resources Development": ["Recruitment", "Performance Management", "HR Administration", "Security", "Maintenance & General Services"],
      "Sales & Marketing": ["Sales & Account Management", "Marketing & Brand Strategy", "Customer Relationship (CRM)", "Digital Marketing"],
      "Information Technology": ["IT Infrastructure & Network", "Software Development (ERP)", "Cybersecurity & Data Governance", "IT Support & Helpdesk"],
      "Purchasing": ["Procurement & Sourcing", "Vendor Management", "Inventory Control & Receiving"],
      "Production": ["Smelting & Melting", "Refining (Kemurnian)", "Lab Quality Control & Assay", "Minting & Packaging", "WIP & Stockroom"]
    };

    const list = divisionsByDept[selectedDept] || [];
    divSelect.innerHTML = list.map(div => `<option value="${div}">${div}</option>`).join('');
    if (list.length > 0) {
      divSelect.value = list[0];
      this.updateTempData(divSelect);
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
    const list = filteredEmployees || this.employees;
    if (list.length === 0) return '<p class="text-center text-gray">Belum ada data karyawan.</p>';

    return `
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>NIK</th>
              <th>Nama</th>
              <th>Departemen</th>
              <th>Jabatan</th>
              <th>Level</th>
              <th>Status</th>
              <th class="text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${list.map(emp => {
      const dept = this.departments.find(d => d.code === emp.department);
      return `
                  <tr>
                    <td><span class="badge badge-primary">${emp.nik}</span></td>
                    <td><strong>${emp.name}</strong></td>
                    <td>${dept ? dept.name : emp.department}</td>
                    <td>${emp.position}</td>
                    <td>${emp.job_level || '-'}</td>
                    <td>
                      <span class="badge ${emp.status === 'active' ? 'badge-success' : 'badge-secondary'}">
                        ${emp.status === 'active' ? 'Aktif' : 'Non-Aktif'}
                      </span>
                    </td>
                    <td class="text-center">
                      <button class="btn btn-sm btn-info" onclick="MasterEmployee.viewDetail('${emp.id}')" title="Detail">👁️</button>
                      <button class="btn btn-sm btn-primary" onclick="MasterEmployee.editEmployee('${emp.id}')" title="Edit">✏️</button>
                      <button class="btn btn-sm btn-dark" onclick="MasterEmployee.pushToMachine('${emp.id}')" title="Kirim ke Mesin Absensi">📟</button>
                      <button class="btn btn-sm btn-danger" onclick="MasterEmployee.confirmDelete('${emp.id}')" title="Hapus">🗑️</button>
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
    this._editMode = true;
    this._editingId = id;
    const emp = this.employees.find(e => String(e.id) === String(id));
    this._tempData = emp ? { ...emp } : { id };
    this._activeTab = 'personal';
    this.render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  cancelEdit() {
    this._editMode = false;
    this._editingId = null;
    // Initialize with default status for new employees
    this._tempData = { status: 'active' };
    this._activeTab = 'personal';
    this.render();
  },

  async confirmDelete(id) {
    const emp = this.employees.find(e => String(e.id) === String(id));
    if (!emp) return;
    if (confirm(`Hapus data karyawan "${emp.name}"?\nSemua data personal dan gaji akan dihapus permanent.`)) {
      await Storage.deleteEmployee(id);
      await this.loadData();
      this.render();
    }
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
