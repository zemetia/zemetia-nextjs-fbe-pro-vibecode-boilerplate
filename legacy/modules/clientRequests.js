const ClientRequests = {
  containerId: 'main-content',
  unsubscribe: null,
  requests: [],

  async render() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    container.innerHTML = `
      <div class="content-header">
        <h2>🛎️ Client Smelting Requests</h2>
        <div class="header-actions">
          <button class="btn btn-primary" onclick="ClientRequests.fetchData()">
            🔄 Refresh
          </button>
        </div>
      </div>
      
      <div class="dashboard-cards">
        <div class="card stat-card">
          <h3>Pending</h3>
          <p class="stat-value text-warning" id="stat-pending">0</p>
        </div>
        <div class="card stat-card">
          <h3>Diproses</h3>
          <p class="stat-value text-info" id="stat-processing">0</p>
        </div>
        <div class="card stat-card">
          <h3>Selesai</h3>
          <p class="stat-value text-success" id="stat-completed">0</p>
        </div>
      </div>

      <div class="card">
        <div class="table-responsive">
          <table class="table" id="client-requests-table">
            <thead>
              <tr>
                <th>Resi / Tanggal</th>
                <th>Pelanggan</th>
                <th>Barang</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr><td colspan="5" class="text-center">Memuat data...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    await this.fetchData();
  },

  async fetchData() {
    if (!window.db || !window.firestore) {
      alert("Firebase belum terhubung.");
      return;
    }
    const { collection, getDocs, query, orderBy, limit } = window.firestore;
    
    try {
      const q = query(
        collection(window.db, "smelting_requests"), 
        orderBy("createdAt", "desc"),
        limit(100)
      );
      const snapshot = await getDocs(q);
      
      this.requests = [];
      let pending = 0, processing = 0, completed = 0;
      
      snapshot.forEach(doc => {
        const data = doc.data();
        this.requests.push(data);
        if (data.status === 'pending') pending++;
        else if (data.status === 'processing') processing++;
        else if (data.status === 'completed' || data.status === 'lab_tested') completed++;
      });
      
      document.getElementById('stat-pending').textContent = pending;
      document.getElementById('stat-processing').textContent = processing;
      document.getElementById('stat-completed').textContent = completed;
      
      this.renderTable();
    } catch (err) {
      console.error("Error loading client requests:", err);
      document.querySelector('#client-requests-table tbody').innerHTML = `
        <tr><td colspan="5" class="text-center text-danger">Gagal memuat data: ${err.message}</td></tr>
      `;
    }
  },

  renderTable() {
    const tbody = document.querySelector('#client-requests-table tbody');
    if (this.requests.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center">Belum ada tiket permintaan.</td></tr>';
      return;
    }

    const getStatusBadge = (status) => {
      switch(status) {
        case 'pending': return '<span class="badge badge-warning">Pending</span>';
        case 'processing': return '<span class="badge badge-info">Diproses</span>';
        case 'lab_tested': return '<span class="badge badge-primary">Uji Lab Selesai</span>';
        case 'completed': return '<span class="badge badge-success">Selesai</span>';
        default: return '<span class="badge badge-secondary">Unknown</span>';
      }
    };

    tbody.innerHTML = this.requests.map(req => {
      const dateStr = req.createdAt && req.createdAt.toDate ? req.createdAt.toDate().toLocaleString('id-ID') : 'Baru saja';
      return `
        <tr>
          <td>
            <strong>${req.id}</strong><br>
            <small class="text-gray">${dateStr}</small>
          </td>
          <td>
            <strong>${req.customerName || '-'}</strong><br>
            <small class="text-gray">📞 ${req.customerPhone || '-'}</small>
          </td>
          <td>
            ${req.itemType || '-'}<br>
            <small class="text-gray">Est. ${req.estWeight || 0}g</small>
          </td>
          <td>${getStatusBadge(req.status)}</td>
          <td>
            <button class="btn btn-sm btn-secondary" onclick="ClientRequests.openDetailModal('${req.id}')">Lihat/Update</button>
          </td>
        </tr>
      `;
    }).join('');
  },

  openDetailModal(resiId) {
    const req = this.requests.find(r => r.id === resiId);
    if (!req) return;

    const modalId = 'modal-client-req-' + Date.now();
    const modalHtml = `
      <div class="modal-overlay" id="${modalId}">
        <div class="modal" style="max-width: 600px;">
          <div class="modal-header">
            <h3>Detail Permintaan: ${req.id}</h3>
            <button class="modal-close" onclick="document.getElementById('${modalId}').remove()">&times;</button>
          </div>
          <div class="modal-body">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
              <div>
                <p class="text-gray" style="font-size:0.85rem">Nama Pelanggan</p>
                <p><strong>${req.customerName}</strong></p>
              </div>
              <div>
                <p class="text-gray" style="font-size:0.85rem">WhatsApp</p>
                <p><strong>${req.customerPhone}</strong></p>
              </div>
              <div>
                <p class="text-gray" style="font-size:0.85rem">Jenis Barang</p>
                <p><strong>${req.itemType}</strong></p>
              </div>
              <div>
                <p class="text-gray" style="font-size:0.85rem">Estimasi Berat</p>
                <p><strong>${req.estWeight} gram</strong></p>
              </div>
            </div>
            
            <div class="form-group" style="margin-bottom: 1.5rem;">
              <label>Catatan Pelanggan</label>
              <div style="background: var(--bg-color); padding: 0.8rem; border-radius: 6px; border: 1px solid var(--border-color);">
                ${req.notes || '<em>Tidak ada catatan</em>'}
              </div>
            </div>

            <hr style="margin: 1.5rem 0; border-color: var(--border-color);">
            
            <h4>Update Status & Hasil Lab</h4>
            <div class="form-group" style="margin-top: 1rem;">
              <label>Status Saat Ini</label>
              <select id="req-status" class="form-input">
                <option value="pending" ${req.status === 'pending' ? 'selected' : ''}>Pending (Menunggu Diterima)</option>
                <option value="processing" ${req.status === 'processing' ? 'selected' : ''}>Diproses (Sedang Dilebur)</option>
                <option value="lab_tested" ${req.status === 'lab_tested' ? 'selected' : ''}>Uji Lab Selesai (Input Hasil Bawah)</option>
                <option value="completed" ${req.status === 'completed' ? 'selected' : ''}>Selesai / Approved</option>
              </select>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
              <div class="form-group">
                <label>Berat Kotor Aktual (g)</label>
                <input type="number" step="0.01" id="req-gross" class="form-input" value="${req.labResult?.grossWeight || ''}">
              </div>
              <div class="form-group">
                <label>Kadar / Purity (%)</label>
                <input type="number" step="0.01" id="req-purity" class="form-input" value="${req.labResult?.purity || ''}">
              </div>
            </div>
            
            ${req.clientApproved ? '<div class="alert alert-success" style="margin-top:1rem">✅ Pelanggan sudah menyetujui hasil lab.</div>' : ''}
          </div>
          <div class="modal-footer" style="display: flex; justify-content: space-between;">
            <button class="btn btn-secondary" onclick="document.getElementById('${modalId}').remove()">Batal</button>
            <button class="btn btn-primary" onclick="ClientRequests.saveUpdate('${modalId}', '${req.id}')">Simpan Perubahan</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  },

  async saveUpdate(modalId, resiId) {
    if (!window.db || !window.firestore) return;
    const { doc, updateDoc, serverTimestamp } = window.firestore;
    
    const status = document.getElementById('req-status').value;
    const grossVal = document.getElementById('req-gross').value;
    const purityVal = document.getElementById('req-purity').value;
    
    const updateData = {
      status: status,
      updatedAt: serverTimestamp()
    };
    
    if (status === 'lab_tested' || status === 'completed') {
      updateData.labResult = {
        grossWeight: parseFloat(grossVal) || 0,
        purity: parseFloat(purityVal) || 0
      };
    }
    
    try {
      const docRef = doc(window.db, "smelting_requests", resiId);
      await updateDoc(docRef, updateData);
      
      document.getElementById(modalId).remove();
      this.fetchData(); // reload table
      alert("Data berhasil diperbarui!");
    } catch (err) {
      console.error(err);
      alert("Gagal memperbarui data: " + err.message);
    }
  }
};

window.ClientRequests = ClientRequests;
