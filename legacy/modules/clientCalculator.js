// ==========================================
// HR - Client Assayer Calculator Module
// Interactive Tool for Clients to Estimate Gold Output (99.99%)
// ==========================================

const ClientCalculator = {
    items: [],
    
    init() {
        console.log('📱 Client Assayer Calculator initialized');
        this.items = [
            { id: 1, barId: 'Bar 1', weight: '', purity: '', grade: '-', returnPct: 0, fee: 0, netWeight: 0 }
        ];
        this.render();
    },

    render() {
        const mainContent = document.getElementById('main-content');
        if (!mainContent) return;

        mainContent.innerHTML = `
            <div class="client-calc-container" style="max-width: 900px; margin: 0 auto; padding: 10px;">
                <!-- Page Header -->
                <div class="page-header" style="text-align: center; margin-bottom: 1.5rem;">
                    <h1 class="page-title" style="font-size: 1.8rem; color: var(--color-primary); font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 10px;">
                        🥇 Kalkulator Estimasi Kadar Emas 99,99%
                    </h1>
                    <p class="page-subtitle" style="font-size: 0.95rem; color: var(--text-secondary);">
                        Tunjukkan estimasi hasil murni secara transparan di hadapan pelanggan
                    </p>
                </div>

                <!-- Main Calculator Card -->
                <div class="card" style="border-radius: 16px; border: 2px solid var(--color-primary); box-shadow: 0 10px 25px rgba(0,0,0,0.15); background: var(--bg-primary);">
                    <div class="card-body" style="padding: 1.5rem;">
                        <!-- Input Rows Container -->
                        <div id="calc-rows-container">
                            ${this.renderRows()}
                        </div>

                        <!-- Add Row Button & Preset Actions -->
                        <div style="display: flex; gap: 10px; margin-top: 1rem; flex-wrap: wrap;">
                            <button class="btn btn-secondary" onclick="ClientCalculator.addRow()" style="display: flex; align-items: center; gap: 6px; padding: 10px 16px; font-weight: 600; border-radius: 8px;">
                                ➕ Tambah Item Emas
                            </button>
                            <button class="btn btn-danger-outline" onclick="ClientCalculator.resetAll()" style="padding: 10px 16px; font-weight: 600; border-radius: 8px; margin-left: auto;">
                                🔄 Reset
                            </button>
                        </div>

                        <!-- Result Section -->
                        <div class="result-summary-box" style="margin-top: 2rem; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #f8fafc; border-radius: 12px; padding: 1.5rem; box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);">
                            <h3 style="color: #fbbf24; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px; font-size: 1.1rem; margin-bottom: 12px; font-weight: 700;">
                                📋 Ringkasan Hasil Taksiran
                            </h3>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                                <div>
                                    <span style="font-size: 0.85rem; color: #94a3b8; display: block;">Total Berat Kotor (Input)</span>
                                    <strong id="total-gross-weight" style="font-size: 1.6rem; color: #ffffff; font-family: monospace;">0.00 g</strong>
                                </div>
                                <div>
                                    <span style="font-size: 0.85rem; color: #94a3b8; display: block;">Rata-rata Kadar Kotor</span>
                                    <strong id="avg-purity" style="font-size: 1.6rem; color: #60a5fa; font-family: monospace;">0.00%</strong>
                                </div>
                                <div>
                                    <span style="font-size: 0.85rem; color: #fbbf24; display: block;">Estimasi Emas Murni (99.99%)</span>
                                    <strong id="total-net-weight" style="font-size: 2rem; color: #fbbf24; font-family: monospace; display: block; text-shadow: 0 2px 4px rgba(251,191,36,0.3);">0.000 g</strong>
                                </div>
                            </div>
                            
                            <div id="additional-details" style="margin-top: 15px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 0.85rem; color: #cbd5e1; line-height: 1.5;">
                                * Estimasi ini dihitung secara real-time berdasarkan data XRF dan aturan pemurnian (refining return rules) yang berlaku.
                            </div>
                        </div>

                    </div>
                </div>
                
                <!-- Quick Educational Information -->
                <div class="card" style="margin-top: 1.5rem; border-radius: 12px; background: rgba(59, 130, 246, 0.05); border: 1px solid rgba(59, 130, 246, 0.2);">
                    <div class="card-body" style="padding: 1rem 1.25rem;">
                        <h4 style="color: var(--color-primary); margin-bottom: 0.5rem; display: flex; align-items: center; gap: 6px;">
                            💡 Mengapa Ada Selisih Berat Kotor vs Bersih?
                        </h4>
                        <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0; line-height: 1.5;">
                            Saat proses peleburan/pemurnian, logam pengotor seperti Tembaga (Cu) dan Perak (Ag) akan dipisahkan. 
                            Tembaga akan menguap/terbakar, sedangkan Perak dipisahkan secara kimia. Hal ini menyebabkan berat kotor berkurang, 
                            namun menghasilkan emas murni 24K (99.99%) yang bernilai tinggi sesuai kadar taksiran di atas.
                        </p>
                    </div>
                </div>
            </div>
        `;
        this.calculate();
    },

    renderRows() {
        return this.items.map((item, idx) => {
            return `
                <div class="calc-row" data-id="${item.id}" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 10px; padding: 12px; border: 1px solid var(--border-color); border-radius: 10px; background: var(--bg-secondary); margin-bottom: 10px; position: relative;">
                    <!-- Label Bar -->
                    <div class="form-group" style="margin-bottom: 0;">
                        <label class="form-label" style="font-size: 0.75rem; font-weight: 700;">Bar / Item</label>
                        <input type="text" class="form-input row-bar-id" value="${item.barId}" oninput="ClientCalculator.updateRowData(${idx}, 'barId', this.value)" style="font-weight: bold; background: var(--bg-primary); text-align: center;">
                    </div>

                    <!-- Input Berat -->
                    <div class="form-group" style="margin-bottom: 0; position: relative;">
                        <label class="form-label" style="font-size: 0.75rem; font-weight: 700; color: #10b981;">Berat Kotor (g)</label>
                        <input type="number" class="form-input row-weight" value="${item.weight}" step="0.01" placeholder="0.00" oninput="ClientCalculator.updateRowData(${idx}, 'weight', this.value)" style="border: 2px solid #10b981; font-weight: 800; font-size: 1.1rem; text-align: right; background: var(--bg-primary);">
                    </div>

                    <!-- Input Kadar XRF -->
                    <div class="form-group" style="margin-bottom: 0; position: relative;">
                        <label class="form-label" style="font-size: 0.75rem; font-weight: 700; color: #d97706;">Kadar XRF (%)</label>
                        <input type="number" class="form-input row-purity" value="${item.purity}" step="0.01" placeholder="0.00" oninput="ClientCalculator.updateRowData(${idx}, 'purity', this.value)" style="border: 2px solid #d97706; font-weight: 800; font-size: 1.1rem; text-align: right; background: var(--bg-primary);">
                    </div>

                    <!-- Grade Taksiran -->
                    <div class="form-group" style="margin-bottom: 0;">
                        <label class="form-label" style="font-size: 0.75rem; color: var(--text-secondary);">Grade / Karat</label>
                        <input type="text" class="form-input row-grade" value="${item.grade}" readonly style="text-align: center; font-weight: 700; background: rgba(0,0,0,0.05); border: 1px solid var(--border-color);">
                    </div>

                    <!-- Metal Return Rule -->
                    <div class="form-group" style="margin-bottom: 0;">
                        <label class="form-label" style="font-size: 0.75rem; color: var(--text-secondary);">Refining Return</label>
                        <input type="text" class="form-input row-return" value="${item.returnPct ? item.returnPct.toFixed(2) + '%' : '-'}" readonly style="text-align: center; font-weight: 700; background: rgba(0,0,0,0.05); border: 1px solid var(--border-color);">
                    </div>

                    <!-- Hasil Bersih (Au 99.99) -->
                    <div class="form-group" style="margin-bottom: 0;">
                        <label class="form-label" style="font-size: 0.75rem; color: #fbbf24; font-weight: 700;">Hasil Emas Murni</label>
                        <input type="text" class="form-input row-net" value="${item.netWeight ? item.netWeight.toFixed(3) + ' g' : '-'}" readonly style="text-align: right; font-weight: bold; background: rgba(251,191,36,0.1); border: 1px solid #fbbf24; color: #d97706; font-size: 1.05rem;">
                    </div>

                    <!-- Remove Button (Only if > 1 rows) -->
                    ${this.items.length > 1 ? `
                        <button onclick="ClientCalculator.removeRow(${idx})" style="position: absolute; right: -8px; top: -8px; width: 22px; height: 22px; border-radius: 50%; background: #ef4444; color: white; border: none; font-size: 12px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">×</button>
                    ` : ''}
                </div>
            `;
        }).join('');
    },

    addRow() {
        const nextId = this.items.length > 0 ? Math.max(...this.items.map(i => i.id)) + 1 : 1;
        this.items.push({
            id: nextId,
            barId: `Bar ${nextId}`,
            weight: '',
            purity: '',
            grade: '-',
            returnPct: 0,
            fee: 0,
            netWeight: 0
        });
        this.render();
    },

    removeRow(idx) {
        this.items.splice(idx, 1);
        this.render();
    },

    updateRowData(idx, field, value) {
        if (this.items[idx]) {
            this.items[idx][field] = value;
            this.calculateRow(idx);
        }
    },

    calculateRow(idx) {
        const item = this.items[idx];
        const weight = parseFloat(item.weight) || 0;
        const purity = parseFloat(item.purity) || 0;

        if (weight > 0 && purity > 0) {
            let gradeName = '-';
            let returnPct = 100; // Default recovery rate is 100% of fine gold
            let fee = 0;

            if (typeof MasterPurity !== 'undefined' && typeof MasterRefiningRules !== 'undefined') {
                const gradeInfo = MasterPurity.getPurityGrade('GOLD', purity);
                if (gradeInfo) {
                    gradeName = gradeInfo.grade;
                    const rule = MasterRefiningRules.getRule(gradeInfo.id, weight);
                    if (rule) {
                        returnPct = rule.au_return_pct;
                        fee = rule.refining_fee || 0;
                    }
                }
            }

            // Standard fallback for high purity
            const is24K = purity >= 99.99 || gradeName.includes('24K');
            if (is24K) {
                returnPct = 100;
            }

            const purityFactor = is24K ? 1.0 : (purity / 100);
            const netWeight = weight * purityFactor * (returnPct / 100);

            item.grade = gradeName;
            item.returnPct = returnPct;
            item.fee = fee;
            item.netWeight = netWeight;
        } else {
            item.grade = '-';
            item.returnPct = 0;
            item.fee = 0;
            item.netWeight = 0;
        }

        // Live update values in UI elements of this row without a full re-render (smooth visual experience)
        const rowEl = document.querySelector(`.calc-row[data-id="${item.id}"]`);
        if (rowEl) {
            const gradeInput = rowEl.querySelector('.row-grade');
            const returnInput = rowEl.querySelector('.row-return');
            const netInput = rowEl.querySelector('.row-net');

            if (gradeInput) gradeInput.value = item.grade;
            if (returnInput) returnInput.value = item.returnPct ? item.returnPct.toFixed(2) + '%' : '-';
            if (netInput) netInput.value = item.netWeight ? item.netWeight.toFixed(3) + ' g' : '-';
        }

        this.calculate();
    },

    calculate() {
        let totalGross = 0;
        let weightedPuritySum = 0;
        let totalNet = 0;

        this.items.forEach(item => {
            const w = parseFloat(item.weight) || 0;
            const p = parseFloat(item.purity) || 0;
            const net = parseFloat(item.netWeight) || 0;

            totalGross += w;
            weightedPuritySum += (w * p);
            totalNet += net;
        });

        const avgPurity = totalGross > 0 ? (weightedPuritySum / totalGross) : 0;

        // Update Summary Displays
        const grossEl = document.getElementById('total-gross-weight');
        const avgEl = document.getElementById('avg-purity');
        const netEl = document.getElementById('total-net-weight');

        if (grossEl) grossEl.innerText = `${totalGross.toFixed(2)} g`;
        if (avgEl) avgEl.innerText = `${avgPurity.toFixed(2)}%`;
        if (netEl) netEl.innerText = `${totalNet.toFixed(3)} g`;
    },

    resetAll() {
        this.items = [
            { id: 1, barId: 'Bar 1', weight: '', purity: '', grade: '-', returnPct: 0, fee: 0, netWeight: 0 }
        ];
        this.render();
    }
};

window.ClientCalculator = ClientCalculator;
