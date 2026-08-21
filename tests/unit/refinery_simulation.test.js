const fs = require('fs');
const path = require('path');

// Read html
const htmlPath = path.resolve(__dirname, '../../simulasi-awi.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

// Extract script content
const scriptRegex = /<script>([\s\S]*?)<\/script>/;
const scriptMatch = htmlContent.match(scriptRegex);
const scriptCode = scriptMatch ? scriptMatch[1] : '';

// Mock ChartOfAccounts
global.ChartOfAccounts = {
    getDetailAccounts: jest.fn(() => [
        { code: '41101', name: 'Revenue' }
    ])
};

describe('Awi Refinery Services Standalone Simulation Calculations', () => {
    beforeEach(() => {
        // Set up JSDOM target elements
        document.body.innerHTML = `
            <div id="main-content"></div>
            <input type="text" id="cust-name">
            <input type="text" id="cust-address">
            <input type="text" id="cust-phone">
            <input type="text" id="report-number">
            <input type="text" id="trans-date">
            <input type="text" id="petugas-name">
            <input type="text" id="petugas-peleburan">
            <input type="text" id="petugas-lab">
            <input type="text" id="ttb-description">
            <input type="text" id="ttb-notes">
            <select id="fee-basis">
                <option value="gross_received">Berat Terima</option>
                <option value="melted">Berat Kotor Ref</option>
            </select>
            <select id="pph23-option">
                <option value="pph23">Badan Usaha (Potong PPh 23 2%)</option>
                <option value="non_pph23">Orang Pribadi (Non PPh 23 / 0%)</option>
            </select>
            <input type="number" id="qty-1000g">
            <input type="number" id="qty-500g">
            <input type="number" id="qty-250g">
            <input type="number" id="qty-50g">
            <input type="number" id="qty-10g">
            <input type="text" id="cert-1000g">
            <input type="text" id="cert-500g">
            <input type="text" id="cert-250g">
            <input type="text" id="cert-50g">
            <input type="text" id="cert-10g">
            <span id="cost-1000g"></span>
            <span id="cost-500g"></span>
            <span id="cost-250g"></span>
            <span id="cost-50g"></span>
            <span id="cost-10g"></span>
            <span id="gold-available"></span>
            <span id="gold-printed"></span>
            <span id="gold-leftover"></span>
            <span id="ref-dpp"></span>
            <span id="ref-ppn"></span>
            <span id="ref-pph"></span>
            <span id="ref-net"></span>
            <span id="mint-total"></span>
            <span id="mint-dpp"></span>
            <span id="mint-ppn"></span>
            <span id="mint-pph"></span>
            <span id="mint-net"></span>
            <div id="tot-decl"></div>
            <div id="tot-received"></div>
            <div id="tot-lebur"></div>
            <div id="tot-au"></div>
            <div id="tot-berat-deklarasi"></div>
            <div id="tot-kotor-ref"></div>
            <div id="tot-refinery-fee"></div>
            <div id="tot-delivered"></div>
            <table id="history-table"><tbody id="history-rows"></tbody></table>
            <input type="text" id="search-history">
        `;

        // Execute the script content extracted from HTML
        eval(scriptCode + "\n;global.RefinerySimulationAwi = RefinerySimulationAwi;");
    });

    test('performs accurate calculation under gross_received fee basis (Contoh Excel)', () => {
        RefinerySimulationAwi.metadata.feeBasis = 'gross_received';
        RefinerySimulationAwi.items = [
            {
                id: 1,
                date: '2026-07-14',
                beratDeklarasi: 5388.10,
                beratAwal: 5388.10,
                beratTerima: 5388.10,
                beratLebur: 5383.71,
                beratAuManual: 4722.05,
                kadarLab: 67.20,
                kadarRef: 87.71,
                biayaRef: 2000,
                metalReturn: 99.80,
                randomFactor: 0.8
            }
        ];
        
        RefinerySimulationAwi.mintingQty = {
            qty1000g: 3,
            qty500g: 0,
            qty250g: 0,
            qty50g: 0,
            qty10g: 0
        };

        RefinerySimulationAwi.syncInputsToForm();
        RefinerySimulationAwi.calculate();

        // 1. Refinery Jasa Billing Assertions (gross_received)
        // Biaya Refinery = beratAwal * biayaRef = 5388.10 * 2000 = 10.776.200
        expect(document.getElementById('ref-dpp').textContent).toBe('Rp 10.776.200');
        expect(document.getElementById('ref-ppn').textContent).toBe('Rp 1.185.382');
        expect(document.getElementById('ref-pph').textContent).toBe('- Rp 215.524');
        expect(document.getElementById('ref-net').textContent).toBe('Rp 11.746.058');

        // 2. Minting Jasa Billing Assertions
        expect(document.getElementById('mint-total').textContent).toBe('Rp 6.000.000');
        expect(document.getElementById('mint-dpp').textContent).toBe('Rp 5.405.405');
        expect(document.getElementById('mint-ppn').textContent).toBe('Rp 594.595');
        expect(document.getElementById('mint-pph').textContent).toBe('- Rp 108.108');
        expect(document.getElementById('mint-net').textContent).toBe('Rp 5.891.892');

        // 3. Gold Balance Assertions (gross_received NEW formula)
        // Berat AU = beratAuManual = 4722.05 (manual input)
        // Net Hasil = 4722.05 * 99.80% = 4712.60
        expect(document.getElementById('gold-available').textContent).toBe('4712.60 gr');
        expect(document.getElementById('gold-printed').textContent).toBe('3000.00 gr');
        expect(document.getElementById('gold-leftover').textContent).toBe('1712.60 gr');
    });

    test('calculates zero PPh 23 when Orang Pribadi (non_pph23) option is selected', () => {
        RefinerySimulationAwi.metadata.feeBasis = 'gross_received';
        RefinerySimulationAwi.metadata.isNonPph23 = true;
        RefinerySimulationAwi.items = [
            {
                id: 1,
                date: '2026-07-14',
                beratDeklarasi: 5388.10,
                beratAwal: 5388.10,
                beratTerima: 5388.10,
                beratLebur: 5383.71,
                beratAuManual: 4722.05,
                kadarLab: 67.20,
                kadarRef: 87.71,
                biayaRef: 2000,
                metalReturn: 99.80,
                randomFactor: 0.8
            }
        ];
        
        RefinerySimulationAwi.mintingQty = {
            qty1000g: 3,
            qty500g: 0,
            qty250g: 0,
            qty50g: 0,
            qty10g: 0
        };

        RefinerySimulationAwi.syncInputsToForm();
        RefinerySimulationAwi.calculate();

        // 1. Refinery Jasa Billing Assertions (isNonPph23 = true)
        // refDpp = 10.776.200, refPpn = 1.185.382, refPph = 0, refNet = 11.961.582
        expect(document.getElementById('ref-dpp').textContent).toBe('Rp 10.776.200');
        expect(document.getElementById('ref-ppn').textContent).toBe('Rp 1.185.382');
        expect(document.getElementById('ref-pph').textContent).toBe('Rp 0');
        expect(document.getElementById('ref-net').textContent).toBe('Rp 11.961.582');

        // 2. Minting Jasa Billing Assertions (isNonPph23 = true)
        // mintTotal = 6.000.000, mintDpp = 5.405.405, mintPpn = 594.595, mintPph = 0, mintNet = 6.000.000
        expect(document.getElementById('mint-total').textContent).toBe('Rp 6.000.000');
        expect(document.getElementById('mint-dpp').textContent).toBe('Rp 5.405.405');
        expect(document.getElementById('mint-ppn').textContent).toBe('Rp 594.595');
        expect(document.getElementById('mint-pph').textContent).toBe('Rp 0');
        expect(document.getElementById('mint-net').textContent).toBe('Rp 6.000.000');
    });

    test('synchronizes Nomor Sertifikat properly with mintingCerts state', () => {
        RefinerySimulationAwi.mintingCerts = {
            cert1000g: 'CERT-1000-001',
            cert500g: 'CERT-500-002',
            cert250g: 'CERT-250-003',
            cert50g: 'CERT-50-004',
            cert10g: 'CERT-10-005'
        };

        RefinerySimulationAwi.syncInputsToForm();

        expect(document.getElementById('cert-1000g').value).toBe('CERT-1000-001');
        expect(document.getElementById('cert-500g').value).toBe('CERT-500-002');
        expect(document.getElementById('cert-250g').value).toBe('CERT-250-003');
        expect(document.getElementById('cert-50g').value).toBe('CERT-50-004');
        expect(document.getElementById('cert-10g').value).toBe('CERT-10-005');

        // Test editing inputs and updating certificates
        document.getElementById('cert-1000g').value = 'CERT-UPDATED-999';
        RefinerySimulationAwi.updateCertificates();
        expect(RefinerySimulationAwi.mintingCerts.cert1000g).toBe('CERT-UPDATED-999');
    });

    test('performs accurate calculation matching the user uploaded screenshot (melted mode)', () => {
        RefinerySimulationAwi.metadata.feeBasis = 'melted';
        RefinerySimulationAwi.items = [
            {
                id: 1,
                date: '2026-07-16',
                beratAwal: 507.51,
                beratTerima: 507.51,
                beratLebur: 500.00,
                kadarLab: 99.8,
                kadarRef: 87.71,
                biayaRef: 2000,
                metalReturn: 99.9,
                randomFactor: 0.5
            }
        ];
        
        RefinerySimulationAwi.mintingQty = {
            qty1000g: 0,
            qty500g: 0,
            qty250g: 0,
            qty50g: 0,
            qty10g: 0
        };

        RefinerySimulationAwi.syncInputsToForm();
        RefinerySimulationAwi.calculate();

        // Net Kadar = 507.51 * 99.8% = 506.49
        // Berat Kotor Ref = 506.49 / 87.71% = 577.45
        // Bia Refinery = 577.45 * 2000 = 1.154.900
        expect(document.getElementById('ref-dpp').textContent).toBe('Rp 1.154.900');
        expect(document.getElementById('ref-ppn').textContent).toBe('Rp 127.039');
        expect(document.getElementById('ref-pph').textContent).toBe('- Rp 23.098');
        expect(document.getElementById('ref-net').textContent).toBe('Rp 1.258.841');

        expect(document.getElementById('gold-available').textContent).toBe('505.98 gr');
    });

    test('performs accurate minting fee calculation for all sizes combined (1000g, 500g, 250g, 50g, 10g)', () => {
        RefinerySimulationAwi.items = [
            {
                id: 1,
                date: '2026-07-14',
                beratAwal: 2000,
                beratTerima: 2000,
                beratLebur: 2000,
                kadarLab: 100,
                kadarRef: 100,
                biayaRef: 0,
                metalReturn: 100,
                randomFactor: 1
            }
        ];
        
        RefinerySimulationAwi.mintingQty = {
            qty1000g: 1, // Rp 2.000.000 per pcs
            qty500g: 1,  // Rp 1.050.000 per pcs
            qty250g: 1,  // Rp 575.000 per pcs
            qty50g: 1,   // Rp 130.000 per pcs
            qty10g: 1    // Rp 30.000 per pcs
        };

        RefinerySimulationAwi.syncInputsToForm();
        RefinerySimulationAwi.calculate();

        expect(document.getElementById('cost-1000g').textContent).toBe('Rp 2.000.000');
        expect(document.getElementById('cost-500g').textContent).toBe('Rp 1.050.000');
        expect(document.getElementById('cost-250g').textContent).toBe('Rp 575.000');
        expect(document.getElementById('cost-50g').textContent).toBe('Rp 130.000');
        expect(document.getElementById('cost-10g').textContent).toBe('Rp 30.000');

        expect(document.getElementById('mint-total').textContent).toBe('Rp 3.785.000');
        expect(document.getElementById('gold-printed').textContent).toBe('1810.00 gr');
    });

    test('automatically sets metal return based on Kadar Awal input ranges', () => {
        const testCases = [
            { kadar: 99.5, expectedReturn: 100.00 },
            { kadar: 95.0, expectedReturn: 99.95 },
            { kadar: 90.0, expectedReturn: 99.90 },
            { kadar: 75.0, expectedReturn: 99.80 },
            { kadar: 35.0, expectedReturn: 99.70 },
            { kadar: 15.0, expectedReturn: 99.60 },
            { kadar: 0.5, expectedReturn: 0.00 }
        ];

        testCases.forEach(tc => {
            expect(RefinerySimulationAwi.getMetalReturnForKadar(tc.kadar)).toBe(tc.expectedReturn);
        });
    });
});
