// ==========================================
// Goods Receipt (GR) Module
// Manage goods receipt from Purchase Orders
// ==========================================

const GoodsReceipt = {
    receipts: [],
    currentReceipt: null,

    statuses: {
        received: 'Received',
        lab_testing: 'Lab Testing',
        lab_approved: 'Lab Approved',
        lab_rejected: 'Lab Rejected',
        ttb_created: 'TTB Created',
        completed: 'Completed'
    },

    init() {
        this.loadReceipts();
    },

    loadReceipts() {
        this.receipts = Storage.getGoodsReceipts();
    },

    async saveReceipts() {
        return await Storage.saveGoodsReceipts(this.receipts);
    },

    async generateGRNumber() {
        // ☁️ Use Atomic Cloud Sequencer
        const nextRef = await Storage.getNextReferenceNumber('GR');
        if (nextRef) return nextRef;

        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');

        const grs = this.receipts.filter(g =>
            g.grNumber && g.grNumber.startsWith(`GR-${year}${month}`)
        );

        const nextNum = String(grs.length + 1).padStart(4, '0');
        return `GR-${year}${month}-${nextNum}`;
    },

    async createGR(poId, receivedItems, warehouseId = 'TEMP-001') {
        // Get PO details
        const po = PurchaseOrder.getOrder(poId);
        if (!po) {
            return { success: false, errors: { po: 'Purchase Order not found' } };
        }

        if (po.status !== 'approved') {
            return { success: false, errors: { status: 'PO must be approved first' } };
        }

        // Validate received items
        if (!receivedItems || receivedItems.length === 0) {
            return { success: false, errors: { items: 'At least one item is required' } };
        }

        // Check if items match PO
        const validItems = receivedItems.every(item => {
            const poItem = po.items.find(i => i.itemId === item.itemId);
            return poItem && item.receivedQty <= poItem.quantity;
        });

        if (!validItems) {
            return { success: false, errors: { items: 'Received items do not match PO' } };
        }

        const gr = {
            id: Date.now(),
            grNumber: await this.generateGRNumber(),
            poId: po.id,
            poNumber: po.poNumber,
            supplierId: po.supplier,
            supplierName: po.supplierName,
            receiptDate: new Date().toISOString().split('T')[0],

            items: receivedItems.map(item => {
                const poItem = po.items.find(i => i.itemId === item.itemId);
                return {
                    itemId: item.itemId,
                    itemCode: item.itemCode,
                    itemName: item.itemName,
                    orderedQty: poItem.quantity,
                    receivedQty: parseFloat(item.receivedQty),
                    unit: item.unit,
                    unitPrice: poItem.unitPrice,
                    notes: item.notes || '',
                    variance: poItem.quantity - parseFloat(item.receivedQty)
                };
            }),

            // Warehouse
            warehouseId: warehouseId,
            warehouseType: 'temporary',

            // Lab Test
            labTestRequired: this.requiresLabTest(receivedItems),
            labTestId: null,
            labTestStatus: null,
            labTestResult: null,

            // TTB
            ttbId: null,
            ttbNumber: null,

            status: 'received',
            createdBy: Auth.getCurrentUser()?.id || 'System',
            createdByName: Auth.getCurrentUser()?.name || 'System',
            createdAt: new Date().toISOString()
        };

        this.receipts.push(gr);
        this.saveReceipts();

        // PO status update is now handled by the caller (e.g., submitGR) 
        // to support partial receipts and short-close logic.
        // PurchaseOrder.updateOrder(po.id, { status: 'received' });

        // Create stock movement to temporary warehouse
        await this.createStockMovement(gr, 'in');

        // NEW: Update average cost if COMPANY owned
        if (gr.ownerId === 'COMPANY') {
            console.log('💰 Updating inventory costs for GR:', gr.grNumber);
            gr.items.forEach(item => {
                const transaction = {
                    type: 'IN',
                    itemCode: item.itemCode,
                    quantity: item.receivedQty,
                    unitCost: item.unitPrice,
                    date: gr.receiptDate,
                    warehouse: warehouseId,
                    sourceDocument: 'GR',
                    sourceDocumentId: gr.id,
                    sourceDocumentNumber: gr.grNumber
                };

                const costResult = InventoryValuation.updateItemCost(item.itemCode, transaction);
                if (costResult.success) {
                    console.log(`  ✅ ${item.itemCode}: Avg cost updated from ${InventoryValuation.formatCurrency(costResult.oldAvgCost)} to ${InventoryValuation.formatCurrency(costResult.newAvgCost)}`);
                } else {
                    console.warn(`  ⚠️ Failed to update cost for ${item.itemCode}:`, costResult.error);
                }
            });
        } else {
            console.log('📦 Customer owned material - skipping average cost update');
        }

        // Auto-create lab test if required
        if (gr.labTestRequired) {
            this.createLabTest(gr.id);
        }

        AuditLog.log('create', 'goods_receipt', gr.id,
            `Created GR ${gr.grNumber} from PO ${po.poNumber}`);

        return { success: true, gr };
    },

    requiresLabTest(items) {
        // Check if any item requires lab test
        // For gold refinery, typically raw materials need testing
        const labTestCategories = ['raw_material', 'gold', 'chemical'];

        // Defensive check: ensure MasterItem is available
        if (typeof MasterItem === 'undefined' || typeof MasterItem.getItem !== 'function') {
            console.warn('MasterItem not available, skipping lab test check');
            return false;
        }

        return items.some(item => {
            const masterItem = MasterItem.getItem(item.itemId);
            return masterItem && labTestCategories.includes(masterItem.category);
        });
    },

    createLabTest(grId) {
        const gr = this.getGR(grId);
        if (!gr) return { success: false, errors: { gr: 'GR not found' } };

        // Create lab test request
        const labTest = {
            id: Date.now(),
            testNumber: `LAB-${Date.now()}`,
            grId: gr.id,
            grNumber: gr.grNumber,
            poNumber: gr.poNumber,
            testDate: new Date().toISOString().split('T')[0],

            samples: gr.items.map(item => ({
                itemId: item.itemId,
                itemName: item.itemName,
                quantity: item.receivedQty,
                unit: item.unit,
                testResult: null,
                purity: null,
                weight: null,
                notes: ''
            })),

            status: 'pending',
            testedBy: null,
            testedAt: null,
            approvedBy: null,
            approvedAt: null,
            result: null // approved, rejected
        };

        // Save to lab test register
        if (typeof LabTestRegister !== 'undefined' || true) { // Force save even if module not loaded yet
            const labTests = Storage.getLabTests();
            labTests.push(labTest);
            Storage.saveLabTests(labTests);
        }

        // Update GR
        gr.labTestId = labTest.id;
        gr.labTestStatus = 'pending';
        gr.status = 'lab_testing';
        this.saveReceipts();

        AuditLog.log('create', 'lab_test', labTest.id,
            `Created lab test for GR ${gr.grNumber}`);

        return { success: true, labTest };
    },

    approveLabTest(grId, approved, testResults) {
        const gr = this.getGR(grId);
        if (!gr) {
            return { success: false, errors: { gr: 'GR not found' } };
        }

        if (!gr.labTestRequired) {
            return { success: false, errors: { test: 'Lab test not required for this GR' } };
        }

        // Update lab test
        const labTests = Storage.getLabTests();
        const labTest = labTests.find(t => t.id === gr.labTestId);

        if (labTest) {
            labTest.status = approved ? 'approved' : 'rejected';
            labTest.result = approved ? 'approved' : 'rejected';
            labTest.approvedBy = Auth.getCurrentUser()?.id || 'System';
            labTest.approvedAt = new Date().toISOString();
            labTest.testResults = testResults;
            Storage.saveLabTests(labTests);
        }

        // Update GR
        gr.labTestStatus = approved ? 'approved' : 'rejected';
        gr.labTestResult = testResults;
        gr.status = approved ? 'lab_approved' : 'lab_rejected';

        if (approved) {
            // Move to permanent warehouse
            this.moveToPermanentWarehouse(grId);
        } else {
            // Handle rejection - return to supplier
            this.handleRejection(grId, testResults.rejectionReason);
        }

        this.saveReceipts();

        AuditLog.log('update', 'goods_receipt', grId,
            `Lab test ${approved ? 'approved' : 'rejected'} for GR ${gr.grNumber}`);

        return { success: true, gr };
    },

    async moveToPermanentWarehouse(grId, permanentWarehouseId = 'WH-001') {
        const gr = this.getGR(grId);
        if (!gr) {
            return { success: false, errors: { gr: 'GR not found' } };
        }

        // Remove from temporary warehouse
        await this.createStockMovement(gr, 'out', gr.warehouseId);

        // Add to permanent warehouse
        gr.warehouseId = permanentWarehouseId;
        gr.warehouseType = 'permanent';
        await this.createStockMovement(gr, 'in', permanentWarehouseId);

        this.saveReceipts();

        AuditLog.log('update', 'goods_receipt', grId,
            `Moved to permanent warehouse ${permanentWarehouseId}`);

        return { success: true, gr };
    },

    handleRejection(grId, reason) {
        const gr = this.getGR(grId);
        if (!gr) return;

        // Remove from temporary warehouse
        this.createStockMovement(gr, 'out', gr.warehouseId);

        // Create return to supplier record
        const returnRecord = {
            id: Date.now(),
            grId: gr.id,
            grNumber: gr.grNumber,
            poId: gr.poId,
            poNumber: gr.poNumber,
            supplierId: gr.supplierId,
            supplierName: gr.supplierName,
            returnDate: new Date().toISOString().split('T')[0],
            items: gr.items,
            reason: reason,
            status: 'pending_pickup',
            createdBy: Auth.getCurrentUser()?.id || 'System',
            createdAt: new Date().toISOString()
        };

        const returns = Storage.getSupplierReturns();
        returns.push(returnRecord);
        Storage.saveSupplierReturns(returns);

        AuditLog.log('create', 'supplier_return', returnRecord.id,
            `Created return for rejected GR ${gr.grNumber}`);
    },

    async createStockMovement(gr, type, warehouseId = null) {
        // Create stock card entries for TRACKING ONLY
        // NO journal entry at this stage (conservative approach)
        // Journal entry will be created by TTB module after approval

        const warehouse = warehouseId || gr.warehouseId;

        // Determine GL account for tracking purposes
        const glAccount = gr.warehouseType === 'temporary' ? '1152' : '1151';

        for (const item of gr.items) {
            // CRITICAL: await cloud save to prevent race condition with Firebase reload
            if (typeof WarehouseStock !== 'undefined') {
                try {
                    await WarehouseStock.updateStock(
                        warehouse,
                        item.itemCode,
                        type === 'in' ? item.receivedQty : -item.receivedQty,
                        item.unitPrice || 0,
                        gr.grNumber,
                        type === 'in' ? 'IN' : 'OUT',
                        gr.ownerId || 'COMPANY'
                    );
                } catch (e) {
                    console.error('Stock Update Error:', e);
                }
            }

            const movement = {
                date: new Date().toISOString().split('T')[0],
                itemId: item.itemId,
                itemCode: item.itemCode,
                itemName: item.itemName,
                warehouseId: warehouse,
                warehouseType: gr.warehouseType,
                type: type === 'in' ? 'receipt' : 'transfer_out',
                quantity: type === 'in' ? item.receivedQty : -item.receivedQty,
                unit: item.unit,
                unitPrice: item.unitPrice || 0,
                totalValue: (type === 'in' ? item.receivedQty : -item.receivedQty) * (item.unitPrice || 0),
                reference: gr.grNumber,
                glAccount: glAccount,
                ownerId: gr.ownerId || 'COMPANY',
                journalPosted: false, // Flag: journal not yet posted
                notes: `GR from ${gr.poNumber || 'Refinery'} - ${gr.warehouseType} warehouse (Owner: ${gr.ownerId || 'COMPANY'})`
            };

            // Add to legacy stock card for UI compatibility
            const stockCards = Storage.getStockCards();
            stockCards.push(movement);
            Storage.saveStockCards(stockCards);
        }
    },

    createTTB(grId) {
        const gr = this.getGR(grId);
        if (!gr) {
            return { success: false, errors: { gr: 'GR not found' } };
        }

        if (gr.status !== 'lab_approved' && !gr.labTestRequired) {
            return { success: false, errors: { status: 'GR must be lab approved or not require lab test' } };
        }

        // Create TTB (will be implemented in TTB module)
        const ttb = {
            id: Date.now(),
            ttbNumber: `TTB-${Date.now()}`,
            grId: gr.id,
            grNumber: gr.grNumber,
            poId: gr.poId,
            poNumber: gr.poNumber,
            date: new Date().toISOString().split('T')[0],
            items: gr.items,
            status: 'draft',
            createdBy: Auth.getCurrentUser()?.id || 'System',
            createdAt: new Date().toISOString()
        };

        // Save TTB
        const ttbs = Storage.getTTBs();
        ttbs.push(ttb);
        Storage.saveTTBs(ttbs);

        // Update GR
        gr.ttbId = ttb.id;
        gr.ttbNumber = ttb.ttbNumber;
        gr.status = 'ttb_created';
        this.saveReceipts();

        AuditLog.log('create', 'ttb', ttb.id,
            `Created TTB ${ttb.ttbNumber} from GR ${gr.grNumber}`);

        return { success: true, ttb };
    },

    getGR(id) {
        return this.receipts.find(g => g.id === id);
    },

    getGRByPO(poId) {
        return this.receipts.filter(g => g.poId === poId);
    },

    getGRsByStatus(status) {
        return this.receipts.filter(g => g.status === status);
    },

    getPendingLabTests() {
        return this.receipts.filter(g => g.status === 'lab_testing');
    },

    formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    },

    formatDate(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString('id-ID', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    },

    // Normalize possibly malformed/legacy GR number payloads so UI never prints [object Object]
    normalizeGRNumber(raw) {
        if (typeof raw === 'string') return raw;
        if (!raw) return '-';
        if (typeof raw === 'object') {
            return raw.grNumber || raw.number || raw.ref || raw.reference || raw.value || '-';
        }
        return String(raw);
    },

    getStatusBadgeClass(status) {
        const classes = {
            received: 'badge-info',
            lab_testing: 'badge-warning',
            lab_approved: 'badge-success',
            lab_rejected: 'badge-danger',
            ttb_created: 'badge-primary',
            completed: 'badge-success'
        };
        return classes[status] || 'badge-secondary';
    },

    render() {
        const content = document.getElementById('main-content');
        if (!content) return;

        content.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">📥 Penerimaan Barang (Goods Receipt)</h1>
                <p class="page-description">Kelola penerimaan barang dari Purchase Order</p>
            </div>

            <div class="card mb-3">
                <div class="card-header">
                    <h2 class="card-title">Daftar Penerimaan</h2>
                    <button class="btn btn-primary" onclick="GoodsReceipt.showCreateModal()">
                        ➕ Terima Barang (dari PO)
                    </button>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>No. Penerimaan</th>
                                <th>Tipe</th>
                                <th>Tanggal</th>
                                <th>Sumber / PO</th>
                                <th>No. Surat Jalan</th>
                                <th>Ownership</th>
                                <th>Lab Test</th>
                                <th>Status</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody id="gr-list-body">
                            ${this.renderReceiptList()}
                        </tbody>
                    </table>
                </div>
                </div>
            </div>

            <!-- Modal Create GR -->
            <div id="create-gr-modal" class="modal-overlay hidden">
                <div class="modal" style="max-width: 800px;">
                    <div class="modal-header">
                        <h3 class="modal-title">Penerimaan Barang Baru</h3>
                        <button class="modal-close" onclick="GoodsReceipt.closeCreateModal()">×</button>
                    </div>
                    <div class="modal-body">
                        <form id="gr-form">
                            <!-- Receipt Type Toggle -->
                            <div class="form-group mb-3">
                                <label class="form-label">Tipe Penerimaan</label>
                                <div class="btn-group" style="display: flex; gap: 10px;">
                                    <label class="flex align-center gap-1" style="cursor: pointer;">
                                        <input type="radio" name="receiptType" value="purchase" checked onchange="GoodsReceipt.toggleReceiptType('purchase')"> 
                                        <span>🛒 Pembelian (PO)</span>
                                    </label>
                                    <label class="flex align-center gap-1" style="cursor: pointer;">
                                        <input type="radio" name="receiptType" value="service" onchange="GoodsReceipt.toggleReceiptType('service')"> 
                                        <span>🛠️ Jasa Refinery (Ref)</span>
                                    </label>
                                </div>
                            </div>

                             <!-- Header Fields -->
                            <div class="grid grid-2 gap-2 mb-3">
                                <div class="form-group">
                                    <label class="form-label">No. Surat Jalan Supplier *</label>
                                    <input type="text" id="gr-supplier-ref" class="form-input" placeholder="Contoh: SJ-2024-001" required>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Nomor Seal / Segel</label>
                                    <input type="text" id="gr-seal-number" class="form-input" placeholder="Contoh: SEAL-9981">
                                </div>
                            </div>

                            <div class="grid grid-2 gap-2 mb-3">
                                <div class="form-group" id="po-selection-group">
                                    <label class="form-label">Pilih Purchase Order (Approved)</label>
                                    <select id="gr-po-select" class="form-select" onchange="GoodsReceipt.onPOSelect(this.value)">
                                        <option value="">-- Pilih PO --</option>
                                        ${this.getPOOptions()}
                                    </select>
                                </div>
                                 <div class="form-group hidden" id="customer-selection-group">
                                    <label class="form-label">Pilih Customer *</label>
                                    <select id="gr-customer-select" class="form-select" onchange="GoodsReceipt.onCustomerSelect(this.value)">
                                        <option value="">-- Pilih Customer --</option>
                                        ${this.getCustomerOptions()}
                                    </select>
                                </div>
                                <div class="form-group hidden" id="gr-swap-toggle-group">
                                    <label class="form-label">&nbsp;</label>
                                    <div class="flex align-center gap-2" style="background: var(--bg-tertiary); padding: 8px 12px; border-radius: 6px;">
                                        <input type="checkbox" id="gr-is-swap" onchange="GoodsReceipt.onSwapToggle(this.checked)" style="width: 20px; height: 20px;">
                                        <span style="font-weight: 600; color: var(--color-primary);">⚡ Instachange (Gold Swap)</span>
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Kondisi Fisik Paket</label>
                                    <select id="gr-physical-condition" class="form-select">
                                        <option value="baik">✅ Baik / Tersegel</option>
                                        <option value="rusak_ringan">⚠️ Rusak Ringan</option>
                                        <option value="terbuka">❌ Terbuka / Rusak Parah</option>
                                    </select>
                                </div>
                            </div>

                            <!-- NEW: Origin Information (COO) -->
                            <div class="card p-3 mb-3 bg-light" style="border-left: 4px solid var(--color-warning);">
                                <h4 style="margin-top: 0; color: var(--color-warning);">🌍 Sumber Asal Barang (Certificate of Origin)</h4>
                                <div class="form-group mb-2">
                                    <label class="form-label">Kategori Sumber *</label>
                                    <select id="gr-source-category" class="form-select" onchange="GoodsReceipt.toggleSourceFields(this.value)">
                                        <option value="">-- Pilih Kategori Sumber --</option>
                                        <option value="mining">⛏️ Tambang Rakyat (IPR)</option>
                                        <option value="scrap">♻️ Scrap / Recycle</option>
                                        <option value="import">✈️ Import / Luar Negeri</option>
                                        <option value="local">🏬 Toko / Lokal / Lainnya</option>
                                    </select>
                                </div>

                                <!-- Mining Fields -->
                                <div id="source-mining-fields" class="grid grid-2 gap-2 mt-2 hidden">
                                    <div class="form-group">
                                        <label class="form-label small">Nama Koperasi / KUD</label>
                                        <input type="text" id="gr-mining-cooperative" class="form-input" placeholder="Koperasi Pertambangan ...">
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label small">Nomor IPR (SK IPR)</label>
                                        <input type="text" id="gr-mining-ipr" class="form-input" placeholder="Contoh: 540/123/IPR/2023">
                                    </div>
                                    <div class="form-group" style="grid-column: span 2;">
                                        <label class="form-label small">Lokasi Tambang (Desa/Kec/Kab)</label>
                                        <input type="text" id="gr-mining-location" class="form-input" placeholder="Kec. Sekotong, Kab. Lombok Barat">
                                    </div>
                                </div>

                                <!-- Scrap Fields -->
                                <div id="source-scrap-fields" class="grid grid-2 gap-2 mt-2 hidden">
                                    <div class="form-group">
                                        <label class="form-label small">Asal / Supplier</label>
                                        <input type="text" id="gr-scrap-origin" class="form-input" placeholder="Toko Mas ...">
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label small">Jenis Scrap</label>
                                        <select id="gr-scrap-type" class="form-select">
                                            <option value="jewelry">💍 Perhiasan Bekas</option>
                                            <option value="electronic">💻 Elektronik/PCB</option>
                                            <option value="industrial">🏭 Industrial Scrap</option>
                                            <option value="dore">🧱 Dore Bullion (Custom)</option>
                                        </select>
                                    </div>
                                </div>

                                <!-- Import Fields -->
                                <div id="source-import-fields" class="grid grid-2 gap-2 mt-2 hidden">
                                    <div class="form-group">
                                        <label class="form-label small">Negara Asal (Country of Origin)</label>
                                        <input type="text" id="gr-import-country" class="form-input" placeholder="Contoh: Swiss / Australia">
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label small">Nama Exporter</label>
                                        <input type="text" id="gr-import-exporter" class="form-input" placeholder="Metalor / PAMP / etc">
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label small">No. COO Resmi / Manifest</label>
                                        <input type="text" id="gr-import-coo-no" class="form-input" placeholder="...">
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label small">Sertifikat Refinery (LBMA)</label>
                                        <input type="text" id="gr-import-refinery-cert" class="form-input" placeholder="LBMA Certified">
                                    </div>
                                </div>

                                <!-- Store / Local Fields -->
                                <div id="source-local-fields" class="grid grid-2 gap-2 mt-2 hidden">
                                    <div class="form-group">
                                        <label class="form-label small">Nama Toko / Supplier Lokal</label>
                                        <input type="text" id="gr-local-store" class="form-input" placeholder="Contoh: Toko Kimia ...">
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label small">Alamat / Lokasi Toko</label>
                                        <input type="text" id="gr-local-location" class="form-input" placeholder="Kota / Wilayah ...">
                                    </div>
                                </div>
                            </div>

                            <div id="gr-swap-details" class="card p-3 mb-3 bg-light hidden" style="border-left: 4px solid var(--color-primary);">
                                <h4 style="margin-top: 0;">⚡ Detail Gold Swap</h4>
                                <div class="grid grid-3 gap-2">
                                    <div class="form-group">
                                        <label class="form-label">Estimasi Kadar (%)</label>
                                        <input type="number" id="gr-swap-purity" class="form-input" placeholder="99.10" step="0.01" oninput="GoodsReceipt.calculateSwap()">
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">Berat Murni (g)</label>
                                        <input type="number" id="gr-swap-pure-weight" class="form-input" readonly style="background: #e9ecef;">
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">Swap Fee / Gram</label>
                                        <input type="number" id="gr-swap-fee" class="form-input" placeholder="10000" oninput="GoodsReceipt.calculateSwap()">
                                    </div>
                                </div>
                                <div class="mt-2 text-primary" id="gr-swap-summary" style="font-weight: 600;">
                                    Total Fee: Rp 0 | Sisa Stok Emas Murni: 0g
                                </div>
                            </div>

                            <div id="gr-items-container" class="mt-2">
                                <!-- Items will be populated here -->
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="GoodsReceipt.closeCreateModal()">Batal</button>
                        <button class="btn btn-primary" onclick="GoodsReceipt.submitGR()">Simpan Penerimaan</button>
                    </div>
                </div>
            </div>
        `;
    },

    renderReceiptList() {
        if (this.receipts.length === 0) {
            return '<tr><td colspan="9" class="text-center">Belum ada data penerimaan barang.</td></tr>';
        }

        const customers = Storage.get(Storage.KEYS.CUSTOMERS) || [];

        return this.receipts.map(gr => {
            const statusClass = gr.status === 'received' ? 'status-success' : 'status-warning';
            const labStatusClass = gr.labTestStatus === 'passed' ? 'text-success' : (gr.labTestStatus === 'failed' ? 'text-danger' : 'text-warning');
            const grNumber = this.normalizeGRNumber(gr.grNumber);

            let sourceLabel = gr.poNumber || '-';
            if (gr.receiptType === 'service') {
                const cust = customers.find(c => c.id === gr.customerId);
                sourceLabel = cust ? `👤 ${cust.name}` : `👤 ${gr.customerId}`;
            }

            return `
                <tr>
                    <td><strong>${grNumber}</strong></td>
                    <td>
                        <div class="flex flex-column gap-1">
                            <span class="badge ${gr.receiptType === 'service' ? 'bg-info' : 'bg-primary'}">${gr.receiptType === 'service' ? 'Service' : 'Purchase'}</span>
                            ${gr.isSwap ? '<span class="badge bg-warning" style="font-size: 0.7rem; color: #000;">⚡ SWAP</span>' : ''}
                        </div>
                    </td>
                    <td>${gr.receiptDate}</td>
                    <td>${sourceLabel}</td>
                    <td><code>${gr.supplierRef || '-'}</code></td>
                    <td><span class="badge ${gr.ownerId === 'COMPANY' ? 'badge-primary' : 'badge-warning'}">${gr.ownerId === 'COMPANY' ? 'COMPANY' : 'CUSTOMER'}</span></td>
                    <td class="${labStatusClass}">${gr.labTestStatus ? gr.labTestStatus.toUpperCase() : (gr.labTestRequired ? 'PENDING' : (gr.isSwap ? 'INSTANT' : 'N/A'))}</td>
                    <td><span class="status-badge ${statusClass}">${gr.status.toUpperCase()}</span></td>
                    <td>
                        <button class="btn btn-sm btn-outline" onclick="GoodsReceipt.viewDetail(${gr.id})">Detail</button>
                    </td>
                </tr>
            `;
        }).reverse().join('');
    },

    getPOOptions() {
        if (typeof PurchaseOrder === 'undefined') return '';
        const validPOs = PurchaseOrder.orders.filter(o => o.status === 'approved' || o.status === 'partially_received');
        return validPOs.map(po => `<option value="${po.id}">${po.poNumber} - ${po.supplierName} (${po.status})</option>`).join('');
    },

    getCustomerOptions() {
        const customers = Storage.get(Storage.KEYS.CUSTOMERS) || [];
        return customers.map(c => `<option value="${c.id}">${c.code} - ${c.name}</option>`).join('');
    },

    toggleReceiptType(type) {
        const poGroup = document.getElementById('po-selection-group');
        const custGroup = document.getElementById('customer-selection-group');
        const swapGroup = document.getElementById('gr-swap-toggle-group');
        const swapDetails = document.getElementById('gr-swap-details');
        const container = document.getElementById('gr-items-container');

        container.innerHTML = '';
        document.getElementById('gr-is-swap').checked = false;
        swapDetails.classList.add('hidden');

        if (type === 'purchase') {
            poGroup.classList.remove('hidden');
            custGroup.classList.add('hidden');
            swapGroup.classList.add('hidden');
        } else {
            poGroup.classList.add('hidden');
            custGroup.classList.remove('hidden');
            swapGroup.classList.remove('hidden');
            this.renderServiceItems();
        }
    },

    onSwapToggle(isSwap) {
        const details = document.getElementById('gr-swap-details');
        if (isSwap) {
            details.classList.remove('hidden');
            this.calculateSwap();
        } else {
            details.classList.add('hidden');
        }
    },

    calculateSwap() {
        const qty = parseFloat(document.querySelector('.gr-item-qty')?.value) || 0;
        const purity = parseFloat(document.getElementById('gr-swap-purity').value) || 0;
        const fee = parseFloat(document.getElementById('gr-swap-fee').value) || 0;

        const pureWeight = (qty * purity / 100);
        document.getElementById('gr-swap-pure-weight').value = pureWeight.toFixed(2);

        const totalFee = pureWeight * fee;

        // Get available stock for Fine Gold (GOLD-BAR-24K)
        let fineStock = 0;
        if (typeof WarehouseStock !== 'undefined') {
            const stock = WarehouseStock.getStock('FG-01', 'GOLD-BAR-24K', 'COMPANY');
            fineStock = stock.quantity;
        }

        const summary = document.getElementById('gr-swap-summary');
        summary.innerHTML = `
            Est. Total Fee: <strong>${this.formatCurrency(totalFee)}</strong> | 
            Ready Stock (99.99): <strong class="${fineStock < pureWeight ? 'text-danger' : 'text-success'}">${fineStock}g</strong>
            ${fineStock < pureWeight ? '<br><small class="text-danger">⚠️ Stok tidak cukup untuk swap instant. Akan dicatat sebagai "Gold Debt".</small>' : ''}
        `;
    },

    renderServiceItems() {
        const container = document.getElementById('gr-items-container');
        const items = (Storage.get(Storage.KEYS.ITEMS) || []).filter(i => i.category === 'raw_material' || i.category === 'gold');

        container.innerHTML = `
            <h4>Material Jasa Titipan</h4>
            <div class="card p-2 bg-light">
                <table class="table table-sm">
                    <thead>
                        <tr>
                            <th>Item / Material</th>
                            <th class="text-right" style="width: 150px;">Berat Fisik (g)</th>
                            <th>Keterangan</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>
                                <select class="form-select gr-item-select" data-row="0">
                                    <option value="">-- Pilih Material --</option>
                                    ${items.map(i => `<option value="${i.id}" data-code="${i.code}" data-name="${i.name}" data-unit="${i.uom || 'g'}">${i.code} - ${i.name}</option>`).join('')}
                                </select>
                            </td>
                            <td>
                                <input type="number" class="form-input gr-item-qty" placeholder="0.00" step="0.01" oninput="GoodsReceipt.calculateSwap()">
                            </td>
                            <td>
                                <input type="text" class="form-input gr-item-notes" placeholder="e.g. Kondisi kotor">
                            </td>
                        </tr>
                    </tbody>
                </table>
                <p class="small text-gray mt-2">* Penerimaan Jasa akan diproses melalui Lab untuk menentukan kadar murni.</p>
            </div>
        `;
    },

    showCreateModal() {
        const modal = document.getElementById('create-gr-modal');
        if (modal) {
            modal.classList.remove('hidden');
            document.getElementById('gr-items-container').innerHTML = '';
            document.getElementById('gr-po-select').value = '';
        }
    },

    closeCreateModal() {
        const modal = document.getElementById('create-gr-modal');
        if (modal) modal.classList.add('hidden');
    },

    onPOSelect(poId) {
        if (!poId) return;
        const po = PurchaseOrder.getOrder(parseInt(poId));
        if (!po) return;

        // Calculate already received quantities for this PO
        const previousReceipts = this.getGRByPO(po.id);
        const receivedSummary = {};
        previousReceipts.forEach(gr => {
            gr.items.forEach(item => {
                receivedSummary[item.itemId] = (receivedSummary[item.itemId] || 0) + item.receivedQty;
            });
        });

        // NEW: Auto-fill Origin from Supplier KYC
        const supplier = (Storage.getSuppliers() || []).find(s => s.id === po.supplierId || s.code === po.supplier);
        if (supplier) {
            this.fillOriginFromKYC(supplier);
        }

        const container = document.getElementById('gr-items-container');
        container.innerHTML = `
            <table class="table table-sm">
                <thead>
                    <tr>
                        <th>Item</th>
                        <th class="text-right">Qty PO</th>
                        <th class="text-right">Sdh Diterima</th>
                        <th class="text-right">Qty Sisa</th>
                        <th class="text-right" style="width: 120px;">Qty Terima Baru</th>
                        <th>Satuan</th>
                    </tr>
                </thead>
                <tbody>
                    ${po.items.map(item => {
            const sdhDiterima = receivedSummary[item.itemId] || 0;
            const qtySisa = Math.max(0, item.quantity - sdhDiterima);

            // Try to recover unit from Master Item if missing in PO
            let unit = item.unit;
            if (!unit || unit === 'undefined' || unit === 'null') {
                const masterItems = Storage.get(Storage.KEYS.ITEMS) || [];
                const masterItem = masterItems.find(i => i.id === item.itemId);
                unit = masterItem ? (masterItem.uom || masterItem.unit || '-') : '-';
            }
            // Final safety check to ensure we never display "undefined"
            if (unit === 'undefined' || unit === 'null') unit = '-';

            // Fix name duplication
            // Ensure we don't duplicate code if it's already in the name
            const code = (item.itemCode || '').trim();
            const name = (item.itemName || '').trim();
            const displayName = (code && name !== code && !name.startsWith(code))
                ? `${code} - ${name}`
                : name;

            return `
                            <tr>
                                <td>${displayName}</td>
                                <td class="text-right">${item.quantity}</td>
                                <td class="text-right">${sdhDiterima}</td>
                                <td class="text-right"><strong>${qtySisa}</strong></td>
                                <td class="text-right">
                                    <input type="number" class="form-input gr-item-qty" 
                                           data-item-id="${item.itemId}" 
                                           data-item-code="${item.itemCode}"
                                           data-item-name="${item.itemName}"
                                           data-unit="${unit}"
                                           value="${qtySisa}" max="${qtySisa}" step="0.01"
                                           onchange="if(parseFloat(this.value) > ${qtySisa}) { alert('Melebihi sisa PO!'); this.value = ${qtySisa}; }">
                                </td>
                                <td>${unit}</td>
                            </tr>
                        `;
        }).join('')}
                </tbody>
            </table>
            <div class="form-group mt-2">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--color-error); font-weight: 600;">
                    <input type="checkbox" id="gr-short-close" style="width: 18px; height: 18px;">
                    Short-Close PO (Tutup PO meskipun kiriman belum lengkap)
                </label>
                <p class="text-gray" style="font-size: 0.85rem; margin-top: 4px; margin-left: 26px;">
                    Centang ini jika supplier tidak akan mengirim sisa barang lagi karena fluktuasi harga atau hal lainnya.
                </p>
            </div>
        `;
    },

    async submitGR() {
        const type = document.querySelector('input[name="receiptType"]:checked').value;
        const supplierRef = document.getElementById('gr-supplier-ref').value;
        const sealNumber = document.getElementById('gr-seal-number').value;
        const physicalCondition = document.getElementById('gr-physical-condition').value;

        if (!supplierRef) {
            alert('Harap isi Nomor Surat Jalan / Ref Supplier');
            return;
        }

        let poId = null;
        let customerId = null;
        let ownerId = 'COMPANY';
        const items = [];

        if (type === 'purchase') {
            poId = parseInt(document.getElementById('gr-po-select').value);
            if (!poId) {
                alert('Pilih PO terlebih dahulu');
                return;
            }

            document.querySelectorAll('.gr-item-qty').forEach(input => {
                const qty = parseFloat(input.value) || 0;
                if (qty > 0) {
                    items.push({
                        itemId: input.dataset.itemId,
                        itemCode: input.dataset.itemCode,
                        itemName: input.dataset.itemName,
                        unit: input.dataset.unit,
                        receivedQty: qty
                    });
                }
            });
        } else {
            customerId = document.getElementById('gr-customer-select').value;
            if (!customerId) {
                alert('Pilih Customer terlebih dahulu');
                return;
            }
            ownerId = customerId;

            const select = document.querySelector('.gr-item-select');
            const qtyInput = document.querySelector('.gr-item-qty');
            const notesInput = document.querySelector('.gr-item-notes');

            const option = select.options[select.selectedIndex];
            if (!option.value || !parseFloat(qtyInput.value)) {
                alert('Harap pilih barang dan isi berat fisik');
                return;
            }

            items.push({
                itemId: option.value,
                itemCode: option.dataset.code,
                itemName: option.dataset.name,
                unit: option.dataset.unit,
                receivedQty: parseFloat(qtyInput.value),
                notes: notesInput.value
            });
        }

        if (items.length === 0) {
            alert('Minimal satu barang harus diterima dengan jumlah > 0');
            return;
        }

        const isSwap = document.getElementById('gr-is-swap')?.checked;
        const purity = parseFloat(document.getElementById('gr-swap-purity')?.value) || 0;
        const swapFeePerGram = parseFloat(document.getElementById('gr-swap-fee')?.value) || 0;

        const resolvedGRNumber = await this.generateGRNumber();
        let poNumber = null;
        let supplierId = null;
        let supplierName = null;
        if (type === 'purchase' && poId) {
            const po = PurchaseOrder.getOrder(poId);
            if (po) {
                poNumber = po.poNumber || null;
                supplierId = po.supplier || po.supplierId || null;
                supplierName = po.supplierName || null;
            }
        }

        // Create GR Result
        const gr = {
            id: Date.now(),
            grNumber: resolvedGRNumber,
            receiptType: type,
            supplierRef: supplierRef,
            sealNumber: sealNumber,
            physicalCondition: physicalCondition,
            poId: poId,
            poNumber: poNumber,
            supplierId: supplierId,
            supplierName: supplierName,
            customerId: customerId,
            ownerId: ownerId,
            receiptDate: new Date().toISOString().split('T')[0],
            items: items,
            status: 'received',
            warehouseId: 'LAB-01',
            warehouseType: 'temporary',
            isSwap: isSwap,
            swapPurity: purity,
            swapFeePerGram: swapFeePerGram,
            createdByName: Auth.getCurrentUser()?.name || 'System',

            // NEW: Origin Data Persistence
            originData: {
                category: document.getElementById('gr-source-category').value,
                mining: {
                    cooperative: document.getElementById('gr-mining-cooperative').value,
                    ipr: document.getElementById('gr-mining-ipr').value,
                    location: document.getElementById('gr-mining-location').value
                },
                scrap: {
                    origin: document.getElementById('gr-scrap-origin').value,
                    type: document.getElementById('gr-scrap-type').value
                },
                import: {
                    country: document.getElementById('gr-import-country').value,
                    exporter: document.getElementById('gr-import-exporter').value,
                    cooNo: document.getElementById('gr-import-coo-no').value,
                    refineryCert: document.getElementById('gr-import-refinery-cert').value
                },
                local: {
                    store: document.getElementById('gr-local-store').value,
                    location: document.getElementById('gr-local-location').value
                }
            }
        };

        // --- Execute Movements ---

        if (isSwap) {
            // SWAP FLOW: Off-Balance Sheet
            const rawItem = items[0];
            const pureWeight = parseFloat((rawItem.receivedQty * purity / 100).toFixed(2));

            // 1. Receive Raw Gold from Customer
            await this.createStockMovement(gr, 'in', 'PROD-01'); // Directly to production for swap

            // 2. Release Fine Gold to Customer (Partial if stock insufficient)
            let releasedQty = 0;
            if (typeof WarehouseStock !== 'undefined') {
                try {
                    const fineStock = WarehouseStock.getStock('FG-01', 'GOLD-BAR-24K', 'COMPANY');
                    releasedQty = Math.min(pureWeight, fineStock.quantity > 0 ? fineStock.quantity : 0);

                    if (releasedQty < pureWeight) {
                        console.warn(`⚠️ Only ${releasedQty}g available for swap. Remaining ${pureWeight - releasedQty}g will be 'Refinery Debt'.`);
                    }

                    if (releasedQty > 0) {
                        // Out from Company Stock
                        await WarehouseStock.updateStock(
                            'FG-01',
                            'GOLD-BAR-24K',
                            releasedQty,
                            0,
                            gr.grNumber,
                            'OUT',
                            'COMPANY'
                        );

                        // Log that customer took this amount
                        WarehouseStock.logMovement(
                            'FG-01',
                            'GOLD-BAR-24K',
                            releasedQty,
                            0,
                            'OUT',
                            gr.grNumber,
                            customerId
                        );
                    }
                } catch (e) {
                    console.error('Swap Stock Movement Error:', e);
                    alert('Gagal melakukan movement stock: ' + e.message);
                    return;
                }
            }

            gr.swapReleasedQty = releasedQty;
            gr.swapPendingQty = pureWeight - releasedQty;

            // 3. Automated Journal Entry for Fee (Tax Efficient)
            this.createSwapJournal(gr, pureWeight, swapFeePerGram);

        } else {
            // STANDARD FLOW (Purchase or Regular Service)
            await this.createStockMovement(gr, 'in');
        }

        // NEW: Update average cost if COMPANY owned (Purchase only)
        if (gr.ownerId === 'COMPANY' && type === 'purchase') {
            const po = PurchaseOrder.getOrder(poId);
            gr.items.forEach(item => {
                const poItem = po.items.find(i => i.itemId === item.itemId);
                const transaction = {
                    type: 'IN',
                    itemCode: item.itemCode,
                    quantity: item.receivedQty,
                    unitCost: poItem ? poItem.unitPrice : 0,
                    date: gr.receiptDate,
                    warehouse: gr.warehouseId,
                    sourceDocument: 'GR',
                    sourceDocumentId: gr.id,
                    sourceDocumentNumber: gr.grNumber
                };
                InventoryValuation.updateItemCost(item.itemCode, transaction);
            });
        }

        // --- Rest of logic ---
        // Handle PO update...
        if (type === 'purchase') {
            const isShortClose = document.getElementById('gr-short-close')?.checked;
            const po = PurchaseOrder.getOrder(poId);
            const allReceipts = this.getGRByPO(poId);

            const totalRequired = po.items.reduce((sum, item) => sum + item.quantity, 0);
            const totalReceivedSoFar = allReceipts.reduce((sum, currentGr) => {
                return sum + currentGr.items.reduce((iSum, item) => iSum + (item.receivedQty || 0), 0);
            }, 0) + items.reduce((sum, item) => sum + item.receivedQty, 0);

            let newPOStatus = 'received';
            if (!isShortClose && totalReceivedSoFar < totalRequired) {
                newPOStatus = 'partially_received';
            }
            PurchaseOrder.updateOrder(poId, { status: newPOStatus });

            // Semi-automatic FA tracking:
            // If PO lines map to asset accounts (12xx), auto-create draft assets.
            if (typeof FixedAssets !== 'undefined' && typeof FixedAssets.createDraftsFromGoodsReceipt === 'function') {
                try {
                    const draftResult = await FixedAssets.createDraftsFromGoodsReceipt(gr, po);
                    if (draftResult?.success && draftResult.created > 0) {
                        console.log(`🏢 [GR->FA] Created ${draftResult.created} draft asset(s) from ${po.poNumber}/${gr.grNumber}.`);
                        if (typeof App !== 'undefined' && typeof App.showAlert === 'function') {
                            App.showAlert('success', `Draft Fixed Asset otomatis dibuat: ${draftResult.created} item (PO ${po.poNumber}).`);
                        }
                    }
                } catch (assetDraftErr) {
                    console.warn('⚠️ [GR->FA] Auto draft asset creation failed:', assetDraftErr);
                }
            }
        }

        // Automatically create Job Order for Refinery
        if (type === 'service' && typeof JobOrder !== 'undefined') {
            const pureWeight = isSwap ? parseFloat((items[0].receivedQty * purity / 100).toFixed(2)) : 0;
            const jobOrderData = {
                customerId: customerId,
                customerName: document.getElementById('gr-customer-select').options[document.getElementById('gr-customer-select').selectedIndex].text.split(' - ')[1],
                input: {
                    receiptDate: gr.receiptDate,
                    grossWeight: items[0].receivedQty,
                    purity: isSwap ? purity : 0,
                    type: isSwap ? 'INSTACHANGE' : 'REGULAR',
                    isSwap: isSwap,
                    swapReleasedQty: isSwap ? gr.swapReleasedQty : 0,
                    swapPendingQty: isSwap ? (pureWeight - gr.swapReleasedQty) : 0
                }
            };
            const joResult = JobOrder.createJobOrder(jobOrderData);
            if (joResult.success) {
                gr.jobOrderId = joResult.jobOrder.id;
                gr.jobOrderNumber = joResult.jobOrder.jobOrderNumber;
            }
        }

        this.receipts.push(gr);
        this.saveReceipts();

        // Trigger Lab Test automatically (Skip ONLY if Instachange Swap is confirmed/trusted)
        if (!isSwap && this.requiresLabTest(items)) {
            this.createLabTest(gr.id);
        }

        this.closeCreateModal();
        this.render();
        alert(`Penerimaan (${isSwap ? 'SWAP' : type}) berhasil disimpan: ${gr.grNumber}`);
    },

    async createSwapJournal(gr, pureWeight, feePerGram) {
        if (typeof JournalEntry === 'undefined') return;

        const totalFee = pureWeight * feePerGram;
        const ppn = totalFee * 0.11;
        const totalInvoice = totalFee + ppn;

        const entry = {
            id: `JV-${Date.now()}`,
            date: gr.receiptDate,
            referenceNumber: gr.grNumber,
            description: `Revenue for Refinery Swap - ${gr.grNumber} (${gr.customerId})`,
            lines: [
                { accountCode: '1130', accountName: 'Piutang Usaha', debit: totalInvoice, credit: 0 },
                { accountCode: '4110', accountName: 'Pendapatan Jasa Makloon', debit: 0, credit: totalFee },
                { accountCode: '2130', accountName: 'PPN Keluaran', debit: 0, credit: ppn }
            ],
            status: 'posted',
            createdBy: Auth.getCurrentUser()?.id || 'system',
            createdAt: new Date().toISOString()
        };

        // Save Journal
        const journals = Storage.get(Storage.KEYS.JOURNAL_ENTRIES) || [];
        journals.push(entry);
        await Storage.set(Storage.KEYS.JOURNAL_ENTRIES, journals);
    },

    viewDetail(id) {
        const gr = this.getGR(id);
        if (!gr) return;
        const grNumber = this.normalizeGRNumber(gr.grNumber);

        const customers = Storage.get(Storage.KEYS.CUSTOMERS) || [];
        const cust = customers.find(c => c.id === gr.customerId);

        const modal = document.createElement('div');
        modal.id = 'gr-detail-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal" style="max-width: 700px;">
                <div class="modal-header">
                    <h3 class="modal-title">Detail Penerimaan: ${grNumber}</h3>
                    <button class="modal-close" onclick="document.getElementById('gr-detail-modal').remove()">×</button>
                </div>
                <div class="modal-body">
                    <div class="grid grid-2 gap-2 mb-3">
                        <div class="card p-2 bg-light">
                            <p class="mb-1 text-gray small uppercase bold">Informasi Dasar</p>
                            <p><strong>Tipe:</strong> ${gr.receiptType.toUpperCase()}</p>
                            <p><strong>Tanggal:</strong> ${this.formatDate(gr.receiptDate)}</p>
                            <p><strong>Status:</strong> ${this.getStatusBadgeClass(gr.status).toUpperCase()}</p>
                        </div>
                        <div class="card p-2 bg-light">
                            <p class="mb-1 text-gray small uppercase bold">Sumber / Kepemilikan</p>
                            <p><strong>Customer:</strong> ${cust ? cust.name : (gr.customerId || 'COMPANY')}</p>
                            <p><strong>Ownership:</strong> ${gr.ownerId}</p>
                            <p><strong>No. Ref:</strong> ${gr.supplierRef || '-'}</p>
                        </div>
                    </div>

                    ${gr.isSwap ? `
                    <div class="card p-2 mb-3" style="border-left: 4px solid var(--color-primary); background: #f0f7ff;">
                        <h4 style="margin-top: 0; color: var(--color-primary);">⚡ Gold Swap (Instachange)</h4>
                        <div class="grid grid-3 gap-2">
                            <div>
                                <span class="small text-gray">Kadar Estimasi:</span><br>
                                <strong>${gr.swapPurity}%</strong>
                            </div>
                            <div>
                                <span class="small text-gray">Berat Murni:</span><br>
                                <strong>${gr.items[0].receivedQty * gr.swapPurity / 100}g</strong>
                            </div>
                            <div>
                                <span class="small text-gray">Swap Fee/g:</span><br>
                                <strong>${this.formatCurrency(gr.swapFeePerGram)}</strong>
                            </div>
                        </div>
                        <div class="grid grid-2 gap-2 mt-2 pt-2" style="border-top: 1px dashed #ccc;">
                            <div>
                                <span class="small text-gray">Fisik Dilepas:</span><br>
                                <strong class="text-success">${gr.swapReleasedQty || 0}g</strong>
                            </div>
                            <div>
                                <span class="small text-gray">Pending (Hutang):</span><br>
                                <strong class="${gr.swapPendingQty > 0 ? 'text-danger' : ''}">${gr.swapPendingQty || 0}g</strong>
                            </div>
                        </div>
                    </div>
                    ` : ''}

                    <table class="table">
                        <thead>
                            <tr>
                                <th>Item</th>
                                <th class="text-right">Qty</th>
                                <th>Satuan</th>
                                <th>Notes</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${gr.items.map(item => `
                                <tr>
                                    <td>${item.itemCode} - ${item.itemName}</td>
                                    <td class="text-right">${item.receivedQty}</td>
                                    <td>${item.unit}</td>
                                    <td>${item.notes || '-'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>

                    ${gr.jobOrderNumber ? `
                        <div class="mt-3 p-2 bg-tertiary rounded text-center">
                            Terhubung ke Job Order: <strong class="text-primary">${gr.jobOrderNumber}</strong>
                        </div>
                    ` : ''}
                </div>
            <div class="modal-footer" style="display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap;">
                <div style="flex-grow: 1; display: flex; gap: 8px;">
                    ${gr.originData && gr.originData.category ? `
                        <button class="btn btn-info" onclick="GoodsReceipt.generateCOO('${gr.id}')">
                            📜 Print COO Statement
                        </button>
                    ` : ''}
                </div>
                <button class="btn btn-secondary" onclick="document.getElementById('gr-detail-modal').remove()">Tutup</button>
                ${gr.status === 'received' ? `<button class="btn btn-primary" onclick="GoodsReceipt.startLabProcess('${gr.id}')">🔬 Proses Lebih Lanjut (Lab)</button>` : ''}
                ${gr.status === 'lab_testing' ? `<button class="btn btn-warning" disabled>⏳ Menunggu Hasil Lab...</button>` : ''}
                ${gr.status === 'lab_approved' ? `<button class="btn btn-success" onclick="GoodsReceipt.createTTB('${gr.id}')">📋 Buat TTB</button>` : ''}
            </div>
        </div>
    `;
        document.body.appendChild(modal);
    },

    // New function to start lab process from detail modal
    startLabProcess(grId) {
        // Convert to number since ID is stored as number (Date.now())
        const numericId = parseInt(grId) || grId;
        const result = this.createLabTest(numericId);
        if (result.success) {
            // Close the detail modal
            document.getElementById('gr-detail-modal')?.remove();

            // Refresh the list
            this.render();

            alert(`Lab test berhasil dibuat: ${result.labTest.testNumber}\n\nStatus GR diubah ke "Lab Testing".`);
        } else {
            alert('Gagal membuat lab test: ' + JSON.stringify(result.errors));
        }
    },

    toggleSourceFields(category) {
        // Hide all first
        ['mining', 'scrap', 'import', 'local'].forEach(cat => {
            const el = document.getElementById(`source-${cat}-fields`);
            if (el) el.classList.add('hidden');
        });

        // Show selected
        if (category) {
            const el = document.getElementById(`source-${category}-fields`);
            if (el) el.classList.remove('hidden');
        }
    },

    generateCOO(id) {
        const gr = this.getGR(parseInt(id));
        if (!gr) return;

        const config = Storage.get(Storage.KEYS.CONFIG) || {};
        if (typeof PDFExporter !== 'undefined' && typeof PDFExporter.exportCOO === 'function') {
            PDFExporter.exportCOO(gr, config);
        } else {
            alert('PDF Exporter Module (COO function) is not ready.');
        }
    },

    onCustomerSelect(customerId) {
        if (!customerId) return;
        this.renderServiceItems();
        
        // Auto-fill Origin from Customer KYC
        const customers = Storage.get(Storage.KEYS.CUSTOMERS) || [];
        const customer = customers.find(c => c.id === customerId || c.id == customerId);
        if (customer) {
            this.fillOriginFromKYC(customer);
        }
    },

    fillOriginFromKYC(profile) {
        if (!profile) return;
        
        const categorySelect = document.getElementById('gr-source-category');
        if (!categorySelect) return;

        const category = profile.sourceCategory || '';
        categorySelect.value = category;
        this.toggleSourceFields(category);

        if (category === 'mining') {
            document.getElementById('gr-mining-cooperative').value = profile.mining?.cooperative || '';
            document.getElementById('gr-mining-ipr').value = profile.mining?.ipr || '';
            document.getElementById('gr-mining-location').value = profile.mining?.location || '';
        } else if (category === 'scrap') {
            document.getElementById('gr-scrap-origin').value = profile.scrap?.origin || profile.name || '';
            document.getElementById('gr-scrap-type').value = profile.scrap?.type || 'jewelry';
        } else if (category === 'import') {
            document.getElementById('gr-import-country').value = profile.import?.country || '';
            document.getElementById('gr-import-exporter').value = profile.import?.exporter || '';
            document.getElementById('gr-import-coo-no').value = profile.import?.cooNo || '';
            document.getElementById('gr-import-refinery-cert').value = profile.import?.refineryCert || '';
        }
    }
};



// Explicitly make GoodsReceipt globally available
window.GoodsReceipt = GoodsReceipt;
