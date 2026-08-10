// ==========================================
// Direct Swap Module (Tukar Tambah)
// Handle Customer Swaps: Receive Scrap -> Give Pure -> Revenue
// ==========================================

const DirectSwap = {
    transactions: [],
    xrfWebSocket: null,
    xrfStatus: 'disconnected',
    lastXRFReading: null,
    lastWeightReading: null,
    bridgeIP: 'localhost',
    connectionLogs: [],
    rawLogs: [],
    lastRawSignal: '', // Store last raw signal for display
    deviceStates: {
        xrf: 'offline',
        scale: 'offline'
    },
    evidenceGallery: {}, // Store images for current transaction: { 'top': 'base64...', 'bottom': '...', 'core': '...' }

    init() {
        // Load saved Bridge IP if any
        this.bridgeIP = localStorage.getItem('erp_xrf_bridge_ip') || 'localhost';
        this.loadTransactions();
        this.connectXRF(); // Auto-connect to XRF bridge
    },

    addLog(msg) {
        const time = new Date().toLocaleTimeString();
        this.connectionLogs.push(`[${time}] ${msg}`);
        if (this.connectionLogs.length > 20) this.connectionLogs.shift();
        this.renderDiagnosticsLog();
    },

    addRawLog(msg, hex = '') {
        const time = new Date().toLocaleTimeString();
        this.lastRawSignal = msg.trim() || (hex ? `[HEX: ${hex.substring(0, 10)}...]` : '');

        // Format log: if hex is available, show both
        let logEntry = `[${time}] ${msg}`;
        if (hex) logEntry += ` <small style="color:#94a3b8;">(HEX: ${hex})</small>`;

        this.rawLogs.push(logEntry);
        if (this.rawLogs.length > 30) this.rawLogs.shift();
        this.renderDiagnosticsLog();
        this.updateXRFStatus();
    },

    connectXRF() {
        if (this.xrfWebSocket) {
            const state = this.xrfWebSocket.readyState;
            if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) return;
        }

        try {
            this.xrfStatus = 'connecting';
            this.addLog(`Connecting to ws://${this.bridgeIP}:8765...`);
            this.updateXRFStatus();

            this.xrfWebSocket = new WebSocket(`ws://${this.bridgeIP}:8765`);

            this.xrfWebSocket.onopen = () => {
                this.addLog('✅ XRF Bridge connected');
                this.xrfStatus = 'connected';
                this.updateXRFStatus();
            };

            this.xrfWebSocket.onmessage = (event) => {
                const data = JSON.parse(event.data);

                if (data.type === 'init') {
                    this.xrfStatus = data.device_count > 0 ? 'connected' : 'no_devices';
                    this.addLog(`📍 Bridge Init: ${data.device_count} devices found.`);
                    // If no devices, set both to offline, otherwise wait for readings/status
                    if (data.device_count === 0) {
                        this.deviceStates.xrf = 'offline';
                        this.deviceStates.scale = 'offline';
                    }
                    this.updateXRFStatus();
                } else if (data.type === 'status') {
                    this.addLog(`📍 Device Status: ${data.port} ${data.status}`);
                    this.updateStatusFromBridge(data);
                } else if (data.type === 'reading') {
                    // Update individual device state based on reading type
                    if (data.data.type === 'purity') {
                        this.deviceStates.xrf = 'online';
                    } else if (data.data.type === 'weight') {
                        this.deviceStates.scale = 'online';
                    }
                    this.handleHardwareReading(data.data);
                } else if (data.type === 'trace') {
                    this.addRawLog(data.data, data.hex);
                }
            };

            this.xrfWebSocket.onerror = (error) => {
                this.addLog(`❌ WebSocket Error: ${error.message || 'Check terminal bridge'}`);
                console.warn('XRF WebSocket error:', error);
            };

            this.xrfWebSocket.onclose = () => {
                this.addLog('🔌 XRF Bridge disconnected');
                this.xrfStatus = 'disconnected';
                this.updateXRFStatus();

                // Auto-reconnect after 5 seconds
                if (!this._reconnectTimer) {
                    this._reconnectTimer = setTimeout(() => {
                        this._reconnectTimer = null;
                        this.connectXRF();
                    }, 5000);
                }
            };

        } catch (error) {
            this.addLog(`❌ Failed to start WebSocket: ${error}`);
            this.xrfStatus = 'disconnected';
            this.updateXRFStatus();
        }
    },

    updateXRFStatus() {
        const indicator = document.getElementById('xrf-status-indicator');
        if (!indicator) return;

        // Bridge Status pill
        let bridgeStatusColor = '#ef4444';
        let bridgeText = 'Bridge Offline';
        if (this.xrfStatus === 'connected') bridgeStatusColor = '#10b981', bridgeText = 'Bridge Online';
        else if (this.xrfStatus === 'connecting') bridgeStatusColor = '#3b82f6', bridgeText = 'Connecting...';
        else if (this.xrfStatus === 'no_devices') bridgeStatusColor = '#f59e0b', bridgeText = 'No Devices';

        const bridgeBadge = `<span style="background: ${bridgeStatusColor}; color: white; padding: 4px 8px; border-radius: 4px; font-weight: 600; font-size: 12px; margin-right: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">${bridgeText}</span>`;

        // Scale Badge
        const scaleOnline = (this.deviceStates.scale === 'online' || this.lastWeightReading);
        const scaleBg = scaleOnline ? '#059669' : '#4b5563';
        const scaleText = scaleOnline ? '⚖️ SCALE ONLINE' : '⚖️ SCALE OFFLINE';
        const weightValue = this.lastWeightReading ? this.lastWeightReading.weight : 0;
        const weightText = this.lastWeightReading ? `<span style="color: #fff; font-family: monospace; font-size: 14px; margin-left:8px; font-weight: 700;">${weightValue.toFixed(3)} g</span>` : '';
        const scaleBadge = `
            <div style="background: ${scaleBg}; color: #fff; display: inline-flex; align-items: center; padding: 6px 12px; border-radius: 6px; margin-right: 10px; border: 2px solid ${scaleOnline ? '#10b981' : '#6b7280'}; cursor: help;" 
                 title="${scaleOnline ? 'Timbangan siap digunakan' : 'Pastikan timbangan menyala dan terhubung ke USB'}">
                <span style="font-weight: 800; font-size: 13px;">${scaleText}</span>
                ${weightText}
            </div>
        `;

        // XRF Badge
        const xrfOnline = (this.deviceStates.xrf === 'online' || this.lastXRFReading);
        const xrfBg = xrfOnline ? '#7c3aed' : '#4b5563';
        const xrfText = xrfOnline ? '🔬 XRF ONLINE' : '🔬 XRF OFFLINE';
        const purityText = this.lastXRFReading ? `<span style="color: #fff; font-family: monospace; font-size: 14px; margin-left:8px; font-weight: 700;">${this.lastXRFReading.purity}%</span>` : '';
        const xrfBadge = `
            <div style="background: ${xrfBg}; color: #fff; display: inline-flex; align-items: center; padding: 6px 12px; border-radius: 6px; border: 2px solid ${xrfOnline ? '#a78bfa' : '#6b7280'}; cursor: help;"
                 title="${xrfOnline ? 'Purity (Kadar) siap diambil. Tembak alat untuk mengirim data.' : 'Pastikan LCD XRF menyala dan kabel data tercolok'}">
                <span style="font-weight: 800; font-size: 13px;">${xrfText}</span>
                ${purityText}
            </div>
        `;

        indicator.innerHTML = `
            <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 8px;">
                ${bridgeBadge}
                ${scaleBadge}
                ${xrfBadge}
                <button type="button" class="btn btn-sm btn-outline" onclick="DirectSwap.toggleDiagnostics()" style="padding: 4px 10px; font-size: 12px; background: #fff; border: 1px solid #d1d5db; border-radius: 6px; cursor: pointer; color: #374151; font-weight: 600;">🛠️ Diagnostics</button>
            </div>
            <div style="margin-top: 8px; font-family: monospace; font-size: 11px; color: #6b7280; font-weight: 600;">
                📡 Sinyal Terakhir: <span style="color: #4b5563; background: #f3f4f6; padding: 2px 6px; border-radius: 4px;">${this.lastRawSignal || '(Belum ada sinyal)'}</span>
            </div>
            <div id="xrf-notification" style="display: none; margin-top: 10px; font-weight: 600;"></div>
        `;
    },

    toggleDiagnostics() {
        const diagArea = document.getElementById('xrf-diagnostics-area');
        if (diagArea) {
            diagArea.classList.toggle('hidden');
            this.renderDiagnosticsLog();
        }
    },

    renderDiagnosticsLog() {
        const logContainer = document.getElementById('xrf-log-container');
        if (logContainer) {
            logContainer.innerHTML = `
                <div style="display: grid; grid-template-columns: 1fr 1.5fr; gap: 10px; height: 260px;">
                    <div>
                        <div style="font-weight: bold; border-bottom: 2px solid #ddd; margin-bottom: 5px; font-size: 12px; color: #4b5563;">⚙️ Connection Events</div>
                        <div style="height: 235px; overflow-y: auto; font-family: monospace; font-size: 11px;">
                            ${this.connectionLogs.map(log => `<div style="border-bottom: 1px solid #f3f4f6; padding: 2px 0;">${log}</div>`).join('')}
                        </div>
                    </div>
                    <div style="display: flex; flex-direction: column;">
                        <div style="font-weight: bold; border-bottom: 2px solid #ddd; margin-bottom: 5px; font-size: 12px; color: #7c3aed; display: flex; justify-content: space-between;">
                            <span>📥 Raw Data Feed (Real-time)</span>
                            <button onclick="DirectSwap.clearRawLogs()" style="font-size: 10px; padding: 0 4px; cursor: pointer;">Clear</button>
                        </div>
                        <div style="flex-grow: 1; overflow-y: auto; font-family: monospace; font-size: 11px; color: #1e293b; background: #f8fafc; padding: 5px; border-radius: 4px; margin-bottom: 8px;">
                            ${this.rawLogs.map(log => `<div style="border-bottom: 1px solid #e2e8f0; padding: 2px 0; white-space: pre-wrap;">${log}</div>`).join('')}
                        </div>
                        <div style="display: flex; gap: 4px;">
                            <input id="xrf-manual-cmd" type="text" placeholder="Send cmd (e.g. \\r or export)" style="flex-grow: 1; font-size: 11px; padding: 4px; border: 1px solid #ddd; border-radius: 4px;">
                            <button onclick="DirectSwap.sendHardwareCommand()" style="background: #7c3aed; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer;">Send</button>
                        </div>
                        <div style="display: flex; gap: 4px; margin-top: 4px;">
                            <button onclick="DirectSwap.sendHardwareCommand('export')" style="flex:1; background: #059669; color: white; border: none; padding: 2px 0; border-radius: 4px; font-size: 10px; cursor: pointer;">🚀 EXPORT</button>
                            <button onclick="DirectSwap.sendHardwareCommand('\\r')" style="flex:1; background: #6b7280; color: white; border: none; padding: 2px 0; border-radius: 4px; font-size: 10px; cursor: pointer;">⏎ ENTER</button>
                            <button onclick="DirectSwap.sendHardwareCommand('help')" style="flex:1; background: #6b7280; color: white; border: none; padding: 2px 0; border-radius: 4px; font-size: 10px; cursor: pointer;">❓ HELP</button>
                            <button onclick="DirectSwap.sendHardwareCommand('ndt')" style="flex:1; background: #3b82f6; color: white; border: none; padding: 2px 0; border-radius: 4px; font-size: 10px; cursor: pointer;">🛰️ NDT</button>
                            <button onclick="DirectSwap.sendHardwareCommand('exit')" style="flex:1; background: #ef4444; color: white; border: none; padding: 2px 0; border-radius: 4px; font-size: 10px; cursor: pointer;">🚪 EXIT</button>
                        </div>
                    </div>
                </div>
            `;
            logContainer.scrollTop = logContainer.scrollHeight;
        }
    },

    sendHardwareCommand(customCmd = null) {
        const input = document.getElementById('xrf-manual-cmd');
        let cmd = customCmd || (input ? input.value : '');
        if (!cmd) return;

        const displayCmd = cmd;
        if (cmd === '\\r') cmd = '\r';
        if (cmd === '\\n') cmd = '\n';

        // Find the first purity/xrf device port
        let targetPort = null;
        // In this implementation we'll just try to send it to the first active device
        // or let the user choose. For now, we'll look for an 'online' xrf.
        // If nonfound, we can't send.

        // We need to keep track of ports in directSwap.js too.
        // For simplicity, we'll modify broadcast to include port in data.

        const message = {
            type: 'command',
            port: 'AUTO', // Bridge will need to handle this or we need to track ports
            command: cmd
        };

        // Let's refine the message to the latest detected port instead of 'AUTO'
        // We'll update bridge to handle a generic 'xrf' target if port is omitted or 'XRF'
        if (this.xrfWebSocket && this.xrfWebSocket.readyState === WebSocket.OPEN) {
            this.xrfWebSocket.send(JSON.stringify({
                type: 'command',
                port: 'XRF', // Special keyword for bridge
                command: cmd
            }));
            this.addLog(`📤 command sent: ${displayCmd}`);
            if (!customCmd && input) input.value = '';
        }
    },

    clearRawLogs() {
        this.rawLogs = [];
        this.renderDiagnosticsLog();
    },

    updateBridgeIP(ip) {
        this.bridgeIP = ip || 'localhost';
        localStorage.setItem('erp_xrf_bridge_ip', this.bridgeIP);
        this.addLog(`Bridge IP updated to: ${this.bridgeIP}`);
        if (this.xrfWebSocket) {
            this.xrfWebSocket.close(); // Triggers reconnect with new IP
        }
    },

    manualReconnect() {
        this.addLog('Manual reconnect triggered...');
        if (this.xrfWebSocket) this.xrfWebSocket.close();
        this.connectXRF();
    },

    updateStatusFromBridge(data) {
        // Update individual device state if device_type is provided
        if (data.device_type === 'purity') {
            this.deviceStates.xrf = (data.status === 'connected') ? 'online' : 'offline';
        } else if (data.device_type === 'weight') {
            this.deviceStates.scale = (data.status === 'connected') ? 'online' : 'offline';
        }
        this.updateXRFStatus();
    },

    handleHardwareReading(reading) {
        if (reading.type === 'purity') {
            this.handleXRFReading(reading);
        } else if (reading.type === 'weight') {
            this.handleWeightReading(reading);
        }
    },

    validateWeight() {
        const receiptWeightInput = document.getElementById('swap-receipt-weight');
        const indicator = document.getElementById('weight-validation-indicator');
        const actualWeightInput = document.getElementById('swap-weight-in');

        if (!receiptWeightInput || !indicator || !actualWeightInput) return;

        const receiptWeight = this.unformatNumber(receiptWeightInput.value) || 0;
        const actualWeight = this.unformatNumber(actualWeightInput.value) || 0;

        if (receiptWeight === 0) {
            indicator.innerHTML = '';
            indicator.className = 'mt-2 p-2 rounded hidden';
            return;
        }

        const difference = actualWeight - receiptWeight;
        const tolerance = 0.5; // ±0.5 gram tolerance

        indicator.classList.remove('hidden');
        if (Math.abs(difference) <= tolerance) {
            // MATCH - Green indicator
            indicator.innerHTML = `✅ Berat COCOK (Selisih: ${difference.toFixed(2)}g)`;
            indicator.style.background = '#d1fae5';
            indicator.style.color = '#065f46';
            indicator.style.border = '1px solid #10b981';
        } else if (difference > 0) {
            // Actual > Receipt - Yellow warning
            indicator.innerHTML = `⚠️ Berat LEBIH ${difference.toFixed(2)}g dari tanda terima`;
            indicator.style.background = '#fef3c7';
            indicator.style.color = '#92400e';
            indicator.style.border = '1px solid #f59e0b';
        } else {
            // Actual < Receipt - Red warning
            indicator.innerHTML = `❌ Berat KURANG ${Math.abs(difference).toFixed(2)}g dari tanda terima`;
            indicator.style.background = '#fee2e2';
            indicator.style.color = '#991b1b';
            indicator.style.border = '1px solid #ef4444';
        }
    },

    handleWeightReading(reading) {
        console.log('⚖️ Weight Reading received:', reading);
        this.lastWeightReading = reading;
        this.updateXRFStatus();

        // Auto-fill the last batch row if empty
        const batchRows = document.querySelectorAll('.batch-row');
        if (batchRows.length > 0) {
            const lastRow = batchRows[batchRows.length - 1];
            const weightInput = lastRow.querySelector('.batch-weight');
            if (weightInput && !weightInput.value) {
                weightInput.value = reading.weight.toFixed(2);
                this.flashInput(weightInput);
                this.calculateTotals();
            }
        }
    },

    captureWeight(btn) {
        if (!this.lastWeightReading) {
            alert('Belum ada data timbangan yang masuk.');
            return;
        }
        const row = btn.closest('.batch-row') || btn.closest('.form-group');
        const input = row.querySelector('.batch-weight') || row.querySelector('input');
        if (input) {
            input.value = this.lastWeightReading.weight.toFixed(2);
            this.flashInput(input);
            this.calculateTotals();
        }
    },

    capturePurity(btn) {
        if (!this.lastXRFReading) {
            alert('Belum ada data XRF yang masuk.');
            return;
        }
        const row = btn.closest('.batch-row') || btn.closest('.form-group');
        const input = row.querySelector('.batch-purity') || row.querySelector('input');
        if (input) {
            input.value = this.lastXRFReading.purity.toFixed(2);
            this.flashInput(input);
            this.calculateTotals();
        }
    },

    flashInput(el) {
        el.style.backgroundColor = '#fef3c7'; // Soft yellow highlight
        setTimeout(() => el.style.backgroundColor = '#ffffff', 1000);
    },

    handleXRFReading(reading) {
        console.log('📊 XRF Reading received:', reading);
        this.lastXRFReading = reading;
        this.updateXRFStatus();

        // Auto-fill purity in the active batch row
        const batchRows = document.querySelectorAll('.batch-row');
        if (batchRows.length > 0) {
            // Find the last row (most recent)
            const lastRow = batchRows[batchRows.length - 1];
            const purityInput = lastRow.querySelector('.batch-purity');
            const weightInput = lastRow.querySelector('.batch-weight');

            if (purityInput && !purityInput.value) {
                // Only fill if empty
                purityInput.value = reading.purity.toFixed(2);
                purityInput.style.backgroundColor = '#fef3c7'; // Highlight
                setTimeout(() => {
                    purityInput.style.backgroundColor = '#ffffff';
                }, 1000);

                // --- AUTO GRADING & RETURN CALCULATION ---
                if (typeof MasterPurity !== 'undefined') {
                    const grade = MasterPurity.getGrade('GOLD', reading.purity);
                    if (grade) {
                        console.log(`✨ Auto-Graded: ${grade.grade} (${reading.purity}%)`);
                        // Try to find a Grade/Karat input or display
                        // If not present, we might need to add it to the UI or just store it
                        // For now, let's look for a note or grade input
                        const gradeInput = lastRow.querySelector('.batch-grade');
                        if (gradeInput) gradeInput.value = grade.grade;

                        // Calculate Return if weight is present
                        if (weightInput && weightInput.value && typeof MasterRefiningRules !== 'undefined') {
                            const weight = this.unformatNumber(weightInput.value);
                            const rule = MasterRefiningRules.calculateReturn(grade.id, weight);

                            if (rule) {
                                console.log(`💰 Refining Rule Applied: Au Return ${rule.au_return}%`);
                                // We can store this in dataset or hidden fields for calculation
                                lastRow.dataset.auReturn = rule.au_return;
                                lastRow.dataset.refiningFee = rule.fee_per_gram || rule.fee; // handle both naming conventions

                                // Show a small badge or indicator if possible
                                this.showXRFNotification(`✅ Grade: ${grade.grade} | Return: ${rule.au_return}%`);
                            }
                        } else {
                            this.showXRFNotification(`✅ Grade: ${grade.grade} Detected`);
                        }
                    }
                }

                this.calculateTotals();
            }
        }
    },

    showXRFNotification(message) {
        const notification = document.getElementById('xrf-notification');
        if (notification) {
            notification.innerText = message;
            notification.style.display = 'block';
            notification.style.backgroundColor = '#10b981';
            notification.style.color = 'white';
            notification.style.padding = '8px 12px';
            notification.style.borderRadius = '6px';
            notification.style.marginTop = '8px';

            setTimeout(() => {
                notification.style.display = 'none';
            }, 3000);
        }
    },

    // NDT CSV Import Feature
    ndtReadings: [],

    showNDTImportModal() {
        const modalId = 'ndt-import-modal';
        let modal = document.getElementById(modalId);
        if (!modal) {
            modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'modal-overlay hidden';
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div class="modal" style="max-width: 800px; width: 95%; max-height: 90vh; overflow-y: auto;">
                <div class="modal-header">
                    <h3 class="modal-title">📂 Import CSV dari NDT (Niton Data Transfer)</h3>
                    <button class="modal-close" onclick="DirectSwap.closeModal('${modalId}')">×</button>
                </div>
                <div class="modal-body">
                    <div class="form-group mb-3">
                        <label class="form-label">Upload File CSV dari NDT</label>
                        <input type="file" id="ndt-csv-file" class="form-input" accept=".csv" onchange="DirectSwap.parseNDTCSV(this)">
                        <small class="text-gray">Format CSV dari Niton Data Transfer software</small>
                    </div>
                    
                    <div id="ndt-preview" class="hidden">
                        <h4 class="mb-2">📊 Data Readings (Pilih yang ingin digunakan)</h4>
                        <div style="max-height: 400px; overflow-y: auto;">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th style="width: 40px;"><input type="checkbox" id="ndt-select-all" onchange="DirectSwap.toggleSelectAll()"></th>
                                        <th>No</th>
                                        <th>Time</th>
                                        <th>Material</th>
                                        <th class="text-right">Au (%)</th>
                                        <th class="text-right">Ag (%)</th>
                                        <th class="text-right">Cu (%)</th>
                                    </tr>
                                </thead>
                                <tbody id="ndt-readings-body">
                                </tbody>
                            </table>
                        </div>
                        
                        <div class="flex justify-end gap-2 mt-3">
                            <button type="button" class="btn btn-secondary" onclick="DirectSwap.closeModal('${modalId}')">Batal</button>
                            <button type="button" class="btn btn-success" onclick="DirectSwap.applySelectedReadings()">
                                ✅ Terapkan ke Batch
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        modal.classList.remove('hidden');
    },

    parseNDTCSV(input) {
        const file = input.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            const lines = content.split('\n');

            if (lines.length < 2) {
                alert('File CSV kosong atau tidak valid');
                return;
            }

            // Parse header to find column indices
            const header = this.parseCSVLine(lines[0]);
            console.log('CSV Header:', header);

            // Find column indices - search for exact matches first
            const colIndex = {
                readingNo: -1,
                time: -1,
                material: -1,
                au: -1,
                ag: -1,
                cu: -1
            };

            // Search through header for matching columns
            header.forEach((h, idx) => {
                const col = h.trim().toLowerCase();
                if (col === 'reading_no' || col === 'readingno' || col === 'reading no') {
                    colIndex.readingNo = idx;
                } else if (col === 'time' || col === 'datetime') {
                    colIndex.time = idx;
                } else if (col === 'material') {
                    colIndex.material = idx;
                } else if (col === 'au' || col === 'gold' || col === 'au%' || col === 'au (%)' || col === 'au error') {
                    // Au column found - but we want the VALUE column, not error
                    if (!col.includes('error')) {
                        colIndex.au = idx;
                    }
                } else if (col === 'ag' || col === 'silver' || col === 'ag%' || col === 'ag (%)') {
                    if (!col.includes('error')) {
                        colIndex.ag = idx;
                    }
                } else if (col === 'cu' || col === 'copper' || col === 'cu%' || col === 'cu (%)') {
                    if (!col.includes('error')) {
                        colIndex.cu = idx;
                    }
                }
            });

            // NDT CSV specific: Au percentage is in column AE (index 30)
            // Based on user's actual CSV structure
            if (colIndex.au === -1) {
                // Look for specific column by checking header names
                for (let i = 0; i < header.length; i++) {
                    const h = header[i].trim().toLowerCase();
                    // Column should be exactly "Au" or contain "Au" followed by nothing or space
                    if (h === 'au' || h.match(/^au\s*$/)) {
                        colIndex.au = i;
                        break;
                    }
                }
            }

            console.log('Header length:', header.length);
            console.log('Full header:', header);

            // If still not found, use known column positions from Niton NDT
            // Au = Column AE (index 30), Ag = Column U (index 20), Cu = Column AS (index 44)
            if (colIndex.au === -1) {
                colIndex.au = 30; // Column AE - Au percentage
            }
            if (colIndex.ag === -1) {
                colIndex.ag = 20; // Column U - Ag percentage
            }
            if (colIndex.cu === -1) {
                colIndex.cu = 44; // Column AS - Cu percentage
            }

            console.log('Final Column Indices:', colIndex);
            console.log('Au column:', colIndex.au, 'Header at Au:', header[colIndex.au] || 'N/A');
            console.log('Ag column:', colIndex.ag, 'Header at Ag:', header[colIndex.ag] || 'N/A');
            console.log('Cu column:', colIndex.cu, 'Header at Cu:', header[colIndex.cu] || 'N/A');

            // Parse data rows
            this.ndtReadings = [];

            for (let i = 1; i < lines.length; i++) {
                const row = this.parseCSVLine(lines[i]);
                if (row.length < 5) continue;

                // Get Au value from detected column
                let auValue = NaN;
                let agValue = 0;
                let cuValue = 0;

                if (colIndex.au !== -1 && row[colIndex.au]) {
                    auValue = this.parsePercentage(row[colIndex.au]);
                }

                // If still invalid, try adjacent columns (Au values might shift by 1-2 columns)
                if (isNaN(auValue) || auValue <= 0 || auValue > 100) {
                    for (let offset = -2; offset <= 2; offset++) {
                        const tryIdx = colIndex.au + offset;
                        if (tryIdx >= 0 && tryIdx < row.length) {
                            const val = this.parsePercentage(row[tryIdx]);
                            if (!isNaN(val) && val > 0 && val < 100) {
                                auValue = val;
                                break;
                            }
                        }
                    }
                }

                if (isNaN(auValue) || auValue <= 0 || auValue > 100) continue;

                // Get Ag and Cu if columns detected
                if (colIndex.ag !== -1) {
                    agValue = this.parsePercentage(row[colIndex.ag]) || 0;
                }
                if (colIndex.cu !== -1) {
                    cuValue = this.parsePercentage(row[colIndex.cu]) || 0;
                }

                // Get material/description
                let material = '';
                if (colIndex.material !== -1) {
                    material = row[colIndex.material] || '';
                }
                // Also look for material in common positions
                if (!material) {
                    for (let j = 6; j < Math.min(row.length, 12); j++) {
                        const val = row[j];
                        if (val && typeof val === 'string' && val.length > 3 && isNaN(parseFloat(val))) {
                            material = val;
                            break;
                        }
                    }
                }

                this.ndtReadings.push({
                    index: i,
                    readingNo: row[colIndex.readingNo !== -1 ? colIndex.readingNo : 0] || i,
                    time: row[colIndex.time !== -1 ? colIndex.time : 1] || '',
                    material: material,
                    au: auValue,
                    ag: agValue > 100 ? 0 : agValue,
                    cu: cuValue > 100 ? 0 : cuValue,
                    selected: true
                });
            }

            console.log('Parsed NDT Readings:', this.ndtReadings);

            if (this.ndtReadings.length === 0) {
                alert('Tidak ada data valid ditemukan. Pastikan file CSV berisi kolom Au dengan nilai persentase.');
                return;
            }

            // Render preview
            this.renderNDTPreview();
        };

        reader.readAsText(file);
    },

    parseCSVLine(line) {
        // Handle CSV with potential commas inside quotes
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        return result;
    },

    parsePercentage(value) {
        if (!value) return NaN;
        let str = String(value).trim();

        // Handle Indonesian/European format: comma as decimal separator
        // e.g. "59,043" should become 59.043
        // But be careful with thousand separators like "1.234,56"

        // If contains both . and , - assume . is thousand separator and , is decimal
        if (str.includes('.') && str.includes(',')) {
            str = str.replace(/\./g, '').replace(',', '.');
        } else if (str.includes(',')) {
            // Only comma - treat as decimal separator
            str = str.replace(',', '.');
        }

        // Remove any remaining non-numeric characters except decimal point and minus
        const cleaned = str.replace(/[^0-9.\-]/g, '');
        return parseFloat(cleaned);
    },

    renderNDTPreview() {
        const preview = document.getElementById('ndt-preview');
        const tbody = document.getElementById('ndt-readings-body');

        if (!preview || !tbody) return;

        tbody.innerHTML = this.ndtReadings.map((r, idx) => `
            <tr>
                <td><input type="checkbox" class="ndt-row-check" data-idx="${idx}" ${r.selected ? 'checked' : ''} onchange="DirectSwap.toggleReading(${idx})"></td>
                <td>${r.readingNo}</td>
                <td style="font-size: 12px;">${r.time}</td>
                <td>${r.material}</td>
                <td class="text-right font-bold" style="color: #d97706;">${r.au.toFixed(2)}%</td>
                <td class="text-right">${r.ag.toFixed(2)}%</td>
                <td class="text-right">${r.cu.toFixed(2)}%</td>
            </tr>
        `).join('');

        preview.classList.remove('hidden');
    },

    toggleSelectAll() {
        const selectAll = document.getElementById('ndt-select-all');
        const checked = selectAll?.checked || false;
        this.ndtReadings.forEach(r => r.selected = checked);
        this.renderNDTPreview();
    },

    toggleReading(idx) {
        if (this.ndtReadings[idx]) {
            this.ndtReadings[idx].selected = !this.ndtReadings[idx].selected;
        }
    },

    applySelectedReadings() {
        const selected = this.ndtReadings.filter(r => r.selected);
        if (selected.length === 0) {
            alert('Pilih minimal 1 reading untuk diterapkan');
            return;
        }

        const batchContainer = document.getElementById('batch-rows');
        if (!batchContainer) {
            alert('Modal Direct Swap belum dibuka');
            return;
        }

        // Get existing rows for merging
        const existingRows = batchContainer.querySelectorAll('.batch-row');

        selected.forEach((reading, index) => {
            let row;
            if (index < existingRows.length) {
                // Update existing row
                row = existingRows[index];
            } else {
                // Add new row if we have more readings than existing rows
                this.addBatchRow();
                const newRows = batchContainer.querySelectorAll('.batch-row');
                row = newRows[newRows.length - 1];
            }

            // Update purity field
            const purityInput = row.querySelector('.batch-purity');
            if (purityInput) {
                purityInput.value = reading.au.toFixed(2);
                this.flashInput(purityInput);
            }

            // Populate Bar ID from reading number if empty
            const barIdInput = row.querySelector('.batch-bar-id');
            if (barIdInput && (!barIdInput.value || barIdInput.value === '-')) {
                barIdInput.value = reading.readingNo;
                this.flashInput(barIdInput);
            }
        });

        this.closeModal('ndt-import-modal');
        this.calculateTotals();
        this.showXRFNotification(`✅ ${selected.length} kadar berhasil diimport dari NDT`);
    },

    loadTransactions() {
        this.transactions = Storage.get('direct_swaps') || [];
    },

    async saveTransactions() {
        return await Storage.set(Storage.KEYS.DIRECT_SWAPS, this.transactions);
    },

    showCreateModal() {
        const modalId = 'direct-swap-modal';
        let modal = document.getElementById(modalId);
        if (!modal) {
            modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'modal-overlay hidden';
            document.body.appendChild(modal);
        }

        const customers = Storage.get('erp_customers') || [];
        const items = Storage.get('erp_items') || [];
        let scrapItems = items.filter(i => {
            const cat = (i.category || '').toLowerCase();
            const name = (i.name || '').toLowerCase();
            // Broader filter to ensure items show up
            return cat.includes('raw') || cat.includes('scrap') || cat.includes('bahan') ||
                name.includes('scrap') || name.includes('mentah');
        });
        let finishedGoods = items.filter(i => {
            const cat = (i.category || '').toLowerCase();
            const name = (i.name || '').toLowerCase();
            // Broader filter for finished goods
            return cat.includes('finished') || cat.includes('gold bar') || cat.includes('jadi') ||
                name.includes('murni') || name.includes('24k') || name.includes('bar');
        });

        // Robust Fallback: If filtered list is empty, show all items to prevent empty dropdowns
        if (scrapItems.length === 0) scrapItems = items;
        if (finishedGoods.length === 0) finishedGoods = items;

        // Debug log to help if items still don't show
        console.log('DirectSwap: Found', scrapItems.length, 'scrap items and', finishedGoods.length, 'finished goods.');

        modal.innerHTML = `
            <div class="modal" style="max-width: 1400px; width: 95%; background-color: #1A1A1A; color: #ffffff;">
                <div class="modal-header">
                    <h3 class="modal-title">🔄 Transaksi Pemurnian Express Baru</h3>
                    <button class="modal-close" onclick="DirectSwap.closeCreateModal()">×</button>
                </div>
                <div class="modal-body">
                    <form id="swap-form">
                        <input type="hidden" id="swap-type" value="TRADING">
                        <div class="grid grid-2 gap-2 mb-3">
                            <div class="form-group">
                                <label class="form-label">Gudang Sumber/Tujuan</label>
                                <select id="swap-warehouse" class="form-select">
                                    ${(Storage.getWarehouses() || []).length > 0
                ? (Storage.getWarehouses() || []).map(w => `<option value="${w.code}">${w.name}</option>`).join('')
                : '<option value="MAIN">MAIN (Default)</option>'}
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Tanggal</label>
                                <input type="date" id="swap-date" class="form-input" value="${new Date().toISOString().split('T')[0]}">
                            </div>
                        </div>

                        <div class="form-group mb-3">
                            <label class="form-label">Customer (KYC Restricted)</label>
                            <select id="swap-customer" class="form-select" onchange="DirectSwap.onCustomerChange(this.value)" required>
                                <option value="">-- Pilih Customer --</option>
                                ${customers.map(c => {
                    // Always read fresh from Storage to avoid stale/empty kycRecords
                    // (happens when DirectSwap is opened without visiting KYC menu first)
                    let kycApproved = false;
                    if (typeof CustomerKYC !== 'undefined') {
                        // Force reload records from Storage before checking
                        if (!CustomerKYC.kycRecords || CustomerKYC.kycRecords.length === 0) {
                            CustomerKYC.loadKYCRecords();
                        }
                        const kycStatus = CustomerKYC.checkKYCStatus(c.id);
                        kycApproved = kycStatus.approved;
                    } else {
                        kycApproved = true; // fallback: allow if module not loaded
                    }
                    const label = `${c.code} - ${c.name} ${kycApproved ? '✅' : '(❗ KYC Pending)'}`;
                    return `<option value="${c.id}">${label}</option>`;
                }).join('')}
                            </select>
                            <div id="kyc-warning-area" class="mt-2" style="display: none;"></div>
                        </div>

                        <div class="form-group mb-3">
                            <label class="form-label font-bold">Berat Tanda Terima Customer (g)</label>
                            <input type="number" id="swap-receipt-weight" class="form-input" step="0.01" 
                                   placeholder="0.00" oninput="DirectSwap.validateWeight()" 
                                   style="border: 2px solid #3b82f6; background: #ffffff; color: #000000;">
                            <small class="text-gray italic">Masukkan total berat yang tertulis di tanda terima customer</small>
                        </div>

                         <!-- XRF Status Indicator -->
                        <div class="card p-2 mb-3" style="background: #f9fafb; border: 1px solid #e5e7eb;">
                            <div class="flex justify-between align-center">
                                <div id="xrf-status-indicator">
                                    <span style="color: #9ca3af;">🔴 XRF Offline</span>
                                </div>
                                <small style="color: #6b7280;">Real-time XRF integration</small>
                            </div>
                            <div id="xrf-notification" style="display: none;"></div>
                        </div>

                        <!-- XRF Advanced Diagnostics (Hidden by default) -->
                        <div id="xrf-diagnostics-area" class="card p-3 mb-3 hidden" style="background: #fff; border: 1px solid #3b82f6;">
                            <h4 class="mb-2 text-primary">🛠️ Hardware Diagnostics</h4>
                            <div class="grid grid-2 gap-2 mb-2">
                                <div class="form-group">
                                    <label class="form-label small">Bridge IP/Hostname</label>
                                    <div class="flex gap-1">
                                        <input type="text" id="diag-bridge-ip" class="form-input form-input-sm" value="${this.bridgeIP}" style="height: 30px;">
                                        <button type="button" class="btn btn-sm btn-secondary" onclick="DirectSwap.updateBridgeIP(document.getElementById('diag-bridge-ip').value)">Set</button>
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label class="form-label small">Action</label>
                                    <button type="button" class="btn btn-sm btn-primary w-full" onclick="DirectSwap.manualReconnect()">Force Reconnect</button>
                                </div>
                            </div>
                            <label class="form-label small">Connection Logs:</label>
                            <div id="xrf-log-container" style="background: #f8fafc; border: 1px solid #cbd5e1; height: 120px; overflow-y: auto; font-family: monospace; font-size: 11px; padding: 5px;">
                                <!-- Logs appear here -->
                            </div>
                            <small class="text-gray mt-1 block">Jika status 'Offline', pastikan file bridge di Windows sudah dijalankan dan port 8765 tidak terblokir Firewall.</small>
                        </div>

                        <div class="grid gap-3" style="display: grid; grid-template-columns: 2fr 1fr;">
                            <!-- SECTION: IN (SCRAP) -->
                            <div class="card p-3 bg-light">
                                <h4 class="mb-2 text-success">📥 Barang Masuk (Scrap)</h4>
                                <div class="form-group mb-2">
                                    <label class="form-label">Item Scrap</label>
                                    <select id="swap-item-in" class="form-select" onchange="DirectSwap.onItemInChange(this.value)">
                                        <option value="">-- Pilih Item --</option>
                                        ${scrapItems.map(i => `<option value="${i.code}">${i.code} - ${i.name}</option>`).join('')}
                                    </select>
                                </div>
                                <div id="batch-container">
                                    <label class="form-label flex justify-between align-center">
                                        Rincian Berat & Kadar
                                        <div class="flex gap-1">
                                            <button type="button" class="btn btn-sm btn-info" onclick="DirectSwap.showNDTImportModal()">📂 Import CSV</button>
                                            <button type="button" class="btn btn-sm btn-outline" onclick="DirectSwap.addBatchRow()">+ Tambah Bar</button>
                                        </div>
                                    </label>
                                    <div id="batch-rows">
                                        <!-- Header Row -->
                                        <div class="grid gap-1 mb-1 font-bold small text-gray" style="display: grid; grid-template-columns: 0.8fr 1.5fr 1.5fr 1.2fr 1.2fr 1.6fr 1.8fr 0.4fr;">
                                            <div>ID</div>
                                            <div>Berat (g)</div>
                                            <div>Kadar (%)</div>
                                            <div class="text-center">Grade</div>
                                            <div class="text-center">Ret %</div>
                                            <div class="text-right">Fee</div>
                                            <div class="text-right">Net (Au)</div>
                                            <div></div>
                                        </div>
                                        <!-- Rows will be added by addBatchRow() -->
                                    </div>
                                </div>

                                <!-- Material Integrity Verification (Added for Anti-Fraud) -->
                                <div class="card p-2 mt-3" style="background: #fffbeb; border: 1px solid #fcd34d;">
                                    <h5 class="mb-1 flex align-center gap-1" style="color: #000000 !important;">🛡️ Verifikasi Kejujuran Material</h5>
                                    <div class="flex gap-3 align-center mb-2">
                                        <label class="flex align-center gap-1 cursor-pointer">
                                            <input type="checkbox" id="swap-physical-check" onchange="DirectSwap.calculateTotals()"> 
                                            <span class="small font-bold" style="color: #000000 !important;">Sudah Potong/Bor (Internal Check)</span>
                                        </label>
                                    </div>
                                    <div id="core-check-area" style="display: none;">
                                        <div class="form-group mb-3">
                                            <label class="form-label small">Kadar Core (%)</label>
                                            <input type="number" id="swap-purity-core" class="form-input form-input-sm" step="0.1" placeholder="Test XRF bagian dalam" oninput="DirectSwap.calculateTotals()">
                                        </div>
                                        
                                        <!-- Multi-Angle Evidence Gallery -->
                                        <div class="form-group">
                                            <label class="form-label small font-bold mb-2 flex justify-between">
                                                📸 Gallery Bukti Fisik (Multi-Angle)
                                                <span class="text-gray font-normal">Min. 2 Angle Disarankan</span>
                                            </label>
                                            
                                            <div id="evidence-gallery-container" class="grid grid-3 gap-2 mb-3">
                                                <!-- Thumbnails will be rendered here -->
                                            </div>

                                            <div class="flex gap-2">
                                                <div class="flex-1">
                                                    <select id="gallery-angle-select" class="form-select form-select-sm">
                                                        <option value="top">Atas / Depan (Top)</option>
                                                        <option value="bottom">Bawah / Belakang (Bottom)</option>
                                                        <option value="core">Inti / Lubang Bor (Core)</option>
                                                        <option value="other">Lainnya (Additional)</option>
                                                    </select>
                                                </div>
                                                <div class="flex-1 relative">
                                                    <input type="file" id="gallery-photo-input" class="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onchange="DirectSwap.handleGalleryCapture(this)">
                                                    <button type="button" class="btn btn-sm btn-outline w-100">➕ Ambil Foto</button>
                                                </div>
                                                <button type="button" id="btn-ai-analyze" class="btn btn-sm btn-info" onclick="DirectSwap.analyzeMicroscopeAI()" disabled>🤖 Analisis AI</button>
                                            </div>
                                        </div>
                                    </div>
                                    <div id="microscope-preview-container" class="mt-2 hidden">
                                        <div id="ai-analysis-result" class="p-3 rounded bg-white border border-dashed font-bold shadow-sm" style="font-size: 13px; border-color: #3b82f6;"></div>
                                    </div>
                                    <div id="purity-variance-alert" class="mt-2 flex align-center" style="font-size: 11px; font-weight: 600;">
                                        <!-- Alert messages for purity discrepancy -->
                                    </div>

                                    <div id="manual-decision-area" class="mt-3 p-2 rounded bg-white border" style="display: none;">
                                        <label class="form-label small font-bold">Keputusan Petugas (Manual)</label>
                                        <select id="swap-integrity-decision" class="form-select form-select-sm" onchange="DirectSwap.calculateTotals()">
                                            <option value="PENDING">-- Pilih Keputusan --</option>
                                            <option value="ACCEPT">✅ TERIMA (Material Valid)</option>
                                            <option value="REJECT">❌ TOLAK (Indikasi Fraud)</option>
                                            <option value="RECHECK">⚠️ CEK ULANG (Butuh Lebur)</option>
                                        </select>
                                    </div>
                                    <small style="font-size: 10px; color: #000000 !important; font-weight: 500;">Wajib untuk barang tebal (Bar/Slab) guna mendeteksi inti tungsten/tembaga.</small>
                                </div>

                                <div class="form-group mt-3">
                                    <label class="form-label font-bold">📄 Transaction Provenance (Bukti Asal Usul)</label>
                                    <input type="file" id="swap-provenance-file" class="form-input" onchange="DirectSwap.handleProvenanceUpload(this)">
                                    <small class="text-gray">Upload foto KTP/NPWP/Surat Jalan asal barang jika diperlukan.</small>
                                    <div id="provenance-preview" class="mt-2 hidden">
                                        <img src="" style="max-height: 100px; border-radius: 4px; border: 1px solid #ddd;">
                                    </div>
                                </div>

                                <hr class="my-2">
                                <div class="grid grid-2 gap-2">
                                    <div class="form-group">
                                        <label class="form-label">Total Berat Bruto</label>
                                        <input type="text" id="swap-weight-in" class="form-input" readonly>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">Rata-rata Kadar</label>
                                        <input type="text" id="swap-purity-in" class="form-input" readonly>
                                    </div>
                                </div>
                                <div id="weight-validation-indicator" class="mt-2 p-2 rounded hidden" style="font-weight: 600; font-size: 14px; text-align: center;">
                                    <!-- Validasi berat muncul di sini -->
                                </div>
                                <div class="form-group mt-2" id="price-in-group">
                                    <label class="form-label">Harga Beli Scrap (Rp/g) @ Purity</label>
                                    <input type="number" id="swap-price-in" class="form-input" oninput="DirectSwap.calculateTotals()">
                                </div>
                            </div>

                            <!-- SECTION: OUT (FINISHED GOODS) -->
                            <div class="card p-3 bg-light border-primary">
                                <h4 class="mb-2 text-danger">⚓ Barang Akan Diserahkan (OUT)</h4>
                                <div class="form-group mb-2">
                                    <label class="form-label">Item Murni</label>
                                    <select id="swap-item-out" class="form-select" onchange="DirectSwap.onItemOutChange(this.value)">
                                        <option value="">-- Pilih Item --</option>
                                        ${finishedGoods.map(i => `<option value="${i.code}">${i.code} - ${i.name}</option>`).join('')}
                                    </select>
                                </div>
                                <div class="form-group mb-2">
                                    <label class="form-label">Berat Fine Gold (Total OUT)</label>
                                    <input type="number" id="swap-weight-out" class="form-input" step="0.01" oninput="DirectSwap.calculateTotals()">
                                    <small class="text-gray" id="yield-calc-hint">Est. Max Out: 0.00 g (Pure eq)</small>
                                </div>
                                <div id="output-serial-container" class="mt-2 p-2 border rounded bg-white">
                                    <label class="form-label flex justify-between">
                                        Rincian Nomor Seri (OUT)
                                        <button type="button" class="btn btn-sm btn-outline" onclick="DirectSwap.addOutputSerialRow()">+ Tambah Seri</button>
                                    </label>
                                    <div id="output-serial-rows">
                                        <!-- Rows will be added here -->
                                    </div>
                                    <small class="text-gray">Input ini akan memecah baris di Surat Jalan.</small>
                                </div>
                                <div class="form-group mb-2" id="fee-group">
                                    <label class="form-label">Biaya Jasa / Fee (Rp/g Bruto)</label>
                                    <input type="number" id="swap-fee" class="form-input" oninput="DirectSwap.calculateTotals()">
                                    <small class="text-primary" id="fee-total-display">Total Fee: Rp 0</small>
                                </div>
                                <div class="mt-3 p-2 bg-white rounded border">
                                    <div class="flex justify-between mb-1">
                                        <span>Total Value IN:</span>
                                        <span id="val-in-display" class="bold text-success">Rp 0</span>
                                    </div>
                                    <div class="flex justify-between mb-1">
                                        <span>Total Cost OUT:</span>
                                        <span id="val-out-display" class="bold text-danger">Rp 0</span>
                                    </div>
                                    <div class="flex justify-between mb-1 pt-1 border-top">
                                        <span>Service Revenue:</span>
                                        <span id="revenue-display" class="bold text-primary">Rp 0</span>
                                    </div>
                                    <div id="gold-balance-row" class="flex justify-between mt-1 pt-1 border-top" style="display: none;">
                                        <span id="variance-status" class="small bold">Gold Balance:</span>
                                        <span id="variance-display" class="bold">0.000 g</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="form-group mt-3">
                            <label class="form-label">Catatan</label>
                            <textarea id="swap-notes" class="form-input" rows="2" placeholder="Contoh: Titipan peleburan atau keterangan lainnya"></textarea>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="DirectSwap.closeCreateModal()">Batal</button>
                    <button class="btn btn-primary-outline" onclick="DirectSwap.submitForm('DRAFT')">💾 Simpan Draft</button>
                    <button class="btn btn-primary" onclick="DirectSwap.submitForm('COMPLETED')">📦 Simpan & Finalisasi</button>
                </div>
            </div>
        `;

        modal.classList.remove('hidden');
        this.addBatchRow(); // Add first default row if empty
        this.evidenceGallery = {}; // Reset gallery for new transaction
        this.renderEvidenceGallery();
        this.calculateTotals();
        this.updateXRFStatus(); // Ensure status is correctly shown on open
    },

    closeCreateModal() {
        const modal = document.getElementById('direct-swap-modal');
        if (modal) modal.classList.add('hidden');
    },

    onCustomerChange(customerId) {
        if (!customerId) {
            this.hideKYCWarning();
            return;
        }

        if (typeof CustomerKYC !== 'undefined') {
            const kycStatus = CustomerKYC.checkKYCStatus(customerId);
            if (!kycStatus.approved) {
                this.showKYCWarning(kycStatus);
            } else {
                this.hideKYCWarning();
            }
        }
    },

    showKYCWarning(status) {
        const warningArea = document.getElementById('kyc-warning-area');
        if (warningArea) {
            warningArea.innerHTML = `
                <div class="alert alert-danger p-2" style="border: 2px solid #e74c3c; background: #fff5f5; border-radius: 6px;">
                    <strong style="color: #c0392b; font-size: 13px;">🛑 KYC RESTRICTED: ${status.status.toUpperCase()}</strong>
                    <p class="small m-0" style="color: #555;">${status.reason}</p>
                </div>
            `;
            warningArea.style.display = 'block';
        }

        // Disable Save & Finalize button
        const finalizeBtn = document.querySelector('button[onclick="DirectSwap.submitForm(\'COMPLETED\')"]');
        if (finalizeBtn) {
            finalizeBtn.disabled = true;
            finalizeBtn.style.opacity = '0.5';
            finalizeBtn.style.cursor = 'not-allowed';
            finalizeBtn.title = `Locked: KYC ${status.status}`;
        }
    },

    hideKYCWarning() {
        const warningArea = document.getElementById('kyc-warning-area');
        if (warningArea) warningArea.style.display = 'none';

        const finalizeBtn = document.querySelector('button[onclick="DirectSwap.submitForm(\'COMPLETED\')"]');
        if (finalizeBtn) {
            finalizeBtn.disabled = false;
            finalizeBtn.style.opacity = '1';
            finalizeBtn.style.cursor = 'pointer';
            finalizeBtn.title = '';
        }
    },

    provenanceData: '',

    handleProvenanceUpload(input) {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                this.provenanceData = e.target.result;
                const preview = document.getElementById('provenance-preview');
                const img = preview.querySelector('img');
                img.src = e.target.result;
                preview.classList.remove('hidden');
            };
            reader.readAsDataURL(input.files[0]);
        }
    },

    // Utility function for number formatting
    formatNumber(value, decimalPlaces = 2) {
        return new Intl.NumberFormat('id-ID', {
            minimumFractionDigits: decimalPlaces,
            maximumFractionDigits: decimalPlaces
        }).format(value);
    },

    // Unformat string into raw number (handles id-ID dots and commas, also dot-only format)
    unformatNumber(value) {
        if (!value && value !== 0) return 0;
        if (typeof value === 'number') return value;
        let str = String(value).trim();
        
        // If there's both dot and comma, assume it's like 1.234,56 (dot=thousand, comma=decimal)
        if (str.includes('.') && str.includes(',')) {
            // Check which comes last to determine format
            if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
                // Indonesian format: 1.234,56
                str = str.replace(/\./g, '').replace(',', '.');
            } else {
                // English format: 1,234.56
                str = str.replace(/,/g, '');
            }
        } else if (str.includes(',')) {
            // Only comma - check if it's likely a decimal (only one comma)
            const commaCount = (str.match(/,/g) || []).length;
            if (commaCount === 1) {
                str = str.replace(',', '.');
            } else {
                // Multiple commas, likely thousand separator
                str = str.replace(/,/g, '');
            }
        }
        // If only dot (like 99.91), it's already a valid decimal separator for parseFloat
        
        // Remove any non-numeric characters except decimal point and minus
        const cleaned = str.replace(/[^0-9.\-]/g, '');
        return parseFloat(cleaned) || 0;
    },

    // Utility function for currency formatting
    formatCurrency(value) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value);
    },

    addBatchRow() {
        const container = document.getElementById('batch-rows');
        const row = document.createElement('div');
        row.className = 'grid gap-1 mb-1 batch-row';
        row.style.display = 'grid';
        row.style.gridTemplateColumns = '0.8fr 1.5fr 1.5fr 1.2fr 1.2fr 1.6fr 1.8fr 0.4fr';

        row.innerHTML = `
        <input type="text" class="form-input batch-bar-id" placeholder="ID" style="text-align:center; background: #ffffff !important; color: #000000 !important; font-weight: 800; border: 2px solid #3b82f6; position: relative; z-index: 10;">
        
        <div class="flex gap-1" style="position:relative;">
            <input type="text" inputmode="decimal" class="form-input batch-weight" placeholder="Berat (mis. 1000,5)" oninput="DirectSwap.calculateTotals()" style="background: #ffffff !important; color: #000000 !important; font-weight: 800; border: 2px solid #10b981;">
            <button type="button" class="btn btn-sm btn-outline px-1" onclick="DirectSwap.captureWeight(this)" title="Ambil dari Timbangan" style="position: absolute; right: 2px; top: 2px; padding: 0 4px; height: 26px;">📥</button>
        </div>

        <div class="flex gap-1" style="position:relative;">
            <input type="text" inputmode="decimal" class="form-input batch-purity" placeholder="Kadar % (mis. 96,2)" oninput="DirectSwap.calculateTotals()" style="background: #ffffff !important; color: #000000 !important; font-weight: 800; border: 2px solid #d97706;">
            <button type="button" class="btn btn-sm btn-outline px-1" onclick="DirectSwap.capturePurity(this)" title="Ambil dari XRF" style="position: absolute; right: 2px; top: 2px; padding: 0 4px; height: 26px;">📥</button>
        </div>

        <!-- New Auto-Calculated Fields -->
        <input type="hidden" class="batch-status" value="ACCEPT">
        <input type="text" class="form-input batch-grade" placeholder="Grade" readonly style="background: #ffffff !important; color: #000000 !important; font-size: 11px; text-align: center; border: 1px solid #ddd;">
        <input type="number" class="form-input batch-return-pct" placeholder="Ret %" readonly style="background: #ffffff !important; color: #000000 !important; font-size: 11px; text-align: center; border: 1px solid #ddd;">
        <input type="text" class="form-input batch-fee" placeholder="Fee" readonly style="background: #ffffff !important; color: #000000 !important; font-size: 11px; text-align: right; border: 1px solid #ddd;">
        <input type="number" class="form-input batch-net-weight" placeholder="Net (Au)" readonly style="background: #ffffff !important; color: #000000 !important; font-weight: bold; font-size: 11px; text-align: right; border: 1px solid #ddd;">

        <button type="button" class="btn btn-sm btn-danger" onclick="DirectSwap.removeBatchRow(this)" style="padding: 0;">×</button>
    `;
        container.appendChild(row);
    },

    removeBatchRow(btn) {
        btn.parentElement.remove();
        this.calculateTotals();
    },

    addOutputSerialRow() {
        const itemCode = document.getElementById('swap-item-out').value;
        if (!itemCode) {
            alert('Pilih Item Murni terlebih dahulu untuk melihat stok nomor seri.');
            return;
        }

        const availableSerials = SerializedItem.getAvailable().filter(i => i.itemCode === itemCode);
        const container = document.getElementById('output-serial-rows');
        const row = document.createElement('div');
        row.className = 'grid grid-3 gap-1 mb-1 output-serial-row';

        row.innerHTML = `
            <select class="form-select out-serial-no" onchange="DirectSwap.onSerialSelect(this)">
                <option value="">-- Pilih SN --</option>
                ${availableSerials.map(s => {
            const moldInfo = s.moldId ? ` [Mold: ${s.moldId}]` : '';
            return `<option value="${s.serialNumber}" data-weight="${s.weight}">${s.serialNumber}${moldInfo} (${this.formatNumber(s.weight, 3)}g)</option>`;
        }).join('')}
            </select>
            <input type="number" class="form-input out-serial-weight" placeholder="Berat (g)" step="0.001" readonly>
            <button type="button" class="btn btn-sm btn-danger" onclick="DirectSwap.removeOutputSerialRow(this)">×</button>
        `;
        container.appendChild(row);
    },

    onSerialSelect(select) {
        const option = select.selectedOptions[0];
        const weight = option.getAttribute('data-weight');
        const row = select.closest('.output-serial-row');
        const weightInput = row.querySelector('.out-serial-weight');

        if (weightInput) {
            weightInput.value = weight || 0;
        }
        this.calculateTotals();
    },

    removeOutputSerialRow(btn) {
        btn.parentElement.remove();
        this.calculateTotals();
    },

    onTypeChange(type) {
        const priceInGroup = document.getElementById('price-in-group');
        const feeGroup = document.getElementById('fee-group');

        if (type === 'MAKLOON') {
            priceInGroup.classList.add('hidden');
            feeGroup.classList.remove('hidden');
        } else {
            priceInGroup.classList.remove('hidden');
            feeGroup.classList.remove('hidden');
        }
        this.calculateTotals();
    },

    onItemInChange(code) {
        // Auto-fill price if needed
    },

    onItemOutChange(code) {
        // Clear SN rows if item changed
        const container = document.getElementById('output-serial-rows');
        if (container) {
            container.innerHTML = '';
            this.calculateTotals();
        }
    },

    calculateTotals() {
        // --- 1. Physical / Anti-Fraud Check ---
        const physicalCheck = document.getElementById('swap-physical-check');
        const coreArea = document.getElementById('core-check-area');
        const purityCoreInput = document.getElementById('swap-purity-core');
        const decisionArea = document.getElementById('manual-decision-area');
        const varianceAlert = document.getElementById('purity-variance-alert');
        const avgPurityInput = document.getElementById('swap-purity-in');

        const avgPurity = this.unformatNumber(avgPurityInput.value) || 0;

        if (physicalCheck && coreArea) {
            if (physicalCheck.checked) {
                coreArea.style.display = 'block';
                const corePurity = this.unformatNumber(purityCoreInput.value) || 0;

                if (corePurity > 0) {
                    const variance = avgPurity - corePurity;
                    if (variance > 1.0) {
                        varianceAlert.innerHTML = `⚠️ Selisih: <span class="text-danger">${this.formatNumber(variance, 2)}%</span> (Kadar luar > dalam)`;
                        varianceAlert.className = 'text-danger';
                    } else if (Math.abs(variance) <= 1.0) {
                        varianceAlert.innerHTML = `✅ Selisih: ${this.formatNumber(variance, 2)}% (Wajar)`;
                        varianceAlert.className = 'text-success';
                    }
                } else {
                    varianceAlert.innerHTML = '';
                }
                if (decisionArea) decisionArea.style.display = 'block';
            } else {
                coreArea.style.display = 'none';
                if (purityCoreInput) purityCoreInput.value = '';
                if (varianceAlert) varianceAlert.innerHTML = '';
                if (decisionArea) decisionArea.style.display = 'none';
            }
        }

        // --- 2. Calculate Batches (Auto-Grading) ---
        let totalWeightIn = 0;
        let totalPureIn = 0; // Based on Return % (Payable to Customer)
        let totalActualGold = 0; // Actual Au content
        let totalRecoveredAg = 0; // Recovered Silver
        let weightedPuritySum = 0;

        const batchRows = document.querySelectorAll('.batch-row');

        batchRows.forEach(row => {
            const w = this.unformatNumber(row.querySelector('.batch-weight').value) || 0;
            const p = this.unformatNumber(row.querySelector('.batch-purity').value) || 0;

            if (w > 0) {
                totalWeightIn += w;
                weightedPuritySum += (w * p);

                const actualAu = w * (p / 100);
                totalActualGold += actualAu;

                let returnPct = 100; // Default recovery rate is 100% of fine gold
                let agReturnPct = 0;
                let grade = '-';
                let fee = 0;

                if (typeof MasterPurity !== 'undefined' && typeof MasterRefiningRules !== 'undefined') {
                    const gradeInfo = MasterPurity.getPurityGrade('GOLD', p);
                    if (gradeInfo) {
                        grade = gradeInfo.grade;
                        const rule = MasterRefiningRules.getRule(gradeInfo.id, w);
                        if (rule) {
                            returnPct = rule.au_return_pct;
                            agReturnPct = rule.ag_return || 0;
                            fee = rule.refining_fee || 0;
                        }
                    }
                }

                const is24K = p >= 99.99 || (grade && grade.includes('24K'));
                if (is24K) {
                    returnPct = 100;
                }

                const purityFactor = is24K ? 1.0 : (p / 100);
                const net = w * purityFactor * (returnPct / 100);
                const recoveredAg = (w - actualAu) * (agReturnPct / 100);
                totalRecoveredAg += recoveredAg;

                const gradeInput = row.querySelector('.batch-grade');
                const returnInput = row.querySelector('.batch-return-pct');
                const feeInput = row.querySelector('.batch-fee');
                const netInput = row.querySelector('.batch-net-weight');

                if (gradeInput) gradeInput.value = grade;
                if (returnInput) returnInput.value = this.formatNumber(returnPct, 2);
                if (feeInput) feeInput.value = this.formatCurrency(fee);
                if (netInput) netInput.value = this.formatNumber(net, 3);

                totalPureIn += net;
            }
        });

        const auGain = totalActualGold - totalPureIn;

        if (totalWeightIn > 0) {
            const avgP = weightedPuritySum / totalWeightIn;
            if (avgPurityInput) avgPurityInput.value = this.formatNumber(avgP, 2);
            document.getElementById('swap-weight-in').value = this.formatNumber(totalWeightIn, 2);

            const yieldHint = document.getElementById('yield-calc-hint');
            if (yieldHint) {
                yieldHint.innerHTML = `Est. Payable Au: ${this.formatNumber(totalPureIn, 3)}g | <b>Au Gain: ${this.formatNumber(auGain, 3)}g</b> | <b>Ag Recovery: ${this.formatNumber(totalRecoveredAg, 3)}g</b>`;
                yieldHint.className = 'text-primary font-bold';
            }
        } else {
            const yieldHint = document.getElementById('yield-calc-hint');
            if (yieldHint) yieldHint.innerText = 'Est. Max Out: 0.00 g (Pure eq)';
        }

        // --- 3. Trading Financials ---
        const priceIn = this.unformatNumber(document.getElementById('swap-price-in').value) || 0;
        const weightOut = this.unformatNumber(document.getElementById('swap-weight-out').value) || 0;
        const feePerGram = this.unformatNumber(document.getElementById('swap-fee').value) || 0;

        const valIn = totalWeightIn * priceIn;
        const itemOutCode = document.getElementById('swap-item-out').value;
        const itemOutMaster = Storage.getItem(itemOutCode);
        const costOut = itemOutMaster ? (itemOutMaster.standardCost || 0) : 0;
        const valOut = weightOut * costOut;

        const totalFeeAmount = totalWeightIn * feePerGram;

        document.getElementById('val-in-display').innerText = this.formatCurrency(valIn);
        document.getElementById('val-out-display').innerText = this.formatCurrency(valOut);

        const revenue = valIn - valOut + totalFeeAmount;
        const revenueEl = document.getElementById('revenue-display');
        revenueEl.innerText = this.formatCurrency(revenue);
        revenueEl.className = revenue >= 0 ? 'text-success' : 'text-danger';

        const feeTotalDisplay = document.getElementById('fee-total-display');
        if (feeTotalDisplay) feeTotalDisplay.innerText = `Total Fee: ${this.formatCurrency(totalFeeAmount)}`;

        // --- 4. Gold Balance Settlement UI ---
        const variance = totalPureIn - weightOut;
        const goldBalanceRow = document.getElementById('gold-balance-row');
        const varianceDisplay = document.getElementById('variance-display');
        const varianceStatus = document.getElementById('variance-status');

        if (goldBalanceRow && Math.abs(variance) > 0.001) {
            goldBalanceRow.style.display = 'flex';
            varianceDisplay.innerText = `${this.formatNumber(variance, 3)} g`;
            varianceDisplay.className = variance > 0 ? 'text-success' : 'text-danger';
            varianceStatus.innerText = variance > 0 ? 'Hutang ke Customer (Debt)' : 'Tagihan ke Customer (Obligation)';
        } else if (goldBalanceRow) {
            goldBalanceRow.style.display = 'none';
        }

        this._currentGoldVariance = variance; // Save for submission
        this._currentAuGain = auGain;
        this._currentAgRecovered = totalRecoveredAg;

        // --- NEW: Sync weight validation indicator ---
        this.validateWeight();
    },

    async validateDataIntegrity() {
        const requiredIds = [
            'swap-customer', 'swap-item-in', 'swap-item-out',
            'swap-weight-out', 'swap-weight-in', 'swap-purity-in',
            'swap-type', 'swap-date'
        ];

        for (const id of requiredIds) {
            if (!document.getElementById(id)) {
                console.error(`🛑 [Integrity Guard] Missing critical UI element: #${id}`);
                alert(`⚠️ Sistem Tidak Stabil: Komponen #${id} hilang. Harap refresh halaman.`);
                return false;
            }
        }

        const batchRows = document.querySelectorAll('.batch-row');
        if (batchRows.length === 0) {
            alert('⚠️ Harap tambahkan minimal satu baris barang masuk.');
            return false;
        }

        for (let i = 0; i < batchRows.length; i++) {
            const row = batchRows[i];
            const requiredClasses = ['.batch-weight', '.batch-purity', '.batch-bar-id', '.batch-status'];
            for (const cls of requiredClasses) {
                if (!row.querySelector(cls)) {
                    console.error(`🛑 [Integrity Guard] Missing element ${cls} in batch row ${i + 1}`);
                    alert(`⚠️ Sistem Tidak Stabil: Data baris ke-${i + 1} tidak lengkap (${cls}). Harap refresh halaman.`);
                    return false;
                }
            }
        }

        return true;
    },

    async submitForm(dataStatus = 'COMPLETED') {
        if (!this.validateDataIntegrity()) return;
        const btn = document.querySelector(`.modal-footer .btn-primary${dataStatus === 'DRAFT' ? '-outline' : ''}`) ||
            document.querySelector('.modal-footer .btn-primary');
        const originalText = btn.innerText;

        const customerId = document.getElementById('swap-customer').value;
        const customer = Storage.getCustomer(customerId);

        const itemInCode = document.getElementById('swap-item-in').value;
        const itemInMaster = Storage.getItem(itemInCode);

        const itemOutCode = document.getElementById('swap-item-out').value;
        const itemOutMaster = Storage.getItem(itemOutCode);

        const weightOut = this.unformatNumber(document.getElementById('swap-weight-out').value) || 0;
        const totalWeightIn = this.unformatNumber(document.getElementById('swap-weight-in').value) || 0;
        const avgPurity = this.unformatNumber(document.getElementById('swap-purity-in').value) || 0;
        const maxYield = (totalWeightIn * avgPurity / 100);
        const type = document.getElementById('swap-type').value;

        if (!customer) {
            alert('Harap pilih Customer terlebih dahulu.');
            return;
        }

        if (typeof CustomerKYC !== 'undefined') {
            const kycCheck = CustomerKYC.checkKYCStatus(customerId);

            // STRICT VALIDATION FOR COMPLETED TRANSACTIONS
            if (dataStatus === 'COMPLETED') {
                if (!kycCheck.approved) {
                    alert(`⚠️ Transaksi Ditolak: KYC ${kycCheck.reason}.\nCustomer harus APPROVED (Clean & Clear) sebelum finalisasi.`);
                    return;
                }
            }
        }
        if (!itemInMaster) {
            alert(`Item Scrap "${itemInCode}" tidak ditemukan.`);
            return;
        }
        if (!itemOutMaster) {
            alert(`Item Murni "${itemOutCode}" tidak ditemukan.`);
            return;
        }

        if (type === 'TRADING' && weightOut > maxYield + 0.005) {
            alert(`⚠️ Yield Protection Alert!\nBerat keluar (${weightOut.toFixed(2)}g) melebihi estimasi emas murni (${maxYield.toFixed(2)}g).`);
            return;
        }

        const batchDetails = [];
        document.querySelectorAll('.batch-row').forEach(row => {
            const w = this.unformatNumber(row.querySelector('.batch-weight').value) || 0;
            const p = this.unformatNumber(row.querySelector('.batch-purity').value) || 0;
            if (w > 0) {
                const netInput = row.querySelector('.batch-net-weight');
                const netVal = netInput ? this.unformatNumber(netInput.value) : (w * p / 100);

                batchDetails.push({
                    barId: row.querySelector('.batch-bar-id').value || '-',
                    weight: w,
                    purity: p,
                    status: row.querySelector('.batch-status').value,
                    grade: row.querySelector('.batch-grade')?.value || '',
                    returnPct: row.querySelector('.batch-return-pct')?.value || '',
                    est24k: netVal.toFixed(3)
                });
            }
        });

        const outputSerials = [];
        document.querySelectorAll('.output-serial-row').forEach(row => {
            const w = this.unformatNumber(row.querySelector('.out-serial-weight').value) || 0;
            const sn = row.querySelector('.out-serial-no').value || '';
            if (w > 0) {
                outputSerials.push({ weight: w, serial: sn });
            }
        });

        const isCoreChecked = document.getElementById('swap-physical-check')?.checked;
        const manualDecision = document.getElementById('swap-integrity-decision')?.value;

        if (isCoreChecked && (!manualDecision || manualDecision === 'PENDING')) {
            alert('Harap pilih "Keputusan Petugas" untuk verifikasi material.');
            return;
        }

        // --- COMPLIANCE ENHANCEMENT: LAB RESULT HARD-LOCK ---
        if (dataStatus === 'COMPLETED') {
            const missingPurity = batchDetails.some(b => !b.purity || b.purity <= 0);
            if (missingPurity) {
                alert('⚠️ Lab Result Hard-Lock: Semua baris barang masuk wajib memiliki data kadar (XRF/Lab) sebelum finalisasi.');
                return;
            }
        }

        const data = {
            id: 'PENDING',
            status: dataStatus, // DRAFT or COMPLETED
            type: type,
            date: document.getElementById('swap-date').value,
            customer: customer,
            customerId: customerId,
            itemIn: {
                code: itemInMaster.code,
                name: itemInMaster.name,
                weight: totalWeightIn,
                purity: avgPurity,
                price: parseFloat(document.getElementById('swap-price-in').value) || 0
            },
            itemOut: {
                id: itemOutMaster.id,
                code: itemOutMaster.code,
                name: itemOutMaster.name,
                category: itemOutMaster.category,
                weight: weightOut,
                serials: outputSerials
            },
            batchDetails: batchDetails,
            fee: totalWeightIn * (parseFloat(document.getElementById('swap-fee').value) || 0),
            evidenceGallery: this.evidenceGallery,
            integrityCheck: {
                isCoreChecked,
                purityCore: this.unformatNumber(document.getElementById('swap-purity-core').value) || 0,
                manualDecision: manualDecision,
                aiResult: document.getElementById('ai-analysis-result')?.innerText || 'Not Analyzed'
            },
            auGain: this._currentAuGain || 0,
            agRecovered: this._currentAgRecovered || 0,
            goldVariance: this._currentGoldVariance || 0,
            provenance: this.provenanceData,
            warehouseCode: document.getElementById('swap-warehouse').value,
            notes: document.getElementById('swap-notes').value,
            strAlert: totalWeightIn >= 1000 // Flag if total weight >= 1kg
        };

        // --- COMPLIANCE ENHANCEMENT: STR ALERT ---
        if (data.strAlert) {
            const confirmSTR = confirm('⚠️ COMPLIANCE ALERT: Transaksi ini melebihi 1kg barang berharga. Sistem akan menandai ini sebagai "Suspicious Transaction Report" (STR) untuk verifikasi manajemen.\n\nApakah anda sudah melakukan verifikasi fisik tambahan?');
            if (!confirmSTR) {
                btn.disabled = false;
                btn.innerText = originalText;
                return;
            }
        }

        btn.disabled = true;
        btn.innerText = 'Menyimpan...';

        const result = await this.createTransaction(data);
        if (result.success) {
            // Only update serial status if finalized
            if (dataStatus === 'COMPLETED' && outputSerials.length > 0) {
                outputSerials.forEach(os => {
                    SerializedItem.updateStatus(os.serial, 'Sold', {
                        soldTo: customerId,
                        soldDate: new Date().toISOString(),
                        swapId: result.id
                    });
                });
            }

            const statusText = dataStatus === 'DRAFT' ? 'Draft Transaksi' : 'Transaksi Pemurnian Express';
            alert(`${statusText} berhasil disimpan.`);
            const modalBody = document.querySelector('#direct-swap-modal .modal-body');
            modalBody.innerHTML = `
                <div class="p-5 text-center">
                    <div class="mb-3" style="font-size: 60px;">✅</div>
                    <h2 class="mb-2">Transaksi Berhasil!</h2>
                    <div class="flex justify-center gap-3">
                        <button class="btn btn-lg btn-primary" onclick="DirectSwap.printCombinedReceipt('${result.id}')">🖨️ Cetak</button>
                        <button class="btn btn-lg btn-outline" onclick="DirectSwap.closeCreateModal()">Tutup</button>
                    </div>
                </div>
            `;
            const modalFooter = document.querySelector('#direct-swap-modal .modal-footer');
            if (modalFooter) modalFooter.classList.add('hidden');
            this.render();
        } else {
            alert('Gagal menyimpan: ' + (result.error || 'Unknown error'));
        }

        btn.disabled = false;
        btn.innerText = originalText;
    },

    viewDetail(id) {
        const trx = this.transactions.find(t => t.id === id);
        if (!trx) return;

        const modalId = 'swap-detail-modal';
        let modal = document.getElementById(modalId);
        if (!modal) {
            modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'modal-overlay hidden';
            document.body.appendChild(modal);
        }

        const feeText = trx.fee > 0 ? this.formatCurrency(trx.fee) : '-';
        const revenueText = this.formatCurrency(trx.serviceRevenue);

        modal.innerHTML = `
            <div class="modal" style="max-width: 800px; width: 90%;">
                <div class="modal-header">
                    <h3 class="modal-title">📄 Detail Transaksi ${trx.id}</h3>
                    <button class="modal-close" onclick="DirectSwap.closeDetailModal()">×</button>
                </div>
                <div class="modal-body">
                    <div class="grid grid-2 gap-4 mb-4">
                        <div class="info-group">
                            <label class="text-gray small block uppercase">Customer</label>
                            <div class="bold text-lg">${trx.customer?.name}</div>
                            <div class="text-gray">${trx.customer?.code || ''}</div>
                        </div>
                        <div class="info-group text-right">
                            <label class="text-gray small block uppercase">Tanggal & Gudang</label>
                            <div class="bold">${this.formatDate(trx.date)}</div>
                            <div class="badge badge-info">${trx.warehouseCode || 'MAIN'}</div>
                        </div>
                    </div>

                    <div class="grid grid-2 gap-3 mb-4">
                        <div class="card p-3 bg-light" style="border-left: 4px solid var(--color-success);">
                            <h4 class="text-success mb-2">📥 Received (IN)</h4>
                            <div class="flex justify-between mb-1">
                                <span>Item:</span>
                                <span class="bold">${trx.itemIn.name}</span>
                            </div>
                            <div class="flex justify-between mb-1">
                                <span>Berat Bruto:</span>
                                <span class="bold">${trx.itemIn.weight} g</span>
                            </div>
                            <div class="flex justify-between mb-1">
                                <span>Kadar Avg:</span>
                                <span class="bold">${trx.itemIn.purity || 0}%</span>
                            </div>
                            
                            <!-- Batch Details Table -->
                            <div class="mt-2 pt-2 border-top">
                                <label class="text-gray small block uppercase mb-1">Rincian Per Bar</label>
                                <table class="w-100 small">
                                    <thead>
                                        <tr class="text-gray border-bottom">
                                            <th class="text-left py-1">ID</th>
                                            <th class="text-right py-1">Berat</th>
                                            <th class="text-right py-1">Kadar</th>
                                            <th class="text-center py-1">Stat</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${(trx.batchDetails || []).map(b => `
                                            <tr class="border-bottom-dotted">
                                                <td class="py-1">${b.barId || '-'}</td>
                                                <td class="text-right py-1">${b.weight}g</td>
                                                <td class="text-right py-1">${b.purity}%</td>
                                                <td class="text-center py-1">
                                                    <span class="badge ${b.status === 'REJECT' ? 'badge-danger' : 'badge-success'}" style="font-size: 8px; padding: 1px 4px;">
                                                        ${b.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>

                            <div class="flex justify-between border-top pt-1 mt-1">
                                <span>Fine Gold eq:</span>
                                <span class="text-primary bold">${((trx.itemIn.weight * (trx.itemIn.purity || 0)) / 100).toFixed(3)} g</span>
                            </div>
                        </div>

                        <div class="card p-3 bg-light" style="border-left: 4px solid var(--color-danger);">
                            <h4 class="text-danger mb-2">📤 Given (OUT)</h4>
                            <div class="flex justify-between mb-1">
                                <span>Item:</span>
                                <span class="bold">${trx.itemOut.name}</span>
                            </div>
                            <div class="flex justify-between mb-1">
                                <span>Berat:</span>
                                <span class="bold">${trx.itemOut.weight} g</span>
                            </div>
                            <div class="flex justify-between mb-1">
                                <span>Cost Unit:</span>
                                <span class="bold">${this.formatCurrency(trx.itemOut.cost || 0)}</span>
                            </div>
                            <div class="flex justify-between border-top pt-1 mt-1">
                                <span>Total Cost:</span>
                                <span class="text-danger bold">${this.formatCurrency(trx.itemOut.totalCost || 0)}</span>
                            </div>
                            ${(trx.itemOut.serials && trx.itemOut.serials.length > 0) ? `
                            <div class="mt-2 pt-2 border-top">
                                <label class="text-gray small block uppercase mb-1">Rincian Nomor Seri</label>
                                <div class="small">
                                    ${trx.itemOut.serials.map(s => `
                                        <div class="flex justify-between border-bottom-dotted py-1">
                                            <span>${s.serial || '-'}</span>
                                            <span class="bold">${s.weight} g</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                            ` : ''}
                        </div>
                    </div>

                    ${(trx.auGain > 0 || trx.agRecovered > 0) ? `
                    <div class="card p-3 mb-4" style="background: #f0fdf4; border: 1px solid #bbf7d0;">
                        <h4 class="text-success mb-2 flex align-center gap-2">✨ Recovery & Refining Gain</h4>
                        <div class="grid grid-2 gap-4">
                            <div>
                                <div class="text-gray small uppercase">Gold Gain (Au)</div>
                                <div class="bold text-lg text-success">${trx.auGain.toFixed(3)} g</div>
                            </div>
                            <div>
                                <div class="text-gray small uppercase">Silver Recovery (Ag)</div>
                                <div class="bold text-lg text-primary">${trx.agRecovered.toFixed(3)} g</div>
                            </div>
                        </div>
                    </div>
                    ` : ''}

                    ${(trx.goldVariance && Math.abs(trx.goldVariance) > 0.001) ? `
                    <div class="card p-3 mb-4" style="background: #f0f9ff; border: 1px solid #bae6fd;">
                        <h4 class="text-info mb-2 flex align-center gap-2">🏆 Gold Balance (Partial Swap)</h4>
                        <div class="grid grid-2 gap-4">
                            <div>
                                <div class="text-gray small uppercase">Nilai Mutasi</div>
                                <div class="bold text-lg ${trx.goldVariance > 0 ? 'text-success' : 'text-danger'}">
                                    ${trx.goldVariance > 0 ? '+' : ''}${trx.goldVariance.toFixed(3)} g
                                </div>
                            </div>
                            <div>
                                <div class="text-gray small uppercase">Keterangan</div>
                                <div class="bold text-lg">
                                    ${trx.goldVariance > 0 ? 'Hutang ke Customer (Debt)' : 'Tagihan ke Customer (Obligation)'}
                                </div>
                            </div>
                        </div>
                    </div>
                    ` : ''}

                    ${(trx.evidenceGallery && Object.keys(trx.evidenceGallery).length > 0) ? `
                    <div class="card p-3 mb-4 bg-light">
                        <h4 class="mb-2 flex align-center gap-2">📸 Evidence Gallery (Multi-Angle)</h4>
                        <div class="grid grid-4 gap-2">
                            ${Object.keys(trx.evidenceGallery).map(angle => `
                                <div class="relative border rounded p-1 bg-white cursor-pointer" onclick="window.open('${trx.evidenceGallery[angle]}', '_blank')">
                                    <img src="${trx.evidenceGallery[angle]}" class="w-100 rounded" style="aspect-ratio: 1; object-fit: cover;">
                                    <div class="absolute bottom-0 left-0 right-0 bg-black-alpha text-white font-xs px-1 text-center">
                                        ${angle.toUpperCase()}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}

                    ${(trx.integrityCheck?.isCoreChecked) ? `
                    <div class="card p-3 mb-4" style="background: #fffbeb; border: 1px solid #fcd34d;">
                        <h4 class="text-warning mb-2 flex align-center gap-2">🛡️ Hasil Verifikasi Kejujuran</h4>
                        <div class="grid grid-2 gap-4">
                            <div>
                                <div class="text-gray small uppercase">Kadar Core</div>
                                <div class="bold text-lg">${trx.integrityCheck.purityCore}%</div>
                            </div>
                            <div>
                                <div class="text-gray small uppercase">Keputusan Petugas</div>
                                <div class="bold text-lg ${trx.integrityCheck.manualDecision === 'ACCEPT' ? 'text-success' : 'text-danger'}">
                                    ${trx.integrityCheck.manualDecision}
                                </div>
                            </div>
                        </div>
                    </div>
                    ` : ''}

                    <div class="form-group mb-3">
                        <label class="text-gray small block uppercase mb-1">Catatan</label>
                        <div class="p-2 bg-light rounded border">${trx.notes || '-'}</div>
                    </div>

                    <div class="card p-3 mb-4">
                        <h4 class="mb-2">💰 Ringkasan Keuangan</h4>
                        <div class="grid grid-3 gap-2 text-center">
                            <div>
                                <label class="text-gray small block">Refinery Fee</label>
                                <div class="bold">${feeText}</div>
                            </div>
                            <div>
                                <label class="text-gray small block">Service Revenue</label>
                                <div class="bold ${trx.serviceRevenue >= 0 ? 'text-success' : 'text-danger'}">${revenueText}</div>
                            </div>
                            <div>
                                <label class="text-gray small block">Status Jurnal</label>
                                <div class="badge badge-success">POSTED</div>
                            </div>
                        </div>
                    </div>

                    <div class="form-group mb-0">
                        <label class="form-label">Catatan</label>
                        <div class="p-2 border rounded bg-light min-h-50">${trx.notes || '-'}</div>
                    </div>
                </div>
                <div class="modal-footer flex justify-between">
                    <button class="btn btn-secondary" onclick="DirectSwap.closeDetailModal()">Tutup</button>
                    <div class="flex gap-2">
                        <button class="btn btn-primary" onclick="DirectSwap.printTransaction('${trx.id}')">🖨️ Tanda Terima</button>
                        <button class="btn btn-warning" onclick="DirectSwap.printInvoice('${trx.id}')">🖨️ Invoice</button>
                        <button class="btn btn-info" onclick="DirectSwap.printBeritaAcara('${trx.id}')">🖨️ Berita Acara</button>
                        <button class="btn btn-success" onclick="DirectSwap.printInternalSuratJalan('${trx.id}')">📋 Surat Jalan Internal</button>
                    </div>
                </div>
            </div>
        `;
        modal.classList.remove('hidden');
    },

    closeDetailModal() {
        const modal = document.getElementById('swap-detail-modal');
        if (modal) modal.classList.add('hidden');
    },

    sortState: {
        field: 'date',
        order: 'desc' // desc = newest first
    },

    toggleSort(field) {
        if (this.sortState.field === field) {
            this.sortState.order = this.sortState.order === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortState.field = field;
            this.sortState.order = 'desc'; // Default desc for new field? Or asc? Usually dates desc.
            // For text fields usually asc.
            if (field === 'customer') this.sortState.order = 'asc';
        }
        this.render();
    },

    getSortIndicator(field) {
        if (this.sortState.field !== field) return '<span style="color:#ccc">↕</span>';
        return this.sortState.order === 'asc' ? '↑' : '↓';
    },

    render() {
        const content = document.getElementById('main-content');
        if (!content) return;

        content.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">🔄 Pemurnian Express</h1>
                <p class="page-description">Tukar emas scrap/perhiasan langsung dengan emas murni (Trading)</p>
            </div>

            <div class="card mb-3">
                <div class="card-header">
                    <h2 class="card-title">Daftar Transaksi Pemurnian Express</h2>
                    <button class="btn btn-primary" onclick="DirectSwap.showCreateModal()">
                        ➕ Pemurnian Express Baru
                    </button>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th style="cursor:pointer" onclick="DirectSwap.toggleSort('date')">
                                        ID / Tanggal ${this.getSortIndicator('date')}
                                    </th>
                                    <th style="cursor:pointer" onclick="DirectSwap.toggleSort('customer')">
                                        Customer ${this.getSortIndicator('customer')}
                                    </th>
                                    <th>Terima (In)</th>
                                    <th>Keluar (Out)</th>
                                    <th>Service Revenue</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody id="swap-list-body">
                                ${this.renderList()}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    },

    renderList() {
        if (this.transactions.length === 0) {
            return '<tr><td colspan="6" class="text-center">Belum ada transaksi tukar tambah.</td></tr>';
        }

        // Filter: only show TRADING (non-MAKLOON) transactions
        const tradingTrx = this.transactions.filter(t => t.type !== 'MAKLOON');

        // Clone and sort
        const sortedTrx = [...tradingTrx].sort((a, b) => {
            const field = this.sortState.field;
            const order = this.sortState.order;
            let valA, valB;

            if (field === 'date') {
                // Sort by ID is usually safer for sequence, but User asked Date.
                // ID contains timestamp sometimes, or sequence. 
                // Let's use ID as secondary sort for Date?
                valA = new Date(a.date).getTime();
                valB = new Date(b.date).getTime();
                if (valA === valB) {
                    // Fallback to ID
                    valA = a.id;
                    valB = b.id;
                }
            } else if (field === 'customer') {
                valA = (a.customer?.name || '').toLowerCase();
                valB = (b.customer?.name || '').toLowerCase();
            }

            if (valA < valB) return order === 'asc' ? -1 : 1;
            if (valA > valB) return order === 'asc' ? 1 : -1;
            return 0;
        });

        const auth = window.App?.getAuthModule() || window.Auth;
        const currentUser = auth.getCurrentUser();
        const userRole = currentUser?.role;
        const isAuthorized = ['ADMIN', 'OWNER', 'DIREKTUR'].includes(userRole);

        return sortedTrx.map(trx => {
            const statusLabel = trx.status === 'COMPLETED' ? 'COMPLETED' : 'DRAFT';
            return `
        <tr>
            <td>
                <strong>${trx.id}</strong><br>
                <small class="text-gray">${this.formatDate(trx.date)}</small>
                <div class="mt-1">
                    ${trx.status === 'COMPLETED' ?
                    '<span class="badge badge-success">Selesai</span>' :
                    '<span class="badge badge-warning">Draft / Pending</span>'}
                ${(trx.goldVariance && trx.goldVariance > 0.001) ? '<br><span class="badge badge-info" style="margin-top:4px;">Partial Swap</span>' : ''}
            </div>
            </td>
            <td>${trx.customer?.name || 'Unknown Customer'}</td>
            <td>
                <span class="text-success bold">${trx.itemIn.weight}g</span> ${trx.itemIn.name}<br>
                ${trx.itemIn.purity > 0 ? `<div style="font-size: 0.85em; color: #d97706; margin-top: 2px;">💎 <strong>${((trx.itemIn.weight * trx.itemIn.purity) / 99.99).toLocaleString('id-ID', { maximumFractionDigits: 2 })}g</strong> (99.99%)</div>` : ''}
                <small class="text-gray">@ ${this.formatCurrency(trx.itemIn.price)}</small>
            </td>
            <td>
                <span class="text-danger bold">${trx.itemOut.weight}g</span> ${trx.itemOut.name}<br>
                    <small class="text-gray">Cost @ ${this.formatCurrency(trx.itemOut.cost)}</small>
            </td>
            <td>
                <span class="bold ${trx.serviceRevenue >= 0 ? 'text-success' : 'text-danger'}">
                    ${this.formatCurrency(trx.serviceRevenue)}
                </span>
            </td>
            <td>
                <div class="flex flex-wrap gap-1">
                    <button class="btn btn-sm btn-secondary" onclick="DirectSwap.printTransaction('${trx.id}')">🖨️ Cetak</button>
                    <button class="btn btn-sm btn-outline" onclick="DirectSwap.viewDetail('${trx.id}')">Detail</button>
                    ${statusLabel === 'DRAFT' && isAuthorized ? `
                        <button class="btn btn-sm btn-success" onclick="DirectSwap.finalizeTransaction('${trx.id}')">✅ Finalisasi</button>
                    ` : ''}
                    ${isAuthorized ? `
                        <button class="btn btn-sm btn-danger" onclick="DirectSwap.deleteTransaction('${trx.id}')">Hapus</button>
                    ` : ''}
                </div>
            </td>
        </tr>
        `;
        }).join('');
    },

    printTransaction(id) {
        const trx = this.transactions.find(t => t.id === id);
        if (!trx) return;

        const config = Storage.get(Storage.KEYS.CONFIG) || {};
        const companyName = config.companyName || "PT GOLDEN ALURA REFINERI";
        
        // Find customer address
        const customers = typeof Storage !== 'undefined' && Storage.getCustomers ? (Storage.getCustomers() || []) : [];
        const customerObj = customers.find(c => c.id === trx.customer?.id || c.name === trx.customer?.name);
        const customerAddress = customerObj?.address || '';

        // Batch Details Row Generation
        let batchRows = '';
        if (trx.batchDetails && trx.batchDetails.length > 0) {
            batchRows = `
                <div style="margin-top: 15px; border: 1px solid #ddd; font-family: Arial, sans-serif;">
                    <strong style="display:block; background:#f5f5f5; padding:6px; font-size:10px; border-bottom: 1px solid #ddd;">Rincian Multi-Bar (Batch)</strong>
                    <table style="width:100%; border-collapse:collapse; font-size:10px;">
                        <thead>
                            <tr style="border-bottom:1px solid #ddd;">
                                <th style="padding:4px; text-align:center; width:30px;">No</th>
                                <th style="padding:4px; text-align:center; width:50px;">Bar ID</th>
                                <th style="padding:4px; text-align:right;">Berat (g)</th>
                                <th style="padding:4px; text-align:right;">Kadar (%)</th>
                                <th style="padding:4px; text-align:right;">Est 24K (g)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${trx.batchDetails.map((b, i) => `
                                <tr style="border-bottom:1px solid #eee;">
                                    <td style="padding:4px; text-align:center;">${i + 1}</td>
                                    <td style="padding:4px; text-align:center;">${b.barId || '-'}</td>
                                    <td style="padding:4px; text-align:right;">${parseFloat(b.weight).toLocaleString('id-ID')}</td>
                                    <td style="padding:4px; text-align:right;">${parseFloat(b.purity).toLocaleString('id-ID')}%</td>
                                    <td style="padding:4px; text-align:right;">${parseFloat(b.est24k).toLocaleString('id-ID')}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }

        // Fee logic text breakdown
        let feeText = '-';
        if (trx.fee > 0) {
            const feePerGram = trx.itemIn.weight > 0 ? (trx.fee / trx.itemIn.weight) : 0;
            feeText = `
                <div style="color: #666; font-size:12px; margin-top:5px;">
                     ${trx.itemIn.weight.toLocaleString('id-ID', { minimumFractionDigits: 2 })} g (Bruto) x Rp ${feePerGram.toLocaleString('id-ID')} /g <br>
                     <strong style="color: #333; font-size:13px; display:inline-block; margin-top:4px;">= Rp ${trx.fee.toLocaleString('id-ID')}</strong>
                </div>
             `;
        }

        const html = `
            <html>
            <head>
                <title>Tanda Terima - ${trx.id}</title>
                <style>
                    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 30px; color: #333; max-width: 800px; margin: 0 auto; line-height: 1.4; }
                    .header { text-align: center; margin-bottom: 20px; }
                    .company-logo { margin-bottom: 5px; }
                    .company { font-size: 18px; font-weight: bold; letter-spacing: 0.5px; color: #886c2e; margin-bottom: 2px; text-transform: uppercase; }
                    .subtitle { font-size: 11px; color: #333; line-height: 1.2; }
                    .double-line { border-bottom: 3px double #333; margin: 15px 0; }
                    
                    .doc-title-container { text-align: center; margin: 20px 0; position: relative; }
                    .doc-title { display: inline-block; font-size: 16px; font-weight: bold; background: white; padding: 0 15px; position: relative; z-index: 1; color: #333; }
                    .doc-title-line { position: absolute; border-bottom: 1px solid #333; top: 50%; left: 15%; right: 15%; z-index: 0; }
                    
                    .trx-id { font-size: 12px; margin-top: 8px; font-family: monospace; color: #333; text-align: center; }
                    .trx-id-line { border-bottom: 1px solid #333; margin: 15px auto; width: 85%; }
                    
                    .customer-box { border: 1px solid #666; padding: 12px 15px; margin-bottom: 20px; border-radius: 2px; }
                    .customer-label { font-size: 10px; color: #666; text-transform: uppercase; margin-bottom: 5px; font-weight: bold; }
                    .customer-name { font-size: 16px; font-weight: bold; color: #333; }
                    .customer-address { font-size: 12px; color: #555; margin-top: 2px; }
                    
                    .content-grid { display: flex; gap: 15px; margin-bottom: 20px; }
                    .col { flex: 1; border: 1px solid #ddd; background: #fff; border-radius: 2px; overflow: hidden; }
                    .col-header { background: #f0f0f0; padding: 8px 10px; font-weight: bold; border-bottom: 1px solid #ddd; font-size: 11px; color: #333; }
                    .col-body { padding: 12px; min-height: 120px; }
                    
                    .item-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; }
                    .item-label { color: #666; }
                    .item-val { font-weight: bold; color: #333; text-align: right; }
                    
                    .financial-section { margin-top: 15px; padding: 12px; border: 1px dashed #ccc; background: #fafafa; border-radius: 2px; }
                    
                    .footer { display: flex; justify-content: space-between; margin-top: 50px; }
                    .sign-box { text-align: center; width: 40%; font-size: 11px; color: #666; }
                    .sign-space { height: 70px; border-bottom: 1px solid #333; margin-bottom: 8px; }
                    .sign-name { color: #333; font-size: 12px; }
                    
                    @media print {
                        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        .no-print { display: none; }
                        button { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="company-logo">
                        <img src="${config.logo || 'https://raw.githubusercontent.com/GoldenAlura/logo/main/gr_logo_gold.png'}" style="max-height: 60px;" alt="GR Logo">
                    </div>
                    <div class="company">${companyName}</div>
                    <div class="subtitle">Kawasan Industri SIER<br>Rungkut Industri IV no.10, Surabaya</div>
                </div>
                
                <div class="double-line"></div>
                
                <div class="doc-title-container">
                    <div class="doc-title-line"></div>
                    <div class="doc-title">Tanda Terima Barang</div>
                </div>
                
                <div class="trx-id">NO: ${trx.id} &nbsp;|&nbsp; TGL: ${this.formatDate(trx.date)}</div>
                <div class="trx-id-line"></div>

                <div class="customer-box">
                    <div class="customer-label">TELAH DITERIMA DARI (RECEIVED FROM):</div>
                    <div class="customer-name">${trx.customer?.name || '-'}</div>
                    <div class="customer-address">${customerAddress}</div>
                </div>

                <div class="content-grid">
                    <!-- KOLOM TERIMA -->
                    <div class="col">
                        <div class="col-header">⚓ BARANG DITERIMA (IN)</div>
                        <div class="col-body">
                            <div class="item-row">
                                <span class="item-label">Barang</span>
                                <span class="item-val">${trx.itemIn.name}</span>
                            </div>
                            <div class="item-row">
                                <span class="item-label">Berat Bruto</span>
                                <span class="item-val" style="font-size:13px;">${parseFloat(trx.itemIn.weight).toLocaleString('id-ID')} g</span>
                            </div>
                            <div class="item-row">
                                <span class="item-label">Kadar / Purity</span>
                                <span class="item-val">${parseFloat(trx.itemIn.purity).toLocaleString('id-ID')}%</span>
                            </div>
                            ${batchRows}
                        </div>
                    </div>

                    <!-- KOLOM SERAHKAN / GANTI -->
                    <div class="col">
                        <div class="col-header">⚓ BARANG AKAN DISERAHKAN (OUT)</div>
                        <div class="col-body">
                            <div class="item-row">
                                <span class="item-label">Barang</span>
                                <span class="item-val">${trx.itemOut.name}</span>
                            </div>
                            <div class="item-row">
                                <span class="item-label">Berat (Fine Gold)</span>
                                <span class="item-val" style="font-size:13px;">${parseFloat(trx.itemOut.weight).toLocaleString('id-ID')} g</span>
                            </div>
                            <div class="item-row">
                                <span class="item-label">Catatan</span>
                                <span class="item-val">${trx.notes || '-'}</span>
                            </div>
                            
                            ${trx.fee > 0 ? `
                            <div class="financial-section">
                                <div style="font-weight:bold; color:#666; font-size:11px; margin-bottom:8px;">Biaya Jasa (Refinery Fee):</div>
                                <div style="text-align:center;">
                                    ${feeText}
                                </div>
                                <div style="font-size:9px; color:#999; margin-top:8px; font-style:italic;">*Belum Termasuk Pajak</div>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                </div>

                <div class="footer">
                    <div class="sign-box">
                        <div style="margin-bottom: 40px;">Diserahkan Oleh (Customer),</div>
                        <div class="sign-space"></div>
                        <div class="sign-name">${trx.customer?.name || '...................'}</div>
                    </div>
                    <div class="sign-box">
                        <div style="margin-bottom: 40px;">Diterima Oleh,</div>
                        <div class="sign-space"></div>
                        <div class="sign-name">PT Golden Alura Refineri</div>
                    </div>
                </div>
                
                <script>
                    window.onload = function() { setTimeout(function(){ window.print(); }, 500); }
                </script>
            </body>
            </html>
        `;

        const win = window.open('', '_blank', 'width=900,height=800');
        win.document.write(html);
        win.document.close();
    },

    printInvoice(id) {
        const trx = this.transactions.find(t => t.id === id);
        if (!trx) return;

        const config = Storage.get(Storage.KEYS.CONFIG) || {};
        const companyName = config.companyName || "PT GOLDEN ALURA REFINERI";
        
        // Find customer address
        const customers = typeof Storage !== 'undefined' && Storage.getCustomers ? (Storage.getCustomers() || []) : [];
        const customerObj = customers.find(c => c.id === trx.customer?.id || c.name === trx.customer?.name);
        const customerAddress = customerObj?.address || '';

        const html = `
            <html>
            <head>
                <title>Invoice - ${trx.id}</title>
                <style>
                    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333; max-width: 800px; margin: 0 auto; }
                    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
                    .company-info { font-size: 13px; color: #555; }
                    .company-name { font-size: 20px; font-weight: bold; color: #886c2e; margin-bottom: 5px; }
                    .invoice-title { font-size: 32px; font-weight: bold; color: #333; text-align: right; letter-spacing: 2px; }
                    
                    .meta-grid { display: flex; justify-content: space-between; margin-bottom: 40px; }
                    .bill-to { width: 50%; }
                    .bill-to-label { font-size: 11px; color: #777; font-weight: bold; text-transform: uppercase; margin-bottom: 5px; }
                    .bill-to-name { font-size: 16px; font-weight: bold; }
                    .bill-to-address { font-size: 13px; color: #555; margin-top: 5px; }
                    
                    .inv-details { text-align: right; }
                    .inv-row { display: flex; justify-content: flex-end; margin-bottom: 5px; font-size: 13px; }
                    .inv-label { font-weight: bold; color: #666; margin-right: 15px; width: 100px; }
                    .inv-val { font-weight: bold; width: 120px; }
                    
                    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                    th { background: #f8f8f8; padding: 12px; text-align: left; font-size: 12px; color: #555; border-bottom: 2px solid #ddd; text-transform: uppercase; }
                    td { padding: 15px 12px; border-bottom: 1px solid #eee; font-size: 13px; }
                    
                    .total-box { display: flex; justify-content: flex-end; margin-top: 20px; }
                    .total-grid { width: 350px; }
                    .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
                    .total-row.grand { font-size: 18px; font-weight: bold; border-top: 2px solid #333; padding-top: 12px; margin-top: 5px; }
                    
                    .notes { margin-top: 50px; font-size: 12px; color: #666; background: #fdfdfd; padding: 15px; border-left: 3px solid #886c2e; }
                    .notes strong { color: #333; }
                    
                    .footer-sign { display: flex; justify-content: flex-end; margin-top: 50px; }
                    .sign-box { text-align: center; width: 200px; }
                    
                    @media print {
                        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        button { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        <div class="company-name">${companyName}</div>
                        <div class="company-info">Kawasan Industri SIER<br>Rungkut Industri IV no.10, Surabaya<br>Email: admin@goldenalura.com</div>
                    </div>
                    <div>
                        <div class="invoice-title">INVOICE</div>
                    </div>
                </div>
                
                <div class="meta-grid">
                    <div class="bill-to">
                        <div class="bill-to-label">Billed To:</div>
                        <div class="bill-to-name">${trx.customer?.name || '-'}</div>
                        <div class="bill-to-address">${customerAddress}</div>
                    </div>
                    <div class="inv-details">
                        <div class="inv-row"><div class="inv-label">Invoice No:</div><div class="inv-val">INV-${trx.id}</div></div>
                        <div class="inv-row"><div class="inv-label">Date:</div><div class="inv-val">${this.formatDate(trx.date)}</div></div>
                        <div class="inv-row"><div class="inv-label">Due Date:</div><div class="inv-val">${this.formatDate(trx.date)}</div></div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="width: 50px;">No</th>
                            <th>Description</th>
                            <th style="text-align: right;">Quantity (g)</th>
                            <th style="text-align: right;">Rate / g</th>
                            <th style="text-align: right;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>1</td>
                            <td>
                                <strong>Biaya Jasa (Refinery Fee)</strong><br>
                                <span style="font-size: 11px; color: #777;">Material IN: ${trx.itemIn.name} (${parseFloat(trx.itemIn.weight).toLocaleString('id-ID')} g @ ${trx.itemIn.purity}%)</span><br>
                                <span style="font-size: 11px; color: #777;">Material OUT: ${trx.itemOut.name}</span>
                            </td>
                            <td style="text-align: right;">${parseFloat(trx.itemIn.weight).toLocaleString('id-ID')}</td>
                            <td style="text-align: right;">Rp ${(trx.itemIn.weight > 0 ? (trx.fee / trx.itemIn.weight) : 0).toLocaleString('id-ID', {maximumFractionDigits:0})}</td>
                            <td style="text-align: right; font-weight: bold;">Rp ${trx.fee.toLocaleString('id-ID')}</td>
                        </tr>
                    </tbody>
                </table>
                
                <div class="total-box">
                    <div class="total-grid">
                        <div class="total-row">
                            <div>Subtotal</div>
                            <div>Rp ${trx.fee.toLocaleString('id-ID')}</div>
                        </div>
                        <div class="total-row grand">
                            <div>Total Due</div>
                            <div>Rp ${trx.fee.toLocaleString('id-ID')}</div>
                        </div>
                    </div>
                </div>
                
                <div class="notes">
                    <strong>Payment Instructions:</strong><br>
                    Harap melakukan pembayaran via transfer bank ke rekening BCA 1234567890 a.n PT GOLDEN ALURA REFINERI. Mohon cantumkan nomor invoice (INV-${trx.id}) pada berita transfer.
                </div>
                
                <div class="footer-sign">
                    <div class="sign-box">
                        <div style="font-size: 12px; color: #666; margin-bottom: 60px;">Authorized Signature,</div>
                        <div style="border-bottom: 1px solid #333; margin-bottom: 5px;"></div>
                        <div style="font-size: 12px; font-weight: bold;">PT Golden Alura Refineri</div>
                    </div>
                </div>
                
                <script>
                    window.onload = function() { setTimeout(function(){ window.print(); }, 500); }
                </script>
            </body>
            </html>
        `;

        const win = window.open('', '_blank', 'width=900,height=800');
        win.document.write(html);
        win.document.close();
    },

    printBeritaAcara(id) {
        const trx = this.transactions.find(t => t.id === id);
        if (!trx) return;

        const config = Storage.get(Storage.KEYS.CONFIG) || {};
        const companyName = config.companyName || "PT GOLDEN ALURA REFINERI";
        
        const customers = typeof Storage !== 'undefined' && Storage.getCustomers ? (Storage.getCustomers() || []) : [];
        const customerObj = customers.find(c => c.id === trx.customer?.id || c.name === trx.customer?.name);
        const customerAddress = customerObj?.address || '';

        const html = `
            <html>
            <head>
                <title>Berita Acara - ${trx.id}</title>
                <style>
                    body { font-family: 'Times New Roman', Times, serif; padding: 50px; color: #000; max-width: 800px; margin: 0 auto; line-height: 1.6; }
                    .header { text-align: center; margin-bottom: 30px; border-bottom: 3px double #000; padding-bottom: 15px; }
                    .company { font-size: 22px; font-weight: bold; text-transform: uppercase; margin-bottom: 5px; }
                    .subtitle { font-size: 12px; }
                    
                    .doc-title { text-align: center; font-size: 18px; font-weight: bold; text-decoration: underline; margin-top: 30px; margin-bottom: 5px; text-transform: uppercase; }
                    .doc-number { text-align: center; font-size: 14px; margin-bottom: 40px; }
                    
                    .content { font-size: 15px; text-align: justify; }
                    
                    .party-section { margin: 20px 0; }
                    .party-table { width: 100%; margin-left: 20px; }
                    .party-table td { padding: 3px; vertical-align: top; }
                    .party-table td:first-child { width: 150px; }
                    
                    .item-box { margin: 30px 0; border: 1px solid #000; padding: 15px; }
                    .item-table { width: 100%; border-collapse: collapse; }
                    .item-table th, .item-table td { border: 1px solid #000; padding: 8px; text-align: left; }
                    .item-table th { background: #f0f0f0; text-align: center; font-weight: bold; }
                    
                    .footer { display: flex; justify-content: space-between; margin-top: 80px; }
                    .sign-box { text-align: center; width: 40%; }
                    .sign-space { height: 90px; }
                    .sign-name { font-weight: bold; text-decoration: underline; }
                    
                    @media print {
                        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        button { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="company">${companyName}</div>
                    <div class="subtitle">Kawasan Industri SIER, Rungkut Industri IV no.10, Surabaya</div>
                </div>
                
                <div class="doc-title">BERITA ACARA SERAH TERIMA BARANG</div>
                <div class="doc-number">Nomor: BAST-${trx.id}</div>
                
                <div class="content">
                    <p>Pada hari ini, tanggal <strong>${this.formatDate(trx.date)}</strong>, yang bertanda tangan di bawah ini:</p>
                    
                    <div class="party-section">
                        <table class="party-table">
                            <tr><td>Nama Perusahaan</td><td>: <strong>${companyName}</strong></td></tr>
                            <tr><td>Alamat</td><td>: Kawasan Industri SIER, Rungkut Industri IV no.10, SBY</td></tr>
                            <tr><td colspan="2"><em>Selanjutnya disebut sebagai <strong>PIHAK PERTAMA</strong> (Yang Menyerahkan)</em></td></tr>
                        </table>
                    </div>
                    
                    <div class="party-section">
                        <table class="party-table">
                            <tr><td>Nama Customer</td><td>: <strong>${trx.customer?.name || '-'}</strong></td></tr>
                            <tr><td>Alamat</td><td>: ${customerAddress || '-'}</td></tr>
                            <tr><td colspan="2"><em>Selanjutnya disebut sebagai <strong>PIHAK KEDUA</strong> (Yang Menerima)</em></td></tr>
                        </table>
                    </div>
                    
                    <p>PIHAK PERTAMA telah menyerahkan barang kepada PIHAK KEDUA, dan PIHAK KEDUA telah menerima barang dari PIHAK PERTAMA dengan rincian sebagai berikut:</p>
                    
                    <div class="item-box">
                        <table class="item-table">
                            <thead>
                                <tr>
                                    <th style="width: 50px;">No</th>
                                    <th>Nama Barang / Deskripsi</th>
                                    <th>Berat (Gram)</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td style="text-align: center;">1</td>
                                    <td>${trx.itemOut.name} (Fine Gold / Hasil Pemurnian)</td>
                                    <td style="text-align: right;"><strong>${parseFloat(trx.itemOut.weight).toLocaleString('id-ID')} g</strong></td>
                                </tr>
                            </tbody>
                        </table>
                        <div style="margin-top: 15px; font-size: 13px;">
                            <strong>Catatan Tambahan:</strong><br>
                            Barang tersebut adalah hasil pemurnian (Direct Swap) dari material masuk berupa ${trx.itemIn.name} (${parseFloat(trx.itemIn.weight).toLocaleString('id-ID')} g, Kadar ${trx.itemIn.purity}%).
                        </div>
                    </div>
                    
                    <p>Demikian Berita Acara Serah Terima Barang ini dibuat dengan sebenarnya dalam keadaan baik dan sesuai dengan kesepakatan untuk dapat dipergunakan sebagaimana mestinya.</p>
                </div>
                
                <div class="footer">
                    <div class="sign-box">
                        <div>PIHAK KEDUA<br>(Yang Menerima),</div>
                        <div class="sign-space"></div>
                        <div class="sign-name">${trx.customer?.name || '.......................'}</div>
                    </div>
                    <div class="sign-box">
                        <div>PIHAK PERTAMA<br>(Yang Menyerahkan),</div>
                        <div class="sign-space"></div>
                        <div class="sign-name">PT Golden Alura Refineri</div>
                    </div>
                </div>
                
                <script>
                    window.onload = function() { setTimeout(function(){ window.print(); }, 500); }
                </script>
            </body>
            </html>
        `;

        const win = window.open('', '_blank', 'width=900,height=800');
        win.document.write(html);
        win.document.close();
    },

    printInternalSuratJalan(id) {
        const trx = this.transactions.find(t => t.id === id);
        if (!trx) return;

        const config = Storage.get(Storage.KEYS.CONFIG) || {};
        const companyName = config.companyName || "PT GOLDEN ALURA REFINERI";
        const printDate = new Date(trx.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        const now = new Date().toLocaleString('id-ID');
        const logoHtml = config.logo ? `<div style="margin-right: 15px;"><img src="${config.logo}" style="max-height: 60px;"></div>` : '';

        const html = `
            <html>
            <head>
                <title>Surat Jalan Internal - ${trx.id}</title>
                <style>
                    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px 40px; color: #333; max-width: 900px; margin: 0 auto; line-height: 1.4; }
                    .header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
                    .company-info { flex: 1; }
                    .company-name { font-size: 20px; font-weight: bold; margin-bottom: 2px; }
                    .company-addr { font-size: 11px; color: #555; }
                    .doc-info { text-align: right; }
                    .doc-title { font-size: 22px; font-weight: bold; text-decoration: underline; margin-bottom: 5px; text-transform: uppercase; }
                    .doc-no { font-size: 15px; font-weight: bold; font-family: monospace; }
                    
                    .meta-grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 40px; margin-bottom: 30px; margin-top: 20px; }
                    .meta-col { display: flex; flex-direction: column; }
                    .meta-item { display: flex; gap: 10px; border-bottom: 1px dotted #ccc; padding: 8px 0; align-items: center; }
                    .meta-label { width: 120px; color: #666; font-size: 13px; }
                    .meta-value { font-weight: bold; font-size: 15px; }
                    .highlight { background-color: #ffeb3b; padding: 2px 8px; border-radius: 4px; }
                    
                    .content-table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
                    .content-table th { background: #fff; border: 1px solid #333; padding: 12px 10px; text-align: left; font-size: 13px; text-transform: uppercase; }
                    .content-table td { border: 1px solid #333; padding: 15px 10px; font-size: 14px; vertical-align: middle; }
                    
                    .footer-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 50px; }
                    .sign-box { text-align: center; }
                    .sign-role { font-size: 13px; margin-bottom: 60px; }
                    .sign-name { font-weight: bold; border-top: 1px solid #000; display: inline-block; min-width: 150px; padding-top: 5px; }
                    
                    .memo-label { font-weight: bold; font-size: 13px; margin-bottom: 8px; display: block; }
                    .memo-box { border: 1px solid #ccc; padding: 15px; min-height: 60px; font-size: 13px; line-height: 1.6; }

                    @media print {
                        body { padding: 10px 20px; }
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div style="display: flex; align-items: center;">
                        ${logoHtml}
                        <div class="company-info">
                            <div class="company-name">${companyName}</div>
                            <div class="company-addr">Divisi Produksi & Logistik Emas</div>
                        </div>
                    </div>
                    <div class="doc-info">
                        <div class="doc-title">SURAT JALAN MUTASI INTERNAL</div>
                        <div class="doc-no">NO : ${trx.id}</div>
                    </div>
                </div>

                <div class="meta-grid">
                    <div class="meta-col">
                        <div class="meta-item">
                            <span class="meta-label">Tanggal Mutasi</span>
                            <span class="meta-value">${printDate}</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">Asal Gudang</span>
                            <span class="meta-value">Finished Goods (FG)</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">Tujuan Gudang</span>
                            <span class="meta-value">Quality Control (QC)</span>
                        </div>
                    </div>
                    <div class="meta-col">
                         <div class="meta-item">
                            <span class="meta-label">Customer Terkait</span>
                            <span class="meta-value">${(trx.customer?.name || '').toUpperCase()}</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">Kategori Barang</span>
                            <span class="meta-value"><span class="highlight">${trx.itemOut.category === 'finished_goods_cert' ? 'Gold - Cast Bar' : 'Gold - Grain'}</span></span>
                        </div>
                    </div>
                </div>

                <table class="content-table">
                    <thead>
                        <tr>
                            <th style="width: 60px; text-align: center;">NO</th>
                            <th>DESKRIPSI BARANG MUTASI (STOCK OUT)</th>
                            <th style="text-align: right; width: 160px;">BERAT (GRAM)</th>
                            <th style="text-align: center; width: 100px;">UNIT</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(trx.itemOut.serials && trx.itemOut.serials.length > 0)
                ? trx.itemOut.serials.map((s, idx) => `
                            <tr>
                                <td style="text-align: center; font-weight: bold;">${idx + 1}</td>
                                <td>
                                    <div style="font-weight: bold; font-size: 15px; margin-bottom: 2px;">${trx.itemOut.name}</div>
                                    <div style="color: #666; font-size: 12px;">Serial/Cert: <span style="color:#000; font-weight:bold;">${s.serial || '-'}</span></div>
                                </td>
                                <td style="text-align: right; font-weight: bold; font-size: 16px;">
                                    ${s.weight.toLocaleString('id-ID', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                                </td>
                                <td style="text-align: center; font-weight: bold;">GR</td>
                            </tr>
                        `).join('')
                : `
                            <tr>
                                <td style="text-align: center; font-weight: bold;">1</td>
                                <td>
                                    <div style="font-weight: bold; font-size: 15px; margin-bottom: 2px;">${trx.itemOut.name}</div>
                                    <div style="color: #666; font-size: 12px;">Ref: Transaksi Penyerahan Barang</div>
                                </td>
                                <td style="text-align: right; font-weight: bold; font-size: 16px;">
                                    ${trx.itemOut.weight.toLocaleString('id-ID', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                                </td>
                                <td style="text-align: center; font-weight: bold;">GR</td>
                            </tr>
                        `}
                        <!-- Empty rows to maintain table structure if needed -->
                        <tr><td style="height: 35px; border-bottom: none; border-top: none;"></td><td style="border-bottom: none; border-top: none;"></td><td style="border-bottom: none; border-top: none;"></td><td style="border-bottom: none; border-top: none;"></td></tr>
                        <tr><td style="height: 35px;"></td><td></td><td></td><td></td></tr>
                    </tbody>
                </table>

                <div style="margin-top: 10px;">
                    <span class="memo-label">Keterangan / Memo:</span>
                    <div class="memo-box">
                        Mutasi barang jadi untuk keperluan penyerahan ke customer. Barang diserahkan ke QC untuk verifikasi akhir sebelum diserahkan ke customer.
                    </div>
                </div>

                <div class="footer-grid">
                    <div class="sign-box">
                        <div class="sign-role" style="visibility: hidden;">Yang Menyerahkan,</div>
                    </div>
                    <div class="sign-box">
                        <div class="sign-role" style="visibility: hidden;">Pemberi Izin,</div>
                    </div>
                    <div class="sign-box">
                        <div class="sign-role" style="visibility: hidden;">Penerima Barang,</div>
                    </div>
                </div>

                <div style="text-align:center; font-size:10px; margin-top:50px; color:#999; display: none;">
                    Dokumen Internal - Dicetak pada ${now}
                </div>

                <script>
                    window.onload = function() { setTimeout(function(){ window.print(); }, 500); }
                </script>
            </body>
            </html>
        `;

        const win = window.open('', '_blank', 'width=900,height=800');
        win.document.write(html);
        win.document.close();
    },

    printCombinedReceipt(id) {
        const trx = this.transactions.find(t => t.id === id);
        if (!trx) return;

        const accepted = (trx.batchDetails || []).filter(b => b.status === 'ACCEPT' || b.status === 'Good' || !b.status);
        const rejected = (trx.batchDetails || []).filter(b => b.status === 'REJECT');

        const config = Storage.get(Storage.KEYS.CONFIG) || {};
        const companyName = config.companyName || "PT GOLDEN ALURA REFINERI";
        const printDate = new Date(trx.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        const now = new Date().toLocaleString('id-ID');
        const logoHtml = config.logo ? `<div style="margin-right: 15px;"><img src="${config.logo}" style="max-height: 60px;"></div>` : '';

        const html = `
            <html>
            <head>
                <title>Tanda Terima Hasil Pengujian - ${trx.id}</title>
                <style>
                    body { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1f2937; line-height: 1.5; max-width: 900px; margin: 0 auto; background: #fff; }
                    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; border-bottom: 2px solid #3b82f6; padding-bottom: 20px; }
                    .company-name { font-size: 24px; font-weight: 800; color: #1e3a8a; margin-bottom: 5px; letter-spacing: -0.025em; }
                    .company-addr { font-size: 12px; color: #6b7280; max-width: 300px; }
                    .doc-info { text-align: right; }
                    .doc-title { font-size: 18px; font-weight: 700; color: #374151; margin-bottom: 5px; text-transform: uppercase; }
                    .doc-no { font-size: 14px; font-weight: 600; font-family: 'JetBrains Mono', monospace; color: #3b82f6; }
                    
                    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; padding: 20px; background: #f9fafb; border-radius: 8px; }
                    .meta-item { display: flex; gap: 15px; margin-bottom: 8px; border-bottom: 1px dashed #e5e7eb; padding-bottom: 8px; }
                    .meta-label { width: 100px; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; }
                    .meta-value { font-weight: 700; font-size: 14px; color: #111827; }
                    
                    .section-title { font-size: 14px; font-weight: 800; color: #374151; margin: 30px 0 15px 0; display: flex; align-items: center; gap: 10px; border-left: 4px solid #3b82f6; padding-left: 10px; text-transform: uppercase; }
                    .section-title.rejected { border-left-color: #ef4444; color: #dc2626; }
                    
                    .report-table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 20px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
                    .report-table th { background: #f3f4f6; color: #4b5563; font-weight: 700; font-size: 11px; text-transform: uppercase; padding: 12px 15px; text-align: left; }
                    .report-table td { padding: 12px 15px; font-size: 13px; border-top: 1px solid #e5e7eb; }
                    
                    .badge { display: inline-block; padding: 3px 8px; border-radius: 9999px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
                    .badge-success { background: #dcfce7; color: #166534; }
                    .badge-danger { background: #fee2e2; color: #991b1b; }
                    
                    .summary-box { margin-left: auto; width: 300px; padding: 15px; background: #eff6ff; border-radius: 8px; border: 1px solid #bfdbfe; }
                    .summary-row { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 13px; }
                    .summary-row.total { margin-top: 10px; padding-top: 10px; border-top: 2px solid #3b82f6; font-size: 16px; font-weight: 800; color: #1e3a8a; }
                    
                    .footer { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; margin-top: 60px; }
                    .sign-box { text-align: center; }
                    .sign-role { font-size: 12px; font-weight: 600; margin-bottom: 80px; color: #6b7280; text-transform: uppercase; }
                    .sign-name { font-weight: 700; border-top: 2px solid #1f2937; display: inline-block; min-width: 220px; padding-top: 8px; color: #111827; }
                    
                    .watermark { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); font-size: 10px; color: #9ca3af; font-weight: 500; }
                    
                    @media print {
                        body { padding: 20px; }
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div style="display: flex; align-items: center;">
                        ${logoHtml}
                        <div class="company-info">
                            <div class="company-name">${companyName}</div>
                            <div class="company-addr">Kantor Pusat & Workshop Pemurnian Logam Mulia<br>Sektor Industri Logam Strategis</div>
                        </div>
                    </div>
                    <div class="doc-info">
                        <div class="doc-title">Tanda Terima Hasil Pengujian</div>
                        <div class="doc-no">REF: ${trx.id}</div>
                    </div>
                </div>

                <div class="meta-grid">
                    <div>
                        <div class="meta-item">
                            <span class="meta-label">Tanggal</span>
                            <span class="meta-value">${printDate}</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">Customer</span>
                            <span class="meta-value">${(trx.customer?.name || '').toUpperCase()}</span>
                        </div>
                    </div>
                    <div>
                        <div class="meta-item">
                            <span class="meta-label">Petugas</span>
                            <span class="meta-value">${trx.createdBy || 'ADMIN SYSTEM'}</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">Kejujuran</span>
                            <span class="meta-value">${trx.integrityCheck?.manualDecision === 'ACCEPT' ? '✅ TERVERIFIKASI' : '⚠️ DALAM PENGAWASAN'}</span>
                        </div>
                    </div>
                </div>

                <!-- Section: Accepted Items -->
                <div class="section-title">📦 Item Diterima (Proses Lanjut)</div>
                <table class="report-table">
                    <thead>
                        <tr>
                            <th style="width: 40px;">No</th>
                            <th style="width: 60px;">Bar ID</th>
                            <th>Deskripsi Item</th>
                            <th style="text-align: right;">Berat Bruto (g)</th>
                            <th style="text-align: right;">Kadar XRF (%)</th>
                            <th style="text-align: right;">Estimasi Murni (g)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${accepted.length > 0 ? accepted.map((b, idx) => `
                            <tr>
                                <td>${idx + 1}</td>
                                <td style="font-weight: 600; text-align: center;">${b.barId || '-'}</td>
                                <td style="font-weight: 600;">Emas Scrap / Perhiasan</td>
                                <td style="text-align: right; font-weight: 700;">${parseFloat(b.weight).toFixed(2)}</td>
                                <td style="text-align: right; color: #3b82f6;">${parseFloat(b.purity).toFixed(2)}%</td>
                                <td style="text-align: right; font-weight: 700;">${parseFloat(b.est24k).toFixed(3)}</td>
                            </tr>
                        `).join('') : '<tr><td colspan="6" style="text-align:center; color: #9ca3af; font-style: italic;">Tidak ada item diterima</td></tr>'}
                    </tbody>
                </table>

                <!-- Section: Rejected Items -->
                ${rejected.length > 0 ? `
                <div class="section-title rejected">❌ Item Ditolak (Kembali ke Customer)</div>
                <table class="report-table">
                    <thead>
                        <tr>
                            <th style="width: 40px;">No</th>
                            <th>Deskripsi Item</th>
                            <th style="text-align: right;">Berat Bruto (g)</th>
                            <th style="text-align: right;">Hasil Cek Kadar</th>
                            <th style="text-align: right;">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rejected.map((b, idx) => `
                            <tr>
                                <td>${idx + 1}</td>
                                <td style="font-weight: 600;">Emas Scrap / Logam</td>
                                <td style="text-align: right;">${parseFloat(b.weight).toFixed(2)}</td>
                                <td style="text-align: right;">${parseFloat(b.purity).toFixed(2)}%</td>
                                <td style="text-align: right;"><span class="badge badge-danger">TOLAK / FRAUD</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ` : ''}

                <!-- Summary -->
                <div class="summary-box">
                    <div class="summary-row">
                        <span>Total Items Diterima:</span>
                        <span>${accepted.length} Bar/Batch</span>
                    </div>
                    <div class="summary-row">
                        <span>Total Berat Bruto:</span>
                        <span>${this.formatNumber(trx.itemIn.weight, 2)} g</span>
                    </div>
                    <div class="summary-row">
                        <span>Rata-rata Kadar:</span>
                        <span>${this.formatNumber(trx.itemIn.purity, 2)} %</span>
                    </div>
                    <div class="summary-row total">
                        <span>Estimasi Netto:</span>
                        <span>${this.formatNumber(trx.itemIn.weight * trx.itemIn.purity / 100, 3)} g</span>
                    </div>
                    ${trx.goldVariance && Math.abs(trx.goldVariance) > 0.001 ? `
                    <div class="summary-row" style="margin-top: 5px; padding-top: 5px; border-top: 1px dashed #3b82f6; color: ${trx.goldVariance > 0 ? '#166534' : '#991b1b'}; font-weight: bold;">
                        <span>${trx.goldVariance > 0 ? 'Hutang Emas ke Customer:' : 'Tagihan Emas ke Customer:'}</span>
                        <span>${this.formatNumber(Math.abs(trx.goldVariance), 3)} g</span>
                    </div>
                    ` : ''}
                </div>

                <div style="margin-top: 30px; font-size: 11px; color: #6b7280; background: #fefce8; padding: 15px; border-radius: 8px; border: 1px solid #fef08a;">
                    <strong>Catatan Transaksi:</strong><br>
                    ${trx.notes || '-'}
                    <p style="margin-top: 10px;">* Estimasi netto adalah hasil awal pengujian XRF. Hasil akhir peleburan mungkin berbeda sesuai dengan karakteristik material.</p>
                </div>

                <div class="footer">
                    <div class="sign-box">
                        <div class="sign-role">Diterima/Admin</div>
                        <div class="sign-name">${trx.createdBy || '...................'}</div>
                    </div>
                    <div class="sign-box">
                        <div class="sign-role">Pemilik Barang/Customer</div>
                        <div class="sign-name">${trx.customer?.name || '...................'}</div>
                    </div>
                </div>

                <div class="watermark">
                    DOKUMEN RESMI PT GOLDEN ALURA REFINERI - DICETAK PADA ${now}
                </div>

                <script>
                    window.onload = function() { setTimeout(function(){ window.print(); }, 500); }
                </script>
            </body>
            </html>
        `;

        const win = window.open('', '_blank', 'width=900,height=800');
        win.document.write(html);
        win.document.close();
    },

    async deleteTransaction(id) {
        const auth = window.App?.getAuthModule() || window.Auth;
        const user = auth.getCurrentUser();
        if (!['ADMIN', 'OWNER', 'DIREKTUR'].includes(user?.role)) {
            alert('Akses Ditolak: Hanya Owner atau Direktur yang dapat menghapus transaksi.');
            return;
        }

        if (!confirm('Hapus transaksi ini?')) return;

        // Delete from cloud first (tombstone) to prevent restore on next login
        try {
            if (typeof FirebaseSync !== 'undefined' && FirebaseSync.isEnabled()) {
                await FirebaseSync.deleteFromCloud('direct_swaps', id);
            }
        } catch (e) { console.warn('Cloud delete failed for DirectSwap:', e); }

        this.transactions = this.transactions.filter(t => t.id !== id);
        await this.saveTransactions();
        this.renderList();
        this.render();
    },

    async finalizeTransaction(id) {
        const auth = window.App?.getAuthModule() || window.Auth;
        const user = auth.getCurrentUser();
        if (!['ADMIN', 'OWNER', 'DIREKTUR'].includes(user?.role)) {
            alert('Akses Ditolak: Hanya Owner atau Direktur yang dapat melakukan finalisasi (approval).');
            return;
        }

        const trx = this.transactions.find(t => t.id === id);
        if (!trx) return;

        if (!confirm('Finalisasi transaksi ini?\n\nHal ini akan memperbarui STOK dan JURNAL UMUM secara permanen.')) return;

        // 1. Trigger All Side Effects
        // Update Inventory Valuation
        if (trx.type !== 'MAKLOON') {
            if (typeof InventoryValuation !== 'undefined') {
                InventoryValuation.updateItemCost(trx.itemIn.code, {
                    type: 'IN',
                    quantity: trx.itemIn.weight,
                    unitCost: trx.itemIn.price,
                    reference: trx.id
                });
            }
        }

        // Update Stock
        if (typeof WarehouseStock !== 'undefined') {
            const costForStock = trx.type === 'MAKLOON' ? 0 : trx.itemOut.cost;
            const priceForStock = trx.type === 'MAKLOON' ? 0 : trx.itemIn.price;

            WarehouseStock.updateStock(trx.warehouseCode, trx.itemIn.code, trx.itemIn.weight, priceForStock, trx.id, 'IN', 'COMPANY');
            WarehouseStock.updateStock(trx.warehouseCode, trx.itemOut.code, trx.itemOut.weight, costForStock, trx.id, 'OUT', 'COMPANY');

            // Handle Recovered Metals
            if (trx.agRecovered > 0) {
                const agItem = Storage.getItem('AG-RECOVERED');
                const agPrice = agItem ? (agItem.standardCost || 0) : 0;
                WarehouseStock.updateStock(trx.warehouseCode, 'AG-RECOVERED', trx.agRecovered, agPrice, trx.id, 'IN', 'COMPANY');
            }
            if (trx.auGain > 0) {
                const auGainItem = Storage.getItem('AU-GAIN');
                const auPrice = auGainItem ? (auGainItem.standardCost || 500000) : 0;
                WarehouseStock.updateStock(trx.warehouseCode, 'AU-GAIN', trx.auGain, auPrice, trx.id, 'IN', 'COMPANY');
            }
        }

        // Gold Balance
        if (typeof GoldSavings !== 'undefined' && trx.goldVariance && Math.abs(trx.goldVariance) > 0.005) {
            const type = trx.goldVariance > 0 ? 'DEPOSIT' : 'OBLIGATION';
            GoldSavings.addTransaction({
                customerId: trx.customer.id,
                type: type,
                weight: trx.goldVariance,
                description: `Partial Swap: ${trx.goldVariance > 0 ? 'Hutang ke Customer' : 'Tagihan ke Customer'} (Ref: ${trx.id})`,
                referenceId: trx.id
            });
        }

        // Journal Entry
        this.createJournalEntry(trx);

        // Serial Items
        if (trx.itemOut.serials && trx.itemOut.serials.length > 0 && typeof SerializedItem !== 'undefined') {
            trx.itemOut.serials.forEach(os => {
                SerializedItem.updateStatus(os.serial, 'Sold', {
                    soldTo: trx.customerId,
                    soldDate: new Date().toISOString(),
                    swapId: trx.id
                });
            });
        }

        // TTB
        if (typeof TTB !== 'undefined') {
            TTB.createTTBFromSwap(trx);
        }

        // 2. Update Status
        trx.status = 'COMPLETED';
        trx.finalizedAt = new Date().toISOString();
        trx.finalizedBy = Auth?.getCurrentUser()?.username || 'system';

        // 3. Save & Refresh
        await this.saveTransactions();
        alert('Transaksi berhasil difinalisasi! Stok dan Jurnal telah diperbarui.');
        this.render();
    },

    formatCurrency(amount) {
        if (amount === null || amount === undefined || isNaN(amount)) amount = 0;
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    },

    formatNumber(value, decimals = 2) {
        if (value === null || value === undefined || isNaN(value)) value = 0;
        return new Intl.NumberFormat('id-ID', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(value);
    },

    formatDate(dateString) {
        if (!dateString) return '-';
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return new Date(dateString).toLocaleDateString('id-ID', options);
    },

    /**
     * Create a new Swap Transaction
     * @param {Object} data - Form data
     */
    async createTransaction(data) {
        // 1. Validate Data
        if (!data.customerId || !data.itemIn || !data.itemOut) {
            return { success: false, error: 'Data tidak lengkap (Customer, Item Masuk, atau Item Keluar kosong)' };
        }

        let valueIn = 0;
        let revenue = 0;
        let costOut = 0;
        let totalCostOut = 0;

        // Determine Logic based on Type
        if (data.type === 'MAKLOON') {
            // --- MAKLOON LOGIC ---
            // Input Price = 0 (No Inventory Value)
            // Revenue = Fee
            // Cost Out = 0 (No Financial Cost recorded in Journal, Off Balance)

            valueIn = 0; // Off Balance
            revenue = parseFloat(data.fee) || 0;

            // We set cost to 0 for the transaction record to ensure Journal doesn't pick it up
            costOut = 0;
            totalCostOut = 0;

        } else {
            // --- TRADING LOGIC (Default) ---
            // BUG FIX: Use data.itemIn.weight and data.itemIn.price (from submitForm)
            valueIn = parseFloat(data.itemIn.weight) * parseFloat(data.itemIn.price);

            const itemOutMaster = MasterItem.getItem(data.itemOut.id || data.itemOut.code);
            costOut = itemOutMaster ? (itemOutMaster.standardCost || 0) : 0;
            totalCostOut = parseFloat(data.itemOut.weight) * costOut;

            revenue = valueIn - totalCostOut; // Balancing figure
        }


        const transaction = {
            id: 'PENDING',
            status: data.status || 'COMPLETED',
            type: data.type || 'TRADING', // Persist Type
            date: data.date,
            customer: data.customer,

            // Section A: Receive (In)
            itemIn: {
                code: data.itemIn.code,
                name: data.itemIn.name,
                weight: parseFloat(data.itemIn.weight),
                purity: parseFloat(data.itemIn.purity) || 0, // BUG FIX: Use data.itemIn.purity
                price: parseFloat(data.itemIn.price), // 0 if Makloon
                total: valueIn
            },

            // Section B: Give (Out)
            itemOut: {
                code: data.itemOut.code,
                name: data.itemOut.name,
                category: data.itemOut.category,
                weight: parseFloat(data.itemOut.weight),
                cost: costOut,
                totalCost: totalCostOut
            },


            // Section C: Financials
            fee: data.fee || 0,
            serviceRevenue: revenue,
            warehouseCode: data.warehouseCode || 'MAIN', // BUG FIX: Persist warehouseCode
            batchDetails: data.batchDetails || [], // BUG FIX: Persist batchDetails for printing
            notes: data.notes || '',

            createdAt: new Date().toISOString(),
            createdBy: (Auth.getCurrentUser() ? Auth.getCurrentUser().username : 'unknown')
        };

        transaction.auGain = data.auGain || 0;
        transaction.agRecovered = data.agRecovered || 0;

        // 3. Assign sequential ID (Atomic Cloud Sequencer)
        const nextId = await Storage.getNextReferenceNumber('S') || `S-${Date.now()}`;
        transaction.id = nextId;

        // --- GOLD BALANCE SETTLEMENT (New) ---
        // Calculate Total Pure In (from Batches)
        let totalPureIn = 0;
        if (transaction.batchDetails && transaction.batchDetails.length > 0) {
            totalPureIn = transaction.batchDetails.reduce((sum, b) => sum + (parseFloat(b.est24k) || 0), 0);
        } else {
            totalPureIn = transaction.itemIn.weight * (transaction.itemIn.purity / 100);
        }

        const totalPureOut = transaction.itemOut.weight;
        const variance = totalPureIn - totalPureOut;

        if (transaction.status === 'COMPLETED' && Math.abs(variance) > 0.005) {
            if (typeof GoldSavings !== 'undefined') {
                const type = variance > 0 ? 'DEPOSIT' : 'OBLIGATION';
                GoldSavings.addTransaction({
                    customerId: transaction.customer.id,
                    type: type,
                    weight: variance,
                    description: `Partial Swap: ${variance > 0 ? 'Hutang ke Customer' : 'Tagihan ke Customer'} (Ref: ${transaction.id})`,
                    referenceId: transaction.id
                });
                transaction.goldVariance = variance;
            }
        }

        // --- RECOVERED METALS STOCK UPDATES (New) ---
        // Add Ag Recovery to Stock
        if (transaction.status === 'COMPLETED' && transaction.agRecovered > 0) {
            const agItem = Storage.getItem('AG-RECOVERED');
            const agPrice = agItem ? (agItem.standardCost || 0) : 0;

            WarehouseStock.updateStock(
                transaction.warehouseCode,
                'AG-RECOVERED',
                transaction.agRecovered,
                agPrice,
                transaction.id,
                'IN',
                'COMPANY'
            );

            InventoryValuation.updateItemCost('AG-RECOVERED', {
                type: 'IN',
                quantity: transaction.agRecovered,
                unitCost: agPrice,
                reference: transaction.id
            });
            console.log(`🥈 Silver Recovery: ${transaction.agRecovered.toFixed(3)}g added to stock`);
        }

        // Add Au Gain to Stock
        if (transaction.status === 'COMPLETED' && transaction.auGain > 0) {
            const auGainItem = Storage.getItem('AU-GAIN');
            const auPrice = auGainItem ? (auGainItem.standardCost || 500000) : 0;

            WarehouseStock.updateStock(
                transaction.warehouseCode,
                'AU-GAIN',
                transaction.auGain,
                auPrice,
                transaction.id,
                'IN',
                'COMPANY'
            );

            InventoryValuation.updateItemCost('AU-GAIN', {
                type: 'IN',
                quantity: transaction.auGain,
                unitCost: auPrice,
                reference: transaction.id
            });
            console.log(`📈 Gold Gain: ${transaction.auGain.toFixed(3)}g added to stock`);
        }

        // --- GATE SIDE EFFECTS BY STATUS ---
        if (transaction.status === 'COMPLETED') {
            // 4. Update Inventory (Average Cost & Global Value) for Main Items
            if (transaction.type !== 'MAKLOON') {
                InventoryValuation.updateItemCost(transaction.itemIn.code, {
                    type: 'IN',
                    quantity: transaction.itemIn.weight,
                    unitCost: transaction.itemIn.price,
                    reference: transaction.id
                });
            }
        }
        // 4b. Update Physical Warehouse Stock (For Stock Position Report)
        // For Makloon: We still update Physical Qty, but maybe assign to CUSTOMER owner?
        // User said "Refinery Masuk Journal" (Fee), but "Stock Off Balance".
        // To keep physical tracking correct ("Where is the gold?"), we must move it.
        // We will use 'CUSTOMER' ownerId for Makloon to separate it from Company Assets.

        if (transaction.status === 'COMPLETED' && typeof WarehouseStock !== 'undefined') {
            const warehouseCode = data.warehouseCode || 'MAIN';

            // FIX: Always use 'COMPANY' (PT Golden Alura Refineri) for Direct Swap stock movements.
            // Even in Makloon, we are physically swapping: We take their Scrap (In) -> It becomes ours.
            // We give our Finished Goods (Out) -> It leaves our stock.
            const ownerId = 'COMPANY';

            const costForStock = transaction.type === 'MAKLOON' ? 0 : transaction.itemOut.cost;
            const priceForStock = transaction.type === 'MAKLOON' ? 0 : transaction.itemIn.price;

            // IN: Scrap (Menambah Stock Company)
            await WarehouseStock.updateStock(
                warehouseCode,
                transaction.itemIn.code,
                transaction.itemIn.weight,
                priceForStock,
                transaction.id,
                'IN',
                ownerId
            );

            // OUT: Gold (Mengurangi Stock Company)
            await WarehouseStock.updateStock(
                warehouseCode,
                transaction.itemOut.code,
                transaction.itemOut.weight,
                costForStock,
                transaction.id,
                'OUT',
                ownerId
            );
        }

        // 5. Create Journal Entry (Auto Balance)
        if (transaction.status === 'COMPLETED') {
            await this.createJournalEntry(transaction);
        }

        // 6. Save
        this.transactions.unshift(transaction);
        await this.saveTransactions();

        // 7. Generate TTB (Goods Receipt)
        if (transaction.status === 'COMPLETED' && typeof TTB !== 'undefined') {
            TTB.createTTBFromSwap(transaction);
        }

        return { success: true, transaction, id: transaction.id };
    },

    async createJournalEntry(trx) {
        // Dynamic Account Mapping (with hardcoded fallbacks for safety)
        const ACC_INV_SCRAP = Storage.getAccountByPurpose('gold_in_lab') || '1152';
        const ACC_INV_FG_POLOS = Storage.getAccountByPurpose('gold_bar_inventory') || '1181';
        const ACC_INV_FG_CERT = Storage.getAccountByPurpose('gold_bar_inventory_cert') || '1183';
        const ACC_REVENUE = Storage.getAccountByPurpose('refining_service_revenue') || '4121';
        const ACC_AR = Storage.getAccountByPurpose('accounts_receivable') || '1131';

        if (trx.type === 'MAKLOON') {
            // --- MAKLOON JOURNAL ---
            // Jasa Refinery: dipotong PPh23 dan memungut PPN
            // PPh23 = 2% dari Fee (dipotong customer, menjadi hak kita di SPT)
            // PPN = 11% dari Fee (dikumpulkan dari customer, hutang ke negara)

            // Get full customer object to check if Perorangan/Pribadi
            const customer = Storage.getCustomer(trx.customer?.id);
            const isIndividual = customer && customer.customerType === 'Perorangan/Pribadi';

            const pph23Rate = 0.02;  // 2% PPh23
            const ppnRate = 0.11;    // 11% PPN

            const pph23Amount = isIndividual ? 0 : Math.round(trx.fee * pph23Rate);
            const ppnAmount = Math.round(trx.fee * ppnRate);

            // Total AR = Fee + PPN - PPh23 (net yang diterima dari customer)
            // Or conceptually: Fee is net, PPN added, PPh23 withheld
            const totalAR = trx.fee + ppnAmount - pph23Amount;

            const journalLines = [
                // Dr. Piutang Usaha (Net: Fee + PPN - PPh23)
                {
                    accountCode: ACC_AR,
                    debit: totalAR,
                    credit: 0
                }
            ];

            // Only add PPh23 if NOT Individual
            if (!isIndividual && pph23Amount > 0) {
                journalLines.push({
                    accountCode: '11904',  // PPh23 Dibayar Dimuka
                    debit: pph23Amount,
                    credit: 0
                });
            }

            // Cr. Pendapatan Jasa Refining (Fee sebelum pajak)
            journalLines.push({
                accountCode: ACC_REVENUE,
                debit: 0,
                credit: trx.fee
            });

            // Cr. PPN Keluaran (Hutang ke Negara)
            journalLines.push({
                accountCode: '21141',  // PPN Keluaran
                debit: 0,
                credit: ppnAmount
            });

            const journal = {
                date: trx.date,
                reference: trx.id,
                description: `Jasa Makloon: ${trx.customer?.name} (In: ${trx.itemIn.weight}g, Out: ${trx.itemOut.weight}g)`,
                lines: journalLines
            };

            // Add Recovery Lines to Journal (Optional: based on value)
            const agPrice = (Storage.getItem('AG-RECOVERED')?.standardCost || 0);
            const auPrice = (Storage.getItem('AU-GAIN')?.standardCost || 0);

            if (trx.agRecovered > 0 && agPrice > 0) {
                journal.lines.push({ accountCode: '1185', debit: trx.agRecovered * agPrice, credit: 0 });
                journal.lines.push({ accountCode: '4114', debit: 0, credit: trx.agRecovered * agPrice });
            }
            if (trx.auGain > 0 && auPrice > 0) {
                journal.lines.push({ accountCode: '1185', debit: trx.auGain * auPrice, credit: 0 });
                journal.lines.push({ accountCode: '4114', debit: 0, credit: trx.auGain * auPrice });
            }
            if (typeof JournalEntry !== 'undefined' && JournalEntry.createEntry) {
                await JournalEntry.createEntry(journal);
            }
            return;
        }

        // --- TRADING JOURNAL (Existing Logic) ---
        // Determine FG Account based on Item Category
        let creditInventoryAcc = ACC_INV_FG_POLOS; // Default
        const category = trx.itemOut?.category || '';

        if (category === 'finished_goods_cert') {
            creditInventoryAcc = ACC_INV_FG_CERT;
        } else if (category === 'finished_goods_noncert') {
            creditInventoryAcc = ACC_INV_FG_POLOS;
        } else {
            // Fallback logic
            const itemOutCode = trx.itemOut?.code || '';
            if (itemOutCode.includes('GRAIN')) creditInventoryAcc = '1182';
        }

        const customerName = trx.customer?.name || 'Unknown Customer';

        const journal = {
            date: trx.date,
            reference: trx.id,
            description: `Direct Swap(Trading): ${customerName} (In: ${trx.itemIn.weight}g, Out: ${trx.itemOut.weight}g)`,
            lines: [
                // 1. Debit: Inventory In (Scrap)
                {
                    accountCode: ACC_INV_SCRAP,
                    debit: trx.itemIn.total,
                    credit: 0
                },
                // 2. Credit: Inventory Out (Cost of Goods Given)
                {
                    accountCode: creditInventoryAcc,
                    debit: 0,
                    credit: trx.itemOut.totalCost // At Cost
                },
                // 3. Credit: Revenue (The Balancing Figure)
                {
                    accountCode: ACC_REVENUE,
                    debit: 0,
                    credit: trx.serviceRevenue
                }
            ]
        };

        // Add Recovery Lines to Trading Journal
        const agPriceT = (Storage.getItem('AG-RECOVERED')?.standardCost || 0);
        const auPriceT = (Storage.getItem('AU-GAIN')?.standardCost || 0);

        if (trx.agRecovered > 0 && agPriceT > 0) {
            journal.lines.push({ accountCode: '1185', debit: trx.agRecovered * agPriceT, credit: 0 });
            journal.lines.push({ accountCode: '4114', debit: 0, credit: trx.agRecovered * agPriceT });
        }
        if (trx.auGain > 0 && auPriceT > 0) {
            journal.lines.push({ accountCode: '1185', debit: trx.auGain * auPriceT, credit: 0 });
            journal.lines.push({ accountCode: '4114', debit: 0, credit: trx.auGain * auPriceT });
        }

        // If revenue < 0 (Loss), flip to Debit
        if (trx.serviceRevenue < 0) {
            // Remove the negative credit
            journal.lines.pop();
            // Add debit for Loss
            journal.lines.push({
                accountCode: '5143', // Loss on Revaluation / Misc Loss
                debit: Math.abs(trx.serviceRevenue),
                credit: 0
            });
        }

        if (typeof JournalEntry !== 'undefined' && JournalEntry.createEntry) {
            await JournalEntry.createEntry(journal, true); // true = auto-approve/system generated
        } else {
            console.error('JournalEntry module not loaded. Cannot create journal for Swap.');
        }
    },

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.add('hidden');
    },

    renderEvidenceGallery() {
        const container = document.getElementById('evidence-gallery-container');
        if (!container) return;

        const angles = {
            'top': 'Depan/Atas',
            'bottom': 'Belakang',
            'core': 'Inti/Core',
            'other': 'Lainnya'
        };

        let html = '';
        Object.keys(this.evidenceGallery).forEach(angle => {
            html += `
                <div class="relative group border rounded p-1 bg-white">
                    <img src="${this.evidenceGallery[angle]}" class="w-100 rounded" style="aspect-ratio: 1; object-fit: cover;">
                    <div class="absolute top-0 left-0 bg-black-alpha text-white font-xs px-1 rounded-br">
                        ${angles[angle] || angle}
                    </div>
                    <button type="button" class="absolute top-0 right-0 bg-red text-white border-none rounded-bl cursor-pointer" 
                            onclick="DirectSwap.removeGalleryPhoto('${angle}')">×</button>
                </div>
            `;
        });

        // Add placeholders for missing mandatory angles
        ['top', 'bottom', 'core'].forEach(angle => {
            if (!this.evidenceGallery[angle]) {
                html += `
                    <div class="border border-dashed rounded flex flex-column align-center justify-center text-gray" style="aspect-ratio: 1; font-size: 10px; background: #f8fafc;">
                        <span style="font-size: 16px; opacity: 0.5;">📸</span>
                        <span>${angles[angle]}</span>
                    </div>
                `;
            }
        });

        container.innerHTML = html;

        // Enable AI button if we have at least 'top' or 'core'
        const analyzeBtn = document.getElementById('btn-ai-analyze');
        if (analyzeBtn) {
            analyzeBtn.disabled = !this.evidenceGallery['top'] && !this.evidenceGallery['core'];
        }
    },

    handleGalleryCapture(input) {
        if (input.files && input.files[0]) {
            const angle = document.getElementById('gallery-angle-select').value;
            const reader = new FileReader();
            reader.onload = (e) => {
                this.evidenceGallery[angle] = e.target.result;
                this.renderEvidenceGallery();
                input.value = ''; // Reset input
            };
            reader.readAsDataURL(input.files[0]);
        }
    },

    removeGalleryPhoto(angle) {
        delete this.evidenceGallery[angle];
        this.renderEvidenceGallery();
    },

    async analyzeMicroscopeAI() {
        const resultEl = document.getElementById('ai-analysis-result');
        const analyzeBtn = document.getElementById('btn-ai-analyze');
        const container = document.getElementById('microscope-preview-container');

        if (!this.evidenceGallery['top'] && !this.evidenceGallery['core']) {
            alert('Ambil foto "Top" atau "Core" terlebih dahulu untuk dianalisis.');
            return;
        }

        analyzeBtn.innerText = '⌛ Menganalisis...';
        analyzeBtn.disabled = true;
        container.classList.remove('hidden');
        resultEl.innerHTML = '<span class="text-gray flex align-center gap-2"><div class="spinner-sm"></div> AI sedang memproses...</span>';

        try {
            // Reverted to single image for Spark plan compatibility
            const imageBase64 = this.evidenceGallery['core'] || this.evidenceGallery['top'];

            // Call Firebase Callable Function
            const ff = window.firebaseFunctions;
            if (!ff || !ff.functions || !ff.httpsCallable) {
                throw new Error('Firebase Functions SDK tidak aktif.');
            }

            const analyzeFunc = ff.httpsCallable(ff.functions, 'analyzeMicroscope');
            const response = await analyzeFunc({
                imageBase64
            });

            if (response.data && response.data.success) {
                const analysis = response.data.analysis;
                let colorClass = 'text-gray';
                let icon = 'ℹ️';

                if (analysis.status === 'ACCEPT') {
                    colorClass = 'text-success';
                    icon = '✅';
                    document.getElementById('swap-integrity-decision').value = 'ACCEPT';
                }
                else if (analysis.status === 'REJECT') {
                    colorClass = 'text-danger';
                    icon = '❌';
                    document.getElementById('swap-integrity-decision').value = 'REJECT';
                }
                else if (analysis.status === 'RECHECK') {
                    colorClass = 'text-warning';
                    icon = '⚠️';
                    document.getElementById('swap-integrity-decision').value = 'RECHECK';
                }

                resultEl.innerHTML = `
                    <div class="${colorClass}">
                        <div class="flex align-center gap-2 mb-1">
                            <span style="font-size: 1.2rem;">${icon}</span>
                            <strong class="text-lg">Hasil AI: ${analysis.status}</strong>
                        </div>
                        <p class="mb-2" style="font-size: 14px; color: #1e293b;">${analysis.reasoning}</p>
                        <div class="p-2 rounded bg-light font-normal italic" style="font-size: 12px; color: #64748b;">
                            ${analysis.details}
                        </div>
                    </div>
                `;

                if (analysis.status === 'REJECT') {
                    this.showXRFNotification(`🚨 AI ALERT: ${analysis.reasoning}`, 'danger');
                }
            } else {
                throw new Error(response.data?.error || 'Analisis gagal');
            }
        } catch (error) {
            console.error('AI Analysis Error:', error);
            resultEl.innerHTML = `<span class="text-danger">❌ Error: ${error.message}</span>`;
            alert('Gagal melakukan analisis AI. Pastikan Cloud Functions sudah di-deploy.');
        } finally {
            analyzeBtn.innerText = '🤖 Analisis AI';
            analyzeBtn.disabled = false;
        }
    },

    showXRFNotification(message, type = 'info') {
        const notif = document.getElementById('xrf-notification');
        if (notif) {
            notif.innerHTML = message;
            notif.className = `alert alert-${type} mt-2`;
            notif.style.display = 'block';
            setTimeout(() => notif.style.display = 'none', 5000);
        }
    }
};

DirectSwap.init();


// Explicitly make DirectSwap globally available
window.DirectSwap = DirectSwap;
