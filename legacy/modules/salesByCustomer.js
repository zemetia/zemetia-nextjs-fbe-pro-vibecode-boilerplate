// ==========================================
// Sales by Customer Report
// Customer ranking by total sales
// ==========================================

const SalesByCustomer = {
    init() {
        if (!Auth.isAuthenticated()) {
            window.location.href = 'login.html';
            return;
        }

        this.render();
    },

    getSalesData() {
        const entries = Storage.get(Storage.KEYS.JOURNAL_ENTRIES) || [];
        const customers = Storage.get(Storage.KEYS.CUSTOMERS) || [];

        // Group sales by customer
        const salesByCustomer = {};

        entries.forEach(entry => {
            // Look for sales transactions (revenue accounts 4xxx)
            entry.lines.forEach(line => {
                if (line.accountCode && line.accountCode.startsWith('4') && line.credit > 0) {
                    // Try to extract customer from description or reference
                    const customerMatch = entry.description.match(/customer:?\s*(\w+-\d+)/i) ||
                        entry.reference.match(/(\w+-\d+)/);

                    if (customerMatch) {
                        const customerCode = customerMatch[1];
                        const customer = customers.find(c => c.code === customerCode);
                        const customerName = customer ? customer.name : customerCode;

                        if (!salesByCustomer[customerCode]) {
                            salesByCustomer[customerCode] = {
                                code: customerCode,
                                name: customerName,
                                totalSales: 0,
                                transactionCount: 0,
                                avgTransaction: 0
                            };
                        }

                        salesByCustomer[customerCode].totalSales += line.credit;
                        salesByCustomer[customerCode].transactionCount++;
                    }
                }
            });
        });

        // Calculate averages and convert to array
        return Object.values(salesByCustomer)
            .map(item => {
                item.avgTransaction = item.totalSales / item.transactionCount;
                return item;
            })
            .sort((a, b) => b.totalSales - a.totalSales);
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
        const totalSales = data.reduce((sum, item) => sum + item.totalSales, 0);

        content.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">💰 Sales by Customer</h1>
        <p class="page-description">Customer ranking by total sales amount</p>
      </div>

      <div class="card mb-3">
        <div class="card-header">
          <div>
            <h2 class="card-title">Sales Summary</h2>
            <p class="text-gray">Total Sales: ${this.formatCurrency(totalSales)}</p>
          </div>
          <button class="btn btn-primary" onclick="SalesByCustomer.exportPDF()">
            📥 Export PDF
          </button>
        </div>
        <div class="card-body">
          ${data.length === 0 ? `
            <div class="text-center" style="padding: var(--spacing-2xl);">
              <div style="font-size: 3rem; margin-bottom: var(--spacing-lg);">💰</div>
              <p style="font-size: var(--font-size-lg); margin-bottom: var(--spacing-sm); font-weight: 600;">
                Belum Ada Data Penjualan
              </p>
              <p class="text-gray">
                Data akan muncul setelah ada transaksi penjualan.<br>
                Pastikan transaksi mencantumkan kode customer di deskripsi.
              </p>
            </div>
          ` : `
            <div class="table-container">
              <table class="table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Customer Code</th>
                    <th>Customer Name</th>
                    <th class="text-right">Total Sales</th>
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
                      <td class="text-right"><strong>${this.formatCurrency(item.totalSales)}</strong></td>
                      <td class="text-right">${item.transactionCount}</td>
                      <td class="text-right">${this.formatCurrency(item.avgTransaction)}</td>
                      <td class="text-right">${((item.totalSales / totalSales) * 100).toFixed(1)}%</td>
                    </tr>
                  `).join('')}
                </tbody>
                <tfoot>
                  <tr style="font-weight: 600; background: var(--bg-tertiary);">
                    <td colspan="3">TOTAL</td>
                    <td class="text-right">${this.formatCurrency(totalSales)}</td>
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
        const totalSales = data.reduce((sum, item) => sum + item.totalSales, 0);

        PDFExporter.exportReport({
            title: 'Sales by Customer Report',
            subtitle: `Generated on ${new Date().toLocaleDateString('id-ID')}`,
            headers: ['Rank', 'Code', 'Customer Name', 'Total Sales', 'Transactions', 'Avg/Txn', '%'],
            rows: data.map((item, index) => [
                index + 1,
                item.code,
                item.name,
                this.formatCurrency(item.totalSales),
                item.transactionCount,
                this.formatCurrency(item.avgTransaction),
                ((item.totalSales / totalSales) * 100).toFixed(1) + '%'
            ]),
            footer: `Total Sales: ${this.formatCurrency(totalSales)}`
        });
    }
};


// Explicitly make SalesByCustomer globally available
window.SalesByCustomer = SalesByCustomer;
