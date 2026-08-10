// ==========================================
// Audit Log Module
// Track all data changes and user actions
// ==========================================

const AuditLog = {
    logs: [],
    maxLogSize: 1000,

    init() {
        this.loadLogs();
    },

    // Log an action
    log(action, module, data = {}) {
        const user = Auth?.getCurrentUser?.() || { username: 'system', name: 'System' };

        const logEntry = {
            id: Date.now() + Math.random(),
            timestamp: new Date().toISOString(),
            user: user.username,
            userName: user.name,
            action: action, // 'create', 'update', 'delete', 'view', 'export', etc.
            module: module,
            data: data,
            ipAddress: this.getClientIP(),
            userAgent: navigator.userAgent
        };

        this.logs.unshift(logEntry);

        // Limit log size
        if (this.logs.length > this.maxLogSize) {
            this.logs = this.logs.slice(0, this.maxLogSize);
        }

        this.saveLogs();
        return logEntry.id;
    },

    // Specific logging methods
    logCreate(module, recordId, data) {
        return this.log('create', module, { recordId, ...data });
    },

    logUpdate(module, recordId, changes) {
        return this.log('update', module, { recordId, changes });
    },

    logDelete(module, recordId, data) {
        return this.log('delete', module, { recordId, ...data });
    },

    logView(module, recordId = null) {
        return this.log('view', module, { recordId });
    },

    logExport(module, format, recordCount) {
        return this.log('export', module, { format, recordCount });
    },

    logLogin(username, success = true) {
        return this.log(success ? 'login_success' : 'login_failed', 'auth', { username });
    },

    logLogout(username) {
        return this.log('logout', 'auth', { username });
    },

    // Get logs with filters
    getLogs(filters = {}) {
        let filtered = [...this.logs];

        if (filters.module) {
            filtered = filtered.filter(log => log.module === filters.module);
        }

        if (filters.action) {
            filtered = filtered.filter(log => log.action === filters.action);
        }

        if (filters.user) {
            filtered = filtered.filter(log => log.user === filters.user);
        }

        if (filters.startDate) {
            const start = new Date(filters.startDate);
            filtered = filtered.filter(log => new Date(log.timestamp) >= start);
        }

        if (filters.endDate) {
            const end = new Date(filters.endDate);
            end.setHours(23, 59, 59, 999);
            filtered = filtered.filter(log => new Date(log.timestamp) <= end);
        }

        if (filters.limit) {
            filtered = filtered.slice(0, filters.limit);
        }

        return filtered;
    },

    // Get activity summary
    getActivitySummary(days = 30) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);

        const recentLogs = this.logs.filter(log => new Date(log.timestamp) >= cutoff);

        const summary = {
            totalActions: recentLogs.length,
            byAction: {},
            byModule: {},
            byUser: {},
            timeline: []
        };

        recentLogs.forEach(log => {
            // By action
            summary.byAction[log.action] = (summary.byAction[log.action] || 0) + 1;

            // By module
            summary.byModule[log.module] = (summary.byModule[log.module] || 0) + 1;

            // By user
            summary.byUser[log.user] = (summary.byUser[log.user] || 0) + 1;
        });

        return summary;
    },

    // Get user activity
    getUserActivity(username, limit = 50) {
        return this.logs
            .filter(log => log.user === username)
            .slice(0, limit);
    },

    // Get module activity
    getModuleActivity(module, limit = 50) {
        return this.logs
            .filter(log => log.module === module)
            .slice(0, limit);
    },

    // Export audit log
    exportLogs(filters = {}) {
        const logs = this.getLogs(filters);
        const csv = this.convertToCSV(logs);

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    },

    // Convert logs to CSV
    convertToCSV(logs) {
        const headers = ['Timestamp', 'User', 'Action', 'Module', 'Details'];
        const rows = logs.map(log => [
            log.timestamp,
            log.userName || log.user,
            log.action,
            log.module,
            JSON.stringify(log.data)
        ]);

        return [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');
    },

    // Clear old logs
    clearOldLogs(days = 90) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);

        const before = this.logs.length;
        this.logs = this.logs.filter(log => new Date(log.timestamp) >= cutoff);
        const removed = before - this.logs.length;

        this.saveLogs();
        return removed;
    },

    // Get client IP (limited in browser)
    getClientIP() {
        // In a real application, this would come from the server
        return 'client';
    },

    // Load logs from storage
    loadLogs() {
        try {
            const stored = Storage.get(Storage.KEYS.AUDIT_LOG);
            if (stored) {
                this.logs = stored;
            }
        } catch (error) {
            console.error('Failed to load audit log:', error);
        }
    },

    // Save logs to storage
    async saveLogs() {
        try {
            await Storage.set(Storage.KEYS.AUDIT_LOG, this.logs);
        } catch (error) {
            console.error('Failed to save audit log:', error);
        }
    },

    // Render audit log viewer
    render() {
        return `
            <div class="audit-log-viewer">
                <div class="page-header">
                    <h1 class="page-title">Audit Log</h1>
                    <div class="page-actions">
                        <button onclick="AuditLog.exportLogs()" class="btn btn-secondary">
                            📥 Export Log
                        </button>
                        <button onclick="AuditLog.showFilters()" class="btn btn-secondary">
                            🔍 Filter
                        </button>
                    </div>
                </div>

                ${this.renderSummary()}
                ${this.renderLogTable()}
            </div>
        `;
    },

    renderSummary() {
        const summary = this.getActivitySummary(30);

        return `
            <div class="stats-grid" style="margin-bottom: 24px;">
                <div class="stat-card">
                    <div class="stat-value">${summary.totalActions}</div>
                    <div class="stat-label">Total Actions (30 days)</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${Object.keys(summary.byUser).length}</div>
                    <div class="stat-label">Active Users</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${Object.keys(summary.byModule).length}</div>
                    <div class="stat-label">Modules Used</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${this.logs.length}</div>
                    <div class="stat-label">Total Records</div>
                </div>
            </div>
        `;
    },

    renderLogTable() {
        const logs = this.getLogs({ limit: 100 });

        return `
            <div class="card">
                <div class="card-header">
                    <h3>Recent Activity</h3>
                </div>
                <div class="card-body">
                    ${logs.length === 0 ? `
                        <div style="text-align: center; padding: 40px; color: var(--color-gray-600);">
                            <div style="font-size: 48px; margin-bottom: 16px;">📋</div>
                            <div>No activity logged</div>
                        </div>
                    ` : `
                        <div class="table-responsive">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>Time</th>
                                        <th>User</th>
                                        <th>Action</th>
                                        <th>Module</th>
                                        <th>Details</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${logs.map(log => `
                                        <tr>
                                            <td>${this.formatTimestamp(log.timestamp)}</td>
                                            <td>${log.userName || log.user}</td>
                                            <td>${this.renderActionBadge(log.action)}</td>
                                            <td><span class="badge">${log.module}</span></td>
                                            <td>
                                                <button onclick="AuditLog.showLogDetail('${log.id}')" 
                                                    class="btn btn-sm btn-secondary">
                                                    View
                                                </button>
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

    renderActionBadge(action) {
        const badges = {
            'create': '<span class="badge badge-success">Create</span>',
            'update': '<span class="badge badge-warning">Update</span>',
            'delete': '<span class="badge badge-danger">Delete</span>',
            'view': '<span class="badge badge-info">View</span>',
            'export': '<span class="badge badge-secondary">Export</span>',
            'login_success': '<span class="badge badge-success">Login</span>',
            'login_failed': '<span class="badge badge-danger">Login Failed</span>',
            'logout': '<span class="badge badge-secondary">Logout</span>'
        };

        return badges[action] || `<span class="badge">${action}</span>`;
    },

    formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        // Less than 1 minute
        if (diff < 60000) {
            return 'Just now';
        }

        // Less than 1 hour
        if (diff < 3600000) {
            const minutes = Math.floor(diff / 60000);
            return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        }

        // Less than 24 hours
        if (diff < 86400000) {
            const hours = Math.floor(diff / 3600000);
            return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        }

        // Otherwise show date
        return date.toLocaleString('id-ID', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    showLogDetail(logId) {
        const log = this.logs.find(l => l.id == logId);
        if (!log) return;

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px;">
                <div class="modal-header">
                    <h2>Audit Log Details</h2>
                    <button onclick="this.closest('.modal').remove()" class="close-btn">×</button>
                </div>
                <div class="modal-body">
                    <table style="width: 100%;">
                        <tr>
                            <td style="padding: 8px; font-weight: 600; width: 150px;">Timestamp:</td>
                            <td style="padding: 8px;">${new Date(log.timestamp).toLocaleString()}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; font-weight: 600;">User:</td>
                            <td style="padding: 8px;">${log.userName || log.user}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; font-weight: 600;">Action:</td>
                            <td style="padding: 8px;">${this.renderActionBadge(log.action)}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; font-weight: 600;">Module:</td>
                            <td style="padding: 8px;">${log.module}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; font-weight: 600; vertical-align: top;">Data:</td>
                            <td style="padding: 8px;">
                                <pre style="background: #1e1e1e; color: #d4d4d4; padding: 12px; border-radius: 4px; overflow-x: auto; font-size: 12px;">${JSON.stringify(log.data, null, 2)}</pre>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; font-weight: 600;">User Agent:</td>
                            <td style="padding: 8px; font-size: 12px; color: #666;">${log.userAgent}</td>
                        </tr>
                    </table>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    showFilters() {
        // TODO: Implement filter UI
        alert('Filter functionality coming soon');
    }
};


// Explicitly make AuditLog globally available
window.AuditLog = AuditLog;
