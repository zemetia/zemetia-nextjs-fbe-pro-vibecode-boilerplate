// ==========================================
// Journal Report Module
// Laporan Jurnal dengan Sortable Columns
// ==========================================

const JournalReport = {
    entries: [],
    filteredEntries: [],
    _filterStartDate: null,
    _filterEndDate: null,
    _sortColumn: 'date',
    _sortDirection: 'desc', // 'asc' or 'desc'
    _expandedRows: new Set(),

    init() {
        this.loadEntries();
        this.render();
    },

    loadEntries() {
        this.entries = Storage.get(Storage.KEYS.JOURNAL_ENTRIES) || [];
        this.filteredEntries = [...this.entries];
    },

    applyFilters() {
        let filtered = [...this.entries];

        // Apply date filter
        if (this._filterStartDate && this._filterEndDate) {
            filtered = filtered.filter(entry => {
                const entryDate = new Date(entry.date);
                const startDate = new Date(this._filterStartDate);
                const endDate = new Date(this._filterEndDate);
                return entryDate >= startDate && entryDate <= endDate;
            });
        }

        this.filteredEntries = filtered;
        this.applySort();
    },

    applySort() {
        const column = this._sortColumn;
        const direction = this._sortDirection;
        const multiplier = direction === 'asc' ? 1 : -1;

        this.filteredEntries.sort((a, b) => {
            let valA, valB;

            switch (column) {
                case 'date':
                    valA = new Date(a.date);
                    valB = new Date(b.date);
                    return (valA - valB) * multiplier;

                case 'reference':
                    valA = (a.reference || '').toLowerCase();
                    valB = (b.reference || '').toLowerCase();
                    return valA.localeCompare(valB) * multiplier;

                case 'type':
                    valA = (a.transactionType || '').toLowerCase();
                    valB = (b.transactionType || '').toLowerCase();
                    return valA.localeCompare(valB) * multiplier;

                case 'description':
                    valA = (a.description || '').toLowerCase();
                    valB = (b.description || '').toLowerCase();
                    return valA.localeCompare(valB) * multiplier;

                case 'amount':
                    valA = a.totalDebit || 0;
                    valB = b.totalDebit || 0;
                    return (valA - valB) * multiplier;

                default:
                    return 0;
            }
        });
    },

    setSortColumn(column) {
        if (this._sortColumn === column) {
            // Toggle direction if clicking same column
            this._sortDirection = this._sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            // New column, default to ascending
            this._sortColumn = column;
            this._sortDirection = 'asc';
        }
        this.applySort();
        this.renderTable();
    },

    toggleRowDetail(entryId) {
        if (this._expandedRows.has(entryId)) {
            this._expandedRows.delete(entryId);
        } else {
            this._expandedRows.add(entryId);
        }
        this.renderTable();
    },

    handleFilterSubmit(event) {
        event.preventDefault();
        const formData = new FormData(event.target);
        this._filterStartDate = formData.get('startDate');
        this._filterEndDate = formData.get('endDate');
        this.applyFilters();
        this.renderTable();
    },

    clearFilter() {
        this._filterStartDate = null;
        this._filterEndDate = null;
        const today = new Date().toISOString().split('T')[0];
        const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        document.querySelector('[name="startDate"]').value = firstDayOfMonth;
        document.querySelector('[name="endDate"]').value = today;
        this.applyFilters();
        this.renderTable();
    },

    exportToPDF() {
        const config = Storage.get(Storage.KEYS.CONFIG);
        PDFExporter.exportJournalEntries(
            this.filteredEntries,
            config,
            this._filterStartDate,
            this._filterEndDate
        );
    },

    render() {
        const content = document.getElementById('main-content');
        const today = new Date().toISOString().split('T')[0];
        const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

        content.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">📊 Laporan Jurnal</h1>
        <p class="page-description">Laporan jurnal umum dengan fitur sortir dan filter</p>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Filter & Export</h2>
        </div>
        <div class="card-body">
          <form id="journal-report-filter" class="mb-2" onsubmit="JournalReport.handleFilterSubmit(event)">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Dari Tanggal</label>
                <input type="date" name="startDate" class="form-input" value="${firstDayOfMonth}">
              </div>
              <div class="form-group">
                <label class="form-label">Sampai Tanggal</label>
                <input type="date" name="endDate" class="form-input" value="${today}">
              </div>
              <div class="form-group flex align-center">
                <button type="submit" class="btn btn-primary" style="margin-top: auto;">
                  🔍 Filter
                </button>
                <button type="button" class="btn btn-secondary" style="margin-top: auto;" onclick="JournalReport.clearFilter()">
                  ↺ Reset
                </button>
                <button type="button" class="btn btn-secondary" style="margin-top: auto;" onclick="JournalReport.exportToPDF()">
                  📄 Export PDF
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">
            Daftar Jurnal
            <span class="text-gray" style="font-size: var(--font-size-sm); font-weight: normal;">
              (${this.filteredEntries.length} entri)
            </span>
          </h2>
        </div>
        <div class="card-body">
          <div id="journal-report-table">
            ${this.renderTable()}
          </div>
        </div>
      </div>
    `;

        // Apply initial filters and sorting
        this.applyFilters();
    },

    renderTable() {
        const tableContainer = document.getElementById('journal-report-table');
        if (!tableContainer) return '';

        if (this.filteredEntries.length === 0) {
            tableContainer.innerHTML = '<p class="text-center text-gray">Tidak ada data jurnal untuk ditampilkan</p>';
            return;
        }

        const sortIcon = (column) => {
            if (this._sortColumn !== column) {
                return '<span class="sort-icon" style="opacity: 0.3;">⇅</span>';
            }
            return this._sortDirection === 'asc'
                ? '<span class="sort-icon">▲</span>'
                : '<span class="sort-icon">▼</span>';
        };

        const headerStyle = 'cursor: pointer; user-select: none; position: relative;';

        tableContainer.innerHTML = `
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th style="${headerStyle}" onclick="JournalReport.setSortColumn('date')">
                Tanggal ${sortIcon('date')}
              </th>
              <th style="${headerStyle}" onclick="JournalReport.setSortColumn('reference')">
                No. Referensi ${sortIcon('reference')}
              </th>
              <th style="${headerStyle}" onclick="JournalReport.setSortColumn('type')">
                Tipe ${sortIcon('type')}
              </th>
              <th style="${headerStyle}" onclick="JournalReport.setSortColumn('description')">
                Keterangan ${sortIcon('description')}
              </th>
              <th style="${headerStyle} text-align: right;" onclick="JournalReport.setSortColumn('amount')">
                Total ${sortIcon('amount')}
              </th>
              <th class="text-center" style="width: 100px;">Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${this.filteredEntries.map(entry => this.renderTableRow(entry)).join('')}
          </tbody>
        </table>
      </div>
    `;
    },

    renderTableRow(entry) {
        const isExpanded = this._expandedRows.has(entry.id);
        const expandIcon = isExpanded ? '▼' : '▶';

        return `
      <tr class="clickable-row" onclick="JournalReport.toggleRowDetail('${entry.id}')" style="cursor: pointer;">
        <td>${this.formatDate(entry.date)}</td>
        <td>${entry.reference || '-'}</td>
        <td>
          <span class="badge badge-secondary">${entry.transactionType || 'JRN'}</span>
        </td>
        <td>
          <span style="margin-right: 8px;">${expandIcon}</span>
          ${entry.description}
        </td>
        <td class="text-right">${this.formatCurrency(entry.totalDebit)}</td>
        <td class="text-center" onclick="event.stopPropagation()">
          <button class="btn btn-sm btn-secondary" onclick="JournalReport.viewDetails('${entry.id}')" title="Lihat Detail">
            👁️
          </button>
        </td>
      </tr>
      ${isExpanded ? this.renderDetailRow(entry) : ''}
    `;
    },

    renderDetailRow(entry) {
        return `
      <tr class="detail-row">
        <td colspan="6" style="background: var(--bg-primary); padding: var(--spacing-lg);">
          <div style="margin-bottom: var(--spacing-sm);">
            <strong>Detail Jurnal:</strong> ${entry.reference || '-'} | ${this.formatDate(entry.date)}
          </div>
          <table class="table" style="margin: 0; background: white; color: #111111;">
            <thead>
              <tr>
                <th style="width: 25%;">Kode Akun</th>
                <th style="width: 35%;">Nama Akun</th>
                <th style="width: 20%;">Keterangan</th>
                <th class="text-right" style="width: 10%;">Debit</th>
                <th class="text-right" style="width: 10%;">Kredit</th>
              </tr>
            </thead>
            <tbody>
              ${entry.lines.map(line => {
            const account = ChartOfAccounts.getAccount(line.accountCode);
            return `
                  <tr>
                    <td><code>${line.accountCode}</code></td>
                    <td>${account ? account.name : 'Unknown'}</td>
                    <td>${line.description || '-'}</td>
                    <td class="text-right">${line.debit > 0 ? this.formatCurrency(line.debit) : '-'}</td>
                    <td class="text-right">${line.credit > 0 ? this.formatCurrency(line.credit) : '-'}</td>
                  </tr>
                `;
        }).join('')}
            </tbody>
            <tfoot style="background: var(--bg-tertiary); font-weight: 600;">
              <tr>
                <td colspan="3" class="text-right">TOTAL:</td>
                <td class="text-right">${this.formatCurrency(entry.totalDebit)}</td>
                <td class="text-right">${this.formatCurrency(entry.totalCredit)}</td>
              </tr>
            </tfoot>
          </table>
        </td>
      </tr>
    `;
    },

    viewDetails(entryId) {
        // Navigate to journal entry page with this entry highlighted
        window.location.hash = '#journal-entry';
        setTimeout(() => {
            const detailRow = document.getElementById(`detail-${entryId}`);
            if (detailRow) {
                detailRow.classList.remove('hidden');
                detailRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 500);
    },

    formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    },

    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('id-ID', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    },
};


// Explicitly make JournalReport globally available
window.JournalReport = JournalReport;
