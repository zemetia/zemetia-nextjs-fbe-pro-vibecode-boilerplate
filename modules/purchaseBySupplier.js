// ==========================================
// Purchase by Supplier Report
// Supplier analysis by total purchases
// ==========================================

const PurchaseBySupplier = {
    init() {
        if (!Auth.isAuthenticated()) {
            window.location.href = 'login.html';
            return;
        }

        this.render();
    },

    getPurchaseData() {
        const entries = Storage.get(Storage.KEYS.JOURNAL_ENTRIES) || [];
        const suppliers = Storage.get(Storage.KEYS.SUPPLIERS) || [];

        // Group purchases by supplier
        const purchaseBySupplier = {};

        entries.forEach(entry => {
            if (entry.description && entry.description.toLowerCase().includes('pembelian')) {
                // Try to extract supplier code
                const supplierMatch = entry.description.match(/supplier:?\s*(\w+-\d+)/i) ||
                    entry.reference.match(/(\w+-\d+)/);

                if (supplierMatch) {
                    const supplierCode = supplierMatch[1];
                    const supplier = suppliers.find(s => s.code === supplierCode);
                    const supplierName = supplier ? supplier.name : supplierCode;

                    // Get expense amount (debit to expense/inventory accounts)
                    const expenseLines = entry.lines.filter(l =>
                        l.accountCode && (l.accountCode.startsWith('5') || l.accountCode.startsWith('1'))
                    );
                    const amount = expenseLines.reduce((sum, l) => sum + l.debit, 0);

                    if (!purchaseBySupplier[supplierCode]) {
                        purchaseBySupplier[supplierCode] = {
                            code: supplierCode,
                            name: supplierName,
                            totalPurchases: 0,
                            transactionCount: 0
                        };
                    }

                    purchaseBySupplier[supplierCode].totalPurchases += amount;
                    purchaseBySupplier[supplierCode].transactionCount++;
                }
            }
        });

        return Object.values(purchaseBySupplier)
            .sort((a, b) => b.totalPurchases - a.totalPurchases);
    },

    formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    },

    render() {
        const content = document.getElementById('main-content');
        const data = this.getPurchaseData();
        const totalPurchases = data.reduce((sum, item) => sum + item.totalPurchases, 0);

        content.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">🛒 Purchase by Supplier</h1>
        <p class="page-description">Supplier ranking by total purchase amount</p>
      </div>

      <div class="card mb-3">
        <div class="card-header">
          <div>
            <h2 class="card-title">Supplier Analysis</h2>
            <p class="text-gray">Total Purchases: ${this.formatCurrency(totalPurchases)}</p>
          </div>
          <button class="btn btn-primary" onclick="PurchaseBySupplier.exportPDF()">
            📥 Export PDF
          </button>
        </div>
        <div class="card-body">
          ${data.length === 0 ? `
            <div class="text-center" style="padding: var(--spacing-2xl);">
              <div style="font-size: 3rem; margin-bottom: var(--spacing-lg);">🛒</div>
              <p style="font-size: var(--font-size-lg); margin-bottom: var(--spacing-sm); font-weight: 600;">
                Belum Ada Data Pembelian
              </p>
              <p class="text-gray">
                Data akan muncul setelah ada transaksi pembelian.<br>
                Pastikan transaksi mencantumkan kode supplier di deskripsi.
              </p>
            </div>
          ` : `
            <div class="table-container">
              <table class="table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Supplier Code</th>
                    <th>Supplier Name</th>
                    <th class="text-right">Total Purchases</th>
                    <th class="text-right">Transactions</th>
                    <th class="text-right">Avg per Transaction</th>
                    <th class="text-right">% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.map((item, index) => `
                    <tr>
                      <td>
                        ${index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                      </td>
                      <td><strong>${item.code}</strong></td>
                      <td>${item.name}</td>
                      <td class="text-right"><strong>${this.formatCurrency(item.totalPurchases)}</strong></td>
                      <td class="text-right">${item.transactionCount}</td>
                      <td class="text-right">${this.formatCurrency(item.totalPurchases / item.transactionCount)}</td>
                      <td class="text-right">${((item.totalPurchases / totalPurchases) * 100).toFixed(1)}%</td>
                    </tr>
                  `).join('')}
                </tbody>
                <tfoot>
                  <tr style="font-weight: 600; background: var(--bg-tertiary);">
                    <td colspan="3">TOTAL</td>
                    <td class="text-right">${this.formatCurrency(totalPurchases)}</td>
                    <td class="text-right">${data.reduce((sum, item) => sum + item.transactionCount, 0)}</td>
                    <td class="text-right">-</td>
                    <td class="text-right">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          `}
        </div>
      </div>
    `;
    },

    exportPDF() {
        const data = this.getPurchaseData();
        const totalPurchases = data.reduce((sum, item) => sum + item.totalPurchases, 0);

        PDFExporter.exportReport({
            title: 'Purchase by Supplier Report',
            subtitle: `Generated on ${new Date().toLocaleDateString('id-ID')}`,
            headers: ['Rank', 'Code', 'Supplier Name', 'Total Purchases', 'Transactions', 'Avg/Txn', '%'],
            rows: data.map((item, index) => [
                index + 1,
                item.code,
                item.name,
                this.formatCurrency(item.totalPurchases),
                item.transactionCount,
                this.formatCurrency(item.totalPurchases / item.transactionCount),
                ((item.totalPurchases / totalPurchases) * 100).toFixed(1) + '%'
            ]),
            footer: `Total Purchases: ${this.formatCurrency(totalPurchases)}`
        });
    }
};


// Explicitly make PurchaseBySupplier globally available
window.PurchaseBySupplier = PurchaseBySupplier;
