// ==========================================
// Settings Module
// System configuration and data import/export
// ==========================================

const Settings = {
    currentTab: 'general', // Track active tab

    init() {
        if (!Auth.isAuthenticated()) {
            window.location.href = 'login.html';
            return;
        }

        // Migrate old reorder settings if needed
        this.migrateReorderSettings();

        this.render();
    },

    // Migrate reorder settings from old location to main config
    async migrateReorderSettings() {
        const oldSettings = Storage.get('reorder_settings');
        const config = Storage.get(Storage.KEYS.CONFIG) || {};

        if (oldSettings && !config.inventoryReorder) {
            console.log('🔄 Migrating reorder settings to main config...');

            config.inventoryReorder = {
                // Migrate existing settings
                enableAutoReorder: oldSettings.enableAutoReorder !== undefined ? oldSettings.enableAutoReorder : true,
                maxAutoPRValue: oldSettings.maxAutoPRValue || 10000000,
                dailyCheckTime: oldSettings.dailyCheckTime || '08:00',
                alertThreshold: oldSettings.alertThreshold || 0.8,
                autoApprovePR: oldSettings.autoApprovePR || false,

                // Add new default fields
                defaultReorderPoint: 100,
                defaultMinStock: 50,
                defaultMaxStock: 200,
                defaultLeadTimeDays: 7,
                holdingCostRate: 0.20, // 20% per year
                averageOrderCost: 500000 // Rp 500k per order
            };

            await Storage.set(Storage.KEYS.CONFIG, config);
            console.log('✅ Reorder settings migrated successfully');
        }
    },

    render() {
        const content = document.getElementById('main-content');
        const config = Storage.get(Storage.KEYS.CONFIG) || {};

        content.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">⚙️ Pengaturan Sistem</h1>
                <p class="page-description">Konfigurasi dan manajemen data sistem</p>
            </div>

            <!-- Tab Navigation -->
            <div class="card mb-3">
                <div class="card-body" style="padding: 0;">
                    <div style="display: flex; border-bottom: 2px solid var(--color-gray-800); background: var(--bg-secondary);">
                        <button class="settings-tab ${this.currentTab === 'general' ? 'active' : ''}" 
                                onclick="Settings.switchTab('general')"
                                style="flex: 1; padding: 16px 24px; border: none; background: transparent; cursor: pointer; font-weight: 600; transition: all 0.3s; border-bottom: 3px solid transparent;">
                            📋 General Settings
                        </button>
                        <button class="settings-tab ${this.currentTab === 'authorization' ? 'active' : ''}" 
                                onclick="Settings.switchTab('authorization')"
                                style="flex: 1; padding: 16px 24px; border: none; background: transparent; cursor: pointer; font-weight: 600; transition: all 0.3s; border-bottom: 3px solid transparent;">
                            ✅ Authorization & Approval
                        </button>
                        <button class="settings-tab ${this.currentTab === 'inventory' ? 'active' : ''}" 
                                onclick="Settings.switchTab('inventory')"
                                style="flex: 1; padding: 16px 24px; border: none; background: transparent; cursor: pointer; font-weight: 600; transition: all 0.3s; border-bottom: 3px solid transparent;">
                            📦 Inventory & Reorder
                        </button>
                        <button class="settings-tab ${this.currentTab === 'payroll' ? 'active' : ''}" 
                                onclick="Settings.switchTab('payroll')"
                                style="flex: 1; padding: 16px 24px; border: none; background: transparent; cursor: pointer; font-weight: 600; transition: all 0.3s; border-bottom: 3px solid transparent;">
                            💰 Payroll Rules
                        </button>
                    </div>
                </div>
            </div>

            <!-- Tab Content -->
            <div id="settings-tab-content">
                ${this.renderTabContent(config)}
            </div>

            <style>
                .settings-tab {
                    color: var(--color-gray-400);
                }
                .settings-tab:hover {
                    background: var(--bg-tertiary);
                    color: var(--color-text-primary);
                }
                .settings-tab.active {
                    color: var(--color-primary);
                    border-bottom-color: var(--color-primary) !important;
                    background: var(--bg-tertiary);
                }
            </style>
        `;

        // Initialize account mapping dropdowns if on general tab
        if (this.currentTab === 'general') {
            this.initializeAccountMappingDropdowns();
        }
    },

    switchTab(tabName) {
        this.currentTab = tabName;
        this.render();
    },

    renderTabContent(config) {
        switch (this.currentTab) {
            case 'general':
                return this.renderGeneralTab(config);
            case 'authorization':
                return this.renderAuthorizationTab(config);
            case 'inventory':
                return this.renderInventoryTab(config);
            case 'payroll':
                return this.renderPayrollTab();
            default:
                return this.renderGeneralTab(config);
        }
    },

    renderGeneralTab(config) {
        return `
            ${this.renderCompanySettings(config)}
            ${this.renderOperationalSettings(config)}
            ${this.renderAccountMapping()}
            ${this.renderImportExport()}
            ${this.renderDataManagement()}
        `;
    },

    renderOperationalSettings(config) {
        const opConfig = config.operational || {};
        return `
            <div class="card mb-3">
                <div class="card-header">
                    <h2 class="card-title">⚙️ Operational Settings</h2>
                </div>
                <div class="card-body">
                    <form onsubmit="Settings.saveOperationalSettings(event)">
                        <div class="form-group">
                            <label class="form-label">Refinery Fee (per gram)</label>
                            <div class="input-group">
                                <span class="input-group-text">Rp</span>
                                <input type="number" name="refineryFeePerGram" class="form-input" 
                                       value="${opConfig.refineryFeePerGram || 1000}" required>
                            </div>
                            <small class="text-gray help-text">Default fee per gram for Direct Swap (Makloon)</small>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Gold Loss / Susut (%)</label>
                            <div class="input-group">
                                <input type="number" name="refineryGoldLossPct" class="form-input" 
                                       value="${opConfig.refineryGoldLossPct !== undefined ? opConfig.refineryGoldLossPct : 0.2}" step="0.01" min="0" required>
                                <span class="input-group-text">%</span>
                            </div>
                            <small class="text-gray help-text">Deduction from Gross Weight (Ref Charge)</small>
                        </div>
                        <button type="submit" class="btn btn-primary">💾 Save Operational Settings</button>
                    </form>
                </div>
            </div>
        `;
    },

    async saveOperationalSettings(event) {
        event.preventDefault();
        const formData = new FormData(event.target);

        const config = Storage.get(Storage.KEYS.CONFIG) || {};
        config.operational = config.operational || {};

        config.operational.refineryFeePerGram = parseFloat(formData.get('refineryFeePerGram')) || 0;

        await Storage.set(Storage.KEYS.CONFIG, config);
        this.showAlert('success', '✅ Operational settings saved successfully!');
    },

    renderAuthorizationTab(config) {
        return `
            ${this.renderApprovalLimits(config)}
        `;
    },

    renderInventoryTab(config) {
        return `
            ${this.renderInventoryReorderSettings(config)}
        `;
    },

    // NEW: Render Inventory & Reorder Settings
    renderInventoryReorderSettings(config) {
        const reorderConfig = config.inventoryReorder || {
            defaultReorderPoint: 100,
            defaultMinStock: 50,
            defaultMaxStock: 200,
            defaultLeadTimeDays: 7,
            enableAutoReorder: true,
            maxAutoPRValue: 10000000,
            dailyCheckTime: '08:00',
            alertThreshold: 0.8,
            autoApprovePR: false,
            holdingCostRate: 0.20,
            averageOrderCost: 500000
        };

        return `
            <div class="card mb-3">
                <div class="card-header">
                    <h2 class="card-title">📦 Global Inventory Defaults</h2>
                    <p style="color: #666; font-size: 14px; margin-top: 8px;">
                        Default values for new inventory items (can be overridden per item)
                    </p>
                </div>
                <div class="card-body">
                    <form onsubmit="Settings.saveInventoryReorderSettings(event)">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
                            <!-- Stock Level Defaults -->
                            <div>
                                <h3 style="margin-bottom: 16px; color: var(--color-primary);">📊 Stock Level Defaults</h3>
                                
                                <div class="form-group">
                                    <label class="form-label">Default Reorder Point</label>
                                    <input type="number" name="defaultReorderPoint" class="form-input" 
                                           value="${reorderConfig.defaultReorderPoint}" min="0" step="1" required>
                                    <small style="color: #666; display: block; margin-top: 4px;">
                                        Stock level that triggers reorder alert
                                    </small>
                                </div>

                                <div class="form-group">
                                    <label class="form-label">Default Min Stock (Safety Stock)</label>
                                    <input type="number" name="defaultMinStock" class="form-input" 
                                           value="${reorderConfig.defaultMinStock}" min="0" step="1" required>
                                    <small style="color: #666; display: block; margin-top: 4px;">
                                        Absolute minimum stock level
                                    </small>
                                </div>

                                <div class="form-group">
                                    <label class="form-label">Default Max Stock (Capacity)</label>
                                    <input type="number" name="defaultMaxStock" class="form-input" 
                                           value="${reorderConfig.defaultMaxStock}" min="0" step="1" required>
                                    <small style="color: #666; display: block; margin-top: 4px;">
                                        Maximum storage capacity
                                    </small>
                                </div>

                                <div class="form-group">
                                    <label class="form-label">Default Lead Time (Days)</label>
                                    <input type="number" name="defaultLeadTimeDays" class="form-input" 
                                           value="${reorderConfig.defaultLeadTimeDays}" min="0" step="1" required>
                                    <small style="color: #666; display: block; margin-top: 4px;">
                                        Average days from order to receipt
                                    </small>
                                </div>
                            </div>

                            <!-- Auto-Reorder Configuration -->
                            <div>
                                <h3 style="margin-bottom: 16px; color: var(--color-success);">🤖 Auto-Reorder System</h3>
                                
                                <div class="form-group">
                                    <label class="form-label" style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
                                        <input type="checkbox" name="enableAutoReorder" 
                                               ${reorderConfig.enableAutoReorder ? 'checked' : ''}
                                               style="width: 20px; height: 20px; cursor: pointer;">
                                        <div>
                                            <strong>Enable Automatic Reordering</strong>
                                            <p class="text-gray" style="margin: 4px 0 0 0; font-size: 0.9rem;">
                                                System will auto-generate PRs for low stock items
                                            </p>
                                        </div>
                                    </label>
                                </div>

                                <div class="form-group">
                                    <label class="form-label">Max Auto-Approve PR Value (Rp)</label>
                                    <input type="number" name="maxAutoPRValue" class="form-input" 
                                           value="${reorderConfig.maxAutoPRValue}" min="0" step="1000000" required>
                                    <small style="color: #666; display: block; margin-top: 4px;">
                                        PRs above this value require manual approval
                                    </small>
                                </div>

                                <div class="form-group">
                                    <label class="form-label">Daily Check Time</label>
                                    <input type="time" name="dailyCheckTime" class="form-input" 
                                           value="${reorderConfig.dailyCheckTime}" required>
                                    <small style="color: #666; display: block; margin-top: 4px;">
                                        Time for daily stock level check
                                    </small>
                                </div>

                                <div class="form-group">
                                    <label class="form-label">Alert Threshold (%)</label>
                                    <input type="number" name="alertThreshold" class="form-input" 
                                           value="${(reorderConfig.alertThreshold * 100).toFixed(0)}" 
                                           min="0" max="100" step="5" required>
                                    <small style="color: #666; display: block; margin-top: 4px;">
                                        Show warning when stock reaches this % of reorder point
                                    </small>
                                </div>

                                <div class="form-group">
                                    <label class="form-label" style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
                                        <input type="checkbox" name="autoApprovePR" 
                                               ${reorderConfig.autoApprovePR ? 'checked' : ''}
                                               style="width: 20px; height: 20px; cursor: pointer;">
                                        <div>
                                            <strong>Auto-Approve PRs (below threshold)</strong>
                                            <p class="text-gray" style="margin: 4px 0 0 0; font-size: 0.9rem;">
                                                Automatically approve PRs below max value
                                            </p>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <hr style="margin: 24px 0;">

                        <!-- EOQ Calculation Defaults -->
                        <h3 style="margin-bottom: 16px; color: var(--color-warning);">📐 EOQ Calculation Parameters</h3>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
                            <div class="form-group">
                                <label class="form-label">Annual Holding Cost Rate (%)</label>
                                <input type="number" name="holdingCostRate" class="form-input" 
                                       value="${(reorderConfig.holdingCostRate * 100).toFixed(0)}" 
                                       min="0" max="100" step="1" required>
                                <small style="color: #666; display: block; margin-top: 4px;">
                                    Cost to hold inventory per year (as % of item value)
                                </small>
                            </div>

                            <div class="form-group">
                                <label class="form-label">Average Order Cost (Rp)</label>
                                <input type="number" name="averageOrderCost" class="form-input" 
                                       value="${reorderConfig.averageOrderCost}" 
                                       min="0" step="10000" required>
                                <small style="color: #666; display: block; margin-top: 4px;">
                                    Average cost per purchase order
                                </small>
                            </div>
                        </div>

                        <div style="margin-top: 24px; display: flex; gap: 12px;">
                            <button type="submit" class="btn btn-primary">💾 Save Inventory Settings</button>
                            <button type="button" class="btn btn-secondary" onclick="Settings.resetInventorySettings()">
                                🔄 Reset to Defaults
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- Info Card -->
            <div class="card" style="background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);">
                <div class="card-body">
                    <h3 style="margin-bottom: 12px;">ℹ️ How It Works</h3>
                    <ul style="margin: 0; padding-left: 20px; color: #666;">
                        <li>These settings apply to <strong>all new items</strong> created in Master Item</li>
                        <li>Existing items keep their individual reorder settings</li>
                        <li>You can override these defaults for any specific item</li>
                        <li>Auto-reorder system checks stock levels daily at the specified time</li>
                        <li>PRs are generated automatically when stock falls below reorder point</li>
                    </ul>
                </div>
            </div>
        `;
    },

    // Save Inventory & Reorder Settings
    async saveInventoryReorderSettings(event) {
        event.preventDefault();
        const formData = new FormData(event.target);

        const config = Storage.get(Storage.KEYS.CONFIG) || {};

        config.inventoryReorder = {
            // Stock defaults
            defaultReorderPoint: parseInt(formData.get('defaultReorderPoint')),
            defaultMinStock: parseInt(formData.get('defaultMinStock')),
            defaultMaxStock: parseInt(formData.get('defaultMaxStock')),
            defaultLeadTimeDays: parseInt(formData.get('defaultLeadTimeDays')),

            // Auto-reorder system
            enableAutoReorder: formData.get('enableAutoReorder') === 'on',
            maxAutoPRValue: parseFloat(formData.get('maxAutoPRValue')),
            dailyCheckTime: formData.get('dailyCheckTime'),
            alertThreshold: parseFloat(formData.get('alertThreshold')) / 100, // Convert % to decimal
            autoApprovePR: formData.get('autoApprovePR') === 'on',

            // EOQ parameters
            holdingCostRate: parseFloat(formData.get('holdingCostRate')) / 100, // Convert % to decimal
            averageOrderCost: parseFloat(formData.get('averageOrderCost'))
        };

        await Storage.set(Storage.KEYS.CONFIG, config);
        this.showAlert('success', '✅ Inventory & Reorder settings saved successfully!');
    },

    async resetInventorySettings() {
        const confirmed = confirm(
            'Reset Inventory & Reorder Settings to defaults?\n\n' +
            'This will restore factory default values.\n\n' +
            'Continue?'
        );

        if (confirmed) {
            const config = Storage.get(Storage.KEYS.CONFIG) || {};
            config.inventoryReorder = {
                defaultReorderPoint: 100,
                defaultMinStock: 50,
                defaultMaxStock: 200,
                defaultLeadTimeDays: 7,
                enableAutoReorder: true,
                maxAutoPRValue: 10000000,
                dailyCheckTime: '08:00',
                alertThreshold: 0.8,
                autoApprovePR: false,
                holdingCostRate: 0.20,
                averageOrderCost: 500000
            };

            await Storage.set(Storage.KEYS.CONFIG, config);
            this.showAlert('success', '✅ Inventory settings reset to defaults!');
            setTimeout(() => this.render(), 1000);
        }
    },


    renderApprovalLimits(config) {
        return `
            <div class="card mb-3">
                <div class="card-header">
                    <h2 class="card-title">💰 Approval Limits Configuration</h2>
                    <p style="color: #666; font-size: 14px; margin-top: 8px;">
                        Configure automatic approval thresholds for payment and receipt vouchers
                    </p>
                </div>
                <div class="card-body">
                    <form onsubmit="Settings.saveApprovalLimits(event)">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
                            <!-- Payment Voucher Limits -->
                            <div>
                                <h3 style="margin-bottom: 16px; color: var(--color-primary);">📤 Payment Vouchers (BKK/BBK)</h3>
                                
                                <div class="form-group">
                                    <label class="form-label">Petty Cash Limit</label>
                                    <input type="number" name="payment_petty_cash" class="form-input" 
                                           value="${config.payment_petty_cash || 500000}" step="100000" min="0" required>
                                    <small style="color: #666; display: block; margin-top: 4px;">
                                        🟢 Below this amount: Auto-post after kasir verification (skip all approvals)
                                    </small>
                                </div>

                                <div class="form-group">
                                    <label class="form-label">Small Expense Limit</label>
                                    <input type="number" name="payment_small_expense" class="form-input" 
                                           value="${config.payment_small_expense || 5000000}" step="500000" min="0" required>
                                    <small style="color: #666; display: block; margin-top: 4px;">
                                        🟡 Below this amount: Skip director approval (finance only)
                                    </small>
                                </div>

                                <div class="form-group">
                                    <label class="form-label">Medium Expense Limit</label>
                                    <input type="number" name="payment_medium_expense" class="form-input" 
                                           value="${config.payment_medium_expense || 50000000}" step="1000000" min="0" required>
                                    <small style="color: #666; display: block; margin-top: 4px;">
                                        🔴 Below this amount: Require full approval (finance + director)
                                    </small>
                                </div>
                            </div>

                            <!-- Receipt Voucher Limits -->
                            <div>
                                <h3 style="margin-bottom: 16px; color: var(--color-success);">📥 Receipt Vouchers (BKM/BBM)</h3>
                                
                                <div class="form-group">
                                    <label class="form-label">Small Receipt Limit</label>
                                    <input type="number" name="receipt_petty_cash" class="form-input" 
                                           value="${config.receipt_petty_cash || 1000000}" step="100000" min="0" required>
                                    <small style="color: #666; display: block; margin-top: 4px;">
                                        🟢 Below this amount: Auto-post after kasir verification
                                    </small>
                                </div>

                                <div class="form-group">
                                    <label class="form-label">Medium Receipt Limit</label>
                                    <input type="number" name="receipt_small_receipt" class="form-input" 
                                           value="${config.receipt_small_receipt || 10000000}" step="1000000" min="0" required>
                                    <small style="color: #666; display: block; margin-top: 4px;">
                                        🟡 Below this amount: Skip director approval (finance only)
                                    </small>
                                </div>
                            </div>
                        </div>

                        <div style="margin-top: 24px; display: flex; gap: 12px;">
                            <button type="submit" class="btn btn-primary">💾 Save Approval Limits</button>
                            <button type="button" class="btn btn-secondary" onclick="Settings.resetApprovalLimits()">
                                🔄 Reset to Defaults
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    },

    // NEW: Render Payroll Rules Tab
    renderPayrollTab() {
        const settings = Storage.getOvertimeSettings();
        const departments = Storage.getDepartments();

        return `
            <div class="card mb-4">
                <div class="card-header">
                    <h2 class="card-title">⏰ Overtime & Production Rules</h2>
                    <p class="text-gray" style="margin-top: 8px;">
                        Configure overtime caps by department and production incentive rates.
                    </p>
                </div>
                <div class="card-body">
                    <form onsubmit="Settings.savePayrollSettings(event)">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 32px;">
                            <!-- Overtime Caps Section -->
                            <div>
                                <h3 style="margin-bottom: 20px; color: var(--color-primary); border-bottom: 1px solid #ddd; padding-bottom: 8px;">
                                   ⏳ Overtime Caps (Hours/Day)
                                </h3>
                                <p class="text-gray small mb-3">Maximum hours of overtime that will be paid for each department.</p>
                                
                                <div class="form-group">
                                    <label class="form-label">Default Cap (Applied if not specified below)</label>
                                    <div class="input-group">
                                        <input type="number" name="cap_DEFAULT" class="form-input" value="${settings.caps.DEFAULT || 1}" min="0" step="0.5" required>
                                        <span class="input-group-text">Hours</span>
                                    </div>
                                </div>

                                <div style="margin-top: 16px; display: flex; flex-direction: column; gap: 12px;">
                                    ${departments.map(dept => `
                                        <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px; background: var(--bg-tertiary); border-radius: 4px;">
                                            <div>
                                                <strong>${dept.name}</strong><br>
                                                <small class="text-gray">${dept.code}</small>
                                            </div>
                                            <div style="width: 120px;">
                                                <input type="number" name="cap_${dept.code}" class="form-input text-center" 
                                                       value="${settings.caps[dept.code] !== undefined ? settings.caps[dept.code] : settings.caps.DEFAULT}" 
                                                       min="0" step="0.5">
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>

                            <!-- Production Rates Section -->
                            <div>
                                <h3 style="margin-bottom: 20px; color: var(--color-success); border-bottom: 1px solid #ddd; padding-bottom: 8px;">
                                   ⚖️ Production Incentive
                                </h3>
                                <p class="text-gray small mb-3">Incentive paid to Production department based on gram output.</p>
                                
                                <div class="form-group">
                                    <label class="form-label">Production Rate per Gram (Rp)</label>
                                    <div class="input-group">
                                        <span class="input-group-text">Rp</span>
                                        <input type="number" name="productionRate" class="form-input" 
                                               value="${settings.productionRate || 25000}" min="0" step="100" required>
                                        <span class="input-group-text">/ gram</span>
                                    </div>
                                    <small class="text-gray mt-1 block">Initial target: Rp 25,000 / gram</small>
                                </div>

                                <div class="card bg-info-light mt-4" style="border: 1px dashed var(--color-info);">
                                    <div class="card-body">
                                        <h4 style="margin-bottom: 8px;">💡 Info</h4>
                                        <ul class="small" style="padding-left: 20px;">
                                            <li>Overtime logic applies to ALL departments.</li>
                                            <li>Production incentive ONLY applies to employees in <strong>PROD</strong> department.</li>
                                            <li>Ensure employees have the correct department set in <strong>Master Karyawan</strong>.</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Attendance Rules -->
                        <div style="margin-top: 32px; border-top: 1px solid #ddd; padding-top: 24px;">
                            <h3 style="margin-bottom: 20px; color: var(--color-warning); border-bottom: 1px solid #ddd; padding-bottom: 8px;">
                                🕐 Attendance Rules
                            </h3>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px;">
                                <div class="form-group">
                                    <label class="form-label">Toleransi Keterlambatan (menit)</label>
                                    <div class="input-group">
                                        <input type="number" name="lateToleranceMinutes" class="form-input"
                                               value="${settings.lateToleranceMinutes !== undefined ? settings.lateToleranceMinutes : 0}"
                                               min="0" max="60" step="1">
                                        <span class="input-group-text">menit</span>
                                    </div>
                                    <small class="text-gray" style="display:block; margin-top: 4px;">
                                        ⏱️ Karyawan yang absen masuk <strong>lebih dari X menit</strong> setelah jam shift mulai akan dihitung terlambat.
                                        <br>Contoh: nilai <strong>15</strong> → absen masuk pukul 08:16 untuk shift 08:00 akan dihitung terlambat.
                                    </small>
                                </div>
                            </div>
                        </div>

                        <!-- BPJS & JHT Rates -->
                        <div style="margin-top: 32px; border-top: 1px solid #ddd; padding-top: 24px;">
                            <h3 style="margin-bottom: 20px; color: var(--color-info); border-bottom: 1px solid #ddd; padding-bottom: 8px;">
                                🛡️ Deductions & Benefits (BPJS/JHT)
                            </h3>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
                                <div class="form-group">
                                    <label class="form-label">BPJS Kesehatan (Employee %)</label>
                                    <input type="number" name="bpjs_health_emp" class="form-input" value="${settings.bpjs_health_emp || 1}" step="0.1">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">JHT (Employee %)</label>
                                    <input type="number" name="jht_emp" class="form-input" value="${settings.jht_emp || 2}" step="0.1">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">BPJS Kesehatan (Company %)</label>
                                    <input type="number" name="bpjs_health_comp" class="form-input" value="${settings.bpjs_health_comp || 4}" step="0.1">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">JHT (Company %)</label>
                                    <input type="number" name="jht_comp" class="form-input" value="${settings.jht_comp || 3.7}" step="0.1">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">JKK (Company %)</label>
                                    <input type="number" name="jkk_comp" class="form-input" value="${settings.jkk_comp || 0.24}" step="0.01">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">JKM (Company %)</label>
                                    <input type="number" name="jkm_comp" class="form-input" value="${settings.jkm_comp || 0.3}" step="0.01">
                                </div>
                            </div>
                        </div>

                        <div style="margin-top: 32px; border-top: 1px solid #eee; padding-top: 16px; display: flex; gap: 12px;">
                            <button type="submit" class="btn btn-primary">💾 Save Payroll Rules</button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- Holiday Management Section -->
            <div class="card">
                <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h2 class="card-title">📅 Tanggal Merah & Libur Nasional</h2>
                        <p class="text-gray" style="margin-top: 4px;">Digunakan untuk perhitungan Gaji Harian (Basis Hari Kerja).</p>
                    </div>
                </div>
                <div class="card-body">
                    <div style="display: flex; gap: 12px; margin-bottom: 24px; background: var(--bg-tertiary); padding: 16px; border-radius: 8px;">
                        <div style="flex: 2;">
                            <label class="form-label">Nama Libur</label>
                            <input type="text" id="holiday-name" class="form-input" placeholder="e.g. Tahun Baru">
                        </div>
                        <div style="flex: 1;">
                            <label class="form-label">Tanggal</label>
                            <input type="date" id="holiday-date" class="form-input">
                        </div>
                        <div style="display: flex; align-items: flex-end;">
                            <button class="btn btn-info" onclick="Settings.addHoliday()">➕ Tambah</button>
                        </div>
                    </div>

                    <div id="holiday-list-container">
                        ${this.renderHolidayTable()}
                    </div>
                </div>
            </div>
        `;
    },

    renderHolidayTable() {
        const holidays = Storage.getHolidays().sort((a, b) => new Date(a.date) - new Date(b.date));
        if (holidays.length === 0) return '<p class="text-center text-gray">Belum ada hari libur nasional yang didaftarkan.</p>';

        return `
            <table class="table">
                <thead>
                    <tr>
                        <th>Tanggal</th>
                        <th>Nama Libur</th>
                        <th class="text-center">Aksi</th>
                    </tr>
                </thead>
                <tbody>
                    ${holidays.map((h, idx) => `
                        <tr>
                            <td>${new Date(h.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
                            <td><strong>${h.name}</strong></td>
                            <td class="text-center">
                                <button class="btn-icon text-error" onclick="Settings.deleteHoliday(${idx})" title="Hapus">
                                    🗑️
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    async addHoliday() {
        const name = document.getElementById('holiday-name').value;
        const date = document.getElementById('holiday-date').value;

        if (!name || !date) {
            alert('Silakan isi nama dan tanggal libur.');
            return;
        }

        const holidays = Storage.getHolidays();
        holidays.push({ name, date });
        await Storage.saveHolidays(holidays);

        document.getElementById('holiday-name').value = '';
        document.getElementById('holiday-date').value = '';
        document.getElementById('holiday-list-container').innerHTML = this.renderHolidayTable();
        this.showAlert('success', '✅ Hari libur ditambahkan.');
    },

    async deleteHoliday(index) {
        if (!confirm('Hapus hari libur ini?')) return;

        const holidays = Storage.getHolidays();
        holidays.splice(index, 1);
        await Storage.saveHolidays(holidays);

        document.getElementById('holiday-list-container').innerHTML = this.renderHolidayTable();
    },

    savePayrollSettings(event) {
        event.preventDefault();
        const formData = new FormData(event.target);

        const settings = {
            caps: {},
            productionRate: parseFloat(formData.get('productionRate')) || 0,
            lateToleranceMinutes: parseInt(formData.get('lateToleranceMinutes')) || 0,
            bpjs_health_emp: parseFloat(formData.get('bpjs_health_emp')) || 0,
            jht_emp: parseFloat(formData.get('jht_emp')) || 0,
            bpjs_health_comp: parseFloat(formData.get('bpjs_health_comp')) || 0,
            jht_comp: parseFloat(formData.get('jht_comp')) || 0,
            jkk_comp: parseFloat(formData.get('jkk_comp')) || 0,
            jkm_comp: parseFloat(formData.get('jkm_comp')) || 0
        };

        // Extract caps
        for (let [key, value] of formData.entries()) {
            if (key.startsWith('cap_')) {
                const deptCode = key.replace('cap_', '');
                settings.caps[deptCode] = parseFloat(value) || 0;
            }
        }

        Storage.saveOvertimeSettings(settings);
        this.showAlert('success', '✅ Payroll rules saved successfully!');

        // Refresh after saving
        setTimeout(() => this.render(), 1000);
    },

    renderCompanySettings(config) {
        return `
            <div class="card mb-3">
                <div class="card-header">
                    <h2 class="card-title">🏢 Company Information & Logo</h2>
                </div>
                <div class="card-body">
                    <form onsubmit="Settings.saveCompanyInfo(event)">
                        <div class="form-group" style="background: var(--bg-tertiary); padding: 16px; border-radius: var(--radius-md); border: 1px dashed var(--border-glass); margin-bottom: 20px;">
                            <label class="form-label">Company Logo (JPEG / PNG)</label>
                            <div style="display: flex; gap: 20px; align-items: center; flex-wrap: wrap;">
                                <div id="logo-preview" style="display: ${config.logo ? 'block' : 'none'};">
                                    <img src="${config.logo || ''}" style="max-height: 80px; border: 1px solid var(--border-glass); border-radius: var(--radius-md); padding: 5px; background: white;">
                                </div>
                                <div style="flex: 1; min-width: 200px;">
                                    <input type="file" id="company-logo-input" accept="image/*" class="form-input" onchange="Settings.previewLogo(this)" style="padding: 8px 12px; margin-bottom: 8px;">
                                    <input type="hidden" name="logo" id="company-logo-base64" value="${config.logo || ''}">
                                    <small class="text-gray">Upload logo berformat PNG/JPEG. Logo ini akan otomatis disematkan pada Purchase Order, Invoice, Surat Jalan, dan Tanda Terima.</small>
                                </div>
                            </div>
                        </div>

                        <div class="form-group" style="background: var(--bg-tertiary); padding: 16px; border-radius: var(--radius-md); border: 1px dashed var(--border-glass); margin-bottom: 20px;">
                            <label class="form-label">Tanda Tangan Direktur / Director's Signature (JPEG / PNG)</label>
                            <div style="display: flex; gap: 20px; align-items: center; flex-wrap: wrap;">
                                <div id="director-signature-preview" style="display: ${config.directorSignature ? 'block' : 'none'};">
                                    <img src="${config.directorSignature || ''}" style="max-height: 80px; border: 1px solid var(--border-glass); border-radius: var(--radius-md); padding: 5px; background: white;">
                                </div>
                                <div style="flex: 1; min-width: 200px;">
                                    <input type="file" id="director-signature-input" accept="image/*" class="form-input" onchange="Settings.previewSignature(this)" style="padding: 8px 12px; margin-bottom: 8px;">
                                    <input type="hidden" name="directorSignature" id="director-signature-base64" value="${config.directorSignature || ''}">
                                    <small class="text-gray">Upload tanda tangan digital berformat PNG/JPEG dengan background transparan/putih. Tanda tangan ini akan otomatis disematkan pada Purchase Order (PO) setelah direktur menyetujui (Approve).</small>
                                </div>
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Company Name</label>
                                <input type="text" name="companyName" class="form-input" 
                                       value="${config.companyName || ''}" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label">NPWP</label>
                                <input type="text" name="npwp" class="form-input" 
                                       value="${config.npwp || ''}">
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Address</label>
                            <textarea name="address" class="form-input" rows="2">${config.address || ''}</textarea>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Phone</label>
                                <input type="text" name="phone" class="form-input" 
                                       value="${config.phone || ''}">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Email</label>
                                <input type="email" name="email" class="form-input" 
                                       value="${config.email || ''}">
                            </div>
                        </div>
                        <button type="submit" class="btn btn-primary">💾 Save Configuration</button>
                    </form>
                </div>
            </div>
        `;
    },

    renderImportExport() {
        return `
            <div class="card mb-3">
                <div class="card-header">
                    <h2 class="card-title">📤 Import / Export Data</h2>
                </div>
                <div class="card-body">
                    <h3 style="margin-bottom: 16px;">📊 Import Chart of Accounts from Excel</h3>
                    <div style="background: #e3f2fd; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                        <strong>📋 Format Excel yang dibutuhkan:</strong>
                        <table class="table" style="margin-top: 12px; background: white;">
                            <thead>
                                <tr>
                                    <th>code</th>
                                    <th>name</th>
                                    <th>type</th>
                                    <th>category</th>
                                    <th>balance</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>1110</td>
                                    <td>Kas</td>
                                    <td>detail</td>
                                    <td>aset</td>
                                    <td>0</td>
                                </tr>
                                <tr>
                                    <td>1120</td>
                                    <td>Bank</td>
                                    <td>header</td>
                                    <td>aset</td>
                                    <td>0</td>
                                </tr>
                            </tbody>
                        </table>
                        <p style="margin: 12px 0 0; font-size: 14px;">
                            <strong>Note:</strong> 
                            • <code>type</code>: header atau detail<br>
                            • <code>category</code>: aset, kewajiban, ekuitas, pendapatan, beban<br>
                            • File format: .xlsx atau .csv
                        </p>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                        <div>
                            <label class="form-label">📥 Import COA Excel/CSV</label>
                            <input type="file" id="import-coa-file" accept=".xlsx,.xls,.csv" class="form-input" 
                                   onchange="Settings.handleCOAImport(event)">
                            <small class="form-help">
                                Upload file Excel/CSV dengan format di atas. Data akan otomatis di-parsing dan disimpan.
                            </small>
                        </div>
                        <div>
                            <label class="form-label">📥 Import All Data (Backup)</label>
                            <input type="file" id="import-backup-file" accept=".json" class="form-input"
                                   onchange="Settings.handleBackupImport(event)">
                            <small class="form-help">
                                Import backup file (JSON format) untuk restore semua data sistem.
                            </small>
                        </div>
                    </div>

                    <hr style="margin: 24px 0;">

                    <h3 style="margin-bottom: 16px;">📤 Export Data</h3>
                    <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                        <button class="btn btn-secondary" onclick="Settings.exportCOATemplate()">
                            📄 Download COA Template (Excel)
                        </button>
                        <button class="btn btn-secondary" onclick="Settings.exportCurrentCOA()">
                            📊 Export Current COA (CSV)
                        </button>
                        <button class="btn btn-secondary" onclick="Storage.exportData()">
                            💾 Backup All Data (JSON)
                        </button>
                        <button class="btn btn-secondary" onclick="Storage.exportConfigOnly()">
                            ⚙️ Export Config Only (JSON)
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    renderDataManagement() {
        return `
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">☁️ Cloud Data Management</h2>
                </div>
                <div class="card-body">
                    
                    <!-- Restore Section -->
                    <div style="background: #e3f2fd; padding: 16px; border-radius: 4px; margin-bottom: 20px;">
                        <h3 style="margin: 0 0 10px 0; color: #1565c0;">📥 Restore Data from Cloud</h3>
                        <p style="margin: 0 0 15px 0; color: #555; font-size: 14px;">
                            Jika Local Storage Anda terhapus atau Anda ganti device, gunakan tombol ini untuk menarik data dari Cloud.
                        </p>
                        <button class="btn btn-info" onclick="Settings.restoreFromCloud()">
                            ☁️ Restore / Pull from Cloud
                        </button>
                    </div>

                    <hr style="margin: 20px 0;">

                    <!-- Danger Zone -->
                    <h3 style="margin: 0 0 10px 0; color: #c62828;">🚫 Danger Zone</h3>
                    <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; border-radius: 4px; margin-bottom: 16px;">
                        <strong>⚠️ Warning:</strong> Operasi berikut bersifat permanen dan tidak dapat di-undo!
                    </div>
                    <button class="btn btn-danger" onclick="Settings.confirmClearAllData()">
                        🗑️ Clear All Local Data
                    </button>
                </div>
            </div>
        `;
    },

    // Restore from Cloud
    async restoreFromCloud() {
        // Check availability
        if (typeof FirebaseSync === 'undefined' || !FirebaseSync.isEnabled()) {
            this.showAlert('error', '❌ Cloud Storage (Firebase) is not connected!');
            return;
        }

        const confirmed = confirm(
            '⚠️ WARNING: Restore from Cloud?\n\n' +
            'This will OVERWRITE your local data with the version from Cloud.\n\n' +
            'Use this if your local data is missing or corrupted.\n\n' +
            'Continue?'
        );

        if (confirmed) {
            this.showAlert('info', '⏳ Pulling data from Cloud... This may take a moment.');
            try {
                const count = await FirebaseSync.pullAllFromCloud();
                this.showAlert('success', `✅ Successfully restored ${count} records from Cloud! Page will reload.`);
                setTimeout(() => window.location.reload(), 2000);
            } catch (error) {
                console.error('Restore failed:', error);
                this.showAlert('error', `❌ Restore failed: ${error.message}`);
            }
        }
    },

    // Save company info
    async saveCompanyInfo(event) {
        event.preventDefault();
        const formData = new FormData(event.target);

        // FIX: Load existing config to ensure we don't wipe out other settings (like inventoryReorder)
        const config = Storage.get(Storage.KEYS.CONFIG) || {};

        config.companyName = formData.get('companyName');
        config.npwp = formData.get('npwp');
        config.address = formData.get('address');
        config.phone = formData.get('phone');
        config.email = formData.get('email');
        config.logo = formData.get('logo') || '';
        config.directorSignature = formData.get('directorSignature') || '';
        config.updatedAt = new Date().toISOString();

        await Storage.set(Storage.KEYS.CONFIG, config);
        this.showAlert('success', '✅ Company information saved successfully!');
    },

    // Preview and convert company logo to Base64
    previewLogo(input) {
        const file = input.files[0];
        if (!file) return;

        // Validate file type is image
        if (!file.type.match('image.*')) {
            this.showAlert('error', '❌ File must be an image (JPEG/PNG).');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const base64Str = e.target.result;
            
            // Set input hidden base64
            const base64Input = document.getElementById('company-logo-base64');
            if (base64Input) {
                base64Input.value = base64Str;
            }
            
            // Set image preview src & show preview container
            const previewContainer = document.getElementById('logo-preview');
            if (previewContainer) {
                previewContainer.style.display = 'block';
                const img = previewContainer.querySelector('img');
                if (img) {
                    img.src = base64Str;
                }
            }
        };
        reader.readAsDataURL(file);
    },

    // Preview and convert director signature to Base64
    previewSignature(input) {
        const file = input.files[0];
        if (!file) return;

        // Validate file type is image
        if (!file.type.match('image.*')) {
            this.showAlert('error', '❌ File must be an image (JPEG/PNG).');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const base64Str = e.target.result;
            
            // Set input hidden base64
            const base64Input = document.getElementById('director-signature-base64');
            if (base64Input) {
                base64Input.value = base64Str;
            }
            
            // Set image preview src & show preview container
            const previewContainer = document.getElementById('director-signature-preview');
            if (previewContainer) {
                previewContainer.style.display = 'block';
                const img = previewContainer.querySelector('img');
                if (img) {
                    img.src = base64Str;
                }
            }
        };
        reader.readAsDataURL(file);
    },

    // Handle COA Excel/CSV import
    async handleCOAImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        this.showAlert('info', '⏳ Processing file...');

        try {
            const extension = file.name.split('.').pop().toLowerCase();

            if (extension === 'csv') {
                await this.importCOAFromCSV(file);
            } else if (extension === 'xlsx' || extension === 'xls') {
                await this.importCOAFromExcel(file);
            } else {
                throw new Error('Unsupported file format. Please use .csv or .xlsx');
            }
        } catch (error) {
            this.showAlert('error', `❌ Import failed: ${error.message}`);
        }
    },

    // Import from CSV
    async importCOAFromCSV(file) {
        const text = await file.text();
        const lines = text.split('\n').filter(line => line.trim());

        if (lines.length < 2) {
            throw new Error('File is empty or has no data rows');
        }

        // Parse header
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));

        // Validate required columns
        const requiredCols = ['code', 'name', 'type', 'category'];
        const missingCols = requiredCols.filter(col => !headers.includes(col));
        if (missingCols.length > 0) {
            throw new Error(`Missing required columns: ${missingCols.join(', ')}`);
        }

        // Parse data rows
        const accounts = [];
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
            if (values.length < headers.length) continue;

            const account = {};
            headers.forEach((header, idx) => {
                account[header] = values[idx];
            });

            // Validate and transform
            account.balance = parseFloat(account.balance) || 0;
            account.code = account.code.toString();

            if (!account.code || !account.name) continue;

            accounts.push(account);
        }

        if (accounts.length === 0) {
            throw new Error('No valid accounts found in file');
        }

        // Confirm before import
        const confirmed = confirm(
            `Found ${accounts.length} accounts to import.\n\n` +
            `This will REPLACE your current Chart of Accounts.\n\n` +
            `Continue?`
        );

        if (!confirmed) {
            this.showAlert('info', 'Import cancelled');
            return;
        }

        // Save to storage
        await Storage.set(Storage.KEYS.CHART_OF_ACCOUNTS, accounts);

        this.showAlert('success', `✅ Successfully imported ${accounts.length} accounts!`);

        // Clear file input
        document.getElementById('import-coa-file').value = '';

        // Refresh page in 2 seconds
        setTimeout(() => {
            this.render();
            ChartOfAccounts.loadAccounts();
        }, 2000);
    },

    // Import from Excel (requires xlsx library)
    async importCOAFromExcel(file) {
        // Check if xlsx library is loaded
        if (typeof XLSX === 'undefined') {
            // Load xlsx library dynamically
            await this.loadXLSXLibrary();
        }

        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });

                // Get first sheet
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];

                // Convert to JSON
                const jsonData = XLSX.utils.sheet_to_json(worksheet);

                if (jsonData.length === 0) {
                    throw new Error('Excel file is empty');
                }

                // Validate and transform
                const accounts = jsonData.map(row => ({
                    code: (row.code || row.Code || row.CODE || '').toString(),
                    name: row.name || row.Name || row.NAME || '',
                    type: (row.type || row.Type || row.TYPE || 'detail').toLowerCase(),
                    category: (row.category || row.Category || row.CATEGORY || '').toLowerCase(),
                    balance: parseFloat(row.balance || row.Balance || row.BALANCE || 0)
                })).filter(acc => acc.code && acc.name);

                if (accounts.length === 0) {
                    throw new Error('No valid accounts found in Excel file');
                }

                // Confirm before import
                const confirmed = confirm(
                    `Found ${accounts.length} accounts to import.\n\n` +
                    `This will REPLACE your current Chart of Accounts.\n\n` +
                    `Continue?`
                );

                if (!confirmed) {
                    this.showAlert('info', 'Import cancelled');
                    return;
                }

                // Save to storage
                await Storage.set(Storage.KEYS.CHART_OF_ACCOUNTS, accounts);

                this.showAlert('success', `✅ Successfully imported ${accounts.length} accounts from Excel!`);

                // Clear file input
                document.getElementById('import-coa-file').value = '';

                // Refresh page
                setTimeout(() => {
                    this.render();
                    ChartOfAccounts.loadAccounts();
                }, 2000);

            } catch (error) {
                this.showAlert('error', `❌ Excel parsing failed: ${error.message}`);
            }
        };

        reader.onerror = () => {
            this.showAlert('error', '❌ Failed to read Excel file');
        };

        reader.readAsArrayBuffer(file);
    },

    // Load XLSX library dynamically
    loadXLSXLibrary() {
        return new Promise((resolve, reject) => {
            if (typeof XLSX !== 'undefined') {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load XLSX library'));
            document.head.appendChild(script);
        });
    },

    // Export COA template
    exportCOATemplate() {
        const template = [
            { code: '1110', name: 'Kas', type: 'detail', category: 'aset', balance: 0 },
            { code: '1120', name: 'Bank', type: 'header', category: 'aset', balance: 0 },
            { code: '1121', name: 'Bank BCA', type: 'detail', category: 'aset', balance: 0 },
            { code: '2110', name: 'Hutang Usaha', type: 'detail', category: 'kewajiban', balance: 0 },
            { code: '3100', name: 'Modal Disetor', type: 'detail', category: 'ekuitas', balance: 0 },
            { code: '4110', name: 'Pendapatan Penjualan', type: 'detail', category: 'pendapatan', balance: 0 },
            { code: '5110', name: 'Beban Gaji', type: 'detail', category: 'beban', balance: 0 }
        ];

        // Create CSV
        const headers = ['code', 'name', 'type', 'category', 'balance'];
        let csv = headers.join(',') + '\n';
        template.forEach(row => {
            csv += `${row.code},"${row.name}",${row.type},${row.category},${row.balance}\n`;
        });

        // Download
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'chart-of-accounts-template.csv';
        a.click();
        URL.revokeObjectURL(url);

        this.showAlert('success', '✅ Template downloaded! Use this as a reference for your import file.');
    },

    // Export current COA
    exportCurrentCOA() {
        const accounts = Storage.get(Storage.KEYS.CHART_OF_ACCOUNTS) || [];

        if (accounts.length === 0) {
            this.showAlert('warning', 'No accounts to export');
            return;
        }

        // Create CSV
        const headers = ['code', 'name', 'type', 'category', 'balance'];
        let csv = headers.join(',') + '\n';
        accounts.forEach(acc => {
            csv += `${acc.code},"${acc.name}",${acc.type},${acc.category},${acc.balance || 0}\n`;
        });

        // Download
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chart-of-accounts-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);

        this.showAlert('success', `✅ Exported ${accounts.length} accounts successfully!`);
    },

    // Handle backup import
    handleBackupImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        Storage.importData(file)
            .then(async (importedData) => {
                if (importedData) {
                    this.showAlert('success', '✅ Data berhasil diimpor secara lokal!');

                    // Check if Firebase is enabled for Cloud Sync
                    if (typeof FirebaseSync !== 'undefined' && FirebaseSync.isEnabled() && window.auth?.currentUser) {
                        const shouldSync = confirm(
                            '☁️ KEAMANAN CLOUD:\n\n' +
                            'Data Anda sudah berhasil diimpor di komputer ini.\n' +
                            'Apakah Anda ingin mengunggah (PUSH) data ini ke Cloud juga?\n\n' +
                            'Sangat disarankan agar data Anda tidak ter-reset otomatis oleh data Cloud yang lama saat refresh.'
                        );

                        if (shouldSync) {
                            this.showAlert('info', '⏳ Sedang mengunggah data ke Cloud... Mohon tunggu.');
                            try {
                                await FirebaseSync.migrateAllToCloud();
                                this.showAlert('success', '🚀 Data BERHASIL diunggah ke Cloud! Sistem akan memuat ulang.');
                            } catch (err) {
                                console.error('Cloud Sync failed:', err);
                                alert('Error saat sinkronisasi Cloud: ' + err.message);
                            }
                        }
                    }

                    setTimeout(() => window.location.reload(), 1500);
                } else {
                    this.showAlert('info', 'Import dibatalkan');
                }
            })
            .catch(error => {
                console.error('Import failed:', error);
                this.showAlert('error', `❌ Import gagal: ${error.message}`);
            });
    },

    // Confirm clear all data
    confirmClearAllData() {
        const confirmed = confirm(
            '⚠️ WARNING: This will DELETE ALL DATA!\n\n' +
            'This includes:\n' +
            '- Chart of Accounts\n' +
            '- Journal Entries\n' +
            '- Master Data\n' +
            '- All transactions\n\n' +
            'This action CANNOT be undone!\n\n' +
            'Are you ABSOLUTELY sure?'
        );

        if (confirmed) {
            const doubleConfirm = confirm(
                'Final confirmation:\n\n' +
                'Type YES in the next prompt to confirm deletion'
            );

            if (doubleConfirm) {
                const userInput = prompt('Type YES to confirm:');
                if (userInput === 'YES') {
                    Storage.clearAll();
                    this.showAlert('success', 'All data cleared. Page will reload...');
                    setTimeout(() => window.location.reload(), 2000);
                } else {
                    this.showAlert('info', 'Deletion cancelled - wrong confirmation text');
                }
            }
        }
    },

    // ==========================================
    // Account Mapping Configuration
    // ==========================================

    renderAccountMapping() {
        const mapping = Storage.getAccountMapping();
        const validation = Storage.validateAccountMapping();

        return `
            <div class="card mb-3">
                <div class="card-header">
                    <h2 class="card-title">🔗 Account Mapping Configuration</h2>
                    <p style="margin: 8px 0 0; font-size: 14px; color: #666;">
                        Configure which accounts are used by Simple Transaction templates
                    </p>
                </div>
                <div class="card-body">
                    ${!validation.valid ? this.renderValidationWarnings(validation) : ''}
                    
                    <form onsubmit="Settings.saveAccountMapping(event)">
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">
                            
                            <!-- ASSETS -->
                            <div>
                                <h3 style="margin-bottom: 16px; color: #1976d2;">💰 Assets</h3>
                                ${this.renderMappingField('cash', 'Kas (Cash)', mapping.cash)}
                                ${this.renderMappingField('bank', 'Bank', mapping.bank)}
                                ${this.renderMappingField('inventory', 'Persediaan Umum (Inventory)', mapping.inventory)}
                                ${this.renderMappingField('accounts_receivable', 'Piutang Usaha (AR)', mapping.accounts_receivable)}
                                ${this.renderMappingField('raw_gold_inventory', 'Persediaan Emas Mentah', mapping.raw_gold_inventory)}
                                ${this.renderMappingField('gold_in_lab', 'Emas Dalam Lab', mapping.gold_in_lab)}
                                ${this.renderMappingField('chemicals_inventory', 'Persediaan Chemicals', mapping.chemicals_inventory)}
                                ${this.renderMappingField('wip', 'Work in Progress', mapping.wip)}
                                ${this.renderMappingField('gold_consignment', 'Emas Titipan Customer', mapping.gold_consignment)}
                            </div>

                            <!-- LIABILITIES & EQUITY -->
                            <div>
                                <h3 style="margin-bottom: 16px; color: #d32f2f;">📊 Liabilities & Equity</h3>
                                ${this.renderMappingField('accounts_payable', 'Hutang Usaha (AP)', mapping.accounts_payable)}
                                ${this.renderMappingField('gold_payable', 'Hutang Supplier Emas', mapping.gold_payable)}
                                ${this.renderMappingField('long_term_debt', 'Hutang Jangka Panjang', mapping.long_term_debt)}
                                ${this.renderMappingField('capital', 'Modal Disetor', mapping.capital)}
                                ${this.renderMappingField('drawings', 'Prive', mapping.drawings)}
                            </div>

                            <!-- REVENUE -->
                            <div>
                                <h3 style="margin-bottom: 16px; color: #388e3c;">💵 Revenue</h3>
                                ${this.renderMappingField('sales_revenue', 'Pendapatan Penjualan', mapping.sales_revenue)}
                                ${this.renderMappingField('gold_bar_revenue', 'Pendapatan Gold Bar', mapping.gold_bar_revenue)}
                                ${this.renderMappingField('gold_grain_revenue', 'Pendapatan Gold Grain', mapping.gold_grain_revenue)}
                                ${this.renderMappingField('refining_service_revenue', 'Pendapatan Jasa Refining', mapping.refining_service_revenue)}
                                ${this.renderMappingField('other_income', 'Pendapatan Lain-lain', mapping.other_income)}
                            </div>

                            <!-- EXPENSES -->
                            <div>
                                <h3 style="margin-bottom: 16px; color: #f57c00;">💸 Expenses</h3>
                                ${this.renderMappingField('cogs', 'HPP / COGS', mapping.cogs)}
                                ${this.renderMappingField('salary_expense', 'Beban Gaji', mapping.salary_expense)}
                                ${this.renderMappingField('rent_expense', 'Beban Sewa', mapping.rent_expense)}
                                ${this.renderMappingField('utilities_expense', 'Beban Listrik/Air', mapping.utilities_expense)}
                                ${this.renderMappingField('supplies_expense', 'Beban Perlengkapan', mapping.supplies_expense)}
                                ${this.renderMappingField('transport_expense', 'Beban Transport', mapping.transport_expense)}
                                ${this.renderMappingField('interest_expense', 'Beban Bunga', mapping.interest_expense)}
                            </div>
                        </div>

                        <hr style="margin: 24px 0;">

                        <div style="display: flex; gap: 12px; align-items: center;">
                            <button type="submit" class="btn btn-primary">💾 Save Mapping</button>
                            <button type="button" class="btn btn-secondary" onclick="Settings.resetAccountMapping()">
                                🔄 Reset to Defaults
                            </button>
                            <button type="button" class="btn btn-secondary" onclick="Settings.validateAndShowResults()">
                                ✓ Validate Mapping
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    },

    renderMappingField(purpose, label, currentValue) {
        return `
            <div class="form-group" style="margin-bottom: 12px;">
                <label class="form-label" style="font-size: 13px; font-weight: 500;">
                    ${label}
                </label>
                <select name="${purpose}" class="form-input account-mapping-select" 
                        data-purpose="${purpose}" data-current="${currentValue}"
                        style="font-family: monospace; font-size: 13px;">
                    <option value="">Loading...</option>
                </select>
            </div>
        `;
    },

    renderValidationWarnings(validation) {
        if (validation.errors.length === 0) return '';

        return `
            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; border-radius: 4px; margin-bottom: 20px;">
                <strong>⚠️ Validation Warnings:</strong>
                <ul style="margin: 8px 0 0; padding-left: 20px;">
                    ${validation.errors.map(err => `
                        <li><code>${err.purpose}</code> → <code>${err.code}</code>: ${err.error}</li>
                    `).join('')}
                </ul>
                <p style="margin: 12px 0 0; font-size: 13px;">
                    Please update these mappings to use valid detail accounts from your Master COA.
                </p>
            </div>
        `;
    },

    initializeAccountMappingDropdowns() {
        // Get all detail accounts from Master COA
        const detailAccounts = ChartOfAccounts.getDetailAccounts();

        if (!detailAccounts || detailAccounts.length === 0) {
            console.warn('No detail accounts found in Master COA');
            return;
        }

        // Populate all dropdowns
        const selects = document.querySelectorAll('.account-mapping-select');
        selects.forEach(select => {
            const currentValue = select.dataset.current;

            // Clear loading option
            select.innerHTML = '';

            // Add blank option
            const blankOption = document.createElement('option');
            blankOption.value = '';
            blankOption.textContent = '-- Select Account --';
            select.appendChild(blankOption);

            // Add all detail accounts
            detailAccounts.forEach(account => {
                const option = document.createElement('option');
                option.value = account.code;
                option.textContent = `${account.code} - ${account.name}`;

                if (account.code === currentValue) {
                    option.selected = true;
                }

                select.appendChild(option);
            });
        });
    },

    saveAccountMapping(event) {
        event.preventDefault();
        const formData = new FormData(event.target);

        const mapping = {};
        for (const [key, value] of formData.entries()) {
            if (value) {
                mapping[key] = value;
            }
        }

        // Merge with existing mapping (to preserve unmapped fields)
        const currentMapping = Storage.getAccountMapping();
        const updatedMapping = { ...currentMapping, ...mapping };

        Storage.setAccountMapping(updatedMapping);

        this.showAlert('success', '✅ Account mapping saved successfully!');

        // Refresh to show updated validation
        setTimeout(() => this.render(), 1000);
    },

    resetAccountMapping() {
        const confirmed = confirm(
            'Reset Account Mapping to defaults?\n\n' +
            'Your custom configuration will be lost.\n\n' +
            'Continue?'
        );

        if (confirmed) {
            Storage.resetAccountMapping();
            this.showAlert('success', '✅ Account mapping reset to defaults!');
            setTimeout(() => this.render(), 1000);
        }
    },

    validateAndShowResults() {
        const validation = Storage.validateAccountMapping();

        if (validation.valid) {
            this.showAlert('success', '✅ All account mappings are valid!');
        } else {
            const errorList = validation.errors.map(err =>
                `• ${err.purpose} (${err.code}): ${err.error}`
            ).join('\n');

            alert(
                '⚠️ Validation Errors Found:\n\n' +
                errorList +
                '\n\nPlease update these mappings in the form above.'
            );
        }
    },

    showAlert(type, message) {
        if (typeof ChartOfAccounts !== 'undefined' && ChartOfAccounts.showAlert) {
            ChartOfAccounts.showAlert(type, message);
        } else {
            alert(message);
        }
    },

    // Approval Limits Functions
    async saveApprovalLimits(event) {
        event.preventDefault();
        const formData = new FormData(event.target);

        const config = Storage.get(Storage.KEYS.CONFIG) || {};
        config.payment_petty_cash = parseInt(formData.get('payment_petty_cash'));
        config.payment_small_expense = parseInt(formData.get('payment_small_expense'));
        config.payment_medium_expense = parseInt(formData.get('payment_medium_expense'));
        config.receipt_petty_cash = parseInt(formData.get('receipt_petty_cash'));
        config.receipt_small_receipt = parseInt(formData.get('receipt_small_receipt'));
        config.updatedAt = new Date().toISOString();

        await Storage.set(Storage.KEYS.CONFIG, config);

        AuditLog.log('update', 'settings', 'approval_limits', 'Updated approval limits');
        this.showAlert('success', '✅ Approval limits saved successfully! Changes will apply to new vouchers immediately.');
    },

    async resetApprovalLimits() {
        if (!confirm('Reset approval limits to default values?\n\nDefaults:\n- Payment Petty Cash: 500K\n- Payment Small: 5M\n- Payment Medium: 50M\n- Receipt Small: 1M\n- Receipt Medium: 10M')) {
            return;
        }

        const config = Storage.get(Storage.KEYS.CONFIG) || {};
        config.payment_petty_cash = 500000;
        config.payment_small_expense = 5000000;
        config.payment_medium_expense = 50000000;
        config.receipt_petty_cash = 1000000;
        config.receipt_small_receipt = 10000000;
        config.updatedAt = new Date().toISOString();

        await Storage.set(Storage.KEYS.CONFIG, config);

        this.showAlert('success', '✅ Approval limits reset to defaults!');
        setTimeout(() => this.render(), 1000);
    }
};


// Explicitly make Settings globally available
window.Settings = Settings;
