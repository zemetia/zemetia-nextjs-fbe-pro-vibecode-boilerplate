/**
 * Journal Entry Validation Tests
 * Tests: Debit-Credit balance, required fields, date validation
 */

// ─── Extracted Validation Logic ───

function validateJournalEntry(journal) {
    const errors = [];

    // 1. Must have a date
    if (!journal.date) {
        errors.push('Tanggal wajib diisi');
    }

    // 2. Must have at least 2 lines
    if (!journal.lines || journal.lines.length < 2) {
        errors.push('Jurnal harus memiliki minimal 2 baris');
    }

    // 3. Each line must have an account code
    if (journal.lines) {
        journal.lines.forEach((line, i) => {
            if (!line.accountCode) {
                errors.push(`Baris ${i + 1}: Kode akun wajib diisi`);
            }
            if ((line.debit || 0) === 0 && (line.credit || 0) === 0) {
                errors.push(`Baris ${i + 1}: Debit atau credit harus diisi`);
            }
            if ((line.debit || 0) > 0 && (line.credit || 0) > 0) {
                errors.push(`Baris ${i + 1}: Tidak boleh mengisi debit dan credit bersamaan`);
            }
        });
    }

    // 4. Total debit must equal total credit
    if (journal.lines && journal.lines.length >= 2) {
        const totalDebit = journal.lines.reduce((sum, l) => sum + (l.debit || 0), 0);
        const totalCredit = journal.lines.reduce((sum, l) => sum + (l.credit || 0), 0);

        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            errors.push(`Total debit (${totalDebit}) tidak sama dengan total credit (${totalCredit})`);
        }
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

// ─── Tests ───

describe('Journal Entry - Debit Credit Balance', () => {

    test('should PASS when debit equals credit', () => {
        const journal = {
            date: '2025-01-15',
            lines: [
                { accountCode: '1100', debit: 5000000, credit: 0 },
                { accountCode: '3100', debit: 0, credit: 5000000 },
            ]
        };

        const result = validateJournalEntry(journal);
        expect(result.isValid).toBe(true);
        expect(result.errors.length).toBe(0);
    });

    test('should FAIL when debit ≠ credit', () => {
        const journal = {
            date: '2025-01-15',
            lines: [
                { accountCode: '1100', debit: 5000000, credit: 0 },
                { accountCode: '3100', debit: 0, credit: 4000000 },
            ]
        };

        const result = validateJournalEntry(journal);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.includes('tidak sama'))).toBe(true);
    });

    test('should handle multi-line journals', () => {
        const journal = {
            date: '2025-01-15',
            lines: [
                { accountCode: '1100', debit: 3000000, credit: 0 },
                { accountCode: '1110', debit: 2000000, credit: 0 },
                { accountCode: '3100', debit: 0, credit: 5000000 },
            ]
        };

        const result = validateJournalEntry(journal);
        expect(result.isValid).toBe(true);
    });

    test('should handle floating point precision', () => {
        const journal = {
            date: '2025-01-15',
            lines: [
                { accountCode: '1100', debit: 0.1 + 0.2, credit: 0 },
                { accountCode: '3100', debit: 0, credit: 0.3 },
            ]
        };

        const result = validateJournalEntry(journal);
        // 0.1 + 0.2 = 0.30000000000000004, but our tolerance is 0.01
        expect(result.isValid).toBe(true);
    });
});

describe('Journal Entry - Required Fields', () => {

    test('should FAIL without a date', () => {
        const journal = {
            date: '',
            lines: [
                { accountCode: '1100', debit: 1000, credit: 0 },
                { accountCode: '3100', debit: 0, credit: 1000 },
            ]
        };

        const result = validateJournalEntry(journal);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.includes('Tanggal'))).toBe(true);
    });

    test('should FAIL with less than 2 lines', () => {
        const journal = {
            date: '2025-01-15',
            lines: [
                { accountCode: '1100', debit: 1000, credit: 0 },
            ]
        };

        const result = validateJournalEntry(journal);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.includes('minimal 2'))).toBe(true);
    });

    test('should FAIL with missing account code', () => {
        const journal = {
            date: '2025-01-15',
            lines: [
                { accountCode: '', debit: 1000, credit: 0 },
                { accountCode: '3100', debit: 0, credit: 1000 },
            ]
        };

        const result = validateJournalEntry(journal);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.includes('Kode akun'))).toBe(true);
    });

    test('should FAIL when a line has both debit and credit', () => {
        const journal = {
            date: '2025-01-15',
            lines: [
                { accountCode: '1100', debit: 1000, credit: 500 },
                { accountCode: '3100', debit: 0, credit: 500 },
            ]
        };

        const result = validateJournalEntry(journal);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.includes('bersamaan'))).toBe(true);
    });

    test('should FAIL when a line has zero debit AND zero credit', () => {
        const journal = {
            date: '2025-01-15',
            lines: [
                { accountCode: '1100', debit: 1000, credit: 0 },
                { accountCode: '3100', debit: 0, credit: 0 },
            ]
        };

        const result = validateJournalEntry(journal);
        expect(result.isValid).toBe(false);
    });
});

describe('Journal Entry - Large Numbers (Billions)', () => {

    test('should handle Rp 11 Billion correctly', () => {
        const journal = {
            date: '2025-01-15',
            lines: [
                { accountCode: '1100', debit: 11077602827, credit: 0 },
                { accountCode: '3100', debit: 0, credit: 11077602827 },
            ]
        };

        const result = validateJournalEntry(journal);
        expect(result.isValid).toBe(true);
    });

    test('should detect 1 Rupiah difference in billions', () => {
        const journal = {
            date: '2025-01-15',
            lines: [
                { accountCode: '1100', debit: 11000000000, credit: 0 },
                { accountCode: '3100', debit: 0, credit: 10999999999 },
            ]
        };

        const result = validateJournalEntry(journal);
        expect(result.isValid).toBe(false);
    });
});
