// ==========================================
// Risk Assessment Module (Director Only)
// Financial and operational risk visualization
// ==========================================

const RiskAssessment = {
    // Render risk graph widget (Director only)
    renderRiskGraph(user) {
        if (!user || (user.role !== 'DIRECTOR' && user.role !== 'director')) {
            return '';
        }

        return `
      <div class="card mb-3" style="background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);">
        <div class="card-header">
          <h2 class="card-title">📊 Risk Assessment Dashboard</h2>
          <p style="color: #666; font-size: 14px; margin-top: 8px;">
            Executive view of financial and operational risks
          </p>
        </div>
        <div class="card-body">
          <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 24px;">
            <div style="position: relative; height: 400px;">
              <canvas id="riskChart"></canvas>
            </div>
            <div id="riskSummary" style="display: flex; flex-direction: column; gap: 16px;"></div>
          </div>
        </div>
      </div>
    `;
    },

    // Initialize risk chart
    initializeRiskGraph() {
        const chartElement = document.getElementById('riskChart');
        if (!chartElement || typeof Chart === 'undefined') {
            console.warn('Risk Chart: Chart.js not loaded or canvas not found');
            return;
        }

        const risks = this.calculateRisks();

        const ctx = chartElement.getContext('2d');
        new Chart(ctx, {
            type: 'radar',
            data: {
                labels: ['Cash Flow', 'Debt Ratio', 'Inventory', 'Receivables', 'Low Stock', 'Pending Approvals', 'Supplier Payments', 'Production'],
                datasets: [{
                    label: 'Risk Level (%)',
                    data: [risks.cashFlow, risks.debtRatio, risks.inventory, risks.receivables, risks.lowStock, risks.pendingApprovals, risks.supplierPayments, risks.production],
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 2,
                    pointBackgroundColor: 'rgba(255, 99, 132, 1)',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: 'rgba(255, 99, 132, 1)',
                    pointRadius: 5,
                    pointHoverRadius: 7
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            stepSize: 20,
                            callback: function (value) { return value + '%'; }
                        },
                        pointLabels: {
                            font: { size: 12 }
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                return context.label + ': ' + context.parsed.r.toFixed(0) + '% risk';
                            }
                        }
                    }
                }
            }
        });

        this.renderRiskSummary(risks);
    },

    // Calculate all risk metrics
    calculateRisks() {
        const accounts = Storage.get(Storage.KEYS.CHART_OF_ACCOUNTS) || [];
        const items = Storage.getItems();

        return {
            cashFlow: this.calculateCashFlowRisk(accounts),
            debtRatio: this.calculateDebtRatioRisk(accounts),
            inventory: this.calculateInventoryRisk(items),
            receivables: this.calculateReceivablesRisk(accounts),
            lowStock: this.calculateLowStockRisk(items),
            pendingApprovals: this.calculatePendingApprovalsRisk(),
            supplierPayments: this.calculateSupplierPaymentsRisk(accounts),
            production: this.calculateProductionRisk()
        };
    },

    // Cash flow risk calculation
    calculateCashFlowRisk(accounts) {
        const cashAccounts = ['1110', '1120', '1121', '1122', '1123'];
        let totalCash = 0;

        cashAccounts.forEach(code => {
            const account = accounts.find(a => a.code === code);
            if (account) totalCash += account.balance || 0;
        });

        // Risk thresholds
        if (totalCash < 10000000) return 90;   // < Rp 10M = Critical
        if (totalCash < 30000000) return 60;   // < Rp 30M = High
        if (totalCash < 50000000) return 30;   // < Rp 50M = Medium
        return 10;                              // >= Rp 50M = Low
    },

    // Debt ratio risk calculation
    calculateDebtRatioRisk(accounts) {
        const totalLiabilities = accounts
            .filter(a => a.category === 'kewajiban' && a.type === 'detail')
            .reduce((sum, a) => sum + (a.balance || 0), 0);

        const totalEquity = accounts
            .filter(a => a.category === 'ekuitas' && a.type === 'detail')
            .reduce((sum, a) => sum + (a.balance || 0), 0);

        if (totalEquity === 0) return 100; // No equity = maximum risk

        const ratio = totalLiabilities / totalEquity;
        if (ratio > 2.0) return 85;
        if (ratio > 1.5) return 65;
        if (ratio > 1.0) return 40;
        return 15;
    },

    // Inventory risk calculation
    calculateInventoryRisk(items) {
        const inventoryItems = items.filter(i => i.trackStock);
        if (inventoryItems.length === 0) return 0;

        const totalValue = inventoryItems.reduce((sum, item) => {
            return sum + ((item.currentStock || 0) * (item.standardCost || 0));
        }, 0);

        if (totalValue > 500000000) return 70;  // > Rp 500M
        if (totalValue > 200000000) return 40;  // > Rp 200M
        return 20;
    },

    // Receivables risk calculation
    calculateReceivablesRisk(accounts) {
        const arAccount = accounts.find(a => a.code === '1130' || a.code === '1131');
        const arBalance = arAccount ? (arAccount.balance || 0) : 0;

        if (arBalance > 100000000) return 75;  // > Rp 100M
        if (arBalance > 50000000) return 45;   // > Rp 50M
        return 20;
    },

    // Low stock risk calculation
    calculateLowStockRisk(items) {
        const trackableItems = items.filter(i => i.trackStock && i.reorderPoint);
        if (trackableItems.length === 0) return 0;

        let lowStockCount = 0;
        trackableItems.forEach(item => {
            if ((item.currentStock || 0) < (item.reorderPoint || 0)) {
                lowStockCount++;
            }
        });

        const percentage = (lowStockCount / trackableItems.length) * 100;
        return Math.min(percentage, 100);
    },

    // Pending approvals risk calculation
    calculatePendingApprovalsRisk() {
        const paymentVouchers = Storage.get('payment_vouchers') || [];
        const pendingCount = paymentVouchers.filter(v =>
            v.status === 'pending_finance' ||
            v.status === 'pending_director'
        ).length;

        if (pendingCount > 20) return 80;
        if (pendingCount > 10) return 50;
        if (pendingCount > 5) return 25;
        return 10;
    },

    // Supplier payments risk calculation
    calculateSupplierPaymentsRisk(accounts) {
        const apAccount = accounts.find(a => a.code === '2110' || a.code === '2111');
        const apBalance = apAccount ? (apAccount.balance || 0) : 0;

        if (apBalance > 200000000) return 80;  // > Rp 200M
        if (apBalance > 100000000) return 50;  // > Rp 100M
        return 20;
    },

    // Production risk calculation
    calculateProductionRisk() {
        const workOrders = Storage.get('work_orders') || [];
        const delayedOrders = workOrders.filter(wo => {
            if (!wo.dueDate) return false;
            const dueDate = new Date(wo.dueDate);
            const today = new Date();
            return dueDate < today && wo.status !== 'completed';
        }).length;

        if (delayedOrders > 10) return 85;
        if (delayedOrders > 5) return 55;
        if (delayedOrders > 0) return 30;
        return 10;
    },

    // Render risk summary panel
    renderRiskSummary(risks) {
        const summaryElement = document.getElementById('riskSummary');
        if (!summaryElement) return;

        const riskArray = [
            { name: 'Cash Flow', value: risks.cashFlow },
            { name: 'Debt Ratio', value: risks.debtRatio },
            { name: 'Inventory', value: risks.inventory },
            { name: 'Receivables', value: risks.receivables },
            { name: 'Low Stock', value: risks.lowStock },
            { name: 'Pending Approvals', value: risks.pendingApprovals },
            { name: 'Supplier Payments', value: risks.supplierPayments },
            { name: 'Production', value: risks.production }
        ];

        const avgRisk = riskArray.reduce((sum, r) => sum + r.value, 0) / riskArray.length;
        const highRisks = riskArray.filter(r => r.value > 60);
        const mediumRisks = riskArray.filter(r => r.value > 30 && r.value <= 60);
        const lowRisks = riskArray.filter(r => r.value <= 30);

        summaryElement.innerHTML = `
      <div style="background: white; padding: 16px; border-radius: 8px; border-left: 4px solid ${avgRisk > 60 ? '#f5576c' : avgRisk > 30 ? '#ffa726' : '#43e97b'};">
        <h3 style="margin: 0 0 8px 0; font-size: 16px;">Overall Risk Score</h3>
        <div style="font-size: 32px; font-weight: bold; color: ${avgRisk > 60 ? '#f5576c' : avgRisk > 30 ? '#ffa726' : '#43e97b'};">
          ${avgRisk.toFixed(0)}%
        </div>
        <div style="font-size: 12px; color: #666; margin-top: 4px;">
          ${avgRisk > 60 ? '🔴 High Risk' : avgRisk > 30 ? '🟡 Medium Risk' : '🟢 Low Risk'}
        </div>
      </div>

      <div style="background: white; padding: 16px; border-radius: 8px;">
        <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600;">Risk Breakdown</h3>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 12px;">🔴 High</span>
            <span style="font-weight: bold; color: #f5576c;">${highRisks.length}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 12px;">🟡 Medium</span>
            <span style="font-weight: bold; color: #ffa726;">${mediumRisks.length}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 12px;">🟢 Low</span>
            <span style="font-weight: bold; color: #43e97b;">${lowRisks.length}</span>
          </div>
        </div>
      </div>

      <div style="background: white; padding: 16px; border-radius: 8px;">
        <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600;">Top Risks</h3>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${riskArray
                .sort((a, b) => b.value - a.value)
                .slice(0, 3)
                .map(risk => `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: #f5f5f5; border-radius: 4px;">
                <span style="font-size: 12px;">${risk.name}</span>
                <span style="font-weight: bold; color: ${risk.value > 60 ? '#f5576c' : risk.value > 30 ? '#ffa726' : '#43e97b'};">
                  ${risk.value.toFixed(0)}%
                </span>
              </div>
            `).join('')}
        </div>
      </div>
    `;
    }
};


// Explicitly make RiskAssessment globally available
window.RiskAssessment = RiskAssessment;
