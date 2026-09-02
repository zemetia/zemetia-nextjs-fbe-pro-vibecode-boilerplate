/**
 * ============================================================================
 * RefinerySimulationImport Module
 * Bridge & Integrator: simulasi-awi.html -> ERP Golden Alura
 * ============================================================================
 * Mengambil data transaksi simulasi peleburan & pemurnian yang di-input Evelyn
 * di simulasi-awi.html (Firestore collection 'refinerySimulations' & LocalStorage)
 * dan memprosesnya secara otomatis ke:
 * 1. Modul Jasa Makloon (MakloonService)
 * 2. Modul Tanda Terima Barang (TTB)
 * 3. Modul Tagihan Ongkos Jasa / Sales Order
 * ============================================================================
 */

const RefinerySimulationImport = {
    simulations: [],
    activeFilter: 'all', // 'all', 'pending', 'processed'
    searchQuery: '',
    isLoading: false,

    /**
     * Helper to extract standardized metadata from simulation object
     */
    extractMeta(meta = {}) {
        return {
            customerName: meta.customerName || 'Tanpa Nama',
            customerPhone: meta.customerPhone || '',
            customerAddress: meta.customerAddress || '',
            reportNumber: meta.reportNumber || 'N/A',
            transactionDate: meta.date || meta.transactionDate || '',
            operatorName: meta.petugasName || meta.operatorName || meta.petugasPeleburan || '-',
            petugasPeleburan: meta.petugasPeleburan || '-',
            petugasLab: meta.petugasLab || '-',
            ttbDescription: meta.ttbDescription || '',
            ttbNotes: meta.ttbNotes || '',
            feeBasis: meta.feeBasis || 'gross_received',
            isNonPph23: meta.isNonPph23 || meta.pph23Option === 'non_pph23'
        };
    },

    /**
     * Helper to extract standardized item values from simulation item object
     */
    extractItem(item = {}, feeBasis = 'gross_received') {
        const rawWeight = parseFloat(item.beratAwal ?? item.beratDeklarasi ?? item.beratTerima ?? item.rawWeight ?? 0);
        const meltedWeight = parseFloat(item.beratLebur ?? item.meltedWeight ?? 0);
        
        let auMurni = 0;
        let purityAu = 0;

        if (item.beratAuManual !== undefined && item.beratAuManual !== null && item.beratAuManual !== '') {
            auMurni = parseFloat(item.beratAuManual);
        } else if (item.auMurni !== undefined && item.auMurni !== null && item.auMurni !== '') {
            auMurni = parseFloat(item.auMurni);
        } else if (item.kadarLab && rawWeight > 0) {
            auMurni = rawWeight * (parseFloat(item.kadarLab) / 100);
        } else if (item.kadarRef && meltedWeight > 0) {
            auMurni = meltedWeight * (parseFloat(item.kadarRef) / 100);
        }

        if (item.kadarRef !== undefined && item.kadarRef !== null && item.kadarRef !== '') {
            purityAu = parseFloat(item.kadarRef);
        } else if (item.purity !== undefined && item.purity !== null && item.purity !== '') {
            purityAu = parseFloat(item.purity);
        } else if (item.kadarLab !== undefined && item.kadarLab !== null && item.kadarLab !== '') {
            purityAu = parseFloat(item.kadarLab);
        } else if (meltedWeight > 0 && auMurni > 0) {
            purityAu = (auMurni / meltedWeight) * 100;
        } else if (rawWeight > 0 && auMurni > 0) {
            purityAu = (auMurni / rawWeight) * 100;
        }

        const agKadar = parseFloat(item.agKadar ?? item.kadarAg ?? 0);
        let agMurni = parseFloat(item.agMurni ?? 0);
        if (agMurni === 0 && agKadar > 0 && (meltedWeight > 0 || rawWeight > 0)) {
            agMurni = (meltedWeight > 0 ? meltedWeight : rawWeight) * (agKadar / 100);
        }

        const date = item.date || '';
        const description = item.description || item.keterangan || (item.notes ? `Lot ${item.id || 1} - ${item.notes}` : `Lot ${item.id || 1}`);
        const notes = item.notes || item.certNumber || item.nomorSertifikat || '';

        return {
            rawWeight,
            meltedWeight,
            auMurni,
            purityAu,
            agKadar,
            agMurni,
            biayaRef: parseFloat(item.biayaRef || 0),
            metalReturn: parseFloat(item.metalReturn || 100),
            date,
            description,
            notes
        };
    },

    /**
     * Compute total summary for a simulation record
     */
    computeSimSummary(sim) {
        const meta = this.extractMeta(sim.metadata);
        const rawItems = sim.items || [];
        const items = rawItems.map(i => this.extractItem(i, meta.feeBasis));

        const totRaw = items.reduce((sum, i) => sum + i.rawWeight, 0);
        const totMelt = items.reduce((sum, i) => sum + i.meltedWeight, 0);
        const totAu = items.reduce((sum, i) => sum + i.auMurni, 0);
        const totAg = items.reduce((sum, i) => sum + i.agMurni, 0);
        const avgPurity = totMelt > 0 ? (totAu / totMelt * 100) : (totRaw > 0 ? (totAu / totRaw * 100) : 0);

        return {
            meta,
            items,
            totRaw,
            totMelt,
            totAu,
            totAg,
            avgPurity
        };
    },

    async init() {
        await this.loadSimulations();
    },

    async loadSimulations() {
        this.isLoading = true;
        this.simulations = [];

        try {
            // 1. Try fetching from Cloud Firestore
            if (typeof window.db !== 'undefined' && typeof window.firestore !== 'undefined') {
                const { collection, getDocs, query, orderBy } = window.firestore;
                try {
                    const q = query(collection(window.db, "refinerySimulations"), orderBy("createdAt", "desc"));
                    const snap = await getDocs(q);
                    snap.forEach(docSnap => {
                        const data = docSnap.data();
                        this.simulations.push({
                            id: docSnap.id,
                            _source: 'cloud',
                            ...data
                        });
                    });
                } catch (cloudErr) {
                    console.warn('⚠️ [RefinerySimulationImport] Firestore fetch error, fallback to local:', cloudErr);
                }
            }

            // 2. Fetch/merge from LocalStorage
            const localRaw = localStorage.getItem('erp_refinery_simulations');
            if (localRaw) {
                try {
                    const localList = JSON.parse(localRaw);
                    localList.forEach(localItem => {
                        const existingIdx = this.simulations.findIndex(s => s.id === localItem.id || (s.metadata?.reportNumber && s.metadata?.reportNumber === localItem.metadata?.reportNumber));
                        if (existingIdx === -1) {
                            this.simulations.push({
                                ...localItem,
                                _source: 'local'
                            });
                        }
                    });
                } catch (e) {
                    console.error('Error parsing local simulations:', e);
                }
            }

            // Sort by transaction date / created date descending
            this.simulations.sort((a, b) => {
                const dateA = a.metadata?.date || a.metadata?.transactionDate || a.createdAt || '';
                const dateB = b.metadata?.date || b.metadata?.transactionDate || b.createdAt || '';
                return String(dateB).localeCompare(String(dateA));
            });

        } finally {
            this.isLoading = false;
        }
    },

    getFilteredSimulations() {
        return this.simulations.filter(sim => {
            const isProcessed = sim.isProcessedToERP || sim.status === 'processed_to_erp' || sim.erpTrxId;
            if (this.activeFilter === 'pending' && isProcessed) return false;
            if (this.activeFilter === 'processed' && !isProcessed) return false;

            if (this.searchQuery) {
                const q = this.searchQuery.toLowerCase();
                const meta = this.extractMeta(sim.metadata);
                const cust = meta.customerName.toLowerCase();
                const repNo = meta.reportNumber.toLowerCase();
                const op = meta.operatorName.toLowerCase();
                const notes = meta.ttbDescription.toLowerCase();
                return cust.includes(q) || repNo.includes(q) || op.includes(q) || notes.includes(q);
            }
            return true;
        });
    },

    render() {
        const content = document.getElementById('main-content');
        if (!content) return;

        const filtered = this.getFilteredSimulations();
        const totalSims = this.simulations.length;
        const pendingSims = this.simulations.filter(s => !(s.isProcessedToERP || s.status === 'processed_to_erp' || s.erpTrxId)).length;
        const processedSims = totalSims - pendingSims;

        // Calculate total weights accurately using extractor
        let grandTotalRaw = 0;
        let grandTotalAu = 0;
        this.simulations.forEach(s => {
            const summary = this.computeSimSummary(s);
            grandTotalRaw += summary.totRaw;
            grandTotalAu += summary.totAu;
        });

        content.innerHTML = `
            <div class="fade-in" style="padding: 16px;">
                <!-- Header Banner -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 20px 24px; border-radius: 12px; border: 1px solid #334155; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3);">
                    <div>
                        <h2 style="margin: 0; color: #f59e0b; font-size: 22px; font-weight: 800; display: flex; align-items: center; gap: 10px;">
                            <span>📥 Integrasi Data Simulasi Awi (Refinery & SPK)</span>
                            <span class="badge badge-warning" style="font-size: 11px; padding: 3px 8px;">Cloud Synchronized</span>
                        </h2>
                        <p style="margin: 6px 0 0; color: #94a3b8; font-size: 13px;">
                            Data formulir peleburan, kadar emas, dan ongkos yang di-input Evelyn di <a href="simulasi-awi.html" target="_blank" style="color: #38bdf8; text-decoration: underline;">simulasi-awi.html</a> siap diproses langsung ke ERP tanpa perlu ketik ulang.
                        </p>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button onclick="RefinerySimulationImport.refreshData()" class="btn btn-secondary" style="display: flex; align-items: center; gap: 6px; font-size: 13px;">
                            🔄 Refresh Data
                        </button>
                        <a href="simulasi-awi.html" target="_blank" class="btn btn-primary" style="display: flex; align-items: center; gap: 6px; font-size: 13px; background: #f59e0b; border-color: #d97706; color: #000; font-weight: 700;">
                            ➕ Buka Simulasi Awi
                        </a>
                    </div>
                </div>

                <!-- Metric Cards -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 20px;">
                    <div class="card" style="padding: 16px; background: #1e293b; border-left: 4px solid #f59e0b; border-radius: 8px;">
                        <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase; font-weight: 700;">Total Simulasi Masuk</div>
                        <div style="font-size: 24px; font-weight: 800; color: #ffffff; margin-top: 4px;">${totalSims} <span style="font-size: 13px; font-weight: normal; color: #94a3b8;">Transaksi</span></div>
                    </div>
                    <div class="card" style="padding: 16px; background: #1e293b; border-left: 4px solid #ef4444; border-radius: 8px;">
                        <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase; font-weight: 700;">Belum Diproses ke ERP</div>
                        <div style="font-size: 24px; font-weight: 800; color: #f87171; margin-top: 4px;">${pendingSims} <span style="font-size: 13px; font-weight: normal; color: #94a3b8;">Menunggu</span></div>
                    </div>
                    <div class="card" style="padding: 16px; background: #1e293b; border-left: 4px solid #10b981; border-radius: 8px;">
                        <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase; font-weight: 700;">Sudah Diproses ke ERP</div>
                        <div style="font-size: 24px; font-weight: 800; color: #34d399; margin-top: 4px;">${processedSims} <span style="font-size: 13px; font-weight: normal; color: #94a3b8;">Selesai</span></div>
                    </div>
                    <div class="card" style="padding: 16px; background: #1e293b; border-left: 4px solid #3b82f6; border-radius: 8px;">
                        <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase; font-weight: 700;">Total Emas Terima (Gross)</div>
                        <div style="font-size: 24px; font-weight: 800; color: #60a5fa; margin-top: 4px;">${grandTotalRaw.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style="font-size: 13px; font-weight: normal; color: #94a3b8;">gr</span></div>
                    </div>
                    <div class="card" style="padding: 16px; background: #1e293b; border-left: 4px solid #eab308; border-radius: 8px;">
                        <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase; font-weight: 700;">Total Kandungan Au Murni</div>
                        <div style="font-size: 24px; font-weight: 800; color: #facc15; margin-top: 4px;">${grandTotalAu.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style="font-size: 13px; font-weight: normal; color: #94a3b8;">gr</span></div>
                    </div>
                </div>

                <!-- Filter & Search Toolbar -->
                <div class="card" style="padding: 14px 16px; margin-bottom: 20px; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px; background: #1e293b;">
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <button onclick="RefinerySimulationImport.setFilter('all')" class="btn btn-sm ${this.activeFilter === 'all' ? 'btn-primary' : 'btn-secondary'}">
                            Semua (${totalSims})
                        </button>
                        <button onclick="RefinerySimulationImport.setFilter('pending')" class="btn btn-sm ${this.activeFilter === 'pending' ? 'btn-primary' : 'btn-secondary'}" style="${this.activeFilter === 'pending' ? 'background: #ef4444; border-color: #dc2626;' : ''}">
                            ⏳ Belum Diproses (${pendingSims})
                        </button>
                        <button onclick="RefinerySimulationImport.setFilter('processed')" class="btn btn-sm ${this.activeFilter === 'processed' ? 'btn-primary' : 'btn-secondary'}" style="${this.activeFilter === 'processed' ? 'background: #10b981; border-color: #059669;' : ''}">
                            ✅ Sudah Diproses (${processedSims})
                        </button>
                    </div>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <input 
                            type="text" 
                            id="search-simulation-input" 
                            class="form-input" 
                            placeholder="🔍 Cari nama customer, no laporan, petugas..." 
                            value="${this.searchQuery}" 
                            oninput="RefinerySimulationImport.onSearch(this.value)"
                            style="min-width: 280px; font-size: 13px; padding: 6px 12px;"
                        />
                    </div>
                </div>

                <!-- Simulation List Table -->
                <div class="card" style="padding: 0; overflow: hidden; background: #1e293b;">
                    <div class="table-responsive">
                        <table class="table table-hover" style="margin: 0; font-size: 13px;">
                            <thead style="background: #0f172a; color: #cbd5e1;">
                                <tr>
                                    <th style="padding: 12px 16px;">Tgl & No. Laporan</th>
                                    <th>Pelanggan / Customer</th>
                                    <th>Petugas Penerima</th>
                                    <th style="text-align: right;">Berat Terima</th>
                                    <th style="text-align: right;">Berat Lebur</th>
                                    <th style="text-align: right;">Rata-rata Kadar</th>
                                    <th style="text-align: right;">Au Murni (gr)</th>
                                    <th style="text-align: center;">Status ERP</th>
                                    <th style="text-align: center; width: 220px;">Aksi 1-Click</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${filtered.length === 0 ? `
                                    <tr>
                                        <td colspan="9" style="text-align: center; padding: 32px; color: #94a3b8;">
                                            ${this.isLoading ? '⏳ Memuat data simulasi...' : 'Tidak ada data simulasi yang sesuai dengan pencarian/filter.'}
                                        </td>
                                    </tr>
                                ` : filtered.map(sim => {
                                    const summary = this.computeSimSummary(sim);
                                    const meta = summary.meta;
                                    const isProcessed = sim.isProcessedToERP || sim.status === 'processed_to_erp' || sim.erpTrxId;

                                    return `
                                        <tr style="border-bottom: 1px solid #334155; ${isProcessed ? 'opacity: 0.85;' : ''}">
                                            <td style="padding: 12px 16px;">
                                                <div style="font-weight: 700; color: #f59e0b;">${meta.reportNumber}</div>
                                                <div style="font-size: 11px; color: #94a3b8;">📅 ${meta.transactionDate || '-'}</div>
                                            </td>
                                            <td>
                                                <div style="font-weight: 700; color: #ffffff;">${meta.customerName}</div>
                                                ${meta.customerPhone ? `<div style="font-size: 11px; color: #94a3b8;">📞 ${meta.customerPhone}</div>` : ''}
                                            </td>
                                            <td>
                                                <div style="color: #cbd5e1;">${meta.operatorName}</div>
                                                ${meta.ttbDescription ? `<div style="font-size: 11px; color: #64748b; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${meta.ttbDescription}</div>` : ''}
                                            </td>
                                            <td style="text-align: right; font-weight: 600; color: #ffffff;">
                                                ${summary.totRaw.toFixed(2)} gr
                                            </td>
                                            <td style="text-align: right; font-weight: 600; color: #38bdf8;">
                                                ${summary.totMelt.toFixed(2)} gr
                                            </td>
                                            <td style="text-align: right; font-weight: 700; color: #fbbf24;">
                                                ${summary.avgPurity.toFixed(2)} %
                                            </td>
                                            <td style="text-align: right; font-weight: 800; color: #f59e0b;">
                                                ${summary.totAu.toFixed(2)} gr
                                            </td>
                                            <td style="text-align: center;">
                                                ${isProcessed ? `
                                                    <span class="badge badge-success" style="font-size: 11px; padding: 4px 8px; background: #065f46; color: #34d399; border: 1px solid #059669;">
                                                        ✅ Diproses (${sim.erpTrxNumber || 'ERP'})
                                                    </span>
                                                ` : `
                                                    <span class="badge badge-warning" style="font-size: 11px; padding: 4px 8px; background: #78350f; color: #fde68a; border: 1px solid #d97706;">
                                                        Menunggu Proses
                                                    </span>
                                                `}
                                            </td>
                                            <td style="text-align: center;">
                                                <div style="display: flex; gap: 6px; justify-content: center; flex-wrap: wrap;">
                                                    <button onclick="RefinerySimulationImport.showDetailModal('${sim.id}')" class="btn btn-sm btn-secondary" title="Lihat Rincian Lengkap" style="padding: 4px 8px; font-size: 11px;">
                                                        👁️ Rincian
                                                    </button>
                                                    <button onclick="RefinerySimulationImport.processToMakloon('${sim.id}')" class="btn btn-sm btn-primary" style="padding: 4px 8px; font-size: 11px; background: #f59e0b; border-color: #d97706; color: #000; font-weight: 700;" title="Tarik ke Transaksi Jasa Makloon">
                                                        ⚡ Proses Makloon
                                                    </button>
                                                    <button onclick="RefinerySimulationImport.processToTTB('${sim.id}')" class="btn btn-sm btn-secondary" style="padding: 4px 8px; font-size: 11px; color: #38bdf8;" title="Terbitkan Tanda Terima Barang">
                                                        🚚 TTB
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    },

    setFilter(filter) {
        this.activeFilter = filter;
        this.render();
    },

    onSearch(query) {
        this.searchQuery = query;
        this.render();
    },

    async refreshData() {
        if (window.showLoading) window.showLoading('Menyinkronkan data simulasi...');
        await this.loadSimulations();
        if (window.hideLoading) window.hideLoading();
        this.render();
        if (typeof App !== 'undefined' && App.showAlert) {
            App.showAlert('success', 'Data simulasi Awi berhasil diperbarui!');
        }
    },

    getSimulationById(id) {
        return this.simulations.find(s => String(s.id) === String(id));
    },

    showDetailModal(id) {
        const sim = this.getSimulationById(id);
        if (!sim) return;

        const summary = this.computeSimSummary(sim);
        const meta = summary.meta;
        const items = summary.items;
        const minting = sim.mintingQty || {};

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px; width: 95%; background: #1e293b; color: #ffffff; border: 1px solid #334155;">
                <div class="modal-header" style="border-bottom: 1px solid #334155; padding-bottom: 12px;">
                    <h3 style="margin: 0; color: #f59e0b; font-size: 18px; font-weight: 700;">
                        📋 Rincian Simulasi: ${meta.reportNumber || sim.id}
                    </h3>
                    <button onclick="this.closest('.modal-overlay').remove()" class="close-btn" style="color: #94a3b8; font-size: 20px;">×</button>
                </div>
                <div class="modal-body" style="padding: 16px 0; max-height: 75vh; overflow-y: auto;">
                    
                    <!-- Metadata Block -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; background: #0f172a; padding: 14px; border-radius: 8px; margin-bottom: 16px; border: 1px solid #334155;">
                        <div>
                            <p style="margin: 2px 0;"><strong>Nama Pelanggan:</strong> <span style="color: #f59e0b;">${meta.customerName}</span></p>
                            <p style="margin: 2px 0;"><strong>Alamat:</strong> ${meta.customerAddress || '-'}</p>
                            <p style="margin: 2px 0;"><strong>No. Telepon:</strong> ${meta.customerPhone || '-'}</p>
                            <p style="margin: 2px 0;"><strong>Keterangan TTB:</strong> ${meta.ttbDescription || '-'}</p>
                        </div>
                        <div>
                            <p style="margin: 2px 0;"><strong>Tanggal Transaksi:</strong> ${meta.transactionDate || '-'}</p>
                            <p style="margin: 2px 0;"><strong>No. SPK / Laporan:</strong> ${meta.reportNumber}</p>
                            <p style="margin: 2px 0;"><strong>Petugas Penerima:</strong> ${meta.operatorName}</p>
                            <p style="margin: 2px 0;"><strong>Opsi Pajak:</strong> ${meta.isNonPph23 ? 'Non-PPh23 (Orang Pribadi)' : 'Potong PPh 23 (Badan Usaha)'}</p>
                        </div>
                    </div>

                    <!-- Items / Lots Table -->
                    <h4 style="margin: 0 0 8px 0; color: #f59e0b; font-size: 14px;">📦 Rincian Barang & Kadar per Lot:</h4>
                    <div class="table-responsive" style="margin-bottom: 16px;">
                        <table class="table" style="font-size: 12px; margin: 0; background: #0f172a; border-radius: 6px;">
                            <thead>
                                <tr style="border-bottom: 1px solid #334155; color: #94a3b8;">
                                    <th>No</th>
                                    <th>Deskripsi / Lot</th>
                                    <th style="text-align: right;">Berat Kotor</th>
                                    <th style="text-align: right;">Berat Lebur</th>
                                    <th style="text-align: right;">Kadar Au</th>
                                    <th style="text-align: right;">Au Murni</th>
                                    <th style="text-align: right;">Kadar Ag</th>
                                    <th style="text-align: right;">Ag Murni</th>
                                    <th>Nomor Sertifikat / Catatan</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${items.map((item, idx) => `
                                    <tr style="border-bottom: 1px solid #1e293b;">
                                        <td>${idx + 1}</td>
                                        <td style="font-weight: 600;">${item.description}</td>
                                        <td style="text-align: right;">${item.rawWeight.toFixed(2)} gr</td>
                                        <td style="text-align: right; color: #38bdf8;">${item.meltedWeight.toFixed(2)} gr</td>
                                        <td style="text-align: right; color: #fbbf24;">${item.purityAu.toFixed(2)} %</td>
                                        <td style="text-align: right; font-weight: 700; color: #f59e0b;">${item.auMurni.toFixed(2)} gr</td>
                                        <td style="text-align: right;">${item.agKadar.toFixed(2)} %</td>
                                        <td style="text-align: right;">${item.agMurni.toFixed(2)} gr</td>
                                        <td style="color: #94a3b8; font-size: 11px;">${item.notes || '-'}</td>
                                    </tr>
                                `).join('')}
                                <tr style="background: rgba(245, 158, 11, 0.1); font-weight: 800; border-top: 2px solid #f59e0b;">
                                    <td colspan="2">TOTAL</td>
                                    <td style="text-align: right;">${summary.totRaw.toFixed(2)} gr</td>
                                    <td style="text-align: right; color: #38bdf8;">${summary.totMelt.toFixed(2)} gr</td>
                                    <td style="text-align: right; color: #fbbf24;">${summary.avgPurity.toFixed(2)} %</td>
                                    <td style="text-align: right; color: #f59e0b;">${summary.totAu.toFixed(2)} gr</td>
                                    <td></td>
                                    <td style="text-align: right;">${summary.totAg.toFixed(2)} gr</td>
                                    <td></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- Minting / Cetak Batangan -->
                    ${(minting.qty1000g || minting.qty500g || minting.qty250g || minting.qty50g || minting.qty10g) ? `
                        <div style="background: #0f172a; padding: 12px 14px; border-radius: 8px; margin-bottom: 16px; border: 1px solid #334155;">
                            <h4 style="margin: 0 0 6px 0; color: #f59e0b; font-size: 13px;">🥇 Permintaan Cetak Emas Batangan (Minting):</h4>
                            <div style="display: flex; gap: 16px; flex-wrap: wrap; font-size: 12px;">
                                ${minting.qty1000g ? `<span><strong>1000g:</strong> ${minting.qty1000g} bar</span>` : ''}
                                ${minting.qty500g ? `<span><strong>500g:</strong> ${minting.qty500g} bar</span>` : ''}
                                ${minting.qty250g ? `<span><strong>250g:</strong> ${minting.qty250g} bar</span>` : ''}
                                ${minting.qty50g ? `<span><strong>50g:</strong> ${minting.qty50g} bar</span>` : ''}
                                ${minting.qty10g ? `<span><strong>10g:</strong> ${minting.qty10g} bar</span>` : ''}
                            </div>
                        </div>
                    ` : ''}

                </div>
                <div class="modal-footer" style="border-top: 1px solid #334155; padding-top: 12px; display: flex; justify-content: space-between;">
                    <button onclick="this.closest('.modal-overlay').remove()" class="btn btn-secondary">Tutup</button>
                    <div style="display: flex; gap: 8px;">
                        <button onclick="RefinerySimulationImport.processToTTB('${sim.id}'); this.closest('.modal-overlay').remove();" class="btn btn-secondary" style="color: #38bdf8;">
                            🚚 Terbitkan TTB
                        </button>
                        <button onclick="RefinerySimulationImport.processToMakloon('${sim.id}'); this.closest('.modal-overlay').remove();" class="btn btn-primary" style="background: #f59e0b; border-color: #d97706; color: #000; font-weight: 700;">
                            ⚡ Proses ke Jasa Makloon
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    /**
     * 1-Click Action: Transfer Simulation to Makloon Transaction
     */
    async processToMakloon(id) {
        const sim = this.getSimulationById(id);
        if (!sim) {
            alert('Data simulasi tidak ditemukan!');
            return;
        }

        // Navigate to Makloon module
        if (typeof App !== 'undefined' && App.navigateTo) {
            App.navigateTo('makloon-service');
        } else if (document.querySelector('[data-page="makloon-service"]')) {
            document.querySelector('[data-page="makloon-service"]').click();
        }

        setTimeout(() => {
            if (typeof MakloonService !== 'undefined' && MakloonService.createFromSimulation) {
                MakloonService.createFromSimulation(sim);
            } else {
                alert('Modul Jasa Makloon sedang dimuat, silakan coba lagi.');
            }
        }, 150);
    },

    /**
     * 1-Click Action: Transfer Simulation to TTB (Tanda Terima Barang)
     */
    async processToTTB(id) {
        const sim = this.getSimulationById(id);
        if (!sim) {
            alert('Data simulasi tidak ditemukan!');
            return;
        }

        if (typeof TTB !== 'undefined' && TTB.createTTBFromSimulation) {
            await TTB.createTTBFromSimulation(sim);
        } else {
            alert('Modul TTB sedang tidak tersedia.');
        }
    },

    /**
     * Mark a simulation as processed in ERP
     */
    async markSimulationAsProcessed(id, erpTrxNumber, erpTrxId) {
        const sim = this.getSimulationById(id);
        if (!sim) return;

        sim.isProcessedToERP = true;
        sim.status = 'processed_to_erp';
        sim.erpTrxNumber = erpTrxNumber;
        sim.erpTrxId = erpTrxId;
        sim.processedAt = new Date().toISOString();
        sim.processedBy = (typeof Auth !== 'undefined' && Auth.getCurrentUser) ? Auth.getCurrentUser()?.name : 'ERP User';

        // Update LocalStorage
        let localHistory = JSON.parse(localStorage.getItem('erp_refinery_simulations') || '[]');
        const idx = localHistory.findIndex(h => h.id === id || h.metadata?.reportNumber === sim.metadata?.reportNumber);
        if (idx !== -1) {
            localHistory[idx] = { ...localHistory[idx], ...sim };
            localStorage.setItem('erp_refinery_simulations', JSON.stringify(localHistory));
        }

        // Update Firestore if online
        if (typeof window.db !== 'undefined' && typeof window.firestore !== 'undefined' && sim._source === 'cloud') {
            try {
                const { doc, setDoc } = window.firestore;
                await setDoc(doc(window.db, "refinerySimulations", id), {
                    isProcessedToERP: true,
                    status: 'processed_to_erp',
                    erpTrxNumber: erpTrxNumber,
                    erpTrxId: erpTrxId,
                    processedAt: new Date().toISOString(),
                    processedBy: sim.processedBy
                }, { merge: true });
            } catch (err) {
                console.warn('Could not sync processed status to cloud:', err);
            }
        }
    }
};

if (typeof window !== 'undefined') {
    window.RefinerySimulationImport = RefinerySimulationImport;
}
if (typeof global !== 'undefined') {
    global.RefinerySimulationImport = RefinerySimulationImport;
}
