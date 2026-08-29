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
    get: jest.fn(() => []),
    set: jest.fn()
};

global.App = {
    formatCurrency: (val) => `Rp ${Math.round(val || 0).toLocaleString('id-ID')}`
};

// Properly mock firebase and global firestore helper methods
global.window.db = {};
global.window.firestore = {
    collection: jest.fn(() => 'emailLogs'),
    addDoc: jest.fn().mockResolvedValue({ id: 'mock-log-id' }),
    serverTimestamp: jest.fn(() => 'mock-timestamp')
};

global.XLSX = {
    utils: {
        json_to_sheet: jest.fn((data) => data),
        book_new: jest.fn(() => ({})),
        book_append_sheet: jest.fn()
    },
    writeFile: jest.fn()
};

const Payroll = require('../../modules/payroll.js');

describe('Flexible Payroll Email Broadcast & Custom Components', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        Payroll.period = '2026-07';
        Payroll.payrollRecords = [
            {
                id: 'PAY-2026-07-EMP001',
                nik: 'EMP001',
                name: 'Budi Santoso',
                department: 'PRODUKSI',
                base_salary: 5000000,
                meal_pay: 500000,
                night_meal_pay: 0,
                presence_pay: 100000,
                overtime_hours: 10,
                overtime_pay: 200000,
                production_pay: 300000,
                late_deduction: 0,
                absence_deduction: 0,
                half_day_deduction: 0,
                bpjs_health_deduction: 50000,
                jht_deduction: 100000,
                pph21_deduction: 50000,
                variable_allowance: 200000,
                bonus: 100000,
                other_deductions: 50000,
                custom_components: {
                    'Tunjangan Transport': { type: 'earnings', amount: 150000 },
                    'Potongan Koperasi': { type: 'deduction', amount: 50000 }
                },
                total_salary: 5900000,
                status: 'draft',
                period: '2026-07'
            },
            {
                id: 'PAY-2026-07-EMP002',
                nik: 'EMP002',
                name: 'Dewi Sartika',
                department: 'HRD',
                base_salary: 6000000,
                meal_pay: 500000,
                night_meal_pay: 0,
                presence_pay: 0,
                overtime_hours: 0,
                overtime_pay: 0,
                production_pay: 0,
                late_deduction: 0,
                absence_deduction: 0,
                half_day_deduction: 0,
                bpjs_health_deduction: 60000,
                jht_deduction: 120000,
                pph21_deduction: 60000,
                variable_allowance: 0,
                bonus: 0,
                other_deductions: 0,
                custom_components: {},
                total_salary: 5760000,
                status: 'draft',
                period: '2026-07'
            }
        ];
        Payroll.employees = [
            { nik: 'EMP001', name: 'Budi Santoso', email: 'budi@test.com' },
            { nik: 'EMP002', name: 'Dewi Sartika', email: 'dewi@test.com' }
        ];
        
        document.body.innerHTML = `
            <div id="main-content"></div>
            <button id="btn-send-email-bulk">📧 Bulk Send</button>
            <div id="email-progress-container" style="display: none;">
                <div id="email-progress-bar"></div>
                <div id="email-progress-text"></div>
            </div>
        `;
    });

    test('getPeriodPayroll filters by department correctly', () => {
        Payroll.selectedDept = 'PRODUKSI';
        Payroll.searchQuery = '';
        const list = Payroll.getPeriodPayroll();
        expect(list.length).toBe(1);
        expect(list[0].nik).toBe('EMP001');
    });

    test('getPeriodPayroll filters by name search query correctly', () => {
        Payroll.selectedDept = '';
        Payroll.searchQuery = 'dewi';
        const list = Payroll.getPeriodPayroll();
        expect(list.length).toBe(1);
        expect(list[0].nik).toBe('EMP002');
    });

    test('exportToExcel maps all dynamic custom columns correctly', () => {
        Payroll.selectedDept = '';
        Payroll.searchQuery = '';
        
        Payroll.exportToExcel();
        
        expect(XLSX.utils.json_to_sheet).toHaveBeenCalled();
        const callArgs = XLSX.utils.json_to_sheet.mock.calls[0][0];
        
        // EMP001 has Budi Santoso
        const budiRow = callArgs.find(r => r.NIK === 'EMP001');
        expect(budiRow).toBeDefined();
        expect(budiRow['Tunjangan Transport']).toBe(150000);
        expect(budiRow['Potongan Koperasi']).toBe(50000);
        
        // EMP002 has Dewi Sartika
        const dewiRow = callArgs.find(r => r.NIK === 'EMP002');
        expect(dewiRow).toBeDefined();
        expect(dewiRow['Tunjangan Transport']).toBe(0);
        expect(dewiRow['Potongan Koperasi']).toBe(0);
    });

    test('saveEditModal correctly updates custom components and recalculates total_salary', async () => {
        // Setup JSDOM input elements
        document.body.innerHTML += `
            <input type="number" id="edit-variable-allowance" value="300000">
            <input type="number" id="edit-bonus" value="150000">
            <input type="number" id="edit-other-deductions" value="100000">
            <div id="custom-components-container">
                <div class="custom-comp-row">
                    <input class="comp-name" value="Tunjangan HP">
                    <select class="comp-type"><option value="earnings" selected></option></select>
                    <input class="comp-amount" value="100000">
                </div>
            </div>
            <div id="payroll-edit-modal"></div>
        `;

        await Payroll.saveEditModal('PAY-2026-07-EMP001');

        const record = Payroll.payrollRecords.find(r => r.id === 'PAY-2026-07-EMP001');
        expect(record.variable_allowance).toBe(300000);
        expect(record.bonus).toBe(150000);
        expect(record.other_deductions).toBe(100000);
        expect(record.custom_components['Tunjangan HP']).toEqual({ type: 'earnings', amount: 100000 });

        // Total salary calculation:
        // Earnings: base (5000000) + meal (500000) + redDay (100000) + OT (200000) + prod (300000) + varAll (300000) + bonus (150000) + custom HP (100000) = 6,650,000
        // Deductions: bpjs (50000) + jht (100000) + pph21 (50000) + other (100000) + custom (0) = 300,000
        // Net: 6,650,000 - 300,000 = 6,350,000
        expect(record.total_salary).toBe(6350000);
    });

    test('executeSendEmailBulk calls sendPayslipEmail with pdfBase64 and generates correct DOB password', async () => {
        // Setup mock window.jspdf and firebase
        const mockOutput = jest.fn(() => 'data:application/pdf;filename=generated.pdf;base64,mockpdfbytes');
        const mockJsPDF = jest.fn().mockImplementation(() => ({
            text: jest.fn(),
            setFontSize: jest.fn(),
            setFont: jest.fn(),
            setLineWidth: jest.fn(),
            line: jest.fn(),
            autoTable: jest.fn(),
            setFillColor: jest.fn(),
            setDrawColor: jest.fn(),
            rect: jest.fn(),
            setTextColor: jest.fn(),
            splitTextToSize: jest.fn(() => []),
            output: mockOutput
        }));
        
        global.window.jspdf = { jsPDF: mockJsPDF };
        
        const mockHttpsCallable = jest.fn(() => jest.fn(() => Promise.resolve({ data: { success: true } })));
        global.firebase = {
            functions: jest.fn(() => ({
                httpsCallable: mockHttpsCallable
            }))
        };

        // Set employees with birth dates
        Payroll.employees = [
            { nik: 'EMP001', name: 'Budi Santoso', email: 'budi@test.com', birth_date: '1990-05-15' }
        ];
        Payroll.payrollRecords = [
            {
                id: 'PAY-2026-07-EMP001',
                nik: 'EMP001',
                name: 'Budi Santoso',
                department: 'PRODUKSI',
                base_salary: 5000000,
                meal_pay: 500000,
                night_meal_pay: 0,
                presence_pay: 100000,
                overtime_hours: 10,
                overtime_pay: 200000,
                production_pay: 300000,
                late_deduction: 0,
                absence_deduction: 0,
                half_day_deduction: 0,
                bpjs_health_deduction: 50000,
                jht_deduction: 100000,
                pph21_deduction: 50000,
                variable_allowance: 200000,
                bonus: 100000,
                other_deductions: 50000,
                custom_components: {},
                total_salary: 5900000,
                status: 'draft',
                period: '2026-07'
            }
        ];

        // Stub alert
        global.alert = jest.fn();

        await Payroll.executeSendEmailBulk();

        // Expect jsPDF instantiated with encryption parameters
        expect(mockJsPDF).toHaveBeenCalled();
        const jspdfConstructorArgs = mockJsPDF.mock.calls[0][0];
        expect(jspdfConstructorArgs.encryption).toBeDefined();
        expect(jspdfConstructorArgs.encryption.userPassword).toBe('15051990'); // birth_date: 1990-05-15 -> 15051990

        // Expect firebase function invoked with correct parameters including pdfBase64
        expect(mockHttpsCallable).toHaveBeenCalledWith('sendPayslipEmail');
        const sendFuncCall = mockHttpsCallable.mock.results[0].value.mock.calls[0][0];
        expect(sendFuncCall.recipientEmail).toBe('budi@test.com');
        expect(sendFuncCall.pdfBase64).toBe('mockpdfbytes');
    });
});
