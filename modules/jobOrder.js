// ==========================================
// Job Order Module
// Customer Gold Tracking for Toll Smelting
// ==========================================

const JobOrder = {
    jobOrders: [],

    /**
     * Initialize module
     */
    init() {
        this.loadJobOrders();
        this.lastWeightReading = null;
        this.lastPurityReading = null;
        this.deviceStates = {
            xrf: 'offline',
            scale: 'offline'
        };
        this.bridgeUrlIndex = 0;
        this.connectHardware(); // Auto-connect to Unified Bridge
        console.log('✅ Job Order module initialized');
    },

    getBridgeUrls() {
        const configured = localStorage.getItem('erp_hardware_bridge_url');
        const defaults = ['ws://127.0.0.1:8765', 'ws://localhost:8765'];
        return configured ? [configured, ...defaults.filter(url => url !== configured)] : defaults;
    },

    connectHardware() {
        if (this.hwWebSocket && this.hwWebSocket.readyState === WebSocket.OPEN) {
            return;
        }

        try {
            const bridgeUrls = this.getBridgeUrls();
            const bridgeUrl = bridgeUrls[this.bridgeUrlIndex] || bridgeUrls[0];
            this.hwStatus = 'connecting';
            this.updateHardwareStatus();

            this.hwWebSocket = new WebSocket(bridgeUrl);

            this.hwWebSocket.onopen = () => {
                console.log(`✅ Hardware Bridge connected: ${bridgeUrl}`);
                localStorage.setItem('erp_hardware_bridge_url', bridgeUrl);
                this.hwStatus = 'connected';
                this.updateHardwareStatus();
            };

            this.hwWebSocket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.type === 'init') {
                    this.hwStatus = data.device_count > 0 ? 'connected' : 'no_devices';
                    if (data.device_count === 0) {
                        this.deviceStates.xrf = 'offline';
                        this.deviceStates.scale = 'offline';
                    }
                    this.updateHardwareStatus();
                } else if (data.type === 'reading') {
                    // Update individual device state based on reading type
                    if (data.data.type === 'purity') {
                        this.deviceStates.xrf = 'online';
                    } else if (data.data.type === 'weight') {
                        this.deviceStates.scale = 'online';
                    }
                    this.handleHardwareReading(data.data);
                } else if (data.type === 'status') {
                    if (data.device_type === 'purity') {
                        this.deviceStates.xrf = (data.status === 'connected') ? 'online' : 'offline';
                    } else if (data.device_type === 'weight') {
                        this.deviceStates.scale = (data.status === 'connected') ? 'online' : 'offline';
                    }
                    this.updateHardwareStatus();
                }
            };

            this.hwWebSocket.onclose = () => {
                this.hwStatus = 'disconnected';
                this.updateHardwareStatus();
                this.bridgeUrlIndex = (this.bridgeUrlIndex + 1) % bridgeUrls.length;
                const delay = this.bridgeUrlIndex === 0 ? 5000 : 800;
                setTimeout(() => this.connectHardware(), delay);
            };

        } catch (error) {
            console.warn('Hardware Bridge connection failed:', error);
            this.hwStatus = 'disconnected';
            this.updateHardwareStatus();
        }
    },

    updateHardwareStatus() {
        const indicator = document.getElementById('jo-hw-status');
        if (!indicator) return;

        // Bridge Status pill
        let bridgeStatusColor = '#ef4444';
        let bridgeText = 'Bridge Offline';
        if (this.hwStatus === 'connected') bridgeStatusColor = '#10b981', bridgeText = 'Bridge Online';
        else if (this.hwStatus === 'no_devices') bridgeStatusColor = '#f59e0b', bridgeText = 'No Devices';

        const bridgeBadge = `<span style="background: ${bridgeStatusColor}; color: white; padding: 2px 6px; border-radius: 4px; font-weight: 600; font-size: 11px; margin-right: 8px;">${bridgeText}</span>`;

        // Scale Badge
        const scaleOnline = (this.deviceStates.scale === 'online' || this.lastWeightReading);
        const scaleBg = scaleOnline ? '#059669' : '#4b5563';
        const scaleText = scaleOnline ? '⚖️ SCALE OK' : '⚖️ SCALE';
        const weightText = this.lastWeightReading ? `<span style="font-family: monospace; font-size: 12px; margin-left:6px; font-weight: 700;">${this.lastWeightReading.weight.toFixed(3)}g</span>` : '';
        const scaleBadge = `
            <div style="background: ${scaleBg}; color: #fff; display: inline-flex; align-items: center; padding: 4px 8px; border-radius: 4px; margin-right: 6px; border: 1px solid ${scaleOnline ? '#10b981' : '#6b7280'};">
                <span style="font-weight: 700; font-size: 11px;">${scaleText}</span>
                ${weightText}
            </div>
        `;

        // XRF Badge
        const xrfOnline = (this.deviceStates.xrf === 'online' || this.lastPurityReading);
        const xrfBg = xrfOnline ? '#7c3aed' : '#4b5563';
        const xrfText = xrfOnline ? '🔬 XRF OK' : '🔬 XRF';
        const purityText = this.lastPurityReading ? `<span style="font-family: monospace; font-size: 12px; margin-left:6px; font-weight: 700;">${this.lastPurityReading.purity}%</span>` : '';
        const xrfBadge = `
            <div style="background: ${xrfBg}; color: #fff; display: inline-flex; align-items: center; padding: 4px 8px; border-radius: 4px; border: 1px solid ${xrfOnline ? '#a78bfa' : '#6b7280'};">
                <span style="font-weight: 700; font-size: 11px;">${xrfText}</span>
                ${purityText}
            </div>
        `;

        indicator.innerHTML = `
            <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 4px; margin-top: 5px;">
                ${bridgeBadge}
                ${scaleBadge}
                ${xrfBadge}
            </div>
        `;
    },

    handleHardwareReading(reading) {
        if (reading.type === 'purity') {
            this.lastPurityReading = reading;
            const kadarInput = document.getElementById('jo-kadar');
            if (kadarInput && !kadarInput.value) {
                kadarInput.value = reading.karat.toFixed(0);
                this.flashInput(kadarInput);
            }
        } else if (reading.type === 'weight') {
            this.lastWeightReading = reading;
            this.updateHardwareStatus();
            const weightInput = document.getElementById('jo-gross-weight');
            if (weightInput && !weightInput.value) {
                weightInput.value = reading.weight.toFixed(2);
                this.flashInput(weightInput);
            }
        }
    },

    captureWeight() {
        if (!this.lastWeightReading) {
            alert('Belum ada data timbangan yang masuk.');
            return;
        }
        const input = document.getElementById('jo-gross-weight');
        if (input) {
            input.value = this.lastWeightReading.weight.toFixed(2);
            this.flashInput(input);
        }
    },

    capturePurity() {
        if (!this.lastPurityReading) {
            alert('Belum ada data XRF yang masuk.');
            return;
        }
        const input = document.getElementById('jo-kadar');
        if (input) {
            input.value = this.lastPurityReading.karat.toFixed(0);
            this.flashInput(input);
        }
    },

    flashInput(el) {
        el.style.backgroundColor = '#d1fae5';
        setTimeout(() => el.style.backgroundColor = '', 1000);
    },

    /**
     * Load job orders from storage
     */
    loadJobOrders() {
        const key = Storage.KEYS.JOB_ORDERS || 'erp_job_orders';
        const stored = Storage.get(key);
        this.jobOrders = stored || [];
        console.log(`📦 Loaded ${this.jobOrders.length} job orders`);
    },

    /**
     * Save job orders to storage
     */
    async saveJobOrders() {
        try {
            // Use standard Storage key
            const key = Storage.KEYS.JOB_ORDERS || 'erp_job_orders';

            // Save to Local/Cloud via Storage helper
            // This handles sync automatically and efficiently
            await Storage.set(key, this.jobOrders);

            console.log(`✅ Saved ${this.jobOrders.length} job orders`);
        } catch (error) {
            console.error('Error saving job orders:', error);
        }
    },

    /**
     * Generate job order number
     */
    generateJobOrderNumber() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');

        const jobOrdersThisMonth = this.jobOrders.filter(jo =>
            jo.jobOrderNumber.startsWith(`JO-${year}${month}`)
        );

        const nextNumber = String(jobOrdersThisMonth.length + 1).padStart(4, '0');
        return `JO-${year}${month}-${nextNumber}`;
    },

    /**
     * Create new job order
     */
    async createJobOrder(data) {
        const currentUser = Auth.getCurrentUser();

        // Validate required fields
        if (!data.customerId || !data.customerName) {
            return { success: false, error: 'Customer information required' };
        }

        if (!data.input || !data.input.grossWeight) {
            return { success: false, error: 'Input weight required' };
        }

        const jobOrderId = Date.now();
        const jobOrderNumber = this.generateJobOrderNumber();

        const jobOrder = {
            id: jobOrderId,
            jobOrderNumber: jobOrderNumber,

            // Customer info
            customerId: data.customerId,
            customerName: data.customerName,
            customerContact: data.customerContact || '',

            // Compliance & Origin
            sourceOfProduct: data.sourceOfProduct || '', // e.g., "Mining Site A" or "Retail Scrap"
            cooReference: data.cooReference || '',     // Certificate of Origin #

            // Input (Customer's gold)
            input: {
                receiptDate: data.input.receiptDate || new Date().toISOString().split('T')[0],
                grossWeight: parseFloat(data.input.grossWeight),
                kadar: data.input.kadar || '',
                estimatedPurity: parseFloat(data.input.estimatedPurity || 0),
                estimatedPureContent: 0, // Will be calculated

                // After lab test
                actualPurity: null,
                actualPureContent: null,
                labTestId: null
            },

            // Processing
            processing: {
                startDate: null,
                expectedCompletionDate: null,
                actualCompletionDate: null,
                status: 'received',  // received, in_process, completed

                // Yield expectations (from pricelist)
                expectedAuReturn: null,
                expectedAgReturn: null,

                // Actual yield (after completion)
                actualAuReturn: null,
                actualAgReturn: null
            },

            // Output (Return to customer)
            output: {
                completionDate: null,
                grossWeight: null,
                purity: null,
                pureContent: null,

                // Yield analysis
                inputPure: null,
                outputPure: null,
                loss: null,
                lossPercentage: null,
                yieldPercentage: null
            },

            // By-products
            byProducts: {
                silver: {
                    quantity: null,
                    ownership: 'customer', // customer | golden_alura | split
                    splitRatio: null
                }
            },

            // Billing
            billing: {
                ratePerGram: null,
                ppn: null,
                pph: null,
                totalRatePerGram: null,

                billedWeight: null,
                processingFee: null,
                ppnAmount: null,
                pphAmount: null,
                totalAmount: null,

                invoiceNumber: null,
                invoiceDate: null,
                paymentStatus: 'unpaid', // unpaid, partial, paid
                paidAmount: 0
            },

            // Status
            status: 'draft', // draft, received, in_process, completed, returned, billed, closed

            // Audit
            createdBy: currentUser.id,
            createdByName: currentUser.name,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Auto-Grading Logic
        if (data.input.kadar && typeof MasterPurity !== 'undefined' && typeof MasterRefiningRules !== 'undefined') {
            const gradeInfo = MasterPurity.getPurityGrade('GOLD', data.input.kadar);
            if (gradeInfo) {
                const rule = MasterRefiningRules.getRule(gradeInfo.id, data.input.grossWeight);
                if (rule) {
                    jobOrder.input.grade = gradeInfo.grade; // e.g., "23K"
                    jobOrder.input.returnPct = rule.au_return_pct; // e.g., 99.98

                    // Special Rule: if 24K (99.99%), treat as 100%
                    const is24K = gradeInfo.grade.includes('24K') || data.input.kadar >= 99.99;
                    const returnFactor = is24K ? 1.0 : (jobOrder.input.returnPct / 100);
                    const rawPurityFactor = (parseFloat(data.input.kadar) || 0) / 100;

                    // Calculate Estimated Pure Content (Payable)
                    jobOrder.input.estimatedPureContent = jobOrder.input.grossWeight * rawPurityFactor * returnFactor;

                    console.log(`✨ Auto-Grading: ${data.input.kadar}% -> ${gradeInfo.grade}. Return: ${jobOrder.input.returnPct}%. Est Pure: ${jobOrder.input.estimatedPureContent.toFixed(3)}g`);
                }
            }
        }

        // Calculate estimated pure content (Fallback)
        if (!jobOrder.input.estimatedPureContent && jobOrder.input.estimatedPurity > 0) {
            jobOrder.input.estimatedPureContent =
                jobOrder.input.grossWeight * jobOrder.input.estimatedPurity;
        }

        this.jobOrders.push(jobOrder);
        await this.saveJobOrders();

        AuditLog.log('create', 'job_order', jobOrderId, `Created job order ${jobOrderNumber} for ${data.customerName}`);

        console.log(`✅ Created job order: ${jobOrderNumber}`);

        return {
            success: true,
            jobOrder: jobOrder
        };
    },

    /**
     * Get job order by ID
     */
    getJobOrder(jobOrderId) {
        // Use == (loose equality) to handle string/number ID mismatches
        // Job order IDs are created as numbers (Date.now()) but may arrive as strings from DOM/storage
        return this.jobOrders.find(jo => jo.id == jobOrderId);
    },

    /**
     * Update job order
     */
    async updateJobOrder(jobOrderId, updates) {
        const jobOrder = this.getJobOrder(jobOrderId);

        if (!jobOrder) {
            return { success: false, error: 'Job order not found' };
        }

        // Update fields
        Object.keys(updates).forEach(key => {
            if (typeof updates[key] === 'object' && !Array.isArray(updates[key])) {
                jobOrder[key] = { ...jobOrder[key], ...updates[key] };
            } else {
                jobOrder[key] = updates[key];
            }
        });

        jobOrder.updatedAt = new Date().toISOString();

        await this.saveJobOrders();
        AuditLog.log('update', 'job_order', jobOrderId, 'Updated job order');

        return {
            success: true,
            jobOrder: jobOrder
        };
    },

    /**
     * Update with lab test results
     */
    async updateWithLabTest(jobOrderId, labTestResults) {
        const jobOrder = this.getJobOrder(jobOrderId);

        if (!jobOrder) {
            return { success: false, error: 'Job order not found' };
        }

        // Update input with actual purity
        jobOrder.input.actualPurity = labTestResults.actualPurityDecimal;
        jobOrder.input.actualPureContent = labTestResults.goldContent;
        jobOrder.input.labTestId = labTestResults.id;

        // Update by-products if available
        if (labTestResults.byProducts && labTestResults.byProducts.silver) {
            jobOrder.byProducts.silver.quantity = labTestResults.byProducts.silver;
        }

        jobOrder.updatedAt = new Date().toISOString();

        await this.saveJobOrders();
        AuditLog.log('update', 'job_order', jobOrderId, 'Updated with lab test results');

        console.log(`✅ Job order ${jobOrder.jobOrderNumber} updated with lab test results`);
        console.log(`   Actual purity: ${(labTestResults.actualPurityDecimal * 100).toFixed(2)}%`);
        console.log(`   Pure content: ${labTestResults.goldContent.toFixed(3)} gram`);

        return {
            success: true,
            jobOrder: jobOrder
        };
    },

    /**
     * Start processing
     */
    async startProcessing(jobOrderId, expectedCompletionDate) {
        const jobOrder = this.getJobOrder(jobOrderId);

        if (!jobOrder) {
            return { success: false, error: 'Job order not found' };
        }

        if (jobOrder.status !== 'received' && jobOrder.status !== 'draft') {
            return { success: false, error: 'Job order must be in received status' };
        }

        jobOrder.processing.startDate = new Date().toISOString().split('T')[0];
        jobOrder.processing.expectedCompletionDate = expectedCompletionDate;
        jobOrder.processing.status = 'in_process';
        jobOrder.status = 'in_process';
        jobOrder.updatedAt = new Date().toISOString();

        await this.saveJobOrders();
        AuditLog.log('update', 'job_order', jobOrderId, 'Started processing');

        console.log(`✅ Started processing job order: ${jobOrder.jobOrderNumber}`);

        return {
            success: true,
            jobOrder: jobOrder
        };
    },

    /**
     * Complete job order with output data
     */
    async completeJobOrder(jobOrderId, outputData) {
        const jobOrder = this.getJobOrder(jobOrderId);

        if (!jobOrder) {
            return { success: false, error: 'Job order not found' };
        }

        if (jobOrder.processing.status !== 'in_process') {
            return { success: false, error: 'Job order must be in process' };
        }

        // Update output
        jobOrder.output.completionDate = new Date().toISOString().split('T')[0];
        jobOrder.output.grossWeight = parseFloat(outputData.grossWeight);
        jobOrder.output.purity = parseFloat(outputData.purity || 0.999);
        jobOrder.output.pureContent = jobOrder.output.grossWeight * jobOrder.output.purity;

        // Calculate yield
        const inputPure = jobOrder.input.actualPureContent || jobOrder.input.estimatedPureContent;
        const outputPure = jobOrder.output.pureContent;

        jobOrder.output.inputPure = inputPure;
        jobOrder.output.outputPure = outputPure;
        jobOrder.output.loss = inputPure - outputPure;
        jobOrder.output.lossPercentage = (jobOrder.output.loss / inputPure) * 100;
        jobOrder.output.yieldPercentage = (outputPure / inputPure) * 100;

        // Update processing
        jobOrder.processing.actualCompletionDate = jobOrder.output.completionDate;
        jobOrder.processing.status = 'completed';
        jobOrder.processing.actualAuReturn = jobOrder.output.yieldPercentage;

        // --- GOLD BALANCE SETTLEMENT ---
        // Calculate Variance: Payable (Input Pure) - Actual Handover (Output Pure)
        // If Output < Input -> We owe customer (Deposit)
        // If Output > Input -> Customer owes us (Obligation)
        // Note: For Job Order, 'outputPure' is what we give back.
        // But 'inputPure' is what we promised (Payable).

        // Wait! logic check:
        // inputPure = 99.5g (Payable)
        // outputPure = 100g (We gave physical bar)
        // Variance = 0.5g (Customer owes us)

        // inputPure = 100g (Payable)
        // outputPure = 99.8g (We gave physical bar)
        // Variance = 0.2g (We owe customer)

        const variance = inputPure - outputPure;
        // Positive = We owe customer (Input > Output)
        // Negative = Customer owes us (Input < Output)

        if (Math.abs(variance) > 0.001) {
            if (typeof GoldSavings !== 'undefined') {
                const type = variance > 0 ? 'DEPOSIT' : 'OBLIGATION';
                GoldSavings.addTransaction({
                    customerId: jobOrder.customerId,
                    type: type,
                    weight: variance, // Save signed value? Or absolute? 
                    // GoldSavings.addTransaction takes signed weight: Positive adds to balance (We owe customer)
                    // So variance is correct.
                    description: `Job Order Variance: ${jobOrder.jobOrderNumber}`,
                    referenceId: jobOrder.jobOrderNumber
                });
                console.log(`⚖️ Gold Settlement: ${variance.toFixed(3)}g recorded as ${type}`);
            }
        }

        // Update status
        jobOrder.status = 'completed';
        jobOrder.updatedAt = new Date().toISOString();

        await this.saveJobOrders();
        AuditLog.log('update', 'job_order', jobOrderId, 'Completed processing');

        console.log(`✅ Completed job order: ${jobOrder.jobOrderNumber}`);
        console.log(`   Input (Payable): ${inputPure.toFixed(3)} gram pure`);
        console.log(`   Output (Physical): ${outputPure.toFixed(3)} gram pure`);
        console.log(`   Yield: ${jobOrder.output.yieldPercentage.toFixed(2)}%`);
        console.log(`   Variance: ${variance.toFixed(3)} gram (${variance > 0 ? 'We owe Customer' : 'Customer owes Us'})`);

        return {
            success: true,
            jobOrder: jobOrder,
            yield: {
                inputPure: inputPure,
                outputPure: outputPure,
                loss: jobOrder.output.loss,
                yieldPercentage: jobOrder.output.yieldPercentage,
                variance: variance
            }
        };
    },

    /**
     * Return gold to customer
     */
    async returnToCustomer(jobOrderId) {
        const jobOrder = this.getJobOrder(jobOrderId);

        if (!jobOrder) {
            return { success: false, error: 'Job order not found' };
        }

        if (jobOrder.status !== 'completed' && jobOrder.status !== 'billed') {
            return { success: false, error: 'Job order must be completed or billed' };
        }

        jobOrder.status = 'returned';
        jobOrder.updatedAt = new Date().toISOString();

        await this.saveJobOrders();
        AuditLog.log('update', 'job_order', jobOrderId, 'Returned gold to customer');

        console.log(`✅ Returned gold to customer: ${jobOrder.jobOrderNumber}`);

        return {
            success: true,
            jobOrder: jobOrder
        };
    },

    /**
     * Get all job orders
     */
    getAllJobOrders() {
        return this.jobOrders;
    },

    /**
     * Get job orders by status
     */
    getJobOrdersByStatus(status) {
        return this.jobOrders.filter(jo => jo.status === status);
    },

    /**
     * Get job orders by customer
     */
    getJobOrdersByCustomer(customerId) {
        return this.jobOrders.filter(jo => jo.customerId === customerId);
    },

    /**
     * Get yield analysis report
     */
    getYieldAnalysisReport(filters = {}) {
        let jobOrders = this.jobOrders.filter(jo => jo.status === 'completed' || jo.status === 'returned' || jo.status === 'billed');

        // Apply filters
        if (filters.customerId) {
            jobOrders = jobOrders.filter(jo => jo.customerId === filters.customerId);
        }

        if (filters.dateFrom) {
            jobOrders = jobOrders.filter(jo => jo.output.completionDate >= filters.dateFrom);
        }

        if (filters.dateTo) {
            jobOrders = jobOrders.filter(jo => jo.output.completionDate <= filters.dateTo);
        }

        // Calculate statistics
        const totalJobs = jobOrders.length;
        const totalInputPure = jobOrders.reduce((sum, jo) => sum + (jo.output.inputPure || 0), 0);
        const totalOutputPure = jobOrders.reduce((sum, jo) => sum + (jo.output.outputPure || 0), 0);
        const totalLoss = totalInputPure - totalOutputPure;
        const averageYield = totalInputPure > 0 ? (totalOutputPure / totalInputPure) * 100 : 0;

        return {
            success: true,
            data: jobOrders.map(jo => ({
                jobOrderNumber: jo.jobOrderNumber,
                customerName: jo.customerName,
                completionDate: jo.output.completionDate,
                inputPure: jo.output.inputPure,
                outputPure: jo.output.outputPure,
                loss: jo.output.loss,
                yieldPercentage: jo.output.yieldPercentage
            })),
            summary: {
                totalJobs: totalJobs,
                totalInputPure: totalInputPure,
                totalOutputPure: totalOutputPure,
                totalLoss: totalLoss,
                lossPercentage: totalInputPure > 0 ? (totalLoss / totalInputPure) * 100 : 0,
                averageYield: averageYield
            }
        };
    },

    /**
     * Format currency
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
     * Format date
     */
    formatDate(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString('id-ID', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    },

    // ==========================================
    // UI RENDERING
    // ==========================================

    render() {
        this.loadJobOrders();
        const mainContent = document.getElementById('main-content');

        // Calculate stats
        const stats = {
            total: this.jobOrders.length,
            draft: this.jobOrders.filter(jo => jo.status === 'draft').length,
            received: this.jobOrders.filter(jo => jo.status === 'received').length,
            inProcess: this.jobOrders.filter(jo => jo.status === 'in_process' || jo.status === 'in_batch').length,
            completed: this.jobOrders.filter(jo => jo.status === 'completed' || jo.status === 'processed').length
        };

        mainContent.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">📋 Job Orders</h1>
                <p class="page-subtitle">Customer gold tracking for toll smelting</p>
            </div>

            <!-- Summary Cards -->
            <div class="stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
                <div class="stat-card" style="background: var(--bg-secondary); padding: 1.5rem; border-radius: 12px; text-align: center;">
                    <div style="font-size: 2rem; font-weight: bold; color: var(--color-primary);">${stats.total}</div>
                    <div style="color: var(--text-secondary);">Total Orders</div>
                </div>
                <div class="stat-card" style="background: var(--bg-secondary); padding: 1.5rem; border-radius: 12px; text-align: center;">
                    <div style="font-size: 2rem; font-weight: bold; color: var(--color-secondary);">${stats.draft}</div>
                    <div style="color: var(--text-secondary);">Draft</div>
                </div>
                <div class="stat-card" style="background: var(--bg-secondary); padding: 1.5rem; border-radius: 12px; text-align: center;">
                    <div style="font-size: 2rem; font-weight: bold; color: var(--color-info);">${stats.received}</div>
                    <div style="color: var(--text-secondary);">Received</div>
                </div>
                <div class="stat-card" style="background: var(--bg-secondary); padding: 1.5rem; border-radius: 12px; text-align: center;">
                    <div style="font-size: 2rem; font-weight: bold; color: var(--color-warning);">${stats.inProcess}</div>
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
                    <select id="status-filter" class="form-select" onchange="JobOrder.filterByStatus(this.value)" style="min-width: 150px;">
                        <option value="all">All Status</option>
                        <option value="draft">Draft</option>
                        <option value="received">Received</option>
                        <option value="in_process">In Process</option>
                        <option value="in_batch">In Batch</option>
                        <option value="completed">Completed</option>
                    </select>
                </div>
                <button class="btn btn-primary" onclick="JobOrder.showCreateModal()">
                    ➕ New Job Order
                </button>
            </div>

            <!-- Job Orders Table -->
            <div class="card">
                <div class="card-header">
                    <h3>📦 Daftar Job Orders</h3>
                </div>
                <div class="card-body" style="overflow-x: auto;">
                    <table class="data-table" id="job-orders-table">
                        <thead>
                            <tr>
                                <th style="width: 140px; min-width: 140px;">Job Order #</th>
                                <th style="width: 100px;">Date</th>
                                <th style="min-width: 200px;">Customer</th>
                                <th style="width: 120px;">Gross Weight</th>
                                <th style="width: 80px;">Kadar</th>
                                <th style="width: 120px;">Est. Pure</th>
                                <th style="width: 100px;">Status</th>
                                <th style="width: 100px;">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="job-orders-tbody">
                            ${this.renderJobOrderRows()}
                        </tbody>
                    </table>
                    ${this.jobOrders.length === 0 ? '<p style="text-align: center; padding: 2rem; color: var(--text-secondary);">No job orders found. Click "New Job Order" to create one.</p>' : ''}
                </div>
            </div>

            <!-- Create Modal -->
            ${this.renderCreateModal()}
        `;
    },

    renderJobOrderRows(filter = 'all') {
        let orders = [...this.jobOrders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        if (filter !== 'all') {
            orders = orders.filter(jo => jo.status === filter);
        }

        if (orders.length === 0) {
            return '<tr><td colspan="8" style="text-align: center; padding: 2rem;">No job orders found</td></tr>';
        }

        return orders.map(jo => {
            const grossWeight = jo.input?.grossWeight || 0;
            const kadar = jo.input?.kadar || '-';
            const estimatedPure = jo.input?.actualPureContent || jo.input?.estimatedPureContent || 0;
            const statusBadge = this.getStatusBadge(jo.status);

            return `
                <tr>
                    <td><strong>${jo.jobOrderNumber}</strong></td>
                    <td>${this.formatDate(jo.createdAt)}</td>
                    <td>${jo.customerName}</td>
                    <td>${grossWeight.toLocaleString('id-ID')} gram</td>
                    <td>${kadar}K</td>
                    <td>${estimatedPure.toLocaleString('id-ID', { minimumFractionDigits: 2 })} gram</td>
                    <td>${statusBadge}</td>
                    <td>
                        <div style="display: flex; gap: 0.25rem;">
                            <button class="btn btn-sm btn-info" onclick="JobOrder.showDetailModal(${jo.id})" title="View Details">
                                👁️
                            </button>
                            <button class="btn btn-sm btn-secondary" onclick="JobOrder.printJobOrder(${jo.id})" title="Print PDF">
                                📄
                            </button>
                            ${jo.status === 'draft' ? `
                                <button class="btn btn-sm btn-success" onclick="JobOrder.receiveJobOrder(${jo.id})" title="Mark Received">
                                    ✅
                                </button>
                            ` : ''}
                            ${jo.batchId ? `
                                <span class="badge badge-warning" title="In batch ${jo.batchNumber}">🔄</span>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    getStatusBadge(status) {
        const badges = {
            draft: '<span class="badge badge-secondary">Draft</span>',
            received: '<span class="badge badge-info">Received</span>',
            in_process: '<span class="badge badge-warning">In Process</span>',
            in_batch: '<span class="badge badge-warning">In Batch</span>',
            completed: '<span class="badge badge-success">Completed</span>',
            processed: '<span class="badge badge-success">Processed</span>',
            returned: '<span class="badge badge-primary">Returned</span>',
            billed: '<span class="badge badge-primary">Billed</span>'
        };
        return badges[status] || `<span class="badge">${status}</span>`;
    },

    filterByStatus(status) {
        const tbody = document.getElementById('job-orders-tbody');
        if (tbody) {
            tbody.innerHTML = this.renderJobOrderRows(status);
        }
    },

    showCreateModal() {
        // Ensure connected
        this.connectHardware();

        // Get customers for dropdown
        const customers = Storage.getCustomers ? Storage.getCustomers() : (Storage.get('erp_customers') || []);

        const modal = document.createElement('div');
        modal.id = 'create-jo-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal" style="max-width: 850px; width: 95%;">
                <div class="modal-header">
                    <h3 class="modal-title">Create New Job Order</h3>
                    <button class="modal-close" onclick="JobOrder.closeCreateModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <!-- Hardware Status -->
                    <div id="jo-hw-status" style="margin-bottom: 1rem; text-align: right;">
                        <span class="badge badge-secondary">⚪ Checking Hardware...</span>
                    </div>

                    <form id="create-jo-form" onsubmit="JobOrder.handleCreateSubmit(event)">
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label class="form-label required">Customer</label>
                            <select id="jo-customer" class="form-select" required onchange="JobOrder.onCustomerSelect(this)">
                                <option value="">-- Select Customer --</option>
                                ${customers.map(c => `<option value="${c.id}" data-name="${c.name}">${c.code} - ${c.name}</option>`).join('')}
                            </select>
                            <div id="jo-kyc-status" style="margin-top: 0.5rem; font-size: 0.85rem; padding: 0.5rem; border-radius: 4px; display: none;">
                                <!-- Verification Status will appear here -->
                            </div>
                        </div>

                        <div class="form-row" style="display: grid; grid-template-columns: 1.5fr 1fr 1.2fr; gap: 1.5rem; margin-bottom: 1.5rem;">
                            <div class="form-group">
                                <label class="form-label required">Gross Weight (gram)</label>
                                <div class="flex gap-1">
                                    <input type="number" id="jo-gross-weight" class="form-input" required min="0" step="0.01">
                                    <button type="button" class="btn btn-sm btn-outline" onclick="JobOrder.captureWeight()" title="Ambil dari timbangan">📥</button>
                                </div>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Kadar (K)</label>
                                <div class="flex gap-1">
                                    <input type="number" id="jo-kadar" class="form-input" min="0" max="24" step="1" value="22">
                                    <button type="button" class="btn btn-sm btn-outline" onclick="JobOrder.capturePurity()" title="Ambil dari XRF">📥</button>
                                </div>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Receipt Date</label>
                                <input type="date" id="jo-receipt-date" class="form-input" value="${new Date().toISOString().split('T')[0]}">
                            </div>
                        </div>

                        <div class="form-row" style="display: grid; grid-template-columns: 1.5fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem;">
                            <div class="form-group">
                                <label class="form-label">Source of Product (Origin)</label>
                                <input type="text" id="jo-source" class="form-input" placeholder="e.g. Mining Site, City, or Supplier Name">
                            </div>
                            <div class="form-group">
                                <label class="form-label">COO Reference #</label>
                                <input type="text" id="jo-coo-ref" class="form-input" placeholder="Certificate of Origin Number">
                            </div>
                        </div>

                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label class="form-label">Contact Person</label>
                            <input type="text" id="jo-contact" class="form-input" placeholder="Customer contact person">
                        </div>

                        <div class="form-actions" style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem;">
                            <button type="button" class="btn btn-secondary" onclick="JobOrder.closeCreateModal()">Cancel</button>
                            <button type="submit" class="btn btn-primary">Create Job Order</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    },

    closeCreateModal() {
        const modal = document.getElementById('create-jo-modal');
        if (modal) modal.remove();
    },

    onCustomerSelect(select) {
        const customerId = select.value;
        const statusDiv = document.getElementById('jo-kyc-status');
        const submitBtn = document.querySelector('#create-jo-form button[type="submit"]');

        if (!customerId) {
            if (statusDiv) statusDiv.style.display = 'none';
            if (submitBtn) submitBtn.disabled = true;
            return;
        }

        // Check KYC Status via CustomerKYC module
        if (typeof CustomerKYC !== 'undefined') {
            const check = CustomerKYC.checkKYCStatus(customerId);
            statusDiv.style.display = 'block';

            if (check.approved) {
                statusDiv.className = 'kyc-approved';
                statusDiv.style.background = '#dcfce7';
                statusDiv.style.color = '#166534';
                statusDiv.style.border = '1px solid #166534';
                statusDiv.innerHTML = `<strong>✅ KYC Approved:</strong> Surat Pernyataan ${check.kyc?.declarationNumber || '-'} valid sampai ${CustomerKYC.formatDate(check.kyc?.expiryDate)}.`;
                if (submitBtn) submitBtn.disabled = false;
            } else {
                statusDiv.className = 'kyc-warning';
                statusDiv.style.background = '#fee2e2';
                statusDiv.style.color = '#991b1b';
                statusDiv.style.border = '1px solid #991b1b';
                statusDiv.innerHTML = `<strong>⚠️ Compliance Alert:</strong> ${check.reason}. <br> <small>Mohon lengkapi Surat Pernyataan di modul KYC sebelum memproses barang.</small>`;
                if (submitBtn) submitBtn.disabled = true;
                
                // Special check for GUEST_SAFETY - if we are in safety mode, we allow it (for testing/sim)
                const session = JSON.parse(localStorage.getItem('erp_current_session') || '{}');
                if (session.role === 'GUEST_SAFETY') {
                    statusDiv.innerHTML += '<br><strong>(Sim mode: Allowed for testing)</strong>';
                    if (submitBtn) submitBtn.disabled = false;
                }
            }
        }
    },

    async handleCreateSubmit(event) {
        event.preventDefault();

        // UI Feedback: Lock Button
        const submitBtn = event.target.querySelector('button[type="submit"]');
        const originalText = submitBtn ? submitBtn.textContent : 'Create Job Order';
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '⏳ Creating...';
        }

        const customerSelect = document.getElementById('jo-customer');
        const selectedOption = customerSelect.options[customerSelect.selectedIndex];

        const data = {
            customerId: customerSelect.value,
            customerName: selectedOption.dataset.name,
            customerContact: document.getElementById('jo-contact').value,
            sourceOfProduct: document.getElementById('jo-source').value,
            cooReference: document.getElementById('jo-coo-ref').value,
            input: {
                grossWeight: parseFloat(document.getElementById('jo-gross-weight').value),
                kadar: document.getElementById('jo-kadar').value,
                receiptDate: document.getElementById('jo-receipt-date').value,
                estimatedPurity: parseFloat(document.getElementById('jo-kadar').value) / 24
            }
        };

        try {
            const result = await this.createJobOrder(data); // Awaited!
            if (result.success) {
                alert(`Job Order ${result.jobOrder.jobOrderNumber} created successfully!`);
                this.closeCreateModal();
                this.render();
            } else {
                alert('Error: ' + result.error);
            }
        } catch (error) {
            console.error('Job Order Submit Error:', error);
            alert('Error: ' + error.message);
        } finally {
            // UI Feedback: Unlock
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        }
    },

    receiveJobOrder(jobOrderId) {
        const jo = this.getJobOrder(jobOrderId);
        if (!jo) return;

        if (confirm(`Mark job order ${jo.jobOrderNumber} as received?`)) {
            this.updateJobOrder(jobOrderId, { status: 'received' });
            this.render();
        }
    },

    showDetailModal(jobOrderId) {
        const jo = this.getJobOrder(jobOrderId);
        if (!jo) return;

        const modal = document.createElement('div');
        modal.id = 'detail-jo-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal" style="max-width: 700px;">
                <div class="modal-header">
                    <h3 class="modal-title">Job Order: ${jo.jobOrderNumber}</h3>
                    <button class="modal-close" onclick="document.getElementById('detail-jo-modal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="card" style="background: var(--bg-tertiary); padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <div><strong>Customer:</strong> ${jo.customerName}</div>
                            <div><strong>Status:</strong> ${this.getStatusBadge(jo.status)}</div>
                            <div><strong>Created:</strong> ${this.formatDate(jo.createdAt)}</div>
                            <div><strong>Receipt Date:</strong> ${this.formatDate(jo.input?.receiptDate)}</div>
                        </div>
                    </div>

                    <h4>📜 Compliance & Origin</h4>
                    <div class="card" style="background: #f1f5f9; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; border-left: 4px solid #3b82f6; color: #000000;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <div><strong>Source of Product:</strong> ${jo.sourceOfProduct || '<span class="text-gray">Not recorded</span>'}</div>
                            <div><strong>COO Reference #:</strong> ${jo.cooReference || '<span class="text-gray">Not recorded</span>'}</div>
                        </div>
                    </div>

                    <h4>📥 Input</h4>
                    <table class="data-table" style="margin-bottom: 1rem;">
                        <tr>
                            <td><strong>Gross Weight:</strong></td>
                            <td>${jo.input?.grossWeight?.toLocaleString('id-ID')} gram</td>
                        </tr>
                        <tr>
                            <td><strong>Kadar:</strong></td>
                            <td>${jo.input?.kadar || '-'}K</td>
                        </tr>
                        <tr>
                            <td><strong>Est. Purity:</strong></td>
                            <td>${jo.input?.estimatedPurity ? (jo.input.estimatedPurity * 100).toFixed(2) + '%' : '-'}</td>
                        </tr>
                        <tr>
                            <td><strong>Est. Pure Content:</strong></td>
                            <td>${jo.input?.estimatedPureContent?.toLocaleString('id-ID', { minimumFractionDigits: 2 }) || '-'} gram</td>
                        </tr>
                    </table>

                    ${jo.batchId ? `
                        <h4>🔄 Batch Information</h4>
                        <div class="card" style="background: var(--color-warning-bg, #fff3cd); padding: 1rem; border-radius: 8px; margin-bottom: 1rem; color: #000000;">
                            <div><strong>Batch Number:</strong> ${jo.batchNumber}</div>
                            <div><strong>Batch Stage:</strong> <span class="badge badge-info">${jo.batchStage || '-'}</span></div>
                            <div><strong>Batch Status:</strong> ${jo.batchStatus || '-'}</div>
                            ${jo.allocatedPureAu ? `<div><strong>Allocated Au:</strong> ${jo.allocatedPureAu?.toLocaleString('id-ID', { minimumFractionDigits: 2 })} gram</div>` : ''}
                            ${jo.allocatedSilver ? `<div><strong>Allocated Ag:</strong> ${jo.allocatedSilver?.toLocaleString('id-ID', { minimumFractionDigits: 2 })} gram</div>` : ''}
                            ${jo.allocatedLoss ? `<div style="color: var(--color-danger); font-weight: bold;"><strong>Allocated Loss:</strong> ${jo.allocatedLoss?.toLocaleString('id-ID', { minimumFractionDigits: 2 })} gram</div>` : ''}
                        </div>
                    ` : ''}

                    ${jo.output?.completionDate ? `
                        <h4>📤 Output</h4>
                        <table class="data-table">
                            <tr>
                                <td><strong>Output Weight:</strong></td>
                                <td>${jo.output.grossWeight?.toLocaleString('id-ID')} gram</td>
                            </tr>
                            <tr>
                                <td><strong>Yield:</strong></td>
                                <td>${jo.output.yieldPercentage?.toFixed(2)}%</td>
                            </tr>
                            <tr>
                                <td><strong>Loss:</strong></td>
                                <td>${jo.output.loss?.toFixed(4)} gram (${jo.output.lossPercentage?.toFixed(2)}%)</td>
                            </tr>
                        </table>
                    ` : ''}
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    },

    renderCreateModal() {
        // This is a placeholder for inline modal rendering (modal is created dynamically in showCreateModal)
        return '';
    },

    printJobOrder(id) {
        const jo = this.getJobOrder(id);
        if (!jo) return;
        const config = Storage.get(Storage.KEYS.CONFIG) || {};
        if (typeof PDFExporter !== 'undefined' && PDFExporter.exportJobOrder) {
            PDFExporter.exportJobOrder(jo, config);
        } else {
            alert('PDF Exporter module not loaded or exportJobOrder missing.');
        }
    }
};



// Explicitly make JobOrder globally available
window.JobOrder = JobOrder;
