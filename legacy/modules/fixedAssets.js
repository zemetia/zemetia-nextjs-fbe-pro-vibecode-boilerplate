// ==========================================
// Fixed Assets Module
// Manage fixed assets and depreciation
// ==========================================

const FixedAssets = {
    assets: [],
    _searchQuery: '',
    _sortBy: { field: 'assetNumber', order: 'asc' },
    OWNER_TAG: 'GAR', // User's requested identity tag

    init() {
        this.loadAssets();
        this.runAutoDepreciationCheck();
    },

    // Account mapping for depreciation
    // Maps asset accounts (12xx) to Accumulated Depreciation (12x9) and Expense accounts
    depreciationMapping: {
        '1210': { accum: '1211', exp: '5260' }, // Tanah (usually no depreciation)
        '1220': { accum: '1221', exp: '5260' }, // Bangunan
        '1230': { accum: '1231', exp: '5260' }, // Kendaraan
        '1235': { accum: '1236', exp: '5260' }, // Peralatan Kantor
        '1245': { accum: '1246', exp: '5136' }, // Peralatan Produksi
        '1251': { accum: '1252', exp: '5136' }, // Safety Equipment
    },

    async runAutoDepreciationCheck() {
        console.log('🏢 [FixedAssets] Checking for pending depreciation journals...');
        const pendingMonths = this.getPendingDepreciationMonths();

        if (pendingMonths.length > 0) {
            console.log(`📅 [FixedAssets] Found ${pendingMonths.length} months pending depreciation:`, pendingMonths);
            this._pendingDepreciation = pendingMonths;
        }
    },

    getPendingDepreciationMonths() {
        if (this.assets.length === 0) return [];

        const journalEntries = Storage.get(Storage.KEYS.JOURNAL_ENTRIES) || [];
        const processedMonths = new Set(
            journalEntries
                .filter(e => e.reference && e.reference.startsWith('DEPR-'))
                .map(e => e.reference.substring(5, 12)) // DEPR-YYYY-MM -> YYYY-MM
        );

        const now = new Date();
        const months = [];

        const earliestDate = this.assets.reduce((min, asset) => {
            const date = new Date(asset.purchaseDate);
            return date < min ? date : min;
        }, new Date());

        let current = new Date(earliestDate.getFullYear(), earliestDate.getMonth(), 1);
        while (current < new Date(now.getFullYear(), now.getMonth(), 0)) {
            const monthKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
            if (!processedMonths.has(monthKey)) {
                months.push(monthKey);
            }
            current.setMonth(current.getMonth() + 1);
        }

        return months;
    },

    async runDepreciation(monthKey) {
        console.log(`🚀 [FixedAssets] Running depreciation for ${monthKey}...`);
        
        // SAFETY GUARD: Prevent duplicate journal entries
        const existingEntries = Storage.get(Storage.KEYS.JOURNAL_ENTRIES) || [];
        if (existingEntries.some(e => e.reference === `DEPR-${monthKey}`)) {
            console.warn(`⚠️ [FixedAssets] Depreciation journal for ${monthKey} already exists. Skipping.`);
            return { success: false, error: 'Jurnal penyusutan untuk periode ini sudah dibuat.' };
        }

        const [year, month] = monthKey.split('-').map(Number);
        const lastDay = new Date(year, month, 0);
        const nextMonthStart = new Date(year, month, 1);

        const journalLines = [];
        const totalsByAccount = {};

        this.assets.forEach(asset => {
            if (asset.status !== 'active') return;

            const purchaseDate = new Date(asset.purchaseDate);
            if (purchaseDate >= nextMonthStart) return;

            const depr = this.calculateDepreciation(asset, lastDay);
            const amt = Math.round(depr.monthlyDepreciation);
            if (amt <= 0) return;

            const mapping = {
                accum: asset.accumAccountCode || (this.depreciationMapping[asset.accountCode] || { accum: '1290' }).accum,
                exp: asset.deprExpenseAccountCode || (this.depreciationMapping[asset.accountCode] || { exp: '5260' }).exp
            };

            if (!totalsByAccount[mapping.exp]) totalsByAccount[mapping.exp] = { debit: 0, credit: 0 };
            if (!totalsByAccount[mapping.accum]) totalsByAccount[mapping.accum] = { debit: 0, credit: 0 };

            totalsByAccount[mapping.exp].debit += amt;
            totalsByAccount[mapping.accum].credit += amt;
        });

        for (const [code, amounts] of Object.entries(totalsByAccount)) {
            if (amounts.debit > 0) {
                journalLines.push({
                    accountCode: code,
                    description: `Beban Penyusutan Aset - ${monthKey}`,
                    debit: amounts.debit,
                    credit: 0
                });
            }
            if (amounts.credit > 0) {
                journalLines.push({
                    accountCode: code,
                    description: `Akumulasi Penyusutan Aset - ${monthKey}`,
                    debit: 0,
                    credit: amounts.credit
                });
            }
        }

        if (journalLines.length === 0) {
            return { success: false, error: 'Tidak ada aset yang perlu disusutkan.' };
        }

        try {
            const entry = await JournalEntry.createEntry({
                date: lastDay.toISOString().split('T')[0],
                reference: `DEPR-${monthKey}`,
                description: `Jurnal Penyusutan Aset Otomatis - Periode ${monthKey}`,
                transactionType: 'JRN',
                manualReference: true,
                lines: journalLines
            });

            this._pendingDepreciation = (this._pendingDepreciation || []).filter(m => m !== monthKey);
            return { success: true, entry };
        } catch (error) {
            console.error('❌ [FixedAssets] Failed to post depreciation journal:', error);
            return { success: false, error: error.message };
        }
    },

    loadAssets() {
        this.assets = Storage.getFixedAssets();
    },

    isFixedAssetAccount(accountCode) {
        const code = String(accountCode || '').trim();
        return /^12\d{2}$/.test(code);
    },

    inferAssetCategory(accountCode, itemName = '') {
        const code = String(accountCode || '').trim();
        const name = String(itemName || '').toLowerCase();

        if (code === '1210') return 'Tanah';
        if (code === '1220') return 'Bangunan';
        if (code === '1230') return 'Kendaraan';
        if (code === '1235') return 'Peralatan';
        if (code === '1245') return 'Peralatan';
        if (code === '1251') return 'Peralatan';

        if (name.includes('kendaraan')) return 'Kendaraan';
        if (name.includes('komputer') || name.includes('laptop')) return 'Komputer';
        if (name.includes('furniture') || name.includes('meja') || name.includes('kursi')) return 'Furniture';
        if (name.includes('bangunan') || name.includes('renovasi')) return 'Bangunan';
        return 'Peralatan';
    },

    async createDraftsFromGoodsReceipt(gr, po) {
        if (!gr || !po || !Array.isArray(gr.items) || !Array.isArray(po.items)) {
            return { success: false, created: 0, skipped: 0, reason: 'invalid_payload' };
        }

        if (!this.assets || !Array.isArray(this.assets)) {
            this.loadAssets();
        }

        let created = 0;
        let skipped = 0;

        for (const grItem of gr.items) {
            const poItem = po.items.find(p => String(p.itemId) === String(grItem.itemId));
            if (!poItem) {
                skipped++;
                continue;
            }

            const assetAccount = poItem.inventoryAccount || poItem.assetAccount || '';
            if (!this.isFixedAssetAccount(assetAccount)) {
                skipped++;
                continue;
            }

            const sourceTransactionId = `GR-${gr.id}-PO-${po.id}-ITEM-${grItem.itemId}`;
            const exists = this.assets.some(a => a.sourceTransactionId === sourceTransactionId);
            if (exists) {
                skipped++;
                continue;
            }

            const qty = parseFloat(grItem.receivedQty || 0);
            const unitPrice = parseFloat(poItem.unitPrice || 0);
            const totalValue = Math.round(qty * unitPrice);

            const draftAsset = {
                id: Date.now() + created,
                assetNumber: this.generateAssetNumber('new', gr.receiptDate || po.orderDate || new Date().toISOString()),
                name: poItem.itemName || grItem.itemName || 'Asset from PO',
                condition: 'new',
                category: this.inferAssetCategory(assetAccount, poItem.itemName || grItem.itemName),
                purchaseDate: gr.receiptDate || po.orderDate || new Date().toISOString().split('T')[0],
                purchasePrice: totalValue,
                salvageValue: 0,
                usefulLife: 5,
                depreciationMethod: 'straight-line',
                accountCode: assetAccount,
                accumAccountCode: (this.depreciationMapping[assetAccount] || {}).accum || '',
                deprExpenseAccountCode: (this.depreciationMapping[assetAccount] || {}).exp || '',
                location: '',
                serialNumber: '',
                notes: `Draft otomatis dari PO ${po.poNumber} / GR ${gr.grNumber}. Qty: ${qty} ${grItem.unit || poItem.unit || ''} @ ${unitPrice.toLocaleString('id-ID')}.`,
                status: 'draft_from_po',
                source: 'purchase_order',
                poId: po.id,
                poNumber: po.poNumber,
                grId: gr.id,
                grNumber: gr.grNumber,
                sourceTransactionId,
                sourceItemId: grItem.itemId,
                sourceItemCode: poItem.itemCode || grItem.itemCode || '',
                sourceSupplierId: po.supplier || '',
                sourceSupplierName: po.supplierName || '',
                createdBy: Auth?.getCurrentUser?.()?.username || 'system',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            this.assets.unshift(draftAsset);
            created++;
        }

        if (created > 0) {
            await this.saveAssets();
            if (typeof AuditLog !== 'undefined') {
                AuditLog.logCreate('fixed_asset_draft', po.poNumber, {
                    created,
                    source: 'goods_receipt',
                    grNumber: gr.grNumber
                });
            }
        }

        return { success: true, created, skipped };
    },

    async saveAssets() {
        await Storage.saveFixedAssets(this.assets);
    },

    generateAssetNumber(condition = 'new', date = null) {
        const d = date ? new Date(date) : new Date();
        const yy = d.getFullYear().toString().slice(-2);
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        
        let prefix = '';
        if (condition === 'new') {
            prefix = `FA-${this.OWNER_TAG}-N-${yy}-`;
        } else if (condition === 'used') {
            prefix = `FA-${this.OWNER_TAG}-U-${yy}-`;
        } else if (condition === 'legacy') {
            // Legacy uses Month part to look like a specific "Used" purchase (Obfuscation)
            prefix = `FA-${this.OWNER_TAG}-U-${yy}-${mm}-`;
        }

        // Find max sequence for this specific prefix
        const maxSeq = this.assets
            .filter(a => a.assetNumber && a.assetNumber.startsWith(prefix))
            .map(a => {
                const parts = a.assetNumber.split('-');
                return parseInt(parts[parts.length - 1]);
            })
            .filter(n => !isNaN(n))
            .reduce((max, n) => Math.max(max, n), 0);
            
        return `${prefix}${String(maxSeq + 1).padStart(4, '0')}`;
    },
    
    // UI helper to update code preview
    updateAssetCodePreview() {
        const condition = document.getElementById('asset-condition')?.value || 'new';
        const date = document.getElementById('asset-purchase-date')?.value || new Date().toISOString();
        const previewEl = document.getElementById('asset-code-preview');
        if (previewEl) {
            previewEl.value = this.generateAssetNumber(condition, date);
        }
    },

    async createAsset(assetData) {
        // Basic validation
        if (!assetData.name || !assetData.purchasePrice || !assetData.usefulLife) {
            return { success: false, errors: { validation: 'Name, purchase price, and useful life are required' } };
        }

        const condition = assetData.condition || 'new';

        // POIN 1: Alur pembelian aset baru WAJIB melalui PO
        if (condition === 'new' && !assetData.poId && !assetData.poNumber) {
            return {
                success: false,
                errors: { validation: 'Pembelian aset baru wajib melalui Purchase Order (PO). Silakan pilih atau buat PO terlebih dahulu.' }
            };
        }

        const asset = {
            id: assetData.id || Date.now(),
            assetNumber: assetData.assetNumber || this.generateAssetNumber(condition, assetData.purchaseDate),
            name: assetData.name,
            condition: condition, // added condition field
            category: assetData.category,
            purchaseDate: assetData.purchaseDate,
            purchasePrice: parseFloat(assetData.purchasePrice),
            salvageValue: parseFloat(assetData.salvageValue || 0),
            usefulLife: parseInt(assetData.usefulLife), // in years
            depreciationMethod: assetData.depreciationMethod || 'straight-line', // straight-line, declining-balance
            accountCode: assetData.accountCode,
            accumAccountCode: assetData.accumAccountCode,
            deprExpenseAccountCode: assetData.deprExpenseAccountCode,
            location: assetData.location || '',
            serialNumber: assetData.serialNumber || '',
            vendor: assetData.vendor || assetData.sourceSupplierName || '',
            poId: assetData.poId || null,
            poNumber: assetData.poNumber || '',
            poItemId: assetData.poItemId || assetData.sourceItemId || null,
            source: assetData.source || (assetData.poId ? 'purchase_order' : 'legacy'),
            notes: assetData.notes || '',
            status: assetData.status || 'active', // active, disposed, sold, draft_from_po
            createdBy: Auth?.getCurrentUser?.()?.username || 'system',
            createdAt: assetData.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.assets.unshift(asset);
        await this.saveAssets();

        if (typeof AuditLog !== 'undefined') {
            AuditLog.logCreate('fixed_asset', asset.assetNumber, { name: asset.name, value: asset.purchasePrice });
        }

        return { success: true, asset };
    },

    calculateDepreciation(asset, asOfDate = null) {
        const date = asOfDate ? new Date(asOfDate) : new Date();
        const purchaseDate = new Date(asset.purchaseDate);

        // Calculate months elapsed
        const monthsElapsed = (date.getFullYear() - purchaseDate.getFullYear()) * 12 +
            (date.getMonth() - purchaseDate.getMonth());

        const yearsElapsed = monthsElapsed / 12;

        if (yearsElapsed >= asset.usefulLife) {
            return {
                accumulatedDepreciation: asset.purchasePrice - asset.salvageValue,
                bookValue: asset.salvageValue,
                annualDepreciation: 0,
                monthlyDepreciation: 0,
                fullyDepreciated: true
            };
        }

        let annualDepreciation, accumulatedDepreciation;

        if (asset.depreciationMethod === 'straight-line') {
            annualDepreciation = (asset.purchasePrice - asset.salvageValue) / asset.usefulLife;
            accumulatedDepreciation = annualDepreciation * yearsElapsed;
        } else if (asset.depreciationMethod === 'declining-balance') {
            const rate = 2 / asset.usefulLife; // Double declining balance
            let bookValue = asset.purchasePrice;
            accumulatedDepreciation = 0;

            for (let year = 0; year < Math.floor(yearsElapsed); year++) {
                const yearDepreciation = bookValue * rate;
                accumulatedDepreciation += yearDepreciation;
                bookValue -= yearDepreciation;
            }

            // Partial year
            const partialYear = yearsElapsed - Math.floor(yearsElapsed);
            if (partialYear > 0) {
                accumulatedDepreciation += bookValue * rate * partialYear;
            }

            annualDepreciation = bookValue * rate;
        }

        const bookValue = asset.purchasePrice - accumulatedDepreciation;
        const monthlyDepreciation = annualDepreciation / 12;

        return {
            accumulatedDepreciation: Math.min(accumulatedDepreciation, asset.purchasePrice - asset.salvageValue),
            bookValue: Math.max(bookValue, asset.salvageValue),
            annualDepreciation,
            monthlyDepreciation,
            fullyDepreciated: false
        };
    },

    generateDepreciationSchedule(assetId) {
        const asset = this.assets.find(a => a.id === assetId);
        if (!asset) return [];

        const schedule = [];
        const purchaseDate = new Date(asset.purchaseDate);

        for (let year = 1; year <= asset.usefulLife; year++) {
            const endOfYear = new Date(purchaseDate);
            endOfYear.setFullYear(purchaseDate.getFullYear() + year);

            const depreciation = this.calculateDepreciation(asset, endOfYear);

            schedule.push({
                year: year,
                date: endOfYear.toISOString().split('T')[0],
                annualDepreciation: depreciation.annualDepreciation,
                accumulatedDepreciation: depreciation.accumulatedDepreciation,
                bookValue: depreciation.bookValue
            });
        }

        return schedule;
    },

    printAssets() {
        if (typeof PDFExporter !== 'undefined' && PDFExporter.exportFixedAssets) {
            const config = Storage.get('erp_settings') || {};
            PDFExporter.exportFixedAssets(this.assets, config);
        } else {
            alert('PDF Exporter module is not loaded.');
        }
    },

    async disposeAsset(assetId, disposalData) {
        const asset = this.assets.find(a => a.id === assetId);
        if (!asset) {
            return { success: false, error: 'Asset not found' };
        }

        const depreciation = this.calculateDepreciation(asset, disposalData.disposalDate);
        const proceedsFromSale = parseFloat(disposalData.proceedsFromSale || 0);
        const gainLoss = proceedsFromSale - depreciation.bookValue;

        asset.status = disposalData.disposalType || 'disposed'; // disposed, sold
        asset.disposalDate = disposalData.disposalDate;
        asset.proceedsFromSale = proceedsFromSale;
        asset.bookValueAtDisposal = depreciation.bookValue;
        asset.gainLoss = gainLoss;

        await this.saveAssets();

        // Create journal entry for disposal
        if (typeof JournalEntry !== 'undefined') {
            const lines = [
                {
                    accountCode: '1120', // Cash/Bank
                    accountName: 'Cash',
                    debit: proceedsFromSale,
                    credit: 0
                },
                {
                    accountCode: '1290', // Accumulated Depreciation
                    accountName: 'Accumulated Depreciation',
                    debit: depreciation.accumulatedDepreciation,
                    credit: 0
                },
                {
                    accountCode: asset.accountCode,
                    accountName: asset.name,
                    debit: 0,
                    credit: asset.purchasePrice
                }
            ];

            // Add gain or loss
            if (gainLoss > 0) {
                lines.push({
                    accountCode: '4190', // Gain on disposal
                    accountName: 'Gain on Asset Disposal',
                    debit: 0,
                    credit: gainLoss
                });
            } else if (gainLoss < 0) {
                lines.push({
                    accountCode: '5290', // Loss on disposal
                    accountName: 'Loss on Asset Disposal',
                    debit: Math.abs(gainLoss),
                    credit: 0
                });
            }

            JournalEntry.addEntry({
                date: disposalData.disposalDate,
                description: `Disposal of ${asset.name} - ${asset.assetNumber}`,
                reference: asset.assetNumber,
                lines: lines
            });
        }

        if (typeof AuditLog !== 'undefined') {
            AuditLog.logUpdate('fixed_asset', asset.assetNumber, {
                status: asset.status,
                gainLoss: gainLoss
            });
        }

        return { success: true, asset, gainLoss };
    },

    render() {
        return `
            <div class="fixed-assets-module">
                <div class="card mb-3">
                    <div class="card-body flex justify-between align-center p-3">
                        <div class="flex gap-2 align-center">
                            <span class="text-gray">🔍 Search:</span>
                            <input type="text" id="asset-search" class="form-input" placeholder="Cari Nama/Asset#/Kat..." 
                                   value="${this._searchQuery || ''}" 
                                   onkeyup="FixedAssets.handleSearch(this.value)" 
                                   style="max-width: 300px; margin-bottom: 0;">
                        </div>
                        <div class="page-actions">
                            ${this._pendingDepreciation && this._pendingDepreciation.length > 0 ? `
                            <button onclick="FixedAssets.processDepreciation()" class="btn btn-warning" style="margin-right: 8px;">
                                📅 Process ${this._pendingDepreciation.length} Pending Depreciation
                            </button>
                            ` : ''}
                            <button onclick="FixedAssets.printAssets()" class="btn btn-outline" style="margin-right: 8px;">
                                🖨️ Print Asset List
                            </button>
                            <button onclick="FixedAssets.showCreateModal()" class="btn btn-primary">
                                ➕ Add Asset
                            </button>
                        </div>
                    </div>
                </div>

                ${this.renderAssetList()}
            </div>
        `;
    },

    renderAssetList() {
        let assets = [...this.assets];

        // 🔍 FILTERING
        if (this._searchQuery) {
            const q = this._searchQuery.toLowerCase();
            assets = assets.filter(a => 
                (a.name && a.name.toLowerCase().includes(q)) || 
                (a.assetNumber && a.assetNumber.toLowerCase().includes(q)) ||
                (a.category && a.category.toLowerCase().includes(q))
            );
        }

        // 🔃 SORTING
        if (this._sortBy && this._sortBy.field) {
            const field = this._sortBy.field;
            const order = this._sortBy.order === 'asc' ? 1 : -1;

            assets.sort((a, b) => {
                let valA = a[field] || '';
                let valB = b[field] || '';

                // Handle computed fields like book value if needed, but here let's stick to raw fields
                if (field === 'purchasePrice') {
                    valA = parseFloat(valA);
                    valB = parseFloat(valB);
                }

                if (valA < valB) return -1 * order;
                if (valA > valB) return 1 * order;
                return 0;
            });
        }

        const renderSortIcon = (field) => {
            if (this._sortBy && this._sortBy.field === field) {
                return this._sortBy.order === 'asc' ? ' 🔼' : ' 🔽';
            }
            return ' ↕️';
        };

        return `
            <div class="card">
                <div class="card-header flex justify-between align-center">
                    <h3 class="card-title">Fixed Asset List (${assets.length})</h3>
                </div>
                <div class="card-body">
                    ${assets.length === 0 ? `
                        <div style="text-align: center; padding: 40px; color: var(--color-gray-600);">
                            <div style="font-size: 48px; margin-bottom: 16px;">🏢</div>
                            <div>No fixed assets found matching your criteria.</div>
                        </div>
                    ` : `
                        <div class="table-responsive">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th onclick="FixedAssets.toggleSort('assetNumber')" style="cursor:pointer">Asset #${renderSortIcon('assetNumber')}</th>
                                        <th onclick="FixedAssets.toggleSort('name')" style="cursor:pointer">Name${renderSortIcon('name')}</th>
                                        <th onclick="FixedAssets.toggleSort('category')" style="cursor:pointer">Category${renderSortIcon('category')}</th>
                                        <th onclick="FixedAssets.toggleSort('purchasePrice')" style="cursor:pointer">Purchase Price${renderSortIcon('purchasePrice')}</th>
                                        <th>Book Value</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${assets.map(asset => {
            const depreciation = this.calculateDepreciation(asset);
            return `
                                            <tr>
                                                <td><strong>${asset.assetNumber}</strong></td>
                                                <td>${asset.name}</td>
                                                <td><span class="badge badge-secondary">${asset.category}</span></td>
                                                <td>${this.formatCurrency(asset.purchasePrice)}</td>
                                                <td><strong>${this.formatCurrency(depreciation.bookValue)}</strong></td>
                                                <td>${this.renderStatusBadge(asset.status)}</td>
                                                <td>
                                                    <button onclick="FixedAssets.showDetail(${asset.id})" class="btn btn-sm btn-info" title="View Details">
                                                        👁️
                                                    </button>
                                                    <button onclick="FixedAssets.showEditModal(${asset.id})" class="btn btn-sm btn-primary" title="Edit Asset">
                                                        ✏️
                                                    </button>
                                                    <button onclick="FixedAssets.confirmDelete(${asset.id})" class="btn btn-sm btn-danger" title="Delete Asset">
                                                        🗑️
                                                    </button>
                                                </td>
                                            </tr>
                                        `;
        }).join('')}
                                </tbody>
                            </table>
                        </div>
                    `}
                </div>
            </div>
        `;
    },

    handleSearch(query) {
        this._searchQuery = query;
        // Re-render only the list part or full page
        const content = document.getElementById('main-content');
        if (content) content.innerHTML = this.render();
        
        // Re-focus search input and put cursor at end
        const searchInput = document.getElementById('asset-search');
        if (searchInput) {
            searchInput.focus();
            const val = searchInput.value;
            searchInput.value = '';
            searchInput.value = val;
        }
    },

    toggleSort(field) {
        if (this._sortBy && this._sortBy.field === field) {
            this._sortBy.order = this._sortBy.order === 'asc' ? 'desc' : 'asc';
        } else {
            this._sortBy = { field: field, order: 'asc' };
        }
        document.getElementById('main-content').innerHTML = this.render();
    },

    renderStatusBadge(status) {
        const badges = {
            'active': '<span class="badge badge-success">Active</span>',
            'disposed': '<span class="badge badge-secondary">Disposed</span>',
            'sold': '<span class="badge badge-info">Sold</span>',
            'draft_from_po': '<span class="badge badge-warning">Draft from PO</span>'
        };
        return badges[status] || status;
    },

    showCreateModal(initialPOId = null, initialItemId = null) {
        const accounts = ChartOfAccounts?.getDetailAccounts?.() || [];
        const today = new Date().toISOString().split('T')[0];
        const allPOs = (typeof Storage !== 'undefined' && Storage.get ? (Storage.get(Storage.KEYS.PURCHASE_ORDERS) || []) : []);
        // Prefer approved/received POs, but list all non-cancelled POs
        const availablePOs = allPOs.filter(po => po && po.status !== 'cancelled');

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'asset-create-modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 950px; width: 95%;">
                <div class="modal-header">
                    <h2>➕ Tambah Aset Tetap (Fixed Asset)</h2>
                    <button onclick="this.closest('.modal-overlay').remove()" class="close-btn">×</button>
                </div>
                <form id="create-asset-form" onsubmit="FixedAssets.handleCreateSubmit(event)">
                    <div class="modal-body">
                        <!-- Source Selection (Poin 1: Wajib PO untuk Pembelian Baru) -->
                        <div class="form-group" style="background: rgba(59, 130, 246, 0.06); padding: 12px 16px; border-radius: 8px; border: 1px solid rgba(59, 130, 246, 0.2); margin-bottom: 16px;">
                            <label class="form-label" style="font-weight: bold; color: #1d4ed8; margin-bottom: 6px;">Sumber Perolehan Aset *</label>
                            <div style="display: flex; gap: 24px; flex-wrap: wrap;">
                                <label style="display: flex; align-items: center; cursor: pointer; font-size: 1.05rem;">
                                    <input type="radio" name="sourceType" value="po" ${!initialPOId || initialPOId ? 'checked' : ''} onchange="FixedAssets.toggleSourceType('po')">
                                    <span style="margin-left: 8px; font-weight: 600;">🏢 Pembelian Baru (Dari Purchase Order)</span>
                                </label>
                                <label style="display: flex; align-items: center; cursor: pointer; font-size: 1.05rem;">
                                    <input type="radio" name="sourceType" value="legacy" onchange="FixedAssets.toggleSourceType('legacy')">
                                    <span style="margin-left: 8px;">📜 Saldo Awal / Aset Legacy (Sebelum ERP)</span>
                                </label>
                            </div>
                        </div>

                        <!-- PO Selection Section (Poin 1 & 4) -->
                        <div id="po-source-section" style="background: rgba(0, 0, 0, 0.02); padding: 16px; border-radius: 8px; border: 1px dashed #cbd5e1; margin-bottom: 16px;">
                            <div class="form-row">
                                <div class="form-group" style="flex: 1;">
                                    <label class="form-label required">Pilih Purchase Order (PO) *</label>
                                    <select id="asset-po-select" class="form-select" onchange="FixedAssets.onPOSelected(this.value)">
                                        <option value="">-- Pilih Purchase Order --</option>
                                        ${availablePOs.map(po => `
                                            <option value="${po.id}" ${initialPOId && String(initialPOId) === String(po.id) ? 'selected' : ''}>
                                                ${po.poNumber} - ${po.supplierName} (${po.status ? po.status.toUpperCase() : 'PO'}) - ${new Date(po.orderDate).toLocaleDateString('id-ID')}
                                            </option>
                                        `).join('')}
                                    </select>
                                    <small class="text-gray">Pilih PO yang sudah disetujui / diterima.</small>
                                </div>
                                <div class="form-group" style="flex: 1;">
                                    <label class="form-label required">Pilih Item Barang dari PO *</label>
                                    <select id="asset-po-item-select" class="form-select" onchange="FixedAssets.onPOItemSelected(this.value)">
                                        <option value="">-- Pilih Item dari PO --</option>
                                    </select>
                                </div>
                            </div>
                            <div id="batch-asset-container" style="display: none; margin-top: 10px; padding: 10px 14px; background: rgba(16, 185, 129, 0.08); border-radius: 6px; border-left: 4px solid #10b981;">
                                <label class="form-label" style="color: #065f46; font-weight: 600; margin-bottom: 4px;">Jumlah Unit Aset yang Didaftarkan:</label>
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    <input type="number" id="asset-count" name="assetCount" min="1" max="1" value="1" class="form-input" style="width: 100px;">
                                    <small id="batch-asset-hint" class="text-gray" style="font-size: 0.95rem;"></small>
                                </div>
                            </div>
                        </div>

                        <!-- Hidden PO Reference Fields -->
                        <input type="hidden" name="poId" id="asset-po-id" value="">
                        <input type="hidden" name="poNumber" id="asset-po-number" value="">
                        <input type="hidden" name="poItemId" id="asset-po-item-id" value="">
                        <input type="hidden" name="vendor" id="asset-vendor" value="">

                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label required">Asset Condition</label>
                                <select name="condition" id="asset-condition" class="form-select" required onchange="FixedAssets.updateAssetCodePreview()">
                                    <option value="new">Aset Baru (N)</option>
                                    <option value="used">Aset Bekas (U)</option>
                                    <option value="legacy">Aset Legacy / Saldo Awal (U-MM)</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Nomor Aset (Auto-Generated)</label>
                                <input type="text" id="asset-code-preview" class="form-input" readonly 
                                       style="background: var(--color-gray-100); font-weight: bold; color: var(--primary-color);">
                            </div>
                        </div>

                        <div class="form-group">
                            <label class="form-label required">Nama Aset</label>
                            <input type="text" name="name" id="asset-name" class="form-input" required 
                                   placeholder="Contoh: Laptop Dell XPS 15, Mesin Cetak, Mobil Operasional">
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label required">Category</label>
                                <select name="category" id="asset-category" class="form-select" required>
                                    <option value="">Select Category...</option>
                                    <option value="Tanah">Tanah (Land)</option>
                                    <option value="Bangunan">Bangunan (Building)</option>
                                    <option value="Kendaraan">Kendaraan (Vehicle)</option>
                                    <option value="Peralatan">Peralatan (Equipment)</option>
                                    <option value="Furniture">Furniture</option>
                                    <option value="Komputer">Komputer & IT</option>
                                </select>
                            </div>

                            <div class="form-group">
                                <label class="form-label required">Account Code (Akun Aset 12xx)</label>
                                <select name="accountCode" class="form-select" required id="asset-account-code"
                                        onchange="FixedAssets.handleAccountCodeChange(this.value)">
                                    <option value="">Select Account...</option>
                                    ${accounts.filter(a => a.code && a.code.startsWith('12')).map(acc => `
                                        <option value="${acc.code}">${acc.code} - ${acc.name}</option>
                                    `).join('')}
                                </select>
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label required">Akumulasi Penyusutan</label>
                                <select name="accumAccountCode" class="form-select" required id="accum-account-code">
                                    <option value="">Pilih Akun Akumulasi...</option>
                                    ${accounts.filter(a => a.code && a.code.startsWith('12')).map(acc => `
                                        <option value="${acc.code}">${acc.code} - ${acc.name}</option>
                                    `).join('')}
                                </select>
                                <small class="text-gray">Pilih akun akumulasi (misal: 1231, 1236)</small>
                            </div>

                            <div class="form-group">
                                <label class="form-label required">Akun Beban Penyusutan</label>
                                <select name="deprExpenseAccountCode" class="form-select" required id="depr-expense-account-code">
                                    <option value="">Pilih Akun Beban...</option>
                                    ${accounts.filter(a => a.category === 'beban').map(acc => `
                                        <option value="${acc.code}">${acc.code} - ${acc.name}</option>
                                    `).join('')}
                                </select>
                                <small class="text-gray">Pilih akun beban (misal: 5136, 5260)</small>
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label required">Tanggal Perolehan</label>
                                <input type="date" name="purchaseDate" id="asset-purchase-date" class="form-input" 
                                       value="${today}" required onchange="FixedAssets.updateAssetCodePreview()">
                            </div>

                            <div class="form-group">
                                <label class="form-label required">Harga Perolehan Satuan (Rp)</label>
                                <input type="number" name="purchasePrice" id="asset-purchase-price" class="form-input" 
                                       min="0" step="1" required placeholder="0">
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Nilai Residu / Salvage Value (Rp)</label>
                                <input type="number" name="salvageValue" id="asset-salvage-value" class="form-input" 
                                       min="0" step="1" value="0" placeholder="0">
                                <small class="text-gray">Estimasi nilai sisa di akhir masa manfaat</small>
                            </div>

                            <div class="form-group">
                                <label class="form-label required">Masa Manfaat (Tahun)</label>
                                <input type="number" name="usefulLife" id="asset-useful-life" class="form-input" 
                                       min="1" max="50" required value="5">
                            </div>
                        </div>

                        <div class="form-group">
                            <label class="form-label required">Metode Penyusutan</label>
                            <select name="depreciationMethod" class="form-select" required>
                                <option value="straight-line">Straight-Line (Garis Lurus)</option>
                                <option value="declining-balance">Declining Balance (Saldo Menurun)</option>
                            </select>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Lokasi Aset</label>
                                <input type="text" name="location" id="asset-location" class="form-input" 
                                       placeholder="e.g., Head Office, Workshop, Lantai 2">
                            </div>

                            <div class="form-group">
                                <label class="form-label">Nomor Seri / SN</label>
                                <input type="text" name="serialNumber" id="asset-serial-number" class="form-input" 
                                       placeholder="Optional">
                            </div>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Spesifikasi / Catatan</label>
                            <textarea name="notes" id="asset-notes" class="form-textarea" rows="3" 
                                      placeholder="Spesifikasi atau informasi detail aset"></textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" onclick="this.closest('.modal-overlay').remove()" 
                                class="btn btn-secondary">Batal</button>
                        <button type="submit" class="btn btn-primary" id="btn-submit-asset">
                            💾 Simpan Aset
                        </button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);
        this.updateAssetCodePreview();

        // If initial PO is passed, trigger selection
        if (initialPOId) {
            this.onPOSelected(initialPOId, initialItemId);
        }
    },

    showCreateFromPOModal(poId, itemId = null) {
        this.showCreateModal(poId, itemId);
    },

    toggleSourceType(type) {
        const poSection = document.getElementById('po-source-section');
        const conditionSelect = document.getElementById('asset-condition');

        if (type === 'po') {
            if (poSection) poSection.style.display = 'block';
            if (conditionSelect) {
                conditionSelect.value = 'new';
                conditionSelect.disabled = false;
            }
        } else {
            if (poSection) poSection.style.display = 'none';
            if (conditionSelect) {
                conditionSelect.value = 'legacy';
                conditionSelect.disabled = false;
            }
            // Clear PO reference
            document.getElementById('asset-po-id').value = '';
            document.getElementById('asset-po-number').value = '';
            document.getElementById('asset-po-item-id').value = '';
            document.getElementById('asset-vendor').value = '';
        }
        this.updateAssetCodePreview();
    },

    onPOSelected(poId, targetItemId = null) {
        const poSelect = document.getElementById('asset-po-select');
        const itemSelect = document.getElementById('asset-po-item-select');
        const poIdInput = document.getElementById('asset-po-id');
        const poNumInput = document.getElementById('asset-po-number');
        const vendorInput = document.getElementById('asset-vendor');
        const dateInput = document.getElementById('asset-purchase-date');

        if (!poId) {
            if (itemSelect) itemSelect.innerHTML = '<option value="">-- Pilih Item dari PO --</option>';
            if (poIdInput) poIdInput.value = '';
            if (poNumInput) poNumInput.value = '';
            if (vendorInput) vendorInput.value = '';
            return;
        }

        const allPOs = (typeof Storage !== 'undefined' && Storage.get ? (Storage.get(Storage.KEYS.PURCHASE_ORDERS) || []) : []);
        const po = allPOs.find(p => String(p.id) === String(poId));
        if (!po) return;

        if (poIdInput) poIdInput.value = po.id;
        if (poNumInput) poNumInput.value = po.poNumber;
        if (vendorInput) vendorInput.value = po.supplierName || '';
        if (dateInput && po.orderDate) {
            dateInput.value = po.orderDate;
            this.updateAssetCodePreview();
        }

        if (itemSelect) {
            itemSelect.innerHTML = `
                <option value="">-- Pilih Item dari PO (${(po.items || []).length} item) --</option>
                ${(po.items || []).map((item, idx) => `
                    <option value="${item.itemId || idx}" data-name="${item.itemName}" data-price="${item.unitPrice}" data-qty="${item.quantity}" data-notes="${item.notes || ''}" data-code="${item.itemCode || ''}" data-acct="${item.inventoryAccount || ''}">
                        ${item.itemCode ? item.itemCode + ' - ' : ''}${item.itemName} (Qty: ${item.quantity}, @ Rp ${Number(item.unitPrice).toLocaleString('id-ID')})
                    </option>
                `).join('')}
            `;

            // Auto-select first item or target item
            if (targetItemId) {
                itemSelect.value = targetItemId;
            } else if (po.items && po.items.length === 1) {
                itemSelect.selectedIndex = 1;
            }

            if (itemSelect.selectedIndex > 0) {
                this.onPOItemSelected(itemSelect.value);
            }
        }
    },

    onPOItemSelected(itemId) {
        const itemSelect = document.getElementById('asset-po-item-select');
        if (!itemSelect || itemSelect.selectedIndex <= 0) return;

        const option = itemSelect.options[itemSelect.selectedIndex];
        const name = option.dataset.name || '';
        const price = parseFloat(option.dataset.price || 0);
        const qty = parseFloat(option.dataset.qty || 1);
        const notes = option.dataset.notes || '';
        const acct = option.dataset.acct || '';

        const nameInput = document.getElementById('asset-name');
        const priceInput = document.getElementById('asset-purchase-price');
        const notesInput = document.getElementById('asset-notes');
        const poItemIdInput = document.getElementById('asset-po-item-id');
        const batchContainer = document.getElementById('batch-asset-container');
        const assetCountInput = document.getElementById('asset-count');
        const batchHint = document.getElementById('batch-asset-hint');
        const categorySelect = document.getElementById('asset-category');

        if (nameInput && name) nameInput.value = name;
        if (priceInput && price) priceInput.value = price;
        if (notesInput && notes) notesInput.value = notes;
        if (poItemIdInput) poItemIdInput.value = itemId;

        // Infer Category if empty
        if (categorySelect && (!categorySelect.value || categorySelect.value === '')) {
            categorySelect.value = this.inferAssetCategory(acct, name);
        }

        // Auto select account code if mapped
        if (acct && this.isFixedAssetAccount(acct)) {
            const acctSelect = document.getElementById('asset-account-code');
            if (acctSelect) {
                acctSelect.value = acct;
                this.handleAccountCodeChange(acct);
            }
        }

        // Handle batch creation helper (POIN 4: Qty > 1 bisa buat beberapa aset sekaligus)
        if (qty > 1 && batchContainer && assetCountInput) {
            batchContainer.style.display = 'block';
            assetCountInput.max = qty;
            assetCountInput.value = qty;
            if (batchHint) batchHint.textContent = `(Item PO memiliki ${qty} unit. Akan otomatis membuat ${qty} aset dengan nomor berurutan).`;
        } else if (batchContainer) {
            batchContainer.style.display = 'none';
            if (assetCountInput) assetCountInput.value = 1;
        }
    },

    togglePaymentFields() {
        // Payment fields no longer required for PO asset creation since PO handles AP/payments
    },

    async handleCreateSubmit(event) {
        event.preventDefault();
        const formData = new FormData(event.target);
        const sourceType = formData.get('sourceType') || 'po';
        const condition = formData.get('condition') || (sourceType === 'legacy' ? 'legacy' : 'new');
        const poId = formData.get('poId');
        const poNumber = formData.get('poNumber');
        const poItemId = formData.get('poItemId');
        const vendor = formData.get('vendor');

        // POIN 1 Validation: Alur pembelian aset baru WAJIB melalui PO
        if (sourceType === 'po' || condition === 'new') {
            if (!poId || !poNumber) {
                alert('⚠️ Pembelian aset baru wajib memilih Purchase Order (PO) yang valid.');
                return;
            }
        }

        const count = parseInt(formData.get('assetCount') || '1', 10);
        const baseName = formData.get('name');
        const purchasePrice = parseFloat(formData.get('purchasePrice'));
        const purchaseDate = formData.get('purchaseDate');

        const submitBtn = document.getElementById('btn-submit-asset');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Menyimpan...';
        }

        try {
            let createdCount = 0;
            let lastAssetNumber = '';

            for (let i = 0; i < count; i++) {
                const assetData = {
                    name: count > 1 ? `${baseName} (${i + 1}/${count})` : baseName,
                    category: formData.get('category'),
                    accountCode: formData.get('accountCode'),
                    purchaseDate: purchaseDate,
                    purchasePrice: purchasePrice,
                    salvageValue: formData.get('salvageValue'),
                    usefulLife: formData.get('usefulLife'),
                    depreciationMethod: formData.get('depreciationMethod'),
                    accumAccountCode: formData.get('accumAccountCode'),
                    deprExpenseAccountCode: formData.get('deprExpenseAccountCode'),
                    location: formData.get('location'),
                    serialNumber: formData.get('serialNumber'),
                    notes: formData.get('notes'),
                    condition: condition,
                    source: sourceType === 'po' ? 'purchase_order' : 'legacy',
                    poId: poId || null,
                    poNumber: poNumber || '',
                    poItemId: poItemId || null,
                    vendor: vendor || ''
                };

                // Generate asset number preserving existing format (POIN 5)
                assetData.assetNumber = this.generateAssetNumber(condition, purchaseDate);

                const result = await this.createAsset(assetData);
                if (result.success) {
                    createdCount++;
                    lastAssetNumber = result.asset.assetNumber;
                } else {
                    alert('Error: ' + (result.errors?.validation || 'Gagal membuat aset'));
                    break;
                }
            }

            if (createdCount > 0) {
                // Close modal
                event.target.closest('.modal-overlay').remove();

                // Refresh display
                const content = document.getElementById('main-content');
                if (content) content.innerHTML = this.render();

                const successMsg = createdCount > 1
                    ? `Berhasil membuat ${createdCount} aset tetap dari PO ${poNumber}!`
                    : `Aset ${lastAssetNumber} berhasil ditambahkan!`;

                if (typeof App !== 'undefined' && App.showAlert) {
                    App.showAlert('success', successMsg);
                } else {
                    alert(successMsg);
                }
            }
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = '💾 Simpan Aset';
            }
        }
    },

    async processDepreciation() {
        if (!this._pendingDepreciation || this._pendingDepreciation.length === 0) return;

        if (confirm(`Proses jurnal penyusutan untuk ${this._pendingDepreciation.length} bulan?`)) {
            if (window.showLoading) window.showLoading('Memproses Penyusutan...');

            let successCount = 0;
            let errors = [];

            for (const monthKey of [...this._pendingDepreciation]) {
                const result = await this.runDepreciation(monthKey);
                if (result.success) {
                    successCount++;
                } else {
                    errors.push(`${monthKey}: ${result.error}`);
                }
            }

            if (window.hideLoading) window.hideLoading();

            if (successCount > 0) {
                alert(`Berhasil memproses ${successCount} jurnal penyusutan.`);
                document.getElementById('main-content').innerHTML = this.render();
            }

            if (errors.length > 0) {
                alert('Beberapa gagal diproses:\n' + errors.join('\n'));
            }
        }
    },

    showEditModal(id) {
        const asset = this.assets.find(a => a.id === id);
        if (!asset) { alert('Asset not found'); return; }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px;">
                <div class="modal-header">
                    <h2>✏️ Edit Fixed Asset</h2>
                    <button onclick="this.closest('.modal-overlay').remove()" class="close-btn">×</button>
                </div>
                <form onsubmit="FixedAssets.handleEditSubmit(event, ${id})">
                    <div class="modal-body">
                        <div class="form-group">
                            <label class="form-label">${(Auth?.getCurrentUser()?.role === 'ADMIN' || Auth?.getCurrentUser()?.role === 'director') ? 'Asset Number (Admin Only)' : 'Asset Number'}</label>
                            <input type="text" name="assetNumber" class="form-input" value="${asset.assetNumber}" 
                                   ${(Auth?.getCurrentUser()?.role === 'ADMIN' || Auth?.getCurrentUser()?.role === 'director') ? '' : 'disabled'}
                                   style="${(Auth?.getCurrentUser()?.role === 'ADMIN' || Auth?.getCurrentUser()?.role === 'director') ? 'border: 2px solid var(--color-warning);' : ''}">
                            ${(Auth?.getCurrentUser()?.role === 'ADMIN' || Auth?.getCurrentUser()?.role === 'director') ? '<small style="color: var(--color-warning)">⚠️ Edit with caution to avoid duplicates.</small>' : ''}
                        </div>
                        <div class="form-group">
                            <label class="form-label required">Name</label>
                            <input type="text" name="name" class="form-input" required value="${asset.name}">
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Category</label>
                                <select name="category" class="form-select">
                                    <option value="Tanah" ${asset.category === 'Tanah' ? 'selected' : ''}>Tanah</option>
                                    <option value="Bangunan" ${asset.category === 'Bangunan' ? 'selected' : ''}>Bangunan</option>
                                    <option value="Kendaraan" ${asset.category === 'Kendaraan' ? 'selected' : ''}>Kendaraan</option>
                                    <option value="Peralatan" ${asset.category === 'Peralatan' ? 'selected' : ''}>Peralatan</option>
                                    <option value="Furniture" ${asset.category === 'Furniture' ? 'selected' : ''}>Furniture</option>
                                    <option value="Komputer" ${asset.category === 'Komputer' ? 'selected' : ''}>Komputer</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Useful Life</label>
                                <input type="number" name="usefulLife" class="form-input" value="${asset.usefulLife}">
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label required">Akumulasi Penyusutan</label>
                                <select name="accumAccountCode" class="form-select" required>
                                    <option value="">Pilih Akun Akumulasi...</option>
                                    ${ChartOfAccounts?.getDetailAccounts?.().filter(a => a.code && a.code.startsWith('12')).map(acc => `
                                        <option value="${acc.code}" ${asset.accumAccountCode === acc.code ? 'selected' : ''}>${acc.code} - ${acc.name}</option>
                                    `).join('')}
                                </select>
                            </div>

                            <div class="form-group">
                                <label class="form-label required">Akun Beban Penyusutan</label>
                                <select name="deprExpenseAccountCode" class="form-select" required>
                                    <option value="">Pilih Akun Beban...</option>
                                    ${ChartOfAccounts?.getDetailAccounts?.().filter(a => a.category === 'beban').map(acc => `
                                        <option value="${acc.code}" ${asset.deprExpenseAccountCode === acc.code ? 'selected' : ''}>${acc.code} - ${acc.name}</option>
                                    `).join('')}
                                </select>
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Location</label>
                                <input type="text" name="location" class="form-input" value="${asset.location || ''}">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Serial Number</label>
                                <input type="text" name="serialNumber" class="form-input" value="${asset.serialNumber || ''}">
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Notes</label>
                            <textarea name="notes" class="form-textarea" rows="3">${asset.notes || ''}</textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" onclick="this.closest('.modal-overlay').remove()" class="btn btn-secondary">Cancel</button>
                        <button type="submit" class="btn btn-primary">💾 Update</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
    },

    async handleEditSubmit(event, id) {
        event.preventDefault();
        const fd = new FormData(event.target);
        const result = await this.updateAsset(id, {
            assetNumber: fd.get('assetNumber') || undefined,
            name: fd.get('name'),
            category: fd.get('category'),
            usefulLife: fd.get('usefulLife'),
            accumAccountCode: fd.get('accumAccountCode'),
            deprExpenseAccountCode: fd.get('deprExpenseAccountCode'),
            location: fd.get('location'),
            serialNumber: fd.get('serialNumber'),
            notes: fd.get('notes')
        });

        if (result.success) {
            event.target.closest('.modal-overlay').remove();
            document.getElementById('main-content').innerHTML = this.render();
            alert(`Asset ${result.asset.assetNumber} updated!`);
        }
    },

    async updateAsset(id, data) {
        const asset = this.assets.find(a => a.id === id);
        if (!asset) return { success: false };

        // Filter out undefined to not overwrite if role doesn't have edit permission
        const updateData = {};
        for (const key in data) {
            if (data[key] !== undefined) updateData[key] = data[key];
        }

        Object.assign(asset, updateData, { updatedAt: new Date().toISOString() });
        if (data.usefulLife !== undefined) asset.usefulLife = parseInt(data.usefulLife);
        await this.saveAssets();

        if (typeof AuditLog !== 'undefined') {
            AuditLog.logUpdate('fixed_asset', asset.assetNumber, { name: asset.name });
        }
        return { success: true, asset };
    },



    confirmDelete(id) {
        const asset = this.assets.find(a => a.id === id);
        if (!asset) {
            alert('Asset not found');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h2>⚠️ Delete Fixed Asset?</h2>
                    <button onclick="this.closest('.modal-overlay').remove()" class="close-btn">×</button>
                </div>
                <div class="modal-body">
                    <div class="alert alert-warning">
                        <strong>Warning:</strong> This action cannot be undone!
                    </div>
                    
                    <table class="table">
                        <tr>
                            <td><strong>Asset Number:</strong></td>
                            <td>${asset.assetNumber}</td>
                        </tr>
                        <tr>
                            <td><strong>Name:</strong></td>
                            <td>${asset.name}</td>
                        </tr>
                        <tr>
                            <td><strong>Purchase Price:</strong></td>
                            <td>${this.formatCurrency(asset.purchasePrice)}</td>
                        </tr>
                        <tr>
                            <td><strong>Status:</strong></td>
                            <td>${this.renderStatusBadge(asset.status)}</td>
                        </tr>
                    </table>

                    <div class="alert alert-info" style="margin-top: 16px;">
                        <strong>This will:</strong>
                        <ul style="margin: 8px 0 0 20px;">
                            <li>Remove asset from system permanently</li>
                            <li>Delete associated journal entry (${asset.assetNumber})</li>
                            <li>Update accounting records</li>
                        </ul>
                    </div>
                </div>
                <div class="modal-footer">
                    <button onclick="this.closest('.modal-overlay').remove()" class="btn btn-secondary">
                        Cancel
                    </button>
                    <button onclick="FixedAssets.deleteAsset(${id}); this.closest('.modal-overlay').remove();" class="btn btn-danger">
                        🗑️ Delete Asset
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    },

    async deleteAsset(id) {
        const asset = this.assets.find(a => a.id === id);
        if (!asset) {
            alert('Asset not found');
            return;
        }

        // ========================================================
        // FIX: Delete from Cloud FIRST (Tombstone) to prevent
        // the cloud sync safety guard from restoring the asset
        // on next login. This is the same pattern used by
        // JournalEntry, PaymentVoucher, and ReceiptVoucher.
        // ========================================================
        try {
            if (typeof FirebaseSync !== 'undefined' && FirebaseSync.isEnabled()) {
                await FirebaseSync.deleteFromCloud(Storage.KEYS.FIXED_ASSETS, id);
                console.log(`🗑️ [FixedAssets] Cloud tombstone created for asset ${asset.assetNumber}`);
            }
        } catch (cloudError) {
            console.warn(`⚠️ [FixedAssets] Cloud delete failed for ${asset.assetNumber}, proceeding with local delete:`, cloudError);
            // Continue with local delete even if cloud fails
        }

        // Delete associated journal entry (also from cloud)
        if (typeof JournalEntry !== 'undefined' && JournalEntry.entries) {
            const journalIndex = JournalEntry.entries.findIndex(j => j.reference === asset.assetNumber);
            if (journalIndex !== -1) {
                const journalEntry = JournalEntry.entries[journalIndex];
                JournalEntry.entries.splice(journalIndex, 1);
                if (typeof Storage !== 'undefined') {
                    await Storage.set(Storage.KEYS.JOURNAL_ENTRIES, JournalEntry.entries);
                }
                // Also delete journal entry from cloud
                try {
                    if (typeof FirebaseSync !== 'undefined' && FirebaseSync.isEnabled() && journalEntry.id) {
                        await FirebaseSync.deleteFromCloud(Storage.KEYS.JOURNAL_ENTRIES, journalEntry.id);
                    }
                } catch (e) { console.warn('Journal cloud delete failed:', e); }
            }
        }

        // Remove asset from local array
        const assetIndex = this.assets.findIndex(a => a.id === id);
        if (assetIndex !== -1) {
            this.assets.splice(assetIndex, 1);
            await this.saveAssets();
        }

        // Audit log
        if (typeof AuditLog !== 'undefined') {
            AuditLog.logDelete('fixed_asset', asset.assetNumber, {
                name: asset.name,
                value: asset.purchasePrice
            });
        }

        // Refresh display
        document.getElementById('main-content').innerHTML = this.render();

        // Show success message
        if (typeof App !== 'undefined' && App.showAlert) {
            App.showAlert('success', `Asset ${asset.assetNumber} berhasil dihapus permanen! (Cloud + Local)`);
        } else {
            alert(`Asset ${asset.assetNumber} berhasil dihapus permanen!`);
        }
    },

    showDetail(id) {
        const asset = this.assets.find(a => a.id === id);
        if (!asset) return;

        const depreciation = this.calculateDepreciation(asset);
        const schedule = this.generateDepreciationSchedule(id);

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px;">
                <div class="modal-header">
                    <h2>Fixed Asset: ${asset.assetNumber}</h2>
                    <button onclick="this.closest('.modal-overlay').remove()" class="close-btn">×</button>
                </div>
                <div class="modal-body">
                    <h4>${asset.name}</h4>
                    ${asset.poNumber || asset.vendor ? `
                        <div style="background: rgba(59, 130, 246, 0.06); padding: 12px 16px; border-radius: 8px; margin-top: 12px; margin-bottom: 16px; border-left: 4px solid #3b82f6;">
                            <p style="margin: 0 0 4px; font-weight: 600; color: #1d4ed8;">📋 Referensi Pembelian (Purchase Order):</p>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 0.95rem;">
                                <p style="margin:0;"><strong>PO Number:</strong> ${asset.poNumber || '-'}</p>
                                <p style="margin:0;"><strong>Vendor / Supplier:</strong> ${asset.vendor || asset.sourceSupplierName || '-'}</p>
                            </div>
                        </div>
                    ` : ''}

                    ${asset.notes ? `
                        <div style="background: var(--color-gray-100); padding: 10px 14px; border-radius: 8px; margin-bottom: 16px; border: 1px solid var(--color-gray-200); font-size: 0.95rem;">
                            <strong>📝 Spesifikasi / Catatan:</strong> ${asset.notes}
                        </div>
                    ` : ''}

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin: 16px 0;">
                        <div>
                            <p><strong>Category:</strong> ${asset.category}</p>
                            <p><strong>Purchase Date:</strong> ${new Date(asset.purchaseDate).toLocaleDateString('id-ID')}</p>
                            <p><strong>Purchase Price:</strong> ${this.formatCurrency(asset.purchasePrice)}</p>
                            <p><strong>Salvage Value:</strong> ${this.formatCurrency(asset.salvageValue)}</p>
                        </div>
                        <div>
                            <p><strong>Useful Life:</strong> ${asset.usefulLife} years</p>
                            <p><strong>Depreciation Method:</strong> ${asset.depreciationMethod}</p>
                            <p><strong>Book Value:</strong> ${this.formatCurrency(depreciation.bookValue)}</p>
                            <p><strong>Status:</strong> ${this.renderStatusBadge(asset.status)}</p>
                        </div>
                    </div>

                    <div style="background: var(--color-gray-100); padding: 16px; border-radius: 8px; margin-bottom: 24px; border: 1px solid var(--color-gray-200);">
                        <p style="margin-bottom: 8px;"><strong>⚙️ Depreciation Mapping:</strong></p>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                            <p><strong>Accumulated Depr:</strong> ${asset.accumAccountCode || '-'}</p>
                            <p><strong>Depr. Expense:</strong> ${asset.deprExpenseAccountCode || '-'}</p>
                        </div>
                    </div>

                    <h4>Depreciation Schedule</h4>
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Year</th>
                                <th>Annual Depreciation</th>
                                <th>Accumulated Depreciation</th>
                                <th>Book Value</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${schedule.map(row => `
                                <tr>
                                    <td>${row.year}</td>
                                    <td>${this.formatCurrency(row.annualDepreciation)}</td>
                                    <td>${this.formatCurrency(row.accumulatedDepreciation)}</td>
                                    <td>${this.formatCurrency(row.bookValue)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="modal-footer">
                    <button onclick="FixedAssets.printAssets()" class="btn btn-outline" style="margin-right: auto;">🖨️ Print List</button>
                    <button onclick="this.closest('.modal-overlay').remove()" class="btn btn-secondary">Close</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    handleAccountCodeChange(code) {
        const accumSelect = document.getElementById('accum-account-code');
        const expSelect = document.getElementById('depr-expense-account-code');
        if (!accumSelect || !expSelect) return;

        // Auto-suggest Accum account based on pattern: 12x0 -> 12x1, etc.
        // Or based on existing mapping
        const mapping = this.depreciationMapping[code];
        if (mapping) {
            accumSelect.value = mapping.accum;
            expSelect.value = mapping.exp;
        } else {
            // Smart guessing: 1230 -> 1231
            const prefix = code.substring(0, 3);
            const suffix = code.substring(3);
            if (suffix === '0') {
                const guessedAccum = prefix + '1';
                // Check if options exists
                const option = Array.from(accumSelect.options).find(opt => opt.value === guessedAccum);
                if (option) accumSelect.value = guessedAccum;
            }
            expSelect.value = '5260'; // Default non-production expense
        }
    },

    formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    }
};


// Explicitly make FixedAssets globally available
window.FixedAssets = FixedAssets;
