// ==========================================
// Inventory Valuation Module
// Average Cost Method for Golden Alura Refinery
// Handles cost calculations and inventory valuation
// ==========================================

const InventoryValuation = {
    // Calculate weighted average cost after a new purchase
    calculateAverageCost(existingQty, existingAvgCost, newQty, newUnitCost) {
        // Handle edge cases
        if (newQty <= 0) {
            return existingAvgCost; // No change if no new quantity
        }

        if (existingQty <= 0) {
            return newUnitCost; // First purchase, use new unit cost
        }

        // Calculate weighted average
        const existingValue = existingQty * existingAvgCost;
        const newValue = newQty * newUnitCost;
        const totalQty = existingQty + newQty;

        return (existingValue + newValue) / totalQty;
    },

    // Update item's average cost after a transaction
    updateItemCost(itemCode, transaction) {
        const items = Storage.getItems();
        const item = items.find(i => i.code === itemCode);

        if (!item) {
            console.error(`Item ${itemCode} not found`);
            return { success: false, error: 'Item not found' };
        }

        // Initialize cost tracking fields if not present
        if (item.averageCost === undefined) {
            item.averageCost = item.standardCost || 0;
        }
        if (item.totalQuantity === undefined) {
            item.totalQuantity = 0;
        }
        if (item.totalValue === undefined) {
            item.totalValue = 0;
        }

        const oldAvgCost = item.averageCost;
        const oldQty = item.totalQuantity;
        const oldValue = item.totalValue;

        if (transaction.type === 'IN') {
            // Purchase/Receipt - Update average cost
            const newAvgCost = this.calculateAverageCost(
                item.totalQuantity,
                item.averageCost,
                transaction.quantity,
                transaction.unitCost
            );

            item.averageCost = newAvgCost;
            item.totalQuantity += transaction.quantity;
            item.totalValue = item.totalQuantity * item.averageCost;
            item.lastCostUpdate = new Date().toISOString();

            // Store before/after costs in transaction
            transaction.averageCostBefore = oldAvgCost;
            transaction.averageCostAfter = newAvgCost;
            transaction.totalCost = transaction.quantity * transaction.unitCost;

        } else if (transaction.type === 'OUT') {
            // Sale/Issue - Use current average cost for COGS
            transaction.unitCost = item.averageCost;
            transaction.totalCost = transaction.quantity * item.averageCost;
            transaction.averageCostBefore = item.averageCost;
            transaction.averageCostAfter = item.averageCost; // Unchanged on OUT

            // Reduce quantity and value
            item.totalQuantity -= transaction.quantity;
            item.totalValue = item.totalQuantity * item.averageCost;

            // Prevent negative stock
            if (item.totalQuantity < 0) {
                console.warn(`⚠️ Negative stock for ${itemCode}: ${item.totalQuantity}`);
                // Optionally: return error or allow with warning
            }
        }

        // Update item in storage
        Storage.updateItem(item.id, item);

        // Log the cost update
        console.log(`💰 Cost Update for ${itemCode}:`);
        console.log(`   Transaction: ${transaction.type} ${transaction.quantity} ${item.uom}`);
        console.log(`   Old: ${oldQty} @ ${this.formatCurrency(oldAvgCost)} = ${this.formatCurrency(oldValue)}`);
        console.log(`   New: ${item.totalQuantity} @ ${this.formatCurrency(item.averageCost)} = ${this.formatCurrency(item.totalValue)}`);

        return {
            success: true,
            item: item,
            oldAvgCost: oldAvgCost,
            newAvgCost: item.averageCost,
            transaction: transaction
        };
    },

    // Get current inventory value for an item
    getInventoryValue(itemCode, warehouseCode = null) {
        const items = Storage.getItems();
        const item = items.find(i => i.code === itemCode);

        if (!item) {
            return { success: false, error: 'Item not found' };
        }

        let quantity = item.totalQuantity || 0;

        // If warehouse specified, get quantity from stock positions
        if (warehouseCode) {
            const stockPositions = Storage.getStockPositions() || [];
            const position = stockPositions.find(
                p => p.itemCode === itemCode && p.warehouseCode === warehouseCode
            );
            quantity = position ? position.quantity : 0;
        }

        const averageCost = item.averageCost || 0;
        const value = quantity * averageCost;

        return {
            success: true,
            itemCode: itemCode,
            itemName: item.name,
            quantity: quantity,
            averageCost: averageCost,
            totalValue: value,
            uom: item.uom
        };
    },

    // Calculate COGS for a sale
    getCOGS(itemCode, quantity) {
        const items = Storage.getItems();
        const item = items.find(i => i.code === itemCode);

        if (!item) {
            return { success: false, error: 'Item not found' };
        }

        const averageCost = item.averageCost || 0;
        const cogs = quantity * averageCost;

        return {
            success: true,
            itemCode: itemCode,
            quantity: quantity,
            unitCost: averageCost,
            totalCOGS: cogs
        };
    },

    // Get inventory valuation report
    getInventoryValuationReport(warehouseCode = null) {
        const items = Storage.getItems();
        const valuationData = [];
        let totalValue = 0;

        items.forEach(item => {
            if (!item.trackStock) return; // Skip non-inventory items

            const valuation = this.getInventoryValue(item.code, warehouseCode);
            if (valuation.success && valuation.quantity > 0) {
                valuationData.push(valuation);
                totalValue += valuation.totalValue;
            }
        });

        // Calculate percentage of total
        valuationData.forEach(item => {
            item.percentOfTotal = totalValue > 0 ? (item.totalValue / totalValue * 100) : 0;
        });

        // Sort by value descending
        valuationData.sort((a, b) => b.totalValue - a.totalValue);

        return {
            success: true,
            data: valuationData,
            totalValue: totalValue,
            itemCount: valuationData.length,
            reportDate: new Date().toISOString(),
            warehouse: warehouseCode || 'ALL'
        };
    },

    // Initialize cost tracking for existing items
    initializeCostTracking() {
        const items = Storage.getItems();
        let initialized = 0;

        items.forEach(item => {
            if (item.trackStock && item.averageCost === undefined) {
                // Use standard cost as initial average cost
                item.averageCost = item.standardCost || 0;
                item.totalQuantity = 0;
                item.totalValue = 0;
                item.lastCostUpdate = new Date().toISOString();

                Storage.updateItem(item.id, item);
                initialized++;
            }
        });

        console.log(`✅ Initialized cost tracking for ${initialized} items`);
        return { success: true, initialized: initialized };
    },

    // Recalculate average cost from transaction history
    recalculateFromHistory(itemCode) {
        const items = Storage.getItems();
        const item = items.find(i => i.code === itemCode);

        if (!item) {
            return { success: false, error: 'Item not found' };
        }

        // Get all transactions for this item, sorted by date
        const allTransactions = this.getAllStockTransactions();
        const itemTransactions = allTransactions
            .filter(t => t.itemCode === itemCode)
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        // Reset to zero
        let runningQty = 0;
        let runningAvgCost = item.standardCost || 0;

        // Replay transactions
        itemTransactions.forEach(txn => {
            if (txn.type === 'IN' && txn.unitCost) {
                runningAvgCost = this.calculateAverageCost(
                    runningQty,
                    runningAvgCost,
                    txn.quantity,
                    txn.unitCost
                );
                runningQty += txn.quantity;
            } else if (txn.type === 'OUT') {
                runningQty -= txn.quantity;
            }
        });

        // Update item
        item.averageCost = runningAvgCost;
        item.totalQuantity = runningQty;
        item.totalValue = runningQty * runningAvgCost;
        item.lastCostUpdate = new Date().toISOString();

        Storage.updateItem(item.id, item);

        return {
            success: true,
            itemCode: itemCode,
            finalQuantity: runningQty,
            finalAvgCost: runningAvgCost,
            transactionsProcessed: itemTransactions.length
        };
    },

    // Get all stock transactions (helper function)
    getAllStockTransactions() {
        // This would aggregate from various sources:
        // - Goods receipts
        // - Sales orders
        // - Inventory adjustments
        // - Production orders
        // For now, return empty array (to be implemented)
        return [];
    },

    // Format currency for display
    formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    },

    // Format quantity with UOM
    formatQuantity(qty, uom) {
        return `${qty.toLocaleString('id-ID', { maximumFractionDigits: 3 })} ${uom}`;
    }
};


// Explicitly make InventoryValuation globally available
window.InventoryValuation = InventoryValuation;
