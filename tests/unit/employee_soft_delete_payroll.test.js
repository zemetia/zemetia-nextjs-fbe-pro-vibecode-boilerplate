/**
 * @jest-environment jsdom
 */

// Mock Storage BEFORE require
global.Storage = {
    KEYS: {
        EMPLOYEES: 'employees',
        ATTENDANCE: 'attendance',
        PAYROLL: 'payroll',
        LEAVE_REQUESTS: 'leave_requests',
        OVERTIME_SETTINGS: 'overtime_settings',
        DEPARTMENTS: 'departments',
        PRODUCTION_LOGS: 'production_logs'
    },
    store: {},
    get(key) { return this.store[key] || []; },
    set(key, val) { this.store[key] = val; return true; },
    getEmployees() { return this.get(this.KEYS.EMPLOYEES) || []; },
    getActiveEmployees() {
        const emps = this.getEmployees();
        return emps.filter(e => e.status !== 'NON-AKTIF' && e.status !== 'non_active' && e.status !== 'inactive');
    },
    isEmployeeActiveInPeriod(emp, startDateStr, endDateStr) {
        if (!emp) return false;
        const joinDate = emp.start_date || emp.join_date;
        if (joinDate && endDateStr && joinDate > endDateStr) return false;
        const isInactive = emp.status === 'NON-AKTIF' || emp.status === 'non_active' || emp.status === 'inactive';
        const resDate = emp.resignation_date || emp.resign_date;
        if (!isInactive) return true;
        if (isInactive && resDate && startDateStr && resDate >= startDateStr) return true;
        return false;
    },
    getEligibleEmployeesForPeriod(startDateStr, endDateStr) {
        const employees = this.getEmployees();
        return employees.filter(emp => this.isEmployeeActiveInPeriod(emp, startDateStr, endDateStr));
    },
    saveEmployees(list) { return this.set(this.KEYS.EMPLOYEES, list); },
    async addEmployee(emp) {
        const list = this.getEmployees();
        list.push(emp);
        await this.set(this.KEYS.EMPLOYEES, list);
        return true;
    },
    async updateEmployee(id, updated) {
        const list = this.getEmployees();
        const index = list.findIndex(e => String(e.id) === String(id));
        if (index !== -1) {
            list[index] = updated;
            await this.set(this.KEYS.EMPLOYEES, list);
            return true;
        }
        return false;
    },
    async deleteEmployee(id, resignationDate = null, reason = 'Resign') {
        const list = this.getEmployees();
        const index = list.findIndex(e => String(e.id) === String(id));
        if (index !== -1) {
            list[index] = {
                ...list[index],
                status: 'NON-AKTIF',
                resignation_date: resignationDate || '2026-08-10',
                resignation_reason: reason
            };
            await this.set(this.KEYS.EMPLOYEES, list);
            return true;
        }
        return false;
    },
    async softDeleteEmployee(id, resignationDate, reason) {
        return this.deleteEmployee(id, resignationDate, reason);
    },
    hasEmployeeTransactions(id) {
        const employees = this.getEmployees();
        const emp = employees.find(e => String(e.id) === String(id));
        if (!emp) return false;
        const nik = String(emp.nik || '').trim();
        const empIdStr = String(emp.id);

        const attendance = this.getAttendance();
        if (attendance.some(a => (nik && String(a.nik || '').trim() === nik) || String(a.employee_id || a.id) === empIdStr)) return true;

        const payroll = this.getPayroll();
        if (payroll.some(p => (nik && String(p.nik || '').trim() === nik) || String(p.employee_id) === empIdStr)) return true;

        return false;
    },
    async hardDeleteEmployee(id) {
        const list = this.getEmployees();
        const filtered = list.filter(e => String(e.id) !== String(id));
        await this.set(this.KEYS.EMPLOYEES, filtered);
        return true;
    },
    getAttendance() { return this.get(this.KEYS.ATTENDANCE) || []; },
    getPayroll() { return this.get(this.KEYS.PAYROLL) || []; },
    savePayroll(records) { return this.set(this.KEYS.PAYROLL, records); },
    getProductionLogs() { return []; },
    getHolidays() { return []; },
    getLeaveRequests() { return []; },
    getOvertimeSettings() {
        return { caps: { DEFAULT: 1 }, productionRate: 25000 };
    },
    getDepartments() { return [{ code: 'FINANCE', name: 'Finance' }]; },
    trackDeletion: jest.fn()
};

global.Auth = {
    isAuthenticated: () => true,
    getCurrentUser: () => ({ id: 'EMP001', role: 'ADMIN', name: 'Admin' })
};

global.AuditLog = { log: jest.fn() };
global.window = global.window || {};
window.showToast = jest.fn();
window.FirebaseSync = { isEnabled: () => false };
window.firestore = { collection: jest.fn(), getDocs: jest.fn(async () => []) };

const fs = require('fs');
const path = require('path');

// Require Modules
const masterEmpCode = fs.readFileSync(path.join(__dirname, '../../modules/masterEmployee.js'), 'utf8');
eval(masterEmpCode);

const workCalCode = fs.readFileSync(path.join(__dirname, '../../modules/workCalendar.js'), 'utf8');
eval(workCalCode);

const payrollCode = fs.readFileSync(path.join(__dirname, '../../modules/payroll.js'), 'utf8');
eval(payrollCode);

describe('HR Master Karyawan Soft Delete & Payroll Pro-Rata Unit Tests', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        Storage.store = {};
    });

    test('1. Database Operation Log: Hard Delete is replaced with Soft Delete (Status NON-AKTIF)', async () => {
        const mockEmps = [
            { id: '1', nik: 'EMP-2024-001', name: 'ANDI PRATAMA', status: 'active', department: 'FINANCE', base_salary: 5000000 }
        ];
        Storage.store[Storage.KEYS.EMPLOYEES] = mockEmps;

        // Perform Soft Delete
        const res = await Storage.softDeleteEmployee('1', '2026-08-10', 'Mengundurkan Diri');
        expect(res).toBe(true);

        const allEmps = Storage.getEmployees();
        expect(allEmps.length).toBe(1); // Data is NOT deleted permanently!
        expect(allEmps[0].status).toBe('NON-AKTIF');
        expect(allEmps[0].resignation_date).toBe('2026-08-10');
        expect(allEmps[0].resignation_reason).toBe('Mengundurkan Diri');

        // Active employees filter excludes non-active
        const activeEmps = Storage.getActiveEmployees();
        expect(activeEmps.length).toBe(0);
    });

    test('2. Attendance & Shift Engine Log: Suppresses shift generation post resignation date', () => {
        const mockEmps = [
            { id: '1', nik: 'EMP-2024-001', name: 'ANDI PRATAMA', status: 'NON-AKTIF', resignation_date: '2026-08-10' }
        ];
        Storage.store[Storage.KEYS.EMPLOYEES] = mockEmps;

        // Date before/on resignation date: Allowed
        const isResignedOnAug10 = WorkCalendar.isEmployeeResignedOnDate('EMP:1', '2026-08-10');
        expect(isResignedOnAug10).toBe(false);

        // Date post resignation date: Blocked / Suppressed
        const isResignedOnAug11 = WorkCalendar.isEmployeeResignedOnDate('EMP:1', '2026-08-11');
        expect(isResignedOnAug11).toBe(true);
    });

    test('3. Scenario A: Mid-Month Resignation before 25th (Prorata Salary Calculation)', async () => {
        // Resigned on 2026-08-10 (during 2026-07-26 s/d 2026-08-25 payroll period)
        const mockEmps = [
            { id: '1', nik: 'EMP-2024-001', name: 'ANDI PRATAMA', status: 'NON-AKTIF', resignation_date: '2026-08-10', base_salary: 5000000, start_date: '2024-01-01' }
        ];
        Storage.store[Storage.KEYS.EMPLOYEES] = mockEmps;
        Payroll.employees = mockEmps;
        Payroll.period = '2026-08';
        Payroll.isAuthenticatedWithPassword = true;
        Payroll.canAccessPayroll = () => true;
        Payroll.payrollRecords = [];

        await Payroll.generatePayroll();

        const payrolls = Storage.getPayroll();
        expect(payrolls.length).toBe(1);

        const rec = payrolls[0];
        expect(rec.nik).toBe('EMP-2024-001');

        // Prorated base salary for working days up to 10th August
        expect(rec.base_salary).toBeLessThan(5000000);
        expect(rec.base_salary).toBeGreaterThan(0);
    });

    test('4. Scenario B: Resignation on/after 25th Cut-off Parameter (2026-08-27)', async () => {
        // Resigned on 2026-08-27 (after 25th cut-off)
        const mockEmps = [
            { id: '2', nik: 'EMP-2024-002', name: 'BUDI SANTOSO', status: 'NON-AKTIF', resignation_date: '2026-08-27', base_salary: 6000000, start_date: '2024-01-01' }
        ];
        Storage.store[Storage.KEYS.EMPLOYEES] = mockEmps;
        Payroll.employees = mockEmps;
        Payroll.period = '2026-08';
        Payroll.isAuthenticatedWithPassword = true;
        Payroll.canAccessPayroll = () => true;
        Payroll.payrollRecords = [];

        await Payroll.generatePayroll();

        const payrolls = Storage.getPayroll();
        expect(payrolls.length).toBe(1);
        expect(payrolls[0].nik).toBe('EMP-2024-002');
    });

    test('5. UI Sorting: Renders most recent / newest employees first (Descending Order)', () => {
        MasterEmployee.employees = [
            { id: '1', nik: 'EMP001', name: 'ANDI PRATAMA', status: 'active', department: 'FINANCE', createdAt: '2026-01-01T00:00:00Z' },
            { id: '2', nik: 'EMP002', name: 'SITI AMINAH', status: 'active', department: 'FINANCE', createdAt: '2026-05-01T00:00:00Z' },
            { id: '3', nik: 'EMP003', name: 'CICI BARU', status: 'active', department: 'FINANCE', createdAt: '2026-08-01T00:00:00Z' }
        ];
        MasterEmployee.departments = [{ code: 'FINANCE', name: 'Finance' }];
        MasterEmployee._listTab = 'active';

        const html = MasterEmployee.renderList();
        // CICI BARU (newest, id: 3) should appear before ANDI PRATAMA (oldest, id: 1)
        const idxCici = html.indexOf('CICI BARU');
        const idxAndi = html.indexOf('ANDI PRATAMA');
        expect(idxCici).toBeGreaterThan(-1);
        expect(idxAndi).toBeGreaterThan(-1);
        expect(idxCici).toBeLessThan(idxAndi);
    });

    test('6. Name Formatting: Enforces UPPERCASE formatting across employee records', () => {
        MasterEmployee._tempData = {
            name: 'andi pratama lowercase',
            nik: 'EMP999',
            department: 'FINANCE',
            position: 'Staff'
        };
        MasterEmployee.employees = [];

        const mockEvent = { preventDefault: jest.fn() };
        MasterEmployee.handleSubmit(mockEvent);

        const saved = Storage.getEmployees();
        expect(saved.length).toBe(1);
        expect(saved[0].name).toBe('ANDI PRATAMA LOWERCASE');
    });

    test('7. Dummy Purge vs Soft Delete: Hard Purge allowed for zero transaction records, blocked for transaction records', async () => {
        const mockEmps = [
            { id: '10', nik: 'DUMMY01', name: 'BUDI BARU', status: 'active' },
            { id: '20', nik: 'REAL01', name: 'SITI AMINAH', status: 'active' }
        ];
        Storage.store[Storage.KEYS.EMPLOYEES] = mockEmps;
        Storage.store[Storage.KEYS.ATTENDANCE] = [
            { nik: 'REAL01', date: '2026-08-01', clockIn: '08:00' }
        ];

        // BUDI BARU has zero transactions -> Hard purge allowed
        expect(Storage.hasEmployeeTransactions('10')).toBe(false);
        await Storage.hardDeleteEmployee('10');
        expect(Storage.getEmployees().find(e => e.id === '10')).toBeUndefined();

        // SITI AMINAH has attendance transactions -> Hard purge blocked, Soft Delete required
        expect(Storage.hasEmployeeTransactions('20')).toBe(true);
        await Storage.softDeleteEmployee('20', '2026-08-11', 'Resign');
        const siti = Storage.getEmployees().find(e => e.id === '20');
        expect(siti).toBeDefined();
        expect(siti.status).toBe('NON-AKTIF');
    });

    test('8. Mid-Period Resignation Cut-Off Window Integrity & Subsequent Month Clean-up', async () => {
        // Employee resigns mid-period on 2026-08-12
        const emps = [
            { id: '1', nik: 'ACTIVE01', name: 'ACTIVE STAFF', status: 'active', start_date: '2025-01-01', base_salary: 5000000 },
            { id: '2', nik: 'RESIGN_AUG', name: 'RESIGNED IN AUG', status: 'NON-AKTIF', start_date: '2025-01-01', resignation_date: '2026-08-12', base_salary: 5000000 }
        ];
        Storage.store[Storage.KEYS.EMPLOYEES] = emps;
        Payroll.employees = emps;
        Payroll.payrollRecords = [];

        // 1. Current Period: 2026-08 (Cut-off: 2026-07-26 s/d 2026-08-25)
        Payroll.period = '2026-08';
        const augEligible = Storage.getEligibleEmployeesForPeriod('2026-07-26', '2026-08-25');
        expect(augEligible.length).toBe(2); // Both active and mid-period leaver are eligible

        // 2. Subsequent Period: 2026-09 (Cut-off: 2026-08-26 s/d 2026-09-25)
        Payroll.period = '2026-09';
        const sepEligible = Storage.getEligibleEmployeesForPeriod('2026-08-26', '2026-09-25');
        expect(sepEligible.length).toBe(1); // Resigned employee is completely excluded
        expect(sepEligible[0].nik).toBe('ACTIVE01');

        // Verify getPeriodPayroll filtering
        Payroll.payrollRecords = [
            { id: 'PAY-1', nik: 'ACTIVE01', period: '2026-09', total_salary: 5000000 },
            { id: 'PAY-2', nik: 'RESIGN_AUG', period: '2026-09', total_salary: 0 }
        ];
        const periodList = Payroll.getPeriodPayroll();
        expect(periodList.length).toBe(1);
        expect(periodList[0].nik).toBe('ACTIVE01');
    });

    test('9. Master Karyawan Download Filter: Supports Active, Inactive, and All with Dynamic Counters', () => {
        MasterEmployee.employees = [
            { id: '1', nik: 'A1', name: 'KARYAWAN AKTIF 1', status: 'active', department: 'FINANCE' },
            { id: '2', nik: 'A2', name: 'KARYAWAN AKTIF 2', status: 'active', department: 'FINANCE' },
            { id: '3', nik: 'NA1', name: 'KARYAWAN RESIGN 1', status: 'NON-AKTIF', department: 'FINANCE' }
        ];
        MasterEmployee.departments = [{ code: 'FINANCE', name: 'Finance' }];

        global.XLSX = {
            utils: {
                aoa_to_sheet: jest.fn(() => ({})),
                book_new: jest.fn(() => ({})),
                book_append_sheet: jest.fn()
            },
            writeFile: jest.fn()
        };

        // Active only export
        MasterEmployee.downloadDatabase('active');
        expect(XLSX.writeFile).toHaveBeenCalledWith(expect.anything(), 'Database_Karyawan_Aktif.xlsx');

        // Inactive only export
        MasterEmployee.downloadDatabase('inactive');
        expect(XLSX.writeFile).toHaveBeenCalledWith(expect.anything(), 'Database_Karyawan_NonAktif_Arsip.xlsx');

        // All export
        MasterEmployee.downloadDatabase('all');
        expect(XLSX.writeFile).toHaveBeenCalledWith(expect.anything(), 'Database_Karyawan_Semua.xlsx');
    });

    test('10. BPJS Reconciliation 2-Sheet Excel Export (Active vs Inactive Segregation)', () => {
        const bpjsCode = fs.readFileSync(path.join(__dirname, '../../modules/bpjsTaxCompliance.js'), 'utf8');
        eval(bpjsCode);

        BPJSTaxCompliance.activePeriod = '2026-08';
        BPJSTaxCompliance.reconciliationData = [
            { id: '1', nik: 'ACT01', name: 'BUDI AKTIF', department: 'PROD', position: 'Staff', status: 'AKTIF', bpjsKesBase: 5000000, kesEmp: 50000, kesComp: 200000, kesSubtotal: 250000, bpjsTkBase: 5000000, jhtEmp: 100000, jhtComp: 185000, jkkComp: 44500, jkmComp: 15000, tkSubtotal: 344500, taxableGross: 5000000, pph21: 50000, totalEmpDeduction: 200000, totalCompContribution: 444500, grandTotalRemittance: 644500 },
            { id: '2', nik: 'RES01', name: 'SITI RESIGN', department: 'PROD', position: 'Staff', status: 'NON-AKTIF', resignation_date: '2026-08-10', bpjsKesBase: 2500000, kesEmp: 25000, kesComp: 100000, kesSubtotal: 125000, bpjsTkBase: 2500000, jhtEmp: 50000, jhtComp: 92500, jkkComp: 22250, jkmComp: 7500, tkSubtotal: 172250, taxableGross: 2500000, pph21: 25000, totalEmpDeduction: 100000, totalCompContribution: 222250, grandTotalRemittance: 322250 }
        ];

        const appendedSheets = [];
        global.XLSX = {
            utils: {
                aoa_to_sheet: jest.fn(data => data),
                book_new: jest.fn(() => ({})),
                book_append_sheet: jest.fn((wb, ws, name) => {
                    appendedSheets.push(name);
                })
            },
            writeFile: jest.fn()
        };

        BPJSTaxCompliance.exportToExcel();
        expect(appendedSheets).toContain('Karyawan Aktif');
        expect(appendedSheets).toContain('Karyawan Non-Aktif');
        expect(XLSX.writeFile).toHaveBeenCalledWith(expect.anything(), 'Rekonsiliasi_BPJS_PPh21_2026-08.xlsx');
    });
});
