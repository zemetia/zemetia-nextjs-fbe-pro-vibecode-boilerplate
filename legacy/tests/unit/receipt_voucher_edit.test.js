const fs = require('fs');

// Mock Auth
global.Auth = {
    getCurrentUser: jest.fn(() => ({ id: 'USR-TEST', name: 'Test User', role: 'ADMIN' })),
    isAuthenticated: jest.fn(() => true)
};

// Mock AuditLog
global.AuditLog = {
    log: jest.fn()
};

// Mock Storage
global.Storage = {
    KEYS: {
        RECEIPT_VOUCHERS: 'erp_receipt_vouchers'
    },
    getReceiptVouchers: jest.fn(() => []),
    saveReceiptVouchers: jest.fn((vouchers) => Promise.resolve({ success: true })),
    getBankAccounts: jest.fn(() => []),
    getNextReferenceNumber: jest.fn().mockResolvedValue('BKM-202607-0001')
};

// Mock ChartOfAccounts
global.ChartOfAccounts = {
    getDetailAccounts: jest.fn(() => [
        { code: '41101', name: 'Revenue' },
        { code: '11101', name: 'Cash' }
    ]),
    getAccount: jest.fn((code) => ({ code, name: 'Mock Account' }))
};

// Mock window/document elements
document.body.innerHTML = `
    <div id="create-receipt-modal" class="modal-overlay hidden">
        <h3 id="receipt-modal-title">Create New Receipt Voucher</h3>
        <select id="receipt-type"><option value=""></option><option value="BKM">BKM</option></select>
        <input type="date" id="receipt-date">
        <input type="text" id="receipt-from">
        <textarea id="receipt-purpose"></textarea>
        <select id="receipt-category"><option value="other"></option></select>
        <select id="receipt-method"><option value="cash"></option></select>
        <select id="receipt-bank"><option value=""></option></select>
        <tbody id="receipt-line-items-body"></tbody>
        <span id="receipt-line-items-total"></span>
        <input type="checkbox" id="receipt-auto-post-journal">
        <button id="btn-submit-receipt">Create Receipt</button>
    </div>
    <div id="view-receipt-content"></div>
`;

const ReceiptVoucher = require('../../modules/receiptVoucher.js');

describe('BKM/BBM (Receipt Voucher) Editing Capabilities', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        ReceiptVoucher.vouchers = [
            {
                id: 12345,
                voucherNumber: 'BKM-202607-0001',
                type: 'BKM',
                date: '2026-07-14',
                receiveFrom: 'Pelanggan A',
                purpose: 'Penerimaan Penjualan',
                receiptCategory: 'customer',
                receiptMethod: 'cash',
                status: 'draft',
                amount: 1500000,
                totalAmount: 1500000,
                lineItems: [
                    { accountCode: '41101', accountName: 'Revenue', description: 'Penerimaan Penjualan', amount: 1500000 }
                ]
            }
        ];
    });

    test('showEditModal populates the fields and toggles edit mode', () => {
        ReceiptVoucher.showEditModal(12345);

        expect(ReceiptVoucher._editMode).toBe(true);
        expect(ReceiptVoucher._editingId).toBe(12345);

        expect(document.getElementById('receipt-modal-title').textContent).toBe('✏️ Edit Receipt Voucher');
        expect(document.getElementById('btn-submit-receipt').textContent).toBe('💾 Update Receipt Voucher');
        expect(document.getElementById('receipt-type').value).toBe('BKM');
        expect(document.getElementById('receipt-from').value).toBe('Pelanggan A');
        expect(document.getElementById('receipt-purpose').value).toBe('Penerimaan Penjualan');
    });

    test('updateVoucher merges updates on a draft voucher', async () => {
        const updateData = {
            type: 'BKM',
            date: '2026-07-15',
            receiveFrom: 'Pelanggan A Updated',
            purpose: 'Penerimaan Penjualan Edit',
            receiptCategory: 'customer',
            receiptMethod: 'cash',
            lineItems: [
                { accountCode: '41101', amount: 2000000 }
            ]
        };

        const result = await ReceiptVoucher.updateVoucher(12345, updateData);

        expect(result.success).toBe(true);
        expect(ReceiptVoucher.vouchers[0].receiveFrom).toBe('Pelanggan A Updated');
        expect(ReceiptVoucher.vouchers[0].totalAmount).toBe(2000000);
        expect(AuditLog.log).toHaveBeenCalledWith('update', 'receipt_voucher', 12345, expect.any(String));
    });

    test('updateVoucher fails if the voucher is not in draft status', async () => {
        ReceiptVoucher.vouchers[0].status = 'verified';
        const updateData = {
            type: 'BKM',
            date: '2026-07-15',
            receiveFrom: 'Pelanggan A Updated',
            purpose: 'Penerimaan Penjualan Edit',
            receiptCategory: 'customer',
            receiptMethod: 'cash',
            lineItems: [
                { accountCode: '41101', amount: 2000000 }
            ]
        };

        const result = await ReceiptVoucher.updateVoucher(12345, updateData);
        expect(result.success).toBe(false);
        expect(result.errors.status).toBeDefined();
    });
});
