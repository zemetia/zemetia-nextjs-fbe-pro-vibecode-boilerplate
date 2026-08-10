/**
 * Balance Sheet Unit Tests
 * Tests the core accounting logic: cumulative calculation, normal balances
 */

// ─── Mock Dependencies ───
const mockAccounts = [
    { code: '1100', name: 'Kas', type: 'detail', category: 'aset' },
    { code: '1110', name: 'Bank BCA', type: 'detail', category: 'aset' },
    { code: '1200', name: 'Persediaan Emas', type: 'detail', category: 'aset' },
    { code: '1300', name: 'Mesin', type: 'detail', category: 'aset' },
    { code: '2100', name: 'Hutang Dagang', type: 'detail', category: 'kewajiban' },
    { code: '3100', name: 'Modal', type: 'detail', category: 'ekuitas' },
    { code: '4100', name: 'Pendapatan', type: 'detail', category: 'pendapatan' },
    { code: '5100', name: 'Beban Operasional', type: 'detail', category: 'beban' },
];

const createJournal = (date, lines) => ({
    id: `JE-${Date.now()}-${Math.random()}`,
    date,
    lines: lines.map(l => ({
        accountCode: l.code,
        debit: l.debit || 0,
        credit: l.credit || 0,
    })),
});

// Simple BalanceSheet logic extracted for unit testing
function calculateBalances(accounts, journals, filterEndDate) {
    const accountBalances = {};
    accounts.forEach(account => {
        if (account.type === 'detail') {
            accountBalances[account.code] = 0;
        }
    });

    journals.forEach(journal => {
        const journalDate = new Date(journal.date);
        const endFilter = new Date(filterEndDate);

        if (journalDate <= endFilter) {
            journal.lines.forEach(line => {
                if (accountBalances[line.accountCode] !== undefined) {
                    accountBalances[line.accountCode] += (line.debit || 0) - (line.credit || 0);
                }
            });
        }
    });

    const balances = {
        aset: { current: [], nonCurrent: [], total: 0 },
        kewajiban: { current: [], longTerm: [], total: 0 },
        ekuitas: { items: [], total: 0 },
        netIncome: 0,
    };

    let totalRevenue = 0;
    let totalExpenses = 0;

    accounts.forEach(account => {
        if (account.type !== 'detail') return;
        const rawBalance = accountBalances[account.code] || 0;
        let balance;

        if (account.category === 'aset' || account.category === 'beban') {
            balance = rawBalance;
        } else if (['kewajiban', 'ekuitas', 'pendapatan'].includes(account.category)) {
            balance = -rawBalance;
        } else {
            balance = rawBalance;
        }

        if (account.category === 'aset') {
            if (account.code.startsWith('11')) {
                balances.aset.current.push({ ...account, balance });
            } else {
                balances.aset.nonCurrent.push({ ...account, balance });
            }
            balances.aset.total += balance;
        } else if (account.category === 'kewajiban') {
            if (account.code.startsWith('21')) {
                balances.kewajiban.current.push({ ...account, balance });
            } else {
                balances.kewajiban.longTerm.push({ ...account, balance });
            }
            balances.kewajiban.total += balance;
        } else if (account.category === 'ekuitas') {
            balances.ekuitas.items.push({ ...account, balance });
            balances.ekuitas.total += balance;
        } else if (account.category === 'pendapatan') {
            totalRevenue += balance;
        } else if (account.category === 'beban' || account.category === 'other') {
            totalExpenses += balance;
        }
    });

    balances.netIncome = totalRevenue - totalExpenses;
    balances.ekuitas.total += balances.netIncome;
    balances.totalRevenue = totalRevenue;
    balances.totalExpenses = totalExpenses;

    return balances;
}

// ─── Tests ───

describe('Balance Sheet - Cumulative Calculation', () => {

    test('should calculate cumulative assets from multiple months', () => {
        const journals = [
            createJournal('2025-01-15', [
                { code: '1100', debit: 5000000000 },  // 5B Kas masuk
                { code: '3100', credit: 5000000000 },  // Modal
            ]),
            createJournal('2025-06-20', [
                { code: '1100', debit: 6000000000 },  // 6B Kas masuk
                { code: '3100', credit: 6000000000 },  // Modal
            ]),
        ];

        const result = calculateBalances(mockAccounts, journals, '2025-12-31');

        // Total assets should be cumulative: 5B + 6B = 11B
        expect(result.aset.total).toBe(11000000000);
    });

    test('should only include journals UP TO the end date', () => {
        const journals = [
            createJournal('2025-01-15', [
                { code: '1100', debit: 5000000000 },
                { code: '3100', credit: 5000000000 },
            ]),
            createJournal('2025-12-20', [
                { code: '1100', debit: 3000000000 },
                { code: '3100', credit: 3000000000 },
            ]),
        ];

        // End date is June → should NOT include December journal
        const result = calculateBalances(mockAccounts, journals, '2025-06-30');
        expect(result.aset.total).toBe(5000000000);
    });

    test('should return zero if no journals exist', () => {
        const result = calculateBalances(mockAccounts, [], '2025-12-31');
        expect(result.aset.total).toBe(0);
        expect(result.kewajiban.total).toBe(0);
        expect(result.ekuitas.total).toBe(0);
    });
});

describe('Balance Sheet - Accounting Equation', () => {

    test('Assets = Liabilities + Equity (simple case)', () => {
        const journals = [
            createJournal('2025-01-01', [
                { code: '1100', debit: 10000000 },   // Kas
                { code: '3100', credit: 10000000 },   // Modal
            ]),
        ];

        const result = calculateBalances(mockAccounts, journals, '2025-12-31');

        // A = L + E
        const lhs = result.aset.total;
        const rhs = result.kewajiban.total + result.ekuitas.total;
        expect(lhs).toBe(rhs);
    });

    test('Assets = Liabilities + Equity (with debt)', () => {
        const journals = [
            // Modal awal 
            createJournal('2025-01-01', [
                { code: '1100', debit: 10000000 },
                { code: '3100', credit: 10000000 },
            ]),
            // Beli mesin dengan hutang
            createJournal('2025-02-01', [
                { code: '1300', debit: 50000000 },    // Mesin (asset naik)
                { code: '2100', credit: 50000000 },   // Hutang (liability naik)
            ]),
        ];

        const result = calculateBalances(mockAccounts, journals, '2025-12-31');

        const assets = result.aset.total;       // 10M + 50M = 60M
        const liabilities = result.kewajiban.total; // 50M
        const equity = result.ekuitas.total;    // 10M

        expect(assets).toBe(60000000);
        expect(liabilities).toBe(50000000);
        expect(equity).toBe(10000000);
        expect(assets).toBe(liabilities + equity);
    });

    test('Net Income flows into Equity', () => {
        const journals = [
            createJournal('2025-01-01', [
                { code: '1100', debit: 10000000 },
                { code: '3100', credit: 10000000 },
            ]),
            // Revenue
            createJournal('2025-03-01', [
                { code: '1100', debit: 5000000 },
                { code: '4100', credit: 5000000 },  // Pendapatan
            ]),
            // Expense
            createJournal('2025-03-15', [
                { code: '5100', debit: 2000000 },   // Beban
                { code: '1100', credit: 2000000 },
            ]),
        ];

        const result = calculateBalances(mockAccounts, journals, '2025-12-31');

        // Net Income = Revenue - Expense = 5M - 2M = 3M
        expect(result.netIncome).toBe(3000000);

        // Equity should include modal (10M) + net income (3M) = 13M
        expect(result.ekuitas.total).toBe(13000000);

        // Assets = 10M + 5M - 2M = 13M
        expect(result.aset.total).toBe(13000000);

        // A = L + E still holds
        expect(result.aset.total).toBe(result.kewajiban.total + result.ekuitas.total);
    });
});

describe('Balance Sheet - Normal Balances', () => {

    test('Asset accounts have debit normal balance (positive)', () => {
        const journals = [
            createJournal('2025-01-01', [
                { code: '1100', debit: 1000000 },
                { code: '3100', credit: 1000000 },
            ]),
        ];

        const result = calculateBalances(mockAccounts, journals, '2025-12-31');
        const kasAccount = result.aset.current.find(a => a.code === '1100');
        expect(kasAccount.balance).toBe(1000000); // Positive
    });

    test('Liability accounts have credit normal balance (positive)', () => {
        const journals = [
            createJournal('2025-01-01', [
                { code: '1100', debit: 1000000 },
                { code: '2100', credit: 1000000 },
            ]),
        ];

        const result = calculateBalances(mockAccounts, journals, '2025-12-31');
        expect(result.kewajiban.total).toBe(1000000); // Positive
    });

    test('Equity accounts have credit normal balance (positive)', () => {
        const journals = [
            createJournal('2025-01-01', [
                { code: '1100', debit: 1000000 },
                { code: '3100', credit: 1000000 },
            ]),
        ];

        const result = calculateBalances(mockAccounts, journals, '2025-12-31');
        // Equity items balance (excluding net income)
        const modal = result.ekuitas.items.find(a => a.code === '3100');
        expect(modal.balance).toBe(1000000); // Positive
    });
});

describe('Balance Sheet - Asset Classification', () => {

    test('Current assets (11xx) vs Non-current assets (12xx+)', () => {
        const journals = [
            createJournal('2025-01-01', [
                { code: '1100', debit: 5000000 },   // Kas (current)
                { code: '1300', debit: 3000000 },   // Mesin (non-current)
                { code: '3100', credit: 8000000 },
            ]),
        ];

        const result = calculateBalances(mockAccounts, journals, '2025-12-31');

        const currentTotal = result.aset.current.reduce((sum, a) => sum + a.balance, 0);
        const nonCurrentTotal = result.aset.nonCurrent.reduce((sum, a) => sum + a.balance, 0);

        expect(currentTotal).toBe(5000000);
        expect(nonCurrentTotal).toBe(3000000);
        expect(result.aset.total).toBe(8000000);
    });
});
