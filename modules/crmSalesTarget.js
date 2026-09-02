// ==========================================
// CRM Sales Target & Leaderboard Module
// Target penjualan dan ranking sales
// ==========================================

const CRMSalesTarget = {
  targets: [],
  salespeople: [],
  currentPeriod: '',

  init() {
    this.loadData();
    this.currentPeriod = this.getCurrentPeriod();
    this.render();
  },

  loadData() {
    this.targets = Storage.get(Storage.KEYS.CRM_SALES_TARGETS) || [];
    this.salespeople = Storage.get(Storage.KEYS.USERS) || Storage.get(Storage.KEYS.EMPLOYEES) || [];
    // Get prospects for calculating deals
    this.prospects = Storage.get(Storage.KEYS.CRM_PROSPECTS) || [];
    this.visits = Storage.get(Storage.KEYS.CRM_VISITS) || [];
  },

  async saveTargets() {
    await Storage.set(Storage.KEYS.CRM_SALES_TARGETS, this.targets);
  },

  getCurrentPeriod() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  },

  render() {
    const content = document.getElementById('main-content');
    content.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">🏆 Target Sales & Leaderboard</h1>
        <p class="page-description">Monitor pencapaian target dan ranking tim sales</p>
      </div>

      <!-- Period Selector -->
      <div class="card mb-3">
        <div class="card-body">
          <div class="flex justify-between align-center flex-wrap gap-2">
            <div class="flex gap-2 align-center">
              <label class="form-label" style="margin: 0;">Periode:</label>
              <input type="month" id="period-selector" class="form-input" value="${this.currentPeriod}" 
                     onchange="CRMSalesTarget.changePeriod(this.value)" style="width: 180px;">
            </div>
            <button class="btn btn-success" onclick="CRMSalesTarget.showTargetModal()">
              ⚙️ Set Target
            </button>
          </div>
        </div>
      </div>

      <!-- Stats Overview -->
      <div class="grid grid-4 gap-3 mb-4">
        ${this.renderOverviewStats()}
      </div>

      <!-- Leaderboard -->
      <div class="card mb-3">
        <div class="card-header">
          <h3 class="card-title">🏆 Leaderboard - ${this.formatPeriod(this.currentPeriod)}</h3>
        </div>
        <div class="card-body">
          ${this.renderLeaderboard()}
        </div>
      </div>

      <!-- Daily Planner -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">📅 Rencana Kunjungan Hari Ini</h3>
        </div>
        <div class="card-body">
          ${this.renderDailyPlanner()}
        </div>
      </div>
    `;
  },

  renderOverviewStats() {
    const periodData = this.calculatePeriodStats(this.currentPeriod);

    return `
      <div class="card p-3 text-center" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
        <div class="text-2xl font-bold">${periodData.totalVisits}</div>
        <div class="text-sm">Total Kunjungan</div>
      </div>
      <div class="card p-3 text-center" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white;">
        <div class="text-2xl font-bold">${periodData.newLeads}</div>
        <div class="text-sm">New Leads</div>
      </div>
      <div class="card p-3 text-center" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white;">
        <div class="text-2xl font-bold">${periodData.dealsWon}</div>
        <div class="text-sm">Deals Won</div>
      </div>
      <div class="card p-3 text-center" style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%); color: white;">
        <div class="text-2xl font-bold">${periodData.conversionRate}%</div>
        <div class="text-sm">Conversion Rate</div>
      </div>
    `;
  },

  calculatePeriodStats(period) {
    const [year, month] = period.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    // Filter visits in period
    const periodVisits = this.visits.filter(v => {
      const visitDate = new Date(v.date);
      return visitDate >= startDate && visitDate <= endDate;
    });

    // Filter prospects created in period
    const newLeads = this.prospects.filter(p => {
      const createdDate = new Date(p.createdAt);
      return createdDate >= startDate && createdDate <= endDate;
    }).length;

    // Deals won in period
    const dealsWon = this.prospects.filter(p => {
      if (p.status !== 'won') return false;
      const updatedDate = new Date(p.updatedAt || p.createdAt);
      return updatedDate >= startDate && updatedDate <= endDate;
    }).length;

    const totalLeads = this.prospects.filter(p => {
      const createdDate = new Date(p.createdAt);
      return createdDate >= startDate && createdDate <= endDate;
    }).length;

    const conversionRate = totalLeads > 0 ? Math.round((dealsWon / totalLeads) * 100) : 0;

    return {
      totalVisits: periodVisits.length,
      newLeads,
      dealsWon,
      conversionRate
    };
  },

  renderLeaderboard() {
    // Get sales performance data
    const salesData = this.getSalesPerformance(this.currentPeriod);

    if (salesData.length === 0) {
      return '<p class="text-center text-gray">Belum ada data sales untuk periode ini</p>';
    }

    return `
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th style="width: 60px;">Rank</th>
              <th>Sales</th>
              <th class="text-center">Kunjungan</th>
              <th class="text-center">Deals Won</th>
              <th class="text-center">Target</th>
              <th>Progress</th>
            </tr>
          </thead>
          <tbody>
            ${salesData.map((s, i) => {
      const rank = i + 1;
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
      const progress = s.target > 0 ? Math.min(100, Math.round((s.dealsWon / s.target) * 100)) : 0;
      const progressColor = progress >= 100 ? '#10b981' : progress >= 70 ? '#f59e0b' : '#ef4444';

      return `
                <tr>
                  <td class="text-center" style="font-size: 1.2rem;">${medal}</td>
                  <td>
                    <strong>${s.name}</strong>
                    ${rank <= 3 ? '<span class="badge badge-warning ml-1">Top Performer</span>' : ''}
                  </td>
                  <td class="text-center">${s.visits}</td>
                  <td class="text-center"><strong>${s.dealsWon}</strong></td>
                  <td class="text-center">${s.target || '-'}</td>
                  <td style="width: 200px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <div style="flex: 1; background: #e5e7eb; border-radius: 4px; height: 8px; overflow: hidden;">
                        <div style="width: ${progress}%; background: ${progressColor}; height: 100%;"></div>
                      </div>
                      <span style="font-size: 12px; min-width: 40px;">${progress}%</span>
                    </div>
                  </td>
                </tr>
              `;
    }).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  getSalesPerformance(period) {
    const [year, month] = period.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    // Get unique salespeople from visits and prospects
    const salesMap = new Map();

    // Add from visits (using a default "Sales" if no specific user)
    this.visits.forEach(v => {
      const visitDate = new Date(v.date);
      if (visitDate >= startDate && visitDate <= endDate) {
        const salesName = v.salesPerson || 'Sales Team';
        if (!salesMap.has(salesName)) {
          salesMap.set(salesName, { name: salesName, visits: 0, dealsWon: 0, target: 0 });
        }
        salesMap.get(salesName).visits++;
      }
    });

    // Add deals won
    this.prospects.forEach(p => {
      if (p.status === 'won') {
        const updatedDate = new Date(p.updatedAt || p.createdAt);
        if (updatedDate >= startDate && updatedDate <= endDate) {
          const salesName = p.assignedTo || 'Sales Team';
          if (!salesMap.has(salesName)) {
            salesMap.set(salesName, { name: salesName, visits: 0, dealsWon: 0, target: 0 });
          }
          salesMap.get(salesName).dealsWon++;
        }
      }
    });

    // Add targets
    const periodTarget = this.targets.find(t => t.period === period);
    if (periodTarget && periodTarget.salesTargets) {
      periodTarget.salesTargets.forEach(st => {
        if (salesMap.has(st.salesName)) {
          salesMap.get(st.salesName).target = st.target;
        } else {
          salesMap.set(st.salesName, { name: st.salesName, visits: 0, dealsWon: 0, target: st.target });
        }
      });
    }

    // If no data, add default entry
    if (salesMap.size === 0) {
      salesMap.set('Sales Team', { name: 'Sales Team', visits: 0, dealsWon: 0, target: 5 });
    }

    // Sort by deals won (descending)
    return Array.from(salesMap.values()).sort((a, b) => b.dealsWon - a.dealsWon);
  },

  renderDailyPlanner() {
    const today = new Date().toISOString().split('T')[0];

    // Get overdue follow-ups
    const overdueProspects = this.prospects.filter(p => {
      if (!p.nextFollowUp) return false;
      return p.nextFollowUp <= today && !['won', 'lost'].includes(p.status);
    }).sort((a, b) => new Date(a.nextFollowUp) - new Date(b.nextFollowUp));

    // Get today's scheduled
    const todayScheduled = this.prospects.filter(p => {
      return p.nextFollowUp === today && !['won', 'lost'].includes(p.status);
    });

    // Get upcoming (next 7 days)
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = nextWeek.toISOString().split('T')[0];

    const upcoming = this.prospects.filter(p => {
      if (!p.nextFollowUp) return false;
      return p.nextFollowUp > today && p.nextFollowUp <= nextWeekStr && !['won', 'lost'].includes(p.status);
    }).sort((a, b) => new Date(a.nextFollowUp) - new Date(b.nextFollowUp));

    return `
      <!-- Overdue Alert -->
      ${overdueProspects.length > 0 ? `
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
          <div style="color: #dc2626; font-weight: 600; margin-bottom: 8px;">⚠️ Overdue Follow-up (${overdueProspects.length})</div>
          ${overdueProspects.slice(0, 5).map(p => `
            <div class="flex justify-between align-center" style="padding: 8px; background: white; border-radius: 4px; margin-bottom: 4px;">
              <div>
                <strong>${p.name}</strong>
                <span class="text-gray" style="font-size: 12px;"> - ${p.city || ''}</span>
                <div style="font-size: 11px; color: #dc2626;">Overdue: ${this.formatDate(p.nextFollowUp)}</div>
              </div>
              <button class="btn btn-sm btn-success" onclick="CRMProspect.showVisitModal('${p.id}')">
                📍 Log Visit
              </button>
            </div>
          `).join('')}
          ${overdueProspects.length > 5 ? `<div class="text-center text-gray" style="font-size: 12px;">+${overdueProspects.length - 5} lainnya</div>` : ''}
        </div>
      ` : ''}

      <!-- Today's Schedule -->
      <div style="margin-bottom: 16px;">
        <h4 style="margin-bottom: 8px;">📅 Jadwal Hari Ini (${todayScheduled.length})</h4>
        ${todayScheduled.length === 0 ?
        '<p class="text-gray">Tidak ada kunjungan terjadwal hari ini</p>' :
        todayScheduled.map(p => `
            <div class="flex justify-between align-center" style="padding: 12px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; margin-bottom: 8px;">
              <div>
                <strong>${p.name}</strong>
                <span class="badge badge-secondary ml-1">${p.category || 'Toko Emas'}</span>
                <div style="font-size: 13px; color: #6b7280;">${p.address || ''}, ${p.city || ''}</div>
                <div style="font-size: 12px; color: #6b7280;">📞 ${p.phone || '-'}</div>
              </div>
              <div class="flex gap-2">
                ${p.phone ? `<a href="tel:${p.phone}" class="btn btn-sm btn-secondary">📞</a>` : ''}
                <button class="btn btn-sm btn-success" onclick="CRMProspect.showVisitModal('${p.id}')">
                  ✅ Check-in
                </button>
              </div>
            </div>
          `).join('')
      }
      </div>

      <!-- Upcoming -->
      <div>
        <h4 style="margin-bottom: 8px;">📆 Upcoming (7 hari ke depan)</h4>
        ${upcoming.length === 0 ?
        '<p class="text-gray">Tidak ada follow-up terjadwal</p>' :
        `<div style="max-height: 250px; overflow-y: auto;">
            ${upcoming.map(p => `
              <div class="flex justify-between align-center" style="padding: 8px; border-bottom: 1px solid #e5e7eb;">
                <div>
                  <strong>${p.name}</strong> - ${p.city || ''}
                  <div style="font-size: 12px; color: #6b7280;">📅 ${this.formatDate(p.nextFollowUp)}</div>
                </div>
                <button class="btn btn-sm btn-info" onclick="CRMProspect.showDetail('${p.id}')">
                  👁️
                </button>
              </div>
            `).join('')}
          </div>`
      }
      </div>
    `;
  },

  showTargetModal() {
    const modalId = 'target-modal';
    let modal = document.getElementById(modalId);
    if (!modal) {
      modal = document.createElement('div');
      modal.id = modalId;
      modal.className = 'modal-overlay hidden';
      document.body.appendChild(modal);
    }

    const existingTarget = this.targets.find(t => t.period === this.currentPeriod);
    const defaultTarget = existingTarget?.defaultTarget || 5;

    modal.innerHTML = `
      <div class="modal" style="max-width: 500px; width: 95%;">
        <div class="modal-header">
          <h3 class="modal-title">⚙️ Set Target - ${this.formatPeriod(this.currentPeriod)}</h3>
          <button class="modal-close" onclick="CRMSalesTarget.closeModal('${modalId}')">×</button>
        </div>
        <div class="modal-body">
          <form id="target-form" onsubmit="CRMSalesTarget.saveTarget(event)">
            <div class="form-group">
              <label class="form-label">Target Deals per Sales</label>
              <input type="number" name="defaultTarget" class="form-input" value="${defaultTarget}" min="1" required>
              <small class="text-gray">Jumlah deals yang harus dicapai per sales</small>
            </div>
            
            <div class="flex justify-end gap-2 mt-3">
              <button type="button" class="btn btn-secondary" onclick="CRMSalesTarget.closeModal('${modalId}')">Batal</button>
              <button type="submit" class="btn btn-success">💾 Simpan Target</button>
            </div>
          </form>
        </div>
      </div>
    `;

    modal.classList.remove('hidden');
  },

  async saveTarget(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const defaultTarget = parseInt(formData.get('defaultTarget')) || 5;

    // Find or create period target
    let periodTarget = this.targets.find(t => t.period === this.currentPeriod);
    if (!periodTarget) {
      periodTarget = { period: this.currentPeriod, salesTargets: [] };
      this.targets.push(periodTarget);
    }
    periodTarget.defaultTarget = defaultTarget;

    // Apply default to all sales
    const salesData = this.getSalesPerformance(this.currentPeriod);
    periodTarget.salesTargets = salesData.map(s => ({
      salesName: s.name,
      target: defaultTarget
    }));

    this.saveTargets();
    this.closeModal('target-modal');
    this.render();
    this.showAlert('success', 'Target berhasil disimpan!');
  },

  changePeriod(period) {
    this.currentPeriod = period;
    this.render();
  },

  formatPeriod(period) {
    const [year, month] = period.split('-');
    const months = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return `${months[parseInt(month)]} ${year}`;
  },

  formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('hidden');
  },

  showAlert(type, message) {
    if (typeof ChartOfAccounts !== 'undefined' && ChartOfAccounts.showAlert) {
      ChartOfAccounts.showAlert(type, message);
    } else {
      alert(message);
    }
  }
};

window.CRMSalesTarget = CRMSalesTarget;
