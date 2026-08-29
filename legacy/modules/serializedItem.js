// ==========================================
// Serialized Item Module
// Master Registry for individual bars (SN/Cert)
// ==========================================

const SerializedItem = {
    items: [],

    init() {
        this.loadItems();
    },

    loadItems() {
        this.items = Storage.get(Storage.KEYS.SERIALIZED_ITEMS) || [];
    },

    async saveItems() {
        return await Storage.set(Storage.KEYS.SERIALIZED_ITEMS, this.items);
    },

    /**
     * Add multiple serialized items at once
     */
    async addItems(newItems) {
        this.loadItems();
        this.items = [...newItems, ...this.items];
        return await this.saveItems();
    },

    /**
     * Get items by Batch ID
     */
    getByBatchId(batchId) {
        return this.items.filter(i => i.batchId === batchId);
    },

    /**
     * Get available items for sales/transfer
     */
    getAvailable() {
        return this.items.filter(i => i.status === 'Available');
    },

    /**
     * Update item status with metadata
     */
    async updateStatus(serialNumber, status, metadata = {}) {
        this.loadItems();
        const item = this.items.find(i => i.serialNumber === serialNumber);
        if (item) {
            item.status = status;
            Object.assign(item, metadata);
            await this.saveItems();
            return true;
        }
        return false;
    },

    /**
     * Revert items to "Available" by transaction reference
     */
    async revertStatusByTransaction(transactionId) {
        this.loadItems();
        let changed = false;
        this.items.forEach(item => {
            if (item.swapId === transactionId || item.soldId === transactionId) {
                item.status = 'Available';
                delete item.soldTo;
                delete item.soldDate;
                delete item.swapId;
                delete item.soldId;
                changed = true;
            }
        });
        if (changed) {
            await this.saveItems();
        }
        return changed;
    }
};

SerializedItem.init();
window.SerializedItem = SerializedItem;
