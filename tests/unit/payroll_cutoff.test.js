const fs = require('fs');
const path = require('path');

// Mock Storage
global.Storage = {
    KEYS: {
        PAYROLL: 'erp_payroll',
        PAYROLL_PERIODS: 'erp_payroll_periods',
        PAYROLL_WORKDAYS: 'erp_payroll_workdays',
        PAYROLL_WORKDAYS_AUDIT: 'erp_payroll_workdays_audit',
        PRODUCTION_ORDERS: 'erp_production_orders',
        LEAVE_REQUESTS: 'LEAVE_REQUESTS'
    },
    getPayrollPeriods: jest.fn(() => []),
    savePayrollPeriods: jest.fn(),
    getPayrollWorkdays: jest.fn(() => []),
    savePayrollWorkdays: jest.fn(),
    getPayrollWorkdaysAudit: jest.fn(() => []),
    savePayrollWorkdaysAudit: jest.fn(),
    getCurrentUserRole: jest.fn(() => 'SUPER_ADMIN'),
    getEmployees: jest.fn(() => []),
    getOvertimeSettings: jest.fn(() => ({})),
    getProductionLogs: jest.fn(() => []),
    getHolidays: jest.fn(() => []),
    isSecurityEmployee: (emp) => {
        if (!emp) return false;
        const dept = String(emp.department || '').toLowerCase();
        const div = String(emp.division || emp.job_level || '').toLowerCase();
        const pos = String(emp.position || '').toLowerCase();
        return dept.includes('security') || div.includes('security') || pos.includes('security') || pos.includes('satpam');
    },
    get: jest.fn(() => []),
    set: jest.fn()
};

global.App = {
    formatCurrency: (val) => `Rp ${Math.round(val || 0).toLocaleString('id-ID')}`
};

// Properly attach db and firestore to the JSDOM window
global.window.db = {};
global.window.firestore = {
    collection: jest.fn(),
    getDocs: jest.fn().mockResolvedValue({
        forEach: jest.fn()
    }),
    query: jest.fn(),
    where: jest.fn(),
    limit: jest.fn()
};

const Payroll = require('../../modules/payroll.js');

describe('Flexible Payroll Cut-Off Engine', () => {
    beforeEach(() => {
        jest.restoreAllMocks();
        jest.clearAllMocks();
        Storage.getPayrollPeriods.mockReturnValue([]);
        Payroll.period = '2026-07';
        Payroll.payrollRecords = [];
        // Create the main-content container in the JSDOM document
        document.body.innerHTML = '<div id="main-content"></div>';
        
        // Setup default firestore mock resolved value
        global.window.firestore.getDocs.mockResolvedValue({
            forEach: jest.fn()
        });
    });

    test('getPeriodDates: Default Cut-Off (26th to 25th)', () => {
        Storage.getPayrollPeriods.mockReturnValue([]);
        const dates = Payroll.getPeriodDates('2026-07');
        expect(dates.startDate).toBe('2026-06-26');
        expect(dates.endDate).toBe('2026-07-25');
        expect(dates.isCustom).toBe(false);
    });

    test('getPeriodDates: Estafet Logic with Custom End Date Override', () => {
        // Setup July 2026 override to 20th
        const customPeriods = [
            { period: '2026-07', endDate: '2026-07-20', updatedAt: new Date().toISOString() }
        ];
        Storage.getPayrollPeriods.mockReturnValue(customPeriods);

        // July 2026 should have custom end date and default start date
        const datesJuly = Payroll.getPeriodDates('2026-07');
        expect(datesJuly.startDate).toBe('2026-06-26');
        expect(datesJuly.endDate).toBe('2026-07-20');
        expect(datesJuly.isCustom).toBe(true);

        // August 2026 should automatically start on 21 July (July End Date + 1 day)
        const datesAugust = Payroll.getPeriodDates('2026-08');
        expect(datesAugust.startDate).toBe('2026-07-21');
        expect(datesAugust.endDate).toBe('2026-08-25');
        expect(datesAugust.isCustom).toBe(false);
    });

    test('countWorkingDaysMonSat: Correct Mon-Sat Days Excluding Sundays', () => {
        const workDays = Payroll.countWorkingDaysMonSat('2026-06-26', '2026-07-20');
        expect(workDays).toBe(21);
    });

    test('generatePayroll: Regular Employee gets 100% Gaji Pokok', async () => {
        const mockEmployees = [
            { nik: 'EMP001', name: 'Adi Reguler', base_salary: 5000000, status: 'active', department: 'OTHER' }
        ];
        Storage.getEmployees.mockReturnValue(mockEmployees);
        Storage.getOvertimeSettings.mockReturnValue({
            bpjs_health_emp: 1,
            jht_emp: 2
        });

        Payroll.employees = mockEmployees;
        Payroll.isAuthenticatedWithPassword = true;

        await Payroll.generatePayroll();

        const generated = Payroll.payrollRecords;
        expect(generated.length).toBe(1);
        expect(generated[0].base_salary).toBe(5000000); // 100% full
    });

    test('generatePayroll: New Hire Prorata (Joined Mid-Period)', async () => {
        const mockEmployees = [
            { nik: 'EMP002', name: 'Budi Baru', base_salary: 5000000, start_date: '2026-07-01', status: 'active', department: 'OTHER' }
        ];
        Storage.getEmployees.mockReturnValue(mockEmployees);
        Storage.getOvertimeSettings.mockReturnValue({});

        Payroll.employees = mockEmployees;
        Payroll.isAuthenticatedWithPassword = true;

        await Payroll.generatePayroll();

        const generated = Payroll.payrollRecords;
        expect(generated.length).toBe(1);
        expect(generated[0].base_salary).toBe(4200000);
    });

    test('generatePayroll: Leaver Prorata (Resigned Mid-Period)', async () => {
        const mockEmployees = [
            { nik: 'EMP003', name: 'Cici Resign', base_salary: 5000000, resign_date: '2026-07-10', status: 'inactive', department: 'OTHER' }
        ];
        Storage.getEmployees.mockReturnValue(mockEmployees);
        Storage.getOvertimeSettings.mockReturnValue({});

        Payroll.employees = mockEmployees;
        Payroll.isAuthenticatedWithPassword = true;

        await Payroll.generatePayroll();

        const generated = Payroll.payrollRecords;
        expect(generated.length).toBe(1);
        expect(generated[0].base_salary).toBe(2600000);
    });

    test('generatePayroll: Annual Leave Quota First (Zero Deduction when Quota > 0)', async () => {
        const mockEmployees = [
            { nik: 'EMP_LEAVE1', name: 'Eka Cuti', base_salary: 5000000, status: 'active', annual_leave_quota: 12, department: 'OTHER' }
        ];
        Storage.getEmployees.mockReturnValue(mockEmployees);
        Storage.getOvertimeSettings.mockReturnValue({});

        Payroll.employees = mockEmployees;
        Payroll.isAuthenticatedWithPassword = true;

        jest.spyOn(Payroll, 'calculateAttendanceForRange').mockResolvedValue([
            {
                nik: 'EMP_LEAVE1',
                work_days: 23,
                overtime_hours: 0,
                night_days: 0,
                extra_days: 0,
                late_count: 0,
                absence_days: 2, // 2 days absence, covered by 12 days quota
                half_day_izin: 0,
                production_grams: 0
            }
        ]);

        await Payroll.generatePayroll();

        const generated = Payroll.payrollRecords;
        expect(generated.length).toBe(1);
        expect(generated[0].covered_by_quota_days).toBe(2);
        expect(generated[0].unpaid_absence_days).toBe(0);
        expect(generated[0].absence_deduction).toBe(0); // 0 deduction! Base salary 100% flat!
    });

    test('generatePayroll: Exhausted Quota triggers Base/25 Deduction', async () => {
        const mockEmployees = [
            { nik: 'EMP_LEAVE2', name: 'Fani Habis Cuti', base_salary: 5000000, status: 'active', annual_leave_quota: 0, department: 'OTHER' }
        ];
        Storage.getEmployees.mockReturnValue(mockEmployees);
        Storage.getOvertimeSettings.mockReturnValue({});

        Payroll.employees = mockEmployees;
        Payroll.isAuthenticatedWithPassword = true;

        jest.spyOn(Payroll, 'calculateAttendanceForRange').mockResolvedValue([
            {
                nik: 'EMP_LEAVE2',
                work_days: 23,
                overtime_hours: 0,
                night_days: 0,
                extra_days: 0,
                late_count: 0,
                absence_days: 2, // 2 days absence, quota is 0 -> unpaid!
                half_day_izin: 0,
                production_grams: 0
            }
        ]);

        await Payroll.generatePayroll();

        const generated = Payroll.payrollRecords;
        expect(generated.length).toBe(1);
        expect(generated[0].covered_by_quota_days).toBe(0);
        expect(generated[0].unpaid_absence_days).toBe(2);
        expect(generated[0].absence_deduction).toBe(400000); // 2 * (5,000,000 / 25) = 400,000
    });

    test('generatePayroll: Shifted Cut-off & Deferred Compensation ("Kekurangan Gaji Juni")', async () => {
        const mockEmployees = [
            { nik: 'EMP_DEFICIEN', name: 'Gilang Rapel', base_salary: 5000000, status: 'active', previous_month_deficiency: 350000, department: 'OTHER' }
        ];
        Storage.getEmployees.mockReturnValue(mockEmployees);
        Storage.getOvertimeSettings.mockReturnValue({});

        Payroll.employees = mockEmployees;
        Payroll.isAuthenticatedWithPassword = true;

        jest.spyOn(Payroll, 'calculateAttendanceForRange').mockResolvedValue([
            {
                nik: 'EMP_DEFICIEN',
                work_days: 25,
                overtime_hours: 0,
                night_days: 0,
                extra_days: 0,
                late_count: 0,
                absence_days: 0,
                half_day_izin: 0,
                production_grams: 0
            }
        ]);

        await Payroll.generatePayroll();

        const generated = Payroll.payrollRecords;
        expect(generated.length).toBe(1);
        expect(generated[0].previous_month_deficiency).toBe(350000);
        expect(generated[0].previous_month_name).toBe('Juni');
        expect(generated[0].meal_pay).toBe(500000); // 25 days * 20,000 = 500,000
        expect(generated[0].total_salary).toBe(5850000); // 5.000.000 (Base) + 350.000 (Deficiency) + 500.000 (Meal)
    });

    test('generatePayroll: Security Division Rule (Accumulated 26 days -> 100% Base Salary & Custom Overtime Rate)', async () => {
        const mockEmployees = [
            { nik: 'SEC_001', name: 'Budi Satpam', base_salary: 5000000, status: 'active', department: 'HR / Personalia', division: 'Security', position: 'Security Guard', security_overtime_rate: 10000 }
        ];
        Storage.getEmployees.mockReturnValue(mockEmployees);
        Storage.getOvertimeSettings.mockReturnValue({});

        Payroll.employees = mockEmployees;
        Payroll.isAuthenticatedWithPassword = true;

        jest.spyOn(Payroll, 'calculateAttendanceForRange').mockResolvedValue([
            {
                nik: 'SEC_001',
                work_days: 26, // Meets target 26 days
                overtime_hours: 10, // 10 hours overtime duration
                night_days: 0,
                extra_days: 0,
                late_count: 0, // 0 late count for security
                absence_days: 0,
                half_day_izin: 0,
                production_grams: 0
            }
        ]);

        await Payroll.generatePayroll();

        const generated = Payroll.payrollRecords;
        expect(generated.length).toBe(1);
        expect(generated[0].work_days).toBe(26);
        expect(generated[0].unpaid_absence_days).toBe(0);
        expect(generated[0].absence_deduction).toBe(0);
        expect(generated[0].meal_pay).toBe(520000); // 26 days * 20,000 = 520,000
        expect(generated[0].overtime_pay).toBe(100000); // 10 hours * 10,000 = 100,000
        expect(generated[0].total_salary).toBe(5620000); // 5,000,000 (Base) + 100,000 (OT) + 520,000 (Meal)
    });

    test('generatePayroll: Security Division Quantitative Surplus Attendance (27 days present -> +1 Surplus Working Day Incentive)', async () => {
        const mockEmployees = [
            { nik: 'SEC_SURPLUS', name: 'Joko Satpam Surplus', base_salary: 5000000, status: 'active', department: 'HR / Personalia', division: 'Security', position: 'Security Guard' }
        ];
        Storage.getEmployees.mockReturnValue(mockEmployees);
        Storage.getOvertimeSettings.mockReturnValue({});

        Payroll.employees = mockEmployees;
        Payroll.isAuthenticatedWithPassword = true;

        jest.spyOn(Payroll, 'calculateAttendanceForRange').mockResolvedValue([
            {
                nik: 'SEC_SURPLUS',
                work_days: 27, // 27 days present (1 day surplus over 26 target)
                overtime_hours: 0,
                night_days: 0,
                extra_days: 1,
                late_count: 0,
                absence_days: 0,
                half_day_izin: 0,
                production_grams: 0
            }
        ]);

        await Payroll.generatePayroll();

        const generated = Payroll.payrollRecords;
        expect(generated.length).toBe(1);
        expect(generated[0].work_days).toBe(27);
        expect(generated[0].surplus_work_days).toBe(1);
        expect(generated[0].surplus_work_pay).toBe(200000); // 1 * (5,000,000 / 25) = 200,000
        expect(generated[0].meal_pay).toBe(540000); // 27 * 20,000 = 540,000
        expect(generated[0].total_salary).toBe(5740000); // 5,000,000 (Base) + 200,000 (Surplus) + 540,000 (Meal)
    });

    test('generatePayroll: BPJS calculation uses bpjs_wage_basis if defined, otherwise falls back to base_salary', async () => {
        const mockEmployees = [
            { nik: 'EMP_BPJS1', name: 'Emp BPJS Custom', base_salary: 5000000, bpjs_wage_basis: 6000000, status: 'active', department: 'OTHER' },
            { nik: 'EMP_BPJS2', name: 'Emp BPJS Fallback', base_salary: 5000000, status: 'active', department: 'OTHER' }
        ];
        Storage.getEmployees.mockReturnValue(mockEmployees);
        Storage.getOvertimeSettings.mockReturnValue({
            bpjs_health_emp: 1, // 1%
            jht_emp: 2, // 2%
            bpjs_health_comp: 4, // 4%
            jht_comp: 3.7 // 3.7%
        });

        Payroll.employees = mockEmployees;
        Payroll.isAuthenticatedWithPassword = true;

        // Stub calculateAttendanceForRange to return empty/basic data
        jest.spyOn(Payroll, 'calculateAttendanceForRange').mockResolvedValue([
            { nik: 'EMP_BPJS1', work_days: 25, overtime_hours: 0, night_days: 0, extra_days: 0, late_count: 0, absence_days: 0, half_day_izin: 0, production_grams: 0 },
            { nik: 'EMP_BPJS2', work_days: 25, overtime_hours: 0, night_days: 0, extra_days: 0, late_count: 0, absence_days: 0, half_day_izin: 0, production_grams: 0 }
        ]);

        await Payroll.generatePayroll();

        const generated = Payroll.payrollRecords;
        expect(generated.length).toBe(2);

        // Employee 1: Custom BPJS wage basis = 6,000,000
        // bpjs_health_deduction = 1% of 6,000,000 = 60,000
        // jht_deduction = 2% of 6,000,000 = 120,000
        // bpjs_health_benefit = 4% of 6,000,000 = 240,000
        // jht_benefit = 3.7% of 6,000,000 = 222,000
        const rec1 = generated.find(r => r.nik === 'EMP_BPJS1');
        expect(rec1.bpjs_health_deduction).toBe(60000);
        expect(rec1.jht_deduction).toBe(120000);
        expect(rec1.bpjs_health_benefit).toBe(240000);
        expect(rec1.jht_benefit).toBe(222000);

        // Employee 2: Fallback to base_salary = 5,000,000
        // bpjs_health_deduction = 1% of 5,000,000 = 50,000
        // jht_deduction = 2% of 5,000,000 = 100,000
        // bpjs_health_benefit = 4% of 5,000,000 = 200,000
        // jht_benefit = 3.7% of 5,000,000 = 185,000
        const rec2 = generated.find(r => r.nik === 'EMP_BPJS2');
        expect(rec2.bpjs_health_deduction).toBe(50000);
        expect(rec2.jht_deduction).toBe(100000);
        expect(rec2.bpjs_health_benefit).toBe(200000);
        expect(rec2.jht_benefit).toBe(185000);
    });

    test('syncDraftBaseSalaries: Syncs draft payroll record when employee base salary or PTKP changes in master data', async () => {
        const mockEmployees = [
            { nik: 'EMP_SYNC', name: 'Emp Sync Test', base_salary: 5000000, status: 'active', department: 'OTHER', ptkp: 'TK/0' }
        ];
        Storage.getEmployees.mockReturnValue(mockEmployees);
        Storage.getOvertimeSettings.mockReturnValue({});

        Payroll.employees = mockEmployees;
        Payroll.payrollRecords = [
            {
                id: 'PAY-2026-07-EMP_SYNC',
                nik: 'EMP_SYNC',
                name: 'Emp Sync Test',
                period: '2026-07',
                base_salary: 4000000, // Old salary
                status: 'draft',
                ptkp: 'TK/0',
                bpjs_health_deduction: 0,
                jht_deduction: 0,
                total_salary: 4000000
            }
        ];

        jest.spyOn(Payroll, 'calculateAttendanceForRange').mockResolvedValue([
            { nik: 'EMP_SYNC', work_days: 25, overtime_hours: 0, night_days: 0, extra_days: 0, late_count: 0, absence_days: 0, half_day_izin: 0, production_grams: 0 }
        ]);

        await Payroll.syncDraftBaseSalaries();

        expect(Payroll.payrollRecords[0].base_salary).toBe(5000000); // Updated to 5,000,000
        expect(Payroll.payrollRecords[0].total_salary).toBe(5500000); // Recalculated total (base + 25 * 20000 meal)
        expect(Storage.set).toHaveBeenCalledWith(Storage.KEYS.PAYROLL, Payroll.payrollRecords);
    });

    test('syncDraftBaseSalaries: Does not change finalized/paid payroll records', async () => {
        const mockEmployees = [
            { nik: 'EMP_SYNC2', name: 'Emp Sync Paid Test', base_salary: 6000000, status: 'active', department: 'OTHER', ptkp: 'TK/0' }
        ];
        Storage.getEmployees.mockReturnValue(mockEmployees);
        
        Payroll.employees = mockEmployees;
        Payroll.payrollRecords = [
            {
                id: 'PAY-2026-07-EMP_SYNC2',
                nik: 'EMP_SYNC2',
                name: 'Emp Sync Paid Test',
                period: '2026-07',
                base_salary: 4000000,
                status: 'paid', // Already paid
                ptkp: 'TK/0',
                bpjs_health_deduction: 0,
                jht_deduction: 0,
                total_salary: 4000000
            }
        ];

        await Payroll.syncDraftBaseSalaries();

        expect(Payroll.payrollRecords[0].base_salary).toBe(4000000); // Remains 4,000,000
    });

    test('Onboarding Exception: calculateAttendanceForRange bypasses late count and grants full credit on Day 1', async () => {
        const mockEmployees = [
            { id: 'EMP_NEW1', nik: 'EMP_NEW1', name: 'New Hire Late Day 1', start_date: '2026-07-01', department: 'OTHER' }
        ];
        
        // Mock shift schedule for 2026-07-01
        const shifts = [
            { id: 'SHIFT_PAGI', startTime: '08:00', endTime: '17:00', isNight: false }
        ];
        Storage.get.mockImplementation((key) => {
            if (key === Storage.KEYS.MASTER_SHIFTS) return shifts;
            return [];
        });

        // Mock raw attendance log on Day 1 (late clock-in at 09:10 due to HR administrative onboarding)
        const mockRawLogs = [
            { nik: 'EMP_NEW1', date: '2026-07-01', status: 'IN', timestamp: '2026-07-01 09:10:00' },
            { nik: 'EMP_NEW1', date: '2026-07-01', status: 'OUT', timestamp: '2026-07-01 17:05:00' }
        ];

        // Mock window.firestore functions
        global.window.firestore.getDocs.mockResolvedValue({
            forEach: (callback) => {
                mockRawLogs.forEach(log => callback({ data: () => log }));
            }
        });

        // Mock Calendar Data to assign SHIFT_PAGI to Day 1
        // calendarData['2026-07']['EMP:EMP_NEW1']['01'] = 'SHIFT_PAGI'
        global.Storage.getWorkCalendar = jest.fn(() => ({
            '2026-07': {
                'EMP:EMP_NEW1': {
                    '01': 'SHIFT_PAGI'
                }
            }
        }));

        const atd = await Payroll.calculateAttendanceForRange(mockEmployees, '2026-07-01', '2026-07-01');

        expect(atd.length).toBe(1);
        expect(atd[0].work_days).toBe(1); // Full attendance credit
        expect(atd[0].late_count).toBe(0); // Late penalty bypassed (should have been 1 if not first day)
    });

    test('Onboarding Exception: generatePayroll sets is_first_day correctly', async () => {
        const mockEmployees = [
            { nik: 'EMP_NEW2', name: 'New Hire Gen', base_salary: 5000000, start_date: '2026-07-01', status: 'active', department: 'OTHER' }
        ];
        Storage.getEmployees.mockReturnValue(mockEmployees);
        Storage.getOvertimeSettings.mockReturnValue({});
        
        Payroll.employees = mockEmployees;
        Payroll.isAuthenticatedWithPassword = true;

        jest.spyOn(Payroll, 'calculateAttendanceForRange').mockResolvedValue([
            { nik: 'EMP_NEW2', work_days: 20, overtime_hours: 0, night_days: 0, extra_days: 0, late_count: 0, absence_days: 0, half_day_izin: 0, production_grams: 0 }
        ]);

        await Payroll.generatePayroll();

        const rec = Payroll.payrollRecords.find(r => r.nik === 'EMP_NEW2');
        expect(rec).toBeDefined();
        expect(rec.is_first_day).toBe(true);
    });

    describe('Progressive Late Penalty Matrix & Manual Override', () => {
        test('calculateAttendanceForRange correctly computes tiered late deductions', async () => {
            const mockEmployees = [
                { id: 'EMP_LATE_1', nik: 'EMP_LATE_1', name: 'Late Employee', base_salary: 5000000, start_date: '2026-06-01', department: 'OTHER' }
            ];
            const shifts = [
                { id: 'SHIFT_PAGI', startTime: '08:30', endTime: '17:30', isNight: false }
            ];
            Storage.get.mockImplementation((key) => {
                if (key === Storage.KEYS.MASTER_SHIFTS) return shifts;
                return [];
            });
            global.Storage.getWorkCalendar = jest.fn(() => ({
                '2026-07': {
                    'EMP:EMP_LATE_1': {
                        '01': 'SHIFT_PAGI',
                        '02': 'SHIFT_PAGI',
                        '03': 'SHIFT_PAGI',
                        '04': 'SHIFT_PAGI',
                        '05': 'SHIFT_PAGI',
                    }
                }
            }));

            // Daily raw attendance logs representing different lateness tiers:
            // Day 1: 08:34:00 (Grace period, Rp 0)
            // Day 2: 08:45:00 (<= 1 hour late, Rp 10.000)
            // Day 3: 09:40:00 (1 to 2 hours late, Rp 20.000)
            // Day 4: 11:00:00 (> 2 hours late, half-day: 0.5 * (5.000.000 / 25) = Rp 100.000)
            // Day 5: 08:30:00 (On time, Rp 0)
            const mockLogs = [
                { nik: 'EMP_LATE_1', date: '2026-07-01', status: 'IN', timestamp: '2026-07-01 08:34:00' },
                { nik: 'EMP_LATE_1', date: '2026-07-01', status: 'OUT', timestamp: '2026-07-01 17:30:00' },

                { nik: 'EMP_LATE_1', date: '2026-07-02', status: 'IN', timestamp: '2026-07-02 08:45:00' },
                { nik: 'EMP_LATE_1', date: '2026-07-02', status: 'OUT', timestamp: '2026-07-02 17:30:00' },

                { nik: 'EMP_LATE_1', date: '2026-07-03', status: 'IN', timestamp: '2026-07-03 09:40:00' },
                { nik: 'EMP_LATE_1', date: '2026-07-03', status: 'OUT', timestamp: '2026-07-03 17:30:00' },

                { nik: 'EMP_LATE_1', date: '2026-07-04', status: 'IN', timestamp: '2026-07-04 11:00:00' },
                { nik: 'EMP_LATE_1', date: '2026-07-04', status: 'OUT', timestamp: '2026-07-04 17:30:00' },

                { nik: 'EMP_LATE_1', date: '2026-07-05', status: 'IN', timestamp: '2026-07-05 08:30:00' },
                { nik: 'EMP_LATE_1', date: '2026-07-05', status: 'OUT', timestamp: '2026-07-05 17:30:00' }
            ];

            global.window.firestore.getDocs.mockResolvedValue({
                forEach: (callback) => {
                    mockLogs.forEach(log => callback({ data: () => log }));
                }
            });

            const atd = await Payroll.calculateAttendanceForRange(mockEmployees, '2026-07-01', '2026-07-05');
            expect(atd.length).toBe(1);
            // Day 2 (10k) + Day 3 (20k) + Day 4 (100k) = 130.000 total late deduction
            expect(atd[0].late_deduction).toBe(130000);
            expect(atd[0].late_count).toBe(4); // 4 days actually late (1 is in grace period)
        });

        test('Payroll.handleLateBlur triggers override justification modal and recalculates net salary THP', async () => {
            // Setup a mock record in Payroll
            const record = {
                id: 'PAY-REC-TEST-1',
                nik: 'EMP_TEST_1',
                base_salary: 5000000,
                meal_pay: 500000,
                late_deduction: 40000,
                calculated_late_deduction: 40000,
                absence_deduction: 0,
                half_day_deduction: 0,
                bpjs_health_deduction: 50000,
                jht_deduction: 100000,
                pph21_deduction: 0,
                total_salary: 5350000
            };
            Payroll.payrollRecords = [record];

            // Render dummy input element
            document.body.innerHTML = `
                <input type="text" id="test-late-input" value="10.000" data-calculated="40000">
            `;
            const inputEl = document.getElementById('test-late-input');

            // Call handleLateBlur
            Payroll.handleLateBlur(inputEl, 'PAY-REC-TEST-1');

            // Verify modal was opened
            const modalEl = document.getElementById('late-override-modal');
            expect(modalEl).not.toBeNull();

            // Check validation of justification
            const saveBtn = modalEl.querySelector('#late-override-modal-save-btn');
            const errorMsg = modalEl.querySelector('#override-error-msg');
            const textarea = modalEl.querySelector('#override-late-reason');

            // Try saving empty
            saveBtn.click();
            expect(errorMsg.style.display).toBe('block');

            // Type reason and save
            textarea.value = 'Keperluan darurat keluarga';
            saveBtn.click();

            // Verify override applied and modal removed
            expect(document.getElementById('late-override-modal')).toBeNull();
            expect(record.late_deduction_override).toBe(10000);
            expect(record.keterangan_override_late).toBe('Keperluan darurat keluarga');
            expect(record.late_deduction).toBe(10000);

            // Recalculated THP: Earnings 5.5M - Deductions (10k late + 50k bpjs + 100k jht) = 5.340.000
            expect(record.total_salary).toBe(5340000);
        });
    });
});
