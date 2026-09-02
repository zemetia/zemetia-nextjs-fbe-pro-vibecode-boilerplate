// ==========================================
// Warehouse Stock Management Utilities
// Actual quantity tracking for inventory
// ==========================================

const WarehouseStock = {
    syncMasterItemStock(itemCode, ownerId = 'COMPANY') {
        if (ownerId !== 'COMPANY') return;

        const items = Storage.getItems ? Storage.getItems() : (Storage.get(Storage.KEYS.ITEMS) || []);
        const index = items.findIndex(i => i.code === itemCode);
        if (index < 0) return;

        const stock = this.initStock();
        let totalQty = 0;

        Object.entries(stock).forEach(([key, data]) => {
            const suffix = `_${itemCode}_${ownerId}`;
            if (key.endsWith(suffix)) {
                totalQty += parseFloat(data.quantity || 0);
            }
        });

        items[index].currentStock = totalQty;
        Storage.set(Storage.KEYS.ITEMS, items);
    },
    /**
     * Initialize warehouse stock tracking
     * Format: { warehouseCode_itemCode: { quantity, value, lastUpdated } }
     */
    initStock() {
        const stock = Storage.getWarehouseStock();
        return stock;
    },

    /**
     * Get stock for specific item in warehouse
     */
    getStock(warehouseCode, itemCode, ownerId = 'COMPANY') {
        const stock = this.initStock();
        const key = `${warehouseCode}_${itemCode}_${ownerId}`;
        return stock[key] || { quantity: 0, value: 0, lastUpdated: null, ownerId };
    },

    /**
     * Get all stock movements
     */
    getWarehouseStockMovements() {
        return Storage.getWarehouseStockMovements();
    },

    /**
     * Update stock quantity (IN/OUT)
     * Returns updated stock or throws on error
     */
    async updateStock(warehouseCode, itemCode, quantity, unitPrice, referenceNumber, type = 'IN', ownerId = 'COMPANY') {
        const stock = this.initStock();
        const key = `${warehouseCode}_${itemCode}_${ownerId}`;

        const currentStock = stock[key] || { quantity: 0, value: 0, lastUpdated: null, ownerId };

        if (type === 'IN') {
            currentStock.quantity += quantity;
            currentStock.value += (quantity * unitPrice);
        } else if (type === 'OUT') {
            if (ownerId === 'COMPANY' && currentStock.quantity < quantity) {
                throw new Error(`Insufficient stock for ${itemCode} in ${warehouseCode} (Owner: ${ownerId}). Available: ${currentStock.quantity}, Required: ${quantity}`);
            }
            currentStock.quantity -= quantity;
            currentStock.value -= (quantity * unitPrice);
        }

        currentStock.lastUpdated = new Date().toISOString();
        currentStock.lastReference = referenceNumber;
        currentStock.ownerId = ownerId;

        stock[key] = currentStock;

        // CRITICAL: await the cloud save to prevent race conditions with journal sync
        await Storage.saveWarehouseStock(stock);

        // Keep item-level stock snapshot in sync for legacy modules and dashboards
        this.syncMasterItemStock(itemCode, ownerId);

        // Log movement (fire-and-forget is ok here, non-critical)
        this.logMovement(warehouseCode, itemCode, quantity, unitPrice, type, referenceNumber, ownerId);

        return currentStock;
    },

    /**
     * Log stock movement for tracking
     */
    logMovement(warehouseCode, itemCode, quantity, unitPrice, type, referenceNumber, ownerId = 'COMPANY') {
        const movements = Storage.getWarehouseStockMovements();
        movements.push({
            id: `MOV-${Date.now()}`,
            date: new Date().toISOString(),
            warehouseCode,
            itemCode,
            quantity,
            unitPrice,
            value: quantity * unitPrice,
            type, // 'IN' or 'OUT'
            referenceNumber,
            ownerId,
            user: Auth.getCurrentUser()?.username || 'system'
        });
        // Fire-and-forget — movement log is non-critical
        Storage.saveWarehouseStockMovements(movements);
    },

    /**
     * Get all stock movements for an item
     */
    getMovements(itemCode, warehouseCode = null, startDate = null, endDate = null, ownerId = null) {
        let movements = Storage.getWarehouseStockMovements();

        // Filter by item
        movements = movements.filter(m => m.itemCode === itemCode);
        // ... (rest of filtering)

        // Filter by warehouse if specified
        if (warehouseCode) {
            movements = movements.filter(m => m.warehouseCode === warehouseCode);
        }

        // Filter by owner if specified
        if (ownerId) {
            movements = movements.filter(m => m.ownerId === ownerId);
        }

        // Filter by date range if specified
        // Extract date portion for proper comparison (handle ISO datetime vs date-only strings)
        if (startDate) {
            movements = movements.filter(m => m.date.split('T')[0] >= startDate);
        }
        if (endDate) {
            movements = movements.filter(m => m.date.split('T')[0] <= endDate);
        }

        return movements.sort((a, b) => new Date(a.date) - new Date(b.date));
    },

    /**
     * Get current stock position for all warehouses
     */
    getStockPosition() {
        const stock = this.initStock();
        const items = Storage.get(Storage.KEYS.ITEMS) || [];
        const warehouses = Storage.get(Storage.KEYS.WAREHOUSES) || [];

        const positions = [];

        Object.keys(stock).forEach(key => {
            const stockData = stock[key];
            if (stockData && stockData.quantity > 0) {
                // Key format: warehouseCode_itemCode_ownerId
                const parts = key.split('_');
                const whCode = parts[0];
                const itCode = parts[1];
                const ownId = parts.slice(2).join('_') || 'COMPANY';

                const item = items.find(i => i.code === itCode);
                const warehouse = warehouses.find(w => w.code === whCode);

                // Show stock even if warehouse/item not in master — use fallback labels
                positions.push({
                    warehouseCode: whCode,
                    warehouseName: warehouse ? warehouse.name : `[${whCode}]`,
                    itemCode: itCode,
                    itemName: item ? item.name : itCode,
                    quantity: stockData.quantity,
                    value: stockData.value,
                    avgCost: stockData.quantity > 0 ? stockData.value / stockData.quantity : 0,
                    lastUpdated: stockData.lastUpdated,
                    ownerId: ownId
                });
            }
        });

        return positions;
    },

    /**
     * Calculate stock value for a warehouse (Company owned only by default)
     */
    getWarehouseValue(warehouseCode, ownerId = 'COMPANY') {
        const stock = this.initStock();
        let totalValue = 0;

        Object.keys(stock).forEach(key => {
            const parts = key.split('_');
            const whCode = parts[0];
            const ownId = parts.slice(2).join('_') || 'COMPANY';

            if (whCode === warehouseCode && ownId === ownerId) {
                totalValue += stock[key].value;
            }
        });

        return totalValue;
    },

    /**
     * Transfer stock between warehouses
     */
    transferStock(fromWarehouse, toWarehouse, itemCode, quantity, referenceNumber, ownerId = 'COMPANY') {
        // Get current stock to determine unit price
        const fromStock = this.getStock(fromWarehouse, itemCode, ownerId);
        if (fromStock.quantity < quantity) {
            throw new Error(`Insufficient stock in ${fromWarehouse} for owner ${ownerId}`);
        }

        const unitPrice = fromStock.quantity > 0 ? (fromStock.value / fromStock.quantity) : 0; // Average cost

        // OUT from source
        this.updateStock(fromWarehouse, itemCode, quantity, unitPrice, referenceNumber, 'OUT', ownerId);

        // IN to destination
        this.updateStock(toWarehouse, itemCode, quantity, unitPrice, referenceNumber, 'IN', ownerId);

        return { fromWarehouse, toWarehouse, itemCode, quantity, unitPrice, ownerId };
    },

    /**
     * Get stock card (movement history with running balance)
     */
    getStockCard(itemCode, warehouseCode, startDate, endDate) {
        const movements = this.getMovements(itemCode, warehouseCode, startDate, endDate);

        let runningQty = 0;
        let runningValue = 0;

        const card = movements.map(m => {
            if (m.type === 'IN') {
                runningQty += m.quantity;
                runningValue += m.value;
            } else {
                runningQty -= m.quantity;
                runningValue -= m.value;
            }

            return {
                ...m,
                balanceQty: runningQty,
                balanceValue: runningValue,
                avgCost: runningQty > 0 ? runningValue / runningQty : 0
            };
        });

        return card;
    }
};


// Explicitly make WarehouseStock globally available
window.WarehouseStock = WarehouseStock;
