// ==========================================
// Stock Opening Balance Module
// Initial inventory setup and accounting
// ==========================================

const StockOpeningBalance = {
    items: [],
    warehouses: [],
    selectedWarehouse: '',
    openingData: {}, // itemCode -> { quantity, unitCost }

    init() {
        if (!Auth.isAuthenticated()) {
            window.location.href = 'login.html';
            return;
        }

        this.loadData();
        this.render();
    },

    loadData() {
        this.items = Storage.getItems().filter(item => item.trackStock);
        this.warehouses = Storage.get(Storage.KEYS.WAREHOUSES) || [];

        if (this.warehouses.length > 0 && !this.selectedWarehouse) {
            this.selectedWarehouse = this.warehouses[0].code;
        }
    },

    render() {
        const content = document.getElementById('main-content');
        content.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">💎 Saldo Awal Stok</h1>
                <p class="page-description">Input kuantitas awal untuk bahan baku, WIP, dan barang jadi</p>
            </div>

            <div class="card mb-3">
                <div class="card-body">
                    <div class="form-row">
                        <div class="form-group" style="max-width: 300px;">
                            <label class="form-label">Warehouse / Lokasi</label>
                            <select class="form-select" id="op-warehouse-select" onchange="StockOpeningBalance.handleWarehouseChange(this.value)">
                                ${this.warehouses.map(w => `<option value="${w.code}" ${w.code === this.selectedWarehouse ? 'selected' : ''}>${w.name} (${w.code})</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group" style="display: flex; align-items: flex-end;">
                            <button class="btn btn-primary" onclick="StockOpeningBalance.save()">
                                💾 Simpan Saldo Awal
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-body">
                    <div class="table-container">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Kode Barang</th>
                                    <th>Nama Barang</th>
                                    <th>Kategori</th>
                                    <th style="width: 150px;">Unit</th>
                                    <th style="width: 180px;">Qty Awal</th>
                                    <th style="width: 180px;">Harga Satuan (HPP Awal)</th>
                                    <th class="text-right" style="width: 200px;">Total Nilai</th>
                                </tr>
                            </thead>
                            <tbody id="op-stock-table-body">
                                ${this.renderRows()}
                            </tbody>
                            <tfoot>
                                <tr style="font-weight: bold; background: var(--bg-tertiary);">
                                    <td colspan="6" class="text-right">TOTAL NILAI STOK AWAL :</td>
                                    <td class="text-right" id="op-total-value">Rp 0</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>
        `;

        this.calculateGrandTotal();
    },

    renderRows() {
        return this.items.map(item => {
            const data = this.openingData[item.code] || { quantity: 0, unitCost: item.standardCost || 0 };
            const total = data.quantity * data.unitCost;

            return `
                <tr>
                    <td><code>${item.code}</code></td>
                    <td><strong>${item.name}</strong></td>
                    <td><span class="badge badge-secondary">${item.category}</span></td>
                    <td>${item.uom || item.unit || '-'}</td>
                    <td>
                        <input type="number" class="form-input text-center" 
                               value="${data.quantity}" step="0.001" min="0"
                               data-code="${item.code}" data-field="quantity"
                               oninput="StockOpeningBalance.handleInput(this.dataset.code, 'quantity', this.value)">
                    </td>
                    <td>
                        <input type="number" class="form-input text-right" 
                               value="${data.unitCost}" step="1" min="0"
                               data-code="${item.code}" data-field="unitCost"
                               oninput="StockOpeningBalance.handleInput(this.dataset.code, 'unitCost', this.value)">
                    </td>
                    <td class="text-right" id="total-${item.code}">
                        ${this.formatCurrency(total)}
                    </td>
                </tr>
            `;
        }).join('');
    },

    handleWarehouseChange(warehouseCode) {
        this.selectedWarehouse = warehouseCode;
        // Optionally load existing opening balance if any? 
        // For now, assume it's a one-time setup screen.
        this.render();
    },

    handleInput(itemCode, field, value) {
        if (!this.openingData[itemCode]) {
            const item = this.items.find(i => i.code === itemCode);
            this.openingData[itemCode] = { quantity: 0, unitCost: item.standardCost || 0 };
        }

        this.openingData[itemCode][field] = parseFloat(value) || 0;

        // Update row total
        const rowTotal = this.openingData[itemCode].quantity * this.openingData[itemCode].unitCost;
        const totalEl = document.getElementById(`total-${itemCode}`);
        if (totalEl) totalEl.textContent = this.formatCurrency(rowTotal);

        this.calculateGrandTotal();
    },

    calculateGrandTotal() {
        let grandTotal = 0;
        Object.values(this.openingData).forEach(data => {
            grandTotal += (data.quantity * data.unitCost);
        });

        const totalEl = document.getElementById('op-total-value');
        if (totalEl) totalEl.textContent = this.formatCurrency(grandTotal);
    },

    async save() {
        const warehouse = this.warehouses.find(w => w.code === this.selectedWarehouse);
        if (!warehouse) {
            alert('Silakan pilih gudang.');
            return;
        }

        const entriesToSave = Object.entries(this.openingData).filter(([code, data]) => data.quantity > 0);

        if (entriesToSave.length === 0) {
            alert('Tidak ada kuantitas yang diinput.');
            return;
        }

        const confirmed = confirm(`Simpan saldo awal untuk ${entriesToSave.length} item di ${warehouse.name}?\n\nIni akan memperbarui stok dan mencatat jurnal penyeimbang ke Saldo Awal Ekuitas.`);
        if (!confirmed) return;

        const refNo = `OP-STOCK-${new Date().toISOString().split('T')[0].replace(/-/g, '')}`;
        const journalLines = [];
        let totalJournalValue = 0;
        let stockErrors = [];

        for (const [itemCode, data] of entriesToSave) {
            const item = this.items.find(i => i.code === itemCode);
            if (!item) continue;

            // 1. Update Warehouse Stock (with error handling per item)
            try {
                await WarehouseStock.updateStock(
                    this.selectedWarehouse,
                    itemCode,
                    data.quantity,
                    data.unitCost,
                    refNo,
                    'IN',
                    'COMPANY'
                );
            } catch (stockErr) {
                console.error('Stock update failed for', itemCode, stockErr);
                stockErrors.push(itemCode);
                continue; // skip journal line for failed items
            }

            // 2. Prepare Journal Line (Debit Inventory Account)
            // Use item's inventoryAccount if set, otherwise fall back to category mapping
            const inventoryAccount = item.inventoryAccount || this.getInventoryAccount(item.category);

            const lineValue = data.quantity * data.unitCost;
            journalLines.push({
                accountCode: inventoryAccount,
                accountName: `Persediaan - ${item.name}`,
                debit: lineValue,
                credit: 0,
                description: `Saldo Awal: ${item.name} (${data.quantity} ${item.uom || item.unit || 'pcs'} @ ${this.formatCurrency(data.unitCost)})`
            });

            totalJournalValue += lineValue;
        }

        if (journalLines.length === 0) {
            alert('Tidak ada data yang berhasil diproses.' + (stockErrors.length > 0 ? `\nGagal: ${stockErrors.join(', ')}` : ''));
            return;
        }

        // 3. Add Credit Line (Opening Balance Equity)
        const equityAccount = this.getOpeningBalanceEquityAccount();
        journalLines.push({
            accountCode: equityAccount,
            accountName: 'Saldo Awal Ekuitas',
            debit: 0,
            credit: totalJournalValue,
            description: `Saldo Awal Stok di ${warehouse.name}`
        });

        // 4. Create Journal Entry
        try {
            const journalEntry = {
                date: new Date().toISOString().split('T')[0],
                reference: refNo,
                description: `Pencatatan Saldo Awal Stok - ${warehouse.name}`,
                transactionType: 'JRN',
                manualReference: true,
                lines: journalLines,
                totalDebit: totalJournalValue,
                totalCredit: totalJournalValue,
                source: 'STOCK_OPENING'
            };

            await JournalEntry.createEntry(journalEntry);

            let msg = `✅ Saldo awal berhasil disimpan (${entriesToSave.length - stockErrors.length} item) dan jurnal telah dicatat.`;
            if (stockErrors.length > 0) {
                msg += `\n\n⚠️ ${stockErrors.length} item gagal diupdate stoknya: ${stockErrors.join(', ')}`;
            }
            alert(msg);
            App.navigateTo('stock-position');

        } catch (error) {
            console.error('Error saving opening balance journal:', error);
            alert(`❌ Stok berhasil diupdate, tapi gagal mencatat jurnal:\n${error.message}`);
        }
    },

    getInventoryAccount(category) {
        // Simple mapping based on storage.js standard COA
        if (category.toLowerCase().includes('raw')) return '1151';
        if (category.toLowerCase().includes('finished')) return '1181';
        if (category.toLowerCase().includes('work in process') || category.toLowerCase().includes('wip')) return '1161';
        if (category.toLowerCase().includes('chemical')) return '1154';
        if (category.toLowerCase().includes('consumables')) return '1155';

        return '1151'; // Default to Raw Material if unknown
    },

    getOpeningBalanceEquityAccount() {
        // Use getAccountMapping() which merges defaults
        const mapping = Storage.getAccountMapping ? Storage.getAccountMapping() : (Storage.get(Storage.KEYS.ACCOUNT_MAPPING) || {});
        return mapping.opening_balance_equity || mapping.capital || '3100';
    },

    formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    }
};

window.StockOpeningBalance = StockOpeningBalance;
