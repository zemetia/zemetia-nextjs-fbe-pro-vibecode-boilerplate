const fs = require('fs');
const path = require('path');

// Mock localStorage for test environment
const storageMock = (() => {
    let store = {};
    return {
        getItem: (key) => store[key] || null,
        setItem: (key, value) => { store[key] = value.toString(); },
        removeItem: (key) => { delete store[key]; },
        clear: () => { store = {}; }
    };
})();

Object.defineProperty(global, 'localStorage', { value: storageMock });
Object.defineProperty(global, 'sessionStorage', { value: storageMock });

// Load Storage data handler
const storageCode = fs.readFileSync(path.resolve(__dirname, '../../data/storage.js'), 'utf8');
eval(storageCode);

// Load Auth & PurchaseOrder modules
const authCode = fs.readFileSync(path.resolve(__dirname, '../../modules/auth.js'), 'utf8');
eval(authCode);

const validatorsCode = fs.readFileSync(path.resolve(__dirname, '../../modules/_validators.js'), 'utf8');
eval(validatorsCode);

const poCode = fs.readFileSync(path.resolve(__dirname, '../../modules/purchaseOrder.js'), 'utf8');
eval(poCode);

describe('PT TAN ERP - Phase 1: LM Import & Trading Tests', () => {
    beforeEach(() => {
        localStorage.clear();
        Storage.init();
    });

    test('1. COA SAK EMKM PT TAN Export accounts exist (1125, 1132, 1157, 1158, 1135, 5114, 5115, 5150, 6110)', () => {
        const coa = Storage.get(Storage.KEYS.CHART_OF_ACCOUNTS) || Storage.getDefaultChartOfAccounts();
        
        const acc1125 = coa.find(a => a.code === '1125');
        const acc1132 = coa.find(a => a.code === '1132');
        const acc1157 = coa.find(a => a.code === '1157');
        const acc1158 = coa.find(a => a.code === '1158');
        const acc1135 = coa.find(a => a.code === '1135');
        const acc5114 = coa.find(a => a.code === '5114');
        const acc5115 = coa.find(a => a.code === '5115');
        const acc5150 = coa.find(a => a.code === '5150');
        const acc6110 = coa.find(a => a.code === '6110');

        expect(acc1125).toBeDefined();
        expect(acc1125.name).toContain('USD');

        expect(acc1132).toBeDefined();
        expect(acc1132.name).toContain('Ekspor');

        expect(acc1157).toBeDefined();
        expect(acc1158).toBeDefined();
        expect(acc1135).toBeDefined();
        expect(acc5114).toBeDefined();
        expect(acc5115).toBeDefined();

        expect(acc5150).toBeDefined();
        expect(acc5150.name).toContain('Ekspor');

        expect(acc6110).toBeDefined();
        expect(acc6110.name).toContain('Selisih Kurs');
    });

    test('2. Default Master Items for Gold Bars are populated', () => {
        const items = Storage.getItems();
        expect(items.length).toBeGreaterThan(0);

        const antam100g = items.find(i => i.id === 'LM-ANTAM-100G');
        const valcambi1kg = items.find(i => i.id === 'LM-VALCAMBI-1KG');

        expect(antam100g).toBeDefined();
        expect(antam100g.inventoryAccount).toBe('1157');
        expect(antam100g.cogsAccount).toBe('5114');

        expect(valcambi1kg).toBeDefined();
        expect(valcambi1kg.inventoryAccount).toBe('1158');
        expect(valcambi1kg.cogsAccount).toBe('5115');
    });

    test('3. LM Import PO Multi-Currency (USD) & Landed Cost calculation', async () => {
        PurchaseOrder.init();

        const poData = {
            supplier: 'SUPP-OVERSEAS-01',
            supplierName: 'Valcambi SA Switzerland',
            orderDate: '2026-08-10',
            currency: 'USD',
            exchangeRate: 16200,
            importDuty: 10000000,          // Rp 10.000.000 Bea Masuk
            pph22Import: 30375000,         // Rp 30.375.000 PPh 22 Impor
            freightAndInsurance: 5000000,  // Rp 5.000.000 Asuransi & Freight
            barSerialNumbers: ['VC-998811', 'VC-998812'],
            items: [
                {
                    itemId: 'LM-VALCAMBI-1KG',
                    itemCode: 'LM-VALCAMBI-1KG',
                    itemName: 'Valcambi Suisse Gold Bar 1kg (999.9 LBMA)',
                    quantity: 2000, // 2000 grams (2 kg)
                    unit: 'gram',
                    unitPrice: 75.00 // $75.00 USD / gram
                }
            ]
        };

        const result = await PurchaseOrder.createOrder(poData);
        expect(result.success).toBe(true);

        const order = result.order;
        expect(order.currency).toBe('USD');
        expect(order.subtotal).toBe(150000); // 2000g * $75 = $150,000 USD
        expect(order.subtotalIDR).toBe(2430000000); // $150,000 * 16,200 = Rp 2.430.000.000

        // Total Landed Cost IDR = Subtotal IDR + Bea Masuk + Freight
        // = 2.430.000.000 + 10.000.000 + 5.000.000 = Rp 2.445.000.000
        expect(order.totalLandedCostIDR).toBe(2445000000);

        // Unit Landed Cost IDR per gram = 2.445.000.000 / 2000g = Rp 1.222.500 / gram
        expect(order.unitLandedCostIDRPerGram).toBe(1222500);

        // Bar serial numbers saved
        expect(order.barSerialNumbers).toContain('VC-998811');
        expect(order.barSerialNumbers).toContain('VC-998812');
    });
});
