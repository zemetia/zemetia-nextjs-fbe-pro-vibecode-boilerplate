// ==========================================
// Stock Card Module - Per Item Movement Tracking
// Track IN/OUT/BALANCE for inventory items
// ==========================================

const StockCard = {
  items: [],
  warehouses: [],
  transactions: [],
  selectedItem: null,
  selectedWarehouse: 'ALL',
  startDate: new Date(new Date().setDate(1)).toISOString().split('T')[0], // First day of month
  endDate: new Date().toISOString().split('T')[0], // Today

  init() {
    if (!Auth.isAuthenticated()) {
      window.location.href = 'login.html';
      return;
    }

    this.loadData();
    this.render();
  },

  loadData() {
    this.items = Storage.getItems();
    this.warehouses = Storage.getWarehouses();
    this.transactions = this.getStockTransactions();
  },

  getStockTransactions() {
    // Get all journal entries that affect inventory
    const journals = Storage.get(Storage.KEYS.JOURNAL_ENTRIES) || [];
    const inventoryAccounts = ['1151', '1152', '1153', '1154', '1155', '1156', '1181', '1182', '1183', '1184', '1185'];

    const stockTransactions = [];

    journals.forEach(journal => {
      journal.lines.forEach(line => {
        if (inventoryAccounts.includes(line.accountCode)) {
          stockTransactions.push({
            date: journal.date,
            refNo: journal.referenceNumber,
            description: journal.description,
            accountCode: line.accountCode,
            accountName: line.description,
            debit: line.debit || 0,
            credit: line.credit || 0,
            type: line.debit > 0 ? 'IN' : 'OUT'
          });
        }
      });
    });

    return stockTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));
  },

  render() {
    const content = document.getElementById('main-content');
    content.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">📦 Stock Card</h1>
        <p class="page-description">Track per-item inventory movement (IN/OUT/BALANCE)</p>
      </div>

      <div class="card mb-3">
        <div class="card-header">
          <h2 class="card-title">Filters</h2>
        </div>
        <div class="card-body">
          ${this.renderFilters()}
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Stock Movement</h2>
          <div class="btn-group">
            <button class="btn btn-secondary" onclick="StockCard.exportToPDF()">
              📄 Export PDF
            </button>
            <button class="btn btn-secondary" onclick="StockCard.exportToCSV()">
              📊 Export CSV
            </button>
          </div>
        </div>
        <div class="card-body">
          ${this.renderMovement()}
        </div>
      </div>
    `;
  },

  renderFilters() {
    // Get unique owners from stock movements
    const movements = Storage.get('WAREHOUSE_STOCK_MOVEMENTS') || [];
    const owners = [...new Set(movements.map(m => m.ownerId || 'COMPANY'))];

    return `
      <form onsubmit="StockCard.handleFilter(event)">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Item</label>
            <select name="item" class="form-select" onchange="StockCard.handleItemChange(this.value)">
              <option value="">-- Select Item --</option>
              ${this.items.map(item => `
                <option value="${item.code}" ${this.selectedItem === item.code ? 'selected' : ''}>
                  ${item.code} - ${item.name}
                </option>
              `).join('')}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Warehouse</label>
            <select name="warehouse" class="form-select" onchange="StockCard.handleWarehouseChange(this.value)">
              <option value="ALL">All Warehouses</option>
              ${this.warehouses.map(wh => `
                <option value="${wh.code}" ${this.selectedWarehouse === wh.code ? 'selected' : ''}>
                  ${wh.code} - ${wh.name}
                </option>
              `).join('')}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Owner</label>
            <select name="owner" class="form-select" onchange="StockCard.handleOwnerChange(this.value)">
              <option value="ALL">All Owners</option>
              <option value="COMPANY" ${this.selectedOwner === 'COMPANY' ? 'selected' : ''}>COMPANY</option>
              ${owners.filter(o => o !== 'COMPANY').map(owner => `
                <option value="${owner}" ${this.selectedOwner === owner ? 'selected' : ''}>${owner}</option>
              `).join('')}
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Start Date</label>
            <input type="date" name="startDate" class="form-input" 
                   value="${this.startDate}" 
                   onchange="StockCard.handleDateChange('start', this.value)">
          </div>

          <div class="form-group">
            <label class="form-label">End Date</label>
            <input type="date" name="endDate" class="form-input" 
                   value="${this.endDate}"
                   onchange="StockCard.handleDateChange('end', this.value)">
          </div>
        </div>
      </form>
    `;
  },

  renderMovement() {
    if (!this.selectedItem) {
      return '<p class="text-center text-gray">Please select an item to view stock card</p>';
    }

    const item = this.items.find(i => i.code === this.selectedItem);
    if (!item) return '<p class="text-center text-gray">Item not found</p>';

    // Filter transactions for selected item and date range
    const movements = this.calculateMovements();

    if (movements.length === 0) {
      return '<p class="text-center text-gray">No movement in selected period</p>';
    }

    return `
      <div style="margin-bottom: 16px; padding: 12px; background: var(--bg-tertiary); border-radius: 8px;">
        <strong>Item:</strong> ${item.code} - ${item.name} | 
        <strong>UOM:</strong> ${item.uom} | 
        <strong>Warehouse:</strong> ${this.selectedWarehouse} |
        <strong>Owner:</strong> ${this.selectedOwner || 'ALL'} |
        <strong>Period:</strong> ${this.startDate} to ${this.endDate}
      </div>

      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Ref No</th>
              <th>Owner</th>
              <th>Type</th>
              <th>Description</th>
              <th class="text-right">IN</th>
              <th class="text-right">OUT</th>
              <th class="text-right">Balance</th>
              <th class="text-right">Value</th>
            </tr>
          </thead>
          <tbody>
            ${movements.map(mov => `
              <tr>
                <td>${new Date(mov.date).toLocaleDateString('id-ID')}</td>
                <td><span class="badge badge-primary">${mov.refNo}</span></td>
                <td><span class="badge ${mov.ownerId === 'COMPANY' ? 'badge-primary' : 'badge-warning'}">${mov.ownerId || 'COMPANY'}</span></td>
                <td>
                  <span class="badge ${mov.type === 'IN' ? 'badge-success' : 'badge-danger'}">
                    ${mov.type}
                  </span>
                </td>
                <td>${mov.description}</td>
                <td class="text-right">${mov.in > 0 ? this.formatQty(mov.in) : '-'}</td>
                <td class="text-right">${mov.out > 0 ? this.formatQty(mov.out) : '-'}</td>
                <td class="text-right"><strong>${this.formatQty(mov.balance)}</strong></td>
                <td class="text-right">${this.formatCurrency(mov.value)}</td>
              </tr>
            `).join('')}
            <tr style="background: var(--bg-tertiary); font-weight: bold;">
              <td colspan="5" class="text-right">CLOSING BALANCE:</td>
              <td class="text-right">${this.formatQty(movements[movements.length - 1]?.totalIn || 0)}</td>
              <td class="text-right">${this.formatQty(movements[movements.length - 1]?.totalOut || 0)}</td>
              <td class="text-right">${this.formatQty(movements[movements.length - 1]?.balance || 0)}</td>
              <td class="text-right">${this.formatCurrency(movements[movements.length - 1]?.value || 0)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  },

  calculateMovements() {
    // UPDATED: Use actual stock movements from WarehouseStock module
    const item = this.items.find(i => i.code === this.selectedItem);
    if (!item) return [];

    // Get actual movements from WarehouseStock module
    const warehouseCode = this.selectedWarehouse === 'ALL' ? null : this.selectedWarehouse;
    const ownerId = this.selectedOwner === 'ALL' ? null : this.selectedOwner;

    try {
      const movements = WarehouseStock.getStockCard(
        this.selectedItem,
        warehouseCode,
        this.startDate,
        this.endDate,
        ownerId
      );

      // Transform to expected format
      return movements.map(mov => ({
        date: mov.date,
        refNo: mov.referenceNumber,
        type: mov.type,
        ownerId: mov.ownerId,
        description: `${mov.type} movement - ${mov.referenceNumber}`,
        in: mov.type === 'IN' ? mov.quantity : 0,
        out: mov.type === 'OUT' ? mov.quantity : 0,
        balance: mov.balanceQty,
        value: mov.balanceValue,
        totalIn: movements.filter(m => m.type === 'IN').reduce((sum, m) => sum + m.quantity, 0),
        totalOut: movements.filter(m => m.type === 'OUT').reduce((sum, m) => sum + m.quantity, 0)
      }));
    } catch (error) {
      console.error('Error loading stock movements:', error);
      // Fallback to empty if WarehouseStock not available
      return [];
    }
  },

  handleItemChange(itemCode) {
    this.selectedItem = itemCode;
    this.render();
  },

  handleWarehouseChange(warehouseCode) {
    this.selectedWarehouse = warehouseCode;
    this.render();
  },

  handleOwnerChange(ownerId) {
    this.selectedOwner = ownerId;
    this.render();
  },

  handleDateChange(type, value) {
    if (type === 'start') this.startDate = value;
    else this.endDate = value;
    this.render();
  },

  formatQty(qty) {
    return new Intl.NumberFormat('id-ID', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(qty);
  },

  formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  },

  exportToCSV() {
    if (!this.selectedItem) {
      alert('Please select an item first');
      return;
    }

    const item = this.items.find(i => i.code === this.selectedItem);
    const movements = this.calculateMovements();

    const headers = ['Date', 'Ref No', 'Type', 'Description', 'IN', 'OUT', 'Balance', 'Value'];
    const rows = movements.map(m => [
      new Date(m.date).toLocaleDateString('id-ID'),
      m.refNo,
      m.type,
      m.description,
      m.in,
      m.out,
      m.balance,
      m.value
    ]);

    let csv = `Stock Card - ${item.code} - ${item.name}\n`;
    csv += `Period: ${this.startDate} to ${this.endDate}\n\n`;
    csv += headers.join(',') + '\n';
    rows.forEach(row => {
      csv += row.map(cell => `"${cell}"`).join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock-card-${item.code}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },

  exportToPDF() {
    alert('PDF export will be implemented with jsPDF');
  }
};


// Explicitly make StockCard globally available
window.StockCard = StockCard;
