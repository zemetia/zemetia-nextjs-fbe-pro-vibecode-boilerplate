// ==========================================
// Master Customer Module
// Kelola data customer dengan CRUD operations
// ==========================================

const MasterCustomer = {
  customers: [],
  _editMode: false,
  _editingId: null,

  init() {
    this.loadCustomers();
    this.render();
  },

  loadCustomers() {
    this.customers = Storage.getCustomers();
  },

  getCustomer(id) {
    return this.customers.find(c => c.id === id || c.id == id);
  },

  getAllCustomers() {
    return this.customers;
  },

  render() {
    const content = document.getElementById('main-content');
    content.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">👥 Master Customer</h1>
        <p class="page-description">Kelola data customer untuk transaksi pembelian</p>
      </div>

      <div class="card mb-3">
        <div class="card-header">
          <h2 class="card-title">${this._editMode ? 'Edit' : 'Tambah'} Customer</h2>
        </div>
        <div class="card-body">
          ${this.renderForm()}
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Daftar Customer</h2>
          <div class="btn-group">
            <button class="btn btn-secondary" onclick="MasterCustomer.exportToCSV()">
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
    const customer = this._editMode && this._editingId
      ? this.customers.find(s => s.id === this._editingId)
      : {};

    return `
      <form id="customer-form" onsubmit="MasterCustomer.handleSubmit(event)">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label required">Kode Customer</label>
            <input type="text" name="code" class="form-input" 
                   value="${customer.code || ''}" 
                   placeholder="Contoh: CUST-001" required>
          </div>
          
          <div class="form-group">
            <label class="form-label required">Nama Customer</label>
            <input type="text" name="name" class="form-input" 
                   value="${customer.name || ''}" 
                   placeholder="Contoh: PT. Emas Murni" required>
          </div>
          
          <div class="form-group">
            <label class="form-label required">Tipe Customer</label>
            <select name="customerType" class="form-select" required>
              <option value="Perusahaan" ${customer.customerType === 'Perusahaan' ? 'selected' : ''}>Perusahaan</option>
              <option value="Perorangan/Pribadi" ${customer.customerType === 'Perorangan/Pribadi' ? 'selected' : ''}>Perorangan/Pribadi</option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Contact Person</label>
            <input type="text" name="contact" class="form-input" 
                   value="${customer.contact || ''}" 
                   placeholder="Nama contact person">
          </div>
          
          <div class="form-group">
            <label class="form-label">No. Telepon</label>
            <input type="tel" name="phone" class="form-input" 
                   value="${customer.phone || ''}" 
                   placeholder="081234567890">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Alamat</label>
          <textarea name="address" class="form-textarea" rows="2" 
                    placeholder="Alamat lengkap customer">${customer.address || ''}</textarea>
        </div>

        <div class="form-group">
          <label class="form-label">Catatan</label>
          <textarea name="notes" class="form-textarea" rows="2" 
                    placeholder="Catatan tambahan (opsional)">${customer.notes || ''}</textarea>
        </div>

        <!-- NEW: KYC/KYS & Origin Data for Refining Customers -->
        <div class="card p-3 mb-3 bg-light" style="border-left: 4px solid var(--color-primary);">
            <h4 style="margin-top: 0; color: var(--color-primary);">🔐 KYC/KYS & Origin (Sumber Material)</h4>
            <div class="form-group mb-2">
                <label class="form-label">Kategori Sumber Material</label>
                <select name="sourceCategory" class="form-select" onchange="MasterCustomer.toggleSourceFields(this.value)">
                    <option value="">-- Pilih Kategori Sumber --</option>
                    <option value="mining" ${customer.sourceCategory === 'mining' ? 'selected' : ''}>⛏️ Tambang Rakyat (IPR)</option>
                    <option value="scrap" ${customer.sourceCategory === 'scrap' ? 'selected' : ''}>♻️ Scrap / Recycle</option>
                    <option value="import" ${customer.sourceCategory === 'import' ? 'selected' : ''}>✈️ Import / Luar Negeri</option>
                </select>
            </div>

            <!-- Mining Fields -->
            <div id="mc-source-mining-fields" class="${customer.sourceCategory === 'mining' ? '' : 'hidden'} grid grid-2 gap-2 mt-2">
                <div class="form-group">
                    <label class="form-label small">Nama Koperasi / KUD</label>
                    <input type="text" name="miningCooperative" class="form-input" value="${customer.mining?.cooperative || ''}" placeholder="...">
                </div>
                <div class="form-group">
                    <label class="form-label small">Nomor IPR</label>
                    <input type="text" name="miningIpr" class="form-input" value="${customer.mining?.ipr || ''}" placeholder="...">
                </div>
                <div class="form-group" style="grid-column: span 2;">
                    <label class="form-label small">Lokasi Tambang</label>
                    <input type="text" name="miningLocation" class="form-input" value="${customer.mining?.location || ''}" placeholder="...">
                </div>
            </div>

            <!-- Scrap Fields -->
            <div id="mc-source-scrap-fields" class="${customer.sourceCategory === 'scrap' ? '' : 'hidden'} grid grid-2 gap-2 mt-2">
                <div class="form-group">
                    <label class="form-label small">Asal / Supplier Scrap</label>
                    <input type="text" name="scrapOrigin" class="form-input" value="${customer.scrap?.origin || ''}" placeholder="...">
                </div>
                <div class="form-group">
                    <label class="form-label small">Jenis Scrap Default</label>
                    <select name="scrapType" class="form-select">
                        <option value="jewelry" ${customer.scrap?.type === 'jewelry' ? 'selected' : ''}>💍 Perhiasan Bekas</option>
                        <option value="electronic" ${customer.scrap?.type === 'electronic' ? 'selected' : ''}>💻 Elektronik/PCB</option>
                        <option value="industrial" ${customer.scrap?.type === 'industrial' ? 'selected' : ''}>🏭 Industrial Scrap</option>
                    </select>
                </div>
            </div>

            <!-- Import Fields -->
            <div id="mc-source-import-fields" class="${customer.sourceCategory === 'import' ? '' : 'hidden'} grid grid-2 gap-2 mt-2">
                <div class="form-group">
                    <label class="form-label small">Negara Asal</label>
                    <input type="text" name="importCountry" class="form-input" value="${customer.import?.country || ''}" placeholder="...">
                </div>
                <div class="form-group">
                    <label class="form-label small">Nama Exporter</label>
                    <input type="text" name="importExporter" class="form-input" value="${customer.import?.exporter || ''}" placeholder="...">
                </div>
                <div class="form-group">
                    <label class="form-label small">Official COO No.</label>
                    <input type="text" name="importCooNo" class="form-input" value="${customer.import?.cooNo || ''}" placeholder="...">
                </div>
                <div class="form-group">
                    <label class="form-label small">Refinery Cert (LBMA)</label>
                    <input type="text" name="importRefineryCert" class="form-input" value="${customer.import?.refineryCert || ''}" placeholder="...">
                </div>
                <div class="form-group">
                    <label class="form-label small">No. PIB Default</label>
                    <input type="text" name="importPibNo" class="form-input" value="${customer.import?.pibNo || ''}" placeholder="Contoh: 001234/PIB/KPU-TP/2026">
                </div>
                <div class="form-group">
                    <label class="form-label small">No. SPPB Default</label>
                    <input type="text" name="importSppbNo" class="form-input" value="${customer.import?.sppbNo || ''}" placeholder="Contoh: SPPB-009876/KPU.01/2026">
                </div>
                <div class="form-group" style="grid-column: span 2;">
                    <label class="form-label small">No. MAWB Default</label>
                    <input type="text" name="importMawbNo" class="form-input" value="${customer.import?.mawbNo || ''}" placeholder="Contoh: SQ-618-99881122">
                </div>
            </div>
        </div>

        <div class="flex justify-between align-center">
          ${this._editMode ? `
            <button type="button" class="btn btn-secondary" onclick="MasterCustomer.cancelEdit()">
              Batal Edit
            </button>
          ` : '<div></div>'}
          <button type="submit" class="btn btn-success">
            💾 ${this._editMode ? 'Update' : 'Simpan'} Customer
          </button>
        </div>
      </form>
    `;
  },

  // Calculate AR balance for a customer
  getCustomerBalance(customerId, customerCode) {
    let balance = 0;

    // Sales Orders
    const sos = Storage.get('erp_sales_orders') || [];
    sos.forEach(so => {
      if (so.customerId === customerId || so.customer === customerCode) {
        balance += so.totalAmount || so.total || 0;
      }
    });

    // Sales Invoices
    const invoices = Storage.get('erp_invoices') || Storage.get('sales_invoices') || [];
    invoices.forEach(inv => {
      if (inv.customerId === customerId || inv.customer === customerCode) {
        balance += inv.totalAmount || inv.total || 0;
      }
    });

    // Direct Swaps
    const swaps = Storage.get('direct_swaps') || [];
    swaps.forEach(swap => {
      if (swap.customerId === customerId || swap.customer === customerCode) {
        const netAmount = (swap.outValue || 0) - (swap.inValue || 0);
        balance += netAmount;
      }
    });

    // Receipt Vouchers (reduce balance)
    const receipts = Storage.get('receipt_vouchers') || [];
    receipts.forEach(rv => {
      if (rv.customerId === customerId) {
        balance -= rv.amount || rv.total || 0;
      }
    });

    return balance;
  },

  renderList() {
    if (this.customers.length === 0) {
      return '<p class="text-center text-gray">Belum ada customer. Tambahkan customer pertama Anda!</p>';
    }

    return `
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Kode</th>
              <th>Nama Customer</th>
              <th>Tipe</th>
              <th>Contact</th>
              <th>Telepon</th>
              <th class="text-right">Saldo Piutang</th>
              <th class="text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${this.customers.map(customer => {
      const balance = this.getCustomerBalance(customer.id, customer.code);
      const balanceClass = balance > 0 ? 'text-warning' : 'text-success';

      // Fetch KYC status
      const kycRecords = Storage.get('kyc_records') || [];
      const kyc = kycRecords.find(r => r.customerId === customer.id);
      let kycBadge = '<span class="badge badge-secondary">No KYC</span>';
      if (kyc) {
        if (kyc.status === 'approved') kycBadge = '<span class="badge badge-success">Verified ✅</span>';
        else if (kyc.status === 'submitted' || kyc.status === 'under_review') kycBadge = '<span class="badge badge-warning">Pending ⏳</span>';
        else if (kyc.status === 'rejected') kycBadge = '<span class="badge badge-danger">Rejected ❌</span>';
      }

      return `
              <tr>
                <td><span class="badge badge-primary">${customer.code}</span></td>
                <td><strong>${customer.name}</strong></td>
                <td>
                   <span class="badge ${customer.customerType === 'Perorangan/Pribadi' ? 'badge-info' : 'badge-secondary'}">${customer.customerType || 'Perusahaan'}</span>
                   <div class="mt-1">${kycBadge}</div>
                </td>
                <td>${customer.contact || '-'}</td>
                <td>${customer.phone || '-'}</td>
                <td class="text-right ${balanceClass}"><strong>${this.formatCurrency(balance)}</strong></td>
                <td class="text-center">
                  <button class="btn btn-sm btn-info" onclick="CustomerCard.showCard('${customer.id}')" title="Lihat Kartu">
                    📋
                  </button>
                  <button class="btn btn-sm btn-primary" onclick="MasterCustomer.editCustomer('${customer.id}')" title="Edit">
                    ✏️
                  </button>
                  <button class="btn btn-sm btn-danger" onclick="MasterCustomer.confirmDelete('${customer.id}')" title="Hapus">
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

  handleSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.target);

    const customerData = {
      code: formData.get('code'),
      name: formData.get('name'),
      customerType: formData.get('customerType') || 'Perusahaan',
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
        cooNo: formData.get('importCooNo'),
        refineryCert: formData.get('importRefineryCert'),
        pibNo: formData.get('importPibNo') || '',
        sppbNo: formData.get('importSppbNo') || '',
        mawbNo: formData.get('importMawbNo') || ''
      }
    };

    try {
      if (this._editMode && this._editingId) {
        // Update existing customer
        const success = Storage.updateCustomer(this._editingId, {
          ...customerData,
          id: this._editingId,
          updatedAt: new Date().toISOString(),
        });

        if (success) {
          this.showAlert('success', 'Customer berhasil diupdate!');
          this.cancelEdit();
        } else {
          this.showAlert('error', 'Customer tidak ditemukan');
        }
      } else {
        // Create new customer
        const newCustomer = {
          ...customerData,
          id: `CUST-${Date.now()}`,
          createdAt: new Date().toISOString(),
        };

        Storage.addCustomer(newCustomer);
        this.showAlert('success', 'Customer berhasil ditambahkan!');
        document.getElementById('customer-form').reset();
      }

      this.loadCustomers();
      this.render();
    } catch (error) {
      this.showAlert('error', error.message);
    }
  },

  editCustomer(id) {
    this._editMode = true;
    this._editingId = id;
    this.render();
    document.getElementById('customer-form').scrollIntoView({ behavior: 'smooth' });
  },

  cancelEdit() {
    this._editMode = false;
    this._editingId = null;
    this.render();
  },

  confirmDelete(id) {
    const customer = this.customers.find(s => String(s.id) === String(id));
    if (!customer) return;

    if (confirm(`Hapus customer "${customer.name}"?\n\nData yang sudah dihapus tidak dapat dikembalikan.`)) {
      Storage.deleteCustomer(customer.id);
      this.loadCustomers();
      this.render();
      this.showAlert('success', 'Customer berhasil dihapus');
    }
  },

  exportToCSV() {
    if (this.customers.length === 0) {
      alert('Tidak ada data untuk diexport');
      return;
    }

    const headers = ['Kode', 'Nama', 'Contact', 'Telepon', 'Alamat', 'Catatan'];
    const rows = this.customers.map(s => [
      s.code,
      s.name,
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
    a.download = `customer-${new Date().toISOString().split('T')[0]}.csv`;
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
    document.getElementById('mc-source-mining-fields').classList.add('hidden');
    document.getElementById('mc-source-scrap-fields').classList.add('hidden');
    document.getElementById('mc-source-import-fields').classList.add('hidden');

    if (category) {
      const fieldId = `mc-source-${category}-fields`;
      const element = document.getElementById(fieldId);
      if (element) {
        element.classList.remove('hidden');
      }
    }
  }
};


// Explicitly make MasterCustomer globally available
window.MasterCustomer = MasterCustomer;
