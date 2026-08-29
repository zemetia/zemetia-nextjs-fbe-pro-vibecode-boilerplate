const fs = require('fs');

// Mock Auth
global.Auth = {
    getCurrentUser: jest.fn(() => ({ id: 'USR-TEST', name: 'Test User', role: 'ADMIN' }))
};

// Mock AuditLog
global.AuditLog = {
    log: jest.fn()
};

// Mock Storage
global.Storage = {
    KEYS: {
        CONFIG: 'CONFIG'
    },
    get: jest.fn(() => ({})),
    set: jest.fn(),
    getNextReferenceNumber: jest.fn().mockResolvedValue('BKK-202607-0001')
};

// Mock window
global.window = {
    db: {},
    firestore: {}
};

const PaymentVoucher = require('../../modules/paymentVoucher.js');

describe('Automated Expense Habit Control & Frequency Anomaly Detection', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        PaymentVoucher.vouchers = [];
    });

    test('detectHabitAnomaly returns null if there is no previous purchase of the item', () => {
        const voucher = {
            id: 101,
            purpose: 'Beli Kopi pantry',
            date: '2026-07-14',
            lineItems: []
        };
        const otherVouchers = [];
        const result = PaymentVoucher.detectHabitAnomaly(voucher, otherVouchers);
        expect(result).toBeNull();
    });

    test('detectHabitAnomaly returns null if previous purchase of coffee was 4 days ago (threshold is 3 days)', () => {
        const voucher = {
            id: 102,
            purpose: 'Beli Kopi pantry',
            date: '2026-07-14',
            lineItems: []
        };
        const otherVouchers = [
            {
                id: 101,
                voucherNumber: 'BKK-202607-0001',
                purpose: 'Beli Kopi pantry',
                date: '2026-07-10',
                status: 'posted'
            }
        ];
        const result = PaymentVoucher.detectHabitAnomaly(voucher, otherVouchers);
        expect(result).toBeNull();
    });

    test('detectHabitAnomaly returns warning if coffee is purchased 1 day after last purchase (under 3 days threshold)', () => {
        const voucher = {
            id: 102,
            purpose: 'Beli Kopi pantry',
            date: '2026-07-14',
            lineItems: []
        };
        const otherVouchers = [
            {
                id: 101,
                voucherNumber: 'BKK-202607-0001',
                purpose: 'Beli Kopi pantry',
                date: '2026-07-13',
                status: 'posted'
            }
        ];
        const result = PaymentVoucher.detectHabitAnomaly(voucher, otherVouchers);
        expect(result).not.toBeNull();
        expect(result.detected).toBe(true);
        expect(result.message).toContain('Kopi / Kebutuhan Kafein');
        expect(result.previousVoucherNumber).toBe('BKK-202607-0001');
    });

    test('detectHabitAnomaly checks keywords in lineItems descriptions', () => {
        const voucher = {
            id: 202,
            purpose: 'Reimbursement Kasir',
            date: '2026-07-14',
            lineItems: [
                { accountCode: '5100', accountName: 'Office Supplies', description: 'Beli bensin motor dinas', amount: 50000 }
            ]
        };
        const otherVouchers = [
            {
                id: 201,
                voucherNumber: 'BKK-202607-0002',
                purpose: 'Reimbursement',
                date: '2026-07-13', // 1 day interval (BBM threshold is 2 days)
                status: 'posted',
                lineItems: [
                    { accountCode: '5100', accountName: 'Office Supplies', description: 'Isi BBM', amount: 50000 }
                ]
            }
        ];
        const result = PaymentVoucher.detectHabitAnomaly(voucher, otherVouchers);
        expect(result).not.toBeNull();
        expect(result.detected).toBe(true);
        expect(result.message).toContain('Bahan Bakar Minyak (BBM)');
    });

    test('getFormData returns null and alerts warning if voucher-type is empty', () => {
        document.body.innerHTML = `
            <select id="voucher-type">
                <option value="" selected>Select Type</option>
                <option value="BKK">BKK</option>
            </select>
        `;
        
        const originalAlert = global.alert;
        global.alert = jest.fn();
        
        const result = PaymentVoucher.getFormData();
        
        expect(result).toBeNull();
        expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('pilih tipe voucher'));
        
        global.alert = originalAlert;
    });
});
