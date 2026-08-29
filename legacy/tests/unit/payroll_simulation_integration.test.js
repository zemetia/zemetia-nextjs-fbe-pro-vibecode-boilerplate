const fs = require('fs');

// Mock Storage
global.Storage = {
    KEYS: {
        PAYROLL: 'erp_payroll',
        PAYROLL_PERIODS: 'erp_payroll_periods',
        PRODUCTION_ORDERS: 'erp_production_orders',
        LEAVE_REQUESTS: 'LEAVE_REQUESTS'
    },
    get: jest.fn(() => []),
    getPayrollPeriods: jest.fn(() => []),
    getCurrentUserRole: jest.fn(() => 'SUPER_ADMIN'),
    getEmployees: jest.fn(() => []),
    getAttendance: jest.fn(() => []),
    getPayroll: jest.fn(() => []),
    getJournalEntries: jest.fn(() => []),
    getOvertimeSettings: jest.fn(() => ({
        bpjs_health_emp: 1.0,
        jht_emp: 2.0,
        bpjs_health_comp: 4.0,
        jht_comp: 3.7,
        jkk_comp: 0.24,
        jkm_comp: 0.3
    })),
    getProductionLogs: jest.fn(() => []),
    set: jest.fn()
};

global.App = {
    formatCurrency: jest.fn((val) => `Rp ${val}`)
};

global.TaxEngineTER = {
    calculatePPh21: jest.fn((ptkp, earnings) => {
        return { taxAmount: Math.round(earnings * 0.05), ratePct: 5, category: 'A' };
    })
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

// Set up JSDOM elements
document.body.innerHTML = '<div id="main-content"></div>';

const Payroll = require('../../modules/payroll.js');
const PayrollSimulation = require('../../modules/payrollSimulation.js');

describe('Payroll Simulation and Custom Component Injection Integration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        PayrollSimulation.isAuthenticatedWithPassword = true;
        PayrollSimulation.employees = [];
        PayrollSimulation.results = [];
        PayrollSimulation.checkedNiks = [];
        document.body.innerHTML = '<div id="main-content"></div>';
        
        global.window.firestore.getDocs.mockResolvedValue({
            forEach: jest.fn()
        });
    });

    test('calculatePayrollSimulation returns standard schema calculations with custom components for checked employees only', async () => {
        const dummyEmployees = [
            {
                nik: 'EMP001',
                name: 'Alice',
                base_salary: 5000000,
                ptkp: 'TK/0',
                status: 'active'
            },
            {
                nik: 'EMP002',
                name: 'Bob',
                base_salary: 6000000,
                ptkp: 'TK/0',
                status: 'active'
            }
        ];

        const customComponentInject = {
            name: 'Bonus Khusus',
            type: 'earnings',
            amount: 1000000
        };

        // Only Alice is checked (Checkbox == TRUE)
        const checkedNiks = ['EMP001'];

        // Perform calculation
        const results = await Payroll.calculatePayrollSimulation(
            dummyEmployees,
            '2026-07',
            customComponentInject,
            checkedNiks
        );

        expect(results.length).toBe(2);

        const aliceResult = results.find(r => r.nik === 'EMP001');
        const bobResult = results.find(r => r.nik === 'EMP002');

        // Alice should have custom component injected
        expect(aliceResult.custom_components['Bonus Khusus']).toBeDefined();
        expect(aliceResult.custom_components['Bonus Khusus'].amount).toBe(1000000);

        // Bob should NOT have custom component injected
        expect(bobResult.custom_components['Bonus Khusus']).toBeUndefined();
    });

    test('custom component type deduction decreases the Take Home Pay correctly', async () => {
        const dummyEmployees = [
            {
                nik: 'EMP001',
                name: 'Alice',
                base_salary: 5000000,
                ptkp: 'TK/0',
                status: 'active'
            }
        ];

        const customComponentInject = {
            name: 'Potongan Disiplin',
            type: 'deduction',
            amount: 500000
        };

        const checkedNiks = ['EMP001'];

        // Calculation with deduction
        const results = await Payroll.calculatePayrollSimulation(
            dummyEmployees,
            '2026-07',
            customComponentInject,
            checkedNiks
        );

        const aliceResult = results[0];
        expect(aliceResult.custom_components['Potongan Disiplin']).toBeDefined();
        expect(aliceResult.custom_components['Potongan Disiplin'].type).toBe('deduction');

        // Let's verify base salary - deductions (BPJS, PPh 21, custom component)
        const expectedDeductions =
            aliceResult.bpjs_health_deduction +
            aliceResult.jht_deduction +
            aliceResult.pph21_deduction +
            500000; // custom component

        const expectedTotal = aliceResult.base_salary - expectedDeductions;
        expect(aliceResult.total_salary).toBe(Math.max(0, expectedTotal));
    });
});
