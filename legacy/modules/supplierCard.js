// ==========================================
// Kartu Supplier Module
// Lihat riwayat transaksi dan saldo hutang per supplier
// ==========================================

const SupplierCard = {
    currentSupplier: null,
    transactions: [],
    dateFrom: null,
    dateTo: null,

    init() {
        // Can be initialized if needed
    },

    // Open supplier card modal
    showCard(supplierId) {
        const suppliers = Storage.getSuppliers() || [];
        this.currentSupplier = suppliers.find(s => s.id === supplierId || s.code === supplierId);

        if (!this.currentSupplier) {
            alert('Supplier tidak ditemukan');
            return;
        }

        // Set default date range (last 3 months)
        const today = new Date();
        const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, 1);
        this.dateFrom = threeMonthsAgo.toISOString().split('T')[0];
        this.dateTo = today.toISOString().split('T')[0];

        this.loadTransactions();
        this.renderModal();
    },

    loadTransactions() {
        const supplierId = this.currentSupplier?.id;
        const supplierCode = this.currentSupplier?.code;
        if (!supplierId && !supplierCode) return;

        this.transactions = [];

        // 1. Purchase Orders
        const purchaseOrders = Storage.get('erp_purchase_orders') || [];
        purchaseOrders.forEach(po => {
            if (po.supplierId === supplierId || po.supplier === supplierCode) {
                this.transactions.push({
                    date: po.date || po.createdAt,
                    type: 'PO',
                    docNo: po.poNumber || po.id,
                    description: `Purchase Order`,
                    debit: 0,
                    credit: po.totalAmount || po.total || 0,
                    status: po.status
                });
            }
        });

        // 2. Goods Receipts
        const goodsReceipts = Storage.get('erp_goods_receipts') || [];
        goodsReceipts.forEach(gr => {
            if (gr.supplierId === supplierId || gr.supplier === supplierCode) {
                this.transactions.push({
                    date: gr.date || gr.createdAt,
                    type: 'GR',
                    docNo: gr.grNumber || gr.id,
                    description: `Goods Receipt - ${gr.poNumber || ''}`,
                    debit: 0,
                    credit: gr.totalAmount || gr.total || 0,
                    status: gr.status
                });
            }
        });

        // 3. Supplier Invoices
        const invoices = Storage.get('supplier_invoices') || [];
        invoices.forEach(inv => {
            if (inv.supplierId === supplierId || inv.supplier === supplierCode) {
                this.transactions.push({
                    date: inv.date || inv.invoiceDate || inv.createdAt,
                    type: 'INV',
                    docNo: inv.invoiceNumber || inv.id,
                    description: `Invoice Supplier`,
                    debit: 0,
                    credit: inv.totalAmount || inv.total || 0,
                    status: inv.status
                });
            }
        });

        // 4. Payments (from journal entries or payment vouchers)
        const journals = Storage.get('erp_journals') || [];
        journals.forEach(j => {
            const memo = (j.memo || j.description || '').toLowerCase();
            const supplierName = (this.currentSupplier.name || '').toLowerCase();
            if (memo.includes(supplierName) || memo.includes(supplierCode?.toLowerCase() || '')) {
                // Check if it's a payment (debit to AP account)
                const apEntry = (j.entries || []).find(e =>
                    (e.accountCode || '').startsWith('2') && e.debit > 0
                );
                if (apEntry) {
                    this.transactions.push({
                        date: j.date,
                        type: 'PAY',
                        docNo: j.journalNumber || j.id,
                        description: `Pembayaran - ${j.memo || ''}`,
                        debit: apEntry.debit,
                        credit: 0,
                        status: 'posted'
                    });
                }
            }
        });

        // 5. Payment Vouchers (BKK)
        const paymentVouchers = Storage.get('payment_vouchers') || [];
        paymentVouchers.forEach(pv => {
            if (pv.supplierId === supplierId || pv.payee?.includes(this.currentSupplier.name)) {
                this.transactions.push({
                    date: pv.date || pv.createdAt,
                    type: 'BKK',
                    docNo: pv.voucherNumber || pv.id,
                    description: `Bukti Kas Keluar - ${pv.description || ''}`,
                    debit: pv.amount || pv.total || 0,
                    credit: 0,
                    status: pv.status
                });
            }
        });

        // Sort by date
        this.transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Filter by date range
        if (this.dateFrom && this.dateTo) {
            this.transactions = this.transactions.filter(t => {
                const tDate = new Date(t.date);
                return tDate >= new Date(this.dateFrom) && tDate <= new Date(this.dateTo);
            });
        }
    },

    calculateBalance() {
        let balance = 0;
        this.transactions.forEach(t => {
            balance += (t.credit || 0) - (t.debit || 0);
        });
        return balance;
    },

    renderModal() {
        const modalId = 'supplier-card-modal';
        let modal = document.getElementById(modalId);
        if (!modal) {
            modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'modal-overlay hidden';
            document.body.appendChild(modal);
        }

        const balance = this.calculateBalance();
        const totalDebit = this.transactions.reduce((sum, t) => sum + (t.debit || 0), 0);
        const totalCredit = this.transactions.reduce((sum, t) => sum + (t.credit || 0), 0);

        modal.innerHTML = `
            <div class="modal" style="max-width: 1000px; width: 95%; max-height: 90vh; overflow-y: auto;">
                <div class="modal-header">
                    <h3 class="modal-title">📋 Kartu Supplier: ${this.currentSupplier.name}</h3>
                    <button class="modal-close" onclick="SupplierCard.closeModal()">×</button>
                </div>
                <div class="modal-body">
                    <!-- Supplier Info -->
                    <div class="card p-3 mb-3" style="background: #f8fafc;">
                        <div class="grid grid-4 gap-2">
                            <div>
                                <small class="text-gray">Kode</small>
                                <div><strong>${this.currentSupplier.code}</strong></div>
                            </div>
                            <div>
                                <small class="text-gray">Contact</small>
                                <div>${this.currentSupplier.contact || '-'}</div>
                            </div>
                            <div>
                                <small class="text-gray">Telepon</small>
                                <div>${this.currentSupplier.phone || '-'}</div>
                            </div>
                            <div>
                                <small class="text-gray">Status Pajak</small>
                                <div>${this.currentSupplier.taxStatus === 'PKP' ? '<span class="badge badge-success">PKP</span>' : '<span class="badge badge-secondary">Non PKP</span>'}</div>
                            </div>
                        </div>
                    </div>

                    <!-- Date Filter -->
                    <div class="card p-3 mb-3">
                        <div class="flex gap-2 align-center">
                            <label class="form-label mb-0">Periode:</label>
                            <input type="date" id="supplier-card-from" class="form-input" style="width: 150px;" value="${this.dateFrom}" onchange="SupplierCard.filterByDate()">
                            <span>s/d</span>
                            <input type="date" id="supplier-card-to" class="form-input" style="width: 150px;" value="${this.dateTo}" onchange="SupplierCard.filterByDate()">
                            <button class="btn btn-secondary btn-sm" onclick="SupplierCard.exportToCSV()">📄 Export CSV</button>
                            <button class="btn btn-secondary btn-sm" onclick="SupplierCard.print()">🖨️ Print</button>
                        </div>
                    </div>

                    <!-- Summary -->
                    <div class="grid grid-3 gap-2 mb-3">
                        <div class="card p-3 text-center" style="background: #ecfdf5; border-color: #10b981;">
                            <small class="text-gray">Total Pembelian (Credit)</small>
                            <div class="text-lg font-bold text-success">${this.formatCurrency(totalCredit)}</div>
                        </div>
                        <div class="card p-3 text-center" style="background: #fef2f2; border-color: #ef4444;">
                            <small class="text-gray">Total Pembayaran (Debit)</small>
                            <div class="text-lg font-bold text-danger">${this.formatCurrency(totalDebit)}</div>
                        </div>
                        <div class="card p-3 text-center" style="background: ${balance > 0 ? '#fef3c7' : '#ecfdf5'}; border-color: ${balance > 0 ? '#f59e0b' : '#10b981'};">
                            <small class="text-gray">Saldo Hutang</small>
                            <div class="text-lg font-bold" style="color: ${balance > 0 ? '#f59e0b' : '#10b981'};">${this.formatCurrency(balance)}</div>
                        </div>
                    </div>

                    <!-- Transaction Table -->
                    <div class="table-container" style="max-height: 400px; overflow-y: auto;">
                        <table class="table table-sm">
                            <thead style="position: sticky; top: 0; background: white;">
                                <tr>
                                    <th>Tanggal</th>
                                    <th>Tipe</th>
                                    <th>No. Dokumen</th>
                                    <th>Keterangan</th>
                                    <th class="text-right">Debit</th>
                                    <th class="text-right">Credit</th>
                                    <th class="text-right">Saldo</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${this.renderTransactionRows()}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        modal.classList.remove('hidden');
    },

    renderTransactionRows() {
        if (this.transactions.length === 0) {
            return '<tr><td colspan="7" class="text-center text-gray">Tidak ada transaksi dalam periode ini</td></tr>';
        }

        let runningBalance = 0;
        return this.transactions.map(t => {
            runningBalance += (t.credit || 0) - (t.debit || 0);
            const typeColors = {
                'PO': 'badge-primary',
                'GR': 'badge-info',
                'INV': 'badge-warning',
                'PAY': 'badge-success',
                'BKK': 'badge-success'
            };
            return `
                <tr>
                    <td>${this.formatDate(t.date)}</td>
                    <td><span class="badge ${typeColors[t.type] || 'badge-secondary'}">${t.type}</span></td>
                    <td>${t.docNo}</td>
                    <td>${t.description}</td>
                    <td class="text-right">${t.debit ? this.formatCurrency(t.debit) : '-'}</td>
                    <td class="text-right">${t.credit ? this.formatCurrency(t.credit) : '-'}</td>
                    <td class="text-right font-bold">${this.formatCurrency(runningBalance)}</td>
                </tr>
            `;
        }).join('');
    },

    filterByDate() {
        this.dateFrom = document.getElementById('supplier-card-from').value;
        this.dateTo = document.getElementById('supplier-card-to').value;
        this.loadTransactions();
        this.renderModal();
    },

    closeModal() {
        const modal = document.getElementById('supplier-card-modal');
        if (modal) modal.classList.add('hidden');
    },

    formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount || 0);
    },

    formatDate(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    },

    exportToCSV() {
        if (this.transactions.length === 0) {
            alert('Tidak ada data untuk diexport');
            return;
        }

        const headers = ['Tanggal', 'Tipe', 'No. Dokumen', 'Keterangan', 'Debit', 'Credit'];
        const rows = this.transactions.map(t => [
            this.formatDate(t.date),
            t.type,
            t.docNo,
            t.description,
            t.debit || 0,
            t.credit || 0
        ]);

        let csv = `Kartu Supplier: ${this.currentSupplier.name}\n`;
        csv += `Periode: ${this.dateFrom} s/d ${this.dateTo}\n\n`;
        csv += headers.join(',') + '\n';
        rows.forEach(row => {
            csv += row.map(cell => `"${cell}"`).join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `kartu-supplier-${this.currentSupplier.code}-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    },

    print() {
        const printContent = document.querySelector('#supplier-card-modal .modal-body').innerHTML;
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
            <head>
                <title>Kartu Supplier - ${this.currentSupplier.name}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background: #f5f5f5; }
                    .text-right { text-align: right; }
                    .badge { padding: 2px 8px; border-radius: 4px; font-size: 12px; }
                    .text-center { text-align: center; }
                    @media print { button { display: none; } }
                </style>
            </head>
            <body>
                <h2>Kartu Supplier: ${this.currentSupplier.name}</h2>
                ${printContent}
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    }
};

window.SupplierCard = SupplierCard;
