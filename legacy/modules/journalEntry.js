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
    return await Storage.set(Storage.KEYS.JOURNAL_ENTRIES, this.entries);
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

    // Generate reference number if not provided or if using auto-generated format
    let reference = entryData.reference || '';
    if (entryData.transactionType && !entryData.manualReference) {
      reference = Storage.getNextReferenceNumber(entryData.transactionType);
    }

    const entry = {
      id: uniqueId,
      date: entryData.date,
      description: entryData.description,
      transactionType: entryData.transactionType || 'JRN',
      lines: entryData.lines,
      totalDebit,
      totalCredit,
      createdAt: new Date().toISOString(),
    };

    // Generate reference number if not provided or if using auto-generated format
    if (entryData.reference) {
      entry.reference = entryData.reference;
    } else if (entryData.transactionType && !entryData.manualReference) {
      entry.reference = await Storage.getNextReferenceNumber(entryData.transactionType);
    } else {
      entry.reference = '';
    }

    this.entries.unshift(entry);

    // ☁️ CRITICAL: Wait for Cloud Save
    // We wrapped saveEntries with global loader in Storage.js, but good to be explicit here too
    try {
      await this.saveEntries();

      // Update account balances (Memory only, until next refresh re-calcs)
      this.updateAccountBalances(entry);

      return entry;
    } catch (err) {
      // Rollback on failure
      this.entries.shift();
      throw err;
    }
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

  async recoverFromCloud() {
    if (!confirm('Darurat: Paksa ambil data dari Cloud?')) return;

    try {
      if (!window.db || !window.firestore) throw new Error('Firebase not initialized');
      const { collection, getDocs } = window.firestore;

      let cloudEntries = [];
      const db = window.db;

      // TRY 1: Check 'journalEntries' (Standard Mapped Name)
      console.log('Recovery: Checking journalEntries...');
      let snapshot = await getDocs(collection(db, 'journalEntries'));
      snapshot.forEach(doc => cloudEntries.push(doc.data()));

      // TRY 2: Check 'erp_journal_entries' (Raw Key Name - Backup Check)
      if (cloudEntries.length === 0) {
        console.log('Recovery: journalEntries empty, checking erp_journal_entries...');
        snapshot = await getDocs(collection(db, 'erp_journal_entries'));
        snapshot.forEach(doc => cloudEntries.push(doc.data()));
      }

      if (cloudEntries.length > 0) {
        // Confirm before overwrite
        if (!confirm(`Ditemukan ${cloudEntries.length} data di Cloud. Timpa data lokal yang kosong?`)) return;

        this.entries = cloudEntries;

        // Direct LocalStorage save to bypass Sync deletion risk temporarily
        localStorage.setItem(Storage.KEYS.JOURNAL_ENTRIES, JSON.stringify(cloudEntries));

        alert(`Berhasil memulihkan ${cloudEntries.length} jurnal. Halaman akan dimuat ulang.`);
        window.location.reload();
      } else {
        alert('NIHIL. Cloud benar-benar kosong (0 data) di kedua lokasi penyimpanan. Kemungkinan data terhapus oleh sync sebelumnya.\n\nMohon cek apakah Anda memiliki backup manual (Excel/JSON)?');
      }
    } catch (e) {
      alert('Gagal pemulihan: ' + e.message);
      console.error(e);
    }
  },

  loadEntryToForm(entry) {
    const form = document.getElementById('journal-entry-form');
    form.querySelector('[name="date"]').value = entry.date;
    form.querySelector('[name="description"]').value = entry.description;

    // Set transaction type if it exists
    const typeSelect = form.querySelector('[name="transactionType"]');
    if (typeSelect && entry.transactionType) {
      typeSelect.value = entry.transactionType;
    }

    // Set manual reference override
    const manualCheckbox = document.getElementById('manualOverride');
    if (manualCheckbox) {
      manualCheckbox.checked = !!entry.manualReference;
      this.toggleManualOverride(); // Update UI state
    }

    // Set reference number AFTER potentially toggling manual override
    form.querySelector('[name="reference"]').value = entry.reference || '';

    // Clear existing lines
    const tbody = document.getElementById('journal-lines');

    // Optimized: build all HTML first then set once
    let rowsHtml = '';
    if (entry.lines && entry.lines.length > 0) {
      entry.lines.forEach((line, index) => {
        rowsHtml += this.renderJournalLine(index);
      });
      tbody.innerHTML = rowsHtml;

      // Populate data AFTER rows are in DOM
      entry.lines.forEach((line, index) => {
        const row = tbody.children[index];
        row.querySelector('[name="accountCode[]"]').value = line.accountCode;
        row.querySelector('[name="lineDescription[]"]').value = line.description || '';
        row.querySelector('[name="debit[]"]').value = line.debit || 0;
        row.querySelector('[name="credit[]"]').value = line.credit || 0;
      });
    } else {
      // Fallback for empty lines
      tbody.innerHTML = this.renderJournalLine(0) + this.renderJournalLine(1);
    }

    this.updateTotals();
  },

  async handleFileUpload(input) {
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];

    try {
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        const text = await this.readPDFText(file);
        await this.processImportData(text);
      } else {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            await this.processImportData(e.target.result);
          } catch (err) {
            alert('Gagal Import CSV: ' + err.message);
          }
        };
        reader.readAsText(file);
      }
    } catch (err) {
      alert('Gagal Import File: ' + err.message);
      console.error(err);
    } finally {
      input.value = '';
    }
  },

  async readPDFText(file) {
    if (typeof pdfjsLib === 'undefined') throw new Error('PDF Library belum dimuat. Coba refresh halaman.');

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    // Iterate all pages
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();

      let pageText = '';
      let lastY = -1;

      const items = textContent.items.sort((a, b) => {
        // Sort by Y descending (top to bottom), then X ascending
        if (Math.abs(a.transform[5] - b.transform[5]) > 5) { // Same line threshold
          return b.transform[5] - a.transform[5];
        }
        return a.transform[4] - b.transform[4];
      });

      items.forEach(item => {
        const y = item.transform[5];
        if (lastY !== -1 && Math.abs(y - lastY) > 10) {
          pageText += '\n'; // New line
        }
        pageText += item.str + ' ';
        lastY = y;
      });

      fullText += pageText + '\n';
    }

    return fullText;
  },

  async processImportData(textData) {
    // 1. Detect if this is a CSV/Excel dump (Header detection) OR formatted PDF text
    const lines = textData.split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length === 0) throw new Error('File kosong.');

    // Check for PDF Pattern "Tanggal: ... | Ref: ..."
    const isPDFDump = lines.some(l => l.includes('Tanggal:') && l.includes('| Ref:'));

    const entriesMap = {};
    let currentRef = null;
    let currentDate = null;
    let currentDesc = null;

    // Helper for Indonesian Month
    const parseIndoDate = (dateStr) => {
      const months = {
        'Januari': '01', 'Februari': '02', 'Maret': '03', 'April': '04', 'Mei': '05', 'Juni': '06',
        'Juli': '07', 'Agustus': '08', 'September': '09', 'Oktober': '10', 'November': '11', 'Desember': '12'
      };
      const parts = dateStr.trim().split(' ');
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = months[parts[1]] || '01';
        const year = parts[2];
        return `${year}-${month}-${day}`;
      }
      return new Date().toISOString().split('T')[0];
    };

    // Helper for Currency "Rp 1.000.000" or "-"
    const parseMoney = (str) => {
      if (!str) return 0;
      if (str.trim() === '-') return 0;
      let clean = str.replace(/[Rp\s.]/g, '');
      return parseFloat(clean.replace(',', '.')) || 0;
    }

    if (isPDFDump) {
      console.log('Mode: Smart PDF Parse (Refined)');

      for (const line of lines) {
        // Header Row Detection
        if (line.includes('Tanggal:') && line.includes('| Ref:')) {
          const parts = line.split('|');
          if (parts.length >= 2) {
            // Date
            const dateRaw = parts[0].replace('Tanggal:', '').trim();
            currentDate = parseIndoDate(dateRaw);

            // Ref
            const refPart = parts.find(p => p.trim().startsWith('Ref:'));
            const ref = refPart ? refPart.replace('Ref:', '').trim() : `REC-${Date.now()}`;

            // Description
            const desc = parts[parts.length - 1].trim();

            currentRef = ref;
            currentDesc = desc;

            if (!entriesMap[ref]) {
              entriesMap[ref] = {
                date: currentDate,
                reference: ref,
                description: desc,
                lines: []
              };
            }
          }
          continue;
        }

        // Data Row Detection
        if (!currentRef) continue;
        if (line.includes('TOTAL') || line.startsWith('Akun') || line.startsWith('Tanggal:')) continue;
        if (line === '' || line.match(/^[0-9]+$/)) continue; // Page numbers

        // Regex to capture Account Code at start "11212 - BANK BCA ..."
        const accountMatch = line.match(/^(\d+(?:-\d+)?)\s-\s(.+)/);
        if (accountMatch) {
          const code = accountMatch[1].trim();

          // Extract Debit/Credit from end of line
          const amountsRegex = /((?:Rp\s?[\d.]+|[\d.,]+|-))\s+((?:Rp\s?[\d.]+|[\d.,]+|-))\s*$/;
          const m = line.match(amountsRegex);

          if (m) {
            const debitStr = m[1];
            const creditStr = m[2];

            entriesMap[currentRef].lines.push({
              accountCode: code,
              description: currentDesc,
              debit: parseMoney(debitStr),
              credit: parseMoney(creditStr)
            });
          }
        }
      }
    }

    // -----------------------------------------------------------------
    // STANDARD CSV/TSV PARSER (Fallback)
    // -----------------------------------------------------------------
    if (!isPDFDump) {
      const firstLine = lines[0];
      const sep = firstLine.includes('\t') ? '\t' : ',';

      let headers = lines[0].toLowerCase().split(sep).map(h => h.trim().replace(/"/g, ''));

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(sep).map(c => c.trim().replace(/"/g, ''));
        if (cols.length < 5) continue;

        const getVal = (key) => {
          const idx = headers.findIndex(h => h.includes(key));
          if (idx !== -1) return cols[idx];
          return '';
        };

        let date = getVal('date');
        let ref = getVal('ref');
        let desc = getVal('desc');
        let acc = getVal('account') || getVal('code');
        let debit = parseFloat(getVal('debit').replace(/[^0-9.-]/g, '')) || 0;
        let credit = parseFloat(getVal('credit').replace(/[^0-9.-]/g, '')) || 0;

        // Smart Fill
        if (!ref && currentRef && (!date || date === currentDate)) {
          ref = currentRef;
        } else if (ref) {
          currentRef = ref;
          currentDate = date;
        }

        if (!acc) continue;

        if (!entriesMap[ref]) {
          entriesMap[ref] = {
            date: date || new Date().toISOString().split('T')[0],
            reference: ref,
            description: desc || 'Imported Entry',
            lines: []
          };
        }

        entriesMap[ref].lines.push({
          accountCode: acc,
          description: desc,
          debit: debit,
          credit: credit
        });
      }
    }

    // Validate and Create
    let successCount = 0;
    const entriesToCreate = Object.values(entriesMap);

    if (entriesToCreate.length === 0) throw new Error('Tidak ada data valid. Pastikan format sesuai.');

    if (!confirm(`Ditemukan ${entriesToCreate.length} jurnal. Lanjutkan import?`)) return;

    for (const entry of entriesToCreate) {
      try {
        const totalDebit = entry.lines.reduce((s, l) => s + l.debit, 0);
        const totalCredit = entry.lines.reduce((s, l) => s + l.credit, 0);

        if (Math.abs(totalDebit - totalCredit) > 100) {
          console.error(`Skipping unbalanced entry ${entry.reference}: ${totalDebit} != ${totalCredit}`);
          continue;
        }

        await this.createEntry({
          ...entry,
          lines: entry.lines.map(l => ({ ...l, description: l.description || entry.description }))
        });
        successCount++;
      } catch (e) {
        console.error(`Failed to create entry ${entry.reference}:`, e);
      }
    }

    if (successCount > 0) {
      await this.saveEntries();
      alert(`Import Selesai! ${successCount} jurnal berhasil dibuat.`);
      window.location.reload();
    } else {
      alert('Gagal membuat jurnal. Cek console untuk detail.');
    }
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

    if (!confirm('Apakah Anda yakin ingin menghapus jurnal ini?')) {
      return;
    }

    try {
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
      await this.saveEntries();

      // NEW: Absolute Cloud Deletion (Tombstone)
      // This prevents other stale sessions from restoring this record.
      if (typeof FirebaseSync !== 'undefined' && FirebaseSync.isEnabled()) {
        try {
          await FirebaseSync.deleteFromCloud(Storage.KEYS.JOURNAL_ENTRIES, id);
        } catch (cloudErr) {
          console.warn('⚠️ Main Sync succeeded but Tombstone failed:', cloudErr);
        }
      }

      if (typeof AuditLog !== 'undefined') {
        AuditLog.log('delete', 'journal_entry', id, `Deleted journal entry: ${entry.reference}`);
      }

      console.log('✅ Journal deletion successful (Local + Cloud Tombstone).');
    } catch (error) {
      console.error('❌ Failed to delete journal:', error);
      alert('GAGAL MENGHAPUS: Sinkronisasi ke Cloud gagal.\nDetail: ' + error.message + '\n\nPeriksa Console (F12) untuk detail log debug.');

      // Reload to reset state
      window.location.reload();
      throw error;
    }
  },

  render() {
    const content = document.getElementById('main-content');
    const today = new Date().toISOString().split('T')[0];
    const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    // ALWAYS SHOW RESCUE BUTTON FOR NOW (DEBUGGING)
    const rescueBtn = `<button onclick="JournalEntry.recoverFromCloud()" class="btn btn-danger" style="margin-right: 10px;">🆘 EMERGENCY RECOVERY</button>`;

    console.log('JournalEntry.render called via patch. Count:', this.entries ? this.entries.length : 0);

    content.innerHTML = `
      <div class="page-header">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h1 class="page-title">Jurnal Umum (Journal Entry)</h1>
            <p class="page-description">Pencatatan transaksi dengan sistem double-entry bookkeeping</p>
          </div>
          <div>
            <input type="file" id="importCsvInput" accept=".csv, .pdf" style="display: none;" onchange="JournalEntry.handleFileUpload(this)">
            <button class="btn btn-primary" onclick="document.getElementById('importCsvInput').click()" style="margin-right: 10px; background: #10b981;">
              📥 Import Excel/PDF
            </button>
            ${rescueBtn}
          </div>
          <div>
            <button class="btn btn-warning" onclick="DataCleanup.fixDuplicateJournals()" style="background: #f59e0b; color: white;">
              🧹 Bersihkan Duplikat
            </button>
          </div>
        </div>
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
          <input type="number" name="debit[]" class="form-input text-right" placeholder="0" min="0" step="1" value="0" oninput="JournalEntry.handleAmountChange(event, 'debit', ${index})">
        </td>
        <td>
          <input type="number" name="credit[]" class="form-input text-right" placeholder="0" min="0" step="1" value="0" oninput="JournalEntry.handleAmountChange(event, 'credit', ${index})">
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
      const creditInput = row.querySelector('input[name="credit[]"]');
      if (creditInput.value !== '0') {
        creditInput.value = '0';
      }
    } else if (type === 'credit' && value > 0) {
      const debitInput = row.querySelector('input[name="debit[]"]');
      if (debitInput.value !== '0') {
        debitInput.value = '0';
      }
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
        if (!originalEntry) throw new Error('Original entry not found');

        // Create reversal entry
        const reversalLines = originalEntry.lines.map(line => ({
          accountCode: line.accountCode,
          description: line.description,
          debit: line.credit, // Swap debit and credit
          credit: line.debit,
        }));

        await this.createEntry({
          date: originalEntry.date,
          reference: originalEntry.reference ? `REV-${originalEntry.reference}` : 'REVERSAL',
          description: `REVERSAL: ${originalEntry.description}`,
          lines: reversalLines,
          transactionType: originalEntry.transactionType || 'JRN',
          manualReference: true // Always manual for reversal
        });

        // Create new entry with updated values
        await this.createEntry({
          date: formData.get('date'),
          reference: formData.get('reference'),
          description: formData.get('description'),
          lines,
          transactionType: formData.get('transactionType'),
          manualReference: true // Preserve reference in edit mode
        });

        // Reset edit mode
        this._editMode = false;
        this._editingEntryId = null;

        this.resetForm();
        this.render();
        this.showAlert('success', 'Jurnal berhasil diupdate dengan reversal entry');
      } else {
        // Normal create mode
        const manualOverride = document.getElementById('manualOverride').checked;
        await this.createEntry({
          date: formData.get('date'),
          reference: formData.get('reference'),
          description: formData.get('description'),
          lines,
          transactionType: formData.get('transactionType'),
          manualReference: manualOverride,
        });

        this.resetForm();
        this.render();
        this.showAlert('success', 'Jurnal berhasil disimpan');
      }
    } catch (error) {
      console.error('Submit Error:', error);
      this.showAlert('error', error.message || 'Gagal menyimpan jurnal');
    }
  },

  resetForm() {
    document.getElementById('journal-entry-form').reset();
    const tbody = document.getElementById('journal-lines');
    tbody.innerHTML = this.renderJournalLine(0) + this.renderJournalLine(1);

    // Reset transaction type to JRN
    const typeSelect = document.getElementById('transactionType');
    if (typeSelect) {
      typeSelect.value = 'JRN';
      this.updateReferenceNumber();
    }

    // Uncheck manual override
    const manualCheckbox = document.getElementById('manualOverride');
    if (manualCheckbox) {
      manualCheckbox.checked = false;
    }

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

  // Update reference number based on selected transaction type
  updateReferenceNumber() {
    const typeSelect = document.getElementById('transactionType');
    const referenceInput = document.getElementById('referenceNumber');
    const manualCheckbox = document.getElementById('manualOverride');

    if (!manualCheckbox.checked && typeSelect.value) {
      const preview = Storage.previewNextReferenceNumber(typeSelect.value);
      referenceInput.value = preview;
    }

    const small = typeSelect.nextElementSibling;
    if (small) {
      const types = Storage.getTransactionTypes();
      const selectedType = types.find(t => t.code === typeSelect.value);
      if (selectedType) {
        small.textContent = selectedType.description;
      }
    }
  },

  // Toggle manual override for reference number
  toggleManualOverride() {
    const manualCheckbox = document.getElementById('manualOverride');
    const referenceInput = document.getElementById('referenceNumber');

    if (manualCheckbox.checked) {
      referenceInput.removeAttribute('readonly');
      referenceInput.focus();
      referenceInput.select();
    } else {
      referenceInput.setAttribute('readonly', true);
      this.updateReferenceNumber();
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


// Explicitly make JournalEntry globally available
window.JournalEntry = JournalEntry;
