// ==========================================
// Production Reports Suite
// Comprehensive production analytics
// ==========================================

// ==========================================
// 1. Production Orders Status Report
// ==========================================

const ProductionOrdersReport = {
    orders: [],
    statusFilter: 'ALL',

    init() {
        if (!Auth.isAuthenticated()) {
            window.location.href = 'login.html';
            return;
        }

        this.loadData();
        this.render();
    },

    loadData() {
        this.orders = Storage.get(Storage.KEYS.PRODUCTION_ORDERS) || [];
    },

    render() {
        const content = document.getElementById('main-content');
        content.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">📊 Production Orders Status</h1>
                <p class="page-description">Track all production batches and their current status</p>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Filter by Status</label>
                            <select class="form-select" onchange="ProductionOrdersReport.statusFilter = this.value; ProductionOrdersReport.init();">
                                <option value="ALL">All Statuses</option>
                                <option value="DRAFT" ${this.statusFilter === 'DRAFT' ? 'selected' : ''}>Draft</option>
                                <option value="IN_PROGRESS" ${this.statusFilter === 'IN_PROGRESS' ? 'selected' : ''}>In Progress</option>
                                <option value="COMPLETED" ${this.statusFilter === 'COMPLETED' ? 'selected' : ''}>Completed</option>
                                <option value="CANCELLED" ${this.statusFilter === 'CANCELLED' ? 'selected' : ''}>Cancelled</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            ${this.renderSummaryCards()}

            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">Production Orders (${this.getFilteredOrders().length})</h2>
                    <div class="btn-group">
                        <button class="btn btn-secondary" onclick="ProductionOrdersReport.exportToCSV()">
                            📊 Export CSV
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    ${this.renderTable()}
                </div>
            </div>
        `;
    },

    getFilteredOrders() {
        if (this.statusFilter === 'ALL') return this.orders;
        return this.orders.filter(o => o.status === this.statusFilter);
    },

    renderSummaryCards() {
        const total = this.orders.length;
        const draft = this.orders.filter(o => o.status === 'DRAFT').length;
        const inProgress = this.orders.filter(o => o.status === 'IN_PROGRESS').length;
        const completed = this.orders.filter(o => o.status === 'COMPLETED').length;

        return `
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 16px;">
                <div class="card" style="padding: 16px; background: var(--bg-tertiary);">
                    <div style="font-size: 13px; color: #666;">Total Orders</div>
                    <div style="font-size: 32px; font-weight: bold; color: #1976d2;">${total}</div>
                </div>
                <div class="card" style="padding: 16px; background: hsl(38, 92%, 20%);">
                    <div style="font-size: 13px; color: #666;">Draft</div>
                    <div style="font-size: 32px; font-weight: bold; color: #f57c00;">${draft}</div>
                </div>
                <div class="card" style="padding: 16px; background: #e8f5e9;">
                    <div style="font-size: 13px; color: #666;">In Progress</div>
                    <div style="font-size: 32px; font-weight: bold; color: #388e3c;">${inProgress}</div>
                </div>
                <div class="card" style="padding: 16px; background: hsl(291, 47%, 20%);">
                    <div style="font-size: 13px; color: #666;">Completed</div>
                    <div style="font-size: 32px; font-weight: bold; color: #7b1fa2;">${completed}</div>
                </div>
            </div>
        `;
    },

    renderTable() {
        const filtered = this.getFilteredOrders();
        if (filtered.length === 0) {
            return '<p class="text-center text-gray">No orders found</p>';
        }

        return `
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Batch #</th>
                            <th>Product</th>
                            <th class="text-center">Qty</th>
                            <th>Stage</th>
                            <th>Status</th>
                            <th>Start Date</th>
                            <th>Target Date</th>
                            <th>Completion</th>
                            <th class="text-right">Total Cost</th>
                            <th class="text-center">Progress</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.map(order => {
            const progress = this.calculateProgress(order);
            const isOverdue = this.isOverdue(order);
            return `
                                <tr>
                                    <td><strong>${order.batchNumber}</strong></td>
                                    <td>${order.productName}</td>
                                    <td class="text-center">${order.quantity}g</td>
                                    <td><span class="badge badge-secondary">${order.currentStage || 'NOT STARTED'}</span></td>
                                    <td><span class="badge badge-${this.getStatusBadge(order.status)}">${order.status}</span></td>
                                    <td>${new Date(order.startDate).toLocaleDateString('id-ID')}</td>
                                    <td ${isOverdue ? 'style="color: #d32f2f; font-weight: bold;"' : ''}>
                                        ${new Date(order.targetCompletionDate).toLocaleDateString('id-ID')}
                                        ${isOverdue ? '⚠️' : ''}
                                    </td>
                                    <td>${order.actualCompletionDate ? new Date(order.actualCompletionDate).toLocaleDateString('id-ID') : '-'}</td>
                                    <td class="text-right">${this.formatCurrency(order.totalCost || 0)}</td>
                                    <td class="text-center">
                                        <div style="width: 100%; background: var(--bg-secondary); height: 20px; border-radius: 4px; overflow: hidden;">
                                            <div style="width: ${progress}%; background: ${progress === 100 ? '#4caf50' : '#2196f3'}; height: 100%; text-align: center; line-height: 20px; color: white; font-size: 11px;">
                                                ${progress}%
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            `;
        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    calculateProgress(order) {
        if (order.status === 'COMPLETED') return 100;
        if (order.status === 'DRAFT' || !order.currentStage) return 0;

        const bom = BOMManagement.getBOMByProduct(order.productCode);
        if (!bom) return 0;

        const stageIndex = bom.stages.indexOf(order.currentStage);
        return Math.round(((stageIndex + 1) / bom.stages.length) * 100);
    },

    isOverdue(order) {
        if (order.status === 'COMPLETED') return false;
        const today = new Date();
        const target = new Date(order.targetCompletionDate);
        return today > target;
    },

    getStatusBadge(status) {
        const map = {
            'DRAFT': 'secondary',
            'IN_PROGRESS': 'primary',
            'COMPLETED': 'success',
            'CANCELLED': 'danger'
        };
        return map[status] || 'secondary';
    },

    formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    },

    exportToCSV() {
        const headers = ['Batch', 'Product', 'Qty', 'Stage', 'Status', 'Start', 'Target', 'Completion', 'Cost', 'Progress'];
        const rows = this.getFilteredOrders().map(o => [
            o.batchNumber,
            o.productName,
            o.quantity,
            o.currentStage || 'NOT STARTED',
            o.status,
            new Date(o.startDate).toLocaleDateString('id-ID'),
            new Date(o.targetCompletionDate).toLocaleDateString('id-ID'),
            o.actualCompletionDate ? new Date(o.actualCompletionDate).toLocaleDateString('id-ID') : '-',
            o.totalCost || 0,
            this.calculateProgress(o)
        ]);

        let csv = `Production Orders Status Report\n\n`;
        csv += headers.join(',') + '\n';
        rows.forEach(row => {
            csv += row.map(cell => `"${cell}"`).join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `production-orders-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }
};

// ==========================================
// 2. Production Yield Analysis Report
// ==========================================

const ProductionYieldReport = {
    orders: [],

    init() {
        if (!Auth.isAuthenticated()) {
            window.location.href = 'login.html';
            return;
        }

        this.loadData();
        this.render();
    },

    loadData() {
        // Only load completed orders with movements
        this.orders = (Storage.get(Storage.KEYS.PRODUCTION_ORDERS) || [])
            .filter(o => o.status === 'COMPLETED' && o.movements && o.movements.length > 0);
    },

    render() {
        const content = document.getElementById('main-content');
        content.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">📈 Production Yield Analysis</h1>
                <p class="page-description">Analyze input vs output and loss tracking</p>
            </div>

            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">Yield Analysis (${this.orders.length} batches)</h2>
                    <div class="btn-group">
                        <button class="btn btn-secondary" onclick="ProductionYieldReport.exportToCSV()">
                            📊 Export CSV
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    ${this.renderTable()}
                </div>
            </div>
        `;
    },

    renderTable() {
        if (this.orders.length === 0) {
            return '<p class="text-center text-gray">No completed production batches yet</p>';
        }

        return `
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Batch #</th>
                            <th>Product</th>
                            <th class="text-right">Input Weight</th>
                            <th class="text-right">Output Weight</th>
                            <th class="text-right">Total Loss</th>
                            <th class="text-right">Actual Yield</th>
                            <th class="text-right">Standard Yield</th>
                            <th class="text-right">Variance</th>
                            <th>Performance</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.orders.map(order => {
            const analysis = this.analyzeYield(order);
            return `
                                <tr>
                                    <td><strong>${order.batchNumber}</strong></td>
                                    <td>${order.productName}</td>
                                    <td class="text-right">${analysis.inputWeight.toFixed(2)}g</td>
                                    <td class="text-right">${analysis.outputWeight.toFixed(2)}g</td>
                                    <td class="text-right">
                                        <span style="color: ${analysis.totalLoss > analysis.inputWeight * 0.1 ? '#d32f2f' : '#666'}">
                                            ${analysis.totalLoss.toFixed(2)}g (${analysis.lossPercentage.toFixed(2)}%)
                                        </span>
                                    </td>
                                    <td class="text-right"><strong>${analysis.actualYield.toFixed(2)}%</strong></td>
                                    <td class="text-right">${analysis.standardYield.toFixed(2)}%</td>
                                    <td class="text-right">
                                        <span style="color: ${analysis.variance >= 0 ? '#388e3c' : '#d32f2f'}">
                                            ${analysis.variance >= 0 ? '+' : ''}${analysis.variance.toFixed(2)}%
                                        </span>
                                    </td>
                                    <td>
                                        ${this.getPerformanceBadge(analysis.variance)}
                                    </td>
                                </tr>
                            `;
        }).join('')}
                        <tr style="background: var(--bg-tertiary); font-weight: bold;">
                            <td colspan="5" class="text-right">AVERAGE YIELD:</td>
                            <td class="text-right">${this.calculateAverageYield().toFixed(2)}%</td>
                            <td colspan="3"></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
    },

    analyzeYield(order) {
        const movements = order.movements || [];
        if (movements.length === 0) {
            return { inputWeight: 0, outputWeight: 0, totalLoss: 0, lossPercentage: 0, actualYield: 0, standardYield: 0, variance: 0 };
        }

        const inputWeight = movements[0].inputWeight;
        const outputWeight = movements[movements.length - 1].outputWeight;
        const totalLoss = inputWeight - outputWeight;
        const lossPercentage = (totalLoss / inputWeight) * 100;
        const actualYield = (outputWeight / inputWeight) * 100;

        const bom = BOMManagement.getBOMByProduct(order.productCode);
        const standardYield = bom ? bom.standardYield : 95.24;
        const variance = actualYield - standardYield;

        return {
            inputWeight,
            outputWeight,
            totalLoss,
            lossPercentage,
            actualYield,
            standardYield,
            variance
        };
    },

    calculateAverageYield() {
        if (this.orders.length === 0) return 0;
        const total = this.orders.reduce((sum, order) => {
            const analysis = this.analyzeYield(order);
            return sum + analysis.actualYield;
        }, 0);
        return total / this.orders.length;
    },

    getPerformanceBadge(variance) {
        if (variance >= 2) return '<span class="badge badge-success">Excellent</span>';
        if (variance >= 0) return '<span class="badge badge-primary">Good</span>';
        if (variance >= -2) return '<span class="badge badge-warning">Acceptable</span>';
        return '<span class="badge badge-danger">Poor</span>';
    },

    exportToCSV() {
        const headers = ['Batch', 'Product', 'Input', 'Output', 'Loss', 'Loss%', 'Actual Yield', 'Standard Yield', 'Variance'];
        const rows = this.orders.map(o => {
            const a = this.analyzeYield(o);
            return [
                o.batchNumber,
                o.productName,
                a.inputWeight.toFixed(2),
                a.outputWeight.toFixed(2),
                a.totalLoss.toFixed(2),
                a.lossPercentage.toFixed(2),
                a.actualYield.toFixed(2),
                a.standardYield.toFixed(2),
                a.variance.toFixed(2)
            ];
        });

        let csv = `Production Yield Analysis\n\n`;
        csv += headers.join(',') + '\n';
        rows.forEach(row => {
            csv += row.map(cell => `"${cell}"`).join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `yield-analysis-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }
};

// ==========================================
// 3. Production Cost Detail Report
// ==========================================

const ProductionCostReport = {
    orders: [],

    init() {
        if (!Auth.isAuthenticated()) {
            window.location.href = 'login.html';
            return;
        }

        this.loadData();
        this.render();
    },

    loadData() {
        this.orders = (Storage.get(Storage.KEYS.PRODUCTION_ORDERS) || [])
            .filter(o => o.status === 'COMPLETED' && o.totalCost > 0);
    },

    render() {
        const content = document.getElementById('main-content');
        content.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">💰 Production Cost Detail</h1>
                <p class="page-description">Analyze production costs breakdown</p>
            </div>

            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">Cost Analysis (${this.orders.length} batches)</h2>
                    <div class="btn-group">
                        <button class="btn btn-secondary" onclick="ProductionCostReport.exportToCSV()">
                            📊 Export CSV
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    ${this.renderTable()}
                </div>
            </div>
        `;
    },

    renderTable() {
        if (this.orders.length === 0) {
            return '<p class="text-center text-gray">No completed production with cost data</p>';
        }

        const totals = this.calculateTotals();

        return `
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Batch #</th>
                            <th>Product</th>
                            <th class="text-center">Output (g)</th>
                            <th class="text-right">Material</th>
                            <th class="text-right">Labor</th>
                            <th class="text-right">Overhead</th>
                            <th class="text-right">Total Cost</th>
                            <th class="text-right">Cost/Gram</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.orders.map(order => {
            const breakdown = this.getCostBreakdown(order);
            const outputWeight = order.movements && order.movements.length > 0 ?
                order.movements[order.movements.length - 1].outputWeight : order.quantity;
            const costPerGram = order.totalCost / outputWeight;

            return `
                                <tr>
                                    <td><strong>${order.batchNumber}</strong></td>
                                    <td>${order.productName}</td>
                                    <td class="text-center">${outputWeight.toFixed(2)}g</td>
                                    <td class="text-right">${this.formatCurrency(breakdown.material)}</td>
                                    <td class="text-right">${this.formatCurrency(breakdown.labor)}</td>
                                    <td class="text-right">${this.formatCurrency(breakdown.overhead)}</td>
                                    <td class="text-right"><strong>${this.formatCurrency(order.totalCost)}</strong></td>
                                    <td class="text-right">${this.formatCurrency(costPerGram)}</td>
                                </tr>
                            `;
        }).join('')}
                        <tr style="background: var(--bg-tertiary); font-weight: bold;">
                            <td colspan="3" class="text-right">TOTAL:</td>
                            <td class="text-right">${this.formatCurrency(totals.material)}</td>
                            <td class="text-right">${this.formatCurrency(totals.labor)}</td>
                            <td class="text-right">${this.formatCurrency(totals.overhead)}</td>
                            <td class="text-right">${this.formatCurrency(totals.total)}</td>
                            <td></td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div style="margin-top: 24px; padding: 16px; background: var(--bg-tertiary); border-radius: 8px;">
                <h3 style="margin: 0 0 12px 0;">Cost Distribution</h3>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
                    <div>
                        <div style="font-size: 13px; color: #666;">Material Costs</div>
                        <div style="font-size: 20px; font-weight: bold;">
                            ${((totals.material / totals.total) * 100).toFixed(1)}%
                        </div>
                    </div>
                    <div>
                        <div style="font-size: 13px; color: #666;">Labor Costs</div>
                        <div style="font-size: 20px; font-weight: bold;">
                            ${((totals.labor / totals.total) * 100).toFixed(1)}%
                        </div>
                    </div>
                    <div>
                        <div style="font-size: 13px; color: #666;">Overhead Costs</div>
                        <div style="font-size: 20px; font-weight: bold;">
                            ${((totals.overhead / totals.total) * 100).toFixed(1)}%
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    getCostBreakdown(order) {
        const movements = order.movements || [];
        let material = 0, labor = 0, overhead = 0;

        movements.forEach(m => {
            if (m.costs) {
                material += m.costs.material || 0;
                labor += m.costs.labor || 0;
                overhead += m.costs.overhead || 0;
            }
        });

        return { material, labor, overhead };
    },

    calculateTotals() {
        let material = 0, labor = 0, overhead = 0, total = 0;

        this.orders.forEach(order => {
            const breakdown = this.getCostBreakdown(order);
            material += breakdown.material;
            labor += breakdown.labor;
            overhead += breakdown.overhead;
            total += order.totalCost;
        });

        return { material, labor, overhead, total };
    },

    formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    },

    exportToCSV() {
        const headers = ['Batch', 'Product', 'Output', 'Material', 'Labor', 'Overhead', 'Total', 'Cost/Gram'];
        const rows = this.orders.map(o => {
            const breakdown = this.getCostBreakdown(o);
            const outputWeight = o.movements && o.movements.length > 0 ?
                o.movements[o.movements.length - 1].outputWeight : o.quantity;
            return [
                o.batchNumber,
                o.productName,
                outputWeight.toFixed(2),
                breakdown.material,
                breakdown.labor,
                breakdown.overhead,
                o.totalCost,
                (o.totalCost / outputWeight).toFixed(2)
            ];
        });

        let csv = `Production Cost Detail Report\n\n`;
        csv += headers.join(',') + '\n';
        rows.forEach(row => {
            csv += row.map(cell => `"${cell}"`).join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `production-cost-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }
};
