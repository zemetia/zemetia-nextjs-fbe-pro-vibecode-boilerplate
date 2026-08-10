// ==========================================
// Reorder System Module
// Automatic stock monitoring and reorder point management
// ==========================================

const ReorderSystem = {
    items: [],
    alerts: [],
    autoPRs: [],

    // Global settings
    settings: {
        enableAutoReorder: true,
        dailyCheckTime: '08:00',
        alertThreshold: 0.8,
        autoApprovePR: false,
        maxAutoPRValue: 10000000
    },

    init() {
        this.loadData();
        this.render();
    },

    loadData() {
        this.items = Storage.getItems();

        // Load settings from main config (centralized)
        const config = Storage.get(Storage.KEYS.CONFIG) || {};
        this.settings = config.inventoryReorder || this.settings;

        this.autoPRs = Storage.get(Storage.KEYS.AUTO_PURCHASE_REQUISITIONS) || [];
    },

    // Core monitoring function - check all items
    checkAllItems() {
        this.alerts = [];
        const itemsNeedingReorder = [];

        this.items.forEach(item => {
            if (!item.trackStock || !item.autoReorder) return;

            const stockInfo = this.getStockInfo(item.code);
            const alert = this.checkStockLevel(item, stockInfo);

            if (alert) {
                this.alerts.push(alert);

                if (alert.severity === 'CRITICAL' || alert.severity === 'LOW') {
                    itemsNeedingReorder.push({ item, stockInfo, alert });
                }
            }
        });

        // Auto-generate PRs if enabled
        if (this.settings.enableAutoReorder) {
            itemsNeedingReorder.forEach(({ item, stockInfo, alert }) => {
                this.createAutoPR(item, stockInfo, alert);
            });
        }

        return thisalerts;
    },

    // Check single item stock level
    checkStockLevel(item, stockInfo) {
        const currentStock = stockInfo.available;
        const reorderPoint = item.reorderPoint || 0;
        const minStock = item.minStock || 0;

        if (!reorderPoint) return null; // No reorder point set

        if (currentStock <= 0) {
            return {
                itemCode: item.code,
                itemName: item.name,
                severity: 'CRITICAL',
                currentStock: 0,
                reorderPoint,
                message: `OUT OF STOCK - Need immediate reorder`,
                suggestedQty: item.eoq || reorderPoint
            };
        }

        if (currentStock < minStock) {
            return {
                itemCode: item.code,
                itemName: item.name,
                severity: 'LOW',
                currentStock,
                reorderPoint,
                minStock,
                message: `Below minimum stock (${minStock})`,
                suggestedQty: this.calculateOrderQty(item, stockInfo)
            };
        }

        if (currentStock < reorderPoint) {
            return {
                itemCode: item.code,
                itemName: item.name,
                severity: 'WARNING',
                currentStock,
                reorderPoint,
                message: `Below reorder point (${reorderPoint})`,
                suggestedQty: this.calculateOrderQty(item, stockInfo)
            };
        }

        // Approaching reorder point
        const threshold = reorderPoint * (1 + (1 - this.settings.alertThreshold));
        if (currentStock < threshold) {
            return {
                itemCode: item.code,
                itemName: item.name,
                severity: 'INFO',
                currentStock,
                reorderPoint,
                message: `Approaching reorder point`,
                suggestedQty: null
            };
        }

        return null;
    },

    // Get current stock information
    getStockInfo(itemCode) {
        // Try to get from WarehouseStock if available
        try {
            if (typeof WarehouseStock !== 'undefined') {
                return WarehouseStock.getItemStock(itemCode);
            }
        } catch (e) {
            console.warn('WarehouseStock not available, using fallback');
        }

        // Fallback: calculate from journal entries
        const journals = Storage.get(Storage.KEYS.JOURNAL_ENTRIES) || [];
        const inventoryAccounts = ['1151', '1152', '1153', '1154', '1155', '1156'];

        let balance = 0;
        journals.forEach(journal => {
            journal.lines.forEach(line => {
                if (inventoryAccounts.includes(line.accountCode)) {
                    // Simplified: assume description contains item code
                    if (line.description && line.description.includes(itemCode)) {
                        balance += (line.debit || 0) - (line.credit || 0);
                    }
                }
            });
        });

        return {
            available: Math.max(0, balance / 1000000), // Assume value, need qty conversion
            reserved: 0,
            inTransit: 0
        };
    },

    // Calculate optimal order quantity
    calculateOrderQty(item, stockInfo) {
        const currentStock = stockInfo.available;
        const maxStock = item.maxStock || (item.reorderPoint * 3);
        const eoq = item.eoq || 0;

        // Use EOQ if set
        if (eoq > 0) {
            return eoq;
        }

        // Otherwise, order up to max stock
        const qtyToMax = maxStock - currentStock;
        const qtyToReorder = item.reorderPoint - currentStock;

        return Math.max(qtyToMax, qtyToReorder, item.minStock || 0);
    },

    // Calculate EOQ (Economic Order Quantity)
    calculateEOQ(annualDemand, orderCost, holdingCostPerUnit) {
        if (!annualDemand || !orderCost || !holdingCostPerUnit) return null;

        const eoq = Math.sqrt((2 * annualDemand * orderCost) / holdingCostPerUnit);
        return Math.round(eoq);
    },

    // Auto-create Purchase Requisition
    createAutoPR(item, stockInfo, alert) {
        // Check if PR already exists for this item
        const existingPR = this.autoPRs.find(pr =>
            pr.status === 'pending_approval' &&
            pr.items.some(i => i.itemCode === item.code)
        );

        if (existingPR) {
            console.log(`PR already exists for ${item.code}`);
            return null;
        }

        const suggestedQty = alert.suggestedQty || this.calculateOrderQty(item, stockInfo);
        const estimatedPrice = item.standardCost || 0;
        const estimatedTotal = suggestedQty * estimatedPrice;

        // Check auto-approve limit
        const requiresApproval = estimatedTotal > this.settings.maxAutoPRValue;

        const autoPR = {
            id: `PR-AUTO-${Date.now()}`,
            type: 'AUTO',
            status: requiresApproval ? 'pending_approval' : 'auto_approved',
            createdBy: 'SYSTEM',
            createdAt: new Date().toISOString(),
            priority: alert.severity === 'CRITICAL' ? 'URGENT' : alert.severity === 'LOW' ? 'HIGH' : 'NORMAL',

            items: [{
                itemCode: item.code,
                itemName: item.name,
                requestedQty: suggestedQty,
                uom: item.uom,
                reason: `AUTO-REORDER: ${alert.message}`,
                urgency: alert.severity,
                suggestedSupplier: item.preferredSupplier || null,
                estimatedPrice,
                estimatedTotal
            }],

            totalEstimate: estimatedTotal,
            requiredBy: this.calculateRequiredDate(item.leadTimeDays || 7),
            notes: `Automatically generated by Reorder System due to low stock`
        };

        this.autoPRs.push(autoPR);
        this.saveAutoPRs();

        // Log audit trail
        AuditLog.log('create', 'auto_purchase_requisition', autoPR.id,
            `Auto-created PR for ${item.name} (${suggestedQty} ${item.uom})`);

        return autoPR;
    },

    calculateRequiredDate(leadTimeDays) {
        const date = new Date();
        date.setDate(date.getDate() + leadTimeDays);
        return date.toISOString().split('T')[0];
    },

    async saveAutoPRs() {
        await Storage.set(Storage.KEYS.AUTO_PURCHASE_REQUISITIONS, this.autoPRs);
    },

    // Get all alerts
    getAlerts() {
        return this.alerts.sort((a, b) => {
            const severityOrder = { CRITICAL: 0, LOW: 1, WARNING: 2, INFO: 3 };
            return severityOrder[a.severity] - severityOrder[b.severity];
        });
    },

    // Render dashboard
    render() {
        const content = document.getElementById('main-content');

        // Run check
        this.checkAllItems();

        content.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">🔄 Reorder System</h1>
                <p class="page-description">Automatic stock monitoring and reorder automation</p>
                <div style="margin-top: 12px;">
                    <a href="#" onclick="App.navigateTo('settings'); Settings.currentTab='inventory'; Settings.render(); return false;" 
                       class="btn btn-secondary btn-sm">
                        ⚙️ Configure Reorder Settings
                    </a>
                </div>
            </div>

            ${this.renderAlerts()}
            ${this.renderAutoPRQueue()}
        `;
    },

    renderAlerts() {
        const criticalAlerts = this.alerts.filter(a => a.severity === 'CRITICAL');
        const lowAlerts = this.alerts.filter(a => a.severity === 'LOW');
        const warningAlerts = this.alerts.filter(a => a.severity === 'WARNING');

        return `
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px;">
                <div class="card" style="background: hsl(0, 72%, 25%);">
                    <div class="card-body">
                        <h3 style="margin: 0 0 8px;">🔴 Critical (${criticalAlerts.length})</h3>
                        <p style="font-size: 14px; margin: 0;">Out of stock items</p>
                    </div>
                </div>
                <div class="card" style="background: hsl(45, 100%, 20%);">
                    <div class="card-body">
                        <h3 style="margin: 0 0 8px;">🟠 Low Stock (${lowAlerts.length})</h3>
                        <p style="font-size: 14px; margin: 0;">Below minimum stock</p>
                    </div>
                </div>
                <div class="card" style="background: hsl(200, 50%, 20%);">
                    <div class="card-body">
                        <h3 style="margin: 0 0 8px;">🟡 Warnings (${warningAlerts.length})</h3>
                        <p style="font-size: 14px; margin: 0;">Below reorder point</p>
                    </div>
                </div>
            </div>

            <div class="card mb-3">
                <div class="card-header">
                    <h2 class="card-title">Stock Alerts</h2>
                    <button class="btn btn-primary" onclick="ReorderSystem.checkAllItems(); ReorderSystem.render();">
                        🔄 Refresh Check
                    </button>
                </div>
                <div class="card-body">
                    ${this.renderAlertTable()}
                </div>
            </div>
        `;
    },

    renderAlertTable() {
        if (this.alerts.length === 0) {
            return '<p class="text-center text-gray">✅ All items are adequately stocked!</p>';
        }

        const alerts = this.getAlerts();

        return `
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th>Current Stock</th>
                            <th>Reorder Point</th>
                            <th>Status</th>
                            <th>Suggested Order Qty</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${alerts.map(alert => `
                            <tr>
                                <td><strong>${alert.itemName}</strong><br><small>${alert.itemCode}</small></td>
                                <td><span class="badge badge-${alert.severity === 'CRITICAL' ? 'danger' : alert.severity === 'LOW' ? 'warning' : 'secondary'}">${alert.currentStock}</span></td>
                                <td>${alert.reorderPoint}</td>
                                <td><span class="badge badge-${alert.severity === 'CRITICAL' ? 'danger' : alert.severity === 'LOW' ? 'warning' : 'info'}">${alert.message}</span></td>
                                <td>${alert.suggestedQty || '-'}</td>
                                <td>
                                    ${alert.suggestedQty ? `
                                        <button class="btn btn-sm btn-primary" onclick="ReorderSystem.manualCreatePR('${alert.itemCode}', ${alert.suggestedQty})">
                                            Create PR
                                        </button>
                                    ` : '-'}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    renderAutoPRQueue() {
        const pendingPRs = this.autoPRs.filter(pr => pr.status === 'pending_approval');

        return `
            <div class="card mb-3">
                <div class="card-header">
                    <h2 class="card-title">📋 Auto-PR Queue (${pendingPRs.length})</h2>
                </div>
                <div class="card-body">
                    ${pendingPRs.length === 0 ? '<p class="text-center text-gray">No pending auto-generated PRs</p>' : `
                        <div class="table-container">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>PR Number</th>
                                        <th>Item</th>
                                        <th>Qty</th>
                                        <th>Estimated Total</th>
                                        <th>Priority</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${pendingPRs.map(pr => `
                                        <tr>
                                            <td><span class="badge badge-info">${pr.id}</span></td>
                                            <td>${pr.items[0].itemName}</td>
                                            <td>${pr.items[0].requestedQty} ${pr.items[0].uom}</td>
                                            <td>${this.formatCurrency(pr.totalEstimate)}</td>
                                            <td><span class="badge badge-${pr.priority === 'URGENT' ? 'danger' : pr.priority === 'HIGH' ? 'warning' : 'info'}">${pr.priority}</span></td>
                                            <td>
                                                <button class="btn btn-sm btn-success" onclick="ReorderSystem.approvePR('${pr.id}')">Approve</button>
                                                <button class="btn btn-sm btn-danger" onclick="ReorderSystem.rejectPR('${pr.id}')">Reject</button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    `}
                </div>
            </div>
        `;
    },



    approvePR(prId) {
        const pr = this.autoPRs.find(p => p.id === prId);
        if (!pr) return;

        pr.status = 'approved';
        pr.approvedAt = new Date().toISOString();
        pr.approvedBy = Auth.getCurrentUser()?.name || 'User';

        this.saveAutoPRs();
        this.render();
        alert(`✅ PR ${prId} approved!`);
    },

    rejectPR(prId) {
        const pr = this.autoPRs.find(p => p.id === prId);
        if (!pr) return;

        if (confirm(`Reject PR ${prId}?`)) {
            pr.status = 'rejected';
            pr.rejectedAt = new Date().toISOString();
            pr.rejectedBy = Auth.getCurrentUser()?.name || 'User';

            this.saveAutoPRs();
            this.render();
        }
    },

    formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    }
};


// Explicitly make ReorderSystem globally available
window.ReorderSystem = ReorderSystem;
