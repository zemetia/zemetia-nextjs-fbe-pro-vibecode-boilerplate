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
        // Employees joining in targetYear or within first 3 months start with 0 leave balance
        if (targetYear <= hireYear) return 0;
        if (targetYear > hireYear + 1) return 12;

        // targetYear === hireYear + 1: Calculation based on months worked in hireYear
        let monthsWorked = 0;
        if (hireDay <= 15) {
            monthsWorked = 12 - hireMonth + 1;
        } else {
            monthsWorked = 12 - hireMonth;
        }
        return Math.max(0, monthsWorked);
    },

    autoResetAnnualLeaveQuota(targetYear = new Date().getFullYear()) {
        const rawEmps = Storage.getEmployees ? Storage.getEmployees() : [];
        const employees = Array.isArray(rawEmps) ? rawEmps.filter(e => e.status === 'active') : [];
        let resetCount = 0;

        employees.forEach(emp => {
            const annualLeaveQuota = this.calculateEntitlement(emp.start_date, targetYear);
            let balance = this.balances.find(b => String(b.employeeNik) === String(emp.nik) && b.year === targetYear);
            
            const prevYearBalance = this.balances.find(b => String(b.employeeNik) === String(emp.nik) && b.year === (targetYear - 1));
            let debtFromPrevYear = 0;
            if (prevYearBalance && prevYearBalance.remainingLeave < 0) {
                debtFromPrevYear = Math.abs(prevYearBalance.remainingLeave);
            }

            if (!balance) {
                balance = {
                    employeeNik: emp.nik,
                    year: targetYear,
                    annualLeaveQuota: annualLeaveQuota,
                    usedLeave: debtFromPrevYear,
                    autoResetDate: `${targetYear}-01-01T00:00:00.000Z`
                };
                this.balances.push(balance);
            } else {
                balance.annualLeaveQuota = annualLeaveQuota;
                balance.autoResetDate = `${targetYear}-01-01T00:00:00.000Z`;
            }
            balance.remainingLeave = balance.annualLeaveQuota - balance.usedLeave;
            resetCount++;
        });

        this.saveBalances();
        return { success: true, count: resetCount, year: targetYear };
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

    getEmployeeBalance(nik, year) {
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
                usedLeave: debtFromPrevYear
            };
            this.balances.push(balance);
            this.saveBalances();
        }
        balance.remainingLeave = balance.annualLeaveQuota - balance.usedLeave;
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

        const request = {
            id,
            employeeNik: data.employeeNik,
            employeeName: data.employeeName,
            leaveTypeCode: data.leaveTypeCode,
            leaveTypeName: leaveType ? leaveType.name : data.leaveTypeCode,
            category: leaveType ? leaveType.category : 'Other',
            dateFrom: data.dateFrom,
            dateTo: data.dateTo || data.dateFrom,
            totalDays: this.calculateDays(data.dateFrom, data.dateTo || data.dateFrom),
            isPaid: data.isPaid !== undefined ? data.isPaid : (leaveType ? leaveType.isPaidDefault : true),
            deductLeave: data.deductLeave !== undefined ? data.deductLeave : (leaveType ? leaveType.deductLeaveDefault : false),
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

        // Priority Hierarchy Integration with Payroll Engine
        if (approved && request.deductLeave) {
            const year = new Date(request.dateFrom).getFullYear();
            const balance = this.getEmployeeBalance(request.employeeNik, year);

            const availableQuota = Math.max(0, balance.remainingLeave);
            const daysDeductedFromQuota = Math.min(request.totalDays, availableQuota);
            const unpaidDaysToSalary = request.totalDays - daysDeductedFromQuota;

            balance.usedLeave += daysDeductedFromQuota;
            request.coveredByQuotaDays = daysDeductedFromQuota;
            request.unpaidSalaryDeductionDays = unpaidDaysToSalary;

            await this.saveBalances();
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
                <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
                    <h2 class="card-title">📊 Sisa Cuti Karyawan (${currentYear})</h2>
                    <button class="btn btn-secondary btn-sm" onclick="LeaveManagement.triggerManualAutoReset()">
                        🔄 Auto-Reset Jatah Cuti (1 Jan)
                    </button>
                </div>
                <div class="card-body">
                    <div class="alert alert-info mb-3" style="font-size: 0.85rem; line-height: 1.5; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); color: #1e40af; padding: 10px 14px; border-radius: 6px;">
                        <strong>📌 Kebijakan Cuti & Ijin:</strong><br>
                        • <strong>Auto-Reset (1 Jan):</strong> Sistem otomatis memberikan jatah 12 hari Cuti Tahunan setiap 1 Januari untuk karyawan yang telah berhak.<br>
                        • <strong>Probation (3 Bulan Pertama):</strong> Karyawan probation dimulai dengan saldo 0 hari. Izin/Cuti yang memerlukan pemotongan akan otomatis dialihkan menjadi <strong>Potongan Gaji (Gaji/25)</strong>.<br>
                        • <strong>Cuti Bersama Opsional:</strong> Cuti Bersama bersifat permohonan mandiri (opsional). Karyawan yang tetap masuk kerja dihitung HADIR dengan gaji 100% utuh tanpa potongan.
                    </div>
                    <div class="table-responsive">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>NIK</th>
                                    <th>Nama</th>
                                    <th class="text-center">Jatah</th>
                                    <th class="text-center">Terpakai</th>
                                    <th class="text-center">Sisa</th>
                                    <th>Status Eligibility</th>
                                    <th>Progress</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${employees.length === 0 ?
                '<tr><td colspan="7" class="text-center text-gray">Belum ada data karyawan.</td></tr>' :
                employees.map(emp => {
                    const balance = this.getEmployeeBalance(emp.nik, currentYear);
                    const isDebt = balance.remainingLeave < 0;
                    const isProbation = balance.annualLeaveQuota === 0;
                    const usedPercent = balance.annualLeaveQuota > 0 ? Math.min(100, (balance.usedLeave / balance.annualLeaveQuota) * 100) : 0;
                    return `
                                            <tr>
                                                <td><span class="badge badge-secondary">${emp.nik}</span></td>
                                                <td>
                                                    <strong>${emp.name}</strong>
                                                    ${isProbation ? `<br><small class="text-warning">[Probation - Saldo 0]</small>` : ''}
                                                </td>
                                                <td class="text-center">${balance.annualLeaveQuota}</td>
                                                <td class="text-center">${balance.usedLeave}</td>
                                                <td class="text-center ${isDebt ? 'text-danger' : ''}">
                                                    <strong>${isDebt ? `(${Math.abs(balance.remainingLeave)}) Debt` : balance.remainingLeave}</strong>
                                                </td>
                                                <td>
                                                    ${isProbation ? '<span class="badge badge-warning">Probation / Zero Balance (Potong Gaji/25)</span>' : '<span class="badge badge-success">Eligible 12 Hari</span>'}
                                                </td>
                                                <td style="width: 150px;">
                                                    <div style="background: #e5e7eb; height: 8px; border-radius: 4px;">
                                                        <div style="background: ${isDebt ? '#ef4444' : (usedPercent > 80 ? '#f59e0b' : '#10b981')}; width: ${usedPercent}%; height: 100%; border-radius: 4px;"></div>
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

    triggerManualAutoReset() {
        const year = new Date().getFullYear();
        const res = this.autoResetAnnualLeaveQuota(year);
        alert(`Auto-Reset Cuti 1 Januari (${res.year}) berhasil dijalankan untuk ${res.count} karyawan aktif.`);
        this.render();
    },

    showCreateModal() {
        const modalId = 'leave-create-modal';
        let modal = document.getElementById(modalId);
        if (!modal) {
            modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'modal-overlay hidden';
            document.body.appendChild(modal);
        }

        const employees = Storage.getEmployees ? Storage.getEmployees().filter(e => e.status === 'active') : [];
        const today = new Date().toISOString().split('T')[0];

        // Group leave types by category
        const categories = [...new Set(this.leaveTypes.map(t => t.category))];

        modal.innerHTML = `
            <div class="modal" style="max-width: 550px; background: #181B22; border: 1px solid #374151; border-radius: 12px; color: white;">
                <div class="modal-header" style="background: transparent; border-bottom: 1px solid #374151; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center;">
                    <h3 class="modal-title" style="color: #ef4444; font-size: 18px; font-weight: 600; margin: 0;">Entry Ijin & Cuti</h3>
                    <button class="modal-close" id="closeModal" onclick="LeaveManagement.closeCreateModal()" style="color: #9ca3af; background: none; border: none; font-size: 24px; cursor: pointer; line-height: 1;">×</button>
                </div>
                <div class="modal-body" style="padding: 20px;">
                    <form id="formEntryIjin" onsubmit="event.preventDefault(); LeaveManagement.submitForm();">
                        <!-- Pilih Karyawan -->
                        <div class="form-group mb-4" style="margin-bottom: 16px;">
                            <label class="block text-xs font-medium text-gray-400 mb-1" style="display: block; font-size: 12px; color: #9ca3af; margin-bottom: 4px; font-weight: 500;">KARYAWAN *</label>
                            <select id="lv-employee" class="form-select w-full bg-[#212631] border border-gray-700 rounded-lg p-2.5 text-sm text-white" style="width: 100%; background: #212631; border: 1px solid #374151; border-radius: 8px; padding: 10px; color: white; font-size: 14px;" required>
                                <option value="">-- Pilih Karyawan --</option>
                                ${employees.map(e => `<option value="${e.nik}" data-name="${e.name}">${e.nik} - ${e.name}</option>`).join('')}
                            </select>
                        </div>

                        <!-- Tanggal Ijin -->
                        <div class="grid grid-cols-2 gap-4 mb-4" style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                            <div>
                                <label class="block text-xs font-medium text-gray-400 mb-1" style="display: block; font-size: 12px; color: #9ca3af; margin-bottom: 4px; font-weight: 500;">TANGGAL IJIN *</label>
                                <input type="date" id="lv-date-from" class="form-input w-full bg-[#212631] border border-gray-700 rounded-lg p-2 text-sm text-white" style="width: 100%; background: #212631; border: 1px solid #374151; border-radius: 8px; padding: 8px 10px; color: white; font-size: 14px;" value="${today}" required>
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-400 mb-1" style="display: block; font-size: 12px; color: #9ca3af; margin-bottom: 4px; font-weight: 500;">SAMPAI *</label>
                                <input type="date" id="lv-date-to" class="form-input w-full bg-[#212631] border border-gray-700 rounded-lg p-2 text-sm text-white" style="width: 100%; background: #212631; border: 1px solid #374151; border-radius: 8px; padding: 8px 10px; color: white; font-size: 14px;" value="${today}" required>
                            </div>
                        </div>

                        <!-- Jenis Ijin -->
                        <div class="form-group mb-4" style="margin-bottom: 16px;">
                            <label class="block text-xs font-medium text-gray-400 mb-1" style="display: block; font-size: 12px; color: #9ca3af; margin-bottom: 4px; font-weight: 500;">JENIS IJIN *</label>
                            <select id="jenisIjinSelect" class="form-select w-full bg-[#212631] border border-gray-700 rounded-lg p-2.5 text-sm text-white" style="width: 100%; background: #212631; border: 1px solid #374151; border-radius: 8px; padding: 10px; color: white; font-size: 14px;" required onchange="LeaveManagement.onLeaveTypeChange(this.value)">
                                <option value="">-- Pilih Jenis Ijin --</option>
                                <option value="cuti_tahunan">Cuti Tahunan</option>
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

                        <!-- Smart Checkboxes -->
                        <div class="flex items-center space-x-6 mb-4 bg-[#212631] p-3 rounded-lg border border-gray-700" style="display: flex; align-items: center; gap: 24px; margin-bottom: 16px; background: #212631; padding: 12px; border-radius: 8px; border: 1px solid #374151;">
                            <label class="flex items-center space-x-2 text-sm cursor-pointer" style="display: flex; align-items: center; gap: 8px; font-size: 14px; cursor: pointer; color: white;">
                                <input type="checkbox" id="chkGajiDibayar" class="rounded bg-gray-900 border-gray-700 text-red-600 focus:ring-0" checked>
                                <span>Gaji Dibayar</span>
                            </label>
                            <label class="flex items-center space-x-2 text-sm cursor-pointer" style="display: flex; align-items: center; gap: 8px; font-size: 14px; cursor: pointer; color: white;">
                                <input type="checkbox" id="chkPotongCuti" class="rounded bg-gray-900 border-gray-700 text-red-600 focus:ring-0">
                                <span>Potong Cuti</span>
                            </label>
                        </div>

                        <!-- Verification Checkbox for External Document (Google Drive) -->
                        <div class="mb-4 bg-[#212631] p-3 rounded-lg border border-gray-700" style="margin-bottom: 16px; background: #212631; padding: 12px; border-radius: 8px; border: 1px solid #374151;">
                            <label class="flex items-center space-x-2 text-sm cursor-pointer text-gray-300" style="display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer; color: #d1d5db;">
                                <input type="checkbox" id="chkDocVerified" class="rounded bg-gray-900 border-gray-700 text-red-600 focus:ring-0">
                                <span>Surat Sakit / Dokumen Pendukung Telah Diverifikasi (Tersimpan di Google Drive)</span>
                            </label>
                        </div>

                        <!-- Keterangan & Link Drive -->
                        <div class="mb-5" style="margin-bottom: 20px;">
                            <label class="block text-xs font-medium text-gray-400 mb-1" style="display: block; font-size: 12px; color: #9ca3af; margin-bottom: 4px; font-weight: 500;">KETERANGAN & LINK GOOGLE DRIVE</label>
                            <textarea id="lv-notes" rows="2" class="w-full bg-[#212631] border border-gray-700 rounded-lg p-2.5 text-sm text-white" style="width: 100%; background: #212631; border: 1px solid #374151; border-radius: 8px; padding: 10px; color: white; font-size: 14px;" placeholder="Catatan tambahan atau tempel link Google Drive surat sakit di sini..."></textarea>
                        </div>

                        <!-- Action Buttons -->
                        <div class="flex justify-end space-x-3 border-t border-gray-700 pt-4" style="display: flex; justify-content: flex-end; gap: 12px; border-top: 1px solid #374151; padding-top: 16px;">
                            <button type="button" class="btn btn-secondary px-4 py-2 bg-gray-800 text-gray-300 text-sm rounded-lg hover:bg-gray-700" style="padding: 8px 16px; background: #1f2937; color: #d1d5db; border: none; border-radius: 8px; cursor: pointer;" onclick="LeaveManagement.closeCreateModal()">Batal</button>
                            <button type="submit" class="btn btn-primary px-5 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700" style="padding: 8px 20px; background: #dc2626; color: white; font-weight: 500; border: none; border-radius: 8px; cursor: pointer;">Submit</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        modal.classList.remove('hidden');
    },

    closeCreateModal() {
        const modal = document.getElementById('leave-create-modal');
        if (modal) modal.classList.add('hidden');
    },

    onLeaveTypeChange(code) {
        const paidChk = document.getElementById('chkGajiDibayar') || document.getElementById('lv-paid');
        const deductChk = document.getElementById('chkPotongCuti') || document.getElementById('lv-deduct');
        const docVerifiedChk = document.getElementById('chkDocVerified');

        if (code === 'cuti_tahunan' || code === 'A.10') {
            if (paidChk) paidChk.checked = true;
            if (deductChk) deductChk.checked = true;
        } else if (code === 'sakit_dokter' || code === 'A.12' || code === 'A.40') {
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

        // Update description
        const desc = document.getElementById('lv-type-desc');
        if (desc) {
            if (code === 'sakit_dokter') {
                desc.textContent = 'Memerlukan verifikasi surat dokter di Google Drive.';
            } else if (code.startsWith('B.310')) {
                desc.textContent = 'Keterangan bagi karyawan yang tidak melakukan absen ketika datang';
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

        const leaveTypeCode = document.getElementById('jenisIjinSelect')?.value || document.getElementById('lv-type')?.value;
        if (!leaveTypeCode) {
            alert('Pilih jenis ijin.');
            return;
        }

        const paidChk = document.getElementById('chkGajiDibayar') || document.getElementById('lv-paid');
        const deductChk = document.getElementById('chkPotongCuti') || document.getElementById('lv-deduct');
        const docVerifiedChk = document.getElementById('chkDocVerified');

        const data = {
            employeeNik,
            employeeName,
            leaveTypeCode,
            dateFrom: document.getElementById('lv-date-from').value,
            dateTo: document.getElementById('lv-date-to').value,
            isPaid: paidChk ? paidChk.checked : true,
            deductLeave: deductChk ? deductChk.checked : false,
            isDocVerified: docVerifiedChk ? docVerifiedChk.checked : false,
            notes: document.getElementById('lv-notes')?.value || ''
        };

        const result = await this.createRequest(data);
        if (result.success) {
            alert(`Entry Ijin berhasil disimpan dengan ID: ${result.id}`);
            this.closeCreateModal();
            this.render();
        } else {
            alert('Gagal menyimpan: ' + result.error);
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
