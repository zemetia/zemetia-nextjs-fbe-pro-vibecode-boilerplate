// ==========================================
// Production WIP (Work in Progress) Report
// Track all active production orders
// ==========================================

const ProductionWIP = {
    init() {
        if (!Auth.isAuthenticated()) {
            window.location.href = 'login.html';
            return;
        }

        this.render();
    },

    getWIPData() {
        const productionOrders = Storage.get(Storage.KEYS.PRODUCTION_ORDERS) || [];

        // Filter for in-progress orders
        const wipOrders = productionOrders.filter(order =>
            order.status === 'in-progress' || order.status === 'pending'
        );

        return wipOrders.map(order => {
            const startDate = new Date(order.startDate);
            const today = new Date();
            const daysInProgress = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));

            return {
                ...order,
                daysInProgress,
                estimatedValue: this.calculateOrderValue(order)
            };
        }).sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
    },

    calculateOrderValue(order) {
        // Calculate based on materials used
        const materials = order.materials || [];
        return materials.reduce((sum, mat) => sum + (mat.quantity * (mat.unitCost || 0)), 0);
    },

    getStatusBadge(status) {
        const badges = {
            'pending': '<span class="badge badge-warning">⏳ Pending</span>',
            'in-progress': '<span class="badge badge-primary">🔄 In Progress</span>',
            'completed': '<span class="badge badge-success">✅ Completed</span>',
            'cancelled': '<span class="badge badge-error">❌ Cancelled</span>'
        };
        return badges[status] || '<span class="badge badge-secondary">' + status + '</span>';
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
        const wipData = this.getWIPData();
        const totalWIPValue = wipData.reduce((sum, item) => sum + item.estimatedValue, 0);

        content.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">🏭 Production WIP Report</h1>
        <p class="page-description">Work in progress tracking - All active production orders</p>
      </div>

      <div class="card mb-3">
        <div class="card-header">
          <div>
            <h2 class="card-title">Active Production Orders</h2>
            <p class="text-gray">Total WIP Value: ${this.formatCurrency(totalWIPValue)} | ${wipData.length} Active Orders</p>
          </div>
          <button class="btn btn-primary" onclick="ProductionWIP.exportPDF()">
            📥 Export PDF
          </button>
        </div>
        <div class="card-body">
          ${wipData.length === 0 ? `
            <div class="text-center" style="padding: var(--spacing-2xl);">
              <div style="font-size: 3rem; margin-bottom: var(--spacing-lg);">🏭</div>
              <p style="font-size: var(--font-size-lg); margin-bottom: var(--spacing-sm); font-weight: 600;">
                No Active Production Orders
              </p>
              <p class="text-gray">
                All production orders are either completed or not started yet.<br>
                Create a new production order to see WIP tracking.
              </p>
              <button class="btn btn-primary mt-1" onclick="App.navigateTo('production-order')">
                Create Production Order
              </button>
            </div>
          ` : `
            <div class="table-container">
              <table class="table">
                <thead>
                  <tr>
                    <th>Order No</th>
                    <th>Product</th>
                    <th>Status</th>
                    <th>Start Date</th>
                    <th class="text-right">Days in Progress</th>
                    <th class="text-right">Target Qty</th>
                    <th class="text-right">Estimated Value</th>
                    <th class="text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${wipData.map(order => `
                    <tr>
                      <td><strong>${order.orderNumber}</strong></td>
                      <td>${order.productName || order.itemName || 'N/A'}</td>
                      <td>${this.getStatusBadge(order.status)}</td>
                      <td>${new Date(order.startDate).toLocaleDateString('id-ID')}</td>
                      <td class="text-right">
                        ${order.daysInProgress} days
                        ${order.daysInProgress > 30 ? '<span style="color: var(--color-warning);">⚠️</span>' : ''}
                      </td>
                      <td class="text-right">${order.targetQuantity || 'N/A'}</td>
                      <td class="text-right"><strong>${this.formatCurrency(order.estimatedValue)}</strong></td>
                      <td class="text-center">
                        <button class="btn btn-sm btn-secondary" onclick="App.navigateTo('production-order')">
                          View
                        </button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
                <tfoot>
                  <tr style="font-weight: 600; background: var(--bg-tertiary);">
                    <td colspan="6">TOTAL WIP</td>
                    <td class="text-right">${this.formatCurrency(totalWIPValue)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          `}
        </div>
      </div>

      <!-- Summary Cards -->
      ${wipData.length > 0 ? `
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Total Orders</div>
            <div class="stat-value">${wipData.length}</div>
            <div class="stat-change">🏭 Active</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Avg Days in Progress</div>
            <div class="stat-value">${Math.round(wipData.reduce((sum, o) => sum + o.daysInProgress, 0) / wipData.length)}</div>
            <div class="stat-change">📅 Days</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Total WIP Value</div>
            <div class="stat-value">${this.formatCurrency(totalWIPValue)}</div>
            <div class="stat-change">💰 Invested</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Orders > 30 Days</div>
            <div class="stat-value">${wipData.filter(o => o.daysInProgress > 30).length}</div>
            <div class="stat-change ${wipData.filter(o => o.daysInProgress > 30).length > 0 ? 'negative' : 'positive'}">
              ${wipData.filter(o => o.daysInProgress > 30).length > 0 ? '⚠️ Attention' : '✅ On Track'}
            </div>
          </div>
        </div>
      ` : ''}
    `;
    },

    exportPDF() {
        const data = this.getWIPData();
        const totalValue = data.reduce((sum, item) => sum + item.estimatedValue, 0);

        PDFExporter.exportReport({
            title: 'Production WIP Report',
            subtitle: `Generated on ${new Date().toLocaleDateString('id-ID')}`,
            headers: ['Order No', 'Product', 'Status', 'Start Date', 'Days', 'Target Qty', 'Est. Value'],
            rows: data.map(order => [
                order.orderNumber,
                order.productName || order.itemName || 'N/A',
                order.status,
                new Date(order.startDate).toLocaleDateString('id-ID'),
                order.daysInProgress + ' days',
                order.targetQuantity || 'N/A',
                this.formatCurrency(order.estimatedValue)
            ]),
            footer: `Total WIP Value: ${this.formatCurrency(totalValue)} | ${data.length} Active Orders`
        });
    }
};


// Explicitly make ProductionWIP globally available
window.ProductionWIP = ProductionWIP;
