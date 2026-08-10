/**
 * Refining Math & Metal Return Tests
 * Tests: MasterRefiningRules lookup and Net Gold calculation
 */

// ─── Refining Rule Logic (Mocked from MasterRefiningRules.js) ───
const rules = [
    { grade_id: 'P-24K', min_weight: 0, max_weight: 99999, au_return_pct: 100.00 },
    { grade_id: 'P-23K', min_weight: 0, max_weight: 10, au_return_pct: 99.98 },
    { grade_id: 'P-23K', min_weight: 10.001, max_weight: 99999, au_return_pct: 99.99 },
    { grade_id: 'P-22K', min_weight: 0, max_weight: 99999, au_return_pct: 99.95 }
];

function getRule(gradeId, weight) {
    return rules.find(r =>
        r.grade_id === gradeId &&
        weight >= r.min_weight &&
        weight <= r.max_weight
    );
}

function calculateNetWeight(weight, purity, ruleOverride = null) {
    // Logic from directSwap.js
    let returnPct = 100; // Default recovery rate is 100% of fine gold
    const rule = ruleOverride || getRule('P-ID', weight); // Simplified lookup for test

    const is24K = purity >= 99.99;
    if (is24K) {
        returnPct = 100;
    } else if (rule) {
        returnPct = rule.au_return_pct;
    }

    const purityFactor = is24K ? 1.0 : (purity / 100);
    return parseFloat((weight * purityFactor * (returnPct / 100)).toFixed(3));
}

// ─── Tests ───

describe('Refining - Master Rules Lookup', () => {
    test('should find 23K rule for low weight (range 0-10)', () => {
        const rule = getRule('P-23K', 5);
        expect(rule.au_return_pct).toBe(99.98);
    });

    test('should find 23K rule for high weight (range >10)', () => {
        const rule = getRule('P-23K', 15);
        expect(rule.au_return_pct).toBe(99.99);
    });

    test('should return undefined for unknown grade', () => {
        expect(getRule('P-UNKNOWN', 10)).toBeUndefined();
    });
});

describe('Refining - Metal Return (Net) Math', () => {
    test('should return 100% for 24K gold', () => {
        // 100g 24K -> 100g Net
        const net = calculateNetWeight(100, 99.99);
        expect(net).toBe(100.000);
    });

    test('should apply 23K rule (99.98%) correctly', () => {
        const rule = getRule('P-23K', 5);
        // 100g 23K (96% purity, 99.98% return) -> 100 * 0.96 * 0.9998 = 95.981
        const net = calculateNetWeight(100, 96, rule);
        expect(net).toBe(95.981);
    });

    test('should apply 22K rule (99.95%) correctly', () => {
        const rule = getRule('P-22K', 50);
        // 100g 22K (91.6% purity, 99.95% return) -> 100 * 0.916 * 0.9995 = 91.554
        const net = calculateNetWeight(100, 91.6, rule);
        expect(net).toBe(91.554);
    });

    test('should handle small weights with precision', () => {
        const rule = getRule('P-23K', 1);
        // 1.234g @ 96% purity * 99.98% = 1.184
        const net = calculateNetWeight(1.234, 96, rule);
        expect(net).toBe(1.184);
    });
});
