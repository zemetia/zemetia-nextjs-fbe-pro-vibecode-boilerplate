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

        const asset = {
            id: Date.now(),
            assetNumber: assetData.assetNumber || this.generateAssetNumber(),
            name: assetData.name,
            condition: assetData.condition || 'new', // added condition field
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
            notes: assetData.notes || '',
            status: 'active', // active, disposed, sold
            createdBy: Auth?.getCurrentUser?.()?.username || 'system',
            createdAt: new Date().toISOString(),
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

    showCreateModal() {
        console.log('FixedAssets Modal v2.0 - With Payment Method'); // Debug marker
        const accounts = ChartOfAccounts?.getDetailAccounts?.() || [];
        const today = new Date().toISOString().split('T')[0];

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px;">
                <div class="modal-header">
                    <h2>➕ Add New Fixed Asset</h2>
                    <button onclick="this.closest('.modal-overlay').remove()" class="close-btn">×</button>
                </div>
                <form id="create-asset-form" onsubmit="FixedAssets.handleCreateSubmit(event)">
                    <div class="modal-body">
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label required">Asset Condition (Internal Category)</label>
                                <select name="condition" id="asset-condition" class="form-select" required onchange="FixedAssets.updateAssetCodePreview()">
                                    <option value="new">Aset Baru (N)</option>
                                    <option value="used">Aset Bekas (U)</option>
                                    <option value="legacy">Aset Legacy/Sudah Ada (Obfuscated U-MM)</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Reg. Number (Auto-Generated)</label>
                                <input type="text" id="asset-code-preview" class="form-input" readonly 
                                       style="background: var(--color-gray-100); font-weight: bold; color: var(--primary-color);">
                            </div>
                        </div>

                        <div class="form-group">
                            <label class="form-label required">Asset Name</label>
                            <input type="text" name="name" class="form-input" required 
                                   placeholder="e.g., Office Building, Company Vehicle">
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label required">Category</label>
                                <select name="category" class="form-select" required>
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
                                <label class="form-label required">Account Code</label>
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
                                <label class="form-label required">Purchase Date</label>
                                <input type="date" name="purchaseDate" id="asset-purchase-date" class="form-input" 
                                       value="${today}" required onchange="FixedAssets.updateAssetCodePreview()">
                            </div>

                            <div class="form-group">
                                <label class="form-label required">Purchase Price (Rp)</label>
                                <input type="number" name="purchasePrice" class="form-input" 
                                       min="0" step="1" required placeholder="0">
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Salvage Value (Rp)</label>
                                <input type="number" name="salvageValue" class="form-input" 
                                       min="0" step="1" value="0" placeholder="0">
                                <small class="text-gray">Estimated value at end of useful life</small>
                            </div>

                            <div class="form-group">
                                <label class="form-label required">Useful Life (Years)</label>
                                <input type="number" name="usefulLife" class="form-input" 
                                       min="1" max="50" required value="5">
                            </div>
                        </div>

                        <div class="form-group">
                            <label class="form-label required">Depreciation Method</label>
                            <select name="depreciationMethod" class="form-select" required>
                                <option value="straight-line">Straight-Line (Garis Lurus)</option>
                                <option value="declining-balance">Declining Balance (Saldo Menurun)</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label class="form-label required">Payment Method</label>
                            <select name="paymentMethod" class="form-select" required id="paymentMethod" 
                                    onchange="FixedAssets.togglePaymentFields()">
                                <option value="">Select Payment Method...</option>
                                <option value="cash">💵 Cash (Tunai)</option>
                                <option value="bank">🏦 Bank Transfer</option>
                                <option value="credit">🧾 Credit/Hutang</option>
                                <option value="partial">💳 Partial Payment (DP + Hutang)</option>
                            </select>
                            <small class="text-gray">Pilih metode pembayaran sesuai transaksi</small>
                        </div>

                        <div id="partialPaymentFields" style="display: none;">
                            <div class="form-row">
                                <div class="form-group">
                                    <label class="form-label">Down Payment (DP) - Rp</label>
                                    <input type="number" name="downPayment" class="form-input" 
                                           min="0" step="1" value="0" placeholder="0">
                                    <small class="text-gray">Pembayaran awal tunai/bank</small>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Sisa (Hutang)</label>
                                    <input type="number" name="remainingPayment" class="form-input" 
                                           disabled placeholder="Otomatis terhitung">
                                </div>
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Location</label>
                                <input type="text" name="location" class="form-input" 
                                       placeholder="e.g., Head Office, Branch A">
                            </div>

                            <div class="form-group">
                                <label class="form-label">Serial Number</label>
                                <input type="text" name="serialNumber" class="form-input" 
                                       placeholder="Optional">
                            </div>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Notes</label>
                            <textarea name="notes" class="form-textarea" rows="3" 
                                      placeholder="Additional information about this asset"></textarea>
                        </div>

                        <div class="alert alert-info" style="margin-top: 16px;">
                            <strong>ℹ️ Info:</strong> A journal entry will be automatically created for this asset purchase.
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" onclick="this.closest('.modal-overlay').remove()" 
                                class="btn btn-secondary">Cancel</button>
                        <button type="submit" class="btn btn-primary">
                            💾 Create Asset
                        </button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);
    },

    togglePaymentFields() {
        const paymentMethod = document.getElementById('paymentMethod')?.value;
        const partialFields = document.getElementById('partialPaymentFields');
        const remainingInput = document.querySelector('input[name="remainingPayment"]');
        const dpInput = document.querySelector('input[name="downPayment"]');
        const priceInput = document.querySelector('input[name="purchasePrice"]');

        if (partialFields) {
            partialFields.style.display = paymentMethod === 'partial' ? 'block' : 'none';
        }

        // Auto-calculate remaining if DP changes
        if (paymentMethod === 'partial' && dpInput && remainingInput && priceInput) {
            dpInput.addEventListener('input', () => {
                const total = parseFloat(priceInput.value) || 0;
                const dp = parseFloat(dpInput.value) || 0;
                remainingInput.value = Math.max(0, total - dp);
            });
            priceInput.addEventListener('input', () => {
                const total = parseFloat(priceInput.value) || 0;
                const dp = parseFloat(dpInput.value) || 0;
                remainingInput.value = Math.max(0, total - dp);
            });
        }
    },

    async handleCreateSubmit(event) {
        event.preventDefault();
        const formData = new FormData(event.target);

        const assetData = {
            name: formData.get('name'),
            category: formData.get('category'),
            accountCode: formData.get('accountCode'),
            purchaseDate: formData.get('purchaseDate'),
            purchasePrice: formData.get('purchasePrice'),
            salvageValue: formData.get('salvageValue'),
            usefulLife: formData.get('usefulLife'),
            depreciationMethod: formData.get('depreciationMethod'),
            accumAccountCode: formData.get('accumAccountCode'),
            deprExpenseAccountCode: formData.get('deprExpenseAccountCode'),
            location: formData.get('location'),
            serialNumber: formData.get('serialNumber'),
            notes: formData.get('notes'),
            paymentMethod: formData.get('paymentMethod'),
            downPayment: formData.get('downPayment'),
            condition: formData.get('condition')
        };

        // Important: override assetNumber generation with selected condition/date
        assetData.assetNumber = this.generateAssetNumber(assetData.condition, assetData.purchaseDate);

        const result = await this.createAsset(assetData);

        if (result.success) {
            // Create journal entry based on payment method
            if (typeof JournalEntry !== 'undefined' && JournalEntry.createEntry) {
                const mapping = Storage.getAccountMapping?.() || {};
                const purchasePrice = parseFloat(assetData.purchasePrice);
                const paymentMethod = assetData.paymentMethod;
                const downPayment = parseFloat(assetData.downPayment || 0);
                const lines = [];

                // Debit: Fixed Asset (always)
                lines.push({
                    accountCode: assetData.accountCode,
                    description: `Aset: ${assetData.name}`,
                    debit: purchasePrice,
                    credit: 0
                });

                // Credit: Based on payment method
                if (paymentMethod === 'cash') {
                    // Full payment from cash
                    lines.push({
                        accountCode: mapping.cash || '1110',
                        description: 'Pembayaran tunai',
                        debit: 0,
                        credit: purchasePrice
                    });
                } else if (paymentMethod === 'bank') {
                    // Full payment from bank
                    lines.push({
                        accountCode: mapping.bank || '1120',
                        description: 'Pembayaran via bank',
                        debit: 0,
                        credit: purchasePrice
                    });
                } else if (paymentMethod === 'credit') {
                    // Full credit/hutang
                    lines.push({
                        accountCode: mapping.accounts_payable || '2110',
                        description: 'Hutang pembelian aset',
                        debit: 0,
                        credit: purchasePrice
                    });
                } else if (paymentMethod === 'partial') {
                    // Partial: DP + Remaining hutang
                    if (downPayment > 0) {
                        lines.push({
                            accountCode: mapping.bank || '1120',
                            description: `DP pembayaran (${this.formatCurrency(downPayment)})`,
                            debit: 0,
                            credit: downPayment
                        });
                    }

                    const remaining = purchasePrice - downPayment;
                    if (remaining > 0) {
                        lines.push({
                            accountCode: mapping.long_term_debt || '2210',
                            description: `Hutang jangka panjang (${this.formatCurrency(remaining)})`,
                            debit: 0,
                            credit: remaining
                        });
                    }
                }

                await JournalEntry.createEntry({
                    date: assetData.purchaseDate,
                    reference: result.asset.assetNumber,
                    description: `Pembelian Aset Tetap: ${assetData.name} (${paymentMethod.toUpperCase()})`,
                    transactionType: 'JRN',
                    lines: lines
                });
            }

            // Close modal
            event.target.closest('.modal-overlay').remove();

            // Refresh display
            document.getElementById('main-content').innerHTML = this.render();

            // Show success message
            if (typeof App !== 'undefined' && App.showAlert) {
                App.showAlert('success', `Asset ${result.asset.assetNumber} berhasil ditambahkan!`);
            } else {
                alert(`Asset ${result.asset.assetNumber} berhasil ditambahkan!`);
            }
        } else {
            alert('Error: ' + (result.errors?.validation || 'Failed to create asset'));
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
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin: 24px 0;">
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
