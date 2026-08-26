// ==========================================
// Leave Management Module
// Pengajuan Ijin/Cuti Karyawan
// ==========================================

const LeaveManagement = {
    requests: [],
    balances: [],
    currentFilter: 'all',

    // Master Leave Types (Jenis Ijin & Cuti)
    leaveTypes: [
        // Category A: Cuti (Leave)
        { code: 'A.10', name: 'Cuti Tahunan', category: 'Cuti', isPaidDefault: true, deductLeaveDefault: true },
        { code: 'A.111', name: 'Cuti Ibadah (Haji)', category: 'Cuti', isPaidDefault: true, deductLeaveDefault: false },
        { code: 'A.20', name: 'Cuti Duka Cita Keluarga', category: 'Cuti', isPaidDefault: true, deductLeaveDefault: false },
        { code: 'A.250', name: 'Cuti Bersama (Opsional / Permohonan Mandiri)', category: 'Cuti', isPaidDefault: true, deductLeaveDefault: true, isOptionalCollective: true },
        { code: 'A.30', name: 'Duka Cita Kerabat 1 Rumah', category: 'Cuti', isPaidDefault: true, deductLeaveDefault: false },
        { code: 'A.40', name: 'Cuti Hamil / Melahirkan', category: 'Cuti', isPaidDefault: true, deductLeaveDefault: false },
        { code: 'A.50', name: 'Cuti Istri Melahirkan', category: 'Cuti', isPaidDefault: true, deductLeaveDefault: false },
        { code: 'A.60', name: 'Cuti Menikah', category: 'Cuti', isPaidDefault: true, deductLeaveDefault: false },
        { code: 'A.70', name: 'Cuti Menikahkan Anak', category: 'Cuti', isPaidDefault: true, deductLeaveDefault: false },
        { code: 'A.80', name: 'Cuti Khitanan', category: 'Cuti', isPaidDefault: true, deductLeaveDefault: false },
        { code: 'A.90', name: 'Cuti Baptis', category: 'Cuti', isPaidDefault: true, deductLeaveDefault: false },

        // Category B: Absensi / Izin (Permissions/Absences)
        { code: 'B.310', name: 'Tidak Absen Datang', category: 'Absensi', isPaidDefault: true, deductLeaveDefault: false, needsTimeIn: true },
        { code: 'B.320', name: 'Tidak Absen Pulang', category: 'Absensi', isPaidDefault: true, deductLeaveDefault: false },
        { code: 'B.340', name: 'Izin Terlambat', category: 'Absensi', isPaidDefault: true, deductLeaveDefault: false, needsTimeIn: true },
        { code: 'B.350', name: 'Izin Pulang Awal', category: 'Absensi', isPaidDefault: true, deductLeaveDefault: false },
        { code: 'B.360', name: 'Error Absen / Log Mesin', category: 'Absensi', isPaidDefault: true, deductLeaveDefault: false },
        { code: 'B.380', name: 'Izin Cuti Non-Tetap (Unpaid)', category: 'Absensi', isPaidDefault: false, deductLeaveDefault: false },

        // Category C: Tugas (Official Tasks)
        { code: 'C.210', name: 'Tugas (Lembur)', category: 'Tugas', isPaidDefault: true, deductLeaveDefault: false },
        { code: 'C.220', name: 'Tugas Dinas Luar dg Inap', category: 'Tugas', isPaidDefault: true, deductLeaveDefault: false }
    ],

    init() {
        this.loadData();
        const currentYear = new Date().getFullYear();
        this.autoResetAnnualLeaveQuota(currentYear);
    },

    loadData() {
        this.requests = Storage.get(Storage.KEYS.LEAVE_REQUESTS) || [];
        this.balances = Storage.get(Storage.KEYS.LEAVE_BALANCES) || [];
    },

    async saveRequests() {
        return await Storage.set(Storage.KEYS.LEAVE_REQUESTS, this.requests);
    },

    async saveBalances() {
        return await Storage.set(Storage.KEYS.LEAVE_BALANCES, this.balances);
    },

    getLeaveType(code) {
        return this.leaveTypes.find(t => t.code === code);
    },

    calculateEntitlement(hireDateStr, targetYear) {
        if (!hireDateStr) return 12; // Fallback

        const hireDate = new Date(hireDateStr);
        const hireYear = hireDate.getFullYear();
        const hireMonth = hireDate.getMonth() + 1; // 1-12
        const hireDay = hireDate.getDate();

        // Probation & New Joiner Policy:
        // Employees joining in targetYear or within first year start with 0 leave balance
        if (targetYear <= hireYear) return 0;

        // Policy Update: Full 12 days entitlement (Cuti Bersama abolished / no automatic deductions)
        if (targetYear > hireYear + 1) return 12;

        // targetYear === hireYear + 1: Calculation based on months worked in hireYear
        let monthsWorked = 0;
        if (hireDay <= 15) {
            monthsWorked = 12 - hireMonth + 1;
        } else {
            monthsWorked = 12 - hireMonth;
        }
        return Math.max(0, Math.min(12, monthsWorked));
    },

    autoResetAnnualLeaveQuota(targetYear = new Date().getFullYear()) {
        const rawEmps = Storage.getEmployees ? Storage.getEmployees() : [];
        const employees = Array.isArray(rawEmps) ? rawEmps.filter(e => e.status === 'active') : [];
        let resetCount = 0;

        employees.forEach(emp => {
            const defaultQuota = this.calculateEntitlement(emp.start_date, targetYear);
            let balance = this.balances.find(b => String(b.employeeNik) === String(emp.nik) && b.year === targetYear);
            
            const prevYearBalance = this.balances.find(b => String(b.employeeNik) === String(emp.nik) && b.year === (targetYear - 1));
            let debtFromPrevYear = 0;
            if (prevYearBalance && prevYearBalance.remainingLeave < 0) {
                debtFromPrevYear = Math.abs(prevYearBalance.remainingLeave);
            }

            // Honor current_year_override if explicitly set for targetYear
            const hasOverride = balance && balance.current_year_override !== null && balance.current_year_override !== undefined;
            const effectiveQuota = hasOverride ? Number(balance.current_year_override) : defaultQuota;

            if (!balance) {
                balance = {
                    employeeNik: emp.nik,
                    year: targetYear,
                    annualLeaveQuota: effectiveQuota,
                    usedLeave: debtFromPrevYear,
                    current_year_override: null,
                    is_manual_override: false,
                    autoResetDate: `${targetYear}-01-01T00:00:00.000Z`
                };
                this.balances.push(balance);
            } else {
                balance.annualLeaveQuota = effectiveQuota;
                balance.autoResetDate = `${targetYear}-01-01T00:00:00.000Z`;
            }
            balance.remainingLeave = balance.annualLeaveQuota - (balance.usedLeave || 0);

            // Sync to employee master record
            emp.leave_balance = balance.remainingLeave;
            emp.annual_leave_quota = balance.annualLeaveQuota;
            resetCount++;
        });

        this.saveBalances();
        if (Storage.set && Storage.KEYS.EMPLOYEES) {
            Storage.set(Storage.KEYS.EMPLOYEES, Storage.getEmployees());
        }
        return { success: true, count: resetCount, year: targetYear };
    },

    setManualLeaveQuotaOverride(nik, year = new Date().getFullYear(), overrideQuota = null, reason = "Penyesuaian Manual HR") {
        if (typeof Storage !== "undefined" && Storage.setManualLeaveQuotaOverride) {
            const res = Storage.setManualLeaveQuotaOverride(nik, year, overrideQuota, reason);
            this.loadData();
            return res;
        }

        let record = this.balances.find(b => String(b.employeeNik) === String(nik) && b.year === year);
        const rawEmps = Storage.getEmployees ? Storage.getEmployees() : [];
        const emp = rawEmps.find(e => String(e.nik) === String(nik));
        const defaultQuota = this.calculateEntitlement(emp ? emp.start_date : null, year);
        const hasOverride = overrideQuota !== null && overrideQuota !== '' && overrideQuota !== undefined && !isNaN(overrideQuota);
        const effectiveQuota = hasOverride ? Number(overrideQuota) : defaultQuota;

        if (!record) {
            record = {
                employeeNik: nik,
                year: year,
                annualLeaveQuota: effectiveQuota,
                usedLeave: 0,
                remainingLeave: effectiveQuota,
                current_year_override: hasOverride ? effectiveQuota : null,
                is_manual_override: hasOverride,
                override_reason: reason,
                override_by: Auth.getCurrentUser()?.username || 'Admin',
                override_at: new Date().toISOString()
            };
            this.balances.push(record);
        } else {
            record.annualLeaveQuota = effectiveQuota;
            record.current_year_override = hasOverride ? effectiveQuota : null;
            record.is_manual_override = hasOverride;
            record.remainingLeave = effectiveQuota - (record.usedLeave || 0);
            record.override_reason = reason;
            record.override_by = Auth.getCurrentUser()?.username || 'Admin';
            record.override_at = new Date().toISOString();
        }

        this.saveBalances();
        if (emp) {
            emp.leave_balance = record.remainingLeave;
            emp.annual_leave_quota = record.annualLeaveQuota;
            if (Storage.set && Storage.KEYS.EMPLOYEES) {
                Storage.set(Storage.KEYS.EMPLOYEES, rawEmps);
            }
        }
        return { success: true, record };
    },

    setOpeningLeaveBalance(nik, year = new Date().getFullYear(), annualLeaveQuota = 12, usedLeave = 0, notes = "Migrasi Saldo Awal") {
        const currentUser = typeof Auth !== "undefined" && Auth.getCurrentUser ? Auth.getCurrentUser() : null;
        let record = this.balances.find(b => String(b.employeeNik) === String(nik) && b.year === year);
        const quotaNum = Number(annualLeaveQuota);
        const usedNum = Number(usedLeave);
        const remainingLeave = quotaNum - usedNum;

        if (!record) {
            record = {
                employeeNik: nik,
                year: year,
                annualLeaveQuota: quotaNum,
                usedLeave: usedNum,
                remainingLeave: remainingLeave,
                isOpeningBalance: true,
                notes: notes,
                updatedBy: currentUser ? currentUser.username : "Admin",
                updatedAt: new Date().toISOString()
            };
            this.balances.push(record);
        } else {
            record.annualLeaveQuota = quotaNum;
            record.usedLeave = usedNum;
            record.remainingLeave = remainingLeave;
            record.isOpeningBalance = true;
            record.notes = notes;
            record.updatedBy = currentUser ? currentUser.username : "Admin";
            record.updatedAt = new Date().toISOString();
        }
        this.saveBalances();

        if (typeof Storage !== "undefined" && Storage.setOpeningLeaveBalance) {
            Storage.setOpeningLeaveBalance(nik, year, quotaNum, usedNum, notes);
        }
        return { success: true, record };
    },

    addCompOffCredit(nik, year = new Date().getFullYear(), days = 1, reason = "Kompensasi Lembur / Comp-Off") {
        const creditDays = Number(days) || 0;
        let res = null;
        if (typeof Storage !== "undefined" && Storage.addLeaveCredit) {
            res = Storage.addLeaveCredit(nik, year, creditDays, reason);
        }

        let balance = this.balances.find(b => String(b.employeeNik) === String(nik) && b.year === year);
        if (!balance) {
            balance = this.getEmployeeBalance(nik, year);
        } else if (res && res.record) {
            balance.extraCredits = res.record.extraCredits;
            balance.remainingLeave = res.record.remainingLeave;
        } else {
            balance.extraCredits = (Number(balance.extraCredits) || 0) + creditDays;
            balance.remainingLeave = (Number(balance.annualLeaveQuota) || 0) + balance.extraCredits - (Number(balance.usedLeave) || 0);
            this.saveBalances();
        }
        return { success: true, balance };
    },

    getEmployeeBalance(nik, year = new Date().getFullYear()) {
        let balance = this.balances.find(b => String(b.employeeNik) === String(nik) && b.year === year);
        if (!balance) {
            const rawEmps = Storage.getEmployees ? Storage.getEmployees() : [];
            const employees = Array.isArray(rawEmps) ? rawEmps : [];
            const emp = employees.find(e => String(e.nik) === String(nik));
            const hireDate = emp ? emp.start_date : null;

            const annualLeaveQuota = this.calculateEntitlement(hireDate, year);

            const prevYearBalance = this.balances.find(b => String(b.employeeNik) === String(nik) && b.year === (year - 1));
            let debtFromPrevYear = 0;
            if (prevYearBalance && prevYearBalance.remainingLeave < 0) {
                debtFromPrevYear = Math.abs(prevYearBalance.remainingLeave);
            }

            balance = {
                employeeNik: nik,
                year: year,
                annualLeaveQuota: annualLeaveQuota,
                extraCredits: 0,
                usedLeave: debtFromPrevYear,
                current_year_override: null,
                is_manual_override: false
            };
            this.balances.push(balance);
            this.saveBalances();
        }

        // Apply override if active
        if (balance.current_year_override !== null && balance.current_year_override !== undefined) {
            balance.annualLeaveQuota = Number(balance.current_year_override);
        }
        const extraCredits = Number(balance.extraCredits) || 0;
        balance.remainingLeave = (Number(balance.annualLeaveQuota) || 0) + extraCredits - (Number(balance.usedLeave) || 0);
        return balance;
    },

    calculateDays(dateFrom, dateTo) {
        const from = new Date(dateFrom);
        const to = new Date(dateTo);
        const diffTime = Math.abs(to - from);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        return diffDays;
    },

    async createRequest(data) {
        const id = `LV-${new Date().getFullYear()}-${String(this.requests.length + 1).padStart(4, '0')}`;
        const leaveType = this.getLeaveType(data.leaveTypeCode);
        const isCredit = Boolean(data.isCredit);
        const isPartial = Boolean(data.isPartial);

        const request = {
            id,
            employeeNik: data.employeeNik,
            employeeName: data.employeeName,
            leaveTypeCode: data.leaveTypeCode,
            leaveTypeName: isCredit ? `Comp-Off / Kredit Saldo (+${data.totalDays || 1} Hari)` : (isPartial ? `Izin Parsial / Pulang Cepat (${data.partialTime || '15:00'})` : (leaveType ? leaveType.name : data.leaveTypeCode)),
            category: isCredit ? 'Comp-Off / Credit' : (isPartial ? 'Dispensasi / Early Leave' : (leaveType ? leaveType.category : 'Other')),
            dateFrom: data.dateFrom,
            dateTo: data.dateTo || data.dateFrom,
            totalDays: Number(data.totalDays) || this.calculateDays(data.dateFrom, data.dateTo || data.dateFrom),
            isPaid: data.isPaid !== undefined ? data.isPaid : (leaveType ? leaveType.isPaidDefault : true),
            deductLeave: data.deductLeave !== undefined ? data.deductLeave : (isCredit || isPartial ? false : (leaveType ? leaveType.deductLeaveDefault : false)),
            isCredit: isCredit,
            isPartial: isPartial,
            partialTime: data.partialTime || null,
            partialType: data.partialType || 'pulang_cepat',
            timeIn: data.timeIn || null,
            notes: data.notes || '',
            status: 'PENDING',
            createdAt: new Date().toISOString(),
            createdBy: Auth.getCurrentUser()?.username || 'unknown'
        };

        this.requests.unshift(request);
        await this.saveRequests();

        return { success: true, id: request.id };
    },

    async approveRequest(id, approved, approverNotes = '') {
        const request = this.requests.find(r => r.id === id);
        if (!request) return { success: false, error: 'Request not found' };
        if (request.status !== 'PENDING') return { success: false, error: 'Request already processed' };

        request.status = approved ? 'APPROVED' : 'REJECTED';
        request.approvedAt = new Date().toISOString();
        request.approvedBy = Auth.getCurrentUser()?.username || 'admin';
        request.approverNotes = approverNotes;

        const year = new Date(request.dateFrom).getFullYear();

        // 1. Comp-Off / Extra Credit Addition
        if (approved && request.isCredit) {
            this.addCompOffCredit(request.employeeNik, year, request.totalDays, request.notes || 'Persetujuan Kredit Comp-Off');
        }
        // 2. Annual Leave Deduction Hierarchy
        else if (approved && request.deductLeave) {
            const balance = this.getEmployeeBalance(request.employeeNik, year);
            const availableQuota = Math.max(0, balance.remainingLeave);
            const daysDeductedFromQuota = Math.min(request.totalDays, availableQuota);
            const unpaidDaysToSalary = request.totalDays - daysDeductedFromQuota;

            balance.usedLeave += daysDeductedFromQuota;
            request.coveredByQuotaDays = daysDeductedFromQuota;
            request.unpaidSalaryDeductionDays = unpaidDaysToSalary;

            await this.saveBalances();
        }

        // 3. Cross-Module Sync to Attendance Module
        if (approved && typeof Storage !== "undefined" && Storage.syncApprovedLeaveToAttendance) {
            Storage.syncApprovedLeaveToAttendance(request);
        }

        // 4. Audit Log Integration
        if (typeof AuditLog !== "undefined" && AuditLog.log) {
            AuditLog.log('leave_request', approved ? 'approve' : 'reject', request.employeeNik, {
                requestId: request.id,
                leaveType: request.leaveTypeName,
                totalDays: request.totalDays,
                isPaid: request.isPaid,
                deductLeave: request.deductLeave,
                unpaidSalaryDeductionDays: request.unpaidSalaryDeductionDays || 0,
                approvedBy: request.approvedBy,
                timestamp: new Date().toISOString()
            });
        }

        await this.saveRequests();
        this.render();
        return { success: true };
    },

    async deleteRequest(id) {
        const request = this.requests.find(r => r.id === id);
        if (!request) return;

        // Revert leave balance if was approved and deducted
        if (request.status === 'APPROVED' && request.deductLeave) {
            const year = new Date(request.dateFrom).getFullYear();
            const balance = this.getEmployeeBalance(request.employeeNik, year);
            balance.usedLeave = Math.max(0, balance.usedLeave - request.totalDays);
            await this.saveBalances();
        }

        this.requests = this.requests.filter(r => r.id !== id);
        await this.saveRequests();
        this.render();
    },

    // ==========================================
    // UI RENDERING
    // ==========================================

    render() {
        const content = document.getElementById('main-content');
        if (!content) return;

        content.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">📝 Leave Management (Entry Ijin)</h1>
                <p class="page-description">Pengajuan Ijin dan Cuti Karyawan</p>
            </div>

            <div class="grid grid-3 gap-3 mb-4">
                ${this.renderSummaryCards()}
            </div>

            <div class="card mb-3">
                <div class="card-header">
                    <h2 class="card-title">Daftar Pengajuan Ijin</h2>
                    <div class="flex gap-2">
                        <select class="form-select" style="width: auto;" onchange="LeaveManagement.filterByStatus(this.value)">
                            <option value="all">Semua Status</option>
                            <option value="PENDING">Pending</option>
                            <option value="APPROVED">Approved</option>
                            <option value="REJECTED">Rejected</option>
                        </select>
                        <button class="btn btn-primary" onclick="LeaveManagement.showCreateModal()">
                            ➕ Entry Ijin Baru
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Karyawan</th>
                                    <th>Jenis Ijin</th>
                                    <th>Tanggal</th>
                                    <th>Hari</th>
                                    <th>Gaji</th>
                                    <th>Status</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody id="leave-list-body">
                                ${this.renderRequestRows()}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            ${this.renderLeaveBalanceSection()}
        `;
    },

    renderSummaryCards() {
        const pending = this.requests.filter(r => r.status === 'PENDING').length;
        const approved = this.requests.filter(r => r.status === 'APPROVED').length;
        const thisMonth = this.requests.filter(r => {
            const date = new Date(r.dateFrom);
            const now = new Date();
            return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        }).length;

        return `
            <div class="card p-3" style="border-left: 4px solid #f59e0b;">
                <div class="text-gray small">Pending Approval</div>
                <div class="text-2xl bold">${pending}</div>
            </div>
            <div class="card p-3" style="border-left: 4px solid #10b981;">
                <div class="text-gray small">Approved (Total)</div>
                <div class="text-2xl bold">${approved}</div>
            </div>
            <div class="card p-3" style="border-left: 4px solid #3b82f6;">
                <div class="text-gray small">Bulan Ini</div>
                <div class="text-2xl bold">${thisMonth}</div>
            </div>
        `;
    },

    renderRequestRows() {
        let filtered = this.requests;
        if (this.currentFilter !== 'all') {
            filtered = filtered.filter(r => r.status === this.currentFilter);
        }

        if (filtered.length === 0) {
            return '<tr><td colspan="8" class="text-center text-gray">Belum ada data pengajuan ijin.</td></tr>';
        }

        return filtered.map(req => `
            <tr>
                <td><strong>${req.id}</strong></td>
                <td>
                    <div>${req.employeeName}</div>
                    <small class="text-gray">${req.employeeNik}</small>
                </td>
                <td>
                    <span class="badge badge-secondary">${req.leaveTypeCode}</span>
                    <div class="small">${req.leaveTypeName}</div>
                </td>
                <td>
                    ${this.formatDate(req.dateFrom)}
                    ${req.dateTo !== req.dateFrom ? ` - ${this.formatDate(req.dateTo)}` : ''}
                </td>
                <td class="text-center"><strong>${req.totalDays}</strong></td>
                <td>
                    ${req.isPaid ? '<span class="badge badge-success">Dibayar</span>' : '<span class="badge badge-danger">Tidak</span>'}
                    ${req.deductLeave ? '<br><small class="text-warning">Potong Cuti</small>' : ''}
                </td>
                <td>${this.getStatusBadge(req.status)}</td>
                <td>
                    ${req.status === 'PENDING' ? `
                        <button class="btn btn-sm btn-success mb-1" onclick="LeaveManagement.approveRequest('${req.id}', true)">✅</button>
                        <button class="btn btn-sm btn-danger mb-1" onclick="LeaveManagement.approveRequest('${req.id}', false)">❌</button>
                    ` : ''}
                    <button class="btn btn-sm btn-outline" onclick="LeaveManagement.showDetail('${req.id}')">👁️</button>
                </td>
            </tr>
        `).join('');
    },

    renderLeaveBalanceSection() {
        const rawEmps = Storage.getEmployees ? Storage.getEmployees() : [];
        const employees = Array.isArray(rawEmps) ? rawEmps.filter(e => e.status === 'active') : [];
        const currentYear = new Date().getFullYear();

        return `
            <div class="card">
                <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                    <div>
                        <h2 class="card-title" style="margin: 0;">📊 Sisa Cuti Karyawan (${currentYear})</h2>
                        <small style="color: #9ca3af;">Klik pada baris karyawan untuk membuka <strong>📋 Riwayat / Ledger Saldo</strong></small>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-primary btn-sm" onclick="LeaveManagement.showAdjustBalanceModal()">
                            ✏️ Adjust Saldo Awal (Manual Override)
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="LeaveManagement.triggerManualAutoReset()">
                            🔄 Auto-Reset Jatah Cuti (1 Jan)
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    <div class="alert alert-info mb-3" style="font-size: 0.85rem; line-height: 1.5; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); color: #1e40af; padding: 10px 14px; border-radius: 6px;">
                        <strong>📌 Kebijakan Cuti & Penyesuaian Saldo Awal:</strong><br>
                        • <strong>Hak Cuti Penuh (12 Hari):</strong> Karyawan masa kerja ≥ 1 tahun otomatis mendapatkan jatah 12 hari murni tanpa pengurangan Cuti Bersama.<br>
                        • <strong>Comp-Off / Kredit (+):</strong> Penambahan cuti ekstra dari penukaran hari libur/lembur dicatat sebagai kredit (+) yang menambah saldo.<br>
                        • <strong>Probation & Saldo Habis:</strong> Cuti/Izin yang diajukan saat saldo 0/habis otomatis dialihkan menjadi <strong>Potongan Gaji (Gaji Pokok/25)</strong> secara proporsional.
                    </div>
                    <div class="table-responsive">
                        <table class="table table-hover" style="cursor: pointer;">
                            <thead>
                                <tr>
                                    <th>NIK</th>
                                    <th>Nama</th>
                                    <th class="text-center">Jatah Awal</th>
                                    <th class="text-center">Comp-Off (+)</th>
                                    <th class="text-center">Terpakai (-)</th>
                                    <th class="text-center">Sisa Saldo</th>
                                    <th>Status / Asal Saldo</th>
                                    <th>Progress</th>
                                    <th class="text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${employees.length === 0 ?
                '<tr><td colspan="9" class="text-center text-gray">Belum ada data karyawan aktif.</td></tr>' :
                employees.map(emp => {
                    const balance = this.getEmployeeBalance(emp.nik, currentYear);
                    const isDebt = balance.remainingLeave < 0;
                    const isOverride = balance.current_year_override !== null && balance.current_year_override !== undefined;
                    const isProbation = !isOverride && balance.annualLeaveQuota === 0;
                    const totalEntitled = balance.annualLeaveQuota + (balance.extraCredits || 0);
                    const usedPercent = totalEntitled > 0 ? Math.min(100, (balance.usedLeave / totalEntitled) * 100) : 0;
                    return `
                        <tr onclick="LeaveManagement.openLedgerDrawer('${emp.nik}')" title="Klik untuk melihat buku ledger mutasi cuti ${emp.name}">
                            <td><span class="badge badge-secondary">${emp.nik}</span></td>
                            <td>
                                <strong>${emp.name}</strong>
                                ${isOverride ? `<br><small class="text-info font-bold" style="color: #0284c7;">[Manual Override ${currentYear}]</small>` : (isProbation ? `<br><small class="text-warning">[Probation / Masa Kerja &lt;1 Thn]</small>` : '')}
                            </td>
                            <td class="text-center">
                                <strong>${balance.annualLeaveQuota}</strong>
                                ${isOverride ? `<span title="Saldo diatur manual oleh HR khusus tahun ini" style="cursor: help; color: #0284c7;"> ⚙️</span>` : ''}
                            </td>
                            <td class="text-center" style="color: #10b981; font-weight: bold;">
                                ${balance.extraCredits > 0 ? `+${balance.extraCredits}` : '-'}
                            </td>
                            <td class="text-center text-danger" style="font-weight: 500;">${balance.usedLeave}</td>
                            <td class="text-center ${isDebt ? 'text-danger' : (balance.remainingLeave > 0 ? 'text-success' : '')}" style="font-size: 1.05rem;">
                                <strong>${isDebt ? `(${Math.abs(balance.remainingLeave)}) Debt` : balance.remainingLeave}</strong>
                            </td>
                            <td>
                                ${isOverride ? `<span class="badge badge-info" style="background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd;">Manual Override (${balance.annualLeaveQuota} Hari)</span>` : (isProbation ? '<span class="badge badge-warning">Probation / Saldo 0 (Potong Gaji/25)</span>' : '<span class="badge badge-success">Formula Sistem (12 Hari)</span>')}
                            </td>
                            <td style="width: 120px;">
                                <div style="background: #e5e7eb; height: 8px; border-radius: 4px;">
                                    <div style="background: ${isDebt ? '#ef4444' : (usedPercent > 80 ? '#f59e0b' : '#10b981')}; width: ${usedPercent}%; height: 100%; border-radius: 4px;"></div>
                                </div>
                            </td>
                            <td class="text-center" onclick="event.stopPropagation();">
                                <div style="display: flex; gap: 4px; justify-content: center;">
                                    <button class="btn btn-sm btn-info" style="padding: 4px 8px; font-size: 11px;" onclick="LeaveManagement.openLedgerDrawer('${emp.nik}')" title="Buka Ledger Riwayat">
                                        📋 Ledger
                                    </button>
                                    <button class="btn btn-sm btn-outline" style="padding: 4px 8px; font-size: 11px;" onclick="LeaveManagement.showAdjustBalanceModal('${emp.nik}')" title="Penyesuaian Saldo Awal">
                                        ✏️ Adjust
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `;
                }).join('')
            }
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    },

    // ─── Interactive Employee Ledger Drawer (Side Panel Geser Kanan) ───
    openLedgerDrawer(nik) {
        let drawer = document.getElementById('employee-ledger-drawer');
        if (!drawer) {
            drawer = document.createElement('div');
            drawer.id = 'employee-ledger-drawer';
            drawer.style.position = 'fixed';
            drawer.style.top = '0';
            drawer.style.right = '0';
            drawer.style.bottom = '0';
            drawer.style.width = '640px';
            drawer.style.maxWidth = '92vw';
            drawer.style.background = '#111827';
            drawer.style.borderLeft = '1px solid #374151';
            drawer.style.zIndex = '1050';
            drawer.style.padding = '24px';
            drawer.style.overflowY = 'auto';
            drawer.style.boxShadow = '-10px 0 30px rgba(0,0,0,0.6)';
            drawer.style.transform = 'translateX(100%)';
            drawer.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
            document.body.appendChild(drawer);
        }

        const currentYear = new Date().getFullYear();
        const rawEmps = Storage.getEmployees ? Storage.getEmployees() : [];
        const emp = rawEmps.find(e => String(e.nik) === String(nik));
        if (!emp) return;

        const balance = this.getEmployeeBalance(nik, currentYear);
        const empRequests = this.requests.filter(r => String(r.employeeNik) === String(nik));

        drawer.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #374151; padding-bottom: 16px; margin-bottom: 20px;">
                <div>
                    <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #38bdf8; font-weight: 600;">EMPLOYEE LEAVE LEDGER</span>
                    <h2 style="font-size: 20px; font-weight: 700; color: white; margin: 4px 0 0 0;">${emp.name}</h2>
                    <div style="display: flex; gap: 8px; font-size: 12px; color: #9ca3af; margin-top: 4px;">
                        <span>NIK: <strong style="color: #e5e7eb;">${emp.nik}</strong></span>
                        <span>•</span>
                        <span>Dept: <strong style="color: #e5e7eb;">${emp.department || '-'}</strong></span>
                        <span>•</span>
                        <span>Masa Kerja: <strong style="color: #e5e7eb;">${emp.start_date || '-'}</strong></span>
                    </div>
                </div>
                <button onclick="LeaveManagement.closeLedgerDrawer()" style="background: none; border: none; font-size: 28px; color: #9ca3af; cursor: pointer; line-height: 1;">&times;</button>
            </div>

            <!-- 4 Metric Cards -->
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 24px;">
                <div style="background: #1f2937; padding: 12px; border-radius: 8px; border: 1px solid #374151; text-align: center;">
                    <div style="font-size: 11px; color: #9ca3af;">JATAH AWAL</div>
                    <div style="font-size: 18px; font-weight: 700; color: #38bdf8; margin-top: 4px;">${balance.annualLeaveQuota} Hari</div>
                    ${balance.current_year_override !== null ? '<small style="font-size: 9px; color: #f59e0b;">Override HR</small>' : '<small style="font-size: 9px; color: #9ca3af;">Formula</small>'}
                </div>
                <div style="background: #1f2937; padding: 12px; border-radius: 8px; border: 1px solid #374151; text-align: center;">
                    <div style="font-size: 11px; color: #9ca3af;">COMP-OFF (+)</div>
                    <div style="font-size: 18px; font-weight: 700; color: #10b981; margin-top: 4px;">+${balance.extraCredits || 0} Hari</div>
                    <small style="font-size: 9px; color: #10b981;">Kredit Tambahan</small>
                </div>
                <div style="background: #1f2937; padding: 12px; border-radius: 8px; border: 1px solid #374151; text-align: center;">
                    <div style="font-size: 11px; color: #9ca3af;">TERPAKAI (-)</div>
                    <div style="font-size: 18px; font-weight: 700; color: #ef4444; margin-top: 4px;">${balance.usedLeave} Hari</div>
                    <small style="font-size: 9px; color: #ef4444;">Debit Cuti</small>
                </div>
                <div style="background: #1f2937; padding: 12px; border-radius: 8px; border: 1px solid #374151; text-align: center;">
                    <div style="font-size: 11px; color: #9ca3af;">SISA TERSEDIA</div>
                    <div style="font-size: 18px; font-weight: 700; color: ${balance.remainingLeave > 0 ? '#10b981' : '#f59e0b'}; margin-top: 4px;">${balance.remainingLeave} Hari</div>
                    <small style="font-size: 9px; color: #38bdf8;">Net Saldo</small>
                </div>
            </div>

            <!-- Action Bar -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h3 style="font-size: 15px; font-weight: 600; color: #e5e7eb; margin: 0;">📜 Buku Kronologi Ledger Mutasi Cuti</h3>
                <button class="btn btn-sm btn-primary" onclick="LeaveManagement.showCreateModal('${emp.nik}')" style="font-size: 12px; padding: 4px 10px;">
                    ➕ Entry Ijin Baru
                </button>
            </div>

            <!-- Ledger Table -->
            <div style="background: #181B22; border: 1px solid #374151; border-radius: 8px; overflow: hidden;">
                <table class="table" style="font-size: 12px; width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #1f2937; color: #9ca3af; text-align: left;">
                            <th style="padding: 8px 12px;">Tanggal</th>
                            <th style="padding: 8px 12px;">Jenis Transaksi</th>
                            <th style="padding: 8px 12px; text-align: center;">Mutasi</th>
                            <th style="padding: 8px 12px;">Status Gaji</th>
                            <th style="padding: 8px 12px;">Approval</th>
                        </tr>
                    </thead>
                    <tbody>
                        <!-- Saldo Awal Ledger Row -->
                        <tr style="border-bottom: 1px solid #28303f; background: rgba(56, 189, 248, 0.05);">
                            <td style="padding: 8px 12px; color: #9ca3af;">01 Jan ${currentYear}</td>
                            <td style="padding: 8px 12px;">
                                <strong style="color: #38bdf8;">[SALDO AWAL] Auto-Reset / Jatah Tahunan</strong><br>
                                <small style="color: #9ca3af;">${balance.current_year_override !== null ? 'Manual Override: ' + (balance.override_reason || 'HR Discretion') : 'Jatah reguler sistem (12 Hari)'}</small>
                            </td>
                            <td style="padding: 8px 12px; text-align: center; color: #38bdf8; font-weight: bold;">
                                +${balance.annualLeaveQuota}
                            </td>
                            <td style="padding: 8px 12px;"><span class="badge badge-success" style="font-size: 10px;">Dibayar</span></td>
                            <td style="padding: 8px 12px;"><span class="badge badge-success" style="font-size: 10px;">System Locked</span></td>
                        </tr>

                        <!-- Employee Leave Requests History Rows -->
                        ${empRequests.length === 0 ? `
                            <tr>
                                <td colspan="5" style="padding: 16px; text-align: center; color: #6b7280;">Belum ada riwayat pengajuan izin/cuti untuk karyawan ini.</td>
                            </tr>
                        ` : empRequests.map(r => {
                            const isCredit = Boolean(r.isCredit);
                            const isPartial = Boolean(r.isPartial);
                            const isDeduct = Boolean(r.deductLeave);
                            return `
                                <tr style="border-bottom: 1px solid #28303f;">
                                    <td style="padding: 8px 12px; color: #9ca3af;">
                                        ${r.dateFrom}${r.dateTo && r.dateTo !== r.dateFrom ? ' s/d ' + r.dateTo : ''}
                                    </td>
                                    <td style="padding: 8px 12px;">
                                        <strong>${r.leaveTypeName}</strong><br>
                                        <small style="color: #9ca3af;">${r.notes || '-'}</small>
                                    </td>
                                    <td style="padding: 8px 12px; text-align: center; font-weight: bold; color: ${isCredit ? '#10b981' : (isDeduct ? '#ef4444' : '#9ca3af')};">
                                        ${isCredit ? `+${r.totalDays}` : (isDeduct ? `-${r.totalDays}` : '0')}
                                    </td>
                                    <td style="padding: 8px 12px;">
                                        ${r.isPaid ? '<span class="badge badge-success" style="font-size: 10px;">Dibayar</span>' : '<span class="badge badge-danger" style="font-size: 10px;">Potong Gaji</span>'}
                                        ${r.unpaidSalaryDeductionDays > 0 ? `<br><small style="color: #ef4444;">(${r.unpaidSalaryDeductionDays}d Potong Gaji)</small>` : ''}
                                    </td>
                                    <td style="padding: 8px 12px;">
                                        ${this.getStatusBadge(r.status)}
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;

        drawer.style.transform = 'translateX(0)';
    },

    closeLedgerDrawer() {
        const drawer = document.getElementById('employee-ledger-drawer');
        if (drawer) {
            drawer.style.transform = 'translateX(100%)';
        }
    },

    showAdjustBalanceModal(selectedNik = '') {
        const modalId = 'leave-adjust-modal';
        let modal = document.getElementById(modalId);
        if (!modal) {
            modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'modal-overlay hidden';
            document.body.appendChild(modal);
        }

        const employees = Storage.getActiveEmployees ? Storage.getActiveEmployees() : (Storage.getEmployees ? Storage.getEmployees().filter(e => e.status !== 'NON-AKTIF' && e.status !== 'non_active' && e.status !== 'inactive') : []);
        const currentYear = new Date().getFullYear();
        const emp = employees.find(e => String(e.nik) === String(selectedNik)) || employees[0];
        const initialNik = emp ? emp.nik : '';
        const balance = initialNik ? this.getEmployeeBalance(initialNik, currentYear) : null;
        const currentQuota = balance ? balance.annualLeaveQuota : 12;
        const isOverride = balance && balance.current_year_override !== null && balance.current_year_override !== undefined;

        modal.innerHTML = `
            <div class="modal" style="max-width: 520px; background: #181B22; border: 1px solid #374151; border-radius: 12px; color: white;">
                <div class="modal-header" style="background: transparent; border-bottom: 1px solid #374151; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center;">
                    <h3 class="modal-title" style="color: #38bdf8; font-size: 18px; font-weight: 600; margin: 0;">⚙️ Penyesuaian Saldo Awal Cuti (Manual Override)</h3>
                    <button class="modal-close" onclick="LeaveManagement.closeAdjustBalanceModal()" style="color: #9ca3af; background: none; border: none; font-size: 24px; cursor: pointer; line-height: 1;">×</button>
                </div>
                <div class="modal-body" style="padding: 20px;">
                    <p style="font-size: 13px; color: #9ca3af; margin-bottom: 16px; line-height: 1.4;">
                        Atur jatah saldo awal cuti tahunan khusus untuk periode <strong>tahun berjalan</strong> ini saja tanpa mengubah formula dasar untuk tahun depan.
                    </p>
                    <form id="formAdjustBalance" onsubmit="event.preventDefault(); LeaveManagement.submitAdjustBalanceForm();">
                        <!-- Pilih Karyawan -->
                        <div class="form-group mb-3" style="margin-bottom: 14px;">
                            <label class="block text-xs font-medium text-gray-400 mb-1" style="display: block; font-size: 12px; color: #9ca3af; margin-bottom: 4px;">PILIH KARYAWAN *</label>
                            <select id="adj-employee" class="form-select w-full" style="width: 100%; background: #212631; border: 1px solid #374151; border-radius: 8px; padding: 10px; color: white; font-size: 14px;" required onchange="LeaveManagement.onAdjustEmployeeChange(this.value)">
                                ${employees.map(e => `<option value="${e.nik}" ${e.nik === initialNik ? 'selected' : ''}>${e.nik} - ${e.name}</option>`).join('')}
                            </select>
                        </div>

                        <!-- Tahun Periode -->
                        <div class="form-group mb-3" style="margin-bottom: 14px;">
                            <label class="block text-xs font-medium text-gray-400 mb-1" style="display: block; font-size: 12px; color: #9ca3af; margin-bottom: 4px;">TAHUN PERIODE *</label>
                            <input type="number" id="adj-year" class="form-input" style="width: 100%; background: #212631; border: 1px solid #374151; border-radius: 8px; padding: 8px 10px; color: white; font-size: 14px;" value="${currentYear}" min="2020" max="2050" required onchange="LeaveManagement.onAdjustEmployeeChange(document.getElementById('adj-employee').value)">
                        </div>

                        <!-- Mode Penyesuaian -->
                        <div class="form-group mb-3" style="margin-bottom: 14px; background: #212631; padding: 12px; border-radius: 8px; border: 1px solid #374151;">
                            <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: white; cursor: pointer; margin-bottom: 8px;">
                                <input type="radio" name="adj_mode" value="override" ${isOverride || true ? 'checked' : ''} onchange="document.getElementById('adj-quota-container').style.display='block'">
                                <span><strong>Tetapkan Jatah Khusus (Manual Override)</strong></span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #9ca3af; cursor: pointer;">
                                <input type="radio" name="adj_mode" value="reset" onchange="document.getElementById('adj-quota-container').style.display='none'">
                                <span>Reset kembali ke Formula Otomatis Sistem (12 Hari / 0 Hari Probation)</span>
                            </label>
                        </div>

                        <!-- Input Nominal Saldo Override -->
                        <div id="adj-quota-container" class="form-group mb-3" style="margin-bottom: 14px;">
                            <label class="block text-xs font-medium text-gray-400 mb-1" style="display: block; font-size: 12px; color: #9ca3af; margin-bottom: 4px;">JATAH SALDO AWAL TAHUN INI (HARI) *</label>
                            <input type="number" id="adj-quota" class="form-input" style="width: 100%; background: #212631; border: 1px solid #374151; border-radius: 8px; padding: 8px 10px; color: white; font-size: 14px;" value="${currentQuota}" min="0" max="100" step="1">
                            <small id="adj-formula-hint" style="color: #94a3b8; font-size: 11px; display: block; margin-top: 4px;"></small>
                        </div>

                        <!-- Alasan Penyesuaian -->
                        <div class="form-group mb-4" style="margin-bottom: 18px;">
                            <label class="block text-xs font-medium text-gray-400 mb-1" style="display: block; font-size: 12px; color: #9ca3af; margin-bottom: 4px;">ALASAN PENYESUAIAN / KETERANGAN AUDIT *</label>
                            <textarea id="adj-reason" rows="2" class="form-input" style="width: 100%; background: #212631; border: 1px solid #374151; border-radius: 8px; padding: 8px 10px; color: white; font-size: 13px;" placeholder="Contoh: Penyesuaian masa kerja karyawan baru, diskresi manajemen, kompensasi dinas luar" required>${balance && balance.override_reason ? balance.override_reason : 'Penyesuaian Manual HR Periode Berjalan'}</textarea>
                        </div>

                        <!-- Action Buttons -->
                        <div style="display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid #374151; padding-top: 14px;">
                            <button type="button" class="btn btn-secondary" style="padding: 8px 16px; background: #1f2937; color: #d1d5db; border: none; border-radius: 8px; cursor: pointer;" onclick="LeaveManagement.closeAdjustBalanceModal()">Batal</button>
                            <button type="submit" class="btn btn-primary" style="padding: 8px 20px; background: #0284c7; color: white; font-weight: 500; border: none; border-radius: 8px; cursor: pointer;">💾 Simpan Penyesuaian</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        modal.classList.remove('hidden');
        this.onAdjustEmployeeChange(initialNik);
    },

    closeAdjustBalanceModal() {
        const modal = document.getElementById('leave-adjust-modal');
        if (modal) modal.classList.add('hidden');
    },

    onAdjustEmployeeChange(nik) {
        if (!nik) return;
        const yearInput = document.getElementById('adj-year');
        const year = yearInput ? parseInt(yearInput.value, 10) : new Date().getFullYear();
        const balance = this.getEmployeeBalance(nik, year);
        const rawEmps = Storage.getEmployees ? Storage.getEmployees() : [];
        const emp = rawEmps.find(e => String(e.nik) === String(nik));
        const defaultQuota = this.calculateEntitlement(emp ? emp.start_date : null, year);

        const quotaInput = document.getElementById('adj-quota');
        const hint = document.getElementById('adj-formula-hint');
        if (quotaInput) {
            quotaInput.value = balance ? balance.annualLeaveQuota : defaultQuota;
        }
        if (hint) {
            hint.textContent = `Formula Standar Sistem: ${defaultQuota} hari (Masa kerja: ${emp && emp.start_date ? emp.start_date : 'N/A'}). Terpakai: ${balance ? balance.usedLeave : 0} hari.`;
        }
    },

    submitAdjustBalanceForm() {
        const nikSelect = document.getElementById('adj-employee');
        const yearInput = document.getElementById('adj-year');
        const quotaInput = document.getElementById('adj-quota');
        const reasonInput = document.getElementById('adj-reason');
        const modeRadios = document.getElementsByName('adj_mode');

        if (!nikSelect || !yearInput) return;
        const nik = nikSelect.value;
        const year = parseInt(yearInput.value, 10);
        const reason = reasonInput ? reasonInput.value.trim() : 'Penyesuaian Manual HR';

        let isReset = false;
        for (const r of modeRadios) {
            if (r.checked && r.value === 'reset') isReset = true;
        }

        const overrideQuota = isReset ? null : (quotaInput ? parseInt(quotaInput.value, 10) : 12);

        this.setManualLeaveQuotaOverride(nik, year, overrideQuota, reason);
        alert(`Saldo awal cuti ${nik} untuk tahun ${year} berhasil ${isReset ? 'direset ke formula standar' : 'disesuaikan menjadi ' + overrideQuota + ' hari'}.`);
        this.closeAdjustBalanceModal();
        this.render();
    },

    triggerManualAutoReset() {
        const year = new Date().getFullYear();
        const res = this.autoResetAnnualLeaveQuota(year);
        alert(`Auto-Reset Cuti 1 Januari (${res.year}) berhasil dijalankan untuk ${res.count} karyawan aktif.`);
        this.render();
    },

    // ─── Unified Modal Form with Smart Conditional Logic ───
    showCreateModal(preselectedNik = '') {
        const modalId = 'leave-create-modal';
        let modal = document.getElementById(modalId);
        if (!modal) {
            modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'modal-overlay hidden';
            document.body.appendChild(modal);
        }

        const employees = Storage.getActiveEmployees ? Storage.getActiveEmployees() : (Storage.getEmployees ? Storage.getEmployees().filter(e => e.status !== 'NON-AKTIF' && e.status !== 'non_active' && e.status !== 'inactive') : []);
        const today = new Date().toISOString().split('T')[0];
        const defaultEmp = employees.find(e => String(e.nik) === String(preselectedNik)) || employees[0];
        const initialNik = defaultEmp ? defaultEmp.nik : '';

        // Group leave types by category
        const categories = [...new Set(this.leaveTypes.map(t => t.category))];

        modal.innerHTML = `
            <div class="modal" style="max-width: 580px; background: #181B22; border: 1px solid #374151; border-radius: 12px; color: white;">
                <div class="modal-header" style="background: transparent; border-bottom: 1px solid #374151; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #ef4444; font-weight: 600;">CENTRAL COMMAND CENTER</span>
                        <h3 class="modal-title" style="color: white; font-size: 18px; font-weight: 600; margin: 2px 0 0 0;">Entry Ijin, Cuti & Comp-Off</h3>
                    </div>
                    <button class="modal-close" onclick="LeaveManagement.closeCreateModal()" style="color: #9ca3af; background: none; border: none; font-size: 24px; cursor: pointer; line-height: 1;">×</button>
                </div>
                <div class="modal-body" style="padding: 20px;">
                    <form id="formEntryIjin" onsubmit="event.preventDefault(); LeaveManagement.submitForm();">
                        <!-- Mode / Category Selector Tabs -->
                        <div style="margin-bottom: 16px;">
                            <label class="block text-xs font-medium text-gray-400 mb-1" style="display: block; font-size: 12px; color: #9ca3af; margin-bottom: 6px; font-weight: 500;">PILIH KATEGORI PENGAJUAN *</label>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                                <label style="display: flex; align-items: center; gap: 8px; background: #212631; border: 1px solid #374151; padding: 10px 12px; border-radius: 8px; cursor: pointer;">
                                    <input type="radio" name="entry_category_mode" value="cuti_tahunan" checked onchange="LeaveManagement.onEntryModeChange(this.value)">
                                    <span style="font-size: 13px; font-weight: 600; color: #38bdf8;">🏖️ Cuti Tahunan</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 8px; background: #212631; border: 1px solid #374151; padding: 10px 12px; border-radius: 8px; cursor: pointer;">
                                    <input type="radio" name="entry_category_mode" value="comp_off" onchange="LeaveManagement.onEntryModeChange(this.value)">
                                    <span style="font-size: 13px; font-weight: 600; color: #10b981;">🎁 Comp-Off (Kredit +)</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 8px; background: #212631; border: 1px solid #374151; padding: 10px 12px; border-radius: 8px; cursor: pointer;">
                                    <input type="radio" name="entry_category_mode" value="izin_parsial" onchange="LeaveManagement.onEntryModeChange(this.value)">
                                    <span style="font-size: 13px; font-weight: 600; color: #f59e0b;">⏱️ Izin Parsial (Dispensasi)</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 8px; background: #212631; border: 1px solid #374151; padding: 10px 12px; border-radius: 8px; cursor: pointer;">
                                    <input type="radio" name="entry_category_mode" value="izin_khusus" onchange="LeaveManagement.onEntryModeChange(this.value)">
                                    <span style="font-size: 13px; font-weight: 600; color: #a855f7;">📜 Izin Khusus / Non-Cuti</span>
                                </label>
                            </div>
                        </div>

                        <!-- Pilih Karyawan -->
                        <div class="form-group mb-3" style="margin-bottom: 14px;">
                            <label class="block text-xs font-medium text-gray-400 mb-1" style="display: block; font-size: 12px; color: #9ca3af; margin-bottom: 4px; font-weight: 500;">PILIH KARYAWAN *</label>
                            <select id="lv-employee" class="form-select w-full" style="width: 100%; background: #212631; border: 1px solid #374151; border-radius: 8px; padding: 10px; color: white; font-size: 14px;" required onchange="LeaveManagement.onEmployeeSelectChange(this.value)">
                                <option value="">-- Pilih Karyawan --</option>
                                ${employees.map(e => `<option value="${e.nik}" data-name="${e.name}" ${e.nik === initialNik ? 'selected' : ''}>${e.nik} - ${e.name}</option>`).join('')}
                            </select>
                        </div>

                        <!-- Real-time Saldo Indicator Banner -->
                        <div id="lv-balance-banner" style="background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.3); color: #38bdf8; padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
                            <span>Sisa Saldo Cuti Tersedia: <strong id="lv-current-remaining-txt">12 Hari</strong></span>
                            <span id="lv-smart-policy-badge" class="badge badge-success" style="font-size: 11px;">Gaji Dibayar & Potong Cuti</span>
                        </div>

                        <!-- SECTION A: Cuti Tahunan & Izin Khusus Standard Dates -->
                        <div id="sec-dates-standard" class="grid grid-cols-2 gap-4 mb-3" style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px;">
                            <div>
                                <label class="block text-xs font-medium text-gray-400 mb-1" style="display: block; font-size: 12px; color: #9ca3af; margin-bottom: 4px; font-weight: 500;">TANGGAL MULAI *</label>
                                <input type="date" id="lv-date-from" class="form-input" style="width: 100%; background: #212631; border: 1px solid #374151; border-radius: 8px; padding: 8px 10px; color: white; font-size: 14px;" value="${today}" required>
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-400 mb-1" style="display: block; font-size: 12px; color: #9ca3af; margin-bottom: 4px; font-weight: 500;">SAMPAI TANGGAL *</label>
                                <input type="date" id="lv-date-to" class="form-input" style="width: 100%; background: #212631; border: 1px solid #374151; border-radius: 8px; padding: 8px 10px; color: white; font-size: 14px;" value="${today}" required>
                            </div>
                        </div>

                        <!-- SECTION B: Comp-Off Extra Credit Fields -->
                        <div id="sec-compoff" style="display: none; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); padding: 12px; border-radius: 8px; margin-bottom: 14px;">
                            <div style="font-size: 12px; color: #10b981; font-weight: 600; margin-bottom: 8px;">🎁 PENAMBAHAN KUOTA KHUSUS (EXTRA CREDIT +)</div>
                            <div class="grid grid-cols-2 gap-4" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                                <div>
                                    <label class="block text-xs font-medium text-gray-400 mb-1" style="display: block; font-size: 11px; color: #9ca3af; margin-bottom: 4px;">JUMLAH HARI KREDIT (+)</label>
                                    <input type="number" id="lv-credit-days" class="form-input" style="width: 100%; background: #212631; border: 1px solid #374151; border-radius: 6px; padding: 6px 10px; color: white; font-size: 13px;" value="1" min="1" max="30">
                                </div>
                                <div>
                                    <label class="block text-xs font-medium text-gray-400 mb-1" style="display: block; font-size: 11px; color: #9ca3af; margin-bottom: 4px;">TANGGAL ACUAN</label>
                                    <input type="date" id="lv-credit-date" class="form-input" style="width: 100%; background: #212631; border: 1px solid #374151; border-radius: 6px; padding: 6px 10px; color: white; font-size: 13px;" value="${today}">
                                </div>
                            </div>
                        </div>

                        <!-- SECTION C: Izin Parsial / Early Leave Dispensasi Fields -->
                        <div id="sec-partial" style="display: none; background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); padding: 12px; border-radius: 8px; margin-bottom: 14px;">
                            <div style="font-size: 12px; color: #f59e0b; font-weight: 600; margin-bottom: 8px;">⏱️ DISPENSASI JAM KERJA (EARLY LEAVE / LATE IN)</div>
                            <div class="grid grid-cols-2 gap-4" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                                <div>
                                    <label class="block text-xs font-medium text-gray-400 mb-1" style="display: block; font-size: 11px; color: #9ca3af; margin-bottom: 4px;">JAM DISPENSASI</label>
                                    <input type="time" id="lv-partial-time" class="form-input" style="width: 100%; background: #212631; border: 1px solid #374151; border-radius: 6px; padding: 6px 10px; color: white; font-size: 13px;" value="15:00">
                                </div>
                                <div>
                                    <label class="block text-xs font-medium text-gray-400 mb-1" style="display: block; font-size: 11px; color: #9ca3af; margin-bottom: 4px;">JENIS DISPENSASI</label>
                                    <select id="lv-partial-type" class="form-select" style="width: 100%; background: #212631; border: 1px solid #374151; border-radius: 6px; padding: 6px 10px; color: white; font-size: 13px;">
                                        <option value="pulang_cepat">Pulang Cepat (Dispensasi Atasan)</option>
                                        <option value="datang_terlambat">Datang Terlambat (Izin Mendadak)</option>
                                        <option value="izin_dinas_luar">Izin Urusan Dinas Singkat</option>
                                    </select>
                                </div>
                            </div>
                            <small style="color: #fbbf24; font-size: 11px; display: block; margin-top: 6px;">💡 Izin parsial tidak memotong kuota tahunan dan otomatis tercatat sebagai dispensasi absensi.</small>
                        </div>

                        <!-- Dropdown Jenis Izin Khusus (hanya tampil jika mode izin_khusus) -->
                        <div id="sec-jenis-khusus" class="form-group mb-3" style="display: none; margin-bottom: 14px;">
                            <label class="block text-xs font-medium text-gray-400 mb-1" style="display: block; font-size: 12px; color: #9ca3af; margin-bottom: 4px; font-weight: 500;">PILIH JENIS IZIN KHUSUS *</label>
                            <select id="jenisIjinSelect" class="form-select w-full" style="width: 100%; background: #212631; border: 1px solid #374151; border-radius: 8px; padding: 10px; color: white; font-size: 14px;" onchange="LeaveManagement.onLeaveTypeChange(this.value)">
                                <option value="sakit_dokter">Sakit (Dengan Surat Dokter)</option>
                                <option value="izin_khusus">Izin Khusus / Lainnya</option>
                                ${categories.map(cat => `
                                    <optgroup label="${cat}">
                                        ${this.leaveTypes.filter(t => t.category === cat && !['cuti_tahunan', 'sakit_dokter', 'izin_khusus'].includes(t.code)).map(t =>
                                            `<option value="${t.code}">${t.code} ${t.name}</option>`
                                        ).join('')}
                                    </optgroup>
                                `).join('')}
                            </select>
                            <small id="lv-type-desc" style="color: #9ca3af; font-size: 12px; display: block; margin-top: 4px;"></small>
                        </div>

                        <!-- Smart Status Checkboxes -->
                        <div id="sec-smart-checkboxes" class="flex items-center space-x-6 mb-3 bg-[#212631] p-3 rounded-lg border border-gray-700" style="display: flex; align-items: center; gap: 24px; margin-bottom: 14px; background: #212631; padding: 12px; border-radius: 8px; border: 1px solid #374151;">
                            <label class="flex items-center space-x-2 text-sm cursor-pointer" style="display: flex; align-items: center; gap: 8px; font-size: 14px; color: white;">
                                <input type="checkbox" id="chkGajiDibayar" checked>
                                <span>Gaji Dibayar (Paid)</span>
                            </label>
                            <label class="flex items-center space-x-2 text-sm cursor-pointer" style="display: flex; align-items: center; gap: 8px; font-size: 14px; color: white;">
                                <input type="checkbox" id="chkPotongCuti" checked>
                                <span>Potong Kuota Cuti</span>
                            </label>
                        </div>

                        <!-- Verification Checkbox for External Document (Google Drive) -->
                        <div id="sec-doc-verify" class="mb-3 bg-[#212631] p-3 rounded-lg border border-gray-700" style="margin-bottom: 14px; background: #212631; padding: 12px; border-radius: 8px; border: 1px solid #374151;">
                            <label class="flex items-center space-x-2 text-sm cursor-pointer text-gray-300" style="display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer; color: #d1d5db;">
                                <input type="checkbox" id="chkDocVerified">
                                <span>Surat Sakit / Dokumen Pendukung Telah Diverifikasi (Google Drive)</span>
                            </label>
                        </div>

                        <!-- Keterangan & Link Drive -->
                        <div class="mb-4" style="margin-bottom: 16px;">
                            <label class="block text-xs font-medium text-gray-400 mb-1" style="display: block; font-size: 12px; color: #9ca3af; margin-bottom: 4px; font-weight: 500;">ALASAN / CATATAN & LINK GOOGLE DRIVE</label>
                            <textarea id="lv-notes" rows="2" class="form-input" style="width: 100%; background: #212631; border: 1px solid #374151; border-radius: 8px; padding: 8px 10px; color: white; font-size: 13px;" placeholder="Tuliskan keterangan detail atau tempel link Google Drive di sini..."></textarea>
                        </div>

                        <!-- Action Buttons -->
                        <div style="display: flex; justify-content: flex-end; gap: 12px; border-top: 1px solid #374151; padding-top: 14px;">
                            <button type="button" class="btn btn-secondary" style="padding: 8px 16px; background: #1f2937; color: #d1d5db; border: none; border-radius: 8px; cursor: pointer;" onclick="LeaveManagement.closeCreateModal()">Batal</button>
                            <button type="submit" class="btn btn-primary" style="padding: 8px 20px; background: #dc2626; color: white; font-weight: 500; border: none; border-radius: 8px; cursor: pointer;">🚀 Ajukan Permohonan</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        modal.classList.remove('hidden');
        this.onEmployeeSelectChange(initialNik);
    },

    closeCreateModal() {
        const modal = document.getElementById('leave-create-modal');
        if (modal) modal.classList.add('hidden');
    },

    onEntryModeChange(mode) {
        const secDates = document.getElementById('sec-dates-standard');
        const secCompOff = document.getElementById('sec-compoff');
        const secPartial = document.getElementById('sec-partial');
        const secKhusus = document.getElementById('sec-jenis-khusus');
        const secCheckboxes = document.getElementById('sec-smart-checkboxes');
        const secDoc = document.getElementById('sec-doc-verify');

        if (secDates) secDates.style.display = (mode === 'comp_off') ? 'none' : 'grid';
        if (secCompOff) secCompOff.style.display = (mode === 'comp_off') ? 'block' : 'none';
        if (secPartial) secPartial.style.display = (mode === 'izin_parsial') ? 'block' : 'none';
        if (secKhusus) secKhusus.style.display = (mode === 'izin_khusus') ? 'block' : 'none';
        if (secDoc) secDoc.style.display = (mode === 'izin_khusus') ? 'block' : 'none';

        const empSelect = document.getElementById('lv-employee');
        if (empSelect) this.onEmployeeSelectChange(empSelect.value);
    },

    onEmployeeSelectChange(nik) {
        if (!nik) return;
        const currentYear = new Date().getFullYear();
        const balance = this.getEmployeeBalance(nik, currentYear);
        const remaining = balance.remainingLeave;

        const remainingTxt = document.getElementById('lv-current-remaining-txt');
        const badge = document.getElementById('lv-smart-policy-badge');
        const banner = document.getElementById('lv-balance-banner');
        const paidChk = document.getElementById('chkGajiDibayar');
        const deductChk = document.getElementById('chkPotongCuti');

        if (remainingTxt) {
            remainingTxt.textContent = `${remaining} Hari (Awal: ${balance.annualLeaveQuota}, Comp-Off: +${balance.extraCredits || 0}, Pakai: ${balance.usedLeave})`;
        }

        const modeRadios = document.getElementsByName('entry_category_mode');
        let selectedMode = 'cuti_tahunan';
        for (const r of modeRadios) {
            if (r.checked) selectedMode = r.value;
        }

        if (selectedMode === 'cuti_tahunan') {
            if (remaining > 0) {
                if (paidChk) { paidChk.checked = true; paidChk.disabled = true; }
                if (deductChk) { deductChk.checked = true; deductChk.disabled = true; }
                if (badge) {
                    badge.className = 'badge badge-success';
                    badge.textContent = 'Gaji Dibayar & Potong Kuota Cuti';
                }
                if (banner) {
                    banner.style.background = 'rgba(56, 189, 248, 0.1)';
                    banner.style.borderColor = 'rgba(56, 189, 248, 0.3)';
                    banner.style.color = '#38bdf8';
                }
            } else {
                // Saldo 0: Force Potong Gaji
                if (paidChk) { paidChk.checked = false; paidChk.disabled = true; }
                if (deductChk) { deductChk.checked = false; deductChk.disabled = true; }
                if (badge) {
                    badge.className = 'badge badge-danger';
                    badge.textContent = '⚠️ Saldo Habis - Otomatis Potong Gaji (Gaji/25)';
                }
                if (banner) {
                    banner.style.background = 'rgba(239, 68, 68, 0.15)';
                    banner.style.borderColor = 'rgba(239, 68, 68, 0.5)';
                    banner.style.color = '#ef4444';
                }
            }
        } else if (selectedMode === 'comp_off') {
            if (paidChk) { paidChk.checked = true; paidChk.disabled = true; }
            if (deductChk) { deductChk.checked = false; deductChk.disabled = true; }
            if (badge) {
                badge.className = 'badge badge-success';
                badge.textContent = '🎁 Kredit Saldo Cuti (+)';
            }
        } else if (selectedMode === 'izin_parsial') {
            if (paidChk) { paidChk.checked = true; paidChk.disabled = true; }
            if (deductChk) { deductChk.checked = false; deductChk.disabled = true; }
            if (badge) {
                badge.className = 'badge badge-warning';
                badge.textContent = '⏱️ Dispensasi Jam Kerja (Tidak Potong Saldo)';
            }
        } else if (selectedMode === 'izin_khusus') {
            if (paidChk) paidChk.disabled = false;
            if (deductChk) deductChk.disabled = false;
            if (badge) {
                badge.className = 'badge badge-info';
                badge.textContent = '📜 Izin Khusus Sesuai Kebijakan';
            }
        }
    },

    onLeaveTypeChange(code) {
        const paidChk = document.getElementById('chkGajiDibayar');
        const deductChk = document.getElementById('chkPotongCuti');
        const docVerifiedChk = document.getElementById('chkDocVerified');

        if (code === 'sakit_dokter' || code === 'A.12' || code === 'A.40') {
            if (paidChk) paidChk.checked = true;
            if (deductChk) deductChk.checked = false;
        } else if (code === 'izin_khusus' || code === 'B.380' || code === 'izin_alpha') {
            if (paidChk) paidChk.checked = false;
            if (deductChk) deductChk.checked = false;
        } else {
            const leaveType = this.getLeaveType(code);
            if (leaveType) {
                if (paidChk) paidChk.checked = leaveType.isPaidDefault;
                if (deductChk) deductChk.checked = leaveType.deductLeaveDefault;
            }
        }

        const desc = document.getElementById('lv-type-desc');
        if (desc) {
            if (code === 'sakit_dokter') {
                desc.textContent = 'Memerlukan verifikasi surat dokter yang tersimpan di Google Drive.';
            } else {
                desc.textContent = '';
            }
        }
    },

    async submitForm() {
        const employeeSelect = document.getElementById('lv-employee');
        if (!employeeSelect) return;
        const employeeNik = employeeSelect.value;
        const employeeName = employeeSelect.selectedOptions[0]?.dataset.name || '';

        if (!employeeNik) {
            alert('Pilih karyawan terlebih dahulu.');
            return;
        }

        const modeRadios = document.getElementsByName('entry_category_mode');
        let selectedMode = 'cuti_tahunan';
        for (const r of modeRadios) {
            if (r.checked) selectedMode = r.value;
        }

        let dateFrom = document.getElementById('lv-date-from')?.value;
        let dateTo = document.getElementById('lv-date-to')?.value || dateFrom;
        let leaveTypeCode = 'cuti_tahunan';
        let totalDays = 1;
        let isCredit = false;
        let isPartial = false;
        let partialTime = null;
        let partialType = null;
        let isPaid = true;
        let deductLeave = true;

        if (selectedMode === 'comp_off') {
            isCredit = true;
            deductLeave = false;
            isPaid = true;
            leaveTypeCode = 'comp_off_credit';
            totalDays = parseInt(document.getElementById('lv-credit-days')?.value, 10) || 1;
            dateFrom = document.getElementById('lv-credit-date')?.value || new Date().toISOString().split('T')[0];
            dateTo = dateFrom;
        } else if (selectedMode === 'izin_parsial') {
            isPartial = true;
            deductLeave = false;
            isPaid = true;
            leaveTypeCode = 'dispensasi_parsial';
            totalDays = 0;
            partialTime = document.getElementById('lv-partial-time')?.value || '15:00';
            partialType = document.getElementById('lv-partial-type')?.value || 'pulang_cepat';
        } else if (selectedMode === 'izin_khusus') {
            leaveTypeCode = document.getElementById('jenisIjinSelect')?.value || 'izin_khusus';
            const paidChk = document.getElementById('chkGajiDibayar');
            const deductChk = document.getElementById('chkPotongCuti');
            isPaid = paidChk ? paidChk.checked : true;
            deductLeave = deductChk ? deductChk.checked : false;
            totalDays = this.calculateDays(dateFrom, dateTo);
        } else {
            // cuti_tahunan
            leaveTypeCode = 'cuti_tahunan';
            const currentYear = new Date().getFullYear();
            const balance = this.getEmployeeBalance(employeeNik, currentYear);
            totalDays = this.calculateDays(dateFrom, dateTo);

            if (balance.remainingLeave > 0) {
                isPaid = true;
                deductLeave = true;
            } else {
                // Saldo 0: Enforce Potong Gaji (Unpaid Leave)
                isPaid = false;
                deductLeave = false;
            }
        }

        const notes = document.getElementById('lv-notes')?.value || '';

        const data = {
            employeeNik,
            employeeName,
            leaveTypeCode,
            dateFrom,
            dateTo,
            totalDays,
            isPaid,
            deductLeave,
            isCredit,
            isPartial,
            partialTime,
            partialType,
            notes
        };

        const res = await this.createRequest(data);
        if (res.success) {
            alert(`Permohonan ${isCredit ? 'Kredit Comp-Off' : (isPartial ? 'Dispensasi Izin Parsial' : 'Ijin/Cuti')} berhasil diajukan dengan ID: ${res.id}`);
            this.closeCreateModal();
            this.render();
        } else {
            alert('Gagal menyimpan pengajuan: ' + (res.error || 'Terjadi kesalahan'));
        }
    },

    showDetail(id) {
        const req = this.requests.find(r => r.id === id);
        if (!req) return;

        alert(`
Detail Entry Ijin: ${req.id}
========================
Karyawan: ${req.employeeName} (${req.employeeNik})
Jenis: ${req.leaveTypeCode} - ${req.leaveTypeName}
Tanggal: ${req.dateFrom} s/d ${req.dateTo}
Total Hari: ${req.totalDays}
Gaji Dibayar: ${req.isPaid ? 'Ya' : 'Tidak'}
Potong Cuti: ${req.deductLeave ? 'Ya' : 'Tidak'}
Status: ${req.status}
Keterangan: ${req.notes || '-'}
        `.trim());
    },

    filterByStatus(status) {
        this.currentFilter = status;
        document.getElementById('leave-list-body').innerHTML = this.renderRequestRows();
    },

    getStatusBadge(status) {
        const map = {
            'PENDING': '<span class="badge badge-warning">Pending</span>',
            'APPROVED': '<span class="badge badge-success">Approved</span>',
            'REJECTED': '<span class="badge badge-danger">Rejected</span>'
        };
        return map[status] || status;
    },

    formatDate(dateString) {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    }
};

LeaveManagement.init();
window.LeaveManagement = LeaveManagement;

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LeaveManagement;
} else {
    window.LeaveManagement = LeaveManagement;
}
