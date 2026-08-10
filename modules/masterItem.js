// ==========================================
// Master Item Module
// Kelola data barang/produk dengan CRUD operations
// ==========================================

const MasterItem = {
  items: [],
  _editMode: false,
  _editingId: null,

  init() {
    this.loadItems();
    this.render();
  },

  loadItems() {
    this.items = Storage.getItems();
  },

  getItem(idOrCode) {
    if (!idOrCode) return null;
    return this.items.find(i => i.id === idOrCode || i.id == idOrCode || i.code === idOrCode);
  },

  getAllItems() {
    return this.items;
  },

  render() {
    const content = document.getElementById('main-content');
    content.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">📦 Master Barang/Produk</h1>
        <p class="page-description">Kelola data barang dan produk untuk transaksi</p>
      </div>

      <div class="card mb-3">
        <div class="card-header">
          <h2 class="card-title">${this._editMode ? 'Edit' : 'Tambah'} Barang</h2>
        </div>
        <div class="card-body">
          ${this.renderForm()}
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Daftar Barang</h2>
          <div class="btn-group gap-2">
            <button class="btn btn-warning" onclick="MasterItem.showBulkEditAccountModal()">
              🏷️ Bulk Set Akun GL
            </button>
            <button class="btn btn-outline" onclick="MasterItem.downloadImportTemplate()">
              📥 Download Template
            </button>
            <input type="file" id="item-import-file" style="display: none;" accept=".csv" onchange="MasterItem.importFromCSV(this)">
            <button class="btn btn-info" onclick="document.getElementById('item-import-file').click()">
              📤 Import CSV
            </button>
            <button class="btn btn-secondary" onclick="MasterItem.exportToCSV()">
              📄 Export CSV
            </button>
          </div>
        </div>
        <div class="card-body">
          ${this.renderList()}
        </div>
      </div>

      <!-- Bulk Edit Account Modal -->
      <div id="bulk-edit-account-modal" class="modal">
        <div class="modal-content">
          <div class="modal-header">
            <h3 class="modal-title">Bulk Set Akun GL Persediaan</h3>
            <span class="close-button" onclick="MasterItem.hideBulkEditAccountModal()">&times;</span>
          </div>
          <div class="modal-body">
            <form id="bulk-edit-account-form" onsubmit="MasterItem.bulkEditAccounts(event)">
              <div class="form-group">
                <label class="form-label required">Pilih Akun Inventori Baru</label>
                <input type="text" name="newInventoryAccount" class="form-input" 
                       placeholder="Contoh: 1154" required>
                <small class="text-gray">Semua barang akan diupdate dengan akun ini. Kosongkan untuk menghapus.</small>
              </div>
              <div class="form-group">
                <label class="form-label">Preview Akun</label>
                <div id="bulk-account-preview" style="padding: 8px; border: 1px solid var(--color-gray-800); border-radius: var(--radius-md); font-family: monospace; background: var(--bg-tertiary, #1e1e1e); min-height: 36px; font-size:13px;">
                  <span style="opacity:0.5">— masukkan kode akun —</span>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onclick="MasterItem.hideBulkEditAccountModal()">Batal</button>
                <button type="submit" class="btn btn-primary">Update Semua Barang</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    // Add event listener for live account preview in bulk edit modal
    const bulkAccountInput = document.querySelector('#bulk-edit-account-modal input[name="newInventoryAccount"]');
    if (bulkAccountInput) {
      bulkAccountInput.addEventListener('input', (e) => {
        const previewDiv = document.getElementById('bulk-account-preview');
        const accountCode = e.target.value.trim();
        if (accountCode) {
          previewDiv.innerHTML = `<strong>${accountCode}</strong> — ${this.getAccountName(accountCode)}`;
        } else {
          previewDiv.innerHTML = '<span style="opacity:0.5">— masukkan kode akun —</span>';
        }
      });
    }

    // Add event listener for live account preview in item form
    const itemAccountInput = document.querySelector('#item-form input[name="inventoryAccount"]');
    if (itemAccountInput) {
      itemAccountInput.addEventListener('input', (e) => {
        const previewDiv = document.getElementById('item-account-preview');
        const accountCode = e.target.value.trim();
        if (accountCode) {
          previewDiv.innerHTML = `<strong>${accountCode}</strong> — ${this.getAccountName(accountCode)}`;
        } else {
          previewDiv.innerHTML = '<span style="opacity:0.5">— gunakan default mapping —</span>';
        }
      });
    }
  },

  renderForm() {
    const item = this._editMode && this._editingId
      ? this.items.find(i => i.id === this._editingId)
      : {};

    return `
      <form id="item-form" onsubmit="MasterItem.handleSubmit(event)">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label required">Kode Barang</label>
            <div class="flex gap-2">
                <input type="text" name="code" class="form-input" 
                       value="${item.code || ''}" 
                       placeholder="Contoh: ITEM-001" required>
                <button type="button" class="btn btn-secondary" onclick="MasterItem.generateItemCode()" title="Generate Code Otomatis">
                    ⚡ Auto
                </button>
            </div>
            <small class="text-gray">Klik Auto untuk generate kode berdasarkan Kategori</small>
          </div>
          
          <div class="form-group">
            <label class="form-label required">Nama Barang</label>
            <input type="text" name="name" class="form-input" 
                   value="${item.name || ''}" 
                   placeholder="Contoh: Gold Bar 24K" required>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label required">Kategori</label>
            <select name="category" class="form-select" required onchange="MasterItem.generateItemCode(true)">
              <option value="">-- Pilih Kategori --</option>
              <option value="raw_materials" ${item.category === 'raw_materials' ? 'selected' : ''}>Bahan Baku (Raw Materials)</option>
              <option value="wip" ${item.category === 'wip' ? 'selected' : ''}>Barang Dalam Proses (WIP)</option>
              <option value="finished_goods" ${item.category === 'finished_goods' ? 'selected' : ''}>Barang Jadi (Umum)</option>
              <option value="finished_goods_cert" ${item.category === 'finished_goods_cert' ? 'selected' : ''}>Barang Jadi (Sertifikat)</option>
              <option value="finished_goods_noncert" ${item.category === 'finished_goods_noncert' ? 'selected' : ''}>Barang Jadi (Polos)</option>
              <option value="services" ${item.category === 'services' ? 'selected' : ''}>Jasa (Services)</option>
              <option value="consumables" ${item.category === 'consumables' ? 'selected' : ''}>Consumables</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label required">Satuan (UOM)</label>
            <select name="uom" class="form-select" required>
              <option value="">-- Pilih Satuan --</option>
              <option value="pcs" ${item.uom === 'pcs' ? 'selected' : ''}>Pcs (Pieces)</option>
              <option value="kg" ${item.uom === 'kg' ? 'selected' : ''}>Kg (Kilogram)</option>
              <option value="gram" ${item.uom === 'gram' ? 'selected' : ''}>Gram</option>
              <option value="troy_oz" ${item.uom === 'troy_oz' ? 'selected' : ''}>Troy Oz (Troy Ounce)</option>
              <option value="liter" ${item.uom === 'liter' ? 'selected' : ''}>Liter</option>
              <option value="mL" ${item.uom === 'mL' ? 'selected' : ''}>mL (mili Liter)</option>
              <option value="meter" ${item.uom === 'meter' ? 'selected' : ''}>Meter</option>
              <option value="box" ${item.uom === 'box' ? 'selected' : ''}>Box</option>
              <option value="unit" ${item.uom === 'unit' ? 'selected' : ''}>Unit</option>
              <option value="hour" ${item.uom === 'hour' ? 'selected' : ''}>Hour (for services)</option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Harga Pokok (Standard Cost)</label>
            <input type="number" name="standardCost" class="form-input" 
                   value="${item.standardCost || 0}" 
                   placeholder="0" min="0" step="0.01">
            <small class="text-gray">Harga pokok per satuan</small>
          </div>

          <div class="form-group">
            <label class="form-label">Harga Jual (Selling Price)</label>
            <input type="number" name="sellingPrice" class="form-input" 
                   value="${item.sellingPrice || 0}" 
                   placeholder="0" min="0" step="0.01">
            <small class="text-gray">Harga jual per satuan</small>
          </div>
        </div>

        <div class="form-group" style="padding: 12px; border: 1px solid var(--color-primary, #1976d2); border-radius: var(--radius-md); background: rgba(25,118,210,0.04); margin-bottom: 20px;">
          <label class="form-label" style="display: flex; align-items: center; gap: 8px; font-weight: bold; margin-bottom: 12px; color: var(--color-primary, #1976d2);">
            🏷️ Akun GL Persediaan (untuk Jurnal Otomatis)
          </label>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Kode Akun Inventori</label>
              <input type="text" name="inventoryAccount" class="form-input" 
                     value="${item.inventoryAccount || ''}" 
                     placeholder="Contoh: 1154 (kosongkan jika pakai default)">
              <small class="text-gray">Kode akun COA yang di-debit saat PO diterima. Jika kosong, sistem pakai default dari Settings.</small>
            </div>
            <div class="form-group">
              <label class="form-label">Preview Akun</label>
              <div id="item-account-preview" style="padding: 8px; border: 1px solid var(--color-gray-800); border-radius: var(--radius-md); font-family: monospace; background: var(--bg-tertiary, #1e1e1e); min-height: 36px; font-size:13px;">
                ${item.inventoryAccount ? `<strong>${item.inventoryAccount}</strong> — ${this.getAccountName(item.inventoryAccount)}` : '<span style="opacity:0.5">— gunakan default mapping —</span>'}
              </div>
            </div>
          </div>
        </div>

        <div class="form-group" style="padding: 12px; border: 1px solid var(--color-gray-800); border-radius: var(--radius-md); background: rgba(255,255,255,0.02); margin-bottom: 20px;">
          <label class="form-label" style="display: flex; align-items: center; gap: 8px; font-weight: bold; margin-bottom: 12px;">
            <input type="checkbox" name="trackStock" ${item.trackStock ? 'checked' : ''} onchange="const rs = document.getElementById('reorder-section'); rs.style.display = this.checked ? 'block' : 'none';">
            Track Inventory (Lacak stok barang ini)
          </label>
          
          <div id="reorder-section" style="display: ${item.trackStock ? 'block' : 'none'}; border-top: 1px solid var(--color-gray-800); padding-top: 12px;">
            <h4 style="margin: 0 0 12px 0; color: var(--color-primary-light);">🔄 Automated Reorder Settings</h4>
            
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Reorder Point</label>
                <input type="number" name="reorderPoint" class="form-input" value="${item.reorderPoint || 0}" min="0">
                <small class="text-gray">Triggers reorder at this stock level</small>
              </div>
              <div class="form-group">
                <label class="form-label">Min Stock (Safety)</label>
                <input type="number" name="minStock" class="form-input" value="${item.minStock || 0}" min="0">
                <small class="text-gray">Absolute minimum stock</small>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Max Stock (Capacity)</label>
                <input type="number" name="maxStock" class="form-input" value="${item.maxStock || 0}" min="0">
              </div>
              <div class="form-group">
                <label class="form-label">EOQ (Ideal Qty)</label>
                <input type="number" name="eoq" class="form-input" value="${item.eoq || 0}" min="0">
                <small class="text-gray">Economic Order Quantity</small>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Lead Time (Days)</label>
                <input type="number" name="leadTimeDays" class="form-input" value="${item.leadTimeDays || 7}" min="0">
              </div>
              <div class="form-group">
                <label class="form-label">Preferred Supplier</label>
                <select name="preferredSupplier" class="form-select">
                  <option value="">-- Select Supplier (Optional) --</option>
                  ${(Storage.getSuppliers() || []).map(s => `
                    <option value="${s.id}" ${item.preferredSupplier === s.id ? 'selected' : ''}>
                      ${s.code} - ${s.name}
                    </option>
                  `).join('')}
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">
                <input type="checkbox" name="autoReorder" ${item.autoReorder ? 'checked' : ''}>
                Enable Auto-PR (Buat PR otomatis saat stok rendah)
              </label>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Deskripsi/Catatan</label>
          <textarea name="description" class="form-textarea" rows="3" 
                    placeholder="Deskripsi barang atau catatan tambahan">${item.description || ''}</textarea>
        </div>

        <div class="flex justify-between align-center">
          ${this._editMode ? `
            <button type="button" class="btn btn-secondary" onclick="MasterItem.cancelEdit()">
              Batal Edit
            </button>
          ` : '<div></div>'}
          <button type="submit" class="btn btn-success">
            💾 ${this._editMode ? 'Update' : 'Simpan'} Barang
          </button>
        </div>
      </form>
    `;
  },

  renderList() {
    if (this.items.length === 0) {
      return '<p class="text-center text-gray">Belum ada barang. Tambahkan barang pertama Anda!</p>';
    }

    return `
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Kode</th>
              <th>Nama Barang</th>
              <th>Kategori</th>
              <th>Satuan</th>
              <th class="text-right">Harga Pokok</th>
              <th class="text-right">Harga Jual</th>
              <th class="text-center">Track Stock</th>
              <th>Akun GL</th>
              <th class="text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${this.items.map(item => `
              <tr>
                <td><span class="badge badge-primary">${item.code}</span></td>
                <td><strong>${item.name}</strong></td>
                <td>${this.getCategoryLabel(item.category)}</td>
                <td>${item.uom.toUpperCase()}</td>
                <td class="text-right">${this.formatCurrency(item.standardCost || 0)}</td>
                <td class="text-right">${this.formatCurrency(item.sellingPrice || 0)}</td>
                <td class="text-center">${item.trackStock ? '✓' : '-'}</td>
                <td style="font-family:monospace;font-size:12px;">
                  ${item.inventoryAccount
        ? `<span class="badge badge-primary">${item.inventoryAccount}</span>`
        : '<span style="opacity:0.4">—default—</span>'}
                </td>
                <td class="text-center">
                  <button class="btn btn-sm btn-primary" onclick="MasterItem.editItem('${item.id}')" title="Edit">
                    ✏️
                  </button>
                  <button class="btn btn-sm btn-danger" onclick="MasterItem.confirmDelete('${item.id}')" title="Hapus">
                    🗑️
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  getCategoryLabel(category) {
    const labels = {
      raw_materials: 'Bahan Baku',
      wip: 'WIP',
      finished_goods: 'Barang Jadi (Umum)',
      finished_goods_cert: 'Barang Jadi (Sertifikat)',
      finished_goods_noncert: 'Barang Jadi (Polos)',
      services: 'Jasa',
      consumables: 'Consumables'
    };
    return labels[category] || category;
  },

  handleSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.target);

    const itemData = {
      code: formData.get('code'),
      name: formData.get('name'),
      category: formData.get('category'),
      uom: formData.get('uom'),
      standardCost: parseFloat(formData.get('standardCost')) || 0,
      sellingPrice: parseFloat(formData.get('sellingPrice')) || 0,
      trackStock: formData.get('trackStock') === 'on',
      inventoryAccount: formData.get('inventoryAccount') || '',
      reorderPoint: parseFloat(formData.get('reorderPoint')) || 0,
      minStock: parseFloat(formData.get('minStock')) || 0,
      maxStock: parseFloat(formData.get('maxStock')) || 0,
      eoq: parseFloat(formData.get('eoq')) || 0,
      leadTimeDays: parseInt(formData.get('leadTimeDays')) || 0,
      preferredSupplier: formData.get('preferredSupplier') || null,
      autoReorder: formData.get('autoReorder') === 'on',
      description: formData.get('description'),
    };

    // Validation: Reorder logic
    if (itemData.trackStock) {
      // If auto-reorder is enabled, reorder point is required
      if (itemData.autoReorder && itemData.reorderPoint <= 0) {
        this.showAlert('error', 'Reorder Point harus diisi jika Auto-Reorder diaktifkan');
        return;
      }

      // Validate stock level hierarchy: minStock <= reorderPoint <= maxStock
      if (itemData.minStock > 0 && itemData.reorderPoint > 0 && itemData.minStock > itemData.reorderPoint) {
        this.showAlert('error', 'Min Stock tidak boleh lebih besar dari Reorder Point');
        return;
      }

      if (itemData.reorderPoint > 0 && itemData.maxStock > 0 && itemData.reorderPoint > itemData.maxStock) {
        this.showAlert('error', 'Reorder Point tidak boleh lebih besar dari Max Stock');
        return;
      }

      if (itemData.minStock > 0 && itemData.maxStock > 0 && itemData.minStock > itemData.maxStock) {
        this.showAlert('error', 'Min Stock tidak boleh lebih besar dari Max Stock');
        return;
      }

      // Validate EOQ
      if (itemData.eoq > 0 && itemData.maxStock > 0 && itemData.eoq > itemData.maxStock) {
        this.showAlert('error', 'EOQ tidak boleh lebih besar dari Max Stock');
        return;
      }
    }

    try {
      if (this._editMode && this._editingId) {
        // Update existing item
        const success = Storage.updateItem(this._editingId, {
          ...itemData,
          id: this._editingId,
          updatedAt: new Date().toISOString(),
        });

        if (success) {
          this.showAlert('success', 'Barang berhasil diupdate!');
          this.cancelEdit();
        } else {
          this.showAlert('error', 'Barang tidak ditemukan');
        }
      } else {
        // Create new item
        const newItem = {
          ...itemData,
          id: `ITEM-${Date.now()}`,
          createdAt: new Date().toISOString(),
        };

        Storage.addItem(newItem);
        this.showAlert('success', 'Barang berhasil ditambahkan!');
        document.getElementById('item-form').reset();
      }

      this.loadItems();
      this.render();
    } catch (error) {
      this.showAlert('error', error.message);
    }
  },

  editItem(id) {
    this._editMode = true;
    this._editingId = id;
    this.render();
    document.getElementById('item-form').scrollIntoView({ behavior: 'smooth' });
  },

  cancelEdit() {
    this._editMode = false;
    this._editingId = null;
    this.render();
  },

  confirmDelete(id) {
    const item = this.items.find(i => i.id === id);
    if (!item) return;

    if (confirm(`Hapus barang "${item.name}"?\n\nData yang sudah dihapus tidak dapat dikembalikan.`)) {
      Storage.deleteItem(id);
      this.loadItems();
      this.render();
      this.showAlert('success', 'Barang berhasil dihapus');
    }
  },

  exportToCSV() {
    if (this.items.length === 0) {
      alert('Tidak ada data untuk diexport');
      return;
    }

    const headers = ['Kode', 'Nama', 'Kategori', 'Satuan', 'Harga Pokok', 'Harga Jual', 'Track Stock', 'Deskripsi'];
    const rows = this.items.map(i => [
      i.code,
      i.name,
      this.getCategoryLabel(i.category),
      i.uom,
      i.standardCost || 0,
      i.sellingPrice || 0,
      i.trackStock ? 'Yes' : 'No',
      i.description || ''
    ]);

    let csv = headers.join(',') + '\n';
    rows.forEach(row => {
      csv += row.map(cell => `"${cell}"`).join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `items-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },

  formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  },

  downloadImportTemplate() {
    const headers = ['Code', 'Name', 'Category', 'UOM', 'Cost', 'Price', 'Stock (TRUE/FALSE)', 'Description'];
    const sample = ['GOLD-BAR-999', 'Gold Bar 24K (Sample)', 'finished_goods', 'gram', '1000000', '1050000', 'TRUE', 'Sample item description'];
    const instructions = [
      '', '# CATEGORY GUIDE:',
      '# raw_materials: Bahan Baku',
      '# wip: Barang Dalam Proses',
      '# finished_goods: Barang Jadi',
      '# services: Jasa',
      '# consumables: Consumables'
    ];

    let csv = headers.join(',') + '\n';
    csv += sample.map(cell => `"${cell}"`).join(',') + '\n';
    csv += instructions.join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `template-import-barang.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },

  async importFromCSV(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target.result;
      const lines = text.split('\n');
      const items = [];
      const user = Auth.getCurrentUser();
      const userRole = user ? user.role : '';

      // Skip header and process lines
      for (let i = 1; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line || line.startsWith('#')) continue;

        // Auto-detect if Excel wrapped the entire line in quotes (happens when all data is in Column A)
        if (line.startsWith('"') && line.endsWith('"') && line.indexOf(',') > 0) {
          // Check if it's truly a single column wrap (no unescaped commas outside quotes)
          // The easiest way is to try stripping the outer quotes and replacing "" with "
          const unwrapped = line.substring(1, line.length - 1).replace(/""/g, '"');
          // If the unwrapped version splits better, use it
          if (unwrapped.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).length > line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).length) {
            line = unwrapped;
          }
        }

        // Support both comma and semicolon delimiters
        const delimiter = line.includes(';') && !line.includes(',') ? ';' : ',';
        const splitRegex = delimiter === ';' ? /;(?=(?:(?:[^"]*"){2})*[^"]*$)/ : /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;

        let parts = line.split(splitRegex).map(p => p.trim().replace(/^"|"$/g, ''));
        
        if (parts.length < 4) {
          console.warn(`Skipping line ${i+1}: Not enough columns (${parts.length}). Line:`, line);
          continue;
        }

        const [code, name, category, uom, cost, price, stock, description] = parts;

        // Validation 1: Role vs Category
        if (!this.validateCategoryRole(category, userRole)) {
          console.warn(`Skipping item ${code}: Role ${userRole} is not authorized for category ${category}`);
          continue;
        }

        // Validation 2: Code must be unique
        if (this.getItem(code)) {
          console.warn(`Skipping item ${code}: Code already exists`);
          continue;
        }

        items.push({
          id: 'ITEM-' + Date.now() + Math.floor(Math.random() * 1000),
          code,
          name,
          category,
          uom,
          standardCost: Number(cost) || 0,
          sellingPrice: Number(price) || 0,
          trackStock: stock.toUpperCase() === 'TRUE',
          description: description || '',
          createdAt: new Date().toISOString(),
          createdBy: user ? user.uid : 'system'
        });
      }

      if (items.length === 0) {
        alert('Tidak ada data baru yang valid untuk diimport.');
        return;
      }

      if (confirm(`Import ${items.length} item baru?`)) {
        const existingData = Storage.get(Storage.KEYS.ITEMS) || [];
        const newData = [...existingData, ...items];
        await Storage.set(Storage.KEYS.ITEMS, newData);

        // Log to Audit
        AuditLog.log('import', 'items', items.length + ' items', `Bulk import ${items.length} items from CSV`);

        this.loadItems();
        this.render();
        this.showAlert('success', `Berhasil mengimport ${items.length} item.`);
      }

      // Reset input
      input.value = '';
    };
    reader.readAsText(file);
  },

  validateCategoryRole(category, role) {
    // Admin & Director can do everything
    if (role === 'ADMIN' || role === 'director' || role === 'manager_finance') return true;

    const mapping = {
      'raw_materials': ['purchasing_head', 'PRODUCTION'],
      'wip': ['PRODUCTION'],
      'finished_goods': ['SALES', 'PRODUCTION'],
      'finished_goods_cert': ['SALES', 'PRODUCTION'],
      'finished_goods_noncert': ['SALES', 'PRODUCTION'],
      'services': ['ADMIN', 'director', 'manager_finance'],
      'consumables': ['WAREHOUSE_STAFF', 'PRODUCTION']
    };

    const allowedRoles = mapping[category] || [];
    return allowedRoles.includes(role);
  },

  generateItemCode(onlyIfEmpty = false) {
    const categorySelect = document.querySelector('select[name="category"]');
    const codeInput = document.querySelector('input[name="code"]');

    if (!categorySelect || !codeInput) return;

    // If onlyIfEmpty is true, don't overwrite if user already typed something
    if (onlyIfEmpty && codeInput.value.trim() !== '') return;

    const category = categorySelect.value;
    if (!category) return;

    // 1. Determine Prefix based on Best Practice
    let prefix = 'ITM';
    switch (category) {
      case 'raw_materials': prefix = 'RM'; break; // Raw Material
      case 'wip': prefix = 'WP'; break;           // Wipe / Work in Process
      case 'finished_goods':
      case 'finished_goods_cert':
      case 'finished_goods_noncert':
        prefix = 'FG'; break;                   // Finished Goods
      case 'services': prefix = 'SV'; break;      // Services
      case 'consumables': prefix = 'CM'; break;   // Consumables
      default: prefix = 'GEN';
    }

    // 2. Determine Material Group (Optional - currently generic)
    // In future, this could come from a 'Material Type' dropdown
    const group = 'GEN';

    // 3. Find next sequence number
    // Filter items with same prefix to find the max number
    const regex = new RegExp(`^${prefix}-${group}-(\\d{4})$`);
    let maxSeq = 0;

    this.items.forEach(item => {
      const match = item.code.match(regex);
      if (match) {
        const num = parseInt(match[1]);
        if (num > maxSeq) maxSeq = num;
      }
    });

    const nextSeq = String(maxSeq + 1).padStart(4, '0');

    // 4. Set the code
    codeInput.value = `${prefix}-${group}-${nextSeq}`;
  },

  showAlert(type, message) {
    if (typeof ChartOfAccounts !== 'undefined') {
      ChartOfAccounts.showAlert(type, message);
    } else {
      alert(message);
    }
  },

  // Lookup account name from Chart of Accounts
  getAccountName(code) {
    if (!code) return '';
    const accounts = Storage.get(Storage.KEYS.CHART_OF_ACCOUNTS) || [];
    const account = accounts.find(a => a.code === code || String(a.code) === String(code));
    return account ? account.name : '(akun tidak ditemukan)';
  },

  showBulkEditAccountModal() {
    const modal = document.getElementById('bulk-edit-account-modal');
    if (modal) modal.classList.remove('hidden');
    // Style it if needed
    if (modal) modal.style.display = 'flex';
  },

  hideBulkEditAccountModal() {
    const modal = document.getElementById('bulk-edit-account-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.style.display = 'none';
    }
  },

  async bulkEditAccounts(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const newAccount = formData.get('newInventoryAccount').trim();

    const confirm_msg = newAccount
      ? `Set kode akun GL "${newAccount}" ke semua ${this.items.length} barang?\n\nIni akan menimpa akun GL yang sudah ada.`
      : `Hapus/kosongkan kode akun GL dari semua ${this.items.length} barang?\n\nJika dikosongkan, sistem akan gunakan default dari Settings.`;

    if (!confirm(confirm_msg)) return;

    // Update all items
    const updatedItems = this.items.map(item => ({
      ...item,
      inventoryAccount: newAccount
    }));

    await Storage.set(Storage.KEYS.ITEMS, updatedItems);

    this.hideBulkEditAccountModal();
    this.loadItems();
    this.render();
    this.showAlert('success', `✅ Berhasil mengupdate akun GL untuk ${updatedItems.length} barang!`);

    if (typeof AuditLog !== 'undefined') {
      AuditLog.log('update', 'items', 'bulk', `Bulk set inventoryAccount to "${newAccount}"`);
    }
  },
};

window.MasterItem = MasterItem;
