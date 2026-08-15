// ==========================================
// Master Supplier Module
// Kelola data supplier dengan CRUD operations
// ==========================================

const MasterSupplier = {
  suppliers: [],
  _editMode: false,
  _editingId: null,

  init() {
    this.loadSuppliers();
    this.render();
  },

  loadSuppliers() {
    this.suppliers = Storage.getSuppliers();
    return this.suppliers;
  },

  getSupplier(id) {
    if (this.suppliers.length === 0) this.loadSuppliers();
    return this.suppliers.find(s => s.id === id || s.id == id);
  },

  getAllSuppliers() {
    if (this.suppliers.length === 0) this.loadSuppliers();
    return this.suppliers;
  },

  render() {
    const content = document.getElementById('main-content');
    content.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">📦 Master Supplier</h1>
        <p class="page-description">Kelola data supplier untuk transaksi pembelian</p>
      </div>

      <div class="card mb-3">
        <div class="card-header">
          <h2 class="card-title">${this._editMode ? 'Edit' : 'Tambah'} Supplier</h2>
        </div>
        <div class="card-body">
          ${this.renderForm()}
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Daftar Supplier</h2>
          <div class="btn-group">
            <button class="btn btn-secondary" onclick="MasterSupplier.exportToCSV()">
              📄 Export CSV
            </button>
          </div>
        </div>
        <div class="card-body">
          ${this.renderList()}
        </div>
      </div>
    `;
  },

  renderForm() {
    const supplier = this._editMode && this._editingId
      ? this.suppliers.find(s => s.id === this._editingId)
      : {};

    return `
      <form id="supplier-form" onsubmit="MasterSupplier.handleSubmit(event)">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label required">Kode Supplier</label>
            <input type="text" name="code" class="form-input" 
                   value="${supplier.code || ''}" 
                   placeholder="Contoh: SUP-001" required>
          </div>
          
          <div class="form-group">
            <label class="form-label required">Nama Supplier</label>
            <input type="text" name="name" class="form-input" 
                   value="${supplier.name || ''}" 
                   placeholder="Contoh: PT. Emas Murni" required>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label required">Status Pajak</label>
            <select name="taxStatus" class="form-select" required>
              <option value="NON_PKP" ${!supplier.taxStatus || supplier.taxStatus === 'NON_PKP' ? 'selected' : ''}>Non PKP</option>
              <option value="PKP" ${supplier.taxStatus === 'PKP' ? 'selected' : ''}>PKP (Pengusaha Kena Pajak)</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">NPWP</label>
            <input type="text" name="npwp" class="form-input" 
                   value="${supplier.npwp || ''}" 
                   placeholder="Contoh: 12.345.678.9-012.000">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Contact Person</label>
            <input type="text" name="contact" class="form-input" 
                   value="${supplier.contact || ''}" 
                   placeholder="Nama contact person">
          </div>
          
          <div class="form-group">
            <label class="form-label">No. Telepon</label>
            <input type="tel" name="phone" class="form-input" 
                   value="${supplier.phone || ''}" 
                   placeholder="081234567890">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Alamat</label>
          <textarea name="address" class="form-textarea" rows="2" 
                    placeholder="Alamat lengkap supplier">${supplier.address || ''}</textarea>
        </div>

        <div class="form-group">
          <label class="form-label">Catatan</label>
          <textarea name="notes" class="form-textarea" rows="2" 
                    placeholder="Catatan tambahan (opsional)">${supplier.notes || ''}</textarea>
        </div>

        <!-- NEW: KYC/KYS & Origin Data -->
        <div class="card p-3 mb-3 bg-light" style="border-left: 4px solid var(--color-primary);">
            <h4 style="margin-top: 0; color: var(--color-primary);">🔐 KYC/KYS & Origin (Sumber Emas Permasnen)</h4>
            <div class="form-group mb-2">
                <label class="form-label">Kategori Sumber Utama</label>
                <select name="sourceCategory" class="form-select" onchange="MasterSupplier.toggleSourceFields(this.value)">
                    <option value="">-- Pilih Kategori Sumber --</option>
                    <option value="mining" ${supplier.sourceCategory === 'mining' ? 'selected' : ''}>⛏️ Tambang Rakyat (IPR)</option>
                    <option value="scrap" ${supplier.sourceCategory === 'scrap' ? 'selected' : ''}>♻️ Scrap / Recycle</option>
                    <option value="import" ${supplier.sourceCategory === 'import' ? 'selected' : ''}>✈️ Import / Luar Negeri</option>
                </select>
            </div>

            <!-- Mining Fields -->
            <div id="ms-source-mining-fields" class="${supplier.sourceCategory === 'mining' ? '' : 'hidden'} grid grid-2 gap-2 mt-2">
                <div class="form-group">
                    <label class="form-label small">Nama Koperasi / KUD</label>
                    <input type="text" name="miningCooperative" class="form-input" value="${supplier.mining?.cooperative || ''}" placeholder="...">
                </div>
                <div class="form-group">
                    <label class="form-label small">Nomor IPR</label>
                    <input type="text" name="miningIpr" class="form-input" value="${supplier.mining?.ipr || ''}" placeholder="...">
                </div>
                <div class="form-group" style="grid-column: span 2;">
                    <label class="form-label small">Lokasi Tambang</label>
                    <input type="text" name="miningLocation" class="form-input" value="${supplier.mining?.location || ''}" placeholder="...">
                </div>
            </div>

            <!-- Scrap Fields -->
            <div id="ms-source-scrap-fields" class="${supplier.sourceCategory === 'scrap' ? '' : 'hidden'} grid grid-2 gap-2 mt-2">
                <div class="form-group">
                    <label class="form-label small">Asal / Supplier Scrap</label>
                    <input type="text" name="scrapOrigin" class="form-input" value="${supplier.scrap?.origin || ''}" placeholder="...">
                </div>
                <div class="form-group">
                    <label class="form-label small">Jenis Scrap Default</label>
                    <select name="scrapType" class="form-select">
                        <option value="jewelry" ${supplier.scrap?.type === 'jewelry' ? 'selected' : ''}>💍 Perhiasan Bekas</option>
                        <option value="electronic" ${supplier.scrap?.type === 'electronic' ? 'selected' : ''}>💻 Elektronik/PCB</option>
                        <option value="industrial" ${supplier.scrap?.type === 'industrial' ? 'selected' : ''}>🏭 Industrial Scrap</option>
                    </select>
                </div>
            </div>

            <!-- Import Fields -->
            <div id="ms-source-import-fields" class="${supplier.sourceCategory === 'import' ? '' : 'hidden'} grid grid-2 gap-2 mt-2">
                <div class="form-group">
                    <label class="form-label small">Negara Asal</label>
                    <input type="text" name="importCountry" class="form-input" value="${supplier.import?.country || ''}" placeholder="Swiss / Singapore / Australia">
                </div>
                <div class="form-group">
                    <label class="form-label small">Nama Exporter</label>
                    <input type="text" name="importExporter" class="form-input" value="${supplier.import?.exporter || ''}" placeholder="YLG / Metalor / Valcambi">
                </div>
                <div class="form-group">
                    <label class="form-label small">Refinery Cert (LBMA)</label>
                    <input type="text" name="importRefineryCert" class="form-input" value="${supplier.import?.refineryCert || ''}" placeholder="LBMA Certified">
                </div>
                <div class="form-group">
                    <label class="form-label small">No. PIB Default</label>
                    <input type="text" name="importPibNo" class="form-input" value="${supplier.import?.pibNo || ''}" placeholder="Contoh: 001234/PIB/KPU-TP/2026">
                </div>
                <div class="form-group">
                    <label class="form-label small">No. SPPB Default</label>
                    <input type="text" name="importSppbNo" class="form-input" value="${supplier.import?.sppbNo || ''}" placeholder="Contoh: SPPB-009876/KPU.01/2026">
                </div>
                <div class="form-group">
                    <label class="form-label small">No. MAWB Default</label>
                    <input type="text" name="importMawbNo" class="form-input" value="${supplier.import?.mawbNo || ''}" placeholder="Contoh: SQ-618-99881122">
                </div>
            </div>
        </div>

        <div class="flex justify-between align-center">
          ${this._editMode ? `
            <button type="button" class="btn btn-secondary" onclick="MasterSupplier.cancelEdit()">
              Batal Edit
            </button>
          ` : '<div></div>'}
          <button type="submit" class="btn btn-success">
            💾 ${this._editMode ? 'Update' : 'Simpan'} Supplier
          </button>
        </div>
      </form>
    `;
  },

  // Calculate AP balance for a supplier
  // AP = Invoices - Payments (POs are just commitments, not actual liability)
  getSupplierBalance(supplierId, supplierCode) {
    let balance = 0;
    const supplierName = this.suppliers.find(s => s.id === supplierId || s.code === supplierCode)?.name || '';

    // Supplier Invoices (creates AP liability)
    const invoices = Storage.get('supplier_invoices') || [];
    invoices.forEach(inv => {
      if (inv.supplierId === supplierId || inv.supplier === supplierCode ||
        inv.supplierName === supplierName) {
        balance += inv.totalAmount || inv.total || 0;
      }
    });

    // Payment Vouchers (reduces AP)
    const payments = Storage.get('payment_vouchers') || [];
    payments.forEach(pv => {
      if (pv.supplierId === supplierId || pv.supplier === supplierCode ||
        (pv.payee && pv.payee.toLowerCase().includes(supplierName.toLowerCase()))) {
        balance -= pv.amount || pv.total || 0;
      }
    });

    return balance;
  },

  renderList() {
    if (this.suppliers.length === 0) {
      return '<p class="text-center text-gray">Belum ada supplier. Tambahkan supplier pertama Anda!</p>';
    }

    return `
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Kode</th>
              <th>Nama Supplier</th>
              <th>Status Pajak</th>
              <th>Contact</th>
              <th>Telepon</th>
              <th class="text-right">Saldo Hutang</th>
              <th class="text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${this.suppliers.map(supplier => {
      const balance = this.getSupplierBalance(supplier.id, supplier.code);
      const balanceClass = balance > 0 ? 'text-warning' : 'text-success';
      return `
              <tr>
                <td><span class="badge badge-primary">${supplier.code}</span></td>
                <td>
                  <strong>${supplier.name}</strong><br>
                  <small class="text-gray">${supplier.npwp || ''}</small>
                </td>
                <td>
                  ${supplier.taxStatus === 'PKP'
          ? '<span class="badge badge-success">PKP</span>'
          : '<span class="badge badge-secondary">Non PKP</span>'}
                </td>
                <td>${supplier.contact || '-'}</td>
                <td>${supplier.phone || '-'}</td>
                <td class="text-right ${balanceClass}"><strong>${this.formatCurrency(balance)}</strong></td>
                <td class="text-center">
                  <button class="btn btn-sm btn-info" onclick="SupplierCard.showCard('${supplier.id}')" title="Lihat Kartu">
                    📋
                  </button>
                  <button class="btn btn-sm btn-primary" onclick="MasterSupplier.editSupplier('${supplier.id}')" title="Edit">
                    ✏️
                  </button>
                  <button class="btn btn-sm btn-danger" onclick="MasterSupplier.confirmDelete('${supplier.id}')" title="Hapus">
                    🗑️
                  </button>
                </td>
              </tr>
            `}).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount || 0);
  },

  async handleSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.target);

    const supplierData = {
      code: formData.get('code'),
      name: formData.get('name'),
      taxStatus: formData.get('taxStatus'),
      npwp: formData.get('npwp'),
      contact: formData.get('contact'),
      phone: formData.get('phone'),
      address: formData.get('address'),
      notes: formData.get('notes'),
      sourceCategory: formData.get('sourceCategory'),
      mining: {
        cooperative: formData.get('miningCooperative'),
        ipr: formData.get('miningIpr'),
        location: formData.get('miningLocation')
      },
      scrap: {
        origin: formData.get('scrapOrigin'),
        type: formData.get('scrapType')
      },
      import: {
        country: formData.get('importCountry'),
        exporter: formData.get('importExporter'),
        refineryCert: formData.get('importRefineryCert'),
        pibNo: formData.get('importPibNo') || '',
        sppbNo: formData.get('importSppbNo') || '',
        mawbNo: formData.get('importMawbNo') || ''
      }
    };

    try {
      if (this._editMode && this._editingId) {
        // Update existing supplier
        const success = await Storage.updateSupplier(this._editingId, {
          ...supplierData,
          id: this._editingId,
          updatedAt: new Date().toISOString(),
        });

        if (success) {
          this.showAlert('success', 'Supplier berhasil diupdate!');
          this.cancelEdit();
        } else {
          this.showAlert('error', 'Supplier tidak ditemukan');
        }
      } else {
        // Create new supplier
        const newSupplier = {
          ...supplierData,
          id: `SUP-${Date.now()}`,
          createdAt: new Date().toISOString(),
        };

        await Storage.addSupplier(newSupplier);
        this.showAlert('success', 'Supplier berhasil ditambahkan!');
        document.getElementById('supplier-form').reset();
      }

      this.loadSuppliers();
      this.render();
    } catch (error) {
      console.error('Error saving supplier:', error);
      this.showAlert('error', error.message || 'Gagal menyimpan supplier. Coba lagi.');
    }
  },

  editSupplier(id) {
    this._editMode = true;
    this._editingId = id;
    this.render();
    document.getElementById('supplier-form').scrollIntoView({ behavior: 'smooth' });
  },

  cancelEdit() {
    this._editMode = false;
    this._editingId = null;
    this.render();
  },

  async confirmDelete(id) {
    const supplier = this.suppliers.find(s => s.id === id);
    if (!supplier) return;

    if (confirm(`Hapus supplier "${supplier.name}"?\n\nData yang sudah dihapus tidak dapat dikembalikan.`)) {
      try {
        await Storage.deleteSupplier(id);
        this.loadSuppliers();
        this.render();
        this.showAlert('success', 'Supplier berhasil dihapus');
      } catch (error) {
        console.error('Error deleting supplier:', error);
        this.showAlert('error', 'Gagal menghapus supplier');
      }
    }
  },

  exportToCSV() {
    if (this.suppliers.length === 0) {
      alert('Tidak ada data untuk diexport');
      return;
    }

    const headers = ['Kode', 'Nama', 'Status Pajak', 'NPWP', 'Contact', 'Telepon', 'Alamat', 'Catatan'];
    const rows = this.suppliers.map(s => [
      s.code,
      s.name,
      s.taxStatus || 'NON_PKP',
      s.npwp || '',
      s.contact || '',
      s.phone || '',
      s.address || '',
      s.notes || ''
    ]);

    let csv = headers.join(',') + '\n';
    rows.forEach(row => {
      csv += row.map(cell => `"${cell}"`).join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `supplier-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },

  showAlert(type, message) {
    if (typeof ChartOfAccounts !== 'undefined') {
      ChartOfAccounts.showAlert(type, message);
    } else {
      alert(message);
    }
  },

  toggleSourceFields(category) {
    ['mining', 'scrap', 'import'].forEach(cat => {
      const el = document.getElementById(`ms-source-${cat}-fields`);
      if (el) el.classList.add('hidden');
    });

    if (category) {
      const el = document.getElementById(`ms-source-${category}-fields`);
      if (el) el.classList.remove('hidden');
    }
  }
};

// Explicitly make MasterSupplier globally available
window.MasterSupplier = MasterSupplier;
