// ==========================================
// Journal Entry Module
// Modul Jurnal Umum dengan Double-Entry Bookkeeping
// ==========================================

const JournalEntry = {
  entries: [],
  currentEntry: { lines: [] },
  _idCounter: 0, // Counter to prevent ID collisions
  _editMode: false, // Track if we're in edit mode
  _editingEntryId: null, // ID of entry being edited
  _filterStartDate: null, // Filter start date
  _filterEndDate: null, // Filter end date

  init() {
    this.loadEntries();
    this.render();
  },

  loadEntries() {
    this.entries = Storage.get(Storage.KEYS.JOURNAL_ENTRIES) || [];
  },

  async saveEntries() {
    await Storage.set(Storage.KEYS.JOURNAL_ENTRIES, this.entries);
  },

  async createEntry(entryData) {
    // Validate debit = credit
    const totalDebit = entryData.lines.reduce((sum, line) => sum + (line.debit || 0), 0);
    const totalCredit = entryData.lines.reduce((sum, line) => sum + (line.credit || 0), 0);

    if (totalDebit !== totalCredit) {
      throw new Error(`Total Debit (${this.formatCurrency(totalDebit)}) harus sama dengan Total Kredit (${this.formatCurrency(totalCredit)})`);
    }

    if (totalDebit === 0) {
      throw new Error('Total transaksi tidak boleh nol');
    }

    // Generate unique ID using timestamp + counter + random
    this._idCounter++;
    const uniqueId = `${Date.now()}-${this._idCounter}-${Math.random().toString(36).substr(2, 9)}`;

    const entry = {
      id: uniqueId,
      date: entryData.date,
      description: entryData.description,
      reference: entryData.reference || '',
      lines: entryData.lines,
      totalDebit,
      totalCredit,
      createdAt: new Date().toISOString(),
    };

    this.entries.unshift(entry);
    this.saveEntries();

    // Update account balances
    this.updateAccountBalances(entry);

    return entry;
  },

  updateAccountBalances(entry) {
    entry.lines.forEach(line => {
      if (line.debit > 0) {
        ChartOfAccounts.updateBalance(line.accountCode, line.debit, 'debit');
      }
      if (line.credit > 0) {
        ChartOfAccounts.updateBalance(line.accountCode, line.credit, 'credit');
      }
    });
  },

  // Edit entry with reversal (SAK Compliant)
  editEntry(id) {
    const entry = this.entries.find(e => e.id === id);
    if (!entry) {
      throw new Error('Jurnal tidak ditemukan');
    }

    // Load entry data to form
    this.loadEntryToForm(entry);

    // Set edit mode
    this._editMode = true;
    this._editingEntryId = id;

    // Scroll to form
    document.getElementById('journal-entry-form').scrollIntoView({ behavior: 'smooth' });

    // Update UI to show edit mode
    this.updateEditModeUI();
  },

  loadEntryToForm(entry) {
    const form = document.getElementById('journal-entry-form');
    form.querySelector('[name="date"]').value = entry.date;
    form.querySelector('[name="reference"]').value = entry.reference || '';
    form.querySelector('[name="description"]').value = entry.description;

    // Clear existing lines
    const tbody = document.getElementById('journal-lines');
    tbody.innerHTML = '';

    // Add lines from entry
    entry.lines.forEach((line, index) => {
      tbody.innerHTML += this.renderJournalLine(index);
      const row = tbody.children[index];
      row.querySelector('[name="accountCode[]"]').value = line.accountCode;
      row.querySelector('[name="lineDescription[]"]').value = line.description || '';
      row.querySelector('[name="debit[]"]').value = line.debit || 0;
      row.querySelector('[name="credit[]"]').value = line.credit || 0;
    });

    this.updateTotals();
  },

  updateEditModeUI() {
    const form = document.getElementById('journal-entry-form');
    const cardHeader = form.closest('.card').querySelector('.card-header h2');

    if (this._editMode) {
      cardHeader.innerHTML = 'Edit Jurnal <span class="text-warning">(Mode Edit - Akan membuat reversal)</span>';
      form.querySelector('button[type="submit"]').innerHTML = '💾 Update Jurnal';
    } else {
      cardHeader.innerHTML = 'Buat Jurnal Baru';
      form.querySelector('button[type="submit"]').innerHTML = '💾 Simpan Jurnal';
    }
  },

  async deleteEntry(id) {
    const entry = this.entries.find(e => e.id === id);
    if (!entry) {
      throw new Error('Jurnal tidak ditemukan');
    }

    // Reverse account balances
    entry.lines.forEach(line => {
      if (line.debit > 0) {
        ChartOfAccounts.updateBalance(line.accountCode, -line.debit, 'debit');
      }
      if (line.credit > 0) {
        ChartOfAccounts.updateBalance(line.accountCode, -line.credit, 'credit');
      }
    });

    this.entries = this.entries.filter(e => e.id !== id);
    this.saveEntries();
  },

  render() {
    const content = document.getElementById('main-content');
    const today = new Date().toISOString().split('T')[0];
    const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    content.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Jurnal Umum (Journal Entry)</h1>
        <p class="page-description">Pencatatan transaksi dengan sistem double-entry bookkeeping</p>
      </div>

      <div class="card mb-3">
        <div class="card-header">
          <h2 class="card-title">Buat Jurnal Baru</h2>
        </div>
        <div class="card-body">
          ${this.renderEntryForm()}
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Daftar Jurnal</h2>
          <div class="btn-group">
            <button class="btn btn-secondary" onclick="JournalEntry.exportToPDF()">
              📄 Export PDF
            </button>
          </div>
        </div>
        <div class="card-body">
          <form id="journal-filter-form" class="mb-2" onsubmit="JournalEntry.applyFilter(event)">
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
                  Filter
                </button>
                <button type="button" class="btn btn-secondary" style="margin-top: auto;" onclick="JournalEntry.clearFilter()">
                  Reset
                </button>
              </div>
            </div>
          </form>
          <div id="journal-entries-list">
            ${this.renderEntriesList()}
          </div>
        </div>
      </div>
    `;

    this.attachEventListeners();
  },

  renderEntryForm() {
    const today = new Date().toISOString().split('T')[0];
    const accounts = ChartOfAccounts.getDetailAccounts();
    const transactionTypes = Storage.getTransactionTypes();

    return `
      <form id="journal-entry-form" onsubmit="JournalEntry.handleSubmit(event)">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label required">Tanggal</label>
            <input type="date" name="date" class="form-input" value="${today}" required>
          </div>
          
          <div class="form-group">
            <label class="form-label required">Jenis Transaksi</label>
            <select name="transactionType" id="transactionType" class="form-select" onchange="JournalEntry.updateReferenceNumber()" required>
              <option value="">Pilih Jenis...</option>
              ${transactionTypes.map(type => `
                <option value="${type.code}" ${type.code === 'JRN' ? 'selected' : ''}>${type.code} - ${type.name}</option>
              `).join('')}
            </select>
            <small class="text-gray">General journal entries</small>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label required">No. Referensi</label>
            <div style="display: flex; gap: var(--spacing-sm); align-items: center;">
              <input type="text" name="reference" id="referenceNumber" class="form-input" 
                     value="${Storage.previewNextReferenceNumber('JRN')}" readonly required>
              <label style="margin: 0; white-space: nowrap; font-size: var(--font-size-sm);">
                <input type="checkbox" id="manualOverride" onchange="JournalEntry.toggleManualOverride()"> Manual
              </label>
            </div>
            <small class="text-gray">Counter akan otomatis bertambah</small>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label required">Keterangan</label>
          <textarea name="description" class="form-textarea" placeholder="Deskripsi transaksi..." required></textarea>
        </div>

        <div class="form-group">
          <label class="form-label required">Baris Jurnal</label>
          <div class="table-container">
            <table class="table">
              <thead>
                <tr>
                  <th style="width: 30%;">Akun</th>
                  <th style="width: 30%;">Keterangan</th>
                  <th style="width: 15%;" class="text-right">Debit</th>
                  <th style="width: 15%;" class="text-right">Kredit</th>
                  <th style="width: 10%;" class="text-center">Aksi</th>
                </tr>
              </thead>
              <tbody id="journal-lines">
                ${this.renderJournalLine(0)}
                ${this.renderJournalLine(1)}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="5">
                    <button type="button" class="btn btn-secondary btn-sm" onclick="JournalEntry.addLine()">
                      ➕ Tambah Baris
                    </button>
                  </td>
                </tr>
                <tr style="background: var(--bg-tertiary); font-weight: 600;">
                  <td colspan="2" class="text-right">TOTAL:</td>
                  <td class="text-right" id="total-debit">Rp 0</td>
                  <td class="text-right" id="total-credit">Rp 0</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div class="flex justify-between align-center">
          <div id="balance-check" class="text-gray"></div>
          <div class="btn-group">
            <button type="button" class="btn btn-secondary" onclick="JournalEntry.resetForm()">
              Reset
            </button>
            <button type="submit" class="btn btn-success">
              💾 Simpan Jurnal
            </button>
          </div>
        </div>
      </form>
    `;
  },

  renderJournalLine(index) {
    const accounts = ChartOfAccounts.getDetailAccounts();
    return `
      <tr class="journal-line" data-index="${index}">
        <td>
          <select name="accountCode[]" class="form-select" onchange="JournalEntry.updateTotals()" required>
            <option value="">Pilih Akun...</option>
            ${accounts.map(acc => `
              <option value="${acc.code}">${acc.code} - ${acc.name}</option>
            `).join('')}
          </select>
        </td>
        <td>
          <input type="text" name="lineDescription[]" class="form-input" placeholder="Keterangan (opsional)">
        </td>
        <td>
          <input type="number" name="debit[]" class="form-input text-right" placeholder="0" min="0" step="1" value="0" onchange="JournalEntry.handleAmountChange(event, 'debit', ${index})">
        </td>
        <td>
          <input type="number" name="credit[]" class="form-input text-right" placeholder="0" min="0" step="1" value="0" onchange="JournalEntry.handleAmountChange(event, 'credit', ${index})">
        </td>
        <td class="text-center">
          ${index > 1 ? `
            <button type="button" class="btn btn-sm btn-danger" onclick="JournalEntry.removeLine(${index})">
              🗑️
            </button>
          ` : '-'}
        </td>
      </tr>
    `;
  },

  renderEntriesList() {
    let entriesToShow = this.entries;

    // Apply date filter if set
    if (this._filterStartDate && this._filterEndDate) {
      entriesToShow = this.entries.filter(entry => {
        const entryDate = new Date(entry.date);
        const startDate = new Date(this._filterStartDate);
        const endDate = new Date(this._filterEndDate);
        return entryDate >= startDate && entryDate <= endDate;
      });
    }

    if (entriesToShow.length === 0) {
      return '<p class="text-center text-gray">Belum ada jurnal yang dibuat</p>';
    }

    return `
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Ref</th>
              <th>Keterangan</th>
              <th class="text-right">Total</th>
              <th class="text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${entriesToShow.map(entry => `
              <tr onclick="JournalEntry.showEntryDetail('${entry.id}')" style="cursor: pointer;">
                <td>${this.formatDate(entry.date)}</td>
                <td>${entry.reference || '-'}</td>
                <td>${entry.description}</td>
                <td class="text-right">${this.formatCurrency(entry.totalDebit)}</td>
                <td class="text-center" onclick="event.stopPropagation()">
                  <button class="btn btn-sm btn-primary" onclick="JournalEntry.editEntry('${entry.id}')" title="Edit Jurnal">
                    ✏️
                  </button>
                  <button class="btn btn-sm btn-danger" onclick="JournalEntry.confirmDelete('${entry.id}')" title="Hapus Jurnal">
                    🗑️
                  </button>
                </td>
              </tr>
              <tr class="hidden" id="detail-${entry.id}">
                <td colspan="5" style="background: var(--bg-primary); padding: var(--spacing-lg);">
                  ${this.renderEntryDetail(entry)}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  renderEntryDetail(entry) {
    return `
      <table class="table" style="margin: 0;">
        <thead>
          <tr>
            <th>Akun</th>
            <th>Keterangan</th>
            <th class="text-right">Debit</th>
            <th class="text-right">Kredit</th>
          </tr>
        </thead>
        <tbody>
          ${entry.lines.map(line => {
      const account = ChartOfAccounts.getAccount(line.accountCode);
      return `
              <tr>
                <td>${line.accountCode} - ${account ? account.name : 'Unknown'}</td>
                <td>${line.description || '-'}</td>
                <td class="text-right">${line.debit > 0 ? this.formatCurrency(line.debit) : '-'}</td>
                <td class="text-right">${line.credit > 0 ? this.formatCurrency(line.credit) : '-'}</td>
              </tr>
            `;
    }).join('')}
        </tbody>
      </table>
    `;
  },

  attachEventListeners() {
    // Event listeners for dynamic form
  },

  applyFilter(event) {
    if (event) event.preventDefault();
    const form = document.getElementById('journal-filter-form');
    const formData = new FormData(form);
    this._filterStartDate = formData.get('startDate');
    this._filterEndDate = formData.get('endDate');

    // Re-render just the entries list
    document.getElementById('journal-entries-list').innerHTML = this.renderEntriesList();
  },

  clearFilter() {
    this._filterStartDate = null;
    this._filterEndDate = null;
    const today = new Date().toISOString().split('T')[0];
    const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    document.querySelector('[name="startDate"]').value = firstDayOfMonth;
    document.querySelector('[name="endDate"]').value = today;
    document.getElementById('journal-entries-list').innerHTML = this.renderEntriesList();
  },

  exportToPDF() {
    const config = Storage.get(Storage.KEYS.CONFIG);
    let entriesToExport = this.entries;

    // Apply date filter if set
    if (this._filterStartDate && this._filterEndDate) {
      entriesToExport = this.entries.filter(entry => {
        const entryDate = new Date(entry.date);
        const startDate = new Date(this._filterStartDate);
        const endDate = new Date(this._filterEndDate);
        return entryDate >= startDate && entryDate <= endDate;
      });
    }

    PDFExporter.exportJournalEntries(
      entriesToExport,
      config,
      this._filterStartDate,
      this._filterEndDate
    );
  },

  addLine() {
    const tbody = document.getElementById('journal-lines');
    const index = tbody.children.length;
    const tr = document.createElement('tr');
    tr.innerHTML = this.renderJournalLine(index);
    tr.className = 'journal-line';
    tr.setAttribute('data-index', index);
    tbody.appendChild(tr);
  },

  removeLine(index) {
    const line = document.querySelector(`.journal-line[data-index="${index}"]`);
    if (line) {
      line.remove();
      this.updateTotals();
    }
  },

  handleAmountChange(event, type, index) {
    const value = parseFloat(event.target.value) || 0;
    const row = event.target.closest('tr');

    // If user enters debit, clear credit and vice versa
    if (type === 'debit' && value > 0) {
      row.querySelector('input[name="credit[]"]').value = '0';
    } else if (type === 'credit' && value > 0) {
      row.querySelector('input[name="debit[]"]').value = '0';
    }

    this.updateTotals();
  },

  updateTotals() {
    const debitInputs = document.querySelectorAll('input[name="debit[]"]');
    const creditInputs = document.querySelectorAll('input[name="credit[]"]');

    let totalDebit = 0;
    let totalCredit = 0;

    debitInputs.forEach(input => {
      totalDebit += parseFloat(input.value) || 0;
    });

    creditInputs.forEach(input => {
      totalCredit += parseFloat(input.value) || 0;
    });

    document.getElementById('total-debit').textContent = this.formatCurrency(totalDebit);
    document.getElementById('total-credit').textContent = this.formatCurrency(totalCredit);

    const balanceCheck = document.getElementById('balance-check');
    if (totalDebit === totalCredit && totalDebit > 0) {
      balanceCheck.innerHTML = '<span class="text-success">✓ Balance (Debit = Kredit)</span>';
    } else if (totalDebit === 0 && totalCredit === 0) {
      balanceCheck.innerHTML = '';
    } else {
      balanceCheck.innerHTML = '<span class="text-error">✗ Tidak Balance</span>';
    }
  },

  async handleSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.target);

    const lines = [];
    const accountCodes = formData.getAll('accountCode[]');
    const descriptions = formData.getAll('lineDescription[]');
    const debits = formData.getAll('debit[]');
    const credits = formData.getAll('credit[]');

    for (let i = 0; i < accountCodes.length; i++) {
      if (accountCodes[i]) {
        const debit = parseFloat(debits[i]) || 0;
        const credit = parseFloat(credits[i]) || 0;

        if (debit > 0 || credit > 0) {
          lines.push({
            accountCode: accountCodes[i],
            description: descriptions[i],
            debit,
            credit,
          });
        }
      }
    }

    if (lines.length < 2) {
      alert('Minimal 2 baris transaksi diperlukan');
      return;
    }

    try {
      if (this._editMode && this._editingEntryId) {
        // Edit mode: Create reversal then new entry
        const originalEntry = this.entries.find(e => e.id === this._editingEntryId);

        // Create reversal entry
        const reversalLines = originalEntry.lines.map(line => ({
          accountCode: line.accountCode,
          description: line.description,
          debit: line.credit, // Swap debit and credit
          credit: line.debit,
        }));

        this.createEntry({
          date: originalEntry.date,
          reference: originalEntry.reference ? `REV-${originalEntry.reference}` : 'REVERSAL',
          description: `REVERSAL: ${originalEntry.description}`,
          lines: reversalLines,
        });

        // Create new entry with updated values
        this.createEntry({
          date: formData.get('date'),
          reference: formData.get('reference'),
          description: formData.get('description'),
          lines,
        });

        // Reset edit mode
        this._editMode = false;
        this._editingEntryId = null;

        this.resetForm();
        this.render();
        this.showAlert('success', 'Jurnal berhasil diupdate dengan reversal entry');
      } else {
        // Normal create mode
        this.createEntry({
          date: formData.get('date'),
          reference: formData.get('reference'),
          description: formData.get('description'),
          lines,
        });

        this.resetForm();
        this.render();
        this.showAlert('success', 'Jurnal berhasil disimpan');
      }
    } catch (error) {
      this.showAlert('error', error.message);
    }
  },

  resetForm() {
    document.getElementById('journal-entry-form').reset();
    const tbody = document.getElementById('journal-lines');
    tbody.innerHTML = this.renderJournalLine(0) + this.renderJournalLine(1);
    this.updateTotals();

    // Reset edit mode
    this._editMode = false;
    this._editingEntryId = null;
    this.updateEditModeUI();
  },

  showEntryDetail(id) {
    const detailRow = document.getElementById(`detail-${id}`);
    detailRow.classList.toggle('hidden');
  },

  confirmDelete(id) {
    if (confirm('Hapus jurnal ini? Saldo akun akan disesuaikan.')) {
      try {
        this.deleteEntry(id);
        this.render();
        this.showAlert('success', 'Jurnal berhasil dihapus');
      } catch (error) {
        this.showAlert('error', error.message);
      }
    }
  },

  showAlert(type, message) {
    ChartOfAccounts.showAlert(type, message);
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
