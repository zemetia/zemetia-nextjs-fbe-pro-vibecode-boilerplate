// ==========================================
// Transaction Reference Number Management
// Extension for storage.js
// ==========================================

// Add these methods to the Storage object in storage.js

// Get available transaction types
getTransactionTypes() {
    return [
        { code: 'JRN', name: 'Jurnal Umum', description: 'General journal entries' },
        { code: 'CSH', name: 'Cash Transaction', description: 'Cash in/out transactions' },
        { code: 'BNK', name: 'Bank Transaction', description: 'Bank transfers, deposits' },
        { code: 'SAL', name: 'Sales', description: 'Sales invoice/customer payment' },
        { code: 'PUR', name: 'Purchase', description: 'Purchase invoice/supplier payment' },
        { code: 'ADJ', name: 'Adjustment', description: 'Account adjustments, corrections' },
        { code: 'DEP', name: 'Depreciation', description: 'Monthly depreciation entries' },
        { code: 'CLS', name: 'Closing', description: 'Month/year-end closing entries' },
    ];
},

// Generate next reference number for a transaction type
getNextReferenceNumber(transactionType) {
    // Validate transaction type
    const validTypes = this.getTransactionTypes().map(t => t.code);
    if (!validTypes.includes(transactionType)) {
        console.error(`Invalid transaction type: ${transactionType}`);
        return null;
    }

    // Get current counters
    const counters = this.get(this.KEYS.TRANSACTION_COUNTERS) || {};

    // Get current counter for this type
    const currentCounter = counters[transactionType] || 0;

    // Check if counter exceeds maximum
    if (currentCounter >= 999999) {
        alert(`Counter for ${transactionType} has reached maximum (999999). Please use a different transaction type or contact administrator.`);
        return null;
    }

    // Increment counter
    const nextCounter = currentCounter + 1;

    // Format: TYPE-NNNNNN (6 digits, zero-padded)
    const refNumber = `${transactionType}-${String(nextCounter).padStart(6, '0')}`;

    // Save updated counter
    counters[transactionType] = nextCounter;
    this.set(this.KEYS.TRANSACTION_COUNTERS, counters);

    return refNumber;
},

// Preview next reference number without incrementing counter
previewNextReferenceNumber(transactionType) {
    const counters = this.get(this.KEYS.TRANSACTION_COUNTERS) || {};
    const currentCounter = counters[transactionType] || 0;
    const nextCounter = currentCounter + 1;
    return `${transactionType}-${String(nextCounter).padStart(6, '0')}`;
},

// Reset all transaction counters (admin function)
resetCounters() {
    const confirmed = confirm('PERINGATAN: Reset semua counter transaksi? Counter akan kembali ke 0. Tindakan ini tidak dapat dibatalkan!');
    if (confirmed) {
        const doubleConfirm = confirm('Apakah Anda BENAR-BENAR yakin?');
        if (doubleConfirm) {
            this.set(this.KEYS.TRANSACTION_COUNTERS, {
                JRN: 0,
                CSH: 0,
                BNK: 0,
                SAL: 0,
                PUR: 0,
                ADJ: 0,
                DEP: 0,
                CLS: 0,
            });
            alert('Semua counter telah direset ke 0.');
            return true;
        }
    }
    return false;
},

// Get current counter value for a transaction type
getCurrentCounter(transactionType) {
    const counters = this.get(this.KEYS.TRANSACTION_COUNTERS) || {};
    return counters[transactionType] || 0;
},
