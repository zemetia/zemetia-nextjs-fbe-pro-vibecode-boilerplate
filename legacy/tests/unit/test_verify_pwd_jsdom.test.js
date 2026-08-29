const fs = require('fs');

// Mock Storage
global.Storage = {
    KEYS: {
        PAYROLL: 'erp_payroll',
        PAYROLL_PERIODS: 'erp_payroll_periods'
    },
    get: jest.fn(() => []),
    getPayrollPeriods: jest.fn(() => []),
    getCurrentUserRole: jest.fn(() => 'SUPER_ADMIN'),
    getEmployees: jest.fn(() => []),
    getAttendance: jest.fn(() => []),
    getPayroll: jest.fn(() => []),
    getJournalEntries: jest.fn(() => []),
    set: jest.fn()
};

global.App = {
    formatCurrency: jest.fn((val) => `Rp ${val}`)
};

// Set up JSDOM elements
document.body.innerHTML = '<div id="main-content"></div>';

// Setup global window
global.window = {
    db: {},
    firestore: {}
};

const Payroll = require('../../modules/payroll.js');

describe('Payroll Special Password Prompt', () => {
    beforeEach(() => {
        Payroll.isAuthenticatedWithPassword = false;
        document.body.innerHTML = '<div id="main-content"></div>';
    });

    test('entering password and rendering works without crashing', async () => {
        Storage.getPayroll.mockReturnValue([]);
        await Payroll.init();
        
        const promptInput = document.getElementById('payroll-special-password');
        expect(promptInput).not.toBeNull();
        
        promptInput.value = 'GarPayroll_2025';
        Payroll.verifySpecialPassword();
        
        expect(Payroll.isAuthenticatedWithPassword).toBe(true);
        expect(document.getElementById('payroll-special-password')).toBeNull();
        expect(document.getElementById('workdays-config-container')).not.toBeNull();
    });

    test('rendering with legacy payroll record containing undefined status should NOT crash', async () => {
        // Mock a legacy record that has no status field
        const mockLegacyPayroll = [
            {
                id: 'PAY-001',
                period: '2026-07',
                name: 'Legacy Employee',
                nik: 'EMP999',
                base_salary: 5000000,
                meal_pay: 0,
                overtime_pay: 0,
                late_deduction: 0,
                absence_deduction: 0,
                half_day_deduction: 0,
                total_salary: 5000000
                // status is missing/undefined!
            }
        ];
        Storage.getPayroll.mockReturnValue(mockLegacyPayroll);
        
        await Payroll.init();
        
        const promptInput = document.getElementById('payroll-special-password');
        promptInput.value = 'GarPayroll_2025';
        
        // This should not crash now that we've added the fallback safeguard
        expect(() => {
            Payroll.verifySpecialPassword();
        }).not.toThrow();
        
        expect(Payroll.isAuthenticatedWithPassword).toBe(true);
        expect(document.getElementById('payroll-special-password')).toBeNull();
    });
});
