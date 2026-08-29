/**
 * Integration Test for BKK Visibility across Roles
 */

const fs = require('fs');
const path = require('path');

// Helper to load a script into current context
function loadScript(filePath) {
    const code = fs.readFileSync(path.resolve(__dirname, '../../', filePath), 'utf8');
    eval(code);
}

describe('BKK Visibility Integration', () => {
    beforeAll(() => {
        // Mock necessary globals
        global.Storage = {
            KEYS: { PAYMENT_VOUCHERS: 'payment_vouchers', CONFIG: 'config' },
            get: jest.fn((key) => {
                const store = JSON.parse(localStorage.getItem(key) || '[]');
                return store;
            }),
            set: jest.fn((key, value) => {
                localStorage.setItem(key, JSON.stringify(value));
                return Promise.resolve(true);
            }),
            setWithCloudBlock: jest.fn((key, value) => {
                localStorage.setItem(key, JSON.stringify(value));
                return Promise.resolve(true);
            }),
            getNextReferenceNumber: jest.fn(() => Promise.resolve(null))
        };

        global.Auth = {
            _user: null,
            getCurrentUser: jest.fn(() => global.Auth._user)
        };

        global.AuditLog = { log: jest.fn() };

        // Load the module
        loadScript('modules/paymentVoucher.js');
    });

    test('Staff creates BKK -> Finance Manager sees it in Pending', async () => {
        // 1. Login as Staff
        global.Auth._user = { id: 'STF01', name: 'Staff Finance', role: 'finance_staff' };

        // 2. Create a BKK
        const voucherData = {
            type: 'BKK',
            payTo: 'PT Test Supplier',
            purpose: 'Integration Test',
            amount: 50000000,
            status: 'verified' // Manually set to verified to trigger visibility for Finance
        };

        const createResult = await PaymentVoucher.createVoucher(voucherData);
        expect(createResult.success).toBe(true);
        const voucherId = createResult.voucher.id;

        // 3. Login as Finance Manager (Lowercase role from database/session)
        global.Auth._user = { id: 'FIN01', name: 'Finance Mgr', role: 'manager_finance' };

        // 4. Check Pending Approvals
        const pending = PaymentVoucher.getPendingApprovals();

        // Verification: The voucher created by staff should be visible to Finance Manager
        const found = pending.find(v => v.id === voucherId);
        expect(found).toBeDefined();
        expect(found.voucherNumber).toContain('BKK-');

        console.log(`✅ Success: Voucher ${found.voucherNumber} is visible to Manager Finance`);
    });

    test('Case sensitivity check: manager_finance vs MANAGER_FINANCE', async () => {
        // Ensure storage has a verified voucher
        localStorage.setItem('payment_vouchers', JSON.stringify([{
            id: 999,
            voucherNumber: 'BKK-TEST-999',
            status: 'verified',
            amount: 1000000
        }]));
        await PaymentVoucher.loadVouchers();

        // Test with lowercase role
        global.Auth._user = { role: 'manager_finance' };
        let pending = PaymentVoucher.getPendingApprovals();
        expect(pending.length).toBeGreaterThan(0);

        // Test with uppercase role
        global.Auth._user = { role: 'MANAGER_FINANCE' };
        pending = PaymentVoucher.getPendingApprovals();
        expect(pending.length).toBeGreaterThan(0);

        console.log('✅ Success: Role check is case-insensitive');
    });

    test('Petty cash voucher auto-posts and correctly sets journalEntryId (not undefined)', async () => {
        // Mock JournalEntry
        global.JournalEntry = {
            createEntry: jest.fn((entry) => Promise.resolve({ id: 'JE-12345', ...entry }))
        };

        // Login as Kasir
        global.Auth._user = { id: 'KAS01', name: 'Kasir User', role: 'kasir' };

        // Create a petty cash voucher (< 500k, and autoPostJournal: true)
        const voucherData = {
            type: 'BKK',
            payTo: 'Test Petty Cash Receiver',
            purpose: 'Test Petty Cash Auto Post',
            amount: 250000,
            status: 'director_approved', // Auto-approved status
            autoPostJournal: true
        };

        const createResult = await PaymentVoucher.createVoucher(voucherData);
        expect(createResult.success).toBe(true);
        expect(createResult.voucher.status).toBe('posted');
        expect(createResult.voucher.journalEntryId).toBe('JE-12345');
        expect(createResult.voucher.journalEntryId).not.toBeUndefined();
        console.log('✅ Success: Auto-post sets journalEntryId correctly');
    });
});
