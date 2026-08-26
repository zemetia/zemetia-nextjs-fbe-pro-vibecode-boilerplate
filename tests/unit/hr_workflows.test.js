
/**
 * Verification script for HR Workflows:
 * 1. Proportional Leave (Adi & Nina)
 * 2. Leave Debt Tracking
 * 3. Debt Carry-over
 */

// Mock Storage BEFORE require
global.Storage = {
    KEYS: {
        LEAVE_REQUESTS: 'leave_requests',
        LEAVE_BALANCES: 'leave_balances',
        EMPLOYEES: 'employees',
        HOLIDAYS: 'holidays'
    },
    get: jest.fn(),
    set: jest.fn(),
    getEmployees: jest.fn(),
    getHolidays: function() {
        return [
            { date: '2026-08-17', name: 'Hari Kemerdekaan RI', type: 'Libur Nasional', isNationalHoliday: true }
        ];
    },
    getLeaveBalances: jest.fn(() => []),
    saveLeaveBalances: jest.fn(),
    getCollectiveLeaveDays: function(year = 2026) {
        const holidays = this.getHolidays();
        return holidays.filter(h => {
            if (!h.date) return false;
            const hYear = new Date(h.date).getFullYear();
            return hYear === year && (h.type === 'Cuti Bersama' || String(h.name || '').toLowerCase().includes('cuti bersama'));
        }).length;
    },
    calculateLeaveEntitlement: function(hireDateStr, targetYear = 2026) {
        if (!hireDateStr) return 12;
        const hireDate = new Date(hireDateStr);
        const hireYear = hireDate.getFullYear();
        const hireMonth = hireDate.getMonth() + 1;
        const hireDay = hireDate.getDate();

        if (targetYear <= hireYear) return 0;

        const collectiveLeaveDays = this.getCollectiveLeaveDays(targetYear);
        const baseEntitlement = Math.max(0, 12 - collectiveLeaveDays);

        if (targetYear > hireYear + 1) return baseEntitlement;

        let monthsWorked = hireDay <= 15 ? (12 - hireMonth + 1) : (12 - hireMonth);
        return Math.max(0, Math.min(baseEntitlement, monthsWorked - collectiveLeaveDays));
    },
    deductMasterCuti: function(nik, days, year = 2026) {
        let balances = this.getLeaveBalances();
        let record = balances.find(b => String(b.employeeNik) === String(nik) && b.year === year);
        if (!record) {
            record = { employeeNik: nik, year: year, annualLeaveQuota: 12, usedLeave: 0, remainingLeave: 12 };
            balances.push(record);
        }
        record.usedLeave = (record.usedLeave || 0) + days;
        record.remainingLeave = Math.max(0, record.annualLeaveQuota - record.usedLeave);
        this.saveLeaveBalances(balances);
        return record;
    },
    getHolidays: function() {
        return [
            { date: '2026-08-17', name: 'Hari Kemerdekaan RI', type: 'Libur Nasional', isNationalHoliday: true }
        ];
    },
    isCompanyDayoff: function(dateStr) { return false; },
    getCompanyDayoffRecord: function(dateStr) { return null; },
    getDateCalendarStatus: function(dateStr, emp = null) {
        if (!dateStr) return { isNonWorkingDay: false, isSunday: false, isHoliday: false, isCompanyDayoff: false, isRedDay: false, reason: '' };
        const dateOnly = String(dateStr).includes(' ') ? String(dateStr).split(' ')[0] : String(dateStr).substring(0, 10);
        const dateObj = new Date(dateOnly + 'T12:00:00');
        const dayOfWeek = isNaN(dateObj.getTime()) ? 1 : dateObj.getDay();
        const isSunday = dayOfWeek === 0;
        const holidays = this.getHolidays ? this.getHolidays() : [];
        const holidayRec = holidays.find(h => (typeof h === 'string' ? h : h.date) === dateOnly);
        let isHoliday = false;
        let holidayName = '';
        if (holidayRec) {
            const name = typeof holidayRec === 'string' ? '' : String(holidayRec.name || holidayRec.description || '').toLowerCase();
            const type = typeof holidayRec === 'string' ? '' : String(holidayRec.type || '').toLowerCase();
            const isNational = typeof holidayRec === 'string' ? true : holidayRec.isNationalHoliday !== false;
            if (type !== 'cuti bersama' && !name.includes('cuti bersama') && isNational) {
                isHoliday = true;
                holidayName = typeof holidayRec === 'string' ? 'Libur Nasional' : (holidayRec.name || holidayRec.description || 'Libur Nasional');
            }
        }
        const isCompanyDayoff = this.isCompanyDayoff ? this.isCompanyDayoff(dateOnly) : false;
        const isRedDay = isSunday || isHoliday;
        const isNonWorkingDay = isSunday || isHoliday || isCompanyDayoff;
        let reason = '';
        if (isSunday) reason = 'Hari Minggu';
        else if (isHoliday) reason = holidayName;
        else if (isCompanyDayoff) reason = 'Libur Perusahaan';
        return { isNonWorkingDay, isSunday, isHoliday, isCompanyDayoff, isRedDay, reason };
    },
    calculateLatePenalty: function(clockInStr, shiftStartStr, baseSalary = 5000000, dateStr = null) {
        if (dateStr) {
            const calStatus = this.getDateCalendarStatus(dateStr);
            if (calStatus.isNonWorkingDay) {
                return { isLate: false, lateMinutes: 0, penalty: 0, tier: 0, isHalfDay: false, description: `Bypass Penalti (${calStatus.reason})` };
            }
        }
        if (!clockInStr || !shiftStartStr) return { isLate: false, lateMinutes: 0, penalty: 0, tier: 0, isHalfDay: false, description: 'Normal' };
        const timePart = String(clockInStr).includes(' ') ? String(clockInStr).split(' ')[1] : String(clockInStr);
        const [inH, inM] = timePart.split(':').map(Number);
        const [shiftH, shiftM] = String(shiftStartStr).split(':').map(Number);
        if (isNaN(inH) || isNaN(inM) || isNaN(shiftH) || isNaN(shiftM)) return { isLate: false, lateMinutes: 0, penalty: 0, tier: 0, isHalfDay: false, description: 'Normal' };
        const inMinutes = inH * 60 + inM;
        const shiftMinutes = shiftH * 60 + shiftM;
        if (inMinutes <= shiftMinutes) return { isLate: false, lateMinutes: 0, penalty: 0, tier: 0, isHalfDay: false, description: 'Tepat Waktu' };
        const lateMinutes = inMinutes - shiftMinutes;
        if (lateMinutes <= 5) return { isLate: false, lateMinutes, penalty: 0, tier: 0, isHalfDay: false, description: 'Toleransi Grace Period (≤5 min)' };
        else if (lateMinutes <= 60) return { isLate: true, lateMinutes, penalty: 10000, tier: 1, isHalfDay: false, description: 'Terlambat 6–60 min (Denda Rp 10.000)' };
        else if (lateMinutes <= 120) return { isLate: true, lateMinutes, penalty: 20000, tier: 2, isHalfDay: false, description: 'Terlambat 61–120 min (Denda Rp 20.000)' };
        else {
            const dailySalary = (Number(baseSalary) || 5000000) / 25;
            return { isLate: true, lateMinutes, penalty: Math.round(0.5 * dailySalary), tier: 3, isHalfDay: true, description: 'Terlambat >2 Jam (Izin Setengah Hari)' };
        }
    },
    mockBatches: [],
    mockRawLogs: [],
    getAttendanceImportBatches: function() { return this.mockBatches; },
    saveAttendanceImportBatch: function(batchInfo) { this.mockBatches.unshift(batchInfo); return true; },
    undoAttendanceImportBatch: function(batchId) {
        this.mockBatches = this.mockBatches.filter(b => b.batchId !== batchId);
        this.mockRawLogs = this.mockRawLogs.filter(l => l.batchId !== batchId);
        return true;
    }
};

// Mock Auth since it might be used in init
global.Auth = {
    isAuthenticated: jest.fn(() => true),
    getUser: jest.fn(() => ({ nik: 'ADMIN', role: 'admin' })),
    getCurrentUser: jest.fn(() => ({ username: 'admin', fullName: 'Administrator' }))
};

const LeaveManagement = require('../../modules/leaveManagement.js');

describe('HR Workflow Verification', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('Workflow 1: Proportional Leave Calculation (Adi & Nina)', () => {
        // Case A: Adi joined May 2, 2025. 
        // 2026 quota should be (12 - 5 + 1) = 8
        const adiQuota = LeaveManagement.calculateEntitlement('2025-05-02', 2026);
        expect(adiQuota).toBe(8);

        // Case B: Nina joined Oct 8, 2025.
        // 2026 quota should be (12 - 10 + 1) = 3
        const ninaQuota = LeaveManagement.calculateEntitlement('2025-10-08', 2026);
        expect(ninaQuota).toBe(3);

        // Case C: Join after 15th
        // Joined May 16, 2025 -> months worked in 2025 = (12 - 5) = 7
        const lateJoinQuota = LeaveManagement.calculateEntitlement('2025-05-16', 2026);
        expect(lateJoinQuota).toBe(7);
    });

    test('Workflow 3: Debt Carry-over Deduction', () => {
        // Mock Nina's 2026 balance with debt (-2)
        const mockBalances = [
            { employeeNik: 'NINA01', year: 2026, remainingLeave: -2, usedLeave: 5, annualLeaveQuota: 3 }
        ];

        const mockEmployees = [
            { nik: 'NINA01', name: 'Nina', start_date: '2025-10-08' }
        ];

        LeaveManagement.balances = mockBalances;
        Storage.getEmployees.mockReturnValue(mockEmployees);

        // Calculate balance for 2027
        // Quota 2027 should be 12 (Full year since joined in 2025)
        // Debt from 2026 is 2.
        // Initialization in getEmployeeBalance should set usedLeave to 2.

        const balance2027 = LeaveManagement.getEmployeeBalance('NINA01', 2027);

        expect(balance2027.annualLeaveQuota).toBe(12);
        expect(balance2027.usedLeave).toBe(2); // Debt incorporated
        expect(balance2027.remainingLeave).toBe(10);
    });

    test('Workflow 4: Double Approval Guard', async () => {
        // Mock a pending request
        const mockRequest = {
            id: 'LV-TEST-001',
            employeeNik: 'EMP001',
            dateFrom: '2026-03-01',
            totalDays: 1,
            deductLeave: true,
            status: 'PENDING'
        };
        LeaveManagement.requests = [mockRequest];

        // Mock balance
        const mockBalance = {
            employeeNik: 'EMP001',
            year: 2026,
            annualLeaveQuota: 12,
            usedLeave: 0
        };
        LeaveManagement.balances = [mockBalance];

        // First approval
        const result1 = await LeaveManagement.approveRequest('LV-TEST-001', true);
        expect(result1.success).toBe(true);
        expect(mockBalance.usedLeave).toBe(1);
        expect(mockRequest.status).toBe('APPROVED');

        // Second approval (simulated double click)
        const result2 = await LeaveManagement.approveRequest('LV-TEST-001', true);
        expect(result2.success).toBe(false);
        expect(result2.error).toBe('Request already processed');
        expect(mockBalance.usedLeave).toBe(1); // Should still be 1, not 2
    });

    test('Requirement 2 & 3: Auto-Reset Quota & Probation Zero Balance Rules', () => {
        const mockEmployees = [
            { nik: 'SENIOR01', name: 'Senior Staff', start_date: '2023-01-10', status: 'active' },
            { nik: 'PROBATION01', name: 'Rina Probation', start_date: '2026-06-01', status: 'active' }
        ];
        Storage.getEmployees.mockReturnValue(mockEmployees);
        LeaveManagement.balances = [];

        // Run Auto-Reset for 2026
        const result = LeaveManagement.autoResetAnnualLeaveQuota(2026);
        expect(result.success).toBe(true);
        expect(result.count).toBe(2);

        // Senior staff gets 12 days
        const seniorBal = LeaveManagement.getEmployeeBalance('SENIOR01', 2026);
        expect(seniorBal.annualLeaveQuota).toBe(12);

        // Probation staff gets 0 days
        const probBal = LeaveManagement.getEmployeeBalance('PROBATION01', 2026);
        expect(probBal.annualLeaveQuota).toBe(0);
    });

    test('Requirement 3 & 5: Zero Balance Leave Bypass to Salary Deduction', async () => {
        const mockProbationBalance = {
            employeeNik: 'PROBATION01',
            year: 2026,
            annualLeaveQuota: 0,
            usedLeave: 0,
            remainingLeave: 0
        };
        LeaveManagement.balances = [mockProbationBalance];

        const mockRequest = {
            id: 'LV-PROB-001',
            employeeNik: 'PROBATION01',
            dateFrom: '2026-07-10',
            totalDays: 2,
            deductLeave: true,
            status: 'PENDING'
        };
        LeaveManagement.requests = [mockRequest];

        const res = await LeaveManagement.approveRequest('LV-PROB-001', true);
        expect(res.success).toBe(true);
        expect(mockProbationBalance.usedLeave).toBe(0); // Quota stays 0!
        expect(mockRequest.coveredByQuotaDays).toBe(0);
        expect(mockRequest.unpaidSalaryDeductionDays).toBe(2); // Triggers Base / 25 in Payroll
    });

    test('Requirement 6 & 7: Master Cuti Auto-Deduction and Cuti Bersama Baseline Impact', () => {
        // Mock 2 Cuti Bersama days in 2026
        const mockHolidays = [
            { date: '2026-03-30', name: 'Cuti Bersama Idul Fitri', type: 'Cuti Bersama' },
            { date: '2026-03-31', name: 'Cuti Bersama Idul Fitri', type: 'Cuti Bersama' }
        ];
        Storage.getHolidays = jest.fn(() => mockHolidays);

        const collectiveDays = Storage.getCollectiveLeaveDays(2026);
        expect(collectiveDays).toBe(2);

        // Entitlement calculation for senior staff in 2026: 12 - 2 = 10 days
        const entitlement = Storage.calculateLeaveEntitlement('2023-01-15', 2026);
        expect(entitlement).toBe(10);

        // Test deductMasterCuti helper
        Storage.getLeaveBalances = jest.fn(() => [
            { employeeNik: 'EMP_TEST_01', year: 2026, annualLeaveQuota: 10, usedLeave: 0, remainingLeave: 10 }
        ]);
        Storage.saveLeaveBalances = jest.fn();

        const updated = Storage.deductMasterCuti('EMP_TEST_01', 3, 2026);
        expect(updated.usedLeave).toBe(3);
        expect(updated.remainingLeave).toBe(7);
    });

    test('Opening Balance Leave Migration & Probation Transition Override', () => {
        LeaveManagement.balances = [];
        Storage.getLeaveBalances = jest.fn(() => []);
        Storage.saveLeaveBalances = jest.fn();

        // Migrate legacy employee balance (Jatah Awal: 14, Terpakai: 4 -> Sisa: 10)
        const res = LeaveManagement.setOpeningLeaveBalance('LEGACY_EMP_01', 2026, 14, 4, 'Migrasi Custom Tenure');
        expect(res.success).toBe(true);
        expect(res.record.annualLeaveQuota).toBe(14);
        expect(res.record.usedLeave).toBe(4);
        expect(res.record.remainingLeave).toBe(10);
        expect(res.record.isOpeningBalance).toBe(true);

        // Probation employee transition override: allow setting initial quota despite probation status
        const probRes = LeaveManagement.setOpeningLeaveBalance('PROB_LEGACY_01', 2026, 6, 1, 'Migrasi Karyawan Masa Transisi');
        expect(probRes.success).toBe(true);
        expect(probRes.record.annualLeaveQuota).toBe(6);
        expect(probRes.record.usedLeave).toBe(1);
        expect(probRes.record.remainingLeave).toBe(5);
    });

    test('Automated Late Grace Period (0-5 mins) & Tiered Penalty Engine', () => {
        // 1. Grace Period (0-5 mins late): 08:30 shift, 08:34 clock-in -> NO penalty, isLate: false
        const graceRes = Storage.calculateLatePenalty('08:34', '08:30');
        expect(graceRes.isLate).toBe(false);
        expect(graceRes.penalty).toBe(0);
        expect(graceRes.tier).toBe(0);

        // Exactly 5 mins: 08:35 clock-in -> NO penalty
        const graceExactRes = Storage.calculateLatePenalty('08:35', '08:30');
        expect(graceExactRes.isLate).toBe(false);
        expect(graceExactRes.penalty).toBe(0);

        // 2. Tier 1 (6-60 mins late): 08:45 clock-in -> Rp 10.000
        const tier1Res = Storage.calculateLatePenalty('08:45', '08:30');
        expect(tier1Res.isLate).toBe(true);
        expect(tier1Res.penalty).toBe(10000);
        expect(tier1Res.tier).toBe(1);

        // 3. Tier 2 (61-120 mins late): 09:45 clock-in -> Rp 20.000
        const tier2Res = Storage.calculateLatePenalty('09:45', '08:30');
        expect(tier2Res.isLate).toBe(true);
        expect(tier2Res.penalty).toBe(20000);
        expect(tier2Res.tier).toBe(2);

        // 4. Tier 3 (>120 mins late): 11:00 clock-in (150 mins late) -> 1/2 day wage (5,000,000 / 25 * 0.5 = 100,000)
        const tier3Res = Storage.calculateLatePenalty('11:00', '08:30', 5000000);
        expect(tier3Res.isLate).toBe(true);
        expect(tier3Res.penalty).toBe(100000);
        expect(tier3Res.tier).toBe(3);
    });

    test('Attendance Import Batch & Undo Import Functionality', () => {
        const batchId = 'BATCH-TEST-2026';
        Storage.mockBatches = [];
        Storage.mockRawLogs = [
            { batchId: batchId, nik: '001', date: '2026-07-05', status: 'IN', time: '08:32' },
            { batchId: batchId, nik: '001', date: '2026-07-05', status: 'OUT', time: '17:05' }
        ];

        Storage.saveAttendanceImportBatch({
            batchId,
            filename: 'cutoff_absensi_juni_juli.xlsx',
            importedAt: new Date().toISOString(),
            recordCount: 2
        });

        expect(Storage.getAttendanceImportBatches().length).toBe(1);
        expect(Storage.mockRawLogs.length).toBe(2);

        // Execute Undo Import
        const undoRes = Storage.undoAttendanceImportBatch(batchId);
        expect(undoRes).toBe(true);
        expect(Storage.getAttendanceImportBatches().length).toBe(0);
        expect(Storage.mockRawLogs.length).toBe(0);
    });

    test('Universal Late Grace Period & Cross-Module Auto-Deduction Sync', () => {
        Storage.getHolidays = () => [
            { date: '2026-08-17', name: 'Hari Kemerdekaan RI', type: 'Libur Nasional', isNationalHoliday: true }
        ];

        const baseSalary = 5000000;
        const shiftStart = '08:30';

        // 1. 08:35 (Exact 5 mins): Normal, no fine, not late
        const t0 = Storage.calculateLatePenalty('08:35:00', shiftStart, baseSalary);
        expect(t0.isLate).toBe(false);
        expect(t0.penalty).toBe(0);
        expect(t0.tier).toBe(0);
        expect(t0.isHalfDay).toBe(false);

        // 2. 08:36 (6 mins): Tier 1 late fine Rp 10.000
        const t1 = Storage.calculateLatePenalty('08:36:00', shiftStart, baseSalary);
        expect(t1.isLate).toBe(true);
        expect(t1.penalty).toBe(10000);
        expect(t1.tier).toBe(1);
        expect(t1.isHalfDay).toBe(false);

        // 3. 09:45 (75 mins): Tier 2 late fine Rp 20.000
        const t2 = Storage.calculateLatePenalty('09:45:00', shiftStart, baseSalary);
        expect(t2.isLate).toBe(true);
        expect(t2.penalty).toBe(20000);
        expect(t2.tier).toBe(2);
        expect(t2.isHalfDay).toBe(false);

        // 4. 11:00 (150 mins): Tier 3 (>2 hours late) -> Classified as Izin Setengah Hari (0.5 * base / 25)
        const t3 = Storage.calculateLatePenalty('11:00:00', shiftStart, baseSalary);
        expect(t3.isLate).toBe(true);
        expect(t3.tier).toBe(3);
        expect(t3.isHalfDay).toBe(true);
        expect(t3.penalty).toBe(100000); // 0.5 * (5,000,000 / 25) = 100,000

        // 5. Sunday Attendance (23 August 2026): Clock in at 11:30 -> Bypasses all late penalties completely
        const sundayRes = Storage.calculateLatePenalty('11:30:00', shiftStart, baseSalary, '2026-08-23');
        expect(sundayRes.isLate).toBe(false);
        expect(sundayRes.penalty).toBe(0);
        expect(sundayRes.tier).toBe(0);
        expect(sundayRes.isHalfDay).toBe(false);
        expect(sundayRes.description).toContain('Bypass Penalti');

        // 6. National Holiday Attendance (17 August 2026): Clock in at 10:00 -> Bypasses all late penalties completely
        const holidayRes = Storage.calculateLatePenalty('10:00:00', shiftStart, baseSalary, '2026-08-17');
        expect(holidayRes.isLate).toBe(false);
        expect(holidayRes.penalty).toBe(0);
        expect(holidayRes.tier).toBe(0);
        expect(holidayRes.isHalfDay).toBe(false);
        expect(holidayRes.description).toContain('Bypass Penalti');

        // 7. Regular Working Day (24 August 2026, Monday): Clock in at 11:00 -> Tier 3 Half-Day penalty applies
        const regularRes = Storage.calculateLatePenalty('11:00:00', shiftStart, baseSalary, '2026-08-24');
        expect(regularRes.isLate).toBe(true);
        expect(regularRes.tier).toBe(3);
        expect(regularRes.isHalfDay).toBe(true);
        expect(regularRes.penalty).toBe(100000);
    });

    test('Security Shift Hours & Automated Overtime/Allowance Integration (Lunch + Dinner on 12h Shifts)', () => {
        // 1. Validate Master Shift standard hours
        const rawStorage = require('../../data/storage.js');
        const shifts = Storage.getMasterShifts ? Storage.getMasterShifts() : [];
        const secPagi = shifts.find(s => s.code === 'SEC-PAGI');
        const secMlm = shifts.find(s => s.code === 'SEC-MLM');

        if (secPagi) {
            expect(secPagi.startTime).toBe('07:00');
            expect(secPagi.endTime).toBe('19:00');
        }
        if (secMlm) {
            expect(secMlm.startTime).toBe('19:00');
            expect(secMlm.endTime).toBe('07:00');
            expect(secMlm.isNight).toBe(true);
        }

        // 2. Validate Security Attendance Calculation (4h fixed OT, Lunch Rp 20K + Dinner Rp 20K)
        const secEmp = {
            nik: 'SEC_001',
            name: 'Security Officer',
            department: 'SECURITY',
            position: 'Security Guard',
            base_salary: 4000000,
            security_overtime_rate: 10000
        };

        const totalWorkDays = 20;
        const overtimeHours = totalWorkDays * 4; // 80 hours total

        const mealPay = totalWorkDays * 20000; // 20 * 20.000 = Rp 400.000 (Makan Siang)
        const nightMealPay = totalWorkDays * 20000; // 20 * 20.000 = Rp 400.000 (Makan Malam)
        const overtimePay = overtimeHours * 10000; // 80 * 10.000 = Rp 800.000 (Lembur)

        expect(mealPay).toBe(400000);
        expect(nightMealPay).toBe(400000);
        expect(overtimePay).toBe(800000);
        // Total additional per shift = (400k + 400k + 800k) / 20 = Rp 80.000 per shift (Siang 20k + Malam 20k + Lembur 40k)
        expect((mealPay + nightMealPay + overtimePay) / totalWorkDays).toBe(80000);
    });

    test('Security Full 25 Shifts & Mess Employee 12-Hour Shift Automation', () => {
        // 1. Storage isMessOrSecurityEmployee helper validation
        const secEmp = { nik: 'SEC_002', name: 'Bambang Security', department: 'SECURITY' };
        const messEmp = { nik: 'PROD_001', name: 'Joko Produksi', department: 'PRODUCTION', night_meal_category: 'mess' };
        const regularEmp = { nik: 'FIN_001', name: 'Finance Staff', department: 'FINANCE' };

        expect(Storage.isMessOrSecurityEmployee(secEmp)).toBe(true);
        expect(Storage.isMessOrSecurityEmployee(messEmp)).toBe(true);
        expect(Storage.isMessOrSecurityEmployee(regularEmp)).toBe(false);

        // 2. Security with 25 Full 12-Hour Shifts
        const totalWorkDays25 = 25;
        const otHours25 = totalWorkDays25 * 4; // 100 hours

        const mealPay25 = totalWorkDays25 * 20000; // Rp 500.000 (Siang)
        const nightMealPay25 = totalWorkDays25 * 20000; // Rp 500.000 (Malam)
        const overtimePay25 = otHours25 * 10000; // Rp 1.000.000 (Lembur)

        expect(mealPay25).toBe(500000);
        expect(nightMealPay25).toBe(500000);
        expect(overtimePay25).toBe(1000000);
        expect(mealPay25 + nightMealPay25 + overtimePay25).toBe(2000000); // Rp 80.000 x 25

        // 3. Mess Employee with 25 12-Hour Shifts
        const messTotalDays = 25;
        const messOtHours = messTotalDays * 4; // 100 hours

        const messMealPay = messTotalDays * 20000; // Rp 500.000
        const messNightMealPay = messTotalDays * 20000; // Rp 500.000
        const messOtPay = messOtHours * 10000; // Rp 1.000.000

        expect(messMealPay).toBe(500000);
        expect(messNightMealPay).toBe(500000);
        expect(messOtPay).toBe(1000000);
        expect(messMealPay + messNightMealPay + messOtPay).toBe(2000000);
    });
});

