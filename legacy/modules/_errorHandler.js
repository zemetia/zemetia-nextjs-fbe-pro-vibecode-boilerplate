// ==========================================
// Error Handler Module
// Centralized error handling and logging
// ==========================================

const ErrorHandler = {
    // Error log storage
    errorLog: [],
    maxLogSize: 100,

    init() {
        this.loadErrorLog();
        this.setupGlobalErrorHandler();
    },

    // Setup global error handler
    setupGlobalErrorHandler() {
        window.addEventListener('error', (event) => {
            this.logError('Global', event.error, {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            });
        });

        window.addEventListener('unhandledrejection', (event) => {
            this.logError('Promise', event.reason, {
                type: 'unhandledrejection'
            });
        });
    },

    // Log error to storage
    logError(module, error, context = {}) {
        const errorEntry = {
            id: Date.now() + Math.random(),
            timestamp: new Date().toISOString(),
            module: module,
            message: error?.message || String(error),
            stack: error?.stack || '',
            context: context,
            userAgent: navigator.userAgent,
            url: window.location.href
        };

        this.errorLog.unshift(errorEntry);

        // Limit log size
        if (this.errorLog.length > this.maxLogSize) {
            this.errorLog = this.errorLog.slice(0, this.maxLogSize);
        }

        this.saveErrorLog();

        // --- ADDED: Link to Audit Log ---
        if (typeof AuditLog !== 'undefined' && AuditLog.log) {
            AuditLog.log('error', module, {
                message: errorEntry.message,
                stack: errorEntry.stack,
                url: errorEntry.url,
                ...context
            });
        }

        // Log to console in development
        if (this.isDevelopment()) {
            console.error(`[${module}]`, error, context);
        }

        return errorEntry.id;
    },

    // Show user-friendly error message
    showUserError(message, type = 'error') {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        alertDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            max-width: 400px;
            padding: 16px 20px;
            background: ${type === 'error' ? '#dc3545' : '#ffc107'};
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
        `;

        alertDiv.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-size: 24px;">${type === 'error' ? '⚠️' : '⚡'}</span>
                <div style="flex: 1;">
                    <div style="font-weight: 600; margin-bottom: 4px;">
                        ${type === 'error' ? 'Error' : 'Warning'}
                    </div>
                    <div style="font-size: 14px; opacity: 0.95;">
                        ${message}
                    </div>
                </div>
                <button onclick="this.parentElement.parentElement.remove()" 
                    style="background: none; border: none; color: white; font-size: 20px; cursor: pointer; padding: 0; line-height: 1;">
                    ×
                </button>
            </div>
        `;

        document.body.appendChild(alertDiv);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (alertDiv.parentElement) {
                alertDiv.style.animation = 'slideOut 0.3s ease-in';
                setTimeout(() => alertDiv.remove(), 300);
            }
        }, 5000);
    },

    // Alias for backward compatibility
    showError(message, type = 'error') {
        return this.showUserError(message, type);
    },

    // Handle API errors
    handleApiError(error, context = {}) {
        const errorId = this.logError('API', error, context);

        let userMessage = 'An error occurred while processing your request.';

        if (error.message?.includes('network')) {
            userMessage = 'Network error. Please check your connection.';
        } else if (error.message?.includes('timeout')) {
            userMessage = 'Request timeout. Please try again.';
        } else if (error.status === 401) {
            userMessage = 'Session expired. Please login again.';
        } else if (error.status === 403) {
            userMessage = 'You do not have permission to perform this action.';
        } else if (error.status === 404) {
            userMessage = 'Resource not found.';
        } else if (error.status >= 500) {
            userMessage = 'Server error. Please try again later.';
        }

        this.showUserError(userMessage);
        return errorId;
    },

    // Handle validation errors
    handleValidationError(errors, showToUser = true) {
        const errorId = this.logError('Validation', new Error('Validation failed'), { errors });

        if (showToUser && Array.isArray(errors) && errors.length > 0) {
            const message = errors.length === 1
                ? errors[0]
                : `${errors.length} validation errors found. Please check your input.`;
            this.showUserError(message, 'warning');
        }

        return errorId;
    },

    // Wrap async function with error handling
    async wrapAsync(fn, context = {}) {
        try {
            return await fn();
        } catch (error) {
            this.logError(context.module || 'Unknown', error, context);
            throw error;
        }
    },

    // Wrap sync function with error handling
    wrapSync(fn, context = {}) {
        try {
            return fn();
        } catch (error) {
            this.logError(context.module || 'Unknown', error, context);
            throw error;
        }
    },

    // Get error log
    getErrorLog(limit = 50) {
        return this.errorLog.slice(0, limit);
    },

    // Clear error log
    clearErrorLog() {
        this.errorLog = [];
        this.saveErrorLog();
    },

    // Export error log
    exportErrorLog() {
        const data = JSON.stringify(this.errorLog, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `error-log-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    },

    // Load error log from storage
    loadErrorLog() {
        try {
            const stored = localStorage.getItem('erp_error_log');
            if (stored) {
                this.errorLog = JSON.parse(stored);
            }
        } catch (error) {
            console.error('Failed to load error log:', error);
        }
    },

    // Save error log to storage
    saveErrorLog() {
        try {
            localStorage.setItem('erp_error_log', JSON.stringify(this.errorLog));
        } catch (error) {
            console.error('Failed to save error log:', error);
        }
    },

    // Check if in development mode
    isDevelopment() {
        return window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1' ||
            window.location.protocol === 'file:';
    },

    // Render error log viewer
    renderErrorLogViewer() {
        const errors = this.getErrorLog();

        return `
            <div class="error-log-viewer">
                <div class="page-header">
                    <h1 class="page-title">Error Log</h1>
                    <div class="page-actions">
                        <button onclick="ErrorHandler.exportErrorLog()" class="btn btn-secondary">
                            📥 Export Log
                        </button>
                        <button onclick="ErrorHandler.confirmClearLog()" class="btn btn-danger">
                            🗑️ Clear Log
                        </button>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <h3>Recent Errors (${errors.length})</h3>
                    </div>
                    <div class="card-body">
                        ${errors.length === 0 ? `
                            <div style="text-align: center; padding: 40px; color: var(--color-gray-600);">
                                <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
                                <div>No errors logged</div>
                            </div>
                        ` : `
                            <div class="table-responsive">
                                <table class="table">
                                    <thead>
                                        <tr>
                                            <th>Time</th>
                                            <th>Module</th>
                                            <th>Message</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${errors.map(error => `
                                            <tr>
                                                <td>${new Date(error.timestamp).toLocaleString()}</td>
                                                <td><span class="badge">${error.module}</span></td>
                                                <td>${error.message}</td>
                                                <td>
                                                    <button onclick="ErrorHandler.showErrorDetail('${error.id}')" 
                                                        class="btn btn-sm btn-secondary">
                                                        View Details
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
            </div>
        `;
    },

    showErrorDetail(errorId) {
        const error = this.errorLog.find(e => e.id == errorId);
        if (!error) return;

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px;">
                <div class="modal-header">
                    <h2>Error Details</h2>
                    <button onclick="this.closest('.modal').remove()" class="close-btn">×</button>
                </div>
                <div class="modal-body">
                    <div style="margin-bottom: 16px;">
                        <strong>Time:</strong> ${new Date(error.timestamp).toLocaleString()}
                    </div>
                    <div style="margin-bottom: 16px;">
                        <strong>Module:</strong> ${error.module}
                    </div>
                    <div style="margin-bottom: 16px;">
                        <strong>Message:</strong> ${error.message}
                    </div>
                    ${error.stack ? `
                        <div style="margin-bottom: 16px;">
                            <strong>Stack Trace:</strong>
                            <pre style="background: #1e1e1e; color: #d4d4d4; padding: 12px; border-radius: 4px; overflow-x: auto; font-size: 12px;">${error.stack}</pre>
                        </div>
                    ` : ''}
                    ${Object.keys(error.context).length > 0 ? `
                        <div style="margin-bottom: 16px;">
                            <strong>Context:</strong>
                            <pre style="background: #1e1e1e; color: #d4d4d4; padding: 12px; border-radius: 4px; overflow-x: auto; font-size: 12px;">${JSON.stringify(error.context, null, 2)}</pre>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    confirmClearLog() {
        if (confirm('Are you sure you want to clear the error log? This cannot be undone.')) {
            this.clearErrorLog();
            if (typeof App !== 'undefined' && App.navigateTo) {
                App.navigateTo('error-log');
            }
        }
    }
};

// Add CSS animation
if (!document.getElementById('error-handler-styles')) {
    const style = document.createElement('style');
    style.id = 'error-handler-styles';
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(400px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(400px);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}
