/**
 * @jest-environment jsdom
 */

// Mock Storage and dependencies
global.Storage = {
    getPayroll: jest.fn(() => []),
    getEmployees: jest.fn(() => [
        {
            nik: 'EMP001',
            name: 'DIRECTOR TEST',
            department: 'BOD',
            position: 'Director',
            ptkp: 'K/1',
            npwp: '01.234.567.8-901.000',
            base_salary: 0,
            basic_salary_bpjs_kes: 0,
            basic_salary_bpjs_tk: 0,
            bpjs_health_enabled: false,
            bpjs_tk_enabled: false
        },
        {
            nik: 'EMP002',
            name: 'STAFF REGULAR',
            department: 'ACCOUNTING',
            position: 'Staff',
            ptkp: 'TK/0',
            npwp: '01.234.567.8-902.000',
            base_salary: 5288796,
            basic_salary_bpjs_kes: 5288796,
            basic_salary_bpjs_tk: 2500000,
            bpjs_health_enabled: true,
            bpjs_tk_enabled: true,
            jkk_risk_rate: 0.89
        }
    ]),
    getOvertimeSettings: jest.fn(() => ({
        bpjs_health_emp: 1,
        bpjs_health_comp: 4,
        jht_emp: 2,
        jht_comp: 3.7,
        jkk_comp: 0.89,
        jkm_comp: 0.3
    }))
};

global.TaxEngineTER = {
    calculatePPh21: jest.fn((ptkp, gross) => {
        const ratePct = gross > 5400000 ? 0.5 : 0;
        const taxAmount = Math.round((gross * ratePct) / 100);
        return { taxAmount, ratePct, category: 'A' };
    }),
    getCategory: jest.fn((ptkp) => 'A')
};

global.Payroll = {
    period: '2026-03',
    isWorkdaysLocked: jest.fn(() => false),
    calculatePayrollSimulation: jest.fn(async (emps) => {
        return emps.map(e => ({
            nik: e.nik,
            name: e.name,
            total_earnings: (e.base_salary || 0) + 500000
        }));
    })
};

global.Auth = {
    isAuthenticated: jest.fn(() => true)
};

const BPJSTaxCompliance = require('../../modules/bpjsTaxCompliance.js');

describe('BPJS & Tax Compliance Module Tests', () => {

    beforeEach(() => {
        document.body.innerHTML = '<div id="main-content"></div>';
        BPJSTaxCompliance.activePeriod = '2026-03';
        BPJSTaxCompliance.isAuthenticatedWithPassword = true;
    });

    test('1. loadData builds dynamic math and validates zero upah dasar', async () => {
        await BPJSTaxCompliance.loadData();
        const data = BPJSTaxCompliance.reconciliationData;

        expect(data.length).toBe(2);

        // Director with 0 base salary
        const director = data.find(d => d.nik === 'EMP001');
        expect(director.bpjsKesBase).toBe(0);
        expect(director.kesEmp).toBe(0);
        expect(director.kesComp).toBe(0);
        expect(director.kesSubtotal).toBe(0);
        expect(director.bpjsTkBase).toBe(0);
        expect(director.jhtEmp).toBe(0);
        expect(director.jhtComp).toBe(0);
        expect(director.jkkComp).toBe(0);
        expect(director.jkmComp).toBe(0);
        expect(director.tkSubtotal).toBe(0);

        // Staff with 5.288.796 Kes and 2.500.000 TK
        const staff = data.find(d => d.nik === 'EMP002');
        expect(staff.bpjsKesBase).toBe(5288796);
        expect(staff.kesEmp).toBe(Math.round(5288796 * 0.01)); // 52.888
        expect(staff.kesComp).toBe(Math.round(5288796 * 0.04)); // 211.552
        expect(staff.kesSubtotal).toBe(Math.round(5288796 * 0.01) + Math.round(5288796 * 0.04)); // 264.440

        expect(staff.bpjsTkBase).toBe(2500000);
        expect(staff.jhtEmp).toBe(50000); // 2.500.000 * 0.02
        expect(staff.jhtComp).toBe(92500); // 2.500.000 * 0.037
        expect(staff.jkkComp).toBe(22250); // 2.500.000 * 0.0089
        expect(staff.jkmComp).toBe(7500);  // 2.500.000 * 0.003
        expect(staff.tkSubtotal).toBe(50000 + 92500 + 22250 + 7500);

        expect(staff.ptkp).toBe('TK/0');
    });

    test('2. summaryTotals accurately aggregates all dynamic metrics', async () => {
        await BPJSTaxCompliance.loadData();
        const totals = BPJSTaxCompliance.summaryTotals;

        const staff = BPJSTaxCompliance.reconciliationData.find(d => d.nik === 'EMP002');
        expect(totals.bpjsKesBase).toBe(staff.bpjsKesBase);
        expect(totals.kesSubtotal).toBeCloseTo(staff.kesSubtotal, 2);
        expect(totals.bpjsTkBase).toBe(staff.bpjsTkBase);
        expect(totals.tkSubtotal).toBe(staff.tkSubtotal);
        expect(totals.grandTotalRemittance).toBeGreaterThan(0);
    });

    test('3. render outputs table container with PTKP placed before PPh TER', async () => {
        await BPJSTaxCompliance.loadData();
        BPJSTaxCompliance.render();
        const content = document.getElementById('main-content').innerHTML;

        expect(content).toContain('BPJS &amp; PPh Reconciliation Report');
        expect(content).toContain('Total BPJS Kesehatan');
        expect(content).toContain('Total BPJS TK');
        expect(content).toContain('Total PPh 21 TER');
        expect(content).toContain('Export Excel (XLSX)');
        expect(content).toContain('Export PDF');
        expect(content).toContain('compliance-table-container');
        expect(content).toContain('Upah Dasar Kes');
        expect(content).toContain('Upah Dasar TK');
        expect(content).toContain('PTKP');
    });

    test('4. Period switching updates activePeriod and triggers reload', () => {
        const spy = jest.spyOn(BPJSTaxCompliance, 'loadData').mockImplementation(() => {});
        BPJSTaxCompliance.setPeriod('2026-04');
        expect(BPJSTaxCompliance.activePeriod).toBe('2026-04');
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });

    test('5. Password protection guards access with GarPayroll_2025', () => {
        BPJSTaxCompliance.isAuthenticatedWithPassword = false;
        if (global.Payroll) global.Payroll.isAuthenticatedWithPassword = false;

        BPJSTaxCompliance.render();
        const content = document.getElementById('main-content').innerHTML;
        expect(content).toContain('Verifikasi Akses BPJS &amp; Pajak');
        expect(content).toContain('bpjs-special-password');

        // Test wrong password
        window.alert = jest.fn();
        document.getElementById('bpjs-special-password').value = 'WrongPassword';
        BPJSTaxCompliance.verifySpecialPassword();
        expect(window.alert).toHaveBeenCalledWith('Password salah!');
        expect(BPJSTaxCompliance.isAuthenticatedWithPassword).toBe(false);

        // Test correct password
        document.getElementById('bpjs-special-password').value = 'GarPayroll_2025';
        BPJSTaxCompliance.verifySpecialPassword();
        expect(BPJSTaxCompliance.isAuthenticatedWithPassword).toBe(true);
    });
});
