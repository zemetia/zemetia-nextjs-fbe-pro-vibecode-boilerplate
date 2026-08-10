/**
 * HRD & CRM Unit Tests (Batch 3)
 * Tests: Payroll Math, Leave Balances, Prospect Conversion
 */

// ─── Leave Management Logic ───
function calculateLeaveDays(from, to) {
    const d1 = new Date(from);
    const d2 = new Date(to);
    return Math.ceil(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
}

function getRemainingBalance(quota, used) {
    return quota - used;
}

// ─── Payroll Calculation Logic (Extracted from payroll.js) ───
function calculateSalary(emp, atd, totalProdKg = 0) {
    const base = emp.base_salary || 0;
    const PRORATE_DAYS = 25;
    const dailyRate = base / PRORATE_DAYS;

    const mealPay = (atd.work_days || 0) * 20000;
    const overtimePay = (atd.overtime_hours || 0) * 20000;

    // Production Bonus Logic
    let productionPay = 0;
    if (emp.payroll_level && emp.payroll_level !== 'N/A') {
        const ratePerKg = 20000;
        const totalIncentive = totalProdKg * ratePerKg;
        if (emp.payroll_level === 'Senior') {
            productionPay = totalIncentive * 0.75;
        } else if (emp.payroll_level === 'Junior') {
            productionPay = totalIncentive * 0.25;
        } else {
            productionPay = totalIncentive;
        }
    }

    // Deductions
    const lateDeduction = (atd.late_count || 0) * 20000;
    const absenceDeduction = (atd.absence_days || 0) * dailyRate;

    const totalEarnings = base + mealPay + overtimePay + productionPay;
    const totalDeductions = lateDeduction + absenceDeduction;

    return {
        dailyRate: Math.round(dailyRate),
        earnings: totalEarnings,
        deductions: totalDeductions,
        productionPay: productionPay,
        netPay: totalEarnings - totalDeductions
    };
}

// ─── CRM Conversion Logic ───
function convertProspectToCustomer(prospect) {
    return {
        id: `CUST-${Date.now()}`,
        name: prospect.name,
        phone: prospect.phone,
        address: prospect.address,
        notes: `Converted from CRM Prospect`
    };
}

// ─── Tests ───

describe('HRD - Leave Management', () => {
    test('should calculate multiple days correctly', () => {
        expect(calculateLeaveDays('2025-01-01', '2025-01-03')).toBe(3);
    });

    test('should calculate single day correctly', () => {
        expect(calculateLeaveDays('2025-01-01', '2025-01-01')).toBe(1);
    });

    test('should reflect remaining balance', () => {
        expect(getRemainingBalance(12, 5)).toBe(7);
    });
});

describe('HRD - Payroll Calculation', () => {
    const mockEmp = { nik: 'E001', base_salary: 5000000 };

    test('should calculate basic prorated payroll (No deductions)', () => {
        const atd = { work_days: 20, overtime_hours: 0, late_count: 0, absence_days: 0 };
        const result = calculateSalary(mockEmp, atd);

        // Base: 5M
        // Meal: 20 * 20k = 400k
        // Total: 5.4M
        expect(result.earnings).toBe(5400000);
        expect(result.netPay).toBe(5400000);
    });

    test('should apply late and absence deductions', () => {
        const atd = { work_days: 18, overtime_hours: 0, late_count: 2, absence_days: 2 };
        const result = calculateSalary(mockEmp, atd);

        // Late: 2 * 20k = 40k
        // Absence: 2 * (5M/25) = 400k
        // Total Deductions: 440k
        expect(result.deductions).toBe(440000);
    });

    test('should add overtime pay correctly', () => {
        const atd = { work_days: 20, overtime_hours: 5, late_count: 0, absence_days: 0 };
        const result = calculateSalary(mockEmp, atd);

        // OT: 5 * 20k = 100k
        expect(result.earnings).toBe(5500000);
    });

    test('should calculate Production Bonus (Senior: 75%)', () => {
        const emp = { ...mockEmp, payroll_level: 'Senior' };
        const atd = { work_days: 20 };
        // 10kg * 20k = 200k incentive. Senior gets 75% = 150k.
        const result = calculateSalary(emp, atd, 10);
        expect(result.productionPay).toBe(150000);
        expect(result.earnings).toBe(5000000 + 400000 + 150000);
    });

    test('should calculate Production Bonus (Junior: 25%)', () => {
        const emp = { ...mockEmp, payroll_level: 'Junior' };
        const atd = { work_days: 20 };
        // 10kg * 20k = 200k incentive. Junior gets 25% = 50k.
        const result = calculateSalary(emp, atd, 10);
        expect(result.productionPay).toBe(50000);
    });
});

describe('CRM - Prospect Conversion', () => {
    test('should map fields correctly to customer object', () => {
        const prospect = { name: 'Felix', phone: '081', address: 'Jakarta' };
        const customer = convertProspectToCustomer(prospect);
        expect(customer.name).toBe('Felix');
        expect(customer.phone).toBe('081');
        expect(customer.address).toBe('Jakarta');
    });
});
