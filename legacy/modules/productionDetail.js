// ==========================================
// Production Detail & Movement Tracking
// Track batch through production stages
// ==========================================

const ProductionDetail = {
    currentOrder: null,
    bom: null,
    movements: [],

    init(order) {
        if (!Auth.isAuthenticated()) {
            window.location.href = 'login.html';
            return;
        }

        this.currentOrder = order;
        this.loadBOM();
        this.loadMovements();
        this.render();
    },

    loadBOM() {
        // Load BOM from BOMManagement storage
        this.bom = BOMManagement.getBOMByProduct(this.currentOrder.productCode) ||
            BOMManagement.getAllBOMs().find(b => b.bomId === this.currentOrder.bomId);
    },

    loadMovements() {
        this.movements = this.currentOrder.movements || [];
    },

    render() {
        const content = document.getElementById('main-content');
        content.innerHTML = `
            <div class="page-header">
                <button class="btn btn-secondary" onclick="App.navigateTo('production-order')">
                    ← Back to Production Orders
                </button>
                <h1 class="page-title">🏭 Production Detail: ${this.currentOrder.batchNumber}</h1>
            </div>

            <div class="card mb-3">
                <div class="card-header">
                    <h2 class="card-title">Order Information</h2>
                </div>
                <div class="card-body">
                    ${this.renderOrderInfo()}
                </div>
            </div>

            <div class="card mb-3">
                <div class="card-header">
                    <h2 class="card-title">Production Progress</h2>
                </div>
                <div class="card-body">
                    ${this.renderStageTimeline()}
                </div>
            </div>

            ${this.currentOrder.status !== 'COMPLETED' && this.currentOrder.status !== 'CANCELLED' ? `
                <div class="card mb-3">
                    <div class="card-header">
                        <h2 class="card-title">Record Production Movement</h2>
                    </div>
                    <div class="card-body">
                        ${this.renderMovementForm()}
                    </div>
                </div>
            ` : ''}

            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">Movement History (${this.movements.length})</h2>
                </div>
                <div class="card-body">
                    ${this.renderMovementHistory()}
                </div>
            </div>
        `;
    },

    renderOrderInfo() {
        return `
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
                <div>
                    <strong>Order Number:</strong><br>
                    ${this.currentOrder.orderNumber}
                </div>
                <div>
                    <strong>Batch Number:</strong><br>
                    <span class="badge badge-info">${this.currentOrder.batchNumber}</span>
                </div>
                <div>
                    <strong>Status:</strong><br>
                    <span class="badge badge-primary">${this.currentOrder.status}</span>
                </div>
                <div>
                    <strong>Product:</strong><br>
                    ${this.currentOrder.productName}
                </div>
                <div>
                    <strong>Quantity:</strong><br>
                    ${this.currentOrder.quantity}g
                </div>
                <div>
                    <strong>Current Stage:</strong><br>
                    <span class="badge badge-secondary">${this.currentOrder.currentStage || 'NOT STARTED'}</span>
                </div>
                <div>
                    <strong>Start Date:</strong><br>
                    ${new Date(this.currentOrder.startDate).toLocaleDateString('id-ID')}
                </div>
                <div>
                    <strong>Target Date:</strong><br>
                    ${new Date(this.currentOrder.targetCompletionDate).toLocaleDateString('id-ID')}
                </div>
                <div>
                    <strong>Total Cost:</strong><br>
                    ${this.formatCurrency(this.currentOrder.totalCost || 0)}
                </div>
            </div>
        `;
    },

    renderStageTimeline() {
        if (!this.bom) return '<p class="text-gray">BOM not found</p>';

        const stages = this.bom.stages;
        const currentStageIndex = this.currentOrder.currentStage ?
            stages.indexOf(this.currentOrder.currentStage) : -1;

        return `
            <div style="display: flex; justify-content: space-between; align-items: center; position: relative; padding: 20px 0;">
                ${stages.map((stage, index) => {
            const isCompleted = index < currentStageIndex;
            const isCurrent = index === currentStageIndex;
            const isPending = index > currentStageIndex;

            return `
                        <div style="flex: 1; text-align: center; position: relative;">
                            <div style="width: 50px; height: 50px; margin: 0 auto; border-radius: 50%; 
                                background: ${isCompleted ? '#4caf50' : isCurrent ? '#2196f3' : '#e0e0e0'};
                                color: white; display: flex; align-items: center; justify-content: center;
                                font-weight: bold; font-size: 20px;">
                                ${isCompleted ? '✓' : index + 1}
                            </div>
                            <div style="margin-top: 8px; font-size: 13px; font-weight: bold;">
                                ${stage}
                            </div>
                            ${index < stages.length - 1 ? `
                                <div style="position: absolute; top: 25px; left: 60%; width: 80%; height: 2px; 
                                    background: ${isCompleted ? '#4caf50' : '#e0e0e0'};"></div>
                            ` : ''}
                        </div>
                    `;
        }).join('')}
            </div>
        `;
    },

    renderMovementForm() {
        const nextStage = this.getNextStage();
        if (!nextStage) {
            return '<p class="text-center text-gray">Production completed or cancelled</p>';
        }

        return `
            <form onsubmit="ProductionDetail.recordMovement(event)">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Stage</label>
                        <input type="text" class="form-input" value="${nextStage}" readonly>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Input Weight (g)</label>
                        <input type="number" class="form-input" name="inputWeight" step="0.01" required
                               value="${this.getLastOutputWeight()}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Output Weight (g) *</label>
                        <input type="number" class="form-input" name="outputWeight" step="0.01" required
                               onchange="ProductionDetail.calculateLoss(this.value)">
                    </div>
                </div>

                <!-- Operator Selection -->
                <div class="form-group mb-3">
                    <label class="form-label required">Operators / Team for this Stage</label>
                    <div id="movement-operators" class="card p-2" style="max-height: 150px; overflow-y: auto; border: 1px solid var(--border-color); background: var(--bg-secondary);">
                        ${this.renderOperatorCheckboxes()}
                    </div>
                    <small class="text-gray">Select all operators who worked on this specific production stage.</small>
                </div>

                <div id="loss-display" style="margin: 16px 0; padding: 12px; background: var(--bg-tertiary); border-radius: 4px; display: none;">
                    <!-- Loss calculation will appear here -->
                </div>

                ${nextStage === 'CASTING' ? `
                    <div id="casting-sn-section" style="margin: 16px 0; padding: 16px; background: var(--bg-tertiary); border-radius: 8px; border-left: 4px solid #2196f3;">
                        <h4 style="margin: 0 0 12px 0;">🆔 Casting Session: Pre-assign SNs</h4>
                        <div class="form-row mt-2">
                            <div class="form-group">
                                <label class="form-label">Number of Molds / Cavities</label>
                                <input type="number" id="mold-count" name="moldCount" class="form-input" min="1" value="1" 
                                       onchange="ProductionDetail.generateSNPreview(this.value)">
                            </div>
                            <div class="form-group" style="display: flex; align-items: flex-end;">
                                <button type="button" class="btn btn-secondary" onclick="ProductionDetail.printCastingLabels()">
                                    🖨️ Print Mold Labels
                                </button>
                            </div>
                        </div>
                        <div id="slab-mold-inputs" style="margin-top: 16px;">
                            ${this.renderMoldIDInputs(1)}
                        </div>
                        <div id="sn-preview-list" class="mt-2 small text-primary" style="font-family: monospace;">
                            <!-- SN Previews -->
                        </div>
                    </div>
                ` : ''}

                ${this.isLastStage(nextStage) ? `
                    <div id="qc-weight-section" style="margin: 16px 0; padding: 16px; background: var(--bg-tertiary); border-radius: 8px; border-left: 4px solid #4caf50;">
                        <h4 style="margin: 0 0 12px 0;">⚖️ QC & Final Weight Recording</h4>
                        <p class="small text-gray mb-2">Assign actual weight and status to each Serial Number generated at Casting.</p>
                        <div id="qc-slab-list">
                            ${this.renderQCSlabInputs()}
                        </div>
                    </div>
                ` : ''}

                <!-- DAY 4: Gold Dust Recovery Section -->
                <div style="margin: 16px 0; padding: 16px; background: var(--bg-tertiary); border-radius: 8px; border-left: 4px solid #ffc107;">
                    <h4 style="margin: 0 0 12px 0; display: flex; align-items: center; gap: 8px;">
                        ✨ Gold Dust Recovery (Optional)
                    </h4>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Recovery Weight (g)</label>
                            <input type="number" class="form-input" name="goldDustRecovery" step="0.01" value="0" min="0">
                            <small class="form-help">Estimated weight of recoverable gold dust from this stage</small>
                        </div>
                        <div class="form-group">
                            <label class="form-label">
                                <input type="checkbox" name="recordDustRecovery" checked style="margin-right: 8px;">
                                Track as recoverable inventory
                            </label>
                            <small class="form-help">Recommended: Track dust for future reprocessing</small>
                            <!-- Hidden field for warehouse - uses default VAULT-01 -->
                            <input type="hidden" name="dustWarehouse" value="VAULT-01">
                        </div>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Material Cost</label>
                        <input type="number" class="form-input" name="materialCost" step="0.01" value="0">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Labor Cost</label>
                        <input type="number" class="form-input" name="laborCost" step="0.01" value="0">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Overhead Cost</label>
                        <input type="number" class="form-input" name="overheadCost" step="0.01" value="0">
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Notes</label>
                    <textarea class="form-input" name="notes" rows="2"></textarea>
                </div>

                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                    ${this.isLastStage(nextStage) ? `
                        <button type="submit" class="btn btn-success">
                            Complete Production
                        </button>
                    ` : `
                        <button type="submit" class="btn btn-primary">
                            Record & Move to Next Stage
                        </button>
                    `}
                </div>
            </form>
        `;
    },

    renderOperatorCheckboxes() {
        const employees = Storage.getEmployees().filter(e => e.status === 'active' && (e.department === 'PROD' || e.department === 'QC' || e.job_level === 'Operator'));

        return employees.map(emp => `
            <label class="flex align-center gap-2 p-1 hover-bg-light" style="cursor: pointer;">
                <input type="checkbox" name="operator_niks" value="${emp.nik}">
                <span><strong>${emp.nik}</strong> - ${emp.name}</span>
            </label>
        `).join('') || '<p class="text-gray small p-2">No production operators found.</p>';
    },

    getNextStage() {
        if (!this.bom) return null;
        if (this.currentOrder.status === 'COMPLETED' || this.currentOrder.status === 'CANCELLED') {
            return null;
        }

        const stages = this.bom.stages;
        if (!this.currentOrder.currentStage) {
            return stages[0]; // Start with first stage
        }

        const currentIndex = stages.indexOf(this.currentOrder.currentStage);
        if (currentIndex === -1 || currentIndex >= stages.length - 1) {
            return null;
        }

        return stages[currentIndex + 1];
    },

    getLastOutputWeight() {
        if (this.movements.length === 0) {
            // First stage, use input from BOM
            return this.bom.materials[0].quantity;
        }
        return this.movements[this.movements.length - 1].outputWeight;
    },

    isLastStage(stage) {
        if (!this.bom) return false;
        const stages = this.bom.stages;
        return stage === stages[stages.length - 1];
    },

    calculateLoss(outputWeight) {
        const form = document.querySelector('form');
        const inputWeight = parseFloat(form.inputWeight.value);
        const output = parseFloat(outputWeight);

        if (!inputWeight || !output) return;

        const loss = inputWeight - output;
        const lossPercentage = (loss / inputWeight) * 100;

        const lossDisplay = document.getElementById('loss-display');
        lossDisplay.style.display = 'block';
        lossDisplay.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong>Loss:</strong> ${loss.toFixed(2)}g (${lossPercentage.toFixed(2)}%)
                </div>
                ${lossPercentage > 10 ? `
                    <div style="color: #d32f2f; font-weight: bold;">
                        ⚠️ High loss detected! Review process.
                    </div>
                ` : ''}
            </div>
        `;
    },

    async recordMovement(event) {
        event.preventDefault();
        const form = event.target;
        const formData = new FormData(form);

        const inputWeight = parseFloat(formData.get('inputWeight'));
        const outputWeight = parseFloat(formData.get('outputWeight'));
        const loss = inputWeight - outputWeight;
        const lossPercentage = (loss / inputWeight) * 100;

        const materialCost = parseFloat(formData.get('materialCost')) || 0;
        const laborCost = parseFloat(formData.get('laborCost')) || 0;
        const overheadCost = parseFloat(formData.get('overheadCost')) || 0;
        const totalCost = materialCost + laborCost + overheadCost;

        const nextStage = this.getNextStage();
        const isLastStage = this.isLastStage(nextStage);

        const movement = {
            movementId: `PMOV-${Date.now()}`,
            stage: nextStage,
            dateTime: new Date().toISOString(),
            inputWeight: inputWeight,
            outputWeight: outputWeight,
            loss: loss,
            lossPercentage: lossPercentage,
            operators: Array.from(form.querySelectorAll('input[name="operator_niks"]:checked')).map(cb => ({
                nik: cb.value,
                name: cb.parentElement.querySelector('span').textContent.split(' - ')[1]
            })),
            costs: {
                material: materialCost,
                labor: laborCost,
                overhead: overheadCost,
                total: totalCost
            },
            notes: formData.get('notes') || '',
            recordedBy: Auth.getCurrentUser()?.username || 'system'
        };

        // STRATEGY A: Casting Session (Pre-assign SNs and Mold IDs)
        if (nextStage === 'CASTING') {
            const moldCount = parseInt(formData.get('moldCount')) || 1;
            const sns = [];
            const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '').substring(2);
            const batchBase = this.currentOrder.batchNumber.split('-').pop();

            for (let i = 1; i <= moldCount; i++) {
                const sn = `AUR-${dateStr}-${batchBase}-${String(i).padStart(3, '0')}`;
                const moldId = formData.get(`mold_id_${i}`) || `M-${i}`;
                sns.push({
                    sn,
                    moldId,
                    status: 'PENDING',
                    weight: 0
                });
            }
            this.currentOrder.preGeneratedSNs = sns;
        }

        // STRATEGY A: QC & Final Weight Assignment
        if (isLastStage && this.currentOrder.preGeneratedSNs) {
            let totalOKWeight = 0;
            const updatedSNs = this.currentOrder.preGeneratedSNs.map((item, idx) => {
                const weight = parseFloat(formData.get(`qc_weight_${idx + 1}`)) || 0;
                const status = formData.get(`qc_status_${idx + 1}`) || 'REJECT';

                if (status === 'OK') totalOKWeight += weight;

                return {
                    ...item,
                    weight: weight,
                    status: status,
                    qcDateTime: new Date().toISOString()
                };
            });

            this.currentOrder.preGeneratedSNs = updatedSNs;
            movement.outputWeight = totalOKWeight;
            movement.loss = inputWeight - totalOKWeight;
            movement.lossPercentage = (movement.loss / inputWeight) * 100;
            this.currentOrder.actualQuantity = totalOKWeight;

            // Register OK items to Serialized Registry
            const okItems = updatedSNs.filter(s => s.status === 'OK').map(s => ({
                id: 'BAR-' + Math.random().toString(36).substr(2, 9),
                serialNumber: s.sn,
                weight: s.weight,
                moldId: s.moldId,
                status: 'Available',
                itemCode: this.currentOrder.productCode || 'FG-GOLD-BAR',
                orderNumber: this.currentOrder.orderNumber,
                batchNumber: this.currentOrder.batchNumber,
                registeredAt: new Date().toISOString()
            }));

            if (okItems.length > 0) {
                SerializedItem.addItems(okItems);
            }
        }

        // DAY 4 INTEGRATION: Validate and consume raw materials for FIRST stage
        if (this.currentOrder.status === 'DRAFT' && this.bom && this.bom.materials && this.bom.materials.length > 0) {
            // This is the FIRST movement - validate stock availability
            const rawMaterial = this.bom.materials[0];
            const sourceWarehouse = rawMaterial.warehouseCode || 'VAULT-01';

            try {
                const currentStock = WarehouseStock.getStock(sourceWarehouse, rawMaterial.itemCode);
                if (currentStock.quantity < inputWeight) {
                    ChartOfAccounts.showAlert('error',
                        `❌ Stock bahan baku tidak mencukupi!\n\n` +
                        `Item: ${rawMaterial.itemCode}\n` +
                        `Gudang: ${sourceWarehouse}\n` +
                        `Stock Tersedia: ${currentStock.quantity.toFixed(2)}g\n` +
                        `Diperlukan: ${inputWeight.toFixed(2)}g\n\n` +
                        `Silakan lakukan pembelian terlebih dahulu.`
                    );
                    return; // Stop production start
                }

                // Consume raw materials (OUT movement)
                WarehouseStock.updateStock(
                    sourceWarehouse,
                    rawMaterial.itemCode,
                    inputWeight,
                    rawMaterial.unitCost || 0,
                    this.currentOrder.orderNumber,
                    'OUT'
                );
                console.log(`✅ Material consumed: ${inputWeight}g ${rawMaterial.itemCode} from ${sourceWarehouse}`);
            } catch (stockError) {
                console.error('Warning: Material consumption tracking failed:', stockError);
            }
        }

        // DAY 4 INTEGRATION: Handle gold dust recovery if specified
        const goldDustRecovery = parseFloat(formData.get('goldDustRecovery')) || 0;
        const recordDustRecovery = formData.get('recordDustRecovery') === 'on';
        if (goldDustRecovery > 0 && recordDustRecovery) {
            try {
                const dustPurity = parseFloat(formData.get('dustPurity')) || 90;
                const dustWarehouse = formData.get('dustWarehouse') || 'VAULT-01';
                const dustItemCode = 'GOLD-DUST-001'; // Recoverable gold dust

                const dustRef = `DUST-${this.currentOrder.batchNumber}-${movement.movementId}`;

                WarehouseStock.updateStock(
                    dustWarehouse,
                    dustItemCode,
                    goldDustRecovery,
                    0, // Recovery has no cost (it's a gain)
                    dustRef,
                    'IN'
                );
                console.log(`✨ Gold dust recovered: ${goldDustRecovery}g @ ${dustPurity}% purity (Ref: ${dustRef})`);
            } catch (stockError) {
                console.error('Warning: Gold dust tracking failed:', stockError);
            }
        }

        // Update order
        this.movements.push(movement);
        this.currentOrder.movements = this.movements;
        this.currentOrder.currentStage = nextStage;
        this.currentOrder.totalCost = (this.currentOrder.totalCost || 0) + totalCost;

        if (isLastStage) {
            this.currentOrder.status = 'COMPLETED';
            this.currentOrder.actualCompletionDate = new Date().toISOString().split('T')[0];

            // DAY 4 INTEGRATION: Add finished goods to stock (IN movement)
            try {
                const finishedItemCode = this.currentOrder.productCode || 'GOLD-BAR-24K';
                const finishedWarehouse = 'FG-WH-01'; // Finished goods warehouse
                const unitCost = this.currentOrder.totalCost / outputWeight;

                WarehouseStock.updateStock(
                    finishedWarehouse,
                    finishedItemCode,
                    outputWeight, // Final output quantity
                    unitCost,
                    this.currentOrder.orderNumber,
                    'IN'
                );
                console.log(`✅ Finished goods added: ${outputWeight}g ${finishedItemCode} to ${finishedWarehouse}`);
            } catch (stockError) {
                console.error('Warning: Finished goods tracking failed:', stockError);
            }

            // Generate journal entry to move to finished goods
            this.generateCompletionJournal();
        } else {
            if (this.currentOrder.status === 'DRAFT') {
                this.currentOrder.status = 'IN_PROGRESS';
            }
            // Generate journal entry for stage movement
            this.generateStageMovementJournal(movement, nextStage);
        }

        // Save to storage
        const allOrders = Storage.get(Storage.KEYS.PRODUCTION_ORDERS) || [];
        const orderIndex = allOrders.findIndex(o => o.orderNumber === this.currentOrder.orderNumber);
        if (orderIndex >= 0) {
            allOrders[orderIndex] = this.currentOrder;
            await Storage.set(Storage.KEYS.PRODUCTION_ORDERS, allOrders);
        }

        alert(`✅ Movement recorded successfully!\n${isLastStage ? 'Production completed!' : `Moved to ${nextStage}`}`);
        this.init(this.currentOrder);
    },

    async generateStageMovementJournal(movement, stage) {
        // Map stage to WIP account
        const stageAccounts = {
            'MELTING': '1161',
            'ASSAY': '1162',
            'REFINING': '1163',
            'CASTING': '1164',
            'QC': '1165'
        };

        const toAccount = stageAccounts[stage];
        if (!toAccount) return;

        // Find "from" account (previous stage or raw materials)
        const currentStageIndex = this.bom.stages.indexOf(stage);
        let fromAccount;

        if (currentStageIndex === 0) {
            fromAccount = '1151'; // From Raw Materials
        } else {
            const prevStage = this.bom.stages[currentStageIndex - 1];
            fromAccount = stageAccounts[prevStage];
        }

        const journal = {
            date: new Date().toISOString().split('T')[0],
            referenceNumber: `PRD-${this.currentOrder.orderNumber}-${stage}`,
            description: `Production ${this.currentOrder.batchNumber} - ${stage} stage`,
            lines: [
                {
                    accountCode: toAccount,
                    accountName: `WIP - ${stage}`,
                    description: `Transfer to ${stage}`,
                    debit: movement.costs.total,
                    credit: 0
                },
                {
                    accountCode: fromAccount,
                    accountName: currentStageIndex === 0 ? 'Raw Materials' : `WIP - ${this.bom.stages[currentStageIndex - 1]}`,
                    description: `From ${currentStageIndex === 0 ? 'Raw Materials' : this.bom.stages[currentStageIndex - 1]}`,
                    debit: 0,
                    credit: movement.costs.total
                }
            ]
        };

        // Save journal entry
        const journals = Storage.get(Storage.KEYS.JOURNAL_ENTRIES) || [];
        journals.push(journal);
        await Storage.set(Storage.KEYS.JOURNAL_ENTRIES, journals);
    },

    async generateCompletionJournal() {
        // Move from WIP QC to Finished Goods
        const journal = {
            date: new Date().toISOString().split('T')[0],
            referenceNumber: `PRD-${this.currentOrder.orderNumber}-COMPLETE`,
            description: `Production ${this.currentOrder.batchNumber} completed - ${this.currentOrder.productName}`,
            lines: [
                {
                    accountCode: '1181', // Finished Goods - Gold Bar
                    accountName: 'Finished Goods - Gold Bar',
                    description: `Completed production ${this.currentOrder.quantity}g`,
                    debit: this.currentOrder.totalCost,
                    credit: 0
                },
                {
                    accountCode: '1165', // WIP QC
                    accountName: 'WIP - Quality Control',
                    description: 'Transfer from QC',
                    debit: 0,
                    credit: this.currentOrder.totalCost
                }
            ]
        };

        const journals = Storage.get(Storage.KEYS.JOURNAL_ENTRIES) || [];
        journals.push(journal);
        await Storage.set(Storage.KEYS.JOURNAL_ENTRIES, journals);
    },

    renderMovementHistory() {
        if (this.movements.length === 0) {
            return '<p class="text-center text-gray">No movements recorded yet</p>';
        }

        return `
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Date/Time</th>
                            <th>Stage</th>
                            <th>Operators</th>
                            <th class="text-right">Input (g)</th>
                            <th class="text-right">Output (g)</th>
                            <th class="text-right">Loss</th>
                            <th class="text-right">Cost</th>
                            <th>Notes</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.movements.map(m => `
                            <tr>
                                <td>${new Date(m.dateTime).toLocaleString('id-ID')}</td>
                                <td><span class="badge badge-secondary">${m.stage}</span></td>
                                <td><small>${(m.operators || []).map(o => o.name).join(', ') || '-'}</small></td>
                                <td class="text-right">${m.inputWeight.toFixed(2)}g</td>
                                <td class="text-right">${m.outputWeight.toFixed(2)}g</td>
                                <td class="text-right">
                                    <span style="color: ${m.lossPercentage > 10 ? '#d32f2f' : '#666'}">
                                        ${m.loss.toFixed(2)}g (${m.lossPercentage.toFixed(2)}%)
                                    </span>
                                </td>
                                <td class="text-right">${this.formatCurrency(m.costs.total)}</td>
                                <td>${m.notes || '-'}</td>
                            </tr>
                        `).join('')}
                        <tr style="background: var(--bg-tertiary); font-weight: bold;">
                            <td colspan="5" class="text-right">TOTAL COST:</td>
                            <td class="text-right">${this.formatCurrency(this.currentOrder.totalCost || 0)}</td>
                            <td></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
    },

    formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    },

    generateSNPreview(count) {
        const preview = document.getElementById('sn-preview-list');
        const moldContainer = document.getElementById('slab-mold-inputs');
        if (!preview || !moldContainer) return;

        const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '').substring(2);
        const batchBase = this.currentOrder.batchNumber.split('-').pop();
        let html = '<strong>Generated SNs:</strong> ';

        for (let i = 1; i <= Math.min(count, 50); i++) {
            const sn = `AUR-${dateStr}-${batchBase}-${String(i).padStart(3, '0')}`;
            html += `${sn}${i < count ? ', ' : ''}`;
        }
        preview.innerHTML = html;
        moldContainer.innerHTML = this.renderMoldIDInputs(count);
    },

    renderMoldIDInputs(count) {
        let html = '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px;">';
        for (let i = 1; i <= count; i++) {
            html += `
                <div>
                    <label style="font-size: 11px;">MOLD ID #${i}</label>
                    <input type="text" name="mold_id_${i}" class="form-input" placeholder="e.g. M-01" style="padding: 4px; font-size: 12px;">
                </div>
            `;
        }
        html += '</div>';
        return html;
    },

    renderQCSlabInputs() {
        if (!this.currentOrder.preGeneratedSNs) return '<p class="text-gray">No SNs generated at Casting.</p>';

        return `
            <table class="table table-sm">
                <thead>
                    <tr>
                        <th>Serial Number</th>
                        <th>Mold ID</th>
                        <th>Actual Weight (g)</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.currentOrder.preGeneratedSNs.map((s, idx) => `
                        <tr>
                            <td><strong>${s.sn}</strong></td>
                            <td>${s.moldId}</td>
                            <td>
                                <input type="number" name="qc_weight_${idx + 1}" class="form-input" step="0.001" placeholder="0.000" required>
                            </td>
                            <td>
                                <select name="qc_status_${idx + 1}" class="form-input">
                                    <option value="OK">✅ OK</option>
                                    <option value="REJECT">❌ REJECT (Re-melt)</option>
                                </select>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    printCastingLabels() {
        const count = parseInt(document.getElementById('mold-count')?.value) || 1;
        const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '').substring(2);
        const batchBase = this.currentOrder.batchNumber.split('-').pop();

        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
            <head>
                <title>Labels - ${this.currentOrder.batchNumber}</title>
                <style>
                    body { font-family: sans-serif; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 20px; }
                    .label { border: 1px solid black; padding: 10px; text-align: center; }
                    .sn { font-size: 18px; font-weight: bold; margin: 5px 0; }
                    .mold { font-size: 14px; color: #555; }
                </style>
            </head>
            <body>
        `);

        for (let i = 1; i <= count; i++) {
            const sn = `AUR-${dateStr}-${batchBase}-${String(i).padStart(3, '0')}`;
            const moldId = document.getElementsByName(`mold_id_${i}`)[0]?.value || `M-${i}`;
            printWindow.document.write(`
                <div class="label">
                    <div style="font-size: 10px;">${this.currentOrder.productName}</div>
                    <div class="sn">${sn}</div>
                    <div class="mold">MOLD ID: ${moldId}</div>
                </div>
            `);
        }
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.print();
    }
};


// Explicitly make ProductionDetail globally available
window.ProductionDetail = ProductionDetail;
