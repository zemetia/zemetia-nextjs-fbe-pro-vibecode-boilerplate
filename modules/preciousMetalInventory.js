// ==========================================
// Precious Metal Inventory Module
// Pure Content Tracking & Costing for Gold Refining
// With By-Product Tracking (Silver, etc.)
// ==========================================

const PreciousMetalInventory = {

    /**
     * Calculate pure content from gross weight and purity
     */
    calculatePureContent(grossWeight, purity) {
        return grossWeight * purity;
    },

    /**
     * Calculate cost per gram of pure metal
     */
    calculateCostPerPureGram(totalCost, pureContent) {
        if (pureContent <= 0) return 0;
        return totalCost / pureContent;
    },

    /**
     * Calculate weighted average cost per pure gram
     */
    calculateAverageCostPure(existingPureContent, existingAvgCostPerPure, newPureContent, newCostPerPure) {
        if (newPureContent <= 0) {
            return existingAvgCostPerPure;
        }

        if (existingPureContent <= 0) {
            return newCostPerPure;
        }

        const existingValue = existingPureContent * existingAvgCostPerPure;
        const newValue = newPureContent * newCostPerPure;
        const totalPureContent = existingPureContent + newPureContent;

        return (existingValue + newValue) / totalPureContent;
    },

    /**
     * Update by-product inventory (simple quantity tracking, zero cost)
     */
    updateByProductInventory(item, byProducts, transactionType) {
        if (!item.byProducts) {
            item.byProducts = {};
        }

        // Track each by-product
        Object.keys(byProducts).forEach(metal => {
            if (!item.byProducts[metal]) {
                item.byProducts[metal] = {
                    quantity: 0,
                    averageCost: 0,  // By-products have zero cost
                    nrv: byProducts[metal].nrv || 0  // Net realizable value
                };
            }

            const qty = byProducts[metal].quantity || 0;

            if (transactionType === 'IN') {
                item.byProducts[metal].quantity += qty;
            } else if (transactionType === 'OUT') {
                item.byProducts[metal].quantity -= qty;
            }

            // Update NRV if provided
            if (byProducts[metal].nrv) {
                item.byProducts[metal].nrv = byProducts[metal].nrv;
            }
        });
    },

    /**
     * Update inventory for precious metal transaction
     */
    updateInventory(transaction) {
        const items = Storage.getItems();
        const item = items.find(i => i.code === transaction.itemCode);

        if (!item) {
            console.error(`Item ${transaction.itemCode} not found`);
            return { success: false, error: 'Item not found' };
        }

        // Check if this is a precious metal
        if (!item.isPreciousMetal) {
            // Use standard inventory valuation
            return InventoryValuation.updateItemCost(item.code, transaction);
        }

        // Initialize precious metal inventory tracking if not exists
        if (!item.inventory) {
            item.inventory = {
                grossWeight: {
                    quantity: 0,
                    averageCost: 0,
                    totalValue: 0
                },
                pureContent: {
                    quantity: 0,
                    averageCost: 0,
                    totalValue: 0
                }
            };
        }

        // Calculate pure content
        const purity = transaction.actualPurity || item.nominalPurityDecimal || 1.0;
        const pureContent = this.calculatePureContent(transaction.grossWeight, purity);
        const costPerPureGram = this.calculateCostPerPureGram(transaction.totalCost, pureContent);

        console.log(`💎 Precious Metal Transaction: ${transaction.itemCode}`);
        console.log(`   Gross Weight: ${transaction.grossWeight} ${item.uom}`);
        console.log(`   Purity: ${(purity * 100).toFixed(2)}%`);
        console.log(`   Pure Content: ${pureContent.toFixed(3)} ${item.uom}`);
        console.log(`   Cost per Pure Gram: ${this.formatCurrency(costPerPureGram)}`);

        // Store old values for logging
        const oldGrossQty = item.inventory.grossWeight.quantity;
        const oldGrossAvg = item.inventory.grossWeight.averageCost;
        const oldPureQty = item.inventory.pureContent.quantity;
        const oldPureAvg = item.inventory.pureContent.averageCost;

        if (transaction.type === 'IN') {
            // Calculate new average costs
            const newGrossAvg = this.calculateAverageCostPure(
                item.inventory.grossWeight.quantity,
                item.inventory.grossWeight.averageCost,
                transaction.grossWeight,
                transaction.unitCost || (transaction.totalCost / transaction.grossWeight)
            );

            const newPureAvg = this.calculateAverageCostPure(
                item.inventory.pureContent.quantity,
                item.inventory.pureContent.averageCost,
                pureContent,
                costPerPureGram
            );

            // Update quantities
            item.inventory.grossWeight.quantity += transaction.grossWeight;
            item.inventory.pureContent.quantity += pureContent;

            // Update average costs
            item.inventory.grossWeight.averageCost = newGrossAvg;
            item.inventory.pureContent.averageCost = newPureAvg;

        } else if (transaction.type === 'OUT') {
            // For OUT transactions, use current average cost
            transaction.costPerPureGram = item.inventory.pureContent.averageCost;
            transaction.totalCost = pureContent * item.inventory.pureContent.averageCost;

            // Reduce quantities
            item.inventory.grossWeight.quantity -= transaction.grossWeight;
            item.inventory.pureContent.quantity -= pureContent;

            // Average costs remain the same for OUT transactions
        }

        // Recalculate total values
        item.inventory.grossWeight.totalValue =
            item.inventory.grossWeight.quantity * item.inventory.grossWeight.averageCost;
        item.inventory.pureContent.totalValue =
            item.inventory.pureContent.quantity * item.inventory.pureContent.averageCost;

        // Update by-products if provided
        if (transaction.byProducts) {
            this.updateByProductInventory(item, transaction.byProducts, transaction.type);

            console.log(`   🔸 By-Products Updated:`);
            Object.keys(transaction.byProducts).forEach(metal => {
                const qty = item.byProducts[metal]?.quantity || 0;
                const nrv = item.byProducts[metal]?.nrv || 0;
                console.log(`      ${metal}: ${qty.toFixed(3)} ${item.uom} (NRV: ${this.formatCurrency(nrv)}/gram)`);
            });
        }

        // Update timestamp
        item.lastCostUpdate = new Date().toISOString();

        // Save item
        Storage.updateItem(item.id, item);

        // Log the update
        console.log(`   📊 Inventory Updated:`);
        console.log(`      Gross: ${oldGrossQty.toFixed(3)} → ${item.inventory.grossWeight.quantity.toFixed(3)} ${item.uom}`);
        console.log(`      Gross Avg Cost: ${this.formatCurrency(oldGrossAvg)} → ${this.formatCurrency(item.inventory.grossWeight.averageCost)}`);
        console.log(`      Pure: ${oldPureQty.toFixed(3)} → ${item.inventory.pureContent.quantity.toFixed(3)} ${item.uom}`);
        console.log(`      Pure Avg Cost: ${this.formatCurrency(oldPureAvg)} → ${this.formatCurrency(item.inventory.pureContent.averageCost)}`);
        console.log(`      Total Value: ${this.formatCurrency(item.inventory.pureContent.totalValue)}`);

        return {
            success: true,
            item: item,
            transaction: {
                grossWeight: transaction.grossWeight,
                purity: purity,
                pureContent: pureContent,
                costPerPureGram: costPerPureGram,
                byProducts: transaction.byProducts
            },
            inventory: {
                grossWeight: {
                    quantity: item.inventory.grossWeight.quantity,
                    averageCost: item.inventory.grossWeight.averageCost,
                    totalValue: item.inventory.grossWeight.totalValue
                },
                pureContent: {
                    quantity: item.inventory.pureContent.quantity,
                    averageCost: item.inventory.pureContent.averageCost,
                    totalValue: item.inventory.pureContent.totalValue
                }
            }
        };
    },

    /**
     * Get COGS for precious metal (based on pure content)
     */
    getCOGS(itemCode, grossWeight, purity) {
        const items = Storage.getItems();
        const item = items.find(i => i.code === itemCode);

        if (!item) {
            return { success: false, error: 'Item not found' };
        }

        // Check if this is a precious metal
        if (!item.isPreciousMetal) {
            // Use standard COGS calculation
            return InventoryValuation.getCOGS(itemCode, grossWeight);
        }

        // Calculate based on PURE CONTENT
        const actualPurity = purity || item.nominalPurityDecimal || 1.0;
        const pureContent = this.calculatePureContent(grossWeight, actualPurity);
        const costPerPureGram = item.inventory?.pureContent?.averageCost || 0;
        const totalCOGS = pureContent * costPerPureGram;

        return {
            success: true,
            itemCode: itemCode,
            grossWeight: grossWeight,
            purity: actualPurity,
            pureContent: pureContent,
            costPerPureGram: costPerPureGram,
            totalCOGS: totalCOGS
        };
    },

    /**
     * Get inventory value for precious metal
     */
    getInventoryValue(itemCode) {
        const items = Storage.getItems();
        const item = items.find(i => i.code === itemCode);

        if (!item) {
            return { success: false, error: 'Item not found' };
        }

        if (!item.isPreciousMetal || !item.inventory) {
            return InventoryValuation.getInventoryValue(itemCode);
        }

        return {
            success: true,
            itemCode: itemCode,
            itemName: item.name,
            metalType: item.metalType,
            grossWeight: {
                quantity: item.inventory.grossWeight.quantity,
                averageCost: item.inventory.grossWeight.averageCost,
                totalValue: item.inventory.grossWeight.totalValue
            },
            pureContent: {
                quantity: item.inventory.pureContent.quantity,
                averageCost: item.inventory.pureContent.averageCost,
                totalValue: item.inventory.pureContent.totalValue
            },
            nominalPurity: item.nominalPurity,
            uom: item.uom
        };
    },

    /**
     * Get precious metal inventory valuation report
     */
    getValuationReport() {
        const items = Storage.getItems();
        const preciousMetals = items.filter(i => i.isPreciousMetal && i.trackStock);

        const reportData = [];
        let totalValue = 0;

        preciousMetals.forEach(item => {
            if (!item.inventory || item.inventory.pureContent.quantity <= 0) return;

            const data = {
                itemCode: item.code,
                itemName: item.name,
                metalType: item.metalType,
                grossWeight: item.inventory.grossWeight.quantity,
                pureContent: item.inventory.pureContent.quantity,
                purity: item.nominalPurity,
                costPerPureGram: item.inventory.pureContent.averageCost,
                totalValue: item.inventory.pureContent.totalValue,
                uom: item.uom
            };

            reportData.push(data);
            totalValue += data.totalValue;
        });

        // Calculate percentage of total
        reportData.forEach(item => {
            item.percentOfTotal = totalValue > 0 ? (item.totalValue / totalValue * 100) : 0;
        });

        // Sort by value descending
        reportData.sort((a, b) => b.totalValue - a.totalValue);

        return {
            success: true,
            data: reportData,
            totalValue: totalValue,
            itemCount: reportData.length,
            reportDate: new Date().toISOString()
        };
    },

    /**
     * Get by-product inventory report
     */
    getByProductReport() {
        const items = Storage.getItems();
        const preciousMetals = items.filter(i => i.isPreciousMetal && i.byProducts);

        const reportData = [];
        let totalNRV = 0;

        preciousMetals.forEach(item => {
            Object.keys(item.byProducts).forEach(metal => {
                const bp = item.byProducts[metal];
                if (bp.quantity <= 0) return;

                const nrvTotal = bp.quantity * bp.nrv;

                reportData.push({
                    itemCode: item.code,
                    itemName: item.name,
                    byProductMetal: metal,
                    quantity: bp.quantity,
                    nrvPerGram: bp.nrv,
                    totalNRV: nrvTotal,
                    uom: item.uom
                });

                totalNRV += nrvTotal;
            });
        });

        // Sort by total NRV descending
        reportData.sort((a, b) => b.totalNRV - a.totalNRV);

        return {
            success: true,
            data: reportData,
            totalNRV: totalNRV,
            itemCount: reportData.length,
            reportDate: new Date().toISOString()
        };
    },

    /**
     * Sell by-product (record as Other Income)
     */
    sellByProduct(itemCode, metal, quantity, sellingPrice) {
        const items = Storage.getItems();
        const item = items.find(i => i.code === itemCode);

        if (!item || !item.byProducts || !item.byProducts[metal]) {
            return { success: false, error: 'By-product not found' };
        }

        const bp = item.byProducts[metal];

        if (bp.quantity < quantity) {
            return { success: false, error: 'Insufficient by-product quantity' };
        }

        // Reduce quantity
        bp.quantity -= quantity;
        Storage.updateItem(item.id, item);

        // Calculate revenue
        const totalRevenue = quantity * sellingPrice;

        console.log(`💰 By-Product Sale: ${metal}`);
        console.log(`   Quantity: ${quantity} ${item.uom}`);
        console.log(`   Price: ${this.formatCurrency(sellingPrice)}/gram`);
        console.log(`   Total Revenue: ${this.formatCurrency(totalRevenue)}`);
        console.log(`   ℹ️  Record as Other Income (Account 7900)`);

        return {
            success: true,
            metal: metal,
            quantity: quantity,
            sellingPrice: sellingPrice,
            totalRevenue: totalRevenue,
            remainingQuantity: bp.quantity,
            accountingNote: 'Record as Other Income (7900)'
        };
    },

    /**
     * Format currency for display
     */
    formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    },

    /**
     * Format quantity with UOM
     */
    formatQuantity(qty, uom) {
        return `${qty.toLocaleString('id-ID', { maximumFractionDigits: 3 })} ${uom}`;
    }
};


// Explicitly make PreciousMetalInventory globally available
window.PreciousMetalInventory = PreciousMetalInventory;
