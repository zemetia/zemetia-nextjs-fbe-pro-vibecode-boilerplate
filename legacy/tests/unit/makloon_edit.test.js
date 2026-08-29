const fs = require('fs');
const path = require('path');

// Mock Storage
global.Storage = {
    KEYS: {
        CONFIG: 'erp_config',
        CUSTOMERS: 'erp_customers',
        ITEMS: 'erp_items',
        DIRECT_SWAPS: 'erp_direct_swaps'
    },
    get: jest.fn((key) => {
        if (key === 'erp_customers') return [{ id: 'CUST001', code: 'C-001', name: 'Toko Emas' }];
        if (key === 'erp_items') return [
            { code: 'SCRAP-01', name: 'Emas Scrap', category: 'raw' },
            { code: 'BAR-24K', name: 'Gold Bar 24K', category: 'finished' }
        ];
        return null;
    }),
    set: jest.fn().mockResolvedValue(true),
    getCustomer: jest.fn(() => ({ id: 'CUST001', code: 'C-001', name: 'Toko Emas' })),
    getItem: jest.fn((code) => {
        if (code === 'SCRAP-01') return { code: 'SCRAP-01', name: 'Emas Scrap', category: 'raw' };
        if (code === 'BAR-24K') return { code: 'BAR-24K', name: 'Gold Bar 24K', category: 'finished', standardCost: 1000000 };
        return null;
    }),
    getWarehouses: jest.fn(() => [{ code: 'MAIN', name: 'MAIN (Default)' }]),
    getNextReferenceNumber: jest.fn(() => 'S-000006'),
    getAccountByPurpose: jest.fn(() => '1000')
};

// Mock Auth
global.Auth = {
    getCurrentUser: jest.fn(() => ({ username: 'admin', role: 'ADMIN' }))
};

// Mock other global dependencies
global.WarehouseStock = {
    updateStock: jest.fn()
};
global.InventoryValuation = {
    updateItemCost: jest.fn()
};
global.SerializedItem = {
    getAvailable: jest.fn(() => []),
    getAll: jest.fn(() => []),
    updateStatus: jest.fn()
};
global.CustomerKYC = {
    loadKYCRecords: jest.fn(),
    checkKYCStatus: jest.fn(() => ({ approved: true }))
};
global.TTB = {
    createTTBFromSwap: jest.fn()
};

// Mock App
global.App = {
    getAuthModule: () => global.Auth
};

// Set up JSDOM elements
document.body.innerHTML = `
    <div id="main-content"></div>
    <div id="makloon-service-modal" class="modal-overlay hidden">
        <div class="modal">
            <div class="modal-body"></div>
            <div class="modal-footer"></div>
        </div>
    </div>
`;

// Export MakloonService to test
if (typeof window === 'undefined') {
    global.window = { db: {}, firestore: {} };
}
global.window.db = {};
global.window.firestore = {};

const MakloonService = require('../../modules/makloonService.js');

describe('Jasa Makloon Draft Edit Support', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        MakloonService.transactions = [
            {
                id: 'S-000005',
                status: 'DRAFT',
                type: 'MAKLOON',
                date: '2026-07-09',
                customer: { id: 'CUST001', code: 'C-001', name: 'Toko Emas' },
                customerId: 'CUST001',
                receiptWeight: 100,
                itemIn: { code: 'SCRAP-01', name: 'Emas Scrap', weight: 100, purity: 90, price: 0, total: 0 },
                itemOut: { code: 'BAR-24K', name: 'Gold Bar 24K', category: 'finished', weight: 90, serials: [] },
                batchDetails: [
                    { barId: 'BAR-A1', weight: 100, purity: 90, status: 'ACCEPT', grade: 'Au', returnPct: 0, est24k: 90 }
                ],
                fee: 500000,
                notes: 'Draft Notes',
                warehouseCode: 'MAIN'
            }
        ];
    });

    test('showCreateModal: populates existing transaction data correctly when editId is provided', () => {
        // Open edit form for S-000005
        MakloonService.showCreateModal('S-000005');

        // Check if modal title changes to Edit
        const title = document.querySelector('.modal-title');
        expect(title.textContent).toBe('✏️ Edit Transaksi Jasa Makloon');

        // Check values of form elements
        expect(document.getElementById('swap-id').value).toBe('S-000005');
        expect(document.getElementById('swap-date').value).toBe('2026-07-09');
        expect(document.getElementById('swap-customer').value).toBe('CUST001');
        expect(document.getElementById('swap-receipt-weight').value).toBe('100');
        expect(document.getElementById('swap-notes').value).toBe('Draft Notes');
    });

    test('submitForm: updates draft transaction in place when editing', async () => {
        // Populate inputs manually to simulate user edits
        MakloonService.showCreateModal('S-000005');
        
        // Simulating change of notes in input
        document.getElementById('swap-notes').value = 'Updated Notes';
        
        // Mock elements read in submitForm
        document.getElementById('swap-item-in').value = 'SCRAP-01';
        document.getElementById('swap-item-out').value = 'BAR-24K';
        document.getElementById('swap-weight-out').value = '90';
        document.getElementById('swap-fee').value = '5000'; // 5000 per gram
        
        // Insert mock elements for batch row calculation to avoid unformatNumber on empty inputs
        const firstBatchRow = document.querySelector('.batch-row');
        if (firstBatchRow) {
            firstBatchRow.querySelector('.batch-weight').value = '100';
            firstBatchRow.querySelector('.batch-purity').value = '90';
            firstBatchRow.querySelector('.batch-bar-id').value = 'BAR-A1';
        }

        // Call submitForm as DRAFT
        await MakloonService.submitForm('DRAFT');

        // Verify transaction was edited in place
        expect(MakloonService.transactions.length).toBe(1); // Still 1 transaction
        expect(MakloonService.transactions[0].id).toBe('S-000005'); // ID remains the same
        expect(MakloonService.transactions[0].notes).toBe('Updated Notes'); // Notes updated
    });
});
