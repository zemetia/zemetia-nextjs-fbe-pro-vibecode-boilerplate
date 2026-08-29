// ==========================================
// Gold Refinery KPI Dashboard
// Track production efficiency & quality metrics
// ==========================================

const RefineryKPI = {
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
                <h1 class="page-title">📊 Refinery KPI Dashboard</h1>
                <p class="page-description">Key Performance Indicators - Aqua Regia Refining Process</p>
            </div>

            ${this.renderDateFilter()}
            ${this.renderKPICards()}
            ${this.renderProductionChart()}
            ${this.renderQualityMetrics()}
            ${this.renderByProductTracking()}
            ${this.renderBatchPerformance()}
        `;
    },

    renderDateFilter() {
        const today = new Date().toISOString().split('T')[0];
        const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

        return `
            <div class="card mb-3">
                <div class="card-body">
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">From Date</label>
                            <input type="date" id="filter-from" class="form-input" value="${firstDay}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">To Date</label>
                            <input type="date" id="filter-to" class="form-input" value="${today}">
                        </div>
                        <div class="form-group" style="align-self: flex-end;">
                            <button class="btn btn-primary" onclick="RefineryKPI.applyFilter()">
                                📊 Update Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    renderKPICards() {
        const data = this.calculateKPIs();

        return `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 24px;">
                ${this.renderKPICard('🎯 Yield Rate', `${data.yieldRate.toFixed(2)}%`, data.yieldRate >= 88 ? 'success' : 'warning', 'Target: 88-90%')}
                ${this.renderKPICard('✨ Avg Purity', `${data.avgPurity.toFixed(2)}%`, data.avgPurity >= 99.8 ? 'success' : 'warning', 'Target: 99.9%')}
                ${this.renderKPICard('⏱️ Avg Time', `${data.avgProcessingTime.toFixed(1)} hrs`, data.avgProcessingTime <= 6 ? 'success' : 'warning', 'Target: 4-6 hrs')}
                ${this.renderKPICard('📉 Loss Rate (Avg)', `${data.lossRate.toFixed(2)}%`, data.lossRate <= 12 ? 'success' : 'danger', 'Target: <12%')}
                ${this.renderKPICard('⚖️ Total Susut', `${data.totalLoss.toFixed(2)} g`, 'danger', 'Accumulated weight loss')}
                ${this.renderKPICard('🥈 Silver Recovery', `${data.silverRecovery.toFixed(2)}%`, data.silverRecovery >= 12 ? 'success' : 'warning', 'Expected: 12-15%')}
            </div>
        `;
    },

    renderKPICard(title, value, type, subtitle) {
        const colors = {
            success: '#28a745',
            warning: '#ffc107',
            danger: '#dc3545',
            info: '#17a2b8'
        };

        return `
            <div class="card" style="border-left: 4px solid ${colors[type]};">
                <div class="card-body">
                    <div style="font-size: 14px; color: #666; margin-bottom: 8px;">${title}</div>
                    <div style="font-size: 28px; font-weight: bold; color: ${colors[type]}; margin-bottom: 4px;">${value}</div>
                    <div style="font-size: 12px; color: #999;">${subtitle}</div>
                </div>
            </div>
        `;
    },

    renderProductionChart() {
        const batches = this.getProductionBatches();

        return `
            <div class="card mb-3">
                <div class="card-header">
                    <h2 class="card-title">📈 Production Trend</h2>
                </div>
                <div class="card-body">
                    <div class="table-container">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Batch</th>
                                    <th>Date</th>
                                    <th>Input (g)</th>
                                    <th>Output (g)</th>
                                    <th>Susut (g)</th>
                                    <th>Yield %</th>
                                    <th>Purity %</th>
                                    <th>Time (hrs)</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${batches.length > 0 ? batches.map(b => `
                                    <tr>
                                        <td><strong>${b.batchNumber}</strong></td>
                                        <td>${new Date(b.date).toLocaleDateString('id-ID')}</td>
                                        <td>${b.inputWeight.toFixed(2)}</td>
                                        <td>${b.outputWeight.toFixed(2)}</td>
                                        <td><span style="color: var(--color-danger); font-weight: bold;">${(b.loss || 0).toFixed(2)}</span></td>
                                        <td>
                                            <span style="color: ${b.yield >= 88 ? '#28a745' : '#ffc107'}">
                                                ${b.yield.toFixed(2)}%
                                            </span>
                                        </td>
                                        <td>
                                            <span style="color: ${b.purity >= 99.8 ? '#28a745' : '#ffc107'}">
                                                ${b.purity.toFixed(2)}%
                                            </span>
                                        </td>
                                        <td>${b.processingTime.toFixed(1)}</td>
                                        <td><span class="badge badge-${this.getStatusBadge(b.status)}">${b.status}</span></td>
                                    </tr>
                                `).join('') : '<tr><td colspan="8" class="text-center text-gray">No production data in selected period</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    },

    renderQualityMetrics() {
        const quality = this.getQualityMetrics();

        return `
            <div class="card mb-3">
                <div class="card-header">
                    <h2 class="card-title">🔬 Quality Metrics</h2>
                </div>
                <div class="card-body">
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;">
                        <div>
                            <strong>Lab Test Accuracy:</strong><br>
                            <span style="font-size: 24px; color: #17a2b8;">${quality.labAccuracy.toFixed(1)}%</span>
                            <p class="text-gray" style="font-size: 12px; margin-top: 4px;">
                                XRF vs final purity variance
                            </p>
                        </div>
                        <div>
                            <strong>Reject Rate:</strong><br>
                            <span style="font-size: 24px; color: ${quality.rejectRate > 5 ? '#dc3545' : '#28a745'};">${quality.rejectRate.toFixed(1)}%</span>
                            <p class="text-gray" style="font-size: 12px; margin-top: 4px;">
                                ${quality.rejectedBatches} / ${quality.totalBatches} batches
                            </p>
                        </div>
                        <div>
                            <strong>Rework Rate:</strong><br>
                            <span style="font-size: 24px; color: ${quality.reworkRate > 10 ? '#ffc107' : '#28a745'};">${quality.reworkRate.toFixed(1)}%</span>
                            <p class="text-gray" style="font-size: 12px; margin-top: 4px;">
                                Batches need reprocessing
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    renderByProductTracking() {
        const byProducts = this.getByProductData();

        return `
            <div class="card mb-3">
                <div class="card-header">
                    <h2 class="card-title">🥈 By-Product Recovery</h2>
                </div>
                <div class="card-body">
                    <div class="table-container">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>By-Product</th>
                                    <th>Total Recovered (g)</th>
                                    <th>Avg Recovery Rate</th>
                                    <th>Value (Rp)</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td><strong>🥈 Silver (Perak)</strong></td>
                                    <td>${byProducts.silver.weight.toFixed(2)} g</td>
                                    <td>${byProducts.silver.rate.toFixed(2)}%</td>
                                    <td>${this.formatCurrency(byProducts.silver.value)}</td>
                                </tr>
                                <tr>
                                    <td><strong>✨ Gold Dust</strong></td>
                                    <td>${byProducts.goldDust.weight.toFixed(2)} g</td>
                                    <td>${byProducts.goldDust.rate.toFixed(2)}%</td>
                                    <td>${this.formatCurrency(byProducts.goldDust.value)}</td>
                                </tr>
                                <tr style="background: var(--bg-tertiary); font-weight: bold;">
                                    <td>TOTAL BY-PRODUCT VALUE</td>
                                    <td colspan="2">-</td>
                                    <td>${this.formatCurrency(byProducts.silver.value + byProducts.goldDust.value)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    },

    renderBatchPerformance() {
        const stageLoss = this.calculateLossByStage();

        return `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div class="card">
                    <div class="card-header">
                        <h2 class="card-title">📉 Avg Loss by Stage</h2>
                    </div>
                    <div class="card-body">
                        <div class="table-container">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>Stage</th>
                                        <th>Avg Loss (g)</th>
                                        <th>Avg Loss %</th>
                                        <th>Efficiency</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${Object.entries(stageLoss).map(([stage, metrics]) => `
                                        <tr>
                                            <td><strong>${stage}</strong></td>
                                            <td>${metrics.avgLoss.toFixed(2)} g</td>
                                            <td><span style="color: var(--color-danger); font-weight: bold;">${metrics.avgLossPercent.toFixed(2)}%</span></td>
                                            <td>
                                                <span class="badge badge-${metrics.avgLossPercent <= 5 ? 'success' : metrics.avgLossPercent <= 10 ? 'warning' : 'danger'}">
                                                    ${metrics.avgLossPercent <= 5 ? 'High' : metrics.avgLossPercent <= 10 ? 'Medium' : 'Low'}
                                                </span>
                                            </td>
                                        </tr>
                                    `).join('')}
                                    ${Object.keys(stageLoss).length === 0 ? '<tr><td colspan="4" class="text-center text-gray">No stage data available</td></tr>' : ''}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <h2 class="card-title">⚡ Chemical Usage Efficiency</h2>
                    </div>
                    <div class="card-body">
                        <p class="text-gray" style="font-size: 12px; margin-bottom: 12px;">
                            Track actual chemical usage vs BOM standard
                        </p>
                        <div class="table-container">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>Chemical</th>
                                        <th>Standard</th>
                                        <th>Actual</th>
                                        <th>Efficiency</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>Asam Nitrat</td>
                                        <td>1.0 L</td>
                                        <td>1.05 L</td>
                                        <td><span class="badge badge-warning">95%</span></td>
                                    </tr>
                                    <tr>
                                        <td>HCl</td>
                                        <td>3.5 L</td>
                                        <td>3.6 L</td>
                                        <td><span class="badge badge-success">97%</span></td>
                                    </tr>
                                    <tr>
                                        <td>UREA</td>
                                        <td>50 g</td>
                                        <td>52 g</td>
                                        <td><span class="badge badge-success">96%</span></td>
                                    </tr>
                                    <tr>
                                        <td>SMB</td>
                                        <td>100 g</td>
                                        <td>98 g</td>
                                        <td><span class="badge badge-success">102%</span></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    // Data calculation methods
    calculateKPIs() {
        const batches = this.getProductionBatches();

        if (batches.length === 0) {
            return {
                yieldRate: 0,
                avgPurity: 0,
                avgProcessingTime: 0,
                lossRate: 0,
                totalLoss: 0,
                costPerGram: 0,
                silverRecovery: 0
            };
        }

        const totalInput = batches.reduce((sum, b) => sum + b.inputWeight, 0);
        const totalOutput = batches.reduce((sum, b) => sum + b.outputWeight, 0);
        const totalLoss = batches.reduce((sum, b) => sum + (b.loss || 0), 0);
        const yieldRate = totalInput > 0 ? (totalOutput / totalInput) * 100 : 0;
        const lossRate = totalInput > 0 ? (totalLoss / totalInput) * 100 : 0;

        const avgPurity = batches.reduce((sum, b) => sum + b.purity, 0) / batches.length;
        const avgProcessingTime = batches.reduce((sum, b) => sum + b.processingTime, 0) / batches.length;

        const totalCost = batches.reduce((sum, b) => sum + (b.totalCost || 0), 0);
        const costPerGram = totalOutput > 0 ? totalCost / totalOutput : 0;

        const totalSilver = batches.reduce((sum, b) => sum + (b.silverRecovered || 0), 0);
        const silverRecovery = totalInput > 0 ? (totalSilver / totalInput) * 100 : 0;

        return {
            yieldRate,
            avgPurity,
            avgProcessingTime,
            lossRate,
            totalLoss,
            costPerGram,
            silverRecovery
        };
    },

    calculateLossByStage() {
        const newBatches = (Storage.get('production_batches') || [])
            .filter(b => b.status === 'completed' && b.actualOutput);

        const stageData = {};

        newBatches.forEach(b => {
            const stage = b.stage || 'GENERAL';
            if (!stageData[stage]) {
                stageData[stage] = {
                    totalLoss: 0,
                    totalInput: 0,
                    count: 0
                };
            }
            stageData[stage].totalLoss += b.actualOutput.loss || 0;
            stageData[stage].totalInput += b.totalGrossWeight || 0;
            stageData[stage].count++;
        });

        const results = {};
        for (const stage in stageData) {
            results[stage] = {
                avgLoss: stageData[stage].totalLoss / stageData[stage].count,
                avgLossPercent: (stageData[stage].totalLoss / stageData[stage].totalInput) * 100
            };
        }

        return results;
    },

    getProductionBatches() {
        // 1. Get legacy production orders
        const orders = Storage.get('PRODUCTION_ORDERS') || [];
        const legacyBatches = orders
            .filter(o => o.status === 'COMPLETED' && o.movements && o.movements.length > 0)
            .map(order => {
                const firstMovement = order.movements[0];
                const lastMovement = order.movements[order.movements.length - 1];

                return {
                    batchNumber: order.batchNumber,
                    date: order.actualCompletionDate || order.startDate,
                    inputWeight: firstMovement.inputWeight,
                    outputWeight: lastMovement.outputWeight,
                    loss: firstMovement.inputWeight - lastMovement.outputWeight,
                    yield: (lastMovement.outputWeight / firstMovement.inputWeight) * 100,
                    purity: 99.9,
                    processingTime: this.calculateProcessingTime(order.startDate, order.actualCompletionDate),
                    status: order.status,
                    totalCost: order.totalCost || 0,
                    silverRecovered: this.calculateSilverRecovery(order)
                };
            });

        // 2. Get new production batches (the detailed tracking we just implemented)
        const newBatches = (Storage.get('production_batches') || [])
            .filter(b => b.status === 'completed')
            .map(b => ({
                batchNumber: b.batchNumber,
                date: b.endTime || b.createdAt,
                inputWeight: b.totalGrossWeight,
                outputWeight: b.actualOutput?.pureAu || 0,
                loss: b.actualOutput?.loss || 0,
                yield: b.totalGrossWeight > 0 ? ((b.actualOutput?.pureAu || 0) / b.totalGrossWeight) * 100 : 0,
                purity: 99.99, // New process aims for 99.99
                processingTime: this.calculateProcessingTime(b.startTime || b.createdAt, b.endTime),
                status: 'COMPLETED',
                totalCost: 0,
                silverRecovered: b.actualOutput?.silver || 0,
                stage: b.stage || 'GENERAL'
            }));

        // Combine and sort by date desc
        return [...legacyBatches, ...newBatches].sort((a, b) => new Date(b.date) - new Date(a.date));
    },

    getQualityMetrics() {
        const batches = this.getProductionBatches();
        const totalBatches = batches.length;

        // Mock data for now
        return {
            labAccuracy: 98.5,
            rejectRate: 2.1,
            rejectedBatches: Math.floor(totalBatches * 0.021),
            totalBatches: totalBatches,
            reworkRate: 5.3
        };
    },

    getByProductData() {
        const batches = this.getProductionBatches();
        const totalInput = batches.reduce((sum, b) => sum + b.inputWeight, 0);

        const silverWeight = batches.reduce((sum, b) => sum + (b.silverRecovered || 0), 0);
        const goldDustWeight = batches.reduce((sum, b) => sum + (b.goldDustRecovered || 0), 0);

        return {
            silver: {
                weight: silverWeight,
                rate: (silverWeight / totalInput) * 100,
                value: silverWeight * 15000 // Rp 15k/gram
            },
            goldDust: {
                weight: goldDustWeight,
                rate: (goldDustWeight / totalInput) * 100,
                value: goldDustWeight * 900000 // Rp 900k/gram
            }
        };
    },

    calculateProcessingTime(startDate, endDate) {
        if (!startDate || !endDate) return 0;
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffMs = end - start;
        return diffMs / (1000 * 60 * 60); // Convert to hours
    },

    calculateSilverRecovery(order) {
        // Mock: 12% of input
        const firstMovement = order.movements[0];
        return firstMovement.inputWeight * 0.12;
    },

    getStatusBadge(status) {
        const badges = {
            'COMPLETED': 'success',
            'IN_PROGRESS': 'primary',
            'DRAFT': 'secondary',
            'CANCELLED': 'danger'
        };
        return badges[status] || 'secondary';
    },

    applyFilter() {
        // Re-render with new date filter
        this.render();
    },

    formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    }
};


// Explicitly make RefineryKPI globally available
window.RefineryKPI = RefineryKPI;
