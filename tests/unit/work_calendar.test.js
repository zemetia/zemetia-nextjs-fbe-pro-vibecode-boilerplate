/**
 * @jest-environment jsdom
 */

// Mock Storage and dependencies before requiring WorkCalendar
global.Storage = {
    KEYS: {
        WORK_CALENDAR: 'work_calendar',
        HOLIDAYS: 'holidays',
        DEPARTMENTS: 'departments',
        EMPLOYEES: 'employees'
    },
    getWorkCalendar: jest.fn(() => ({})),
    saveWorkCalendar: jest.fn(async (data) => data),
    getMasterShifts: jest.fn(() => [
        { id: 'SHIFT-OFFICE', name: 'Office Normal', startTime: '08:00', endTime: '17:00' },
        { id: 'SHIFT-SABTU', name: 'Office Sabtu', startTime: '08:00', endTime: '13:00' }
    ]),
    getHolidays: jest.fn(() => [
        { date: '2026-08-17', name: 'Hari Kemerdekaan RI', type: 'Libur Nasional' }
    ]),
    getDepartments: jest.fn(() => [
        { code: 'FINANCE', name: 'Finance & Accounting' }
    ]),
    getEmployees: jest.fn(() => [
        { id: 'EMP001', nik: 'EMP001', name: 'Budi Santoso', department: 'FINANCE' }
    ]),
    get: jest.fn()
};

global.AuditLog = {
    log: jest.fn()
};

global.window = global.window || {};
window.showToast = jest.fn();

// Require WorkCalendar
const fs = require('fs');
const path = require('path');
const code = fs.readFileSync(path.join(__dirname, '../../modules/workCalendar.js'), 'utf8');

// Evaluate code in context
eval(code);

describe('Work Calendar Enhancements Unit Tests', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        WorkCalendar.calendarData = {};
        WorkCalendar.currentTarget = 'DEPT:FINANCE';
        WorkCalendar.currentYearMonth = '2026-08';
        WorkCalendar.shifts = Storage.getMasterShifts();
    });

    test('1. Rollover shift dari bulan sebelumnya dengan perlindungan Libur Nasional', async () => {
        // Mock data bulan sebelumnya (Juli 2026)
        WorkCalendar.calendarData = {
            '2026-07': {
                'DEPT:FINANCE': {
                    '01': 'SHIFT-OFFICE',
                    '17': 'SHIFT-OFFICE',
                    '20': 'SHIFT-OFFICE'
                }
            }
        };

        // Run rollover to August 2026
        const result = await WorkCalendar.rolloverPreviousMonth('2026-08');
        expect(result).toBe(true);

        const augData = WorkCalendar.calendarData['2026-08']['DEPT:FINANCE'];
        expect(augData).toBeDefined();
        expect(augData['01']).toBe('SHIFT-OFFICE');
        expect(augData['20']).toBe('SHIFT-OFFICE');

        // 17 Agustus 2026 adalah Libur Nasional, harus dilindungi (tidak ada shift kerja)
        expect(augData['17']).toBeUndefined();
    });

    test('2. Filter Sabtu Saja (saturday) pada bulk assign shift', async () => {
        WorkCalendar.calendarData = {};
        const targets = ['DEPT:FINANCE'];
        
        // Rentang 1 Agt 2026 (Sabtu) s/d 10 Agt 2026 (Senin)
        // Sabtu dalam rentang: 1 Agt (Sat) & 8 Agt (Sat)
        await WorkCalendar.bulkAssignShift(targets, 'SHIFT-SABTU', '2026-08-01', '2026-08-10', 'saturday');

        const augData = WorkCalendar.calendarData['2026-08']['DEPT:FINANCE'];
        expect(augData).toBeDefined();

        // Check Saturday 1 Agt & 8 Agt get SHIFT-SABTU
        expect(augData['01']).toBe('SHIFT-SABTU');
        expect(augData['08']).toBe('SHIFT-SABTU');

        // Check Weekdays (e.g. 3 Agt Senin, 4 Agt Selasa) do NOT get assigned
        expect(augData['03']).toBeUndefined();
        expect(augData['04']).toBeUndefined();
        expect(augData['02']).toBeUndefined(); // Minggu 2 Agt
    });

    test('3. Non-overlapping holiday protection pada bulk assign shift', async () => {
        WorkCalendar.calendarData = {};
        const targets = ['DEPT:FINANCE'];

        // Assign bulk shift untuk seluruh bulan Agustus 2026 (1 Agt - 31 Agt)
        await WorkCalendar.bulkAssignShift(targets, 'SHIFT-OFFICE', '2026-08-01', '2026-08-31', 'all');

        const augData = WorkCalendar.calendarData['2026-08']['DEPT:FINANCE'];
        expect(augData).toBeDefined();

        // Hari biasa (misal 18 Agt) terisi
        expect(augData['18']).toBe('SHIFT-OFFICE');

        // 17 Agustus (Libur Nasional Hari Kemerdekaan) HARUS dilindungi dan tidak tertimpa shift kerja
        expect(augData['17']).toBeUndefined();
    });

    test('4. Manual Override tetap diperbolehkan', () => {
        WorkCalendar.calendarData = {
            '2026-08': {
                'DEPT:FINANCE': {
                    '17': undefined
                }
            }
        };

        // HR mengklik manual tanggal 17 untuk menugaskan shift khusus jika diperlukan
        WorkCalendar.assignShift(17, 'SHIFT-SABTU');

        const augData = WorkCalendar.calendarData['2026-08']['DEPT:FINANCE'];
        expect(augData['17']).toBe('SHIFT-SABTU');
    });

    test('5. Proteksi Data Historis (Past Month Lock) melarang Rollover pada bulan lalu', async () => {
        WorkCalendar.calendarData = {
            '2026-05': { 'DEPT:FINANCE': { '01': 'SHIFT-HISTORIS-MEI' } },
            '2026-06': { 'DEPT:FINANCE': { '01': 'SHIFT-HISTORIS-JUNI' } }
        };

        // Memicu rollover pada bulan historis (2026-06) HARUS ditolak & tidak mengubah data
        const result = await WorkCalendar.rolloverPreviousMonth('2026-06');
        expect(result).toBe(false);
        expect(WorkCalendar.calendarData['2026-06']['DEPT:FINANCE']['01']).toBe('SHIFT-HISTORIS-JUNI');
    });

    test('6. Targeted Rollover tidak mengubah atau merusak data bulan sebelumnya', async () => {
        const JulyDataBefore = { '01': 'SHIFT-PASI', '15': 'SHIFT-SIANG', '30': 'SHIFT-MALAM' };
        WorkCalendar.calendarData = {
            '2026-07': {
                'DEPT:FINANCE': { ...JulyDataBefore }
            }
        };

        // Rollover dari Juli 2026 ke Agustus 2026
        const result = await WorkCalendar.rolloverPreviousMonth('2026-08');
        expect(result).toBe(true);

        // Data bulan Juli 2026 HARUS tetap 100% sama (tidak tertimpa atau berubah)
        expect(WorkCalendar.calendarData['2026-07']['DEPT:FINANCE']).toEqual(JulyDataBefore);

        // Data Agustus 2026 menerima salinan shift
        expect(WorkCalendar.calendarData['2026-08']['DEPT:FINANCE']['01']).toBe('SHIFT-PASI');
        expect(WorkCalendar.calendarData['2026-08']['DEPT:FINANCE']['15']).toBe('SHIFT-SIANG');
    });

    test('7. Manual Assign & Bulk Assign melarang pengubahan pada bulan historis', async () => {
        WorkCalendar.calendarData = {
            '2026-05': { 'DEPT:FINANCE': { '10': 'SHIFT-ORIGINAL' } }
        };
        WorkCalendar.currentYearMonth = '2026-05';
        WorkCalendar.currentTarget = 'DEPT:FINANCE';

        // Coba assign shift ke bulan historis 2026-05
        WorkCalendar.assignShift(10, 'SHIFT-NIGHT');
        expect(WorkCalendar.calendarData['2026-05']['DEPT:FINANCE']['10']).toBe('SHIFT-ORIGINAL');

        // Coba bulk assign ke bulan historis 2026-05
        await WorkCalendar.bulkAssignShift(['DEPT:FINANCE'], 'SHIFT-NIGHT', '2026-05-01', '2026-05-31', 'all');
        expect(WorkCalendar.calendarData['2026-05']['DEPT:FINANCE']['10']).toBe('SHIFT-ORIGINAL');
    });

    test('8. Kebijakan Cuti Bersama: Berlaku sebagai Hari Kerja Normal, sedangkan Libur Nasional dikunci', async () => {
        Storage.getHolidays.mockReturnValue([
            { date: '2026-08-17', name: 'Hari Kemerdekaan RI', type: 'Libur Nasional' },
            { date: '2026-08-18', name: 'Cuti Bersama Kemerdekaan', type: 'Cuti Bersama' }
        ]);

        // Check helper methods
        expect(WorkCalendar.isOfficialNationalHoliday('2026-08-17')).toBe(true);
        expect(WorkCalendar.isOfficialNationalHoliday('2026-08-18')).toBe(false); // Cuti Bersama IS NOT locked national holiday
        expect(WorkCalendar.isCutiBersama('2026-08-18')).toBe(true);

        // Run bulk assign for August 2026
        WorkCalendar.calendarData = {};
        await WorkCalendar.bulkAssignShift(['DEPT:FINANCE'], 'SHIFT-OFFICE', '2026-08-15', '2026-08-20', 'all');

        const augData = WorkCalendar.calendarData['2026-08']['DEPT:FINANCE'];
        // 17 Agustus (Libur Nasional) HARUS dilindungi & tidak diassign
        expect(augData['17']).toBeUndefined();

        // 18 Agustus (Cuti Bersama) ADALAH Hari Kerja Normal di Kalender Kerja -> HARUS diassign shift!
        expect(augData['18']).toBe('SHIFT-OFFICE');
    });
});


