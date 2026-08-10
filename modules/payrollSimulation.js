// ==========================================
// Payroll Simulation Module
// PT. GOLDEN ALURA - Simulation Engine
// ==========================================

const PayrollSimulation = {
    rules: [],
    employees: [],
    results: [],
    lateOverrides: {},
    isLoading: false,
    isAuthenticatedWithPassword: false,

    async init() {
        if (!this.canAccessPayrollData()) {
            this.renderAccessDenied();
            return;
        }

        if (!this.isAuthenticatedWithPassword) {
            this.renderPasswordPrompt();
            return;
        }

        this.render();
        await this.loadDefaultRules();
    },

    verifySpecialPassword() {
        const input = document.getElementById('payroll-sim-password').value;
        if (input === 'GarPayroll_2025') {
            this.isAuthenticatedWithPassword = true;
            this.init();
        } else {
            alert('Password salah!');
        }
    },

    renderPasswordPrompt() {
        const content = document.getElementById('main-content');
        if (!content) return;
        content.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">💰 Simulasi Payroll</h1>
                <p class="page-description">Akses Terbatas</p>
            </div>
            <div class="card" style="max-width: 400px; margin: 2rem auto;">
                <div class="card-body text-center" style="padding: 2rem;">
                    <h3 style="margin-bottom: 1rem;">Masukkan Password Khusus</h3>
                    <p class="text-gray mb-4" style="font-size: 14px;">Meskipun Anda Admin, Anda perlu password khusus untuk mengakses rincian gaji.</p>
                    <input type="password" id="payroll-sim-password" class="form-input" style="margin-bottom: 1rem; width: 100%;" placeholder="Special Password..." onkeydown="if(event.key === 'Enter') PayrollSimulation.verifySpecialPassword()">
                    <button class="btn btn-primary" style="width: 100%;" onclick="PayrollSimulation.verifySpecialPassword()">Buka Akses Simulasi Payroll</button>
                </div>
            </div>
        `;
    },

    canAccessPayrollData() {
        return !Storage.canCurrentUserReadKey || Storage.canCurrentUserReadKey(Storage.KEYS.PAYROLL);
    },

    renderAccessDenied() {
        const content = document.getElementById('main-content');
        if (!content) return;
        content.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">Simulasi Payroll</h1>
                <p class="page-description">Data payroll dan file gaji karyawan dilindungi oleh akses terbatas.</p>
            </div>
            <div class="card">
                <div class="card-body text-center" style="padding: 3rem;">
                    <h3 style="margin-bottom: 0.75rem;">Akses ditolak</h3>
                    <p class="text-gray">Hanya Admin, Director, Manager Finance, dan HR yang dapat membuka simulasi payroll.</p>
                </div>
            </div>
        `;
    },

    checkedNiks: [],
    period: '2026-07',

    async loadDefaultRules() {
        this.rules = [];
        this.isLoading = false;
        this.checkedNiks = [];
    },

    render() {
        const content = document.getElementById('main-content');
        if (!content) return;

        content.innerHTML = `
            <div class="page-header" style="background: linear-gradient(135deg, #1e3c72, #2a5298); padding: 2rem; border-radius: 12px; color: white; margin-bottom: 2rem; box-shadow: 0 10px 20px rgba(0,0,0,0.1);">
                <div class="flex justify-between align-center">
                    <div>
                        <h1 class="page-title" style="color: white; margin: 0; font-size: 2.5rem; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">⚖️ Simulasi Payroll</h1>
                        <p class="page-description" style="color: rgba(255,255,255,0.9); font-size: 1.1rem; margin-top: 0.5rem;">Uji coba perhitungan gaji berdasarkan skenario data & Komponen Kustom</p>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <!-- 1. Data Source Card -->
                <div class="card" style="border: none; background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.3); box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.07);">
                    <div class="card-header" style="background: transparent; border-bottom: 1px solid rgba(0,0,0,0.05);">
                        <h2 class="card-title" style="color: #2c3e50; font-size: 1.1rem;">1. Sumber Data Karyawan</h2>
                    </div>
                    <div class="card-body">
                        <div class="flex flex-col gap-3">
                            <p class="text-gray small" style="font-size: 11px;">Upload database karyawan (Excel) untuk disimulasikan.</p>
                            <input type="file" id="sim-emp-file" class="hidden" accept=".xlsx,.xls" onchange="PayrollSimulation.handleFileUpload(this)">
                            <button class="btn btn-primary w-full" style="background: linear-gradient(to right, #4facfe 0%, #00f2fe 100%); border: none; padding: 10px; font-weight: 600; font-size: 12px;" onclick="document.getElementById('sim-emp-file').click()">
                                📥 Pilih File Database Karyawan
                            </button>
                            <div id="file-info" class="text-center text-success font-bold" style="display:none; font-size: 11px; margin-top: 5px;"></div>
                        </div>
                    </div>
                </div>

                <!-- 2. Simulation Settings Card -->
                <div class="card" style="border: none; background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.3); box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.07);">
                    <div class="card-header" style="background: transparent; border-bottom: 1px solid rgba(0,0,0,0.05);">
                        <h2 class="card-title" style="color: #2c3e50; font-size: 1.1rem;">2. Parameter Simulasi</h2>
                    </div>
                    <div class="card-body">
                        <div class="grid grid-2 gap-2">
                            <div class="form-group">
                                <label class="form-label" style="font-size: 10px;">Periode Gaji</label>
                                <input type="month" id="sim-period" class="form-input" style="padding: 6px 10px; font-size: 12px;" value="${this.period}" onchange="PayrollSimulation.updatePeriod(this.value)">
                            </div>
                            <div class="form-group">
                                <label class="form-label" style="font-size: 10px;">Hari Kerja Efektif</label>
                                <input type="number" id="sim-work-days" class="form-input" style="padding: 6px 10px; font-size: 12px;" value="25" onchange="PayrollSimulation.runSimulation()">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 3. Custom Component Injection Card -->
                <div class="card" style="border: none; background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.3); box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.07);">
                    <div class="card-header" style="background: transparent; border-bottom: 1px solid rgba(0,0,0,0.05);">
                        <h2 class="card-title" style="color: #2c3e50; font-size: 1.1rem;">3. Injeksi Komponen Kustom</h2>
                    </div>
                    <div class="card-body">
                        <div class="grid grid-2 gap-2" style="margin-bottom: 8px;">
                            <div class="form-group">
                                <label class="form-label" style="font-size: 10px;">Nama Komponen</label>
                                <input type="text" id="sim-comp-name" class="form-input" style="padding: 6px 10px; font-size: 12px;" value="Bonus Proyek" oninput="PayrollSimulation.runSimulation()">
                            </div>
                            <div class="form-group">
                                <label class="form-label" style="font-size: 10px;">Tipe</label>
                                <select id="sim-comp-type" class="form-input" style="padding: 6px 10px; font-size: 12px;" onchange="PayrollSimulation.runSimulation()">
                                    <option value="earnings">Allowance (Tunjangan)</option>
                                    <option value="deduction">Deduction (Potongan)</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label" style="font-size: 10px;">Nominal (Rp)</label>
                            <input type="number" id="sim-comp-amount" class="form-input" style="padding: 6px 10px; font-size: 12px;" value="500000" oninput="PayrollSimulation.runSimulation()">
                        </div>
                    </div>
                </div>
            </div>

            <div id="simulation-results-container">
                <div class="card" style="background: rgba(255,255,255,0.5); border: 1px dashed #ccc; text-align: center; padding: 3rem;">
                    <span style="font-size: 3rem; display: block; margin-bottom: 1rem;">📊</span>
                    <p class="text-gray">Silakan pilih file database karyawan (.xlsx) untuk memulai simulasi perhitungan.</p>
                </div>
            </div>
        `;
    },

    renderLoading() {
        const results = document.getElementById('simulation-results-container');
        if (results) {
            results.innerHTML = `
                <div class="card text-center" style="padding: 3rem; background: rgba(255,255,255,0.85);">
                    <div class="spinner" style="margin: 0 auto 15px auto;"></div>
                    <p class="text-gray" style="font-size: 14px;">Mengeksekusi perhitungan mesin payroll...</p>
                </div>
            `;
        }
    },

    updatePeriod(val) {
        this.period = val;
        this.runSimulation();
    },

    toggleEmployeeCheck(nik, isChecked) {
        const nikStr = String(nik);
        if (isChecked) {
            if (!this.checkedNiks.includes(nikStr)) {
                this.checkedNiks.push(nikStr);
            }
        } else {
            this.checkedNiks = this.checkedNiks.filter(n => n !== nikStr);
        }
        this.runSimulation();
    },

    toggleSelectAll(isChecked) {
        if (isChecked) {
            this.checkedNiks = this.results.map(r => String(r.nik));
        } else {
            this.checkedNiks = [];
        }
        this.runSimulation();
    },

    async handleFileUpload(input) {
        if (!this.canAccessPayrollData()) {
            this.renderAccessDenied();
            return;
        }

        const file = input.files[0];
        if (!file) return;

        const fileInfo = document.getElementById('file-info');
        if (fileInfo) {
            fileInfo.textContent = `✅ Terpilih: ${file.name}`;
            fileInfo.style.display = 'block';
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                this.employees = XLSX.utils.sheet_to_json(worksheet);
                console.log('Simulation Employees Loaded:', this.employees.length);
                this.checkedNiks = []; // Reset checkboxes on new upload
                this.lateOverrides = {}; // Reset overrides on new upload
                this.runSimulation();
            } catch (err) {
                alert('Gagal membaca file: ' + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
    },

    async runSimulation() {
        if (!this.canAccessPayrollData()) {
            this.renderAccessDenied();
            return;
        }

        if (this.employees.length === 0) return;

        this.renderLoading();

        // 1. Map Excel input rows to Standard employee schema objects
        const mappedEmployees = this.employees.map(emp => {
            const baseSalary = parseFloat(emp['Gaji Pokok'] || emp['Basic Salary'] || emp['base_salary'] || emp['Gaji'] || 0);
            return {
                nik: String(emp['Employee ID'] || emp['nik'] || emp['NIK'] || ''),
                name: String(emp['Nama karyawan'] || emp['Full Name'] || emp['name'] || emp['Nama'] || 'Unknown'),
                department: String(emp['Department'] || emp['department'] || emp['Departemen'] || 'OTHER'),
                position: String(emp['Job Position'] || emp['position'] || emp['Jabatan'] || 'Staff'),
                base_salary: baseSalary,
                bpjs_wage_basis: emp['Upah Dasar BPJS'] !== undefined ? parseFloat(emp['Upah Dasar BPJS']) : baseSalary,
                payroll_level: emp['Level Payroll'] || emp['payroll_level'] || 'N/A',
                ptkp: String(emp['PTKP'] || emp['ptkp'] || 'TK/0'),
                npwp: String(emp['NPWP'] || emp['npwp'] || ''),
                start_date: emp['Tanggal Masuk'] || emp['start_date'] || '',
                resign_date: emp['Tanggal Resign'] || emp['resign_date'] || '',
                status: (emp['Status'] || emp['status'] || 'active').toLowerCase()
            };
        });

        // 2. Fetch Custom Component Injection settings
        const compName = document.getElementById('sim-comp-name').value.trim();
        const compAmount = parseFloat(document.getElementById('sim-comp-amount').value) || 0;
        const compType = document.getElementById('sim-comp-type').value;

        const customComponentInject = compName ? {
            name: compName,
            type: compType,
            amount: compAmount
        } : null;

        // 3. Invoke read-only calculation engine
        try {
            const rawResults = await Payroll.calculatePayrollSimulation(
                mappedEmployees,
                this.period,
                customComponentInject,
                this.checkedNiks
            );
            this.results = rawResults;
            this.renderResults();
        } catch (err) {
            console.error(err);
            const container = document.getElementById('simulation-results-container');
            if (container) {
                container.innerHTML = `
                    <div class="card bg-danger text-white" style="border: none; padding: 2rem; text-align: center;">
                        <h3>Gagal menjalankan simulasi mesin payroll</h3>
                        <p>${err.message}</p>
                    </div>
                `;
            }
        }
    },

    renderResults() {
        const container = document.getElementById('simulation-results-container');
        if (!container) return;

        const totalCompanyOut = this.results.reduce((sum, r) => sum + r.total_salary, 0);
        const allSelected = this.results.length > 0 && this.results.every(r => this.checkedNiks.includes(String(r.nik)));

        container.innerHTML = `
            <div class="card" style="border: none; background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(10px); box-shadow: 0 10px 40px rgba(0,0,0,0.05);">
                <div class="card-header flex justify-between align-center" style="border-bottom: 1px solid rgba(0,0,0,0.05); padding-bottom: 15px;">
                    <h2 class="card-title" style="color: #2c3e50;">Hasil Simulasi (${this.results.length} Karyawan)</h2>
                    <div class="text-right">
                        <span class="text-gray small" style="font-size: 11px;">Estimasi Total Pengeluaran Bersih (THP):</span><br>
                        <strong class="text-primary" style="font-size: 1.4rem; color: #1e3c72;">${App.formatCurrency(totalCompanyOut)}</strong>
                    </div>
                </div>
                <div class="card-body" style="padding-top: 15px;">
                    <div class="table-container">
                        <table class="table hoverable">
                            <thead style="background: #f8f9fa;">
                                <tr>
                                    <th style="width: 50px; text-align: center; padding: 12px 8px;">
                                        <input type="checkbox" id="sim-select-all" style="cursor: pointer; transform: scale(1.15);" onchange="PayrollSimulation.toggleSelectAll(this.checked)" ${allSelected ? 'checked' : ''}>
                                    </th>
                                    <th style="padding: 12px 8px;">Karyawan</th>
                                    <th class="text-right" style="padding: 12px 8px;">Gaji Pokok</th>
                                    <th class="text-right" style="padding: 12px 8px;">Tunjangan & Lembur</th>
                                    <th class="text-right" style="padding: 12px 8px;">Komponen Kustom</th>
                                    <th class="text-right" style="padding: 12px 8px;">Potongan Absen/Late</th>
                                    <th class="text-right" style="padding: 12px 8px;">BPJS & PPh 21</th>
                                    <th class="text-right" style="padding: 12px 8px;">Take Home Pay</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${this.results.map(row => {
                                    const isChecked = this.checkedNiks.includes(String(row.nik));
                                    const allowancesSum = row.meal_pay + row.night_meal_pay + row.presence_pay + row.overtime_pay + row.production_pay;
                                    const bpjsHealthDeduction = row.bpjs_health_deduction || 0;
                                    const jhtDeduction = row.jht_deduction || 0;
                                    const pphDeduction = row.pph21_deduction || 0;
                                    const deductionsSum = bpjsHealthDeduction + jhtDeduction + pphDeduction;

                                    // Render custom components summary
                                    let customCompHtml = '<span class="text-gray">-</span>';
                                    const compKeys = Object.keys(row.custom_components || {});
                                    if (compKeys.length > 0) {
                                        const cName = compKeys[0];
                                        const cData = row.custom_components[cName];
                                        const isEarning = cData.type === 'earnings';
                                        customCompHtml = `
                                            <span style="font-weight: 600; color: ${isEarning ? 'var(--success)' : 'var(--danger)'};">
                                                ${isEarning ? '+' : '-'}${App.formatCurrency(cData.amount)}
                                            </span><br>
                                            <small class="text-gray" style="font-size: 9px;">${cName}</small>
                                        `;
                                    }

                                    return `
                                        <tr>
                                            <td style="text-align: center; vertical-align: middle;">
                                                <input type="checkbox" class="emp-checkbox" style="cursor: pointer; transform: scale(1.15);" value="${row.nik}" onchange="PayrollSimulation.toggleEmployeeCheck('${row.nik}', this.checked)" ${isChecked ? 'checked' : ''}>
                                            </td>
                                            <td>
                                                <strong style="color: #2c3e50;">${row.name}</strong><br>
                                                <small class="text-gray" style="font-size: 10px;">${row.nik} | ${row.position}</small>
                                            </td>
                                            <td class="text-right" style="vertical-align: middle;">${App.formatCurrency(row.base_salary)}</td>
                                            <td class="text-right">
                                                ${App.formatCurrency(allowancesSum)}<br>
                                                <small class="text-gray" style="font-size: 9px;">Makan: ${App.formatCurrency(row.meal_pay)} | OT: ${App.formatCurrency(row.overtime_pay)}</small>
                                            </td>
                                            <td class="text-right" style="vertical-align: middle;">
                                                ${customCompHtml}
                                            </td>
                                            <td class="text-right" style="vertical-align: middle;">
                                                <input type="text" 
                                                       class="form-input text-right late-deduction-input" 
                                                       style="width: 100px; display: inline-block; padding: 4px 8px; font-size: 13px; text-align: right;"
                                                       value="${row.late_deduction.toLocaleString('id-ID')}"
                                                       data-calculated="${row.calculated_late_deduction || 0}"
                                                       onfocus="this.select()"
                                                       oninput="PayrollSimulation.maskLateInput(this)"
                                                       onblur="PayrollSimulation.handleLateBlur(this, '${row.nik}')">
                                                ${row.keterangan_override_late ? `<br><small class="text-success" style="font-size: 9px; display: block; text-align: right;" title="${row.keterangan_override_late}">✏️ Override: ${row.keterangan_override_late}</small>` : ''}
                                                ${(row.absence_deduction > 0 || row.half_day_deduction > 0) ? `
                                                    <small class="text-error" style="font-size: 9px; display: block; text-align: right;">
                                                      Absen: -${App.formatCurrency(row.absence_deduction + row.half_day_deduction)}
                                                    </small>
                                                ` : ''}
                                            </td>
                                            <td class="text-right">
                                                <span class="text-error">-${App.formatCurrency(deductionsSum)}</span><br>
                                                <small class="text-gray" style="font-size: 9px;">PPh: ${App.formatCurrency(pphDeduction)} | BPJS: ${App.formatCurrency(bpjsHealthDeduction + jhtDeduction)}</small>
                                            </td>
                                            <td class="text-right" style="vertical-align: middle;">
                                                <strong class="text-success" style="font-size: 1rem; color: #11998e;">${App.formatCurrency(row.total_salary)}</strong>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div class="mt-4 p-3 card bg-info text-white" style="border: none; background: #e0f2fe; color: #0369a1; border-left: 5px solid #0284c7;">
                <p style="margin-bottom: 5px;"><strong>💡 Fitur Simulasi Payroll Terintegrasi:</strong></p>
                <ul class="small" style="margin-left: 1.5rem; list-style-type: disc; font-size: 12px; line-height: 1.5;">
                    <li>Mewarisi **100% formulir perhitungan mesin payroll operasional** (termasuk prorisasi masuk/keluar, PPh 21 TER, dan BPJS).</li>
                    <li>Centang baris karyawan untuk menginjeksi komponen gaji kustom secara lokal.</li>
                    <li>Skenario dijalankan di memori frontend tanpa memodifikasi basis data operational (aman dari overwrite data asli).</li>
                </ul>
            </div>
        `;
    },

    maskLateInput(input) {
        let val = input.value.replace(/\D/g, '');
        if (val === '') {
            input.value = '';
            return;
        }
        input.value = parseInt(val, 10).toLocaleString('id-ID');
    },

    handleLateBlur(input, nik) {
        const newValue = Payroll.parseMaskedNumber(input.value);
        const record = this.results.find(r => String(r.nik) === String(nik));
        if (!record) return;

        const calculatedValue = parseInt(input.getAttribute('data-calculated'), 10) || 0;

        if (newValue === calculatedValue) {
            // Reset override in simulation
            delete this.lateOverrides[nik];
            record.late_deduction_override = null;
            record.keterangan_override_late = null;
            record.late_deduction = calculatedValue;
            
            this.recalculateRecordThp(record);
            this.renderResults();
        } else {
            // Needs justification modal
            Payroll.showOverrideModal(
                record.keterangan_override_late,
                (reason) => {
                    this.lateOverrides[nik] = { amount: newValue, reason: reason };
                    record.late_deduction_override = newValue;
                    record.keterangan_override_late = reason;
                    record.late_deduction = newValue;
                    
                    this.recalculateRecordThp(record);
                    this.renderResults();
                },
                () => {
                    // Cancelled, revert input value
                    input.value = record.late_deduction.toLocaleString('id-ID');
                }
            );
        }
    },

    recalculateRecordThp(record) {
        let customEarningsSum = 0;
        let customDeductionsSum = 0;
        Object.values(record.custom_components || {}).forEach(comp => {
            if (comp.type === 'earnings') customEarningsSum += (comp.amount || 0);
            if (comp.type === 'deduction') customDeductionsSum += (comp.amount || 0);
        });

        const totalEarnings = record.base_salary + 
                              (record.meal_pay || 0) + 
                              (record.night_meal_pay || 0) + 
                              (record.presence_pay || 0) + 
                              (record.overtime_pay || 0) + 
                              (record.production_pay || 0) + 
                              (record.variable_allowance || 0) + 
                              (record.bonus || 0) + 
                              customEarningsSum;

        const totalDeductions = (record.late_deduction || 0) + 
                                (record.absence_deduction || 0) + 
                                (record.half_day_deduction || 0) + 
                                (record.bpjs_health_deduction || 0) + 
                                (record.jht_deduction || 0) + 
                                (record.pph21_deduction || 0) + 
                                (record.other_deductions || 0) + 
                                customDeductionsSum;

        record.total_salary = Math.max(0, Math.round(totalEarnings - totalDeductions));
    }
};

window.PayrollSimulation = PayrollSimulation;
