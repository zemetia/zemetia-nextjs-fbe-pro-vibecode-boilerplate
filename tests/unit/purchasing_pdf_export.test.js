/**
 * @jest-environment jsdom
 */

// Mock window.jspdf and autoTable
const mockSave = jest.fn();
const mockOpen = jest.fn();
const mockText = jest.fn();
const mockLine = jest.fn();
const mockRect = jest.fn();
const mockRoundedRect = jest.fn();
const mockSetFontSize = jest.fn();
const mockSetFont = jest.fn();
const mockSetTextColor = jest.fn();
const mockSetFillColor = jest.fn();
const mockSetDrawColor = jest.fn();
const mockSetLineWidth = jest.fn();
const mockSetLineDashPattern = jest.fn();
const mockAutoTable = jest.fn(function(opts) {
    this.lastAutoTable = { finalY: 100 };
});

window.open = mockOpen;

class MockJsPDF {
    constructor() {
        this.internal = {
            pageSize: {
                getWidth: () => 210,
                getHeight: () => 297
            },
            getNumberOfPages: () => 1
        };
        this.save = mockSave;
        this.output = jest.fn(() => 'blob:http://localhost/test-uuid');
        this.text = mockText;
        this.line = mockLine;
        this.rect = mockRect;
        this.roundedRect = mockRoundedRect;
        this.setFontSize = mockSetFontSize;
        this.setFont = mockSetFont;
        this.setTextColor = mockSetTextColor;
        this.setFillColor = mockSetFillColor;
        this.setDrawColor = mockSetDrawColor;
        this.setLineWidth = mockSetLineWidth;
        this.setLineDashPattern = mockSetLineDashPattern;
        this.splitTextToSize = (text) => [text];
        this.setPage = jest.fn();
        this.autoTable = mockAutoTable;
    }
}

window.jspdf = { jsPDF: MockJsPDF };

const PDFExporter = require('../../modules/pdfExporter.js');

describe('Purchasing PDF Export Functions', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('exportTTB creates and opens/saves PDF with proper filename', async () => {
        const sampleTTB = {
            grnNumber: 'TTB-2026-0001',
            poNumber: 'PO-IMP-2026-001',
            supplierName: 'YLG Bullion Singapore',
            supplierDoNumber: 'SJ-YLG-9988',
            pibNo: '001299/BC/2026',
            receivedWeightGram: 1000,
            itemDescription: 'Emas Batangan Valcambi 999.9',
            totalValueIDR: 1500000000
        };

        const res = await PDFExporter.exportTTB(sampleTTB);
        expect(res.filename).toBe('TTB-2026-0001.pdf');
        expect(res.blobUrl).toBe('blob:http://localhost/test-uuid');
    });

    test('exportPurchaseOrder creates and saves PO PDF', async () => {
        const samplePO = {
            poNumber: 'PO-LOK-2026-0005',
            supplierName: 'PT Pegadaian (Persero) Jakarta',
            itemName: 'Logam Mulia 100g Antam',
            weightGrams: 100,
            pricePerGram: 1450000,
            totalAmount: 145000000,
            status: 'approved'
        };

        const res = await PDFExporter.exportPurchaseOrder(samplePO);
        expect(res.filename).toBe('PO-LOK-2026-0005.pdf');
        expect(res.blobUrl).toBe('blob:http://localhost/test-uuid');
    });

    test('exportCourierAuthorization creates 4-TTD Courier PDF', async () => {
        const sampleCourierOrder = {
            poNumber: 'PO-LOK-2026-0005',
            receiptNo: 'NOTA-LOKAL-0005',
            courierName: 'Bpk. Budi',
            supplierName: 'PT Pegadaian Jakarta',
            weightGrams: 500,
            totalAmount: 725000000
        };

        const res = await PDFExporter.exportCourierAuthorization(sampleCourierOrder);
        expect(res.filename).toBe('SURAT-KUASA-KURIR-NOTA-LOKAL-0005.pdf');
        expect(res.blobUrl).toBe('blob:http://localhost/test-uuid');
    });

    test('exportScrapPurchaseReceipt creates Scrap Buying PDF', async () => {
        const sampleScrap = {
            receiptNo: 'NOTA-SCRAP-2026-012',
            supplierName: 'Toko Emas Rejeki',
            itemDescription: 'Perhiasan Emas Tua Campur',
            grossWeight: 50.5,
            xrfPurity: 75.0,
            estimatedFineGold: 37.88,
            buyPricePerGram: 1400000,
            totalAmount: 53032000
        };

        const res = await PDFExporter.exportScrapPurchaseReceipt(sampleScrap);
        expect(res.filename).toBe('NOTA-SCRAP-NOTA-SCRAP-2026-012.pdf');
        expect(res.blobUrl).toBe('blob:http://localhost/test-uuid');
    });

    test('exportPaymentVoucher creates BBK Voucher PDF', async () => {
        const sampleVoucher = {
            voucherNumber: 'BBK-2026-0089',
            voucherType: 'BBK',
            bankAccountCode: '1111-IDR',
            bankAccountName: 'Bank BCA IDR',
            payee: 'PT Pegadaian (Persero)',
            amount: 145000000,
            selectedPONumber: 'PO-LOK-2026-0005'
        };

        const res = await PDFExporter.exportPaymentVoucher(sampleVoucher);
        expect(res.filename).toBe('VOUCHER-BBK-2026-0089.pdf');
        expect(res.blobUrl).toBe('blob:http://localhost/test-uuid');
    });

    test('exportPurchaseRequisition creates PRF PDF', async () => {
        const samplePRF = {
            prNumber: 'PR-2026-0033',
            department: 'Workshop Produksi',
            requesterName: 'Budi Santoso',
            totalEstAmount: 25000000,
            items: [
                { itemName: 'Crucible Peleburan 5kg', quantity: 2, unit: 'pcs', estimatedPrice: 2500000 }
            ]
        };

        const res = await PDFExporter.exportPurchaseRequisition(samplePRF);
        expect(res.filename).toBe('PRF-PR-2026-0033.pdf');
        expect(res.blobUrl).toBe('blob:http://localhost/test-uuid');
    });
});
