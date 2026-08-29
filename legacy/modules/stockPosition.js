// ==========================================
// Stock Position Module
// Current quantity per warehouse for all items
// ==========================================

const StockPosition = {
  items: [],
  warehouses: [],
  stockData: [],

  init() {
    if (!Auth.isAuthenticated()) {
      window.location.href = 'login.html';
      return;
    }

    this.loadData();
    this.calculateStockPosition();
    this.render();
  },

  loadData() {
    this.items = Storage.getItems();
    this.warehouses = Storage.getWarehouses();
    // Force refresh stock data from storage
    if (typeof WarehouseStock !== 'undefined' && WarehouseStock.initStock) {
      WarehouseStock.initStock();
    }
  },

  calculateStockPosition() {
    // UPDATED: Use actual stock positions from WarehouseStock module
    try {
      const positions = WarehouseStock.getStockPosition();

      // Transform to expected format
      const isRefineryOnly = Auth.getCurrentUser()?.reportProfile === 'refinery_only';
      
      if (isRefineryOnly) {
        this.stockData = [];
      } else {
        this.stockData = positions.map(pos => ({
          itemCode: pos.itemCode,
          itemName: pos.itemName,
          category: this.items.find(i => i.code === pos.itemCode)?.category || '',
          uom: this.items.find(i => i.code === pos.itemCode)?.uom || 'g',
          qty: pos.quantity,
          avgCost: pos.avgCost,
          value: pos.value
        }));
      }
    } catch (error) {
      console.error('Error loading stock position:', error);
      // Fallback to empty if WarehouseStock not available yet
      this.stockData = [];
    }
  },

  render() {
    const content = document.getElementById('main-content');
    content.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">📊 Stock Position</h1>
        <p class="page-description">Current stock quantity per item as of ${new Date().toLocaleDateString('id-ID')}</p>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Current Stock (${this.stockData.length} items)</h2>
          <div class="btn-group">
            <button class="btn btn-secondary" onclick="StockPosition.exportToCSV()">
              📊 Export CSV
            </button>
          </div>
        </div>
        <div class="card-body">
          ${this.renderTable()}
        </div>
      </div>
    `;
  },

  renderTable() {
    if (this.stockData.length === 0) {
      return '<p class="text-center text-gray">No stock available</p>';
    }

    const totalValue = this.stockData.reduce((sum, item) => sum + item.value, 0);

    return `
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Item Code</th>
              <th>Item Name</th>
              <th>Category</th>
              <th>Owner</th>
              <th>UOM</th>
              <th class="text-right">Quantity</th>
              <th class="text-right">Avg Cost</th>
              <th class="text-right">Total Value</th>
            </tr>
          </thead>
          <tbody>
            ${this.stockData.map(item => {
      let ownerLabel = item.ownerId === 'COMPANY' ? '<span class="badge badge-primary">COMPANY</span>' : `<span class="badge badge-warning">CUSTOMER: ${item.ownerId}</span>`;

      // Try to find customer name
      const customers = Storage.getCustomers();
      const customer = customers.find(c => c.id === item.ownerId);
      if (customer) {
        ownerLabel = `<span class="badge badge-warning" title="${customer.name}">CUST: ${customer.name}</span>`;
      }

      return `
                <tr>
                  <td><span class="badge badge-secondary">${item.itemCode}</span></td>
                  <td><strong>${item.itemName}</strong></td>
                  <td>${item.category || '-'}</td>
                  <td>${ownerLabel}</td>
                  <td>${item.uom}</td>
                  <td class="text-right">${this.formatQty(item.qty)}</td>
                  <td class="text-right">${this.formatCurrency(item.avgCost)}</td>
                  <td class="text-right">${this.formatCurrency(item.value)}</td>
                </tr>
              `;
    }).join('') || '<tr><td colspan="8" class="text-center">No stock available</td></tr>'}
            <tr style="background: var(--bg-tertiary); font-weight: bold;">
              <td colspan="7" class="text-right">TOTAL VALUE:</td>
              <td class="text-right">${this.formatCurrency(totalValue)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
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
    const headers = ['Item Code', 'Item Name', 'Category', 'UOM', 'Quantity', 'Avg Cost', 'Total Value'];
    const rows = this.stockData.map(item => [
      item.itemCode,
      item.itemName,
      item.category || '',
      item.uom,
      item.qty,
      item.avgCost,
      item.value
    ]);

    let csv = `Stock Position as of ${new Date().toISOString().split('T')[0]}\n\n`;
    csv += headers.join(',') + '\n';
    rows.forEach(row => {
      csv += row.map(cell => `"${cell}"`).join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock-position-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
};


// Explicitly make StockPosition globally available
window.StockPosition = StockPosition;
