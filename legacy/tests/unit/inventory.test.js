/**
 * Inventory & Procurement Unit Tests (Batch 4)
 * Tests: Average Cost calculation, Stock depletion, Reorder Points
 */

// ─── Warehouse Stock Logic ───
function updateStock(current, qty, price, type) {
    let quantity = current.quantity;
    let value = current.value;

    if (type === 'IN') {
        quantity += qty;
        value += (qty * price);
    } else {
        if (quantity < qty) throw new Error('Insufficient Stock');
        quantity -= qty;
        value -= (qty * price); // In this system, OUT price is passed (usually avg cost)
    }

    return {
        quantity,
        value,
        avgCost: quantity > 0 ? value / quantity : 0
    };
}

// ─── Reorder System Logic ───
function checkStockLevel(item, currentStock, settings = { alertThreshold: 0.8 }) {
    const reorderPoint = item.reorderPoint || 0;
    const minStock = item.minStock || 0;

    if (currentStock <= 0) return 'CRITICAL';
    if (currentStock < minStock) return 'LOW';
    if (currentStock < reorderPoint) return 'WARNING';

    const threshold = reorderPoint * (1 + (1 - settings.alertThreshold));
    if (currentStock < threshold) return 'INFO';

    return 'OK';
}

function calculateOrderQty(item, currentStock) {
    const maxStock = item.maxStock || (item.reorderPoint * 3);
    const qtyToMax = maxStock - currentStock;
    const qtyToReorder = item.reorderPoint - currentStock;
    return Math.max(qtyToMax, qtyToReorder, item.minStock || 0);
}

// ─── Tests ───

describe('Inventory - Average Cost Math', () => {
    test('should calculate correct average cost after multiple IN', () => {
        let stock = { quantity: 0, value: 0 };
        // Buy 10 @ 1000
        stock = updateStock(stock, 10, 1000, 'IN');
        expect(stock.avgCost).toBe(1000);
        // Buy 10 @ 2000
        stock = updateStock(stock, 10, 2000, 'IN');
        // Total 20 @ (10k + 20k = 30k) -> 1500
        expect(stock.avgCost).toBe(1500);
    });

    test('should maintain average cost after OUT', () => {
        let stock = { quantity: 20, value: 30000 }; // avg 1500
        stock = updateStock(stock, 10, 1500, 'OUT');
        expect(stock.quantity).toBe(10);
        expect(stock.value).toBe(15000);
        expect(stock.avgCost).toBe(1500);
    });

    test('should block OUT if insufficient stock', () => {
        let stock = { quantity: 5, value: 5000 };
        expect(() => updateStock(stock, 10, 1000, 'OUT')).toThrow('Insufficient Stock');
    });
});

describe('Inventory - Reorder System Triggers', () => {
    const item = { code: 'A01', reorderPoint: 100, minStock: 20, maxStock: 500 };

    test('should trigger CRITICAL on zero stock', () => {
        expect(checkStockLevel(item, 0)).toBe('CRITICAL');
    });

    test('should trigger LOW on below minimum', () => {
        expect(checkStockLevel(item, 15)).toBe('LOW');
    });

    test('should trigger WARNING on below reorder point', () => {
        expect(checkStockLevel(item, 50)).toBe('WARNING');
    });

    test('should trigger INFO on approach (alertThreshold 0.8 -> 120%)', () => {
        // threshold = 100 * (1 + 0.2) = 120
        expect(checkStockLevel(item, 110)).toBe('INFO');
    });

    test('should return OK if stock healthy', () => {
        expect(checkStockLevel(item, 200)).toBe('OK');
    });
});

describe('Inventory - Order Quantity Calculation', () => {
    const item = { code: 'A01', reorderPoint: 100, minStock: 20, maxStock: 500 };

    test('should order up to max stock', () => {
        // Current 50, Max 500, Reorder 100.
        // QtyToMax = 450, QtyToReorder = 50.
        expect(calculateOrderQty(item, 50)).toBe(450);
    });
});
