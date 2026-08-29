// ==========================================
// Risk Monitor Module
// Background monitoring for critical events
// ==========================================

const RiskMonitor = {
    checkInterval: null,
    lastCheck: {},
    isRunning: false,

    // Configuration
    config: {
        checkIntervalMinutes: 30,
        initialDelayMinutes: 1,
        thresholds: {
            pendingApprovals: 5,       // Alert if > 5 pending
            criticalRisk: 80,          // Alert if risk > 80%
            lowStock: 10,              // Alert if > 10 items low
            alertCooldownHours: 4,     // Don't repeat same alert within 4 hours
            hppWarningMargin: 25,      // Alert WARNING jika Gross Margin < 25%
            hppCriticalMargin: 10      // Alert CRITICAL jika Gross Margin < 10%
        }
    },

    start() {
        if (this.isRunning) {
            console.log('⚠️ Risk Monitor already running');
            return;
        }

        // Check every 30 minutes
        const intervalMs = this.config.checkIntervalMinutes * 60 * 1000;
        this.checkInterval = setInterval(() => {
            this.performChecks();
        }, intervalMs);

        // Initial check after 1 minute
        const initialDelayMs = this.config.initialDelayMinutes * 60 * 1000;
        setTimeout(() => this.performChecks(), initialDelayMs);

        this.isRunning = true;
        console.log(`✅ Risk Monitor started (checks every ${this.config.checkIntervalMinutes} min)`);
    },

    stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
            this.isRunning = false;
            console.log('⏹️ Risk Monitor stopped');
        }
    },

    async performChecks() {
        const user = Auth.getCurrentUser();

        // Only monitor for Director role
        if (!user || (user.role !== 'DIRECTOR' && user.role !== 'director')) {
            console.log('⏭️ Skipping checks (not Director)');
            return;
        }

        console.log('🔍 Performing risk checks...');

        // Run all checks in parallel
        const results = await Promise.allSettled([
            this.checkPendingApprovals(),
            this.checkCriticalRisks(),
            this.checkLowStock(),
            this.checkHPPEfficiency()
        ]);

        // Log results
        results.forEach((result, index) => {
            const checkNames = ['Pending Approvals', 'Critical Risks', 'Low Stock', 'HPP Efficiency'];
            if (result.status === 'fulfilled') {
                console.log(`✅ ${checkNames[index]}: ${result.value}`);
            } else {
                console.error(`❌ ${checkNames[index]} failed:`, result.reason);
            }
        });
    },

    async checkPendingApprovals() {
        try {
            const pending = PaymentVoucher.getPendingApprovals();
            const count = pending.length;

            // Alert if > threshold
            if (count > this.config.thresholds.pendingApprovals &&
                this.shouldAlert('pending_approvals', count)) {

                await this.sendNotification({
                    type: 'pending_approvals',
                    title: '⚠️ Pending Approvals',
                    body: `${count} payment vouchers awaiting your approval`,
                    priority: 'high',
                    data: {
                        count: count,
                        url: '/payment-voucher',
                        action: 'view_approvals'
                    }
                });

                this.lastCheck.pending_approvals = { count, time: Date.now() };
                return `Alert sent (${count} pending)`;
            }

            return `OK (${count} pending)`;
        } catch (error) {
            console.error('Error checking pending approvals:', error);
            return 'Error';
        }
    },

    async checkCriticalRisks() {
        try {
            // Check if RiskAssessment module is loaded
            if (typeof RiskAssessment === 'undefined') {
                return 'Skipped (module not loaded)';
            }

            const risks = RiskAssessment.calculateRisks();
            const criticalRisks = [];

            Object.entries(risks).forEach(([metric, value]) => {
                if (value > this.config.thresholds.criticalRisk) {
                    criticalRisks.push({ metric, value });
                }
            });

            if (criticalRisks.length > 0 &&
                this.shouldAlert('critical_risk', criticalRisks.length)) {

                // Sort by risk value (highest first)
                criticalRisks.sort((a, b) => b.value - a.value);
                const topRisk = criticalRisks[0];

                await this.sendNotification({
                    type: 'critical_risk',
                    title: '🔴 Critical Risk Alert',
                    body: `${this.formatMetricName(topRisk.metric)}: ${topRisk.value.toFixed(0)}% risk detected`,
                    priority: 'urgent',
                    data: {
                        metric: topRisk.metric,
                        value: topRisk.value,
                        count: criticalRisks.length,
                        url: '/dashboard',
                        action: 'view_risks'
                    }
                });

                this.lastCheck.critical_risk = {
                    count: criticalRisks.length,
                    time: Date.now()
                };

                return `Alert sent (${criticalRisks.length} critical)`;
            }

            return `OK (${criticalRisks.length} critical)`;
        } catch (error) {
            console.error('Error checking critical risks:', error);
            return 'Error';
        }
    },

    // ─── HPP Efficiency Monitor ──────────────────────────────────────────
    async checkHPPEfficiency() {
        try {
            // Requires AIAdvisor to be loaded
            if (typeof AIAdvisor === 'undefined') return 'Skipped (AIAdvisor not loaded)';

            const gm = AIAdvisor.analyzeGrossMargin();
            if (gm.grossMargin === null || gm.revenue === 0) return 'Skipped (no revenue data)';

            const margin = gm.grossMargin;
            const { hppCriticalMargin, hppWarningMargin } = this.config.thresholds;

            // — CRITICAL: Gross Margin < hppCriticalMargin (default 10%) —
            if (margin < hppCriticalMargin && this.shouldAlert('hpp_critical', margin)) {
                await this.sendNotification({
                    type: 'hpp_critical',
                    title: '🚨 HPP KRITIS — Gross Margin < ' + hppCriticalMargin + '%',
                    body: `Gross Margin hanya ${margin.toFixed(1)}%! HPP nyaris sama dengan Revenue. Tindakan segera diperlukan.`,
                    priority: 'urgent',
                    data: { metric: 'grossMargin', value: margin, url: '/ai-advisor', action: 'view_risks' }
                });
                this.lastCheck.hpp_critical = { count: margin, time: Date.now() };
                return `CRITICAL alert sent (GM: ${margin.toFixed(1)}%)`;
            }

            // — WARNING: Gross Margin < hppWarningMargin (default 25%) —
            if (margin < hppWarningMargin && this.shouldAlert('hpp_warning', margin)) {
                await this.sendNotification({
                    type: 'hpp_warning',
                    title: '⚠️ HPP Tinggi — Gross Margin di bawah ' + hppWarningMargin + '%',
                    body: `Gross Margin ${margin.toFixed(1)}% (target >25%). HPP perlu diefisiensikan.`,
                    priority: 'high',
                    data: { metric: 'grossMargin', value: margin, url: '/ai-advisor', action: 'view_risks' }
                });
                this.lastCheck.hpp_warning = { count: margin, time: Date.now() };
                return `WARNING alert sent (GM: ${margin.toFixed(1)}%)`;
            }

            return `OK (GM: ${margin.toFixed(1)}%)`;
        } catch (error) {
            console.error('Error checking HPP efficiency:', error);
            return 'Error';
        }
    },

    async checkLowStock() {
        try {
            const items = Storage.getItems();
            const lowStockItems = items.filter(item =>
                item.trackStock &&
                item.reorderPoint &&
                (item.currentStock || 0) < item.reorderPoint
            );

            const count = lowStockItems.length;

            if (count > this.config.thresholds.lowStock &&
                this.shouldAlert('low_stock', count)) {

                await this.sendNotification({
                    type: 'low_stock',
                    title: '📦 Low Stock Alert',
                    body: `${count} items below reorder point`,
                    priority: 'medium',
                    data: {
                        count: count,
                        url: '/reorder-system',
                        action: 'view_reorder'
                    }
                });

                this.lastCheck.low_stock = { count, time: Date.now() };
                return `Alert sent (${count} low stock)`;
            }

            return `OK (${count} low stock)`;
        } catch (error) {
            console.error('Error checking low stock:', error);
            return 'Error';
        }
    },

    shouldAlert(type, currentValue) {
        const last = this.lastCheck[type];
        if (!last) return true; // First time, always alert

        // Don't alert if same value within cooldown period
        const cooldownMs = this.config.thresholds.alertCooldownHours * 60 * 60 * 1000;
        const timeSinceLastAlert = Date.now() - last.time;

        if (last.count === currentValue && timeSinceLastAlert < cooldownMs) {
            console.log(`⏭️ Skipping ${type} alert (cooldown: ${Math.round(timeSinceLastAlert / 60000)} min ago)`);
            return false;
        }

        return true;
    },

    async sendNotification(payload) {
        try {
            // Use NotificationService if available and enabled
            if (typeof NotificationService !== 'undefined' &&
                NotificationService.isEnabled()) {

                // Show local notification
                const notification = new Notification(payload.title, {
                    body: payload.body,
                    icon: '/favicon.ico',
                    badge: '/favicon.ico',
                    tag: payload.type,
                    requireInteraction: payload.priority === 'urgent',
                    data: payload.data
                });

                notification.onclick = () => {
                    window.focus();
                    notification.close();

                    // Navigate based on type
                    if (payload.data.action === 'view_approvals') {
                        App.navigate('payment-voucher');
                    } else if (payload.data.action === 'view_risks') {
                        App.navigate('dashboard');
                    } else if (payload.data.action === 'view_reorder') {
                        App.navigate('reorder-system');
                    }
                };

                console.log('📨 Notification sent:', payload.title);

                // Also log to audit
                AuditLog.log('notification', 'risk_monitor', payload.type,
                    `${payload.title}: ${payload.body}`);

            } else {
                console.log('⚠️ Notifications not enabled, skipping:', payload.title);
            }
        } catch (error) {
            console.error('Error sending notification:', error);
        }
    },

    formatMetricName(metric) {
        const names = {
            cashFlow: 'Cash Flow',
            debtRatio: 'Debt Ratio',
            inventory: 'Inventory Turnover',
            receivables: 'Receivables Aging',
            lowStock: 'Low Stock Items',
            pendingApprovals: 'Pending Approvals',
            supplierPayments: 'Overdue Supplier Payments',
            production: 'Production Delays'
        };
        return names[metric] || metric;
    },

    // Manual trigger for testing
    async triggerManualCheck() {
        console.log('🔍 Manual check triggered');
        await this.performChecks();
    },

    // Get status
    getStatus() {
        return {
            isRunning: this.isRunning,
            checkInterval: this.config.checkIntervalMinutes,
            lastChecks: this.lastCheck,
            thresholds: this.config.thresholds
        };
    },

    // Update configuration
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        console.log('✅ Risk Monitor config updated:', this.config);

        // Restart if running
        if (this.isRunning) {
            this.stop();
            this.start();
        }
    }
};


// Explicitly make RiskMonitor globally available
window.RiskMonitor = RiskMonitor;
