/**
 * Gold & Production Unit Tests (Batch 2)
 * Tests: Yield Protection, Dust Recovery Valuation, Purity Conversion
 */

// ─── Direct Swap Yield Protection Logic ───
function checkYieldViolation(type, totalWeightIn, avgPurity, weightOut) {
    const maxYield = (totalWeightIn * avgPurity / 100);
    const allowance = 0.005;

    // Protection only for TRADING
    if (type === 'TRADING' && weightOut > maxYield + allowance) {
        return { blocked: true, reason: 'Yield Protection Alert' };
    }
    return { blocked: false };
}

// ─── Gold Dust Recovery Logic ───
function calculateDustRecovery(dustWeight, estimatedPurity, goldPricePerGram = 1000000) {
    const purity = estimatedPurity || 90;
    const dustValue = (dustWeight * purity / 100) * goldPricePerGram;
    return { purity, dustValue };
}

// ─── Hydrostatic Balance Purity Helper (Mocked as per standard SG math often used in jewelry) ───
// Math: SG = WeightInAir / (WeightInAir - WeightInWater)
// Purity (Gold) is then derived from SG. For the test, we assume a simplified SG check.
function calculatePurityFromSG(weightAir, weightWater) {
    if (weightAir <= weightWater) return 0;
    const sg = weightAir / (weightAir - weightWater);
    // Simplified specific gravity to purity conversion (Gold)
    // SG 19.3 = 24K (100%), SG 10.5 = Silver (approx)
    if (sg >= 19.3) return 100;
    if (sg <= 10.5) return 0;
    // Linear approximation for testing
    return ((sg - 10.5) / (19.3 - 10.5)) * 100;
}

// ─── Tests ───

describe('Gold Operations - Yield Protection', () => {
    test('should BLOCK trading if output exceeds fine gold content', () => {
        // 100g 50% purity = 50g fine gold. Attempting to take 51g.
        const result = checkYieldViolation('TRADING', 100, 50, 51);
        expect(result.blocked).toBe(true);
    });

    test('should ALLOW trading if output is within yield + allowance', () => {
        // 100g 50% purity = 50g fine gold. Attempting to take 50.004g.
        const result = checkYieldViolation('TRADING', 100, 50, 50.004);
        expect(result.blocked).toBe(false);
    });

    test('should NOT block MAKLOON even if output exceeds yield (contract-based)', () => {
        const result = checkYieldViolation('MAKLOON', 100, 50, 55);
        expect(result.blocked).toBe(false);
    });
});

describe('Gold Operations - Dust Recovery', () => {
    test('should calculate correct valuation based on purity', () => {
        // 10g dust @ 90% purity, price 1M/g
        const result = calculateDustRecovery(10, 90, 1000000);
        expect(result.dustValue).toBe(9000000);
    });

    test('should default to 90% purity if not specified', () => {
        const result = calculateDustRecovery(10, null, 1000000);
        expect(result.purity).toBe(90);
        expect(result.dustValue).toBe(9000000);
    });
});

describe('Gold Operations - Lab Math (Hydrostatic)', () => {
    test('should calculate 100% purity for SG 19.3', () => {
        // SG = 193 / (193 - 183) = 193 / 10 = 19.3
        const purity = calculatePurityFromSG(193, 183);
        expect(purity).toBe(100);
    });

    test('should handle invalid water weights', () => {
        const purity = calculatePurityFromSG(100, 100);
        expect(purity).toBe(0);
    });
});
