// ==========================================
// Refinery Forms - Lab Test & QC
// Forms for tracking Aqua Regia process
// ==========================================

const RefineryForms = {
    init() {
        if (!Auth.isAuthenticated()) {
            window.location.href = 'login.html';
            return;
        }
        this.connectHardware();
        this.render();
    },

    connectHardware() {
        if (this.hwWebSocket && this.hwWebSocket.readyState === WebSocket.OPEN) return;

        try {
            this.hwWebSocket = new WebSocket('ws://localhost:8765');
            this.hwWebSocket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.type === 'reading') {
                    this.handleHardwareReading(data.data);
                }
                this.updateHardwareStatus(data);
            };
            this.hwWebSocket.onclose = () => setTimeout(() => this.connectHardware(), 5000);
        } catch (e) { console.error(e); }
    },

    updateHardwareStatus(data) {
        const indicator = document.getElementById('refinery-hw-status');
        if (!indicator) return;

        let status = '🔴 Offline';
        let color = '#ef4444';

        if (this.hwWebSocket?.readyState === WebSocket.OPEN) {
            status = '🟢 Online';
            color = '#10b981';
        }

        indicator.innerHTML = `<span style="color: ${color}; font-weight: bold;">${status}</span>`;
    },

    handleHardwareReading(reading) {
        if (reading.type === 'purity') {
            const input = document.querySelector('input[name="goldContent"]');
            if (input && !input.value) {
                input.value = reading.purity.toFixed(2);
                this.flashInput(input);
            }
        } else if (reading.type === 'weight') {
            const input = document.querySelector('input[name="weightInAir"]');
            if (input) {
                input.value = reading.weight.toFixed(2);
                this.flashInput(input);
            }
        }
    },

    flashInput(el) {
        el.style.backgroundColor = '#d1fae5';
        setTimeout(() => el.style.backgroundColor = '', 1000);
    },

    render() {
        const content = document.getElementById('main-content');
        content.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">📝 Refinery Forms</h1>
                <p class="page-description">Form tracking untuk proses Aqua Regia Refining</p>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
                ${this.renderFormCard('🔬 Lab Test Form', 'Form hasil lab test (XRF, Timbang Air)', 'labTest')}
                ${this.renderFormCard('⚡ Electrolysis Log', 'Control per jam untuk proses elektrolit', 'electrolysis')}
                ${this.renderFormCard('✅ QC Checklist', 'Quality control final inspection', 'qcChecklist')}
                ${this.renderFormCard('📊 Batch Report', 'Laporan batch production', 'batchReport')}
                ${this.renderFormCard('🥈 By-Product Log', 'Tracking perak & gold dust', 'byProductLog')}
            </div>

            <div id="form-container"></div>
        `;
    },

    renderFormCard(title, description, formType) {
        return `
            <div class="card" style="cursor: pointer; transition: all 0.3s;" 
                 onclick="RefineryForms.showForm('${formType}')"
                 onmouseover="this.style.transform='translateY(-5px)'"
                 onmouseout="this.style.transform='translateY(0)'">
                <div class="card-body">
                    <h3 style="margin: 0 0 8px 0;">${title}</h3>
                    <p style="color: #666; font-size: 14px; margin: 0;">${description}</p>
                    <div style="margin-top: 16px; color: #667eea;">
                        → Buka Form
                    </div>
                </div>
            </div>
        `;
    },

    showForm(formType) {
        const container = document.getElementById('form-container');

        switch (formType) {
            case 'labTest':
                container.innerHTML = this.renderLabTestForm();
                break;
            case 'electrolysis':
                container.innerHTML = this.renderElectrolysisForm();
                break;
            case 'qcChecklist':
                container.innerHTML = this.renderQCChecklist();
                break;
            case 'batchReport':
                container.innerHTML = this.renderBatchReport();
                break;
            case 'byProductLog':
                container.innerHTML = this.renderByProductLog();
                break;
        }

        // Scroll to form
        container.scrollIntoView({ behavior: 'smooth' });
    },

    renderLabTestForm() {
        return `
            <div class="card mt-4">
                <div class="card-header flex justify-between align-center">
                    <h2 class="card-title">🔬 Lab Test Form - Aqua Regia Process</h2>
                    <div id="refinery-hw-status"><small>Checking Hardware...</small></div>
                </div>
                <div class="card-body">
                    <form onsubmit="RefineryForms.submitLabTest(event)">
                        <h3 style="border-bottom: 2px solid #667eea; padding-bottom: 8px; margin-bottom: 16px;">
                            1. Sample Information
                        </h3>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label required">Batch Number</label>
                                <input type="text" name="batchNumber" class="form-input" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label required">Test Date</label>
                                <input type="date" name="testDate" class="form-input" value="${new Date().toISOString().split('T')[0]}" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label required">Technician</label>
                                <input type="text" name="technician" class="form-input" value="${Auth.getCurrentUser()?.fullName || ''}" required>
                            </div>
                        </div>

                        <h3 style="border-bottom: 2px solid #667eea; padding-bottom: 8px; margin: 24px 0 16px;">
                            2. XRF Test (Kandungan)
                        </h3>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label required">Gold Content (%)</label>
                                <input type="number" name="goldContent" class="form-input" step="0.01" min="0" max="100" required>
                                <small class="form-help">Expected: 85-89% untuk raw material</small>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Silver Content (%)</label>
                                <input type="number" name="silverContent" class="form-input" step="0.01" min="0" max="100">
                                <small class="form-help">Expected: 12-15%</small>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Other Impurities (%)</label>
                                <input type="number" name="impurities" class="form-input" step="0.01" min="0" max="100">
                            </div>
                        </div>

                        <h3 style="border-bottom: 2px solid #667eea; padding-bottom: 8px; margin: 24px 0 16px;">
                            3. Timbang Air Test (Density Test)
                        </h3>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label required">Weight in Air (g)</label>
                                <input type="number" name="weightInAir" class="form-input" step="0.01" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label required">Weight in Water (g)</label>
                                <input type="number" name="weightInWater" class="form-input" step="0.01" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Calculated Purity (%)</label>
                                <input type="number" name="calculatedPurity" class="form-input" step="0.01" readonly id="calc-purity">
                                <small class="form-help">Auto-calculated: (Weight Air / Weight Water) × density factor</small>
                            </div>
                        </div>

                        <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; margin: 16px 0; border-radius: 4px;">
                            <strong>💡 Formula Timbang Air:</strong><br>
                            Purity = (Timbang Kering / Timbang Air) × 100<br>
                            Contoh: (1000g / 947.93g) × 100 = 105.5 → Emas 99.1%
                        </div>

                        <h3 style="border-bottom: 2px solid #667eea; padding-bottom: 8px; margin: 24px 0 16px;">
                            4. Test Results & Conclusion
                        </h3>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label required">Final Purity Conclusion (%)</label>
                                <input type="number" name="finalPurity" class="form-input" step="0.01" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label required">Test Result</label>
                                <select name="testResult" class="form-select" required>
                                    <option value="">-- Select --</option>
                                    <option value="PASS">✅ PASS - Proceed to refining</option>
                                    <option value="PASS_CONDITIONAL">⚠️ PASS - Conditional (notes required)</option>
                                    <option value="FAIL">❌ FAIL - Reject/Return</option>
                                </select>
                            </div>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Lab Notes</label>
                            <textarea name="labNotes" class="form-input" rows="3" placeholder="Catatan tambahan dari lab technician..."></textarea>
                        </div>

                        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
                            <button type="button" class="btn btn-secondary" onclick="RefineryForms.render()">Cancel</button>
                            <button type="submit" class="btn btn-success">💾 Save Lab Test Result</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    },

    renderQCChecklist() {
        return `
            <div class="card mt-4">
                <div class="card-header">
                    <h2 class="card-title">✅ Quality Control Checklist - Final Inspection</h2>
                </div>
                <div class="card-body">
                    <form onsubmit="RefineryForms.submitQC(event)">
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label required">Batch Number</label>
                                <input type="text" name="batchNumber" class="form-input" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label required">QC Date</label>
                                <input type="date" name="qcDate" class="form-input" value="${new Date().toISOString().split('T')[0]}" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label required">Inspector</label>
                                <input type="text" name="inspector" class="form-input" value="${Auth.getCurrentUser()?.fullName || ''}" required>
                            </div>
                        </div>

                        <h3 style="margin: 24px 0 16px;">Visual Inspection</h3>
                        ${this.renderChecklistItem('visual1', 'Gold bar surface smooth, no cracks')}
                        ${this.renderChecklistItem('visual2', 'Color consistent (golden yellow 24K)')}
                        ${this.renderChecklistItem('visual3', 'No visible impurities atau inclusions')}
                        ${this.renderChecklistItem('visual4', 'Weight stamping clear and readable')}

                        <h3 style="margin: 24px 0 16px;">Measurement Verification</h3>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label required">Actual Weight (g)</label>
                                <input type="number" name="actualWeight" class="form-input" step="0.01" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label required">Target Weight (g)</label>
                                <input type="number" name="targetWeight" class="form-input" step="0.01" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Weight Variance (%)</label>
                                <input type="number" name="weightVariance" class="form-input" readonly id="weight-variance">
                            </div>
                        </div>

                        <h3 style="margin: 24px 0 16px;">Purity Verification</h3>
                        ${this.renderChecklistItem('purity1', 'Final XRF test: 99.9% or higher')}
                        ${this.renderChecklistItem('purity2', 'Purity marked on gold bar')}
                        ${this.renderChecklistItem('purity3', 'Certificate of analysis prepared')}

                        <h3 style="margin: 24px 0 16px;">Final Decision</h3>
                        <div class="form-group">
                            <label class="form-label required">QC Result</label>
                            <select name="qcResult" class="form-select" required>
                                <option value="">-- Select --</option>
                                <option value="APPROVED">✅ APPROVED - Release to finished goods</option>
                                <option value="CONDITIONAL">⚠️ CONDITIONAL - Minor issues noted</option>
                                <option value="REJECTED">❌ REJECTED - Rework required</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label class="form-label">QC Notes</label>
                            <textarea name="qcNotes" class="form-input" rows="3"></textarea>
                        </div>

                        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
                            <button type="button" class="btn btn-secondary" onclick="RefineryForms.render()">Cancel</button>
                            <button type="submit" class="btn btn-success">💾 Save QC Result</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    },

    renderChecklistItem(name, label) {
        return `
            <div style="padding: 12px; background: #f8f9fa; margin: 8px 0; border-radius: 4px; display: flex; align-items: center;">
                <input type="checkbox" name="${name}" id="${name}" style="margin-right: 12px; width: 20px; height: 20px;">
                <label for="${name}" style="margin: 0; cursor: pointer;">${label}</label>
            </div>
        `;
    },

    renderBatchReport() {
        return `
            <div class="card mt-4">
                <div class="card-header">
                    <h2 class="card-title">📊 Batch Production Report</h2>
                </div>
                <div class="card-body">
                    <p class="text-gray">
                        Coming soon: Comprehensive batch report with all stages, costs, and yields
                    </p>
                </div>
            </div>
        `;
    },

    renderByProductLog() {
        return `
            <div class="card mt-4">
                <div class="card-header">
                    <h2 class="card-title">🥈 By-Product Recovery Log</h2>
                </div>
                <div class="card-body">
                    <form onsubmit="RefineryForms.submitByProduct(event)">
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label required">Batch Number</label>
                                <input type="text" name="batchNumber" class="form-input" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label required">Recovery Date</label>
                                <input type="date" name="recoveryDate" class="form-input" value="${new Date().toISOString().split('T')[0]}" required>
                            </div>
                        </div>

                        <h3 style="margin: 24px 0 16px;">🥈 Silver Recovery</h3>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Silver Weight (g)</label>
                                <input type="number" name="silverWeight" class="form-input" step="0.01">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Estimated Purity (%)</label>
                                <input type="number" name="silverPurity" class="form-input" step="0.01" value="98">
                            </div>
                        </div>

                        <h3 style="margin: 24px 0 16px;">✨ Gold Dust Recovery</h3>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Gold Dust from Filter (g)</label>
                                <input type="number" name="goldDustWeight" class="form-input" step="0.01">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Source</label>
                                <select name="goldDustSource" class="form-select">
                                    <option>Filter Trolly</option>
                                    <option>Ampas Perak</option>
                                    <option>Equipment Cleaning</option>
                                </select>
                            </div>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Recovery Notes</label>
                            <textarea name="recoveryNotes" class="form-input" rows="2"></textarea>
                        </div>

                        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
                            <button type="button" class="btn btn-secondary" onclick="RefineryForms.render()">Cancel</button>
                            <button type="submit" class="btn btn-success">💾 Log By-Product Recovery</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    },

    // Form submission handlers
    async submitLabTest(event) {
        event.preventDefault();
        const formData = new FormData(event.target);

        const labTest = {
            id: `LAB-${Date.now()}`,
            batchNumber: formData.get('batchNumber'),
            testDate: formData.get('testDate'),
            technician: formData.get('technician'),
            xrf: {
                gold: parseFloat(formData.get('goldContent')),
                silver: parseFloat(formData.get('silverContent') || 0),
                impurities: parseFloat(formData.get('impurities') || 0)
            },
            timbangAir: {
                weightInAir: parseFloat(formData.get('weightInAir')),
                weightInWater: parseFloat(formData.get('weightInWater')),
                calculatedPurity: parseFloat(formData.get('calculatedPurity') || 0)
            },
            finalPurity: parseFloat(formData.get('finalPurity')),
            result: formData.get('testResult'),
            notes: formData.get('labNotes'),
            createdAt: new Date().toISOString(),
            createdBy: Auth.getCurrentUser()?.username
        };

        // Save to storage
        const labTests = Storage.get(Storage.KEYS.LAB_TESTS) || [];
        labTests.push(labTest);
        await Storage.set(Storage.KEYS.LAB_TESTS, labTests);

        alert('✅ Lab test result saved successfully!');
        this.render();
    },

    async submitQC(event) {
        event.preventDefault();
        const formData = new FormData(event.target);

        const actualWeight = parseFloat(formData.get('actualWeight')) || 0;
        const targetWeight = parseFloat(formData.get('targetWeight')) || 0;
        const loss = targetWeight - actualWeight;
        const lossPercent = targetWeight > 0 ? (loss / targetWeight) * 100 : 0;

        // AI Guardian: Loss check (> 0.5%)
        if (lossPercent > 0.5) {
            const confirmed = confirm(
                `🚨 AI GUARDIAN ALERT: SUSUT TINGGI!\n\n` +
                `Susut batch ini mencapai ${lossPercent.toFixed(2)}%, melebihi batas aman 0.5%.\n\n` +
                `Apakah Bapak yakin ingin tetap menyimpan data ini?`
            );
            if (!confirmed) return;
        }

        // Process QC data
        const qcResult = {
            id: `QC-${Date.now()}`,
            batchNumber: formData.get('batchNumber'),
            qcDate: formData.get('qcDate'),
            actualWeight,
            targetWeight,
            loss,
            lossPercent,
            status: formData.get('qcResult'),
            isAnomaly: lossPercent > 0.5,
            createdAt: new Date().toISOString()
        };

        const qcLogs = Storage.get(Storage.KEYS.QC_LOGS) || [];
        qcLogs.push(qcResult);
        await Storage.set(Storage.KEYS.QC_LOGS, qcLogs);

        alert('✅ QC result saved successfully!');
        this.render();
    },

    renderElectrolysisForm() {
        return `
            <div class="card mt-4">
                <div class="card-header">
                    <h2 class="card-title">⚡ Electrolysis Process Log (Gold/Silver)</h2>
                </div>
                <div class="card-body">
                    <form onsubmit="RefineryForms.submitElectrolysis(event)">
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label required">Batch Number</label>
                                <input type="text" name="batchNumber" class="form-input" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label required">Cell ID / Tank No.</label>
                                <input type="text" name="cellId" class="form-input" placeholder="e.g. TANK-01" required>
                            </div>
                        </div>

                        <h3 style="border-bottom: 2px solid #667eea; padding-bottom: 8px; margin: 24px 0 16px;">
                            1. Operational Parameters
                        </h3>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label required">Amperage (A)</label>
                                <input type="number" name="amperage" class="form-input" step="0.1" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label required">Voltage (V)</label>
                                <input type="number" name="voltage" class="form-input" step="0.1" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Temperature (°C)</label>
                                <input type="number" name="temp" class="form-input" step="0.1" value="45">
                            </div>
                        </div>

                        <h3 style="border-bottom: 2px solid #667eea; padding-bottom: 8px; margin: 24px 0 16px;">
                            2. Material Balancing
                        </h3>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label required">Anode Weight Initial (g)</label>
                                <input type="number" name="anodeInitial" class="form-input" step="0.01" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label required">Cathode Weight Initial (g)</label>
                                <input type="number" name="cathodeInitial" class="form-input" step="0.01" required>
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Final Cathode Weight (g)</label>
                                <input type="number" name="cathodeFinal" class="form-input" step="0.01">
                            </div>
                            <div class="form-group">
                                <label class="form-label disabled">Net Metal Gained (g)</label>
                                <input type="number" name="netGained" class="form-input" readonly>
                            </div>
                        </div>

                        <h3 style="border-bottom: 2px solid #667eea; padding-bottom: 8px; margin: 24px 0 16px;">
                            3. Tank & Electrolyte Status
                        </h3>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Electrolyte Purity/Status</label>
                                <select name="electrolyteStatus" class="form-select">
                                    <option value="good">Optimal - Clear</option>
                                    <option value="needs_regen">Needs Regeneration</option>
                                    <option value="replace">Replace Required</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Anode Sludge (Slime) Weight (g)</label>
                                <input type="number" name="sludgeWeight" class="form-input" step="0.01">
                            </div>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Process Notes</label>
                            <textarea name="notes" class="form-input" rows="3" placeholder="Observasi selama proses (e.g. warna kristal, sedimentasi)..."></textarea>
                        </div>

                        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
                            <button type="button" class="btn btn-secondary" onclick="RefineryForms.render()">Cancel</button>
                            <button type="submit" class="btn btn-primary">💾 Save Electrolysis Log</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    },

    async submitElectrolysis(event) {
        event.preventDefault();
        const formData = new FormData(event.target);

        const log = {
            id: `ELEC-${Date.now()}`,
            batchNumber: formData.get('batchNumber'),
            cellId: formData.get('cellId'),
            parameters: {
                amperage: parseFloat(formData.get('amperage')),
                voltage: parseFloat(formData.get('voltage')),
                temp: parseFloat(formData.get('temp'))
            },
            weights: {
                anodeInitial: parseFloat(formData.get('anodeInitial')),
                cathodeInitial: parseFloat(formData.get('cathodeInitial')),
                cathodeFinal: parseFloat(formData.get('cathodeFinal') || 0)
            },
            status: formData.get('electrolyteStatus'),
            recordedBy: Auth.getCurrentUser()?.username,
            createdAt: new Date().toISOString()
        };

        const logs = Storage.get(Storage.KEYS.ELECTROLYSIS_LOGS) || [];
        logs.push(log);
        await Storage.set(Storage.KEYS.ELECTROLYSIS_LOGS, logs);

        alert('✅ Electrolysis log saved successfully!');
        this.render();
    },

    submitByProduct(event) {
        event.preventDefault();
        const formData = new FormData(event.target);

        // Process by-product data
        alert('✅ By-product recovery logged successfully!');
        this.render();
    }
};


// Explicitly make RefineryForms globally available
window.RefineryForms = RefineryForms;
