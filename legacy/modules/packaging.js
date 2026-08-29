// ==========================================
// Packaging & Serialization Module
// Handles bulk to serial splitting
// ==========================================

const Packaging = {
    records: [],

    init() {
        this.loadRecords();
    },

    loadRecords() {
        this.records = Storage.get(Storage.KEYS.PACKAGING) || [];
    },

    async saveRecords() {
        return await Storage.set(Storage.KEYS.PACKAGING, this.records);
    },

    render() {
        const content = document.getElementById('main-content');
        if (!content) return;

        content.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">💎 Packaging & Serialization</h1>
                <p class="page-description">Split bulk gold into serialized bars with certificates</p>
            </div>

            <div class="card mb-3">
                <div class="card-header">
                    <h2 class="card-title">History Packaging</h2>
                    <button class="btn btn-primary" onclick="Packaging.showModal()">
                        ➕ Baru / New Packaging
                    </button>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Batch #</th>
                                    <th>Tanggal</th>
                                    <th>Ref. Produksi</th>
                                    <th>Total Qty</th>
                                    <th>Total Berat</th>
                                    <th>Status</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${this.renderRows()}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div id="packaging-modal" class="modal-overlay hidden">
                <div class="modal" style="max-width: 900px;">
                    <div class="modal-header">
                        <h3 class="modal-title">New Packaging Record</h3>
                        <button class="modal-close" onclick="Packaging.closeModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="packaging-form">
                            <div class="row">
                                <div class="col-4">
                                    <label class="required">Batch No. Packaging</label>
                                    <input type="text" id="pck-batch-no" class="form-input" placeholder="Misal: PKG-2024-001">
                                </div>
                                <div class="col-4">
                                    <label class="required">Berat Bulk Asal (g)</label>
                                    <input type="number" id="pck-bulk-weight" class="form-input" step="0.001" placeholder="0.000">
                                </div>
                                <div id="pck-ref-container" class="col-4">
                                    <label>Ref. Produksi (Asal Casting)</label>
                                    <select id="pck-ref-prod-select" class="form-input" onchange="Packaging.onRefSelect(this.value)">
                                        <option value="">-- Manual / Tanpa Ref --</option>
                                        ${this.getRefProdOptions()}
                                    </select>
                                    <input type="hidden" id="pck-ref-prod">
                                </div>
                            </div>
                            <div class="row mt-2">
                                <div class="col-6">
                                    <label>Tanggal</label>
                                    <input type="date" id="pck-date" class="form-input" value="${new Date().toISOString().split('T')[0]}">
                                </div>
                            </div>

                            <hr>
                            <h4>Rincian Unit (Serials)</h4>
                            <div class="mb-2">
                                <button type="button" class="btn btn-sm btn-secondary" onclick="Packaging.generateRows()">
                                    ⚡ Auto-Generate Rows
                                </button>
                                <input type="number" id="pck-gen-count" placeholder="Qty" style="width: 60px">
                                <input type="number" id="pck-gen-weight" placeholder="Weight (g)" style="width: 100px">
                            </div>

                            <div class="table-responsive" style="max-height: 300px">
                                <table class="table table-sm">
                                    <thead>
                                        <tr>
                                            <th width="50">#</th>
                                            <th>Serial Number</th>
                                            <th>Cert Number</th>
                                            <th width="120">Weight (g)</th>
                                            <th width="50"></th>
                                        </tr>
                                    </thead>
                                    <tbody id="pck-units-body">
                                        <!-- Dynamic Rows -->
                                    </tbody>
                                </table>
                            </div>

                            <div class="mt-2 text-right">
                                <div id="pck-validation-msg" class="text-danger mb-1 hidden">Total berat bar melebihi berat bulk!</div>
                                <strong>Total Terdata: <span id="pck-total-weight">0</span>g</strong>
                            </div>

                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" onclick="Packaging.closeModal()">Batal</button>
                                <button type="button" class="btn btn-primary" id="btn-save-pck" onclick="Packaging.submit()">
                                    Selesaikan & Simpan
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
    },

    renderRows() {
        if (this.records.length === 0) return '<tr><td colspan="7" class="text-center">Belum ada data.</td></tr>';
        return this.records.map(r => `
            <tr>
                <td><strong>${r.batchNo || r.id}</strong></td>
                <td>${r.date}</td>
                <td>${r.refProd || '-'}</td>
                <td>${r.units.length} unit</td>
                <td>${r.totalWeight.toFixed(3)}g</td>
                <td><span class="badge badge-success">Selesai</span></td>
                <td>
                    <button class="btn btn-sm btn-info" onclick="Packaging.viewDetail('${r.id}')">👁️</button>
                </td>
            </tr>
        `).join('');
    },

    getRefProdOptions() {
        const orders = Storage.get(Storage.KEYS.PRODUCTION_ORDERS) || [];
        // Show orders that have pre-generated SNs and are not yet fully packaged
        return orders
            .filter(o => o.preGeneratedSNs && o.preGeneratedSNs.length > 0)
            .map(o => `<option value="${o.orderNumber}">${o.orderNumber} (${o.productName})</option>`)
            .join('');
    },

    onRefSelect(orderNumber) {
        document.getElementById('pck-ref-prod').value = orderNumber;
        if (!orderNumber) return;

        const orders = Storage.get(Storage.KEYS.PRODUCTION_ORDERS) || [];
        const order = orders.find(o => o.orderNumber === orderNumber);

        if (order && order.preGeneratedSNs) {
            if (confirm(`Tarik ${order.preGeneratedSNs.length} Serial Number dari referensi produksi ini?`)) {
                // Clear existing units
                document.getElementById('pck-units-body').innerHTML = '';

                // Add SNs
                order.preGeneratedSNs.forEach(item => {
                    const sn = typeof item === 'object' ? item.sn : item;
                    const weight = typeof item === 'object' ? item.weight : 0;
                    this.addRow(sn, '', weight);
                });

                // Auto-fill bulk weight if available from output
                if (order.actualQuantity) {
                    document.getElementById('pck-bulk-weight').value = order.actualQuantity;
                }

                this.updateTotal();
                alert('Berhasil menarik serial numbers dari tahap Casting.');
            }
        }
    },

    showModal() {
        document.getElementById('packaging-modal').classList.remove('hidden');
        this.clearForm();
    },

    closeModal() {
        document.getElementById('packaging-modal').classList.add('hidden');
    },

    clearForm() {
        document.getElementById('pck-units-body').innerHTML = '';
        document.getElementById('pck-total-weight').innerText = '0';
        document.getElementById('pck-batch-no').value = '';
        document.getElementById('pck-bulk-weight').value = '';
        document.getElementById('pck-ref-prod').value = '';
        if (document.getElementById('pck-validation-msg')) {
            document.getElementById('pck-validation-msg').classList.add('hidden');
        }
    },

    generateRows() {
        const count = parseInt(document.getElementById('pck-gen-count').value) || 0;
        const weight = parseFloat(document.getElementById('pck-gen-weight').value) || 0;

        if (count <= 0) return alert('Jumlah unit harus > 0');

        for (let i = 0; i < count; i++) {
            this.addRow('', '', weight);
        }
        this.updateTotal();
    },

    addRow(sn = '', cert = '', weight = 0) {
        const tbody = document.getElementById('pck-units-body');
        const count = tbody.children.length + 1;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${count}</td>
            <td><input type="text" class="form-input sn-input" value="${sn}" placeholder="SN..."></td>
            <td><input type="text" class="form-input cert-input" value="${cert}" placeholder="Cert..."></td>
            <td><input type="number" class="form-input weight-input" value="${weight}" step="0.001" onchange="Packaging.updateTotal()"></td>
            <td><button type="button" class="btn btn-sm btn-danger" onclick="this.closest('tr').remove(); Packaging.updateTotal();">×</button></td>
        `;
        tbody.appendChild(tr);
    },

    updateTotal() {
        let total = 0;
        document.querySelectorAll('.weight-input').forEach(input => {
            total += parseFloat(input.value) || 0;
        });
        document.getElementById('pck-total-weight').innerText = total.toFixed(3);

        const bulkWeight = parseFloat(document.getElementById('pck-bulk-weight').value) || 0;
        const msg = document.getElementById('pck-validation-msg');
        if (msg) {
            if (total > bulkWeight && bulkWeight > 0) {
                msg.classList.remove('hidden');
            } else {
                msg.classList.add('hidden');
            }
        }
    },

    async submit() {
        const batchNo = document.getElementById('pck-batch-no')?.value;
        const bulkWeight = parseFloat(document.getElementById('pck-bulk-weight')?.value) || 0;
        const refProd = document.getElementById('pck-ref-prod')?.value;
        const unitRows = document.querySelectorAll('#pck-units-body tr');

        let totalWeight = 0;
        document.querySelectorAll('.weight-input').forEach(input => {
            totalWeight += parseFloat(input.value) || 0;
        });

        if (!batchNo) return alert('Masukkan No. Batch Packaging');
        if (isNaN(bulkWeight) || bulkWeight <= 0) return alert('Masukkan Berat Bulk Asal yang valid');
        if (unitRows.length === 0) return alert('Input setidaknya 1 unit');
        if (totalWeight > bulkWeight + 0.0001) { // small epsilon for float
            return alert('Total berat unit (' + totalWeight.toFixed(3) + 'g) melebihi berat bulk (' + bulkWeight.toFixed(3) + 'g)!');
        }

        const btn = document.getElementById('btn-save-pck');
        if (btn) {
            btn.disabled = true;
            btn.innerText = 'Menyimpan...';
        }

        try {
            const units = [];
            unitRows.forEach(row => {
                units.push({
                    serialNumber: row.querySelector('.sn-input').value,
                    certNumber: row.querySelector('.cert-input').value,
                    weight: parseFloat(row.querySelector('.weight-input').value),
                    status: 'Available'
                });
            });

            const record = {
                id: 'PCK-' + Date.now(),
                date: document.getElementById('pck-date').value,
                batchNo,
                bulkWeight,
                refProd,
                totalWeight,
                units,
                createdAt: new Date().toISOString()
            };

            // 1. Save Packaging Record
            this.records.unshift(record);
            await this.saveRecords();

            // 2. Register Serialized Items
            const serializedItems = units.map(u => ({
                id: 'BAR-' + Math.random().toString(36).substr(2, 9),
                ...u,
                itemCode: 'FG-GOLD-BAR',
                batchNo: batchNo,
                packagingId: record.id
            }));
            await SerializedItem.addItems(serializedItems);

            // 3. Update Stock
            if (typeof WarehouseStock !== 'undefined') {
                // OUT: Bulk Gold
                WarehouseStock.logMovement('MAIN', 'WIP-GOLD', bulkWeight, 0, 'OUT', record.id);

                // IN: Serialized Bars
                WarehouseStock.logMovement('MAIN', 'FG-GOLD-BAR', totalWeight, 0, 'IN', record.id);

                // Small loss entry if any
                const loss = bulkWeight - totalWeight;
                if (loss > 0.0001) {
                    WarehouseStock.logMovement('MAIN', 'GOLD-LOSS', loss, 0, 'IN', record.id);
                }
            }

            alert('Packaging berhasil diselesaikan!');
            this.closeModal();
            this.render();

        } catch (error) {
            console.error(error);
            alert('Gagal menyimpan: ' + error.message);
        } finally {
            btn.disabled = false;
            btn.innerText = 'Selesaikan & Simpan';
        }
    }
};

Packaging.init();
window.Packaging = Packaging;
