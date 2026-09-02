// ==========================================
// Check & Giro Tracking Module
// Track check and giro status
// ==========================================

const CheckGiroTracking = {
    checks: [],

    statuses: {
        issued: 'Issued',
        cleared: 'Cleared',
        bounced: 'Bounced',
        cancelled: 'Cancelled'
    },

    init() {
        this.loadChecks();
    },

    loadChecks() {
        this.checks = Storage.getChecks();
    },

    saveChecks() {
        Storage.saveChecks(this.checks);
    },

    createCheckGiro(data) {
        const check = {
            id: Date.now(),
            voucherId: data.voucherId,
            voucherNumber: data.voucherNumber,
            type: data.type, // 'check' or 'giro'
            number: data.number,
            date: data.date,
            amount: data.amount,
            payee: data.payee,
            bankAccountId: data.bankAccountId,
            status: 'issued',
            issuedAt: new Date().toISOString(),
            issuedBy: Auth.getCurrentUser() ? Auth.getCurrentUser().id : 'SYSTEM',
            issuedByName: Auth.getCurrentUser() ? Auth.getCurrentUser().name : 'System User'
        };

        this.checks.push(check);
        this.saveChecks();

        AuditLog.log('create', 'check_giro', check.id,
            `Issued ${check.type} ${check.number} for ${check.voucherNumber}`);

        return { success: true, check };
    },

    updateStatus(checkId, newStatus, notes) {
        const check = this.checks.find(c => c.id === checkId);
        if (!check) {
            return { success: false, errors: { check: 'Check/Giro not found' } };
        }

        const oldStatus = check.status;
        check.status = newStatus;
        check.statusUpdatedAt = new Date().toISOString();
        check.statusUpdatedBy = Auth.getCurrentUser() ? Auth.getCurrentUser().id : 'SYSTEM';
        check.statusUpdatedByName = Auth.getCurrentUser() ? Auth.getCurrentUser().name : 'System User';
        check.statusNotes = notes || '';

        this.saveChecks();

        AuditLog.log('update', 'check_giro', checkId,
            `Status changed from ${oldStatus} to ${newStatus}`);

        return { success: true, check };
    },

    getChecksByStatus(status) {
        return this.checks.filter(c => c.status === status);
    },

    getChecksByVoucher(voucherId) {
        return this.checks.filter(c => c.voucherId === voucherId);
    },

    getOutstandingChecks() {
        return this.checks.filter(c => c.status === 'issued');
    },

    formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    }
};


// Explicitly make CheckGiroTracking globally available
window.CheckGiroTracking = CheckGiroTracking;
