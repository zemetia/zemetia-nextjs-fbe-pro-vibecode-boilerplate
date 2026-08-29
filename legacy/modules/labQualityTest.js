// ==========================================
// Lab Quality Test Module
// Recording sample purity standards per batch
// ==========================================

const LabQualityTest = {
    samples: [],

    init() {
        this.loadSamples();
        console.log('🧪 Lab Quality Test module initialized');
    },

    loadSamples() {
        this.samples = Storage.get('LAB_QUALITY_SAMPLES') || [];
    },

    async saveSamples() {
        await Storage.set('LAB_QUALITY_SAMPLES', this.samples);
    },

    /**
     * Get sample for a batch
     */
    getSampleByBatch(batchId) {
        return this.samples.find(s => s.batchId === batchId);
    },

    /**
     * Save/Update sample data
     */
    async saveSample(sampleData) {
        const existingIndex = this.samples.findIndex(s => s.batchId === sampleData.batchId);

        const timestamp = new Date().toISOString();
        const user = Auth.getCurrentUser();

        if (existingIndex > -1) {
            this.samples[existingIndex] = {
                ...this.samples[existingIndex],
                ...sampleData,
                updatedAt: timestamp,
                updatedBy: user?.username || 'system'
            };
        } else {
            // ☁️ Use Atomic Cloud Sequencer for Sample ID
            const samNumber = await Storage.getNextReferenceNumber('SAM');

            this.samples.push({
                ...sampleData,
                id: samNumber || `SAMPLE-${Date.now()}`,
                createdAt: timestamp,
                createdBy: user?.username || 'system'
            });
        }

        await this.saveSamples();

        AuditLog.log('lab_quality', 'save_sample', sampleData.batchId, {
            batchNumber: sampleData.batchNumber,
            au: sampleData.auPercent
        });

        return { success: true };
    },

    /**
     * Calculate storage weight based on total - testing
     */
    calculateStorageWeight() {
        const totalInput = document.getElementById('sample-weight');
        const testingInput = document.getElementById('testing-weight');
        const storageInput = document.getElementById('storage-weight');

        if (totalInput && testingInput && storageInput) {
            const total = parseFloat(totalInput.value) || 0;
            const testing = parseFloat(testingInput.value) || 0;
            const storage = Math.max(0, total - testing);
            storageInput.value = storage.toFixed(3);

            // Calculate Net Production Weight
            const joId = document.getElementById('sample-jo-id')?.value;
            const netDisplay = document.getElementById('net-production-weight');
            if (joId && netDisplay) {
                const jo = JobOrder.getJobOrder(joId);
                if (jo) {
                    const initialWeight = jo.input?.grossWeight || 0;
                    const net = Math.max(0, initialWeight - total);
                    netDisplay.innerText = `${net.toFixed(3)} g`;
                }
            }
        }
    },

    handleMethodChange(method) {
        const icpFields = document.getElementById('icp-fields');
        const auInput = document.getElementById('au-percent');
        const auHelper = document.getElementById('au-helper-text');

        if (method === 'icp') {
            if (icpFields) icpFields.classList.remove('hidden');
            if (auInput) {
                auInput.readOnly = true;
                auInput.style.backgroundColor = 'var(--bg-tertiary)';
            }
            if (auHelper) {
                auHelper.innerText = 'Kadar Emas dihitung otomatis (100% - Total Pengotor %);';
                auHelper.style.color = 'var(--color-primary)';
            }
            this.calculateICP();
        } else {
            if (icpFields) icpFields.classList.add('hidden');
            if (auInput) {
                auInput.readOnly = false;
                auInput.style.backgroundColor = '';
            }
            if (auHelper) {
                auHelper.innerText = 'Contoh: 90.50';
                auHelper.style.color = 'var(--text-secondary)';
            }
        }
    },

    calculateICP() {
        const methodSelect = document.getElementById('analysis-method');
        if (!methodSelect || methodSelect.value !== 'icp') return;

        const auInput = document.getElementById('au-percent');
        if (!auInput) return;

        const ag = parseFloat(document.getElementById('ag-percent').value) || 0;
        const cu = parseFloat(document.getElementById('cu-percent').value) || 0;
        const pb = parseFloat(document.getElementById('pb-percent').value) || 0;
        const fe = parseFloat(document.getElementById('fe-percent').value) || 0;
        const zn = parseFloat(document.getElementById('zn-percent').value) || 0;
        const ni = parseFloat(document.getElementById('ni-percent').value) || 0;
        const other = parseFloat(document.getElementById('other-percent').value) || 0;

        const totalImpurities = ag + cu + pb + fe + zn + ni + other;
        const au = Math.max(0, 100 - totalImpurities);
        auInput.value = au.toFixed(4);
    },

    // ==========================================
    // UI RENDERING
    // ==========================================

    render() {
        const mainContent = document.getElementById('main-content');

        // Get batches (only those that are in_process or completed)
        const batches = ProductionBatch.getAllBatches();

        mainContent.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">🧪 Lab Quality & Reference Stock</h1>
                <p class="page-subtitle">Input kadar standar dan kelola stok simpanan sampel lab</p>
            </div>

            <div class="tabs" style="display: flex; gap: 1rem; margin-bottom: 2rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
                <button class="btn btn-sm" id="tab-input" onclick="LabQualityTest.switchTab('input')" style="background: var(--bg-secondary);">📥 Input Hasil Sampel</button>
                <button class="btn btn-sm" id="tab-stock" onclick="LabQualityTest.switchTab('stock')" style="background: transparent;">📦 Stok Simpanan Lab</button>
            </div>

            <div id="lab-input-section" class="card" style="max-width: 800px; margin: 0 auto;">
                <div class="card-header">
                    <h3>Input Hasil Uji Sampel (Per Batang)</h3>
                </div>
                <div class="card-body">
                    <form id="lab-sample-form" onsubmit="LabQualityTest.handleSubmit(event)">
                        <div class="form-group mb-4">
                            <label class="form-label required">Pilih Production Batch</label>
                            <select id="sample-batch-id" class="form-select" required onchange="LabQualityTest.handleBatchChange(this.value)">
                                <option value="">-- Pilih Batch --</option>
                                ${batches.map(b => `
                                    <option value="${b.id}">${b.batchNumber} - ${new Date(b.createdDate).toLocaleDateString('id-ID')}</option>
                                `).join('')}
                            </select>
                        </div>

                        <div id="jo-selection-wrapper" class="form-group mb-4 hidden">
                            <label class="form-label required">Pilih Bar / Job Order (Asal Sampel)</label>
                            <select id="sample-jo-id" class="form-select" required onchange="LabQualityTest.handleJOChange(this.value)">
                                <option value="">-- Pilih Job Order --</option>
                            </select>
                            <small id="jo-ref-data" style="color: var(--text-secondary); display: block; margin-top: 0.25rem;">-</small>
                        </div>

                        <div id="sample-input-fields" class="hidden">
                            <div style="background: var(--bg-tertiary); padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                    <div>
                                        <strong>Batch Info:</strong>
                                        <div id="display-batch-info" style="font-size: 0.9rem; color: var(--text-secondary);">-</div>
                                    </div>
                                    <div id="existing-sample-indicator" class="hidden">
                                        <span class="badge badge-info">Sudah ada data sampel</span>
                                    </div>
                                </div>
                            </div>

                            <h4 style="margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">Data Pengambilan Sampel (Gram)</h4>
                            <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
                                <div class="form-group">
                                    <label class="form-label required">Total Berat Sampel (g)</label>
                                    <input type="number" id="sample-weight" class="form-input" required step="0.001" min="0" placeholder="0.000" oninput="LabQualityTest.calculateStorageWeight()">
                                    <small style="color: var(--text-secondary);">Total yang diambil dari batang</small>
                                </div>
                                <div class="form-group">
                                    <label class="form-label required">Berat Testing (g)</label>
                                    <input type="number" id="testing-weight" class="form-input" required step="0.001" min="0" placeholder="0.000" oninput="LabQualityTest.calculateStorageWeight()">
                                    <small style="color: var(--text-secondary);">Jumlah yang diuji/dibakar</small>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Sisa Simpan (g)</label>
                                    <input type="number" id="storage-weight" class="form-input" readonly step="0.001" placeholder="0.000" style="background: var(--bg-tertiary);">
                                    <small style="color: var(--text-secondary);">Disimpan di Gudang Lab</small>
                                </div>
                            </div>

                            <div style="background: var(--color-primary-light); color: var(--color-primary); padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center; border: 1px dashed var(--color-primary);">
                                <strong>Estimasi Berat Lanjut Produksi:</strong>
                                <span id="net-production-weight" style="font-size: 1.2rem; font-weight: 800;">0.000 g</span>
                            </div>

                            <div class="form-group mb-4">
                                <label class="form-label required">Metode Analisis Lab</label>
                                <select id="analysis-method" class="form-select" required onchange="LabQualityTest.handleMethodChange(this.value)">
                                    <option value="fire_assay" selected>Fire Assay (Kupelasi)</option>
                                    <option value="icp">ICP-OES (Impurities/Difference)</option>
                                </select>
                            </div>

                            <h4 style="margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">Komposisi Sampel (% Berat)</h4>
                            
                            <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                                <div class="form-group">
                                    <label class="form-label required">Kadar Emas (Au) %</label>
                                    <input type="number" id="au-percent" class="form-input" required step="0.01" min="0" max="100" placeholder="0.00">
                                    <small style="color: var(--text-secondary);" id="au-helper-text">Contoh: 90.50</small>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Kadar Perak (Ag) %</label>
                                    <input type="number" id="ag-percent" class="form-input" step="0.01" min="0" max="100" placeholder="0.00" oninput="LabQualityTest.calculateICP()">
                                </div>
                            </div>

                            <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
                                <div class="form-group">
                                    <label class="form-label">Kadar Tembaga (Cu) %</label>
                                    <input type="number" id="cu-percent" class="form-input" step="0.01" min="0" max="100" placeholder="0.00" oninput="LabQualityTest.calculateICP()">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Logam Lain / Impurities %</label>
                                    <input type="number" id="other-percent" class="form-input" step="0.01" min="0" max="100" placeholder="0.00" oninput="LabQualityTest.calculateICP()">
                                </div>
                            </div>

                            <div id="icp-fields" class="hidden" style="background: var(--bg-tertiary); padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; border: 1px solid var(--border-color);">
                                <h5 style="margin-top: 0; margin-bottom: 0.75rem; color: var(--color-primary);">Kadar Pengotor ICP-OES (% Berat)</h5>
                                <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                                    <div class="form-group">
                                        <label class="form-label">Kadar Timbal (Pb) %</label>
                                        <input type="number" id="pb-percent" class="form-input" step="0.0001" min="0" max="100" placeholder="0.0000" oninput="LabQualityTest.calculateICP()">
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">Kadar Besi (Fe) %</label>
                                        <input type="number" id="fe-percent" class="form-input" step="0.0001" min="0" max="100" placeholder="0.0000" oninput="LabQualityTest.calculateICP()">
                                    </div>
                                </div>
                                <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                    <div class="form-group">
                                        <label class="form-label">Kadar Seng (Zn) %</label>
                                        <input type="number" id="zn-percent" class="form-input" step="0.0001" min="0" max="100" placeholder="0.0000" oninput="LabQualityTest.calculateICP()">
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">Kadar Nikel (Ni) %</label>
                                        <input type="number" id="ni-percent" class="form-input" step="0.0001" min="0" max="100" placeholder="0.0000" oninput="LabQualityTest.calculateICP()">
                                    </div>
                                </div>
                            </div>

                            <div class="form-group mb-4">
                                <label class="form-label">Catatan Lab</label>
                                <textarea id="lab-notes" class="form-input" rows="3" placeholder="Misal: Sampel diambil dari batang ke-3..."></textarea>
                            </div>

                            <div class="form-actions" style="display: flex; justify-content: flex-end; gap: 1rem;">
                                <button type="reset" class="btn btn-secondary">Reset</button>
                                <button type="submit" class="btn btn-primary">💾 Simpan Data Lab</button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>

            <div id="lab-stock-section" class="card hidden" style="max-width: 900px; margin: 0 auto;">
                <div class="card-header">
                    <h3>📦 Stok Simpanan Sampel Lab</h3>
                </div>
                <div class="card-body">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Batch / Bar</th>
                                <th>Customer</th>
                                <th>Tanggal Input</th>
                                <th>Sample (g)</th>
                                <th>Testing (g)</th>
                                <th>Simpanan (g)</th>
                                <th>Kadar Au (%)</th>
                                <th>Estimasi Pure (g)</th>
                                <th>Catatan</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.samples.length === 0 ? '<tr><td colspan="9" style="text-align: center; padding: 2rem;">Belum ada simpanan sampel.</td></tr>' :
                this.samples.filter(s => s.storageWeight > 0).map(s => `
                                    <tr>
                                        <td>
                                            <strong>${s.batchNumber}</strong><br>
                                            <small style="color: var(--color-primary); font-weight: 600;">${s.jobOrderNumber || 'No JO'}</small>
                                        </td>
                                        <td>${s.customerName || '-'}</td>
                                        <td>${new Date(s.createdAt).toLocaleDateString('id-ID')}</td>
                                        <td>${s.sampleWeight.toFixed(3)}</td>
                                        <td>${s.testingWeight.toFixed(3)}</td>
                                        <td style="font-weight: bold; color: var(--color-primary);">${s.storageWeight.toFixed(3)}</td>
                                        <td>${s.auPercent.toFixed(2)}%</td>
                                        <td>${(s.storageWeight * s.auPercent / 100).toFixed(4)}</td>
                                        <td><small>${s.notes || '-'}</small></td>
                                        <td style="display: flex; gap: 0.25rem; flex-wrap: wrap;">
                                            <button class="btn btn-sm btn-info" onclick="LabQualityTest.printLabTest('${s.id}')" title="Print Fire Assay Report">
                                                🔥 Fire Assay
                                            </button>
                                            ${s.method === 'icp' ? `
                                                <button class="btn btn-sm btn-primary" onclick="LabQualityTest.printICP('${s.id}')" title="Print ICP Report">
                                                    🧪 ICP
                                                </button>
                                            ` : ''}
                                        </td>
                                    </tr>
                                `).join('')
            }
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    switchTab(tab) {
        const inputSec = document.getElementById('lab-input-section');
        const stockSec = document.getElementById('lab-stock-section');
        const inputBtn = document.getElementById('tab-input');
        const stockBtn = document.getElementById('tab-stock');

        if (tab === 'input') {
            inputSec.classList.remove('hidden');
            stockSec.classList.add('hidden');
            inputBtn.style.background = 'var(--bg-secondary)';
            stockBtn.style.background = 'transparent';
        } else {
            inputSec.classList.add('hidden');
            stockSec.classList.remove('hidden');
            inputBtn.style.background = 'transparent';
            stockBtn.style.background = 'var(--bg-secondary)';
        }
    },

    handleBatchChange(batchId) {
        const fields = document.getElementById('sample-input-fields');
        const joWrapper = document.getElementById('jo-selection-wrapper');
        const joSelect = document.getElementById('sample-jo-id');
        const info = document.getElementById('display-batch-info');
        const indicator = document.getElementById('existing-sample-indicator');

        if (!batchId) {
            fields.classList.add('hidden');
            joWrapper.classList.add('hidden');
            return;
        }

        const batch = ProductionBatch.getBatch(batchId);
        if (batch) {
            // Populate Job Orders dropdown
            joSelect.innerHTML = '<option value="">-- Pilih Job Order --</option>' +
                batch.jobOrders.map(jo => `
                    <option value="${jo.jobOrderId}">${jo.jobOrderNumber} - ${jo.customerName}</option>
                `).join('');

            info.innerHTML = `
                Total Weight: ${batch.totalGrossWeight} g<br>
                Orders: ${batch.totalJobOrders}<br>
                Stage: ${batch.stage || 'General'}
            `;

            joWrapper.classList.remove('hidden');
            fields.classList.remove('hidden');

            // Load existing data if any (legacy or check if sample already exists for this batch)
            const existing = this.getSampleByBatch(batchId);
            if (existing) {
                if (existing.jobOrderId) joSelect.value = existing.jobOrderId;
                document.getElementById('sample-weight').value = existing.sampleWeight || '';
                document.getElementById('testing-weight').value = existing.testingWeight || '';
                document.getElementById('storage-weight').value = existing.storageWeight || '0.000';

                const methodSelect = document.getElementById('analysis-method');
                if (methodSelect) {
                    methodSelect.value = existing.method || 'fire_assay';
                    this.handleMethodChange(methodSelect.value);
                }

                document.getElementById('au-percent').value = existing.auPercent;
                document.getElementById('ag-percent').value = existing.agPercent || '';
                document.getElementById('cu-percent').value = existing.cuPercent || '';
                document.getElementById('other-percent').value = existing.otherPercent || '';
                
                if (existing.method === 'icp') {
                    document.getElementById('pb-percent').value = existing.pbPercent || '';
                    document.getElementById('fe-percent').value = existing.fePercent || '';
                    document.getElementById('zn-percent').value = existing.znPercent || '';
                    document.getElementById('ni-percent').value = existing.niPercent || '';
                } else {
                    document.getElementById('pb-percent').value = '';
                    document.getElementById('fe-percent').value = '';
                    document.getElementById('zn-percent').value = '';
                    document.getElementById('ni-percent').value = '';
                }

                document.getElementById('lab-notes').value = existing.notes || '';
                indicator.classList.remove('hidden');
                this.handleJOChange(existing.jobOrderId);
            } else {
                document.getElementById('lab-sample-form').reset();
                document.getElementById('sample-batch-id').value = batchId; // restore selection
                document.getElementById('storage-weight').value = '0.000';
                document.getElementById('jo-ref-data').innerText = '-';
                const methodSelect = document.getElementById('analysis-method');
                if (methodSelect) {
                    methodSelect.value = 'fire_assay';
                    this.handleMethodChange('fire_assay');
                }
                indicator.classList.add('hidden');
            }
        }
    },

    handleJOChange(joId) {
        const refData = document.getElementById('jo-ref-data');
        if (!joId) {
            refData.innerText = '-';
            return;
        }

        const jo = JobOrder.getJobOrder(joId);
        if (jo) {
            const weight = jo.input?.grossWeight || 0;
            const kadar = jo.input?.kadar || '-';
            refData.innerHTML = `<strong>Ref Timbangan:</strong> ${weight}g | <strong>Ref XRF:</strong> ${kadar}`;
        }
    },

    async handleSubmit(event) {
        event.preventDefault();

        const batchId = document.getElementById('sample-batch-id').value;
        const joId = document.getElementById('sample-jo-id').value;
        const batch = ProductionBatch.getBatch(batchId);
        const jo = JobOrder.getJobOrder(joId);

        const method = document.getElementById('analysis-method')?.value || 'fire_assay';

        const sampleData = {
            batchId,
            batchNumber: batch.batchNumber,
            jobOrderId: joId,
            jobOrderNumber: jo?.jobOrderNumber || '',
            customerName: jo?.customerName || '',
            sampleWeight: parseFloat(document.getElementById('sample-weight').value) || 0,
            testingWeight: parseFloat(document.getElementById('testing-weight').value) || 0,
            storageWeight: parseFloat(document.getElementById('storage-weight').value) || 0,
            method: method,
            auPercent: parseFloat(document.getElementById('au-percent').value),
            agPercent: parseFloat(document.getElementById('ag-percent').value) || 0,
            cuPercent: parseFloat(document.getElementById('cu-percent').value) || 0,
            pbPercent: method === 'icp' ? parseFloat(document.getElementById('pb-percent').value) || 0 : 0,
            fePercent: method === 'icp' ? parseFloat(document.getElementById('fe-percent').value) || 0 : 0,
            znPercent: method === 'icp' ? parseFloat(document.getElementById('zn-percent').value) || 0 : 0,
            niPercent: method === 'icp' ? parseFloat(document.getElementById('ni-percent').value) || 0 : 0,
            otherPercent: parseFloat(document.getElementById('other-percent').value) || 0,
            notes: document.getElementById('lab-notes').value
        };

        const result = await this.saveSample(sampleData);
        if (result.success) {
            // Update Job Order with sample info for mass balance audit
            if (joId) {
                await JobOrder.updateJobOrder(joId, {
                    input: {
                        labSampleWeight: sampleData.sampleWeight,
                        labTestedWeight: sampleData.testingWeight,
                        actualPurity: sampleData.auPercent / 100
                    },
                    status: 'sampled'
                });
            }
            alert('✅ Data sampel berhasil disimpan!');
            this.render();
        }
    },

    printLabTest(id) {
        const sample = this.samples.find(s => s.id === id);
        if (!sample) return;
        const config = Storage.get(Storage.KEYS.CONFIG) || {};
        if (typeof PDFExporter !== 'undefined' && PDFExporter.exportLabTestReport) {
            PDFExporter.exportLabTestReport(sample, config);
        } else {
            alert('PDF Exporter module not loaded or exportLabTestReport missing.');
        }
    },

    printICP(id) {
        const sample = this.samples.find(s => s.id === id);
        if (!sample) return;
        const config = Storage.get(Storage.KEYS.CONFIG) || {};
        if (typeof PDFExporter !== 'undefined' && PDFExporter.exportICPReport) {
            PDFExporter.exportICPReport(sample, config);
        } else {
            alert('PDF Exporter module not loaded or exportICPReport missing.');
        }
    }
};

window.LabQualityTest = LabQualityTest;
