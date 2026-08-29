// ==========================================
// Yield Analysis Module (Management Only)
// Comparing Lab Sample vs Actual Production Yield
// ==========================================

const YieldAnalysis = {
    init() {
        console.log('📊 Yield Analysis module initialized');
    },

    /**
     * Calculate analysis for a batch
     */
    getAnalysis(batchId) {
        const batch = ProductionBatch.getBatch(batchId);
        const sample = typeof LabQualityTest !== 'undefined' ? LabQualityTest.getSampleByBatch(batchId) : null;

        if (!batch || batch.status !== 'completed') {
            return { status: 'incomplete', message: 'Batch belum selesai diproduksi' };
        }

        if (!sample) {
            return { status: 'no_sample', message: 'Data sampel lab belum diinput' };
        }

        // 1. Lab Standard (Expected)
        const sampleWeight = sample.sampleWeight || 0;
        const netInputWeight = batch.totalGrossWeight - sampleWeight;
        const labAuPercent = sample.auPercent / 100;
        const expectedPureAu = netInputWeight * labAuPercent;

        // 2. Actual Production Output
        const actualPureAu = batch.actualOutput.pureAu;
        const actualAuPercent = (actualPureAu / netInputWeight) * 100;

        // 3. Difference (Selisih)
        const diffGrams = actualPureAu - expectedPureAu;
        const diffPercent = actualAuPercent - sample.auPercent;
        const monetaryValue = diffGrams * 1000000; // Assume 1jt per gram for estimation

        return {
            status: 'ready',
            batchNumber: batch.batchNumber,
            totalWeight: batch.totalGrossWeight,

            // Lab Standard
            labAuPercent: sample.auPercent,
            expectedPureAu: expectedPureAu,
            labSampleDate: sample.createdAt,

            // Actual Output
            actualAuPercent: actualAuPercent,
            actualPureAu: actualPureAu,

            // Variance
            diffGrams: diffGrams,
            diffPercent: diffPercent,
            monetaryValue: monetaryValue,
            isProfit: diffGrams >= 0,

            // Correlation
            sampledBar: sample.jobOrderNumber || 'N/A',
            sampledCustomer: sample.customerName || 'N/A'
        };
    },

    // ==========================================
    // UI RENDERING
    // ==========================================

    render() {
        const mainContent = document.getElementById('main-content');
        const batches = ProductionBatch.getAllBatches().filter(b => b.status === 'completed');

        mainContent.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">📊 Yield Analysis Report</h1>
                <p class="page-subtitle">Perbandingan Kadar Sampel Lab vs Real Produksi (Untung/Rugi)</p>
            </div>

            <!-- Analysis Summary Table -->
            <div class="card">
                <div class="card-header">
                    <h3>Daftar Analisa Yield Batch Selesai</h3>
                </div>
                <div class="card-body" style="overflow-x: auto;">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Batch Number</th>
                                <th>Sampled Bar</th>
                                <th>Total Berat</th>
                                <th>Kadar Sampel (Lab)</th>
                                <th>Kadar Real (Prod)</th>
                                <th>Selisih (%)</th>
                                <th>Selisih (Gram)</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${batches.length === 0 ? '<tr><td colspan="8" style="text-align: center; padding: 2rem;">Belum ada batch yang selesai.</td></tr>' :
                batches.map(b => {
                    const analysis = this.getAnalysis(b.id);
                    if (analysis.status !== 'ready') {
                        return `
                                            <tr>
                                                <td><strong>${b.batchNumber}</strong></td>
                                                <td colspan="7" style="color: var(--text-secondary); text-align: center;">
                                                    ${analysis.message}
                                                </td>
                                            </tr>
                                        `;
                    }

                    const color = analysis.isProfit ? 'var(--color-success)' : 'var(--color-danger)';
                    const sign = analysis.isProfit ? '+' : '';

                    return `
                                        <tr>
                                            <td><strong>${analysis.batchNumber}</strong></td>
                                            <td>
                                                <small style="font-weight: 600; color: var(--color-primary);">${analysis.sampledBar}</small><br>
                                                <small>${analysis.sampledCustomer}</small>
                                            </td>
                                            <td>${analysis.totalWeight.toLocaleString('id-ID')} g</td>
                                            <td>${analysis.labAuPercent.toFixed(2)}%</td>
                                            <td>${analysis.actualAuPercent.toFixed(2)}%</td>
                                            <td style="color: ${color}; font-weight: bold;">
                                                ${sign}${analysis.diffPercent.toFixed(2)}%
                                            </td>
                                            <td style="color: ${color}; font-weight: bold;">
                                                ${sign}${analysis.diffGrams.toFixed(4)} g
                                            </td>
                                            <td>
                                                <span class="badge ${analysis.isProfit ? 'badge-success' : 'badge-danger'}" style="font-size: 0.7rem;">
                                                    ${analysis.isProfit ? 'GAIN' : 'LOSS'}
                                                </span>
                                            </td>
                                        </tr>
                                    `;
                }).join('')
            }
                        </tbody>
                    </table>
                </div>
            </div>

            <div style="margin-top: 2rem; background: var(--bg-tertiary); padding: 1.5rem; border-radius: 12px; border-left: 5px solid var(--color-primary);">
                <h4>💡 Cara Membaca Analisa</h4>
                <p style="font-size: 0.9rem; color: var(--text-secondary); margin-top: 0.5rem;">
                    Analisa ini membandingkan <strong>Kadar Lab</strong> (sampel yang diambil dari satu batang) 
                    dengan <strong>Hasil Real</strong> (emas murni yang dihasilkan setelah proses refinery).
                </p>
                <ul style="font-size: 0.9rem; margin-top: 0.5rem; list-style-type: disc; padding-left: 1.5rem;">
                    <li><strong>GAIN (+)</strong>: Berarti hasil nyata lebih tinggi dari perkiraan sampel (Keuntungan Produksi).</li>
                    <li><strong>LOSS (-)</strong>: Berarti hasil nyata lebih rendah dari perkiraan sampel (Kebocoran/Ketidakefisienan).</li>
                </ul>
            </div>
        `;
    }
};

window.YieldAnalysis = YieldAnalysis;
