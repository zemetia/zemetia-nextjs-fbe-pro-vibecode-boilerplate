// ==========================================
// Payment Schedule Module
// Track and remind upcoming payments
// ==========================================

const PaymentSchedule = {
    schedules: [],

    init() {
        this.loadSchedules();
        this.syncWithInvoices();
    },

    loadSchedules() {
        this.schedules = Storage.getSchedules();
    },

    saveSchedules() {
        Storage.saveSchedules(this.schedules);
    },

    syncWithInvoices() {
        // Auto-create schedules from unpaid invoices
        if (typeof SupplierInvoice !== 'undefined') {
            const unpaidInvoices = SupplierInvoice.getUnpaidInvoices();

            unpaidInvoices.forEach(invoice => {
                const existing = this.schedules.find(s => s.invoiceId === invoice.id);

                if (!existing && invoice.dueDate) {
                    this.createSchedule({
                        invoiceId: invoice.id,
                        invoiceNumber: invoice.supplierInvoiceNumber,
                        supplierId: invoice.supplierId,
                        supplierName: invoice.supplierName,
                        amount: invoice.total,
                        dueDate: invoice.dueDate
                    });
                }
            });
        }
    },

    createSchedule(data) {
        const schedule = {
            id: Date.now(),
            invoiceId: data.invoiceId,
            invoiceNumber: data.invoiceNumber,
            supplierId: data.supplierId,
            supplierName: data.supplierName,
            amount: data.amount,
            dueDate: data.dueDate,

            // Reminder
            reminderSent: false,
            reminderSentAt: null,
            reminderDays: [3, 7, 14], // Days before due date

            // Status
            status: 'scheduled',

            // Payment
            paymentVoucherId: null,
            paidAt: null,

            createdAt: new Date().toISOString()
        };

        this.schedules.push(schedule);
        this.saveSchedules();

        return { success: true, schedule };
    },

    getUpcomingPayments(days = 30) {
        const today = new Date();
        const futureDate = new Date();
        futureDate.setDate(today.getDate() + days);

        return this.schedules.filter(s => {
            if (s.status === 'paid') return false;

            const dueDate = new Date(s.dueDate);
            return dueDate >= today && dueDate <= futureDate;
        }).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    },

    getOverduePayments() {
        const today = new Date().toISOString().split('T')[0];

        return this.schedules.filter(s =>
            s.status !== 'paid' &&
            s.dueDate < today
        ).map(s => {
            const dueDate = new Date(s.dueDate);
            const now = new Date();
            const daysOverdue = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));

            return {
                ...s,
                daysOverdue: daysOverdue,
                status: 'overdue'
            };
        });
    },

    getPaymentsByDate(startDate, endDate) {
        return this.schedules.filter(s =>
            s.dueDate >= startDate &&
            s.dueDate <= endDate
        );
    },

    sendReminders() {
        const today = new Date();

        this.schedules.forEach(schedule => {
            if (schedule.status === 'paid' || schedule.reminderSent) return;

            const dueDate = new Date(schedule.dueDate);
            const daysUntilDue = Math.floor((dueDate - today) / (1000 * 60 * 60 * 24));

            // Check if reminder should be sent
            if (schedule.reminderDays.includes(daysUntilDue)) {
                this.sendReminder(schedule.id, daysUntilDue);
            }
        });
    },

    sendReminder(scheduleId, daysUntilDue) {
        const schedule = this.schedules.find(s => s.id === scheduleId);
        if (!schedule) return;

        // In a real system, this would send email/notification
        console.log(`REMINDER: Payment due in ${daysUntilDue} days`);
        console.log(`Supplier: ${schedule.supplierName}`);
        console.log(`Amount: ${this.formatCurrency(schedule.amount)}`);
        console.log(`Due Date: ${schedule.dueDate}`);

        schedule.reminderSent = true;
        schedule.reminderSentAt = new Date().toISOString();
        schedule.status = 'reminded';

        this.saveSchedules();

        AuditLog.log('notification', 'payment_schedule', scheduleId,
            `Reminder sent for payment to ${schedule.supplierName}`);
    },

    markAsPaid(scheduleId, paymentVoucherId) {
        const schedule = this.schedules.find(s => s.id === scheduleId);
        if (!schedule) {
            return { success: false, errors: { schedule: 'Schedule not found' } };
        }

        schedule.status = 'paid';
        schedule.paymentVoucherId = paymentVoucherId;
        schedule.paidAt = new Date().toISOString();

        this.saveSchedules();

        AuditLog.log('update', 'payment_schedule', scheduleId, 'Marked as paid');

        return { success: true, schedule };
    },

    getDashboardSummary() {
        const upcoming7 = this.getUpcomingPayments(7);
        const upcoming14 = this.getUpcomingPayments(14);
        const upcoming30 = this.getUpcomingPayments(30);
        const overdue = this.getOverduePayments();

        return {
            upcoming_7_days: {
                count: upcoming7.length,
                total: upcoming7.reduce((sum, s) => sum + s.amount, 0)
            },
            upcoming_14_days: {
                count: upcoming14.length,
                total: upcoming14.reduce((sum, s) => sum + s.amount, 0)
            },
            upcoming_30_days: {
                count: upcoming30.length,
                total: upcoming30.reduce((sum, s) => sum + s.amount, 0)
            },
            overdue: {
                count: overdue.length,
                total: overdue.reduce((sum, s) => sum + s.amount, 0)
            }
        };
    },

    formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    },

    formatDate(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString('id-ID', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
};


// Explicitly make PaymentSchedule globally available
window.PaymentSchedule = PaymentSchedule;
