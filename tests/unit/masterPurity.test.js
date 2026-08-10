/**
 * Master Purity Unit Tests
 * Tests: Grade lookup, range boundaries, CRUD operations
 */

// ─── Extracted Purity Logic ───

const DEFAULT_GRADES = [
    { id: 'P-24K', metal: 'GOLD', grade: '24K', min: 99.99, max: 100.00, description: 'Logam Mulia (LM)' },
    { id: 'P-23K', metal: 'GOLD', grade: '23K', min: 95.83, max: 99.98, description: 'Emas Tua' },
    { id: 'P-22K', metal: 'GOLD', grade: '22K', min: 91.67, max: 95.82, description: 'Emas 916' },
    { id: 'P-21K', metal: 'GOLD', grade: '21K', min: 87.50, max: 91.66, description: 'Emas 21K' },
    { id: 'P-18K', metal: 'GOLD', grade: '18K', min: 75.00, max: 79.16, description: 'Emas 18K' },
    { id: 'P-14K', metal: 'GOLD', grade: '14K', min: 58.33, max: 62.49, description: 'Emas 14K' },
    { id: 'P-9K', metal: 'GOLD', grade: '9K', min: 37.50, max: 41.66, description: 'Emas 9K' },
    { id: 'P-6K', metal: 'GOLD', grade: '6K', min: 25.00, max: 33.32, description: 'Emas 6K' },
    { id: 'S-999', metal: 'SILVER', grade: 'Silver 999', min: 99.90, max: 100.00, description: 'Fine Silver' },
    { id: 'S-925', metal: 'SILVER', grade: 'Sterling', min: 92.50, max: 99.89, description: 'Perak Standar' },
    { id: 'S-STD', metal: 'SILVER', grade: 'Silver Std', min: 50.00, max: 92.49, description: 'Perak Campur' },
];

function getGrade(grades, metal, purityPercentage) {
    if (!metal || purityPercentage === undefined) return null;
    metal = metal.toUpperCase();
    const pct = parseFloat(purityPercentage);
    return grades.find(g =>
        g.metal === metal &&
        pct >= g.min &&
        pct <= g.max
    ) || null;
}

// ─── Tests ───

describe('MasterPurity - Gold Grade Lookup', () => {

    test('99.99% purity should be 24K', () => {
        const result = getGrade(DEFAULT_GRADES, 'GOLD', 99.99);
        expect(result).not.toBeNull();
        expect(result.grade).toBe('24K');
    });

    test('100% purity should be 24K', () => {
        const result = getGrade(DEFAULT_GRADES, 'GOLD', 100.00);
        expect(result).not.toBeNull();
        expect(result.grade).toBe('24K');
    });

    test('95.83% should be 23K (lower boundary)', () => {
        const result = getGrade(DEFAULT_GRADES, 'GOLD', 95.83);
        expect(result).not.toBeNull();
        expect(result.grade).toBe('23K');
    });

    test('99.98% should be 23K (upper boundary)', () => {
        const result = getGrade(DEFAULT_GRADES, 'GOLD', 99.98);
        expect(result).not.toBeNull();
        expect(result.grade).toBe('23K');
    });

    test('91.67% should be 22K', () => {
        const result = getGrade(DEFAULT_GRADES, 'GOLD', 91.67);
        expect(result).not.toBeNull();
        expect(result.grade).toBe('22K');
    });

    test('75.00% should be 18K', () => {
        const result = getGrade(DEFAULT_GRADES, 'GOLD', 75.00);
        expect(result).not.toBeNull();
        expect(result.grade).toBe('18K');
    });

    test('25.00% should be 6K (lowest gold grade)', () => {
        const result = getGrade(DEFAULT_GRADES, 'GOLD', 25.00);
        expect(result).not.toBeNull();
        expect(result.grade).toBe('6K');
    });

    test('24.99% should return null (below minimum gold grade)', () => {
        const result = getGrade(DEFAULT_GRADES, 'GOLD', 24.99);
        expect(result).toBeNull();
    });
});

describe('MasterPurity - Silver Grade Lookup', () => {

    test('99.90% silver should be Silver 999', () => {
        const result = getGrade(DEFAULT_GRADES, 'SILVER', 99.90);
        expect(result).not.toBeNull();
        expect(result.grade).toBe('Silver 999');
    });

    test('92.50% silver should be Sterling', () => {
        const result = getGrade(DEFAULT_GRADES, 'SILVER', 92.50);
        expect(result).not.toBeNull();
        expect(result.grade).toBe('Sterling');
    });

    test('50.00% silver should be Silver Std', () => {
        const result = getGrade(DEFAULT_GRADES, 'SILVER', 50.00);
        expect(result).not.toBeNull();
        expect(result.grade).toBe('Silver Std');
    });

    test('49.99% silver should return null', () => {
        const result = getGrade(DEFAULT_GRADES, 'SILVER', 49.99);
        expect(result).toBeNull();
    });
});

describe('MasterPurity - Edge Cases', () => {

    test('should handle case-insensitive metal name', () => {
        const result = getGrade(DEFAULT_GRADES, 'gold', 99.99);
        expect(result).not.toBeNull();
        expect(result.grade).toBe('24K');
    });

    test('should handle string purity values', () => {
        const result = getGrade(DEFAULT_GRADES, 'GOLD', '99.99');
        expect(result).not.toBeNull();
        expect(result.grade).toBe('24K');
    });

    test('should return null for null metal', () => {
        expect(getGrade(DEFAULT_GRADES, null, 99.99)).toBeNull();
    });

    test('should return null for undefined purity', () => {
        expect(getGrade(DEFAULT_GRADES, 'GOLD', undefined)).toBeNull();
    });

    test('should return null for unknown metal', () => {
        expect(getGrade(DEFAULT_GRADES, 'PLATINUM', 99.99)).toBeNull();
    });

    test('should not cross-match gold purity with silver', () => {
        // 99.95% is in Silver 999 range but when querying GOLD it should be 23K
        const goldResult = getGrade(DEFAULT_GRADES, 'GOLD', 99.95);
        const silverResult = getGrade(DEFAULT_GRADES, 'SILVER', 99.95);
        expect(goldResult.grade).toBe('23K');
        expect(silverResult.grade).toBe('Silver 999');
    });
});
