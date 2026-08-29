// ==========================================
// Reports Menu Module
// Centralized navigation for all operational reports
// ==========================================

const ReportsMenu = {
  init() {
    if (!Auth.isAuthenticated()) {
      window.location.href = 'login.html';
      return;
    }

    this.render();
  },

  render() {
    const content = document.getElementById('main-content');
    content.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">📊 Reports Center</h1>
        <p class="page-description">Access all operational reports from one place</p>
      </div>

      ${this.renderReportCategories()}
    `;
  },

  renderReportCategories() {
    const categories = [
      {
        title: '📦 Stock Reports',
        icon: '📦',
        reports: [
          { id: 'stock-card', name: 'Stock Card', desc: 'Per-item movement tracking (IN/OUT/BALANCE)', status: 'active' },
          { id: 'stock-position', name: 'Stock Position', desc: 'Current quantity per warehouse', status: 'active' },
          { id: 'inventory-valuation', name: 'Inventory Valuation', desc: 'Total stock value', status: 'active' },
          { id: 'stock-movement', name: 'Stock Movement Summary', desc: 'All items movement', status: 'active' }
        ]
      },
      {
        title: '💰 Sales Reports',
        icon: '💰',
        reports: [
          { id: 'sales-register', name: 'Sales Register', desc: 'All sales transactions', status: 'active' },
          { id: 'sales-by-customer', name: 'Sales by Customer', desc: 'Customer ranking', status: 'active' },
          { id: 'sales-by-item', name: 'Sales by Item', desc: 'Best selling items', status: 'active' }
        ]
      },
      {
        title: '🛒 Purchase Reports',
        icon: '🛒',
        reports: [
          { id: 'purchase-register', name: 'Purchase Register', desc: 'All purchases', status: 'active' },
          { id: 'purchase-by-supplier', name: 'Purchase by Supplier', desc: 'Supplier analysis', status: 'active' },
          { id: 'purchase-by-item', name: 'Purchase by Item', desc: 'Most purchased items', status: 'active' }
        ]
      },
      {
        title: '💵 AR/AP Reports',
        icon: '💵',
        reports: [
          { id: 'ar-aging', name: 'AR Aging Report', desc: 'Outstanding receivables by aging', status: 'active' },
          { id: 'ap-aging', name: 'AP Aging Report', desc: 'Outstanding payables by aging', status: 'active' },
          { id: 'customer-balance', name: 'Customer Balance', desc: 'Current customer balances', status: 'active' },
          { id: 'supplier-balance', name: 'Supplier Balance', desc: 'Current supplier balances', status: 'active' }
        ]
      },
      {
        title: '⚜️ Gold-Specific Reports',
        icon: '⚜️',
        reports: [
          { id: 'receiving-report', name: 'Laporan Penerimaan Emas', desc: 'End-to-end tracking TTB & Lab', status: 'active' },
          { id: 'lab-test-register', name: 'Lab Test Register', desc: 'Gold pending lab test', status: 'active' },
          { id: 'production-wip', name: 'Production WIP Report', desc: 'Work in progress tracking', status: 'active' },
          { id: 'production-yield-report', name: 'Production Yield Analysis', desc: 'Input vs output analysis', status: 'active' },
          { id: 'gold-balance-report', name: 'Gold Balance Report', desc: 'Consolidated customer gold balances (Hutang/Piutang)', status: 'active' },
          { id: 'inventory-custody', name: 'Inventory vs Custody', desc: 'Pemisahan Aset Perusahaan (On-Balance) dengan Titipan Pelanggan (Off-Balance)', status: 'active' },
          { id: 'swap-analysis', name: 'Direct Swap Analysis', desc: 'Physical grammage comparison (In vs Out)', status: 'active' }
        ]
      },
      {
        title: '📑 Statutory & HR Compliance Reports',
        icon: '📑',
        reports: [
          { id: 'bpjs-tax-compliance', name: 'BPJS & Tax Compliance', desc: 'Rekonsiliasi Iuran BPJS Kes, BPJS TK, dan Pajak PPh 21 TER', status: 'active' },
          { id: 'payroll-simulation', name: 'Payroll Simulation & Audit', desc: 'Simulasi dan audit penggajian pra-closing', status: 'active' }
        ]
      }
    ];

    return categories.map(cat => `
      <div class="card mb-3">
        <div class="card-header">
          <h2 class="card-title">${cat.icon} ${cat.title}</h2>
        </div>
        <div class="card-body">
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px;">
            ${cat.reports.map(report => `
              <div style="padding: 16px; border: 1px solid #e0e0e0; border-radius: 8px; ${report.status === 'active' ? 'cursor: pointer;' : 'opacity: 0.6;'}" 
                   onclick="${report.status === 'active' ? `App.navigateTo('${report.id}')` : ''}">
                <h3 style="margin: 0 0 8px 0; font-size: 16px;">
                  ${report.name}
                  ${report.status === 'coming-soon' ? '<span class="badge badge-secondary" style="float: right;">Coming Soon</span>' : ''}
                </h3>
                <p style="margin: 0; font-size: 13px; color: #666;">${report.desc}</p>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `).join('');
  }
};


// Explicitly make ReportsMenu globally available
window.ReportsMenu = ReportsMenu;
