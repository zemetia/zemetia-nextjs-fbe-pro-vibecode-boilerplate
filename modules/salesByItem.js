// ==========================================
// Sales by Item Report
// Best selling items analysis
// ==========================================

const SalesByItem = {
    init() {
        if (!Auth.isAuthenticated()) {
            window.location.href = 'login.html';
            return;
        }

        this.render();
    },

    getSalesData() {
        const entries = Storage.get(Storage.KEYS.JOURNAL_ENTRIES) || [];
        const items = Storage.get(Storage.KEYS.ITEMS) || [];

        // Group sales by item
        const salesByItem = {};

        entries.forEach(entry => {
            // Look for sales transactions
            if (entry.description && entry.description.toLowerCase().includes('penjualan')) {
                // Try to extract item code from description
                const itemMatch = entry.description.match(/item:?\s*([\w-]+)/i) ||
                    entry.description.match(/(GOLD-[\w-]+|CHEM-[\w-]+|CONS-[\w-]+)/i);

                if (itemMatch) {
                    const itemCode = itemMatch[1];
                    const item = items.find(i => i.code === itemCode);
                    const itemName = item ? item.name : itemCode;

                    // Get revenue amount
                    const revenueLines = entry.lines.filter(l => l.accountCode && l.accountCode.startsWith('4'));
                    const revenue = revenueLines.reduce((sum, l) => sum + l.credit, 0);

                    if (!salesByItem[itemCode]) {
                        salesByItem[itemCode] = {
                            code: itemCode,
                            name: itemName,
                            category: item ? item.category : 'Unknown',
                            totalRevenue: 0,
                            transactionCount: 0
                        };
                    }

                    salesByItem[itemCode].totalRevenue += revenue;
                    salesByItem[itemCode].transactionCount++;
                }
            }
        });

        return Object.values(salesByItem)
            .sort((a, b) => b.totalRevenue - a.totalRevenue);
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
        const data = this.getSalesData();
        const totalRevenue = data.reduce((sum, item) => sum + item.totalRevenue, 0);

        content.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">💰 Sales by Item</h1>
        <p class="page-description">Best selling items analysis</p>
      </div>

      <div class="card mb-3">
        <div class="card-header">
          <div>
            <h2 class="card-title">Product Sales Performance</h2>
            <p class="text-gray">Total Revenue: ${this.formatCurrency(totalRevenue)}</p>
          </div>
          <button class="btn btn-primary" onclick="SalesByItem.exportPDF()">
            📥 Export PDF
          </button>
        </div>
        <div class="card-body">
          ${data.length === 0 ? `
            <div class="text-center" style="padding: var(--spacing-2xl);">
              <div style="font-size: 3rem; margin-bottom: var(--spacing-lg);">📦</div>
              <p style="font-size: var(--font-size-lg); margin-bottom: var(--spacing-sm); font-weight: 600;">
                Belum Ada Data Penjualan Item
              </p>
              <p class="text-gray">
                Data akan muncul setelah ada transaksi penjualan.<br>
                Pastikan transaksi mencantumkan kode item di deskripsi.
              </p>
            </div>
          ` : `
            <div class="table-container">
              <table class="table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Item Code</th>
                    <th>Item Name</th>
                    <th>Category</th>
                    <th class="text-right">Total Revenue</th>
                    <th class="text-right">Transactions</th>
                    <th class="text-right">Avg per Txn</th>
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
                      <td><span class="badge badge-secondary">${item.category}</span></td>
                      <td class="text-right"><strong>${this.formatCurrency(item.totalRevenue)}</strong></td>
                      <td class="text-right">${item.transactionCount}</td>
                      <td class="text-right">${this.formatCurrency(item.totalRevenue / item.transactionCount)}</td>
                      <td class="text-right">${((item.totalRevenue / totalRevenue) * 100).toFixed(1)}%</td>
                    </tr>
                  `).join('')}
                </tbody>
                <tfoot>
                  <tr style="font-weight: 600; background: var(--bg-tertiary);">
                    <td colspan="4">TOTAL</td>
                    <td class="text-right">${this.formatCurrency(totalRevenue)}</td>
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
        const data = this.getSalesData();
        const totalRevenue = data.reduce((sum, item) => sum + item.totalRevenue, 0);

        PDFExporter.exportReport({
            title: 'Sales by Item Report',
            subtitle: `Generated on ${new Date().toLocaleDateString('id-ID')}`,
            headers: ['Rank', 'Code', 'Item Name', 'Category', 'Revenue', 'Txn', 'Avg', '%'],
            rows: data.map((item, index) => [
                index + 1,
                item.code,
                item.name,
                item.category,
                this.formatCurrency(item.totalRevenue),
                item.transactionCount,
                this.formatCurrency(item.totalRevenue / item.transactionCount),
                ((item.totalRevenue / totalRevenue) * 100).toFixed(1) + '%'
            ]),
            footer: `Total Revenue: ${this.formatCurrency(totalRevenue)}`
        });
    }
};


// Explicitly make SalesByItem globally available
window.SalesByItem = SalesByItem;
