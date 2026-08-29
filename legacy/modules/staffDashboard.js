// ==========================================
// Staff Dashboard Module
// PT. GOLDEN ALURA - Employee Self-Service
// ==========================================

const StaffDashboard = {
    async init() {
        if (!Auth.isAuthenticated()) {
            App.navigateTo('login');
            return;
        }

        const user = Auth.getCurrentUser();
        if (user.role !== 'EMPLOYEE') {
            alert('Akses hanya untuk Staff.');
            App.navigateTo('dashboard');
            return;
        }

        await this.loadData();
        this.render();
    },

    async loadData() {
        const user = Auth.getCurrentUser();
        this.employeeId = user.employeeId;

        // Load employee detail
        const employees = Storage.getEmployees();
        this.employee = employees.find(e => e.id === this.employeeId) || {};

        // Load attendance (filtered for this employee)
        const allAttendance = Storage.get(Storage.KEYS.ATTENDANCE) || [];
        this.attendance = allAttendance.filter(a => a.employee_id === this.employeeId);

        // Load payroll (filtered for this employee)
        const allPayroll = Storage.get(Storage.KEYS.PAYROLL) || [];
        this.payroll = allPayroll.filter(p => p.employee_id === this.employeeId);
    },

    render() {
        const content = document.getElementById('main-content');
        if (!content) return;

        content.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">🏠 Home Staff</h1>
                <p class="page-description">Welcome back, ${this.employee.name || 'Staff'}</p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <!-- Summary Card 1: Attendance -->
                <div class="card bg-primary text-white">
                    <div class="card-body">
                        <div class="flex justify-between align-center">
                            <div>
                                <p class="text-sm opacity-80">Kehadiran Bulan Ini</p>
                                <h2 class="text-2xl font-bold">${this.getMonthlyAttendanceCount()} Hari</h2>
                            </div>
                            <div class="text-3xl">📅</div>
                        </div>
                    </div>
                </div>

                <!-- Summary Card 2: Hours -->
                <div class="card bg-success text-white">
                    <div class="card-body">
                        <div class="flex justify-between align-center">
                            <div>
                                <p class="text-sm opacity-80">Total Jam Kerja (Bulan Ini)</p>
                                <h2 class="text-2xl font-bold">${this.getTotalHoursThisMonth()} Jam</h2>
                            </div>
                            <div class="text-3xl">🕒</div>
                        </div>
                    </div>
                </div>

                <!-- Summary Card 3: Last Slip -->
                <div class="card bg-info text-white">
                    <div class="card-body">
                        <div class="flex justify-between align-center">
                            <div>
                                <p class="text-sm opacity-80">Gaji Terakhir</p>
                                <h2 class="text-2xl font-bold">${this.getLastSalaryFormatted()}</h2>
                            </div>
                            <div class="text-3xl">💰</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <!-- Profile Section -->
                <div class="card">
                    <div class="card-header border-b">
                        <h2 class="card-title">👤 Profil Saya</h2>
                    </div>
                    <div class="card-body">
                        <div class="profile-info space-y-3">
                            <div class="flex border-b pb-2">
                                <span class="w-1/3 text-gray">NIK</span>
                                <span class="w-2/3 font-semibold">${this.employee.nik || '-'}</span>
                            </div>
                            <div class="flex border-b pb-2">
                                <span class="w-1/3 text-gray">Jabatan</span>
                                <span class="w-2/3">${this.employee.position || '-'} (${this.employee.job_level || '-'})</span>
                            </div>
                            <div class="flex border-b pb-2">
                                <span class="w-1/3 text-gray">Departemen</span>
                                <span class="w-2/3">${this.employee.department || '-'}</span>
                            </div>
                            <div class="flex border-b pb-2">
                                <span class="w-1/3 text-gray">Tgl Bergabung</span>
                                <span class="w-2/3">${this.employee.start_date || '-'}</span>
                            </div>
                            <div class="flex border-b pb-2">
                                <span class="w-1/3 text-gray">Email</span>
                                <span class="w-2/3">${this.employee.email || '-'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Recent Attendance -->
                <div class="card">
                    <div class="card-header border-b flex justify-between align-center">
                        <h2 class="card-title">📝 Kehadiran Terakhir</h2>
                        <button class="btn btn-sm btn-outline" onclick="App.navigateTo('staff-attendance')">Lihat Semua</button>
                    </div>
                    <div class="card-body">
                        <div class="table-container">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>Tanggal</th>
                                        <th>Masuk</th>
                                        <th>Pulang</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${this.renderRecentAttendance()}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- Latest Payslips -->
                <div class="card lg:col-span-2">
                    <div class="card-header border-b">
                        <h2 class="card-title">💵 Slip Gaji Terakhir</h2>
                    </div>
                    <div class="card-body">
                        <div class="table-container">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>Periode</th>
                                        <th>Gaji Pokok</th>
                                        <th>Tunjangan</th>
                                        <th>Potongan</th>
                                        <th>Total Diterima</th>
                                        <th>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${this.renderRecentPayslips()}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    getMonthlyAttendanceCount() {
        const now = new Date();
        const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        return this.attendance.filter(a => a.date && a.date.startsWith(monthYear)).length;
    },

    getTotalHoursThisMonth() {
        const now = new Date();
        const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const monthly = this.attendance.filter(a => a.date && a.date.startsWith(monthYear));

        // Sum the workday_hours if available
        return monthly.reduce((sum, a) => sum + (parseFloat(a.workday_hours) || 0), 0);
    },

    getLastSalaryFormatted() {
        if (this.payroll.length === 0) return 'Rp 0';

        // Sort by date/period reverse
        const sorted = [...this.payroll].sort((a, b) => new Date(b.period_end) - new Date(a.period_end));
        const last = sorted[0];
        return App.formatCurrency(last.net_salary || 0);
    },

    renderRecentAttendance() {
        if (this.attendance.length === 0) {
            return '<tr><td colspan="4" class="text-center text-gray italic">No attendance records yet.</td></tr>';
        }

        return this.attendance.slice(-5).reverse().map(a => `
            <tr>
                <td>${a.date}</td>
                <td>${a.clock_in || '-'}</td>
                <td>${a.clock_out || '-'}</td>
                <td><span class="badge ${a.status === 'present' ? 'badge-success' : 'badge-warning'}">${a.status || 'Present'}</span></td>
            </tr>
        `).join('');
    },

    renderRecentPayslips() {
        if (this.payroll.length === 0) {
            return '<tr><td colspan="6" class="text-center text-gray italic">No payslips available yet.</td></tr>';
        }

        return this.payroll.slice(-3).reverse().map(p => `
            <tr>
                <td><strong>${p.period_name || p.period}</strong></td>
                <td>${App.formatCurrency(p.base_salary)}</td>
                <td>${App.formatCurrency(p.total_allowances || 0)}</td>
                <td><span class="text-danger">-${App.formatCurrency(p.total_deductions || 0)}</span></td>
                <td><strong>${App.formatCurrency(p.net_salary)}</strong></td>
                <td>
                    <button class="btn btn-sm btn-info">👁️ View</button>
                    <button class="btn btn-sm btn-secondary">📥 PDF</button>
                </td>
            </tr>
        `).join('');
    }
};

window.StaffDashboard = StaffDashboard;
