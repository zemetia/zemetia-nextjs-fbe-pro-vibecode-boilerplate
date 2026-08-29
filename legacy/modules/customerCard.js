// ==========================================
// Kartu Customer Module
// Lihat riwayat transaksi dan saldo piutang per customer
// ==========================================

const CustomerCard = {
    currentCustomer: null,
    transactions: [],
    dateFrom: null,
    dateTo: null,

    init() {
        // Can be initialized if needed
    },

    // Open customer card modal
    showCard(customerId) {
        const customers = Storage.get('erp_customers') || [];
        this.currentCustomer = customers.find(c => c.id === customerId || c.code === customerId);

        if (!this.currentCustomer) {
            alert('Customer tidak ditemukan');
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
        const customerId = this.currentCustomer?.id;
        const customerCode = this.currentCustomer?.code;
        if (!customerId && !customerCode) return;

        this.transactions = [];

        // 1. Sales Orders
        const salesOrders = Storage.get('erp_sales_orders') || [];
        salesOrders.forEach(so => {
            if (so.customerId === customerId || so.customer === customerCode) {
                this.transactions.push({
                    date: so.date || so.createdAt,
                    type: 'SO',
                    docNo: so.soNumber || so.id,
                    description: `Sales Order`,
                    debit: so.totalAmount || so.total || 0,
                    credit: 0,
                    status: so.status
                });
            }
        });

        // 2. Delivery Orders
        const deliveryOrders = Storage.get('erp_delivery_orders') || [];
        deliveryOrders.forEach(doo => {
            if (doo.customerId === customerId || doo.customer === customerCode) {
                this.transactions.push({
                    date: doo.date || doo.createdAt,
                    type: 'DO',
                    docNo: doo.doNumber || doo.id,
                    description: `Delivery Order - ${doo.soNumber || ''}`,
                    debit: doo.totalAmount || doo.total || 0,
                    credit: 0,
                    status: doo.status
                });
            }
        });

        // 3. Customer Invoices (Sales Invoices)
        const invoices = Storage.get('erp_invoices') || Storage.get('sales_invoices') || [];
        invoices.forEach(inv => {
            if (inv.customerId === customerId || inv.customer === customerCode) {
                this.transactions.push({
                    date: inv.date || inv.invoiceDate || inv.createdAt,
                    type: 'INV',
                    docNo: inv.invoiceNumber || inv.id,
                    description: `Invoice Penjualan`,
                    debit: inv.totalAmount || inv.total || 0,
                    credit: 0,
                    status: inv.status
                });
            }
        });

        // 4. Direct Swaps (Tukar Tambah)
        const swaps = Storage.get('direct_swaps') || [];
        swaps.forEach(swap => {
            if (swap.customerId === customerId || swap.customer === customerCode) {
                // Net amount owed by customer
                const netAmount = (swap.outValue || 0) - (swap.inValue || 0);
                if (netAmount > 0) {
                    this.transactions.push({
                        date: swap.date || swap.createdAt,
                        type: 'SWAP',
                        docNo: swap.swapNumber || swap.id,
                        description: `Tukar Tambah`,
                        debit: netAmount,
                        credit: 0,
                        status: swap.status
                    });
                } else if (netAmount < 0) {
                    this.transactions.push({
                        date: swap.date || swap.createdAt,
                        type: 'SWAP',
                        docNo: swap.swapNumber || swap.id,
                        description: `Tukar Tambah (Refund)`,
                        debit: 0,
                        credit: Math.abs(netAmount),
                        status: swap.status
                    });
                }
            }
        });

        // 5. Payments received (from journal entries or receipt vouchers)
        const journals = Storage.get('erp_journals') || [];
        journals.forEach(j => {
            const memo = (j.memo || j.description || '').toLowerCase();
            const customerName = (this.currentCustomer.name || '').toLowerCase();
            if (memo.includes(customerName) || memo.includes(customerCode?.toLowerCase() || '')) {
                // Check if it's a receipt (credit to AR account)
                const arEntry = (j.entries || []).find(e =>
                    (e.accountCode || '').startsWith('1') && e.credit > 0
                );
                if (arEntry) {
                    this.transactions.push({
                        date: j.date,
                        type: 'RCV',
                        docNo: j.journalNumber || j.id,
                        description: `Penerimaan - ${j.memo || ''}`,
                        debit: 0,
                        credit: arEntry.credit,
                        status: 'posted'
                    });
                }
            }
        });

        // 6. Receipt Vouchers (BKM)
        const receiptVouchers = Storage.get('receipt_vouchers') || [];
        receiptVouchers.forEach(rv => {
            if (rv.customerId === customerId || rv.receivedFrom?.includes(this.currentCustomer.name)) {
                this.transactions.push({
                    date: rv.date || rv.createdAt,
                    type: 'BKM',
                    docNo: rv.voucherNumber || rv.id,
                    description: `Bukti Kas Masuk - ${rv.description || ''}`,
                    debit: 0,
                    credit: rv.amount || rv.total || 0,
                    status: rv.status
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
            balance += (t.debit || 0) - (t.credit || 0);
        });
        return balance;
    },

    renderModal() {
        const modalId = 'customer-card-modal';
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
                    <h3 class="modal-title">📋 Kartu Customer: ${this.currentCustomer.name}</h3>
                    <button class="modal-close" onclick="CustomerCard.closeModal()">×</button>
                </div>
                <div class="modal-body">
                    <!-- Customer Info -->
                    <div class="card p-3 mb-3" style="background: #f8fafc;">
                        <div class="grid grid-4 gap-2">
                            <div>
                                <small class="text-gray">Kode</small>
                                <div><strong>${this.currentCustomer.code}</strong></div>
                            </div>
                            <div>
                                <small class="text-gray">Contact</small>
                                <div>${this.currentCustomer.contact || this.currentCustomer.contactPerson || '-'}</div>
                            </div>
                            <div>
                                <small class="text-gray">Telepon</small>
                                <div>${this.currentCustomer.phone || '-'}</div>
                            </div>
                            <div>
                                <small class="text-gray">Status Pajak</small>
                                <div>${this.currentCustomer.taxStatus === 'PKP' ? '<span class="badge badge-success">PKP</span>' : '<span class="badge badge-secondary">Non PKP</span>'}</div>
                            </div>
                        </div>
                    </div>

                    <!-- Date Filter -->
                    <div class="card p-3 mb-3">
                        <div class="flex gap-2 align-center">
                            <label class="form-label mb-0">Periode:</label>
                            <input type="date" id="customer-card-from" class="form-input" style="width: 150px;" value="${this.dateFrom}" onchange="CustomerCard.filterByDate()">
                            <span>s/d</span>
                            <input type="date" id="customer-card-to" class="form-input" style="width: 150px;" value="${this.dateTo}" onchange="CustomerCard.filterByDate()">
                            <button class="btn btn-secondary btn-sm" onclick="CustomerCard.exportToCSV()">📄 Export CSV</button>
                            <button class="btn btn-secondary btn-sm" onclick="CustomerCard.print()">🖨️ Print</button>
                        </div>
                    </div>

                    <!-- Summary -->
                    <div class="grid grid-2 gap-2 mb-3">
                        <!-- Financial Balance -->
                        <div class="card p-3 text-center" style="background: ${balance > 0 ? '#fef3c7' : '#ecfdf5'}; border-color: ${balance > 0 ? '#f59e0b' : '#10b981'};">
                            <small class="text-gray">Saldo Piutang (Rp)</small>
                            <div class="text-lg font-bold" style="color: ${balance > 0 ? '#f59e0b' : '#10b981'};">${this.formatCurrency(balance)}</div>
                        </div>
                        
                        <!-- Gold Balance -->
                        ${(typeof GoldSavings !== 'undefined' && GoldSavings.getBalance) ? (() => {
                const goldBal = GoldSavings.getBalance(this.currentCustomer.id);
                const isOwed = goldBal < 0; // Negative means customer owes us
                const goldColor = isOwed ? '#ef4444' : '#10b981';
                const bg = isOwed ? '#fef2f2' : '#f0fdf4';
                return `
                                <div class="card p-3 text-center" style="background: ${bg}; border-color: ${goldColor};">
                                    <small class="text-gray">Saldo Emas (Gram)</small>
                                    <div class="text-lg font-bold" style="color: ${goldColor};">
                                        ${goldBal.toFixed(3)} g
                                        <div class="text-xs text-gray">${isOwed ? '(Hutang Customer)' : '(Simpanan Customer)'}</div>
                                    </div>
                                </div>
                            `;
            })() : ''}
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
            runningBalance += (t.debit || 0) - (t.credit || 0);
            const typeColors = {
                'SO': 'badge-primary',
                'DO': 'badge-info',
                'INV': 'badge-warning',
                'SWAP': 'badge-purple',
                'RCV': 'badge-success',
                'BKM': 'badge-success'
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
        this.dateFrom = document.getElementById('customer-card-from').value;
        this.dateTo = document.getElementById('customer-card-to').value;
        this.loadTransactions();
        this.renderModal();
    },

    closeModal() {
        const modal = document.getElementById('customer-card-modal');
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

        let csv = `Kartu Customer: ${this.currentCustomer.name}\n`;
        csv += `Periode: ${this.dateFrom} s/d ${this.dateTo}\n\n`;
        csv += headers.join(',') + '\n';
        rows.forEach(row => {
            csv += row.map(cell => `"${cell}"`).join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `kartu-customer-${this.currentCustomer.code}-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    },

    print() {
        const printContent = document.querySelector('#customer-card-modal .modal-body').innerHTML;
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
            <head>
                <title>Kartu Customer - ${this.currentCustomer.name}</title>
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
                <h2>Kartu Customer: ${this.currentCustomer.name}</h2>
                ${printContent}
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    }
};

window.CustomerCard = CustomerCard;
