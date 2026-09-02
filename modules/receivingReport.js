// ==========================================
// Receiving Report Module (End-to-End Tracking)
// Tracks gold receiving from Frontdesk to Accounting
// ==========================================

const ReceivingReport = {
    init() {
        if (!Auth.isAuthenticated()) {
            window.location.href = 'login.html';
            return;
        }
        this.render();
    },

    render() {
        const content = document.getElementById('main-content');
        content.innerHTML = `
            <div class="page-header">
                <div class="flex justify-between align-center">
                    <div>
                        <h1 class="page-title">🔍 Laporan Pelacakan Penerimaan Emas</h1>
                        <p class="page-description">Pelacakan End-to-End dari Timbangan Frontdesk hingga Posting Akuntansi</p>
                    </div>
                    <div>
                        <button class="btn btn-secondary" onclick="ReceivingReport.printReport()">
                            <span class="icon">🖨️</span> Cetak PDF
                        </button>
                    </div>
                </div>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <div class="flex gap-2 align-end">
                        <div class="form-group mb-0" style="width: 200px;">
                            <label class="form-label text-xs">Filter Bulan</label>
                            <input type="month" id="receiving-filter-month" class="form-control" onchange="ReceivingReport.refreshTable()">
                        </div>
                        <div class="form-group mb-0" style="width: 250px;">
                            <label class="form-label text-xs">Cari No TTB / Pelanggan</label>
                            <input type="text" id="receiving-search" class="form-control" placeholder="Cari..." oninput="ReceivingReport.refreshTable()">
                        </div>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table" id="receiving-report-table">
                            <thead>
                                <tr>
                                    <th>No. TTB</th>
                                    <th>Tanggal</th>
                                    <th>Pelanggan</th>
                                    <th class="text-right">Berat Kotor<br><small>(Frontdesk)</small></th>
                                    <th class="text-right">Berat Bersih<br><small>(Lab/Pabrik)</small></th>
                                    <th class="text-right">Kadar Lab</th>
                                    <th class="text-right">Emas Murni<br><small>(Net Content)</small></th>
                                    <th>Status TTB</th>
                                    <th>Status KYC</th>
                                </tr>
                            </thead>
                            <tbody id="receiving-report-body">
                                <tr><td colspan="9" class="text-center">Loading data...</td></tr>
                            </tbody>
                            <tfoot id="receiving-report-foot" style="font-weight: bold; background: #f8f9fa;">
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>
        `;

        // Set default month to current month
        const today = new Date();
        const monthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        document.getElementById('receiving-filter-month').value = monthStr;

        this.refreshTable();
    },

    refreshTable() {
        const tbody = document.getElementById('receiving-report-body');
        const tfoot = document.getElementById('receiving-report-foot');
        const monthFilter = document.getElementById('receiving-filter-month').value;
        const searchQ = document.getElementById('receiving-search').value.toLowerCase();

        // 1. Fetch raw data
        let ttbs = Storage.getTTBs() || [];
        const labTests = Storage.getLabTests ? Storage.getLabTests() : [];
        const kycRecords = Storage.getKYCRecords ? Storage.getKYCRecords() : [];
        const customers = Storage.getCustomers() || [];
        
        // Filter by month (createdAt or date)
        if (monthFilter) {
            ttbs = ttbs.filter(t => (t.date || t.createdAt || '').startsWith(monthFilter));
        }

        if (ttbs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center">Tidak ada data penerimaan di bulan ini</td></tr>';
            tfoot.innerHTML = '';
            return;
        }

        // 2. Aggregate data
        const rowsHTML = [];
        let totalBruto = 0;
        let totalNetto = 0;
        let totalPureGold = 0;

        // Sort descending by date
        ttbs.sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));

        ttbs.forEach(ttb => {
            // Apply text search
            const custName = (ttb.supplierName || '').toLowerCase();
            const ttbNo = (ttb.ttbNumber || '').toLowerCase();
            if (searchQ && !custName.includes(searchQ) && !ttbNo.includes(searchQ)) {
                return;
            }

            // Find matching Lab Test
            const labTest = labTests.find(l => l.ttbId === ttb.id || l.ttbNumber === ttb.ttbNumber) || null;
            
            // Find Customer KYC
            const cust = customers.find(c => c.id === ttb.supplierId || c.code === ttb.supplierId) || null;
            const kycRec = kycRecords.find(k => k.customerId === ttb.supplierId);
            
            // Extract Weights
            const bruto = ttb.items && ttb.items.length > 0 ? ttb.items[0].receivedQty : 0;
            let netto = null;
            let purity = null;
            let netContent = null;

            if (labTest && labTest.results) {
                netto = labTest.results.netWeight || labTest.results.weightAfterMelt || bruto;
                purity = labTest.results.purity || labTest.results.karatValue;
                if (netto != null && purity != null) {
                    netContent = (parseFloat(netto) * parseFloat(purity) / 100);
                }
            }

            // Aggregate totals
            totalBruto += parseFloat(bruto || 0);
            if (netto) totalNetto += parseFloat(netto);
            if (netContent) totalPureGold += netContent;

            // Badges
            let statusBadge = '<span class="badge badge-secondary">Draft</span>';
            if (ttb.status === 'gudang_approved') statusBadge = '<span class="badge badge-warning">Di Gudang</span>';
            else if (ttb.status === 'pembelian_approved') statusBadge = '<span class="badge badge-info">Pengecekan Harga</span>';
            else if (ttb.status === 'accounting_approved') statusBadge = '<span class="badge badge-primary">Menunggu Posting</span>';
            else if (ttb.status === 'posted') statusBadge = '<span class="badge badge-success">Posted & Final</span>';

            let kycBadge = '<span class="badge badge-secondary">N/A</span>';
            if (kycRec) {
                if (kycRec.status === 'approved') kycBadge = '<span class="badge badge-success">Verified</span>';
                else if (kycRec.status === 'submitted') kycBadge = '<span class="badge badge-warning">Reviewing</span>';
                else if (kycRec.status === 'rejected') kycBadge = '<span class="badge badge-danger">Rejected</span>';
            } else if (cust && cust.kycStatus === 'submitted') {
                kycBadge = '<span class="badge badge-warning">Reviewing</span>';
            }

            rowsHTML.push(`
                <tr>
                    <td><strong>${ttb.ttbNumber}</strong></td>
                    <td>${new Date(ttb.createdAt || ttb.date).toLocaleDateString('id-ID')}</td>
                    <td>${ttb.supplierName}</td>
                    <td class="text-right">${bruto ? parseFloat(bruto).toFixed(2) + ' gr' : '-'}</td>
                    <td class="text-right">${netto != null ? parseFloat(netto).toFixed(2) + ' gr' : '-'}</td>
                    <td class="text-right">${purity != null ? parseFloat(purity).toFixed(2) + '%' : '-'}</td>
                    <td class="text-right" style="color: var(--color-primary-dark); font-weight: bold;">
                        ${netContent != null ? netContent.toFixed(2) + ' gr' : '-'}
                    </td>
                    <td>${statusBadge}</td>
                    <td>${kycBadge}</td>
                </tr>
            `);
        });

        if (rowsHTML.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center">Tidak ada data yang sesuai filter</td></tr>';
            tfoot.innerHTML = '';
        } else {
            tbody.innerHTML = rowsHTML.join('');
            tfoot.innerHTML = `
                <tr>
                    <td colspan="3" class="text-right"><strong>TOTAL PERIODE:</strong></td>
                    <td class="text-right" style="color: var(--color-primary-dark);">${totalBruto.toFixed(2)} gr</td>
                    <td class="text-right">${totalNetto.toFixed(2)} gr</td>
                    <td></td>
                    <td class="text-right" style="color: var(--color-primary-dark);">${totalPureGold.toFixed(2)} gr</td>
                    <td colspan="2"></td>
                </tr>
            `;
        }
    },

    printReport() {
        const monthFilter = document.getElementById('receiving-filter-month').value;
        const title = "LAPORAN PELACAKAN PENERIMAAN EMAS" + (monthFilter ? `\nPeriode: ${monthFilter}` : '');
        
        // Ensure jsPDF exists
        if (typeof window.jspdf !== 'undefined') {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('l', 'mm', 'a4'); // Landscape format
            
            // Header
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.text("LAPORAN PELACAKAN PENERIMAAN EMAS", 14, 15);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(`Periode: ${monthFilter || 'Semua Data'}`, 14, 22);
            doc.text(`Dicetak Pada: ${new Date().toLocaleString('id-ID')}`, 14, 27);

            // Table Data
            if (typeof doc.autoTable === 'function') {
                doc.autoTable({
                    html: '#receiving-report-table',
                    startY: 32,
                    theme: 'grid',
                    styles: { fontSize: 8 },
                    headStyles: { fillColor: [212, 175, 55], textColor: 255 },
                    footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' }
                });
            } else {
                alert("Error: Plugin PDFTable belum termuat. Pastikan koneksi internet aktif.");
                return;
            }

            doc.save(`Receiving_Report_${monthFilter || 'All'}.pdf`);
        } else {
            window.print();
        }
    }
};

window.ReceivingReport = ReceivingReport;
