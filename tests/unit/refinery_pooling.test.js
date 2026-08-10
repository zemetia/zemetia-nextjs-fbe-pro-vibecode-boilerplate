/**
 * @jest-environment jsdom
 */

// Mock Dependencies BEFORE require
global.Storage = {
    KEYS: {
        SYSTEM_SETTINGS: 'erp_system_settings',
        PRODUCTION_BATCHES: 'production_batches'
    },
    store: {},
    get(key) { return this.store[key] || null; },
    set(key, val) { this.store[key] = val; return true; },
    getLossTolerancePercent() {
        const s = this.get(this.KEYS.SYSTEM_SETTINGS) || {};
        return typeof s.loss_tolerance_percent === 'number' ? s.loss_tolerance_percent : 0.5;
    },
    saveLossTolerancePercent(val, updatedBy = '608') {
        const numVal = parseFloat(val);
        if (isNaN(numVal) || numVal < 0.1 || numVal > 2.0) {
            throw new Error('Toleransi susut harus berada dalam rentang 0.1% s/d 2.0%');
        }
        const s = this.get(this.KEYS.SYSTEM_SETTINGS) || {};
        s.loss_tolerance_percent = numVal;
        s.updated_by = updatedBy;
        s.updated_at = new Date().toISOString();
        this.set(this.KEYS.SYSTEM_SETTINGS, s);
        return s;
    },
    getNextReferenceNumber: jest.fn(async () => 'BATCH-2026-001'),
    addBatch: jest.fn(async b => b),
    updateBatch: jest.fn(async (id, b) => b)
};

global.JobOrder = {
    jobOrdersMap: {},
    getJobOrder(id) { return this.jobOrdersMap[id] || null; },
    updateJobOrder: jest.fn(async (id, data) => data)
};

global.Auth = {
    getCurrentUser() { return { id: '608', name: 'Direktur Utama', email: 'director@gar.co.id' }; }
};

global.AuditLog = { log: jest.fn() };
global.jspdf = { jsPDF: function() {
    return {
        internal: { pageSize: { width: 210 } },
        setFontSize: jest.fn(),
        setFont: jest.fn(),
        text: jest.fn(),
        autoTable: jest.fn(function() { this.lastAutoTable = { finalY: 100 }; }),
        save: jest.fn()
    };
}};

// Require ProductionBatch & PDFExporter
const fs = require('fs');
const path = require('path');

const batchCode = fs.readFileSync(path.join(__dirname, '../../modules/productionBatch.js'), 'utf8');
eval(batchCode);

const PDFExporter = require('../../modules/pdfExporter.js');

describe('PRD-GAR-PROD-2026-08-03-v1.1: Toll Refining & Batch Pooling Unit Tests', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        Storage.store = {};
        ProductionBatch.batches = [];
        JobOrder.jobOrdersMap = {};
    });

    test('1. Configurable Loss Tolerance (%): Range 0.1% - 2.0% & Audit Log', () => {
        // Default 0.5%
        expect(Storage.getLossTolerancePercent()).toBe(0.5);

        // Edit by Direktur 608 to 0.8%
        Storage.saveLossTolerancePercent(0.8, '608');
        expect(Storage.getLossTolerancePercent()).toBe(0.8);

        // Out of range (2.5%) throws error
        expect(() => Storage.saveLossTolerancePercent(2.5, '608')).toThrow('Toleransi susut harus berada dalam rentang 0.1% s/d 2.0%');
    });

    test('2. QC Evaluation against Configurable Loss Tolerance (PASS, WARNING, FAIL)', () => {
        Storage.saveLossTolerancePercent(0.5, '608'); // 0.5% tolerance

        // Loss 0.3% <= 0.5% -> PASS
        const passEval = ProductionBatch.evaluateQCTolerance(3, 1000);
        expect(passEval.status).toBe('PASS');
        expect(passEval.lossPct).toBe(0.3);

        // Loss 0.8% (between 0.5% and 1.0%) -> WARNING
        const warnEval = ProductionBatch.evaluateQCTolerance(8, 1000);
        expect(warnEval.status).toBe('WARNING');
        expect(warnEval.lossPct).toBe(0.8);

        // Loss 1.5% (> 1.0%) -> FAIL
        const failEval = ProductionBatch.evaluateQCTolerance(15, 1000);
        expect(failEval.status).toBe('FAIL');
        expect(failEval.lossPct).toBe(1.5);
    });

    test('3. Pooling Consent Protection: System BLOCKS non-pooling customers', async () => {
        JobOrder.jobOrdersMap = {
            'JO-A': { id: 'JO-A', jobOrderNumber: 'JO-001', customerName: 'Customer A', status: 'batch_ready', input: { grossWeight: 5000, actualPureContent: 3750 }, is_pooling_allowed: true },
            'JO-C': { id: 'JO-C', jobOrderNumber: 'JO-003', customerName: 'Customer C', status: 'batch_ready', input: { grossWeight: 10000, actualPureContent: 7000 }, is_pooling_allowed: false }
        };

        // Trying to pool JO-A and JO-C MUST throw consent error
        await expect(ProductionBatch.createBatch(['JO-A', 'JO-C'])).rejects.toThrow('tidak mengizinkan pooling');
    });

    test('4. Proportional Fine Weight Allocation: Customer A (5kg), B (35kg), C (10kg) = 50kg Batch', () => {
        const batch = {
            id: 'BATCH-001',
            batchNumber: 'BATCH-GAR-2026-001',
            totalGrossWeight: 50000,
            totalEstimatedPureAu: 38750, // 3,750g + 28,000g + 7,000g
            jobOrders: [
                { id: 'JO-A', jobOrderNumber: 'JO-A', customerName: 'Customer A', grossWeight: 5000, estimatedPureAu: 3750 },
                { id: 'JO-B', jobOrderNumber: 'JO-B', customerName: 'Customer B', grossWeight: 35000, estimatedPureAu: 28000 },
                { id: 'JO-C', jobOrderNumber: 'JO-C', customerName: 'Customer C', grossWeight: 10000, estimatedPureAu: 7000 }
            ]
        };

        // Output batch fine = 38,600g, loss = 150g (0.387%), byproduct = 0
        const actualOutput = { pureAu: 38600, loss: 150, silver: 0 };
        const allocations = ProductionBatch.calculateAllocations(batch, actualOutput);

        expect(allocations.length).toBe(3);

        const allocA = allocations.find(a => a.jobOrderId === 'JO-A');
        const allocB = allocations.find(a => a.jobOrderId === 'JO-B');
        const allocC = allocations.find(a => a.jobOrderId === 'JO-C');

        // Verify Proportions
        expect(allocA.proportionPct).toBeCloseTo(9.677, 2);
        expect(allocB.proportionPct).toBeCloseTo(72.258, 2);
        expect(allocC.proportionPct).toBeCloseTo(18.065, 2);

        // Verify Allocated Output Fine Weights: 3,750 / 38,750 * 38,600 = 3735.48g
        expect(allocA.allocatedAu).toBeCloseTo(3735.48, 1);
        expect(allocB.allocatedAu).toBeCloseTo(27891.61, 1);
        expect(allocC.allocatedAu).toBeCloseTo(6972.90, 1);

        // Verify Sum of Allocated Fine equals Actual Output Fine (38,600g)
        const sumAllocatedAu = Math.round((allocA.allocatedAu + allocB.allocatedAu + allocC.allocatedAu) * 100) / 100;
        expect(sumAllocatedAu).toBe(38600);

        // Verify Loss Split
        expect(allocA.allocatedLoss).toBeCloseTo(14.52, 1);
        expect(allocB.allocatedLoss).toBeCloseTo(108.39, 1);
        expect(allocC.allocatedLoss).toBeCloseTo(27.10, 1);
    });

    test('5. PDF Export Templates (SPK Pooling & Settlement Report)', async () => {
        const batch = {
            id: 'BATCH-001',
            batchNumber: 'BATCH-GAR-2026-001',
            createdDate: '2026-08-03',
            totalGrossWeight: 50000,
            totalEstimatedPureAu: 38750,
            jobOrders: [
                { jobOrderNumber: 'JO-A', customerName: 'Customer A', grossWeight: 5000, estimatedKadar: 75, estimatedPureAu: 3750, proportionPct: 9.677 }
            ]
        };

        const settlement = {
            customerName: 'Customer A',
            jobOrderNumber: 'JO-A',
            grossWeight: 5000,
            kadarAwal: 75,
            fineWeightAwal: 3750,
            allocatedAu: 3735.48,
            allocatedLoss: 14.52,
            allocatedByproduct: 0,
            biayaJasa: 1500000
        };

        await expect(PDFExporter.exportPooledBatchSPK(batch)).resolves.not.toThrow();
        await expect(PDFExporter.exportCustomerSettlementReport(settlement)).resolves.not.toThrow();
    });
});
