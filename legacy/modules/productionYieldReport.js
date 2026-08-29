// ==========================================
// Production Yield Analysis Report
// Input vs output analysis for gold refining
// ==========================================

const ProductionYieldReport = {
    init() {
        if (!Auth.isAuthenticated()) {
            window.location.href = 'login.html';
            return;
        }

        this.render();
    },

    getYieldData() {
        const productionOrders = Storage.get(Storage.KEYS.PRODUCTION_ORDERS) || [];

        // Filter completed orders only
        const completedOrders = productionOrders.filter(order => order.status === 'completed');

        return completedOrders.map(order => {
            const inputWeight = this.calculateInputWeight(order);
            const outputWeight = order.actualQuantity || order.targetQuantity || 0;
            const yieldPercentage = inputWeight > 0 ? (outputWeight / inputWeight) * 100 : 0;
            const loss = inputWeight - outputWeight;
            const lossPercentage = inputWeight > 0 ? (loss / inputWeight) * 100 : 0;

            return {
                orderNumber: order.orderNumber,
                productName: order.productName || order.itemName || 'N/A',
                completionDate: order.completionDate || order.startDate,
                inputWeight,
                outputWeight,
                loss,
                yieldPercentage,
                lossPercentage,
                efficiency: yieldPercentage >= 95 ? 'Excellent' : yieldPercentage >= 90 ? 'Good' : yieldPercentage >= 85 ? 'Fair' : 'Poor'
            };
        }).sort((a, b) => new Date(b.completionDate) - new Date(a.completionDate));
    },

    calculateInputWeight(order) {
        // Sum up all material inputs
        const materials = order.materials || [];
        return materials.reduce((sum, mat) => sum + (mat.quantity || 0), 0);
    },

    getEfficiencyBadge(efficiency) {
        const badges = {
            'Excellent': '<span class="badge badge-success">🌟 Excellent</span>',
            'Good': '<span class="badge badge-primary">👍 Good</span>',
            'Fair': '<span class="badge badge-warning">⚠️ Fair</span>',
            'Poor': '<span class="badge badge-error">❌ Poor</span>'
        };
        return badges[efficiency] || '<span class="badge badge-secondary">' + efficiency + '</span>';
    },

    formatWeight(grams) {
        return `${grams.toFixed(3)} g`;
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
        const yieldData = this.getYieldData();

        const avgYield = yieldData.length > 0
            ? yieldData.reduce((sum, item) => sum + item.yieldPercentage, 0) / yieldData.length
            : 0;
        const totalInput = yieldData.reduce((sum, item) => sum + item.inputWeight, 0);
        const totalOutput = yieldData.reduce((sum, item) => sum + item.outputWeight, 0);
        const totalLoss = yieldData.reduce((sum, item) => sum + item.loss, 0);

        content.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">⚜️ Production Yield Analysis</h1>
        <p class="page-description">Input vs output efficiency for gold refining operations</p>
      </div>

      <!-- Summary Stats -->
      ${yieldData.length > 0 ? `
        <div class="stats-grid mb-3">
          <div class="stat-card" style="border-left: 4px solid #FFD700;">
            <div class="stat-label">Average Yield</div>
            <div class="stat-value" style="color: ${avgYield >= 90 ? 'var(--color-success)' : 'var(--color-warning)'};">
              ${avgYield.toFixed(2)}%
            </div>
            <div class="stat-change ${avgYield >= 90 ? 'positive' : 'negative'}">
              ${avgYield >= 90 ? '✅ Excellent' : '⚠️ Need Improvement'}
            </div>
          </div>
          <div class="stat-card" style="border-left: 4px solid #4facfe;">
            <div class="stat-label">Total Input</div>
            <div class="stat-value">${this.formatWeight(totalInput)}</div>
            <div class="stat-change">📥 Raw Material</div>
          </div>
          <div class="stat-card" style="border-left: 4px solid #43e97b;">
            <div class="stat-label">Total Output</div>
            <div class="stat-value">${this.formatWeight(totalOutput)}</div>
            <div class="stat-change positive">✨ Refined Gold</div>
          </div>
          <div class="stat-card" style="border-left: 4px solid #f5576c;">
            <div class="stat-label">Total Loss</div>
            <div class="stat-value">${this.formatWeight(totalLoss)}</div>
            <div class="stat-change negative">${((totalLoss / totalInput) * 100).toFixed(2)}% Loss</div>
          </div>
        </div>
      ` : ''}

      <div class="card mb-3">
        <div class="card-header">
          <div>
            <h2 class="card-title">Yield Performance by Order</h2>
            <p class="text-gray">${yieldData.length} Completed Production Orders</p>
          </div>
          <button class="btn btn-primary" onclick="ProductionYieldReport.exportPDF()">
            📥 Export PDF
          </button>
        </div>
        <div class="card-body">
          ${yieldData.length === 0 ? `
            <div class="text-center" style="padding: var(--spacing-2xl);">
              <div style="font-size: 3rem; margin-bottom: var(--spacing-lg);">⚜️</div>
              <p style="font-size: var(--font-size-lg); margin-bottom: var(--spacing-sm); font-weight: 600;">
                No Completed Production Yet
              </p>
              <p class="text-gray">
                Yield analysis will appear after production orders are completed.<br>
                Complete production orders to track efficiency metrics.
              </p>
            </div>
          ` : `
            <div class="table-container">
              <table class="table">
                <thead>
                  <tr>
                    <th>Order No</th>
                    <th>Product</th>
                    <th>Completion Date</th>
                    <th class="text-right">Input (g)</th>
                    <th class="text-right">Output (g)</th>
                    <th class="text-right">Loss (g)</th>
                    <th class="text-right">Yield %</th>
                    <th class="text-right">Loss %</th>
                    <th>Efficiency</th>
                  </tr>
                </thead>
                <tbody>
                  ${yieldData.map(item => `
                    <tr>
                      <td><strong>${item.orderNumber}</strong></td>
                      <td>${item.productName}</td>
                      <td>${new Date(item.completionDate).toLocaleDateString('id-ID')}</td>
                      <td class="text-right">${this.formatWeight(item.inputWeight)}</td>
                      <td class="text-right"><strong>${this.formatWeight(item.outputWeight)}</strong></td>
                      <td class="text-right" style="color: var(--color-error);">${this.formatWeight(item.loss)}</td>
                      <td class="text-right" style="color: ${item.yieldPercentage >= 90 ? 'var(--color-success)' : 'var(--color-warning)'};">
                        <strong>${item.yieldPercentage.toFixed(2)}%</strong>
                      </td>
                      <td class="text-right">${item.lossPercentage.toFixed(2)}%</td>
                      <td>${this.getEfficiencyBadge(item.efficiency)}</td>
                    </tr>
                  `).join('')}
                </tbody>
                <tfoot>
                  <tr style="font-weight: 600; background: var(--bg-tertiary);">
                    <td colspan="3">TOTAL / AVERAGE</td>
                    <td class="text-right">${this.formatWeight(totalInput)}</td>
                    <td class="text-right">${this.formatWeight(totalOutput)}</td>
                    <td class="text-right">${this.formatWeight(totalLoss)}</td>
                    <td class="text-right">${avgYield.toFixed(2)}%</td>
                    <td class="text-right">${((totalLoss / totalInput) * 100).toFixed(2)}%</td>
                    <td>-</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          `}
        </div>
      </div>

      <!-- Efficiency Distribution -->
      ${yieldData.length > 0 ? `
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">📊 Efficiency Distribution</h2>
          </div>
          <div class="card-body">
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;">
              ${['Excellent', 'Good', 'Fair', 'Poor'].map(level => {
            const count = yieldData.filter(item => item.efficiency === level).length;
            const percentage = (count / yieldData.length) * 100;
            return `
                  <div style="text-align: center; padding: 16px; background: var(--bg-tertiary); border-radius: 8px;">
                    <div style="font-size: 2rem; margin-bottom: 8px;">
                      ${level === 'Excellent' ? '🌟' : level === 'Good' ? '👍' : level === 'Fair' ? '⚠️' : '❌'}
                    </div>
                    <div style="font-weight: 600; margin-bottom: 4px;">${level}</div>
                    <div style="font-size: 1.5rem; color: var(--color-primary);">${count}</div>
                    <div class="text-gray" style="font-size: 0.9rem;">${percentage.toFixed(1)}%</div>
                  </div>
                `;
        }).join('')}
            </div>
          </div>
        </div>
      ` : ''}
    `;
    },

    exportPDF() {
        const data = this.getYieldData();
        const avgYield = data.length > 0
            ? data.reduce((sum, item) => sum + item.yieldPercentage, 0) / data.length
            : 0;

        PDFExporter.exportReport({
            title: 'Production Yield Analysis Report',
            subtitle: `Generated on ${new Date().toLocaleDateString('id-ID')}`,
            headers: ['Order', 'Product', 'Date', 'Input (g)', 'Output (g)', 'Loss (g)', 'Yield %', 'Efficiency'],
            rows: data.map(item => [
                item.orderNumber,
                item.productName,
                new Date(item.completionDate).toLocaleDateString('id-ID'),
                this.formatWeight(item.inputWeight),
                this.formatWeight(item.outputWeight),
                this.formatWeight(item.loss),
                item.yieldPercentage.toFixed(2) + '%',
                item.efficiency
            ]),
            footer: `Average Yield: ${avgYield.toFixed(2)}% | ${data.length} Completed Orders`
        });
    }
};


// Explicitly make ProductionYieldReport globally available
window.ProductionYieldReport = ProductionYieldReport;
