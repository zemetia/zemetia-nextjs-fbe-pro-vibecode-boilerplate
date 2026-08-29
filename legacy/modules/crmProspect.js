// ==========================================
// CRM Prospect Module
// Kelola prospek/lead untuk sales keliling
// ==========================================

const CRMProspect = {
  prospects: [],
  visits: [],
  currentView: 'list', // 'list' or 'kanban'
  filterStatus: 'all',
  filterCity: 'all',
  _editMode: false,
  _editingId: null,

  init() {
    this.loadData();
    this.render();
  },

  loadData() {
    this.prospects = Storage.get(Storage.KEYS.CRM_PROSPECTS) || [];
    this.visits = Storage.get(Storage.KEYS.CRM_VISITS) || [];
  },

  async saveProspects() {
    await Storage.set(Storage.KEYS.CRM_PROSPECTS, this.prospects);
  },

  async saveVisits() {
    await Storage.set(Storage.KEYS.CRM_VISITS, this.visits);
  },

  render() {
    const content = document.getElementById('main-content');
    content.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">🏪 CRM - Daftar Prospek</h1>
        <p class="page-description">Kelola prospek toko emas untuk jasa peleburan</p>
      </div>

      <!-- Stats Cards -->
      <div class="grid grid-4 gap-3 mb-4">
        ${this.renderStats()}
      </div>

      <!-- Action Bar -->
      <div class="card mb-3">
        <div class="card-body">
          <div class="flex justify-between align-center flex-wrap gap-2">
            <div class="flex gap-2 align-center flex-wrap">
              <button class="btn ${this.currentView === 'list' ? 'btn-primary' : 'btn-secondary'}" onclick="CRMProspect.setView('list')">
                📋 List View
              </button>
              <button class="btn ${this.currentView === 'kanban' ? 'btn-primary' : 'btn-secondary'}" onclick="CRMProspect.setView('kanban')">
                📊 Kanban
              </button>
              <select class="form-select" style="width: 150px;" onchange="CRMProspect.filterByStatus(this.value)">
                <option value="all" ${this.filterStatus === 'all' ? 'selected' : ''}>Semua Status</option>
                <option value="lead" ${this.filterStatus === 'lead' ? 'selected' : ''}>Lead</option>
                <option value="qualified" ${this.filterStatus === 'qualified' ? 'selected' : ''}>Qualified</option>
                <option value="proposal" ${this.filterStatus === 'proposal' ? 'selected' : ''}>Proposal</option>
                <option value="negotiation" ${this.filterStatus === 'negotiation' ? 'selected' : ''}>Negotiation</option>
                <option value="won" ${this.filterStatus === 'won' ? 'selected' : ''}>Won</option>
                <option value="lost" ${this.filterStatus === 'lost' ? 'selected' : ''}>Lost</option>
              </select>
            </div>
            <button class="btn btn-success" onclick="CRMProspect.showAddModal()">
              ➕ Tambah Prospek
            </button>
          </div>
        </div>
      </div>

      <!-- Main Content -->
      <div class="card">
        <div class="card-body">
          ${this.currentView === 'list' ? this.renderListView() : this.renderKanbanView()}
        </div>
      </div>
    `;
  },

  renderStats() {
    const total = this.prospects.length;
    const leads = this.prospects.filter(p => p.status === 'lead').length;
    const active = this.prospects.filter(p => ['qualified', 'proposal', 'negotiation'].includes(p.status)).length;
    const won = this.prospects.filter(p => p.status === 'won').length;

    const pendingFollowUp = this.prospects.filter(p => {
      if (!p.nextFollowUp) return false;
      return new Date(p.nextFollowUp) <= new Date();
    }).length;

    return `
      <div class="card p-3 text-center" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
        <div class="text-2xl font-bold">${total}</div>
        <div class="text-sm">Total Prospek</div>
      </div>
      <div class="card p-3 text-center" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white;">
        <div class="text-2xl font-bold">${leads}</div>
        <div class="text-sm">New Leads</div>
      </div>
      <div class="card p-3 text-center" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white;">
        <div class="text-2xl font-bold">${active}</div>
        <div class="text-sm">In Progress</div>
      </div>
      <div class="card p-3 text-center" style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%); color: white;">
        <div class="text-2xl font-bold">${won}</div>
        <div class="text-sm">Won Deals</div>
      </div>
    `;
  },

  renderListView() {
    let filtered = this.prospects;
    if (this.filterStatus !== 'all') {
      filtered = filtered.filter(p => p.status === this.filterStatus);
    }

    if (filtered.length === 0) {
      return '<p class="text-center text-gray p-4">Belum ada prospek. Klik "Tambah Prospek" untuk memulai.</p>';
    }

    return `
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Nama Toko</th>
              <th>Kota</th>
              <th>Kontak</th>
              <th>Kategori</th>
              <th>Status</th>
              <th>Follow-up</th>
              <th class="text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(p => {
      const statusColors = {
        lead: 'badge-secondary',
        qualified: 'badge-info',
        proposal: 'badge-warning',
        negotiation: 'badge-primary',
        won: 'badge-success',
        lost: 'badge-danger'
      };
      const isOverdue = p.nextFollowUp && new Date(p.nextFollowUp) < new Date();
      return `
                <tr>
                  <td>
                    <strong>${p.name}</strong><br>
                    <small class="text-gray">${p.address || ''}</small>
                  </td>
                  <td>${p.city || '-'}</td>
                  <td>
                    ${p.contactPerson || '-'}<br>
                    <small>${p.phone || ''}</small>
                  </td>
                  <td><span class="badge badge-secondary">${p.category || 'Toko Emas'}</span></td>
                  <td><span class="badge ${statusColors[p.status]}">${this.getStatusLabel(p.status)}</span></td>
                  <td class="${isOverdue ? 'text-danger font-bold' : ''}">
                    ${p.nextFollowUp ? this.formatDate(p.nextFollowUp) : '-'}
                    ${isOverdue ? ' ⚠️' : ''}
                  </td>
                  <td class="text-center">
                    <button class="btn btn-sm btn-info" onclick="CRMProspect.showDetail('${p.id}')" title="Detail">
                      👁️
                    </button>
                    <button class="btn btn-sm btn-success" onclick="CRMProspect.showVisitModal('${p.id}')" title="Log Kunjungan">
                      📍
                    </button>
                    <button class="btn btn-sm btn-primary" onclick="CRMProspect.editProspect('${p.id}')" title="Edit">
                      ✏️
                    </button>
                    ${p.status === 'won' ? `
                      <button class="btn btn-sm btn-warning" onclick="CRMProspect.convertToCustomer('${p.id}')" title="Convert to Customer">
                        🔄
                      </button>
                    ` : ''}
                  </td>
                </tr>
              `;
    }).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  renderKanbanView() {
    const stages = [
      { id: 'lead', label: 'Lead', color: '#6b7280' },
      { id: 'qualified', label: 'Qualified', color: '#3b82f6' },
      { id: 'proposal', label: 'Proposal', color: '#f59e0b' },
      { id: 'negotiation', label: 'Negotiation', color: '#8b5cf6' },
      { id: 'won', label: 'Won', color: '#10b981' },
      { id: 'lost', label: 'Lost', color: '#ef4444' }
    ];

    return `
      <div class="kanban-board" style="display: flex; gap: 16px; overflow-x: auto; padding-bottom: 16px;">
        ${stages.map(stage => {
      const stageProspects = this.prospects.filter(p => p.status === stage.id);
      return `
            <div class="kanban-column" style="min-width: 250px; background: #f8fafc; border-radius: 8px; padding: 12px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <h4 style="margin: 0; color: ${stage.color};">${stage.label}</h4>
                <span class="badge" style="background: ${stage.color}; color: white;">${stageProspects.length}</span>
              </div>
              <div class="kanban-cards" style="display: flex; flex-direction: column; gap: 8px;">
                ${stageProspects.map(p => `
                  <div class="kanban-card" style="background: white; padding: 12px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); cursor: pointer;" onclick="CRMProspect.showDetail('${p.id}')">
                    <div style="font-weight: 600; margin-bottom: 4px;">${p.name}</div>
                    <div style="font-size: 12px; color: #6b7280;">${p.city || ''}</div>
                    <div style="font-size: 12px; color: #6b7280;">${p.contactPerson || ''}</div>
                    ${p.nextFollowUp ? `
                      <div style="margin-top: 8px; font-size: 11px; color: ${new Date(p.nextFollowUp) < new Date() ? '#ef4444' : '#6b7280'};">
                        📅 ${this.formatDate(p.nextFollowUp)}
                      </div>
                    ` : ''}
                  </div>
                `).join('')}
                ${stageProspects.length === 0 ? '<p style="text-align: center; color: #9ca3af; font-size: 12px;">Kosong</p>' : ''}
              </div>
            </div>
          `;
    }).join('')}
      </div>
    `;
  },

  setView(view) {
    this.currentView = view;
    this.render();
  },

  filterByStatus(status) {
    this.filterStatus = status;
    this.render();
  },

  getStatusLabel(status) {
    const labels = {
      lead: 'Lead',
      qualified: 'Qualified',
      proposal: 'Proposal',
      negotiation: 'Negotiation',
      won: 'Won ✓',
      lost: 'Lost ✗'
    };
    return labels[status] || status;
  },

  showAddModal() {
    this._editMode = false;
    this._editingId = null;
    this.renderProspectModal({});
  },

  editProspect(id) {
    const prospect = this.prospects.find(p => p.id === id);
    if (!prospect) return;
    this._editMode = true;
    this._editingId = id;
    this.renderProspectModal(prospect);
  },

  renderProspectModal(prospect) {
    const modalId = 'prospect-modal';
    let modal = document.getElementById(modalId);
    if (!modal) {
      modal = document.createElement('div');
      modal.id = modalId;
      modal.className = 'modal-overlay hidden';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal" style="max-width: 600px; width: 95%;">
        <div class="modal-header">
          <h3 class="modal-title">${this._editMode ? '✏️ Edit' : '➕ Tambah'} Prospek</h3>
          <button class="modal-close" onclick="CRMProspect.closeModal('${modalId}')">×</button>
        </div>
        <div class="modal-body">
          <form id="prospect-form" onsubmit="CRMProspect.saveProspect(event)">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label required">Nama Toko</label>
                <input type="text" name="name" class="form-input" value="${prospect.name || ''}" required>
              </div>
              <div class="form-group">
                <label class="form-label">Kategori</label>
                <select name="category" class="form-select">
                  <option value="Toko Emas" ${prospect.category === 'Toko Emas' ? 'selected' : ''}>Toko Emas</option>
                  <option value="Pengrajin" ${prospect.category === 'Pengrajin' ? 'selected' : ''}>Pengrajin</option>
                  <option value="Pedagang" ${prospect.category === 'Pedagang' ? 'selected' : ''}>Pedagang</option>
                  <option value="Lainnya" ${prospect.category === 'Lainnya' ? 'selected' : ''}>Lainnya</option>
                </select>
              </div>
            </div>
            
            <div class="form-group">
              <label class="form-label">Alamat</label>
              <input type="text" name="address" class="form-input" value="${prospect.address || ''}" placeholder="Jl. Pasar Baru No.12">
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Kota</label>
                <input type="text" name="city" class="form-input" value="${prospect.city || ''}" placeholder="Jakarta">
              </div>
              <div class="form-group">
                <label class="form-label">Sumber Lead</label>
                <select name="source" class="form-select">
                  <option value="Cold Visit" ${prospect.source === 'Cold Visit' ? 'selected' : ''}>Cold Visit</option>
                  <option value="Referral" ${prospect.source === 'Referral' ? 'selected' : ''}>Referral</option>
                  <option value="Pameran" ${prospect.source === 'Pameran' ? 'selected' : ''}>Pameran</option>
                  <option value="Online" ${prospect.source === 'Online' ? 'selected' : ''}>Online</option>
                </select>
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Contact Person</label>
                <input type="text" name="contactPerson" class="form-input" value="${prospect.contactPerson || ''}">
              </div>
              <div class="form-group">
                <label class="form-label">No. Telepon</label>
                <input type="tel" name="phone" class="form-input" value="${prospect.phone || ''}">
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Status</label>
                <select name="status" class="form-select">
                  <option value="lead" ${prospect.status === 'lead' ? 'selected' : ''}>Lead</option>
                  <option value="qualified" ${prospect.status === 'qualified' ? 'selected' : ''}>Qualified</option>
                  <option value="proposal" ${prospect.status === 'proposal' ? 'selected' : ''}>Proposal</option>
                  <option value="negotiation" ${prospect.status === 'negotiation' ? 'selected' : ''}>Negotiation</option>
                  <option value="won" ${prospect.status === 'won' ? 'selected' : ''}>Won</option>
                  <option value="lost" ${prospect.status === 'lost' ? 'selected' : ''}>Lost</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Next Follow-up</label>
                <input type="date" name="nextFollowUp" class="form-input" value="${prospect.nextFollowUp || ''}">
              </div>
            </div>
            
            <div class="form-group">
              <label class="form-label">Catatan</label>
              <textarea name="notes" class="form-textarea" rows="2">${prospect.notes || ''}</textarea>
            </div>
            
            <div class="flex justify-end gap-2 mt-3">
              <button type="button" class="btn btn-secondary" onclick="CRMProspect.closeModal('${modalId}')">Batal</button>
              <button type="submit" class="btn btn-success">💾 Simpan</button>
            </div>
          </form>
        </div>
      </div>
    `;

    modal.classList.remove('hidden');
  },

  async saveProspect(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);

    const data = {
      name: formData.get('name'),
      category: formData.get('category'),
      address: formData.get('address'),
      city: formData.get('city'),
      source: formData.get('source'),
      contactPerson: formData.get('contactPerson'),
      phone: formData.get('phone'),
      status: formData.get('status'),
      nextFollowUp: formData.get('nextFollowUp'),
      notes: formData.get('notes')
    };

    if (this._editMode && this._editingId) {
      const index = this.prospects.findIndex(p => p.id === this._editingId);
      if (index !== -1) {
        this.prospects[index] = { ...this.prospects[index], ...data, updatedAt: new Date().toISOString() };
      }
    } else {
      data.id = `PRSP-${Date.now()}`;
      data.createdAt = new Date().toISOString();
      data.lastContactDate = new Date().toISOString().split('T')[0];
      this.prospects.push(data);
    }

    this.saveProspects();
    this.closeModal('prospect-modal');
    this.render();
    this.showAlert('success', this._editMode ? 'Prospek berhasil diupdate!' : 'Prospek berhasil ditambahkan!');
  },

  showVisitModal(prospectId) {
    const prospect = this.prospects.find(p => p.id === prospectId);
    if (!prospect) return;

    const modalId = 'visit-modal';
    let modal = document.getElementById(modalId);
    if (!modal) {
      modal = document.createElement('div');
      modal.id = modalId;
      modal.className = 'modal-overlay hidden';
      document.body.appendChild(modal);
    }

    const today = new Date().toISOString().split('T')[0];

    modal.innerHTML = `
      <div class="modal" style="max-width: 500px; width: 95%;">
        <div class="modal-header">
          <h3 class="modal-title">📍 Log Kunjungan</h3>
          <button class="modal-close" onclick="CRMProspect.closeModal('${modalId}')">×</button>
        </div>
        <div class="modal-body">
          <div class="card p-2 mb-3" style="background: #f8fafc;">
            <strong>${prospect.name}</strong><br>
            <small class="text-gray">${prospect.address || ''}, ${prospect.city || ''}</small>
          </div>
          
          <form id="visit-form" onsubmit="CRMProspect.saveVisit(event, '${prospectId}')">
            <!-- GPS Location Section -->
            <div class="form-group">
              <label class="form-label">📍 Lokasi GPS</label>
              <div class="flex gap-2 align-center">
                <input type="text" id="visit-location" name="location" class="form-input" placeholder="Klik 'Ambil Lokasi' untuk mendapatkan GPS" readonly style="flex: 1;">
                <button type="button" class="btn btn-info btn-sm" onclick="CRMProspect.getGPSLocation()" style="white-space: nowrap;">
                  🛰️ Ambil Lokasi
                </button>
              </div>
              <input type="hidden" id="visit-lat" name="latitude">
              <input type="hidden" id="visit-lng" name="longitude">
              <small id="gps-status" class="text-gray"></small>
            </div>

            <!-- Photo Upload Section -->
            <div class="form-group">
              <label class="form-label">📷 Foto Bukti Kunjungan</label>
              <div class="flex gap-2 flex-wrap">
                <input type="file" id="visit-photo" name="photo" accept="image/*" capture="environment" 
                       onchange="CRMProspect.previewPhoto(this)" style="display: none;">
                <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('visit-photo').click()">
                  📷 Ambil Foto
                </button>
                <button type="button" class="btn btn-secondary btn-sm" onclick="CRMProspect.clearPhoto()">
                  🗑️ Hapus Foto
                </button>
              </div>
              <div id="photo-preview" style="margin-top: 8px;"></div>
              <input type="hidden" id="visit-photo-data" name="photoData">
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label class="form-label required">Tanggal Kunjungan</label>
                <input type="date" name="date" class="form-input" value="${today}" required>
              </div>
              <div class="form-group">
                <label class="form-label required">Hasil</label>
                <select name="result" class="form-select" required>
                  <option value="interested">Tertarik</option>
                  <option value="follow_up">Perlu Follow-up</option>
                  <option value="not_ready">Belum Siap</option>
                  <option value="rejected">Menolak</option>
                </select>
              </div>
            </div>
            
            <div class="form-group">
              <label class="form-label">Catatan Kunjungan</label>
              <textarea name="notes" class="form-textarea" rows="3" placeholder="Hasil pembicaraan, kebutuhan, dll"></textarea>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Next Action</label>
                <input type="text" name="nextAction" class="form-input" placeholder="Kirim proposal, dll">
              </div>
              <div class="form-group">
                <label class="form-label">Tgl Follow-up</label>
                <input type="date" name="nextFollowUpDate" class="form-input">
              </div>
            </div>
            
            <div class="flex justify-end gap-2 mt-3">
              <button type="button" class="btn btn-secondary" onclick="CRMProspect.closeModal('${modalId}')">Batal</button>
              <button type="submit" class="btn btn-success">💾 Simpan Kunjungan</button>
            </div>
          </form>
        </div>
      </div>
    `;

    modal.classList.remove('hidden');

    // Auto-get GPS on modal open (mobile-friendly)
    setTimeout(() => this.getGPSLocation(), 500);
  },

  // GPS Location capture
  getGPSLocation() {
    const statusEl = document.getElementById('gps-status');
    const locationInput = document.getElementById('visit-location');
    const latInput = document.getElementById('visit-lat');
    const lngInput = document.getElementById('visit-lng');

    if (!navigator.geolocation) {
      statusEl.innerHTML = '<span class="text-danger">❌ GPS tidak didukung di browser ini</span>';
      return;
    }

    statusEl.innerHTML = '<span class="text-info">⏳ Mengambil lokasi...</span>';

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = Math.round(position.coords.accuracy);

        latInput.value = lat;
        lngInput.value = lng;
        locationInput.value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        statusEl.innerHTML = `<span class="text-success">✅ Lokasi berhasil diambil (akurasi: ${accuracy}m)</span>`;
      },
      (error) => {
        let errorMsg = 'Gagal mengambil lokasi';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMsg = 'Izin GPS ditolak. Aktifkan izin lokasi di settings.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMsg = 'Lokasi tidak tersedia.';
            break;
          case error.TIMEOUT:
            errorMsg = 'Timeout mengambil lokasi.';
            break;
        }
        statusEl.innerHTML = `<span class="text-danger">❌ ${errorMsg}</span>`;
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  },

  // Photo preview
  previewPhoto(input) {
    const preview = document.getElementById('photo-preview');
    const photoDataInput = document.getElementById('visit-photo-data');

    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();

      reader.onload = (e) => {
        // Compress image for storage
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxSize = 800; // Max dimension
          let width = img.width;
          let height = img.height;

          if (width > height && width > maxSize) {
            height *= maxSize / width;
            width = maxSize;
          } else if (height > maxSize) {
            width *= maxSize / height;
            height = maxSize;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          const compressedData = canvas.toDataURL('image/jpeg', 0.7);
          photoDataInput.value = compressedData;

          preview.innerHTML = `
                        <img src="${compressedData}" style="max-width: 100%; max-height: 150px; border-radius: 8px; border: 1px solid #ddd;">
                        <div class="text-sm text-gray mt-1">📷 Foto siap disimpan</div>
                    `;
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  },

  clearPhoto() {
    const preview = document.getElementById('photo-preview');
    const photoInput = document.getElementById('visit-photo');
    const photoDataInput = document.getElementById('visit-photo-data');

    if (preview) preview.innerHTML = '';
    if (photoInput) photoInput.value = '';
    if (photoDataInput) photoDataInput.value = '';
  },

  async saveVisit(event, prospectId) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);

    const visit = {
      id: `VISIT-${Date.now()}`,
      prospectId: prospectId,
      date: formData.get('date'),
      result: formData.get('result'),
      notes: formData.get('notes'),
      nextAction: formData.get('nextAction'),
      nextFollowUpDate: formData.get('nextFollowUpDate'),
      // GPS data
      location: formData.get('location') || null,
      latitude: formData.get('latitude') || null,
      longitude: formData.get('longitude') || null,
      // Photo data (base64)
      photoData: formData.get('photoData') || null,
      createdAt: new Date().toISOString()
    };

    this.visits.push(visit);
    this.saveVisits();

    // Update prospect's last contact and follow-up
    const prospectIndex = this.prospects.findIndex(p => p.id === prospectId);
    if (prospectIndex !== -1) {
      this.prospects[prospectIndex].lastContactDate = visit.date;
      if (visit.nextFollowUpDate) {
        this.prospects[prospectIndex].nextFollowUp = visit.nextFollowUpDate;
      }
      this.saveProspects();
    }

    this.closeModal('visit-modal');
    this.render();
    this.showAlert('success', 'Kunjungan berhasil dicatat!');
  },

  showDetail(id) {
    const prospect = this.prospects.find(p => p.id === id);
    if (!prospect) return;

    const prospectVisits = this.visits.filter(v => v.prospectId === id).sort((a, b) => new Date(b.date) - new Date(a.date));

    const modalId = 'detail-modal';
    let modal = document.getElementById(modalId);
    if (!modal) {
      modal = document.createElement('div');
      modal.id = modalId;
      modal.className = 'modal-overlay hidden';
      document.body.appendChild(modal);
    }

    const statusColors = {
      lead: 'badge-secondary',
      qualified: 'badge-info',
      proposal: 'badge-warning',
      negotiation: 'badge-primary',
      won: 'badge-success',
      lost: 'badge-danger'
    };

    const resultLabels = {
      interested: '✅ Tertarik',
      follow_up: '📅 Follow-up',
      not_ready: '⏳ Belum Siap',
      rejected: '❌ Menolak'
    };

    modal.innerHTML = `
      <div class="modal" style="max-width: 700px; width: 95%; max-height: 90vh; overflow-y: auto;">
        <div class="modal-header">
          <h3 class="modal-title">🏪 Detail Prospek</h3>
          <button class="modal-close" onclick="CRMProspect.closeModal('${modalId}')">×</button>
        </div>
        <div class="modal-body">
          <!-- Prospect Info -->
          <div class="card p-3 mb-3" style="background: #f8fafc;">
            <div class="flex justify-between align-start">
              <div>
                <h2 style="margin: 0 0 8px 0;">${prospect.name}</h2>
                <p style="margin: 0; color: #6b7280;">${prospect.address || ''}</p>
                <p style="margin: 0; color: #6b7280;">${prospect.city || ''}</p>
              </div>
              <span class="badge ${statusColors[prospect.status]}" style="font-size: 14px;">${this.getStatusLabel(prospect.status)}</span>
            </div>
            <hr style="margin: 16px 0;">
            <div class="grid grid-3 gap-2">
              <div>
                <small class="text-gray">Contact</small>
                <div>${prospect.contactPerson || '-'}</div>
              </div>
              <div>
                <small class="text-gray">Telepon</small>
                <div>${prospect.phone || '-'}</div>
              </div>
              <div>
                <small class="text-gray">Kategori</small>
                <div>${prospect.category || '-'}</div>
              </div>
            </div>
            ${prospect.notes ? `<div style="margin-top: 12px; padding: 8px; background: white; border-radius: 4px; font-size: 14px;">${prospect.notes}</div>` : ''}
          </div>

          <!-- Quick Actions -->
          <div class="flex gap-2 mb-3">
            <button class="btn btn-success" onclick="CRMProspect.closeModal('${modalId}'); CRMProspect.showVisitModal('${id}');">
              📍 Log Kunjungan
            </button>
            <button class="btn btn-primary" onclick="CRMProspect.closeModal('${modalId}'); CRMProspect.editProspect('${id}');">
              ✏️ Edit
            </button>
            ${prospect.status === 'won' ? `
              <button class="btn btn-warning" onclick="CRMProspect.convertToCustomer('${id}')">
                🔄 Convert to Customer
              </button>
            ` : ''}
          </div>

          <!-- Visit History -->
          <h4 style="margin-bottom: 12px;">📋 Riwayat Kunjungan (${prospectVisits.length})</h4>
          ${prospectVisits.length === 0 ?
        '<p class="text-center text-gray">Belum ada kunjungan tercatat</p>' :
        `<div style="max-height: 400px; overflow-y: auto;">
              ${prospectVisits.map(v => `
                <div class="card p-2 mb-2" style="border-left: 3px solid ${v.result === 'interested' ? '#10b981' : v.result === 'rejected' ? '#ef4444' : '#f59e0b'};">
                  <div class="flex justify-between">
                    <strong>${this.formatDate(v.date)}</strong>
                    <span>${resultLabels[v.result] || v.result}</span>
                  </div>
                  ${v.location ? `<div style="font-size: 12px; color: #6b7280; margin-top: 4px;">
                    📍 <a href="https://maps.google.com/?q=${v.latitude},${v.longitude}" target="_blank" style="color: #3b82f6;">${v.location}</a>
                  </div>` : ''}
                  ${v.notes ? `<p style="margin: 8px 0 0; font-size: 14px; color: #4b5563;">${v.notes}</p>` : ''}
                  ${v.nextAction ? `<p style="margin: 4px 0 0; font-size: 12px; color: #6b7280;">Next: ${v.nextAction}</p>` : ''}
                  ${v.photoData ? `<div style="margin-top: 8px;">
                    <img src="${v.photoData}" style="max-width: 100%; max-height: 120px; border-radius: 6px; cursor: pointer;" onclick="window.open('${v.photoData}', '_blank')">
                  </div>` : ''}
                </div>
              `).join('')}
            </div>`

      }
        </div>
      </div>
    `;

    modal.classList.remove('hidden');
  },

  async convertToCustomer(id) {
    const prospect = this.prospects.find(p => p.id === id);
    if (!prospect) return;

    if (!confirm(`Convert "${prospect.name}" menjadi Customer?\n\nData akan ditambahkan ke Master Customer.`)) {
      return;
    }

    // Create customer from prospect
    const customer = {
      id: `CUST-${Date.now()}`,
      code: `CUST-${String(Date.now()).slice(-6)}`,
      name: prospect.name,
      customerType: 'Perusahaan',
      contact: prospect.contactPerson,
      phone: prospect.phone,
      address: prospect.address,
      notes: `Converted from CRM Prospect. Source: ${prospect.source || 'N/A'}`,
      createdAt: new Date().toISOString()
    };

    // Add to customers
    const customers = Storage.get(Storage.KEYS.CUSTOMERS) || [];
    customers.push(customer);
    await Storage.set(Storage.KEYS.CUSTOMERS, customers);

    // Mark prospect as converted
    const index = this.prospects.findIndex(p => p.id === id);
    if (index !== -1) {
      this.prospects[index].convertedToCustomerId = customer.id;
      this.prospects[index].convertedAt = new Date().toISOString();
      this.saveProspects();
    }

    this.closeModal('detail-modal');
    this.render();
    this.showAlert('success', `Prospek berhasil diconvert ke Customer: ${customer.code}`);
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('hidden');
  },

  formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  },

  showAlert(type, message) {
    if (typeof ChartOfAccounts !== 'undefined' && ChartOfAccounts.showAlert) {
      ChartOfAccounts.showAlert(type, message);
    } else {
      alert(message);
    }
  }
};

window.CRMProspect = CRMProspect;
