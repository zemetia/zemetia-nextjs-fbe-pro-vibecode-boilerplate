/**
 * Finance & Reports Unit Tests (Batch 1)
 * Tests: Income Statement, Cash Flow Statement, AR/AP Aging
 */

// ─── Mock Data Helpers ───
const mockAccounts = [
    { code: '1110', name: 'Kas', type: 'detail', category: 'aset' },
    { code: '1120', name: 'Bank BCA', type: 'detail', category: 'aset' },
    { code: '1150', name: 'Piutang Usaha', type: 'detail', category: 'aset' },
    { code: '1210', name: 'Mesin Produksi', type: 'detail', category: 'aset' },
    { code: '2110', name: 'Hutang Dagang', type: 'detail', category: 'kewajiban' },
    { code: '3100', name: 'Modal Pemilik', type: 'detail', category: 'ekuitas' },
    { code: '4100', name: 'Pendapatan Jasa', type: 'detail', category: 'pendapatan' },
    { code: '5100', name: 'Beban Gaji', type: 'detail', category: 'beban' },
    { code: '5200', name: 'Beban Sewa', type: 'detail', category: 'beban' },
];

const createJournal = (date, description, lines) => ({
    id: `JE-${Math.random()}`,
    date,
    description,
    lines: lines.map(l => ({
        accountCode: l.code,
        debit: l.debit || 0,
        credit: l.credit || 0,
    })),
});

// ─── Income Statement Logic ───
function calculateProfitLoss(accounts, journals, startDate, endDate) {
    const filteredEntries = journals.filter(e => e.date >= startDate && e.date <= endDate);
    const accountBalances = {};
    accounts.filter(a => a.type === 'detail').forEach(acc => {
        accountBalances[acc.code] = { ...acc, balance: 0 };
    });

    filteredEntries.forEach(entry => {
        entry.lines.forEach(line => {
            const acc = accountBalances[line.accountCode];
            if (acc) {
                if (acc.category === 'pendapatan') {
                    acc.balance += (line.credit || 0) - (line.debit || 0);
                } else if (acc.category === 'beban' || acc.category === 'other') {
                    acc.balance += (line.debit || 0) - (line.credit || 0);
                }
            }
        });
    });

    const result = { totalPendapatan: 0, totalBeban: 0, labaRugi: 0 };
    Object.values(accountBalances).forEach(acc => {
        if (acc.category === 'pendapatan') result.totalPendapatan += acc.balance;
        else if (acc.category === 'beban') result.totalBeban += acc.balance;
    });
    result.labaRugi = result.totalPendapatan - result.totalBeban;
    return result;
}

// ─── Cash Flow Logic ───
function classifyTransaction(line, entry, accounts) {
    const contraAccounts = entry.lines.filter(l => l.accountCode !== line.accountCode);
    for (let contra of contraAccounts) {
        const account = accounts.find(a => a.code === contra.accountCode);
        if (!account) continue;
        if (account.category === 'pendapatan' || account.category === 'beban') return 'operating';
        if (account.code.startsWith('11') || account.code.startsWith('21')) return 'operating';
        if (account.code.startsWith('12')) return 'investing';
        if (account.code.startsWith('22') || account.code.startsWith('3')) return 'financing';
    }
    return 'operating';
}

function calculateCashFlow(accounts, journals, startDate, endDate, beginningBalance = 0) {
    const cashAccounts = ['1110', '1120'];
    const result = { totalOperating: 0, totalInvesting: 0, totalFinancing: 0, netCashFlow: 0, endingBalance: 0 };

    journals.filter(e => e.date >= startDate && e.date <= endDate).forEach(entry => {
        entry.lines.forEach(line => {
            if (!cashAccounts.includes(line.accountCode)) return;
            const amount = line.debit - line.credit;
            const cat = classifyTransaction(line, entry, accounts);
            if (cat === 'operating') result.totalOperating += amount;
            else if (cat === 'investing') result.totalInvesting += amount;
            else if (cat === 'financing') result.totalFinancing += amount;
        });
    });
    result.netCashFlow = result.totalOperating + result.totalInvesting + result.totalFinancing;
    result.endingBalance = beginningBalance + result.netCashFlow;
    return result;
}

// ─── Aging Logic ───
function calculateAging(transactions, asOfDate) {
    const customerBalances = {};
    transactions.forEach(t => {
        const customer = t.description.split(' ')[0] || 'Unknown';
        if (!customerBalances[customer]) {
            customerBalances[customer] = {
                customerName: customer,
                total: 0, current: 0, days1_30: 0, days31_60: 0, days61_90: 0, daysOver90: 0
            };
        }
        if (t.balance > 0) {
            const diff = (new Date(asOfDate) - new Date(t.date)) / (1000 * 60 * 60 * 24);
            customerBalances[customer].total += t.balance;
            if (diff <= 0) customerBalances[customer].current += t.balance;
            else if (diff <= 30) customerBalances[customer].days1_30 += t.balance;
            else if (diff <= 60) customerBalances[customer].days31_60 += t.balance;
            else if (diff <= 90) customerBalances[customer].days61_90 += t.balance;
            else customerBalances[customer].daysOver90 += t.balance;
        }
    });
    return Object.values(customerBalances);
}

// ─── General Ledger Logic ───
function getTransactionsByAccount(accountCode, journals, accounts, startDate = null, endDate = null) {
    const transactions = [];
    journals.forEach(entry => {
        if (startDate && entry.date < startDate) return;
        if (endDate && entry.date > endDate) return;
        entry.lines.forEach(line => {
            if (line.accountCode === accountCode) {
                transactions.push({ date: entry.date, debit: line.debit || 0, credit: line.credit || 0 });
            }
        });
    });
    transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
    const account = accounts.find(a => a.code === accountCode);
    const isDebitAccount = ['aset', 'beban'].includes(account?.category);
    let balance = 0;
    transactions.forEach(txn => {
        balance += isDebitAccount ? (txn.debit - txn.credit) : (txn.credit - txn.debit);
        txn.balance = balance;
    });
    return transactions;
}

// ─── Tests ───

describe('Finance Reports - Income Statement', () => {
    test('should calculate Net Income correctly (Revenue - Expenses)', () => {
        const journals = [
            createJournal('2025-01-01', 'Invoice #1', [{ code: '4100', credit: 5000000 }, { code: '1150', debit: 5000000 }]),
            createJournal('2025-01-05', 'Gaji Januari', [{ code: '5100', debit: 2000000 }, { code: '1110', credit: 2000000 }]),
        ];
        const result = calculateProfitLoss(mockAccounts, journals, '2025-01-01', '2025-01-31');
        expect(result.totalPendapatan).toBe(5000000);
        expect(result.totalBeban).toBe(2000000);
        expect(result.labaRugi).toBe(3000000);
    });

    test('should ignore journals outside date range', () => {
        const journals = [
            createJournal('2024-12-31', 'Old Revenue', [{ code: '4100', credit: 1000000 }, { code: '1110', debit: 1000000 }]),
            createJournal('2025-01-01', 'New Revenue', [{ code: '4100', credit: 5000000 }, { code: '1110', debit: 5000000 }]),
        ];
        const result = calculateProfitLoss(mockAccounts, journals, '2025-01-01', '2025-01-31');
        expect(result.totalPendapatan).toBe(5000000);
    });
});

describe('Finance Reports - Cash Flow', () => {
    test('should classify Operating vs Investing vs Financing correctly', () => {
        const journals = [
            createJournal('2025-01-01', 'Sales', [{ code: '1110', debit: 1000000 }, { code: '4100', credit: 1000000 }]), // Operating
            createJournal('2025-01-02', 'Buy Machine', [{ code: '1110', credit: 500000 }, { code: '1210', debit: 500000 }]), // Investing
            createJournal('2025-01-03', 'Owner Investment', [{ code: '1110', debit: 2000000 }, { code: '3100', credit: 2000000 }]), // Financing
        ];
        const result = calculateCashFlow(mockAccounts, journals, '2025-01-01', '2025-01-31', 0);
        expect(result.totalOperating).toBe(1000000);
        expect(result.totalInvesting).toBe(-500000);
        expect(result.totalFinancing).toBe(2000000);
        expect(result.netCashFlow).toBe(2500000);
    });
});

describe('Finance Reports - AR Aging', () => {
    test('should sort balances into correct aging buckets', () => {
        const asOf = '2025-04-01';
        const txs = [
            { date: '2025-04-01', description: 'CUST-A Invoice', balance: 1000000 }, // Current
            { date: '2025-03-15', description: 'CUST-A Invoice', balance: 500000 },  // 1-30 days
            { date: '2025-02-15', description: 'CUST-B Invoice', balance: 2000000 }, // 31-60 days
            { date: '2024-12-01', description: 'CUST-C Invoice', balance: 3000000 }, // Over 90 days
        ];
        const result = calculateAging(txs, asOf);

        const custA = result.find(c => c.customerName === 'CUST-A');
        const custB = result.find(c => c.customerName === 'CUST-B');
        const custC = result.find(c => c.customerName === 'CUST-C');

        expect(custA.current).toBe(1000000);
        expect(custA.days1_30).toBe(500000);
        expect(custB.days31_60).toBe(2000000);
        expect(custC.daysOver90).toBe(3000000);
    });
});

describe('Finance Reports - General Ledger', () => {
    test('should calculate running balance for Asset (Debit Normal)', () => {
        const journals = [
            createJournal('2025-01-01', 'Init', [{ code: '1110', debit: 1000 }]),
            createJournal('2025-01-02', 'Spend', [{ code: '1110', credit: 400 }]),
        ];
        const txs = getTransactionsByAccount('1110', journals, mockAccounts);
        expect(txs[0].balance).toBe(1000);
        expect(txs[1].balance).toBe(600);
    });

    test('should calculate running balance for Liability (Credit Normal)', () => {
        const journals = [
            createJournal('2025-01-01', 'Loan', [{ code: '2110', credit: 5000 }]),
            createJournal('2025-01-02', 'Pay', [{ code: '2110', debit: 2000 }]),
        ];
        const txs = getTransactionsByAccount('2110', journals, mockAccounts);
        expect(txs[0].balance).toBe(5000);
        expect(txs[1].balance).toBe(3000);
    });
});
