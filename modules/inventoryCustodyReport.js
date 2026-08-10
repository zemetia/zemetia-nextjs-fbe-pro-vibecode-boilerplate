// ==========================================
// Inventory vs Custody Report Module
// Distinction between Company Assets and Customer Property
// ==========================================

const InventoryCustodyReport = {
    init() {
        console.log('✅ Inventory vs Custody Report module initialized');
        this.render();
    },

    /**
     * Aggregate data from multiple sources
     */
    async aggregateData() {
        // 1. Company Inventory (On-Balance Sheet)
        const items = Storage.getItems() || [];
        const companyStock = items.filter(item => item.isPreciousMetal && item.trackStock).map(item => {
            const inv = item.inventory || {
                grossWeight: { quantity: 0, averageCost: 0, totalValue: 0 },
                pureContent: { quantity: 0, averageCost: 0, totalValue: 0 }
            };
            return {
                code: item.code,
                name: item.name,
                grossWeight: inv.grossWeight.quantity,
                pureContent: inv.pureContent.quantity,
                totalValue: inv.pureContent.totalValue,
                uom: item.uom || 'gram'
            };
        });

        // 2. Customer Custody (Off-Balance Sheet)
        // Consists of active Job Orders that haven't been returned/billed
        const allJobOrders = (typeof JobOrder !== 'undefined' && JobOrder.getAllJobOrders)
            ? JobOrder.getAllJobOrders()
            : (Storage.get(Storage.KEYS.JOB_ORDERS || 'erp_job_orders') || []);

        const activeJobOrders = allJobOrders.filter(jo =>
            ['received', 'in_process', 'in_batch', 'completed', 'processed'].includes(jo.status)
        );

        const custodyStock = activeJobOrders.map(jo => {
            const inputWeight = jo.input?.grossWeight || 0;
            const allocatedWeight = jo.output?.grossWeight || jo.input?.grossWeight || 0;
            const pureWeight = jo.output?.pureContent || jo.input?.actualPureContent || jo.input?.estimatedPureContent || 0;

            return {
                id: jo.id,
                jobOrderNumber: jo.jobOrderNumber,
                customerName: jo.customerName,
                status: jo.status,
                grossWeight: allocatedWeight,
                pureContent: pureWeight,
                uom: 'gram'
            };
        });

        // Calculate Totals
        const totals = {
            companyGross: companyStock.reduce((sum, i) => sum + i.grossWeight, 0),
            companyPure: companyStock.reduce((sum, i) => sum + i.pureContent, 0),
            companyValue: companyStock.reduce((sum, i) => sum + i.totalValue, 0),
            custodyGross: custodyStock.reduce((sum, i) => sum + i.grossWeight, 0),
            custodyPure: custodyStock.reduce((sum, i) => sum + i.pureContent, 0)
        };

        return { companyStock, custodyStock, totals };
    },

    async render() {
        const mainContent = document.getElementById('main-content');
        if (!mainContent) return;

        const { companyStock, custodyStock, totals } = await this.aggregateData();

        mainContent.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">🏦 Inventory vs Custody Report</h1>
                <p class="page-subtitle">Pemisahan Aset Perusahaan (On-Balance) dengan Titipan Pelanggan (Off-Balance)</p>
            </div>

            <!-- Summary Cards -->
            <div class="stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; margin-bottom: 2.5rem;">
                <!-- Company Owned -->
                <div class="stat-card" style="background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); color: white; padding: 1.5rem; border-radius: 16px; box-shadow: 0 10px 20px rgba(0,0,0,0.1);">
                    <div style="font-size: 0.9rem; opacity: 0.8; text-transform: uppercase; letter-spacing: 1px;">Company Inventory (Asal Transaksi)</div>
                    <div style="font-size: 2.2rem; font-weight: 800; margin: 0.5rem 0;">${totals.companyPure.toLocaleString('id-ID', { minimumFractionDigits: 2 })} <span style="font-size: 1rem;">gram Pure Au</span></div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.9rem; border-top: 1px solid rgba(255,255,255,0.2); pt: 0.5rem; mt: 0.5rem;">
                        <span>Value: Rp ${totals.companyValue.toLocaleString('id-ID')}</span>
                        <span>On-Balance Sheet</span>
                    </div>
                </div>

                <!-- Customer Owned -->
                <div class="stat-card" style="background: linear-gradient(135deg, #d4a017 0%, #b8860b 100%); color: white; padding: 1.5rem; border-radius: 16px; box-shadow: 0 10px 20px rgba(0,0,0,0.1);">
                    <div style="font-size: 0.9rem; opacity: 0.8; text-transform: uppercase; letter-spacing: 1px;">Customer Custody (Asal Job Order)</div>
                    <div style="font-size: 2.2rem; font-weight: 800; margin: 0.5rem 0;">${totals.custodyPure.toLocaleString('id-ID', { minimumFractionDigits: 2 })} <span style="font-size: 1rem;">gram Pure Au</span></div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.9rem; border-top: 1px solid rgba(255,255,255,0.2); pt: 0.5rem; mt: 0.5rem;">
                        <span>Non-Aset</span>
                        <span>Off-Balance Sheet</span>
                    </div>
                </div>

                <!-- Combined -->
                <div class="stat-card" style="background: var(--bg-secondary); padding: 1.5rem; border-radius: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid var(--border-color);">
                    <div style="font-size: 0.9rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 1px;">Total Emas Fisik (Vault)</div>
                    <div style="font-size: 2.2rem; font-weight: 800; margin: 0.5rem 0; color: var(--text-primary);">${(totals.companyGross + totals.custodyGross).toLocaleString('id-ID', { minimumFractionDigits: 2 })} <span style="font-size: 1rem;">gram Gross</span></div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary);">Gabungan Stok Perusahaan & Titipan di Semua Tahapan</div>
                </div>
            </div>

            <!-- Details Section -->
            <div style="display: grid; grid-template-columns: 1fr; gap: 2rem;">
                
                <!-- Company Stock Table -->
                <div class="card" style="border-radius: 16px; overflow: hidden;">
                    <div class="card-header" style="background: var(--bg-secondary); border-bottom: 2px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                        <h3 style="margin: 0;">🏢 Company Inventory (Aset)</h3>
                        <span class="badge badge-primary">On-Balance Sheet</span>
                    </div>
                    <div class="card-body" style="padding: 0;">
                        <table class="data-table" style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="background: var(--bg-tertiary);">
                                    <th style="text-align: left; padding: 1rem;">Kode Item</th>
                                    <th style="text-align: left; padding: 1rem;">Nama Item</th>
                                    <th style="text-align: right; padding: 1rem;">Gross Weight</th>
                                    <th style="text-align: right; padding: 1rem;">Pure Content</th>
                                    <th style="text-align: right; padding: 1rem;">Total Value</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${companyStock.map(i => `
                                    <tr style="border-bottom: 1px solid var(--border-color);">
                                        <td style="padding: 1rem;"><span class="badge badge-info">${i.code}</span></td>
                                        <td style="padding: 1rem;"><strong>${i.name}</strong></td>
                                        <td style="padding: 1rem; text-align: right;">${i.grossWeight.toLocaleString('id-ID', { minimumFractionDigits: 2 })} ${i.uom}</td>
                                        <td style="padding: 1rem; text-align: right; font-weight: bold;">${i.pureContent.toLocaleString('id-ID', { minimumFractionDigits: 2 })} ${i.uom}</td>
                                        <td style="padding: 1rem; text-align: right; color: var(--color-success);">Rp ${i.totalValue.toLocaleString('id-ID')}</td>
                                    </tr>
                                `).join('')}
                                ${companyStock.length === 0 ? '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-secondary);">Belum ada data inventaris perusahaan</td></tr>' : ''}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Custody Stock Table -->
                <div class="card" style="border-radius: 16px; overflow: hidden;">
                    <div class="card-header" style="background: var(--bg-secondary); border-bottom: 2px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                        <h3 style="margin: 0;">🤝 Customer Custody (Titipan)</h3>
                        <span class="badge badge-warning">Off-Balance Sheet</span>
                    </div>
                    <div class="card-body" style="padding: 0;">
                        <table class="data-table" style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="background: var(--bg-tertiary);">
                                    <th style="text-align: left; padding: 1rem;">JO Number</th>
                                    <th style="text-align: left; padding: 1rem;">Customer</th>
                                    <th style="text-align: center; padding: 1rem;">Status</th>
                                    <th style="text-align: right; padding: 1rem;">Gross Custody</th>
                                    <th style="text-align: right; padding: 1rem;">Pure Content</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${custodyStock.map(jo => `
                                    <tr style="border-bottom: 1px solid var(--border-color);">
                                        <td style="padding: 1rem;"><strong>${jo.jobOrderNumber}</strong></td>
                                        <td style="padding: 1rem;">${jo.customerName}</td>
                                        <td style="padding: 1rem; text-align: center;">${this.getStatusBadge(jo.status)}</td>
                                        <td style="padding: 1rem; text-align: right;">${jo.grossWeight.toLocaleString('id-ID', { minimumFractionDigits: 2 })} ${jo.uom}</td>
                                        <td style="padding: 1rem; text-align: right; font-weight: bold; color: #b8860b;">${jo.pureContent.toLocaleString('id-ID', { minimumFractionDigits: 2 })} ${jo.uom}</td>
                                    </tr>
                                `).join('')}
                                ${custodyStock.length === 0 ? '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-secondary);">Tidak ada emas titipan aktif</td></tr>' : ''}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>

            <div style="margin-top: 3rem; padding: 2rem; background: var(--bg-tertiary); border-radius: 16px; border-left: 5px solid #1e3c72;">
                <h4 style="margin-top: 0; color: #1e3c72;">💡 Note Kontrol</h4>
                <p style="margin-bottom: 0; font-size: 0.95rem; line-height: 1.6;">
                    Laporan ini membantu Auditor dan Manajemen untuk memastikan bahwa emas yang ada di brankas (*Vault*) adalah gabungan antara 
                    <strong>Aset Inventaris (On-Balance)</strong> dengan <strong>Titipan Pelanggan (Off-Balance)</strong>. 
                    Pemisahan ini mencegah pengakuan aset titipan sebagai kekayaan perusahaan secara akuntansi.
                </p>
            </div>
        `;
    },

    getStatusBadge(status) {
        const badges = {
            received: '<span class="badge badge-info">Received</span>',
            in_process: '<span class="badge badge-warning">Processing</span>',
            in_batch: '<span class="badge badge-warning">In Batch</span>',
            completed: '<span class="badge badge-success">Completed</span>',
            processed: '<span class="badge badge-success">Processed</span>'
        };
        return badges[status] || `<span class="badge">${status}</span>`;
    }
};

window.InventoryCustodyReport = InventoryCustodyReport;
