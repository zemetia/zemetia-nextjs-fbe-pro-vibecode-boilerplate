// ==========================================
// Production Batch Module
// ==========================================
// Manages batch production for pooled job order processing
// Enables economies of scale and proportional yield allocation

const ProductionBatch = {
    batches: [],
    currentBatch: null,

    init() {
        this.loadBatches();
        console.log('✅ Production Batch module initialized');
    },

    loadBatches() {
        this.batches = Storage.get(Storage.KEYS.PRODUCTION_BATCHES) || [];
        console.log(`📦 Loaded ${this.batches.length} production batches`);
    },

    // ==========================================
    // BATCH CREATION
    // ==========================================

    /**
     * Create new production batch from selected job orders
     * @param {Array} jobOrderIds - Array of job order IDs to include in batch
     * @param {Object} batchData - Additional batch data (operator, notes)
     * @returns {Object} Created batch
     */
    async createBatch(jobOrderIds, batchData = {}) {
        // Validate input
        if (!jobOrderIds || jobOrderIds.length === 0) {
            throw new Error('Minimal 1 job order harus dipilih untuk batch');
        }

        // Get job orders
        const jobOrders = jobOrderIds.map(id => {
            const jo = JobOrder.getJobOrder(id);
            if (!jo) {
                throw new Error(`Job order ${id} tidak ditemukan`);
            }
            // Allow received, batch_ready, lab_tested status
            if (jo.status !== 'batch_ready' && jo.status !== 'lab_tested' && jo.status !== 'received' && jo.status !== 'draft') {
                throw new Error(`Job order ${jo.jobOrderNumber} belum siap untuk batch (status: ${jo.status})`);
            }
            if (jo.batchId) {
                throw new Error(`Job order ${jo.jobOrderNumber} sudah ada di batch ${jo.batchNumber}`);
            }
            return jo;
        });

        
        // Validation: Consent for Pooling (PRD-GAR-PROD-2026-08-03-v1.1)
        if (jobOrders.length > 1) {
            jobOrders.forEach(jo => {
                if (jo.is_pooling_allowed === false || jo.isPoolingAllowed === false) {
                    throw new Error(`Customer ${jo.customerName || jo.jobOrderNumber} tidak mengizinkan pooling (KYC consent false). Harus buat batch terpisah.`);
                }
            });
        }

        // Calculate totals and proportions - use jo.input.grossWeight for correct field access
        const totalGrossWeight = jobOrders.reduce((sum, jo) => sum + (jo.input?.grossWeight || jo.grossWeight || 0), 0);
        const totalEstimatedPureAu = jobOrders.reduce((sum, jo) => {
            // Check multiple possible locations for pure content
            const pureContent = jo.input?.actualPureContent ||
                jo.input?.estimatedPureContent ||
                jo.labTestResults?.pureContentGrams ||
                jo.estimatedPureAu ||
                (jo.input?.grossWeight * (jo.input?.estimatedPurity || jo.input?.kadar / 24 || 0.9)) ||
                0;
            return sum + pureContent;
        }, 0);

        if (totalEstimatedPureAu === 0) {
            throw new Error('Total estimated pure Au tidak boleh 0. Pastikan semua job order sudah ada lab test.');
        }

        // Calculate proportions
        const jobOrdersWithProportions = jobOrders.map(jo => {
            const grossWeight = jo.input?.grossWeight || jo.grossWeight || 0;
            const kadar = jo.input?.kadar || jo.estimatedKadar || 22;
            const pureAu = jo.input?.actualPureContent ||
                jo.input?.estimatedPureContent ||
                jo.labTestResults?.pureContentGrams ||
                jo.estimatedPureAu ||
                (grossWeight * kadar / 24) ||
                0;
            return {
                jobOrderId: jo.id,
                jobOrderNumber: jo.jobOrderNumber,
                customerId: jo.customerId,
                customerName: jo.customerName,
                grossWeight: grossWeight,
                estimatedKadar: kadar,
                estimatedPureAu: pureAu,
                proportion: totalEstimatedPureAu > 0 ? pureAu / totalEstimatedPureAu : 0
            };
        });

        // Generate batch number
        const batchNumber = await this.generateBatchNumber();

        // Create batch object
        const batch = {
            id: `BATCH-${Date.now()}`,
            batchNumber,
            createdDate: new Date().toISOString(),
            createdBy: Auth.getCurrentUser()?.id || 'system',
            createdByName: Auth.getCurrentUser()?.name || 'system',
            status: 'draft',

            // Job orders
            jobOrders: jobOrdersWithProportions,
            totalJobOrders: jobOrders.length,
            totalGrossWeight,
            totalEstimatedPureAu,

            // Output (to be filled during processing)
            actualOutput: null,
            batchYield: null,
            allocations: null,

            // Production tracking
            startTime: null,
            endTime: null,
            operator: batchData.operator || '',
            stage: batchData.stage || 'GENERAL',
            notes: batchData.notes || '',

            // Audit
            updatedAt: new Date().toISOString(),
            updatedBy: Auth.getCurrentUser()?.email || 'system'
        };

        // Save batch
        this.batches.push(batch);
        await Storage.addBatch(batch);

        // Update job orders with batch reference
        for (const jo of jobOrders) {
            await JobOrder.updateJobOrder(jo.id, {
                batchId: batch.id,
                batchNumber: batch.batchNumber,
                batchStage: batch.stage,
                batchStatus: 'in_batch',
                status: 'in_batch'
            });
        }

        AuditLog.log('production_batch', 'create', batch.id, {
            batchNumber: batch.batchNumber,
            jobOrderCount: jobOrders.length,
            totalWeight: totalGrossWeight
        });

        console.log(`✅ Batch ${batchNumber} created with ${jobOrders.length} job orders`);
        return batch;
    },

    /**
     * Generate unique batch number
     * Format: BATCH-YYYYMM-XXX
     */
    async generateBatchNumber() {
        // ☁️ Use Atomic Cloud Sequencer
        const nextRef = await Storage.getNextReferenceNumber('BAT');
        if (nextRef) return nextRef;

        const now = new Date();
        const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

        // Count batches in current month
        const monthBatches = this.batches.filter(b =>
            b.batchNumber && b.batchNumber.includes(yearMonth)
        );

        const sequence = String(monthBatches.length + 1).padStart(3, '0');
        return `BATCH-${yearMonth}-${sequence}`;
    },

    // ==========================================
    // BATCH PROCESSING
    // ==========================================

    /**
     * Start batch processing
     * @param {string} batchId - Batch ID
     * @param {Object} processData - Start time, operator
     */
    async startProcessing(batchId, processData = {}) {
        const batch = this.getBatch(batchId);
        if (!batch) {
            throw new Error('Batch tidak ditemukan');
        }

        if (batch.status !== 'draft') {
            throw new Error(`Batch sudah ${batch.status}, tidak bisa distart lagi`);
        }

        batch.status = 'in_process';
        batch.startTime = processData.startTime || new Date().toISOString();
        batch.operator = processData.operator || batch.operator;
        batch.updatedAt = new Date().toISOString();
        batch.updatedBy = Auth.getCurrentUser()?.email || 'system';

        await Storage.updateBatch(batchId, batch);

        AuditLog.log('production_batch', 'start_processing', batchId, {
            batchNumber: batch.batchNumber,
            operator: batch.operator
        });

        console.log(`▶️  Batch ${batch.batchNumber} processing started`);
        return batch;
    },

    /**
     * Record actual output and complete batch
     * @param {string} batchId - Batch ID
     * @param {Object} actualOutput - { pureAu, silver, loss }
     * @param {Object} processData - End time, notes
     */
    async recordOutputAndComplete(batchId, actualOutput, processData = {}) {
        const batch = this.getBatch(batchId);
        if (!batch) {
            throw new Error('Batch tidak ditemukan');
        }

        if (batch.status === 'completed') {
            throw new Error('Batch sudah completed');
        }

        // Validate output
        this.validateOutput(batch, actualOutput);

        // Calculate batch yield
        const batchYield = this.calculateBatchYield(batch, actualOutput);

        // Calculate allocations
        const allocations = this.calculateAllocations(batch, actualOutput);

        // Update batch
        batch.actualOutput = {
            ...actualOutput,
            recordedAt: new Date().toISOString(),
            recordedBy: Auth.getCurrentUser()?.email || 'system'
        };
        batch.batchYield = batchYield;
        batch.allocations = allocations;
        batch.status = 'completed';
        batch.endTime = processData.endTime || new Date().toISOString();
        batch.notes = processData.notes || batch.notes;
        batch.updatedAt = new Date().toISOString();
        batch.updatedBy = Auth.getCurrentUser()?.email || 'system';

        await Storage.updateBatch(batchId, batch);

        // Update job orders with allocations
        for (const allocation of allocations) {
            await JobOrder.updateJobOrder(allocation.jobOrderId, {
                allocatedPureAu: allocation.allocatedAu,
                allocatedSilver: allocation.allocatedAg,
                allocatedLoss: allocation.allocatedLoss,
                batchYield: allocation.individualYield,
                batchStatus: 'processed',
                status: 'processed'
            });
        }

        AuditLog.log('production_batch', 'complete', batchId, {
            batchNumber: batch.batchNumber,
            actualOutput,
            batchYield
        });

        console.log(`✅ Batch ${batch.batchNumber} completed`);
        return batch;
    },

    /**
     * Validate actual output
     */
    validateOutput(batch, actualOutput) {
        const { pureAu, silver, loss } = actualOutput;

        if (!pureAu || pureAu <= 0) {
            throw new Error('Pure Au harus lebih dari 0');
        }

        if (silver < 0 || loss < 0) {
            throw new Error('Silver dan loss tidak boleh negatif');
        }

        // Check if total output is reasonable (±10% tolerance)
        const totalOutput = pureAu + silver + loss;
        const tolerance = batch.totalGrossWeight * 0.10;
        const diff = Math.abs(totalOutput - batch.totalGrossWeight);

        if (diff > tolerance) {
            console.warn(`⚠️  Output total (${totalOutput}g) berbeda ${diff.toFixed(2)}g dari input (${batch.totalGrossWeight}g)`);
            // Don't throw error, just warn
        }

        // Check if yield is reasonable (95% - 100%)
        const yieldPercent = (pureAu / batch.totalEstimatedPureAu) * 100;
        if (yieldPercent < 95 || yieldPercent > 100) {
            console.warn(`⚠️  Batch yield ${yieldPercent.toFixed(2)}% di luar range normal (95%-100%)`);
            // Don't throw error, just warn
        }
    },

    /**
     * Calculate batch-level yield
     */
    calculateBatchYield(batch, actualOutput) {
        const auYieldPercent = (actualOutput.pureAu / batch.totalEstimatedPureAu) * 100;
        const agYieldPercent = (actualOutput.silver / batch.totalGrossWeight) * 100;

        return {
            auYieldPercent: parseFloat(auYieldPercent.toFixed(4)),
            agYieldPercent: parseFloat(agYieldPercent.toFixed(4))
        };
    },

    
    /**
     * PRD v1.1: Evaluate QC Loss against Configurable System Tolerance
     */
    evaluateQCTolerance(lossWeight, inputFineWeight) {
        if (!inputFineWeight || inputFineWeight <= 0) return { status: 'PASS', lossPct: 0, tolerance: 0.5 };
        const tolerance = Storage.getLossTolerancePercent ? Storage.getLossTolerancePercent() : 0.5;
        const lossPct = (lossWeight / inputFineWeight) * 100;

        if (lossPct <= tolerance) {
            return { status: 'PASS', lossPct: Math.round(lossPct * 1000)/1000, tolerance, note: 'Loss dalam batas toleransi normal' };
        } else if (lossPct <= tolerance * 2) {
            return { status: 'WARNING', lossPct: Math.round(lossPct * 1000)/1000, tolerance, note: 'Loss melebihi toleransi normal (butuh catatan QC)' };
        } else {
            return { status: 'FAIL', lossPct: Math.round(lossPct * 1000)/1000, tolerance, note: 'Loss melebihi threshold max (butuh persetujuan Direktur 608/612)' };
        }
    },

    /**
     * PRD v1.1: Calculate Fine Weight Proportional Allocations
     */
    calculateAllocations(batch, actualOutput) {
        const totalInputFine = batch.totalEstimatedPureAu;
        if (!totalInputFine || totalInputFine <= 0) {
            throw new Error('Total estimated pure Au batch invalid');
        }

        const totalOutputFine = actualOutput.pureAu || 0;
        const totalLoss = actualOutput.loss || 0;
        const totalByproduct = actualOutput.silver || actualOutput.byproduct || 0;

        let allocatedFineSum = 0;
        let largestJoIndex = 0;
        let maxProportion = -1;

        const allocations = batch.jobOrders.map((jo, idx) => {
            const prop = jo.estimatedPureAu / totalInputFine;
            if (prop > maxProportion) {
                maxProportion = prop;
                largestJoIndex = idx;
            }

            const allocatedAu = Math.round(prop * totalOutputFine * 100) / 100;
            const allocatedLoss = Math.round(prop * totalLoss * 100) / 100;
            const allocatedByproduct = Math.round(prop * totalByproduct * 100) / 100;

            allocatedFineSum += allocatedAu;

            return {
                jobOrderId: jo.jobOrderId || jo.id,
                jobOrderNumber: jo.jobOrderNumber,
                customerId: jo.customerId,
                customerName: jo.customerName,
                grossWeight: jo.grossWeight,
                estimatedPureAu: jo.estimatedPureAu,
                proportionPct: Math.round(prop * 100 * 10000) / 10000,
                proportion: prop,
                allocatedAu,
                allocatedLoss,
                allocatedByproduct,
                individualYield: jo.estimatedPureAu > 0 ? (allocatedAu / jo.estimatedPureAu) * 100 : 0
            };
        });

        // Exact fine sum adjustment for rounding
        const diff = Math.round((totalOutputFine - allocatedFineSum) * 100) / 100;
        if (diff !== 0 && allocations[largestJoIndex]) {
            allocations[largestJoIndex].allocatedAu = Math.round((allocations[largestJoIndex].allocatedAu + diff) * 100) / 100;
        }

        return allocations;
    },


    // ==========================================
    // BATCH MANAGEMENT
    // ==========================================

    getBatch(batchId) {
        return this.batches.find(b => b.id === batchId);
    },

    getBatchByNumber(batchNumber) {
        return this.batches.find(b => b.batchNumber === batchNumber);
    },

    getAllBatches() {
        return this.batches;
    },

    getBatchesByStatus(status) {
        return this.batches.filter(b => b.status === status);
    },

    async deleteBatch(batchId) {
        const batch = this.getBatch(batchId);
        if (!batch) {
            throw new Error('Batch tidak ditemukan');
        }

        if (batch.status === 'completed') {
            throw new Error('Batch yang sudah completed tidak bisa dihapus');
        }

        // Remove batch reference from job orders
        for (const jo of batch.jobOrders) {
            await JobOrder.updateJobOrder(jo.jobOrderId, {
                batchId: null,
                batchNumber: null,
                batchStatus: null,
                status: 'batch_ready'
            });
        }

        // Delete batch
        await Storage.deleteBatch(batchId);
        this.loadBatches();

        AuditLog.log('production_batch', 'delete', batchId, {
            batchNumber: batch.batchNumber
        });

        console.log(`🗑️  Batch ${batch.batchNumber} deleted`);
    },

    // ==========================================
    // UTILITY FUNCTIONS
    // ==========================================

    /**
     * Get summary statistics
     */
    getSummaryStats() {
        const total = this.batches.length;
        const draft = this.batches.filter(b => b.status === 'draft').length;
        const inProcess = this.batches.filter(b => b.status === 'in_process').length;
        const completed = this.batches.filter(b => b.status === 'completed').length;

        // Today's completed batches
        const today = new Date().toISOString().split('T')[0];
        const completedToday = this.batches.filter(b =>
            b.status === 'completed' &&
            b.endTime &&
            b.endTime.startsWith(today)
        ).length;

        return {
            total,
            draft,
            inProcess,
            completed,
            completedToday
        };
    },

    /**
     * Format batch for display
     */
    formatBatchForDisplay(batch) {
        return {
            ...batch,
            createdDateFormatted: new Date(batch.createdDate).toLocaleDateString('id-ID'),
            statusBadge: this.getStatusBadge(batch.status),
            processingTime: this.calculateProcessingTime(batch),
            totalWeightFormatted: `${batch.totalGrossWeight.toLocaleString('id-ID')} gram`,
            totalPureAuFormatted: `${batch.totalEstimatedPureAu.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} gram`
        };
    },

    getStatusBadge(status) {
        const badges = {
            draft: '<span class="badge badge-secondary">Draft</span>',
            in_process: '<span class="badge badge-warning">In Process</span>',
            completed: '<span class="badge badge-success">Completed</span>'
        };
        return badges[status] || status;
    },

    calculateProcessingTime(batch) {
        if (!batch.startTime || !batch.endTime) {
            return '-';
        }
        const start = new Date(batch.startTime);
        const end = new Date(batch.endTime);
        const hours = Math.abs(end - start) / 36e5;
        return `${hours.toFixed(1)} jam`;
    },

    // ==========================================
    // UI RENDERING
    // ==========================================

    render() {
        this.loadBatches();
        const mainContent = document.getElementById('main-content');
        const stats = this.getSummaryStats();

        mainContent.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">🔄 Production Batches</h1>
                <p class="page-subtitle">Manage batch production for pooled job order processing</p>
            </div>

            <!-- Summary Cards -->
            <div class="stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
                <div class="stat-card" style="background: var(--bg-secondary); padding: 1.5rem; border-radius: 12px; text-align: center;">
                    <div style="font-size: 2rem; font-weight: bold; color: var(--color-primary);">${stats.total}</div>
                    <div style="color: var(--text-secondary);">Total Batches</div>
                </div>
                <div class="stat-card" style="background: var(--bg-secondary); padding: 1.5rem; border-radius: 12px; text-align: center;">
                    <div style="font-size: 2rem; font-weight: bold; color: var(--color-warning);">${stats.draft}</div>
                    <div style="color: var(--text-secondary);">Draft</div>
                </div>
                <div class="stat-card" style="background: var(--bg-secondary); padding: 1.5rem; border-radius: 12px; text-align: center;">
                    <div style="font-size: 2rem; font-weight: bold; color: var(--color-info);">${stats.inProcess}</div>
                    <div style="color: var(--text-secondary);">In Process</div>
                </div>
                <div class="stat-card" style="background: var(--bg-secondary); padding: 1.5rem; border-radius: 12px; text-align: center;">
                    <div style="font-size: 2rem; font-weight: bold; color: var(--color-success);">${stats.completed}</div>
                    <div style="color: var(--text-secondary);">Completed</div>
                </div>
            </div>

            <!-- Action Bar -->
            <div class="action-bar" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
                <div class="filter-group" style="display: flex; gap: 0.5rem;">
                    <select id="status-filter" class="form-select" onchange="ProductionBatch.filterByStatus(this.value)" style="min-width: 150px;">
                        <option value="all">All Status</option>
                        <option value="draft">Draft</option>
                        <option value="in_process">In Process</option>
                        <option value="completed">Completed</option>
                    </select>
                </div>
                <button class="btn btn-primary" onclick="ProductionBatch.showCreateModal()">
                    ➕ Create New Batch
                </button>
            </div>

            <!-- Batches Table -->
            <div class="card">
                <div class="card-header">
                    <h3>📦 Daftar Production Batches</h3>
                </div>
                <div class="card-body" style="overflow-x: auto;">
                    <table class="data-table" id="batches-table">
                        <thead>
                            <tr>
                                <th>Batch Number</th>
                                <th>Tahapan</th>
                                <th>Date</th>
                                <th>Job Orders</th>
                                <th>Total Weight</th>
                                <th>Status</th>
                                <th>Susut (gr/%)</th>
                                <th>Operator</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="batches-tbody">
                            ${this.renderBatchRows()}
                        </tbody>
                    </table>
                    ${this.batches.length === 0 ? '<p style="text-align: center; padding: 2rem; color: var(--text-secondary);">No batches found. Click "Create New Batch" to get started.</p>' : ''}
                </div>
            </div>

            <!-- Create Batch Modal -->
            ${this.renderCreateModal()}

            <!-- Process Batch Modal -->
            ${this.renderProcessModal()}

            <!-- Batch Detail Modal -->
            ${this.renderDetailModal()}
        `;
    },

    renderBatchRows(filter = 'all') {
        let batches = [...this.batches].sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate));

        if (filter !== 'all') {
            batches = batches.filter(b => b.status === filter);
        }

        if (batches.length === 0) {
            return '<tr><td colspan="8" style="text-align: center; padding: 2rem;">No batches found</td></tr>';
        }

        return batches.map(batch => {
            const formattedBatch = this.formatBatchForDisplay(batch);
            return `
                <tr>
                    <td><strong>${batch.batchNumber}</strong></td>
                    <td><span class="badge badge-info">${batch.stage || 'GENERAL'}</span></td>
                    <td>${formattedBatch.createdDateFormatted}</td>
                    <td>${batch.totalJobOrders} orders</td>
                    <td>${formattedBatch.totalWeightFormatted}</td>
                    <td>${formattedBatch.statusBadge}</td>
                    <td>
                        ${batch.actualOutput
                    ? `<strong>${batch.actualOutput.loss?.toLocaleString('id-ID', { minimumFractionDigits: 2 })} g</strong><br>
                               <span style="font-size: 0.8rem; color: var(--text-secondary);">${((batch.actualOutput.loss / batch.totalGrossWeight) * 100).toFixed(2)}%</span>`
                    : '-'}
                    </td>
                    <td>${batch.operator || '-'}</td>
                    <td>
                        <div style="display: flex; gap: 0.25rem;">
                            <button class="btn btn-sm btn-info" onclick="ProductionBatch.showDetailModal('${batch.id}')" title="View Details">
                                👁️
                            </button>
                            ${batch.status === 'draft' ? `
                                <button class="btn btn-sm btn-warning" onclick="ProductionBatch.showProcessModal('${batch.id}')" title="Start Processing">
                                    ▶️
                                </button>
                                <button class="btn btn-sm btn-danger" onclick="ProductionBatch.confirmDelete('${batch.id}')" title="Delete">
                                    🗑️
                                </button>
                            ` : ''}
                            ${batch.status === 'in_process' ? `
                                <button class="btn btn-sm btn-success" onclick="ProductionBatch.showProcessModal('${batch.id}')" title="Complete Batch">
                                    ✅
                                </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    filterByStatus(status) {
        const tbody = document.getElementById('batches-tbody');
        if (tbody) {
            tbody.innerHTML = this.renderBatchRows(status);
        }
    },

    renderCreateModal() {
        // Get available job orders (draft, received, batch_ready, lab_tested status, not already in batch)
        const availableJobOrders = (typeof JobOrder !== 'undefined' && JobOrder.jobOrders)
            ? JobOrder.jobOrders.filter(jo =>
                (jo.status === 'batch_ready' || jo.status === 'lab_tested' || jo.status === 'received' || jo.status === 'draft') &&
                !jo.batchId
            )
            : [];

        return `
            <div id="create-batch-modal" class="modal-overlay hidden">
                <div class="modal" style="max-width: 800px;">
                    <div class="modal-header">
                        <h3 class="modal-title">Create New Production Batch</h3>
                        <button class="modal-close" onclick="ProductionBatch.closeCreateModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="create-batch-form" onsubmit="ProductionBatch.handleCreateSubmit(event)">
                            <!-- Batch Info -->
                            <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                                <div class="form-group">
                                    <label class="form-label">Batch Number</label>
                                    <input type="text" class="form-input" value="Auto-generated" readonly style="background: var(--bg-tertiary);">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Operator</label>
                                    <input type="text" id="batch-operator" class="form-input" placeholder="Nama operator">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Tahapan Produksi</label>
                                    <select id="batch-stage" class="form-select">
                                        <option value="GENERAL">Umum/General</option>
                                        <option value="AQUAREGIA">Aquaregia</option>
                                        <option value="ELECTROLYSIS">Electrolisis</option>
                                        <option value="MELTING_GRANULA">Lebur Granula</option>
                                        <option value="MELTING_GANTUNGAN">Lebur Gantungan</option>
                                        <option value="PIPIH_GILING">Pipih & Giling</option>
                                        <option value="PLONG_PRESS">Plong & Press</option>
                                        <option value="LASER_MARKING">Laser Marking</option>
                                        <option value="PACKAGING">Packaging</option>
                                    </select>
                                </div>
                            </div>

                            <!-- Job Order Selection -->
                            <div class="form-group" style="margin-bottom: 1rem;">
                                <label class="form-label required">Select Job Orders</label>
                                <div style="max-height: 300px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 8px; padding: 0.5rem;">
                                    ${availableJobOrders.length > 0 ? availableJobOrders.map(jo => {
            const grossWeight = jo.input?.grossWeight || jo.grossWeight || 0;
            const kadar = jo.input?.kadar || jo.estimatedKadar || '-';
            return `
                                        <label class="checkbox-item" style="display: flex; align-items: center; padding: 0.75rem; border-bottom: 1px solid var(--border-color); cursor: pointer;">
                                            <input type="checkbox" name="job-orders" value="${jo.id}" class="jo-checkbox" onchange="ProductionBatch.updateBatchSummary()" style="margin-right: 0.75rem;">
                                            <div style="flex: 1;">
                                                <strong>${jo.jobOrderNumber}</strong> - ${jo.customerName}
                                                <div style="font-size: 0.85rem; color: var(--text-secondary);">
                                                    Weight: ${grossWeight?.toLocaleString('id-ID')}g | Kadar: ${kadar}K | Status: ${jo.status}
                                                </div>
                                            </div>
                                        </label>
                                    `;
        }).join('') : '<p style="padding: 1rem; text-align: center; color: var(--text-secondary);">No job orders available. Create job orders first.</p>'}
                                </div>
                            </div>

                            <!-- Batch Summary -->
                            <div id="batch-summary" class="card" style="background: var(--bg-tertiary); padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                                <h4 style="margin-bottom: 0.5rem;">Batch Summary</h4>
                                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
                                    <div>
                                        <div style="color: var(--text-secondary); font-size: 0.85rem;">Selected Job Orders</div>
                                        <div id="summary-jo-count" style="font-size: 1.5rem; font-weight: bold;">0</div>
                                    </div>
                                    <div>
                                        <div style="color: var(--text-secondary); font-size: 0.85rem;">Total Gross Weight</div>
                                        <div id="summary-weight" style="font-size: 1.5rem; font-weight: bold;">0 gram</div>
                                    </div>
                                    <div>
                                        <div style="color: var(--text-secondary); font-size: 0.85rem;">Est. Pure Au</div>
                                        <div id="summary-pure-au" style="font-size: 1.5rem; font-weight: bold;">0 gram</div>
                                    </div>
                                </div>
                            </div>

                            <!-- Notes -->
                            <div class="form-group">
                                <label class="form-label">Notes</label>
                                <textarea id="batch-notes" class="form-input" rows="2" placeholder="Catatan batch (opsional)"></textarea>
                            </div>

                            <div class="form-actions" style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem;">
                                <button type="button" class="btn btn-secondary" onclick="ProductionBatch.closeCreateModal()">Cancel</button>
                                <button type="submit" class="btn btn-primary" ${availableJobOrders.length === 0 ? 'disabled' : ''}>Create Batch</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
    },

    renderProcessModal() {
        return `
            <div id="process-batch-modal" class="modal-overlay hidden">
                <div class="modal" style="max-width: 700px;">
                    <div class="modal-header">
                        <h3 class="modal-title" id="process-modal-title">Process Batch</h3>
                        <button class="modal-close" onclick="ProductionBatch.closeProcessModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="process-batch-form" onsubmit="ProductionBatch.handleProcessSubmit(event)">
                            <input type="hidden" id="process-batch-id">

                            <!-- Batch Info -->
                            <div class="card" style="background: var(--bg-tertiary); padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                    <div>
                                        <strong>Batch Number:</strong>
                                        <span id="process-batch-number">-</span>
                                    </div>
                                    <div>
                                        <strong>Job Orders:</strong>
                                        <span id="process-jo-count">-</span>
                                    </div>
                                    <div>
                                        <strong>Total Gross Weight:</strong>
                                        <span id="process-gross-weight">-</span>
                                    </div>
                                    <div>
                                        <strong>Est. Pure Au:</strong>
                                        <span id="process-est-pure">-</span>
                                    </div>
                                </div>
                            </div>

                            <!-- Actual Output -->
                            <h4 style="margin-bottom: 1rem;">Record Actual Output</h4>
                            <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                                <div class="form-group">
                                    <label class="form-label required">Pure Gold (Au) gram</label>
                                    <input type="number" id="output-pure-au" class="form-input" required min="0" step="0.0001" onchange="ProductionBatch.calculateYieldPreview()">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Silver (Ag) gram</label>
                                    <input type="number" id="output-silver" class="form-input" min="0" step="0.0001" value="0" onchange="ProductionBatch.calculateYieldPreview()">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Berat Susut (Loss) gram</label>
                                    <input type="number" id="output-loss" class="form-input" min="0" step="0.0001" value="0" onchange="ProductionBatch.calculateYieldPreview()">
                                </div>
                            </div>

                            <!-- Yield Preview -->
                            <div id="yield-preview" class="card" style="background: var(--color-success-bg, #d4edda); padding: 1rem; border-radius: 8px; margin-bottom: 1rem; color: #000000;">
                                <h4 style="margin-bottom: 0.5rem; color: #000000;">Yield Preview</h4>
                                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
                                    <div>
                                        <div style="color: #000000; font-size: 0.85rem; opacity: 0.8;">Au Yield</div>
                                        <div id="preview-au-yield" style="font-size: 1.25rem; font-weight: bold;">--%</div>
                                    </div>
                                    <div>
                                        <div style="color: #000000; font-size: 0.85rem; opacity: 0.8;">Ag Yield</div>
                                        <div id="preview-ag-yield" style="font-size: 1.25rem; font-weight: bold;">--%</div>
                                    </div>
                                    <div>
                                        <div style="color: #000000; font-size: 0.85rem; opacity: 0.8;">Total Output</div>
                                        <div id="preview-total-output" style="font-size: 1.25rem; font-weight: bold;">-- gram</div>
                                    </div>
                                    <div>
                                        <div style="color: #000000; font-size: 0.85rem; opacity: 0.8;">% Susut (Shrinkage)</div>
                                        <div id="preview-shrinkage" style="font-size: 1.25rem; font-weight: bold; color: var(--color-danger);">--%</div>
                                    </div>
                                </div>
                            </div>

                            <!-- Operator and Notes -->
                            <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                                <div class="form-group">
                                    <label class="form-label">Operator</label>
                                    <input type="text" id="process-operator" class="form-input" placeholder="Nama operator">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">End Time</label>
                                    <input type="datetime-local" id="process-end-time" class="form-input">
                                </div>
                            </div>

                            <div class="form-group">
                                <label class="form-label">Notes</label>
                                <textarea id="process-notes" class="form-input" rows="2" placeholder="Catatan produksi"></textarea>
                            </div>

                            <div class="form-actions" style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem;">
                                <button type="button" class="btn btn-secondary" onclick="ProductionBatch.closeProcessModal()">Cancel</button>
                                <button type="submit" class="btn btn-success">✅ Complete Batch</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
    },

    renderDetailModal() {
        return `
            <div id="detail-batch-modal" class="modal-overlay hidden">
                <div class="modal" style="max-width: 900px;">
                    <div class="modal-header">
                        <h3 class="modal-title" id="detail-modal-title">Batch Details</h3>
                        <button class="modal-close" onclick="ProductionBatch.closeDetailModal()">&times;</button>
                    </div>
                    <div class="modal-body" id="detail-modal-content">
                        <!-- Content will be populated dynamically -->
                    </div>
                </div>
            </div>
        `;
    },

    // ==========================================
    // MODAL HANDLERS
    // ==========================================

    showCreateModal() {
        const modal = document.getElementById('create-batch-modal');
        if (modal) {
            modal.classList.remove('hidden');
            this.updateBatchSummary();
        }
    },

    closeCreateModal() {
        const modal = document.getElementById('create-batch-modal');
        if (modal) modal.classList.add('hidden');
    },

    updateBatchSummary() {
        const checkboxes = document.querySelectorAll('.jo-checkbox:checked');
        let totalWeight = 0;
        let totalPureAu = 0;

        checkboxes.forEach(cb => {
            // Handle both string and number IDs
            const joId = isNaN(cb.value) ? cb.value : parseInt(cb.value);
            const jo = JobOrder?.getJobOrder(joId);
            if (jo) {
                const grossWeight = jo.input?.grossWeight || jo.grossWeight || 0;
                const kadar = jo.input?.kadar || jo.estimatedKadar || 22;
                const pureAu = jo.input?.actualPureContent ||
                    jo.input?.estimatedPureContent ||
                    jo.labTestResults?.pureContentGrams ||
                    jo.estimatedPureAu ||
                    (grossWeight * kadar / 24) ||
                    0;
                totalWeight += grossWeight;
                totalPureAu += pureAu;
            }
        });

        const joCountEl = document.getElementById('summary-jo-count');
        const weightEl = document.getElementById('summary-weight');
        const pureAuEl = document.getElementById('summary-pure-au');

        if (joCountEl) joCountEl.textContent = checkboxes.length;
        if (weightEl) weightEl.textContent = `${totalWeight.toLocaleString('id-ID')} gram`;
        if (pureAuEl) pureAuEl.textContent = `${totalPureAu.toLocaleString('id-ID', { minimumFractionDigits: 2 })} gram`;
    },

    async handleCreateSubmit(event) {
        event.preventDefault();

        const checkboxes = document.querySelectorAll('.jo-checkbox:checked');
        if (checkboxes.length === 0) {
            alert('Pilih minimal 1 job order untuk batch');
            return;
        }

        const jobOrderIds = Array.from(checkboxes).map(cb => {
            // DOM checkbox values are always strings, but job order IDs are numbers (Date.now())
            return isNaN(cb.value) ? cb.value : parseInt(cb.value);
        });
        const batchData = {
            operator: document.getElementById('batch-operator').value,
            stage: document.getElementById('batch-stage').value,
            notes: document.getElementById('batch-notes').value
        };

        try {
            await this.createBatch(jobOrderIds, batchData);
            alert('Batch berhasil dibuat!');
            this.closeCreateModal();
            this.render();
        } catch (error) {
            alert('Error: ' + error.message);
        }
    },

    async showProcessModal(batchId) {
        const batch = this.getBatch(batchId);
        if (!batch) return;

        // Start processing if draft
        if (batch.status === 'draft') {
            await this.startProcessing(batchId);
        }

        // Populate modal
        document.getElementById('process-batch-id').value = batchId;
        document.getElementById('process-batch-number').textContent = batch.batchNumber;
        document.getElementById('process-jo-count').textContent = batch.totalJobOrders;
        document.getElementById('process-gross-weight').textContent = `${batch.totalGrossWeight.toLocaleString('id-ID')} gram`;
        document.getElementById('process-est-pure').textContent = `${batch.totalEstimatedPureAu.toLocaleString('id-ID', { minimumFractionDigits: 2 })} gram`;
        document.getElementById('process-operator').value = batch.operator || '';

        // Set default end time to now
        const now = new Date();
        document.getElementById('process-end-time').value = now.toISOString().slice(0, 16);

        // Clear output fields
        document.getElementById('output-pure-au').value = '';
        document.getElementById('output-silver').value = '0';
        document.getElementById('output-loss').value = '0';

        // Show modal
        const modal = document.getElementById('process-batch-modal');
        if (modal) modal.classList.remove('hidden');
    },

    closeProcessModal() {
        const modal = document.getElementById('process-batch-modal');
        if (modal) modal.classList.add('hidden');
    },

    calculateYieldPreview() {
        const batchId = document.getElementById('process-batch-id').value;
        const batch = this.getBatch(batchId);
        if (!batch) return;

        const pureAu = parseFloat(document.getElementById('output-pure-au').value) || 0;
        const silver = parseFloat(document.getElementById('output-silver').value) || 0;
        const loss = parseFloat(document.getElementById('output-loss').value) || 0;

        const totalOutput = pureAu + silver + loss;
        const auYield = batch.totalEstimatedPureAu > 0 ? (pureAu / batch.totalEstimatedPureAu) * 100 : 0;
        const agYield = batch.totalGrossWeight > 0 ? (silver / batch.totalGrossWeight) * 100 : 0;

        document.getElementById('preview-au-yield').textContent = `${auYield.toFixed(2)}%`;
        document.getElementById('preview-ag-yield').textContent = `${agYield.toFixed(2)}%`;
        document.getElementById('preview-total-output').textContent = `${totalOutput.toLocaleString('id-ID', { minimumFractionDigits: 2 })} gram`;

        const shrinkagePercent = batch.totalGrossWeight > 0 ? (loss / batch.totalGrossWeight) * 100 : 0;
        document.getElementById('preview-shrinkage').textContent = `${shrinkagePercent.toFixed(2)}%`;

        // Color coding for yield
        const yieldPreview = document.getElementById('yield-preview');
        if (auYield >= 95 && auYield <= 100) {
            yieldPreview.style.background = 'var(--color-success-bg, #d4edda)';
        } else if (auYield > 100 || auYield < 90) {
            yieldPreview.style.background = 'var(--color-danger-bg, #f8d7da)';
        } else {
            yieldPreview.style.background = 'var(--color-warning-bg, #fff3cd)';
        }
    },

    async handleProcessSubmit(event) {
        event.preventDefault();

        const batchId = document.getElementById('process-batch-id').value;
        const pureAu = parseFloat(document.getElementById('output-pure-au').value);
        const silver = parseFloat(document.getElementById('output-silver').value) || 0;
        const loss = parseFloat(document.getElementById('output-loss').value) || 0;

        if (!pureAu || pureAu <= 0) {
            alert('Pure Au harus lebih dari 0');
            return;
        }

        const actualOutput = { pureAu, silver, loss };
        const processData = {
            operator: document.getElementById('process-operator').value,
            endTime: document.getElementById('process-end-time').value,
            notes: document.getElementById('process-notes').value
        };

        try {
            await this.recordOutputAndComplete(batchId, actualOutput, processData);
            alert('Batch berhasil diselesaikan!');
            this.closeProcessModal();
            this.render();
        } catch (error) {
            alert('Error: ' + error.message);
        }
    },

    showDetailModal(batchId) {
        const batch = this.getBatch(batchId);
        if (!batch) return;

        const formattedBatch = this.formatBatchForDisplay(batch);

        let content = `
            <!-- Batch Info -->
            <div class="card" style="background: var(--bg-tertiary); padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;">
                    <div><strong>Batch Number:</strong> ${batch.batchNumber}</div>
                    <div><strong>Tahapan:</strong> <span class="badge badge-info">${batch.stage || 'GENERAL'}</span></div>
                    <div><strong>Status:</strong> ${formattedBatch.statusBadge}</div>
                    <div><strong>Created:</strong> ${formattedBatch.createdDateFormatted}</div>
                    <div><strong>Operator:</strong> ${batch.operator || '-'}</div>
                    <div><strong>Processing Time:</strong> ${formattedBatch.processingTime}</div>
                    <div><strong>Job Orders:</strong> ${batch.totalJobOrders}</div>
                </div>
            </div>

            <!-- Input Summary -->
            <h4>📥 Input Summary</h4>
            <table class="data-table" style="margin-bottom: 1.5rem;">
                <thead>
                    <tr>
                        <th>Job Order</th>
                        <th>Customer</th>
                        <th>Gross Weight</th>
                        <th>Est. Pure Au</th>
                        <th>Proportion</th>
                    </tr>
                </thead>
                <tbody>
                    ${batch.jobOrders.map(jo => `
                        <tr>
                            <td>${jo.jobOrderNumber}</td>
                            <td>${jo.customerName}</td>
                            <td>${jo.grossWeight?.toLocaleString('id-ID')} gram</td>
                            <td>${jo.estimatedPureAu?.toLocaleString('id-ID', { minimumFractionDigits: 2 })} gram</td>
                            <td>${(jo.proportion * 100).toFixed(2)}%</td>
                        </tr>
                    `).join('')}
                    <tr style="font-weight: bold; background: var(--bg-tertiary);">
                        <td colspan="2">TOTAL</td>
                        <td>${batch.totalGrossWeight?.toLocaleString('id-ID')} gram</td>
                        <td>${batch.totalEstimatedPureAu?.toLocaleString('id-ID', { minimumFractionDigits: 2 })} gram</td>
                        <td>100%</td>
                    </tr>
                </tbody>
            </table>
        `;

        // Add output section if completed
        if (batch.status === 'completed' && batch.actualOutput) {
            content += `
                <!-- Output & Yield Analysis -->
                <h4>📤 Output & Shrinkage Analysis</h4>
                <div class="card" style="background: var(--bg-tertiary); padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem;">
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 2rem; text-align: center;">
                        <div style="padding: 1rem; border: 1px solid var(--border-color); border-radius: 8px; background: white;">
                            <div style="color: var(--text-secondary); margin-bottom: 0.5rem;">Pure Gold (Au)</div>
                            <div style="font-size: 1.75rem; font-weight: bold; color: var(--color-success);">${batch.actualOutput.pureAu?.toLocaleString('id-ID', { minimumFractionDigits: 2 })} g</div>
                            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.5rem;">Yield: ${batch.batchYield?.auYieldPercent?.toFixed(2)}%</div>
                        </div>
                        <div style="padding: 1rem; border: 1px solid var(--border-color); border-radius: 8px; background: white;">
                            <div style="color: var(--text-secondary); margin-bottom: 0.5rem;">Silver (Ag)</div>
                            <div style="font-size: 1.75rem; font-weight: bold; color: var(--color-primary);">${batch.actualOutput.silver?.toLocaleString('id-ID', { minimumFractionDigits: 2 })} g</div>
                            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.5rem;">Yield: ${batch.batchYield?.agYieldPercent?.toFixed(2)}%</div>
                        </div>
                        <div style="padding: 1rem; border: 1px solid var(--border-color); border-radius: 8px; background: var(--color-danger-bg, #f8d7da);">
                            <div style="color: var(--color-danger); margin-bottom: 0.5rem; font-weight: bold;">Berat Susut (Loss)</div>
                            <div style="font-size: 1.75rem; font-weight: bold; color: var(--color-danger);">${batch.actualOutput.loss?.toLocaleString('id-ID', { minimumFractionDigits: 2 })} g</div>
                            <div style="font-size: 1rem; font-weight: bold; color: var(--color-danger); margin-top: 0.5rem;">% Susut: ${((batch.actualOutput.loss / batch.totalGrossWeight) * 100).toFixed(2)}%</div>
                        </div>
                    </div>
                </div>

                <!-- Allocation Results -->
                <h4>📊 Allocation Results</h4>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Job Order</th>
                            <th>Customer</th>
                            <th>Input Pure Au</th>
                            <th>Allocated Au</th>
                            <th>Allocated Ag</th>
                            <th>Allocated Loss</th>
                            <th>Yield</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${batch.allocations.map(alloc => `
                            <tr>
                                <td>${alloc.jobOrderNumber}</td>
                                <td>${alloc.customerName}</td>
                                <td>${alloc.inputPureAu?.toLocaleString('id-ID', { minimumFractionDigits: 2 })} gram</td>
                                <td><strong>${alloc.allocatedAu?.toLocaleString('id-ID', { minimumFractionDigits: 2 })} gram</strong></td>
                                <td>${alloc.allocatedAg?.toLocaleString('id-ID', { minimumFractionDigits: 2 })} gram</td>
                                <td>${alloc.allocatedLoss?.toLocaleString('id-ID', { minimumFractionDigits: 2 })} gram</td>
                                <td>${alloc.individualYield?.toFixed(2)}%</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }

        if (batch.notes) {
            content += `
                <div style="margin-top: 1rem;">
                    <strong>Notes:</strong> ${batch.notes}
                </div>
            `;
        }

        document.getElementById('detail-modal-title').textContent = `Batch ${batch.batchNumber}`;
        document.getElementById('detail-modal-content').innerHTML = content;

        const modal = document.getElementById('detail-batch-modal');
        if (modal) modal.classList.remove('hidden');
    },

    closeDetailModal() {
        const modal = document.getElementById('detail-batch-modal');
        if (modal) modal.classList.add('hidden');
    },

    async confirmDelete(batchId) {
        const batch = this.getBatch(batchId);
        if (!batch) return;

        if (confirm(`Hapus batch "${batch.batchNumber}"?\n\nJob orders akan dikembalikan ke status batch_ready.`)) {
            try {
                await this.deleteBatch(batchId);
                alert('Batch berhasil dihapus');
                this.render();
            } catch (error) {
                alert('Error: ' + error.message);
            }
        }
    }
};

// Initialize on page load
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        ProductionBatch.init();
    });
}



// Explicitly make ProductionBatch globally available
window.ProductionBatch = ProductionBatch;
