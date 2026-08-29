// =========================================================================================
// BPJS & Tax Compliance Report (BPJS & PPh Reconciliation Module)
// Golden Alura ERP - Statutory Compliance & Statutory Payroll Audit Center
// =========================================================================================

const BPJSTaxCompliance = {
  activePeriod: '',
  isLoading: false,
  isAuthenticatedWithPassword: false,
  reconciliationData: [],
  summaryTotals: {},
  resignedEmployees: [],

  isPasswordAuthenticated() {
    if (this.isAuthenticatedWithPassword) return true;
    if (typeof Payroll !== 'undefined' && Payroll.isAuthenticatedWithPassword) {
      this.isAuthenticatedWithPassword = true;
      return true;
    }
    return false;
  },

  verifySpecialPassword() {
    const inputEl = document.getElementById('bpjs-special-password');
    const input = inputEl ? inputEl.value : '';
    if (input === 'GarPayroll_2025') {
      this.isAuthenticatedWithPassword = true;
      if (typeof Payroll !== 'undefined') {
        Payroll.isAuthenticatedWithPassword = true;
      }
      this.render();
      this.loadData();
    } else {
      alert('Password salah!');
    }
  },

  renderPasswordPrompt() {
    const content = document.getElementById('main-content');
    if (!content) return;
    content.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">📑 Rekonsiliasi BPJS & PPh 21</h1>
        <p class="page-description">Akses Terbatas & Kepatuhan Pajak / Ketenagakerjaan</p>
      </div>
      <div class="card" style="max-width: 420px; margin: 3rem auto; box-shadow: 0 10px 25px rgba(0,0,0,0.3); border-radius: 12px; border: 1px solid #334155;">
        <div class="card-body text-center" style="padding: 2.5rem 2rem;">
          <div style="font-size: 3rem; margin-bottom: 1rem;">🔐</div>
          <h3 style="margin-bottom: 0.75rem; color: #f8fafc; font-weight: 700;">Verifikasi Akses BPJS & Pajak</h3>
          <p class="text-gray mb-4" style="font-size: 13.5px; line-height: 1.5; color: #94a3b8;">
            Modul Rekonsiliasi BPJS & PPh 21 memuat data upah rahasia. Masukkan password khusus payroll untuk membuka akses.
          </p>
          <input type="password" id="bpjs-special-password" class="form-input" style="margin-bottom: 1.25rem; width: 100%; text-align: center; font-size: 15px; letter-spacing: 2px;" placeholder="Special Password..." onkeydown="if(event.key === 'Enter') BPJSTaxCompliance.verifySpecialPassword()">
          <button class="btn btn-primary" style="width: 100%; font-weight: 600; padding: 10px;" onclick="BPJSTaxCompliance.verifySpecialPassword()">Buka Akses Rekonsiliasi BPJS</button>
        </div>
      </div>
    `;
  },

  init() {
    if (typeof Auth !== 'undefined' && !Auth.isAuthenticated()) {
      window.location.href = 'login.html';
      return;
    }

    if (!this.isPasswordAuthenticated()) {
      this.renderPasswordPrompt();
      return;
    }

    // Default period: Current year-month (e.g. 2026-08)
    if (!this.activePeriod) {
      const now = new Date();
      const yr = now.getFullYear();
      const mo = String(now.getMonth() + 1).padStart(2, '0');
      this.activePeriod = `${yr}-${mo}`;
    }

    this.render();
    this.loadData();
  },

  setPeriod(period) {
    this.activePeriod = period;
    this.loadData();
  },

  getCutoffDates(periodStr) {
    const p = periodStr || this.activePeriod || new Date().toISOString().substring(0, 7);
    const [y, m] = p.split('-').map(Number);
    let py = y;
    let pm = m - 1;
    if (pm === 0) {
      pm = 12;
      py -= 1;
    }
    const startDateStr = `${py}-${String(pm).padStart(2, '0')}-26`;
    const endDateStr = `${p}-25`;
    return { startDateStr, endDateStr };
  },

  formatMoney(val) {
    if (val === undefined || val === null || isNaN(val)) return '0';
    const num = Math.round(Number(val));
    return num.toLocaleString('id-ID');
  },

  async loadData() {
    this.isLoading = true;
    this.renderLoading();

    try {
      const cutoff = this.getCutoffDates(this.activePeriod);

      // 1. Check if Payroll has closed/saved records for this period
      const allPayroll = typeof Storage !== 'undefined' && Storage.getPayroll ? Storage.getPayroll() : [];
      const periodPayroll = allPayroll.filter(p => p.period === this.activePeriod);

      const employees = typeof Storage !== 'undefined' && Storage.getEmployees ? Storage.getEmployees() : [];
      
      // Filter out inactive/resigned employees who resigned before this period's cutoff
      const activeEmployees = employees.filter(e => {
        const isPastOrCurrentJoin = !e.start_date || e.start_date <= cutoff.endDateStr;
        if (!isPastOrCurrentJoin) return false;

        const isInactive = e.status === 'NON-AKTIF' || e.status === 'inactive' || e.status === 'non_active';
        const resDate = e.resignation_date || e.resign_date;
        if (isInactive) {
          if (resDate && resDate < cutoff.startDateStr) return false;
        }
        return true;
      });

      // Find resigned employees relevant to this period's cutoff (for offboarding export)
      this.resignedEmployees = employees.filter(e => {
        const isInactive = e.status === 'NON-AKTIF' || e.status === 'inactive' || e.status === 'non_active';
        const resDate = e.resignation_date || e.resign_date;
        return isInactive && resDate && resDate >= cutoff.startDateStr && resDate <= cutoff.endDateStr;
      });

      // 2. Build or compute reconciliation list
      let rows = [];

      if (periodPayroll && periodPayroll.length > 0) {
        // Use finalized / saved snapshot from Payroll
        rows = periodPayroll.map(pay => {
          const emp = employees.find(e => String(e.nik) === String(pay.nik)) || {};
          
          const isBpjsHealthEnabled = emp.bpjs_health_enabled !== false;
          const isBpjsTkEnabled = emp.bpjs_tk_enabled !== false;

          // Raw Upah Dasar Kes
          const rawKesBase = emp.basic_salary_bpjs_kes !== undefined && emp.basic_salary_bpjs_kes !== ''
            ? parseFloat(emp.basic_salary_bpjs_kes)
            : (emp.bpjs_wage_basis !== undefined && emp.bpjs_wage_basis !== '' ? parseFloat(emp.bpjs_wage_basis) : (parseFloat(pay.base_salary || emp.base_salary) || 0));
          const bpjsKesBase = (isBpjsHealthEnabled && rawKesBase > 0) ? rawKesBase : 0;

          // Raw Upah Dasar TK
          const rawTkBase = emp.basic_salary_bpjs_tk !== undefined && emp.basic_salary_bpjs_tk !== ''
            ? parseFloat(emp.basic_salary_bpjs_tk)
            : (emp.bpjs_wage_basis !== undefined && emp.bpjs_wage_basis !== '' ? parseFloat(emp.bpjs_wage_basis) : (parseFloat(pay.base_salary || emp.base_salary) || 0));
          const bpjsTkBase = (isBpjsTkEnabled && rawTkBase > 0) ? rawTkBase : 0;

          // BPJS Kes: 1% Karyawan & 4% Perusahaan (Standard Mathematical Rounding)
          const kesEmp = bpjsKesBase > 0 ? Math.round(bpjsKesBase * 0.01) : 0;
          const kesComp = bpjsKesBase > 0 ? Math.round(bpjsKesBase * 0.04) : 0;
          const kesSubtotal = kesEmp + kesComp;

          // BPJS TK: JHT 2% Emp, JHT 3.7% Comp, JKK 0.89%, JKM 0.3% (Standard Mathematical Rounding)
          const jkkRate = (emp.jkk_risk_rate !== undefined && emp.jkk_risk_rate !== null && emp.jkk_risk_rate !== '') 
            ? (parseFloat(emp.jkk_risk_rate) / 100) 
            : 0.0089;
          const jhtEmp = bpjsTkBase > 0 ? Math.round(bpjsTkBase * 0.02) : 0;
          const jhtComp = bpjsTkBase > 0 ? Math.round(bpjsTkBase * 0.037) : 0;
          const jkkComp = bpjsTkBase > 0 ? Math.round(bpjsTkBase * jkkRate) : 0;
          const jkmComp = bpjsTkBase > 0 ? Math.round(bpjsTkBase * 0.003) : 0;
          const tkSubtotal = jhtEmp + jhtComp + jkkComp + jkmComp;

          // PPh 21 TER: Diambil dari Bruto Kena Pajak + PTKP
          const ptkp = emp.ptkp || pay.ptkp || 'TK/0';
          
          let customEarnings = 0;
          Object.entries(pay.custom_components || {}).forEach(([name, data]) => {
            if (data && data.type === 'earnings' && data.amount > 0) {
              customEarnings += Number(data.amount || 0);
            }
          });

          const isFixedAllowanceEnabled = emp.fixed_allowance_enabled !== false;
          const fixedAllowance = Number(pay.fixed_allowance || pay.tunj_tetap || pay.tunjangan_tetap || (isFixedAllowanceEnabled ? (emp.fixed_allowance || 0) : 0));
          const isVarAllowanceEnabled = emp.variable_allowance_enabled !== false;
          const varAllowance = Number(pay.variable_allowance || pay.tunj_variabel || (isVarAllowanceEnabled ? (emp.variable_allowance || 0) : 0));

          const totalAllowance = fixedAllowance +
                                 varAllowance +
                                 Number(pay.meal_pay || pay.meal_allowance || 0) +
                                 Number(pay.night_meal_pay || 0) +
                                 Number(pay.presence_pay || pay.tunj_kehadiran || 0) +
                                 Number(pay.production_pay || pay.bonus_produksi || 0) +
                                 Number(pay.overtime_pay || pay.uang_lembur || 0) +
                                 Number(pay.transport_allowance || pay.tunj_transport || (emp.transport_allowance || 0)) +
                                 Number(pay.position_allowance || pay.tunj_jabatan || (emp.position_allowance || 0)) +
                                 Number(pay.tunj_luar_kota || pay.dinas_luar_kota || 0) +
                                 Number(pay.bonus || pay.thr || 0) +
                                 Number(pay.adhoc_allowance || 0) +
                                 Number(pay.previous_month_deficiency || pay.selisih_kurang_gaji || 0) +
                                 customEarnings;

          const baseEarnings = parseFloat(pay.total_earnings) || ((parseFloat(pay.base_salary || emp.base_salary) || 0) + totalAllowance);
          const taxableGross = baseEarnings + kesComp + jkkComp + jkmComp;

          let pph21 = 0;
          let terRate = 0;
          let terCat = 'A';
          if (typeof TaxEngineTER !== 'undefined') {
            const terRes = TaxEngineTER.calculatePPh21(ptkp, taxableGross);
            pph21 = Math.round(terRes.taxAmount);
            terRate = terRes.ratePct;
            terCat = terRes.category;
          } else {
            pph21 = Math.round(pay.pph21_deduction || 0);
            terRate = pay.ter_rate || 0;
            terCat = pay.ter_category || 'A';
          }

          const totalEmpDeduction = kesEmp + jhtEmp + pph21;
          const totalCompContribution = kesComp + jhtComp + jkkComp + jkmComp;
          const grandTotalRemittance = totalEmpDeduction + totalCompContribution;

          return {
            id: pay.id || emp.id,
            nik: pay.nik,
            name: pay.name || emp.name,
            department: pay.department || emp.department || 'PROD',
            position: pay.position || emp.position || '-',
            ptkp,
            npwp: pay.npwp || emp.npwp || '-',
            isBpjsHealthEnabled,
            isBpjsTkEnabled,
            bpjsKesBase,
            kesEmp,
            kesComp,
            kesSubtotal,
            bpjsTkBase,
            jhtEmp,
            jhtComp,
            jkkComp,
            jkmComp,
            tkSubtotal,
            // Full allowances breakdown for Drawer
            fixed_allowance: fixedAllowance,
            variable_allowance: varAllowance,
            meal_pay: Number(pay.meal_pay || pay.meal_allowance || 0),
            night_meal_pay: Number(pay.night_meal_pay || 0),
            presence_pay: Number(pay.presence_pay || pay.tunj_kehadiran || 0),
            production_pay: Number(pay.production_pay || pay.bonus_produksi || 0),
            overtime_pay: Number(pay.overtime_pay || pay.uang_lembur || 0),
            overtime_hours: Number(pay.overtime_hours || 0),
            transport_allowance: Number(pay.transport_allowance || pay.tunj_transport || (emp.transport_allowance || 0)),
            position_allowance: Number(pay.position_allowance || pay.tunj_jabatan || (emp.position_allowance || 0)),
            tunj_luar_kota: Number(pay.tunj_luar_kota || pay.dinas_luar_kota || 0),
            bonus: Number(pay.bonus || pay.thr || 0),
            adhoc_allowance: Number(pay.adhoc_allowance || 0),
            previous_month_deficiency: Number(pay.previous_month_deficiency || pay.selisih_kurang_gaji || 0),
            custom_components: pay.custom_components || {},
            work_days: pay.work_days || 0,
            totalAllowance,
            taxableGross,
            terCat,
            terRate,
            pph21,
            totalEmpDeduction,
            totalCompContribution,
            grandTotalRemittance
          };
        });
      } else {
        // Calculate live simulation for preview if payroll not generated yet
        let simulatedList = [];
        if (typeof Payroll !== 'undefined' && Payroll.calculatePayrollSimulation) {
          simulatedList = await Payroll.calculatePayrollSimulation(activeEmployees, this.activePeriod, {});
        }

        rows = activeEmployees.map(emp => {
          const sim = simulatedList.find(s => String(s.nik) === String(emp.nik)) || {};
          const isBpjsHealthEnabled = emp.bpjs_health_enabled !== false;
          const isBpjsTkEnabled = emp.bpjs_tk_enabled !== false;

          // Raw Upah Dasar Kes
          const rawKesBase = emp.basic_salary_bpjs_kes !== undefined && emp.basic_salary_bpjs_kes !== ''
            ? parseFloat(emp.basic_salary_bpjs_kes)
            : (emp.bpjs_wage_basis !== undefined && emp.bpjs_wage_basis !== '' ? parseFloat(emp.bpjs_wage_basis) : (parseFloat(emp.base_salary || emp.basic_salary) || 0));
          const bpjsKesBase = (isBpjsHealthEnabled && rawKesBase > 0) ? rawKesBase : 0;

          // Raw Upah Dasar TK
          const rawTkBase = emp.basic_salary_bpjs_tk !== undefined && emp.basic_salary_bpjs_tk !== ''
            ? parseFloat(emp.basic_salary_bpjs_tk)
            : (emp.bpjs_wage_basis !== undefined && emp.bpjs_wage_basis !== '' ? parseFloat(emp.bpjs_wage_basis) : (parseFloat(emp.base_salary || emp.basic_salary) || 0));
          const bpjsTkBase = (isBpjsTkEnabled && rawTkBase > 0) ? rawTkBase : 0;

          // BPJS Kes: 1% Karyawan & 4% Perusahaan (Standard Mathematical Rounding)
          const kesEmp = bpjsKesBase > 0 ? Math.round(bpjsKesBase * 0.01) : 0;
          const kesComp = bpjsKesBase > 0 ? Math.round(bpjsKesBase * 0.04) : 0;
          const kesSubtotal = kesEmp + kesComp;

          // BPJS TK: JHT 2% Emp, JHT 3.7% Comp, JKK 0.89%, JKM 0.3% (Standard Mathematical Rounding)
          const jkkRate = (emp.jkk_risk_rate !== undefined && emp.jkk_risk_rate !== null && emp.jkk_risk_rate !== '') 
            ? (parseFloat(emp.jkk_risk_rate) / 100) 
            : 0.0089;
          const jhtEmp = bpjsTkBase > 0 ? Math.round(bpjsTkBase * 0.02) : 0;
          const jhtComp = bpjsTkBase > 0 ? Math.round(bpjsTkBase * 0.037) : 0;
          const jkkComp = bpjsTkBase > 0 ? Math.round(bpjsTkBase * jkkRate) : 0;
          const jkmComp = bpjsTkBase > 0 ? Math.round(bpjsTkBase * 0.003) : 0;
          const tkSubtotal = jhtEmp + jhtComp + jkkComp + jkmComp;

          const baseSalary = parseFloat(emp.base_salary || emp.basic_salary) || 0;
          const totalAllowance = Number(sim.meal_pay || (emp.lunch_allowance_enabled !== false ? 25 * 20000 : 0)) +
                                 Number(sim.overtime_pay || 0) +
                                 Number(sim.production_pay || 0) +
                                 Number(sim.presence_pay || 0) +
                                 Number(sim.fixed_allowance || emp.fixed_allowance || 0) +
                                 Number(sim.variable_allowance || emp.variable_allowance || 0);

          const totalEarnings = sim.total_earnings || (baseSalary + totalAllowance);
          const taxableGross = totalEarnings + kesComp + jkkComp + jkmComp;

          const ptkp = emp.ptkp || 'TK/0';
          let pph21 = 0;
          let terRate = 0;
          let terCat = 'A';
          if (typeof TaxEngineTER !== 'undefined') {
            const terRes = TaxEngineTER.calculatePPh21(ptkp, taxableGross);
            pph21 = Math.round(terRes.taxAmount);
            terRate = terRes.ratePct;
            terCat = terRes.category;
          }

          const totalEmpDeduction = kesEmp + jhtEmp + pph21;
          const totalCompContribution = kesComp + jhtComp + jkkComp + jkmComp;
          const grandTotalRemittance = totalEmpDeduction + totalCompContribution;

          return {
            id: emp.id,
            nik: emp.nik,
            name: emp.name,
            department: emp.department || 'PROD',
            position: emp.position || '-',
            status: emp.status || 'AKTIF',
            resignation_date: emp.resignation_date || emp.resign_date || null,
            ptkp,
            npwp: emp.npwp || '-',
            isBpjsHealthEnabled,
            isBpjsTkEnabled,
            bpjsKesBase,
            kesEmp,
            kesComp,
            kesSubtotal,
            bpjsTkBase,
            jhtEmp,
            jhtComp,
            jkkComp,
            jkmComp,
            tkSubtotal,
            // Full allowances breakdown for Drawer
            fixed_allowance: Number(sim.fixed_allowance || emp.fixed_allowance || 0),
            variable_allowance: Number(sim.variable_allowance || emp.variable_allowance || 0),
            meal_pay: Number(sim.meal_pay || (emp.lunch_allowance_enabled !== false ? 25 * 20000 : 0)),
            night_meal_pay: Number(sim.night_meal_pay || 0),
            presence_pay: Number(sim.presence_pay || 0),
            production_pay: Number(sim.production_pay || 0),
            overtime_pay: Number(sim.overtime_pay || 0),
            overtime_hours: Number(sim.overtime_hours || 0),
            transport_allowance: Number(sim.transport_allowance || emp.transport_allowance || 0),
            position_allowance: Number(sim.position_allowance || emp.position_allowance || 0),
            tunj_luar_kota: Number(sim.tunj_luar_kota || 0),
            bonus: Number(sim.bonus || 0),
            adhoc_allowance: Number(sim.adhoc_allowance || 0),
            previous_month_deficiency: Number(sim.previous_month_deficiency || 0),
            custom_components: sim.custom_components || {},
            work_days: sim.work_days || 25,
            totalAllowance,
            taxableGross,
            terCat,
            terRate,
            pph21,
            totalEmpDeduction,
            totalCompContribution,
            grandTotalRemittance
          };
        });
      }

      this.reconciliationData = rows;

      // 3. Compute Totals
      this.summaryTotals = rows.reduce((acc, r) => {
        acc.bpjsKesBase = (acc.bpjsKesBase || 0) + r.bpjsKesBase;
        acc.kesEmp = (acc.kesEmp || 0) + r.kesEmp;
        acc.kesComp = (acc.kesComp || 0) + r.kesComp;
        acc.kesSubtotal = (acc.kesSubtotal || 0) + r.kesSubtotal;

        acc.bpjsTkBase = (acc.bpjsTkBase || 0) + r.bpjsTkBase;
        acc.jhtEmp = (acc.jhtEmp || 0) + r.jhtEmp;
        acc.jhtComp = (acc.jhtComp || 0) + r.jhtComp;
        acc.jkkComp = (acc.jkkComp || 0) + r.jkkComp;
        acc.jkmComp = (acc.jkmComp || 0) + r.jkmComp;
        acc.tkSubtotal = (acc.tkSubtotal || 0) + r.tkSubtotal;

        acc.totalAllowance = (acc.totalAllowance || 0) + (r.totalAllowance || 0);
        acc.taxableGross = (acc.taxableGross || 0) + r.taxableGross;
        acc.pph21 = (acc.pph21 || 0) + r.pph21;

        acc.totalEmpDeduction = (acc.totalEmpDeduction || 0) + r.totalEmpDeduction;
        acc.totalCompContribution = (acc.totalCompContribution || 0) + r.totalCompContribution;
        acc.grandTotalRemittance = (acc.grandTotalRemittance || 0) + r.grandTotalRemittance;
        return acc;
      }, {});

    } catch (err) {
      console.error('Error loading BPJS Tax Reconciliation:', err);
    } finally {
      this.isLoading = false;
      this.render();
    }
  },

  isPeriodLocked() {
    if (typeof Payroll !== 'undefined' && Payroll.isWorkdaysLocked) {
      const origPeriod = Payroll.period;
      Payroll.period = this.activePeriod;
      const locked = Payroll.isWorkdaysLocked();
      Payroll.period = origPeriod;
      return locked;
    }
    const today = new Date();
    const curMonth = today.toISOString().substring(0, 7);
    return this.activePeriod < curMonth;
  },

  renderLoading() {
    const tableContainer = document.getElementById('compliance-table-container');
    if (tableContainer) {
      tableContainer.innerHTML = `
        <div style="text-align: center; padding: 60px 20px;">
          <div class="spinner" style="border: 4px solid rgba(255,255,255,0.1); border-top: 4px solid #3b82f6; border-radius: 50%; width: 44px; height: 44px; animation: spin 1s linear infinite; margin: 0 auto 16px auto;"></div>
          <h4 style="margin: 0; color: #94a3b8;">Sedang Mengkalkulasi Rekonsiliasi BPJS & PPh 21...</h4>
          <p style="margin: 6px 0 0 0; color: #64748b; font-size: 13px;">Sinkronisasi Upah Dasar, Tarif Statutori, dan Tabel PPh TER DJP (PP 58/2023)</p>
        </div>
      `;
    }
  },

  render() {
    if (!this.isPasswordAuthenticated()) {
      this.renderPasswordPrompt();
      return;
    }

    const content = document.getElementById('main-content');
    if (!content) return;

    const isLocked = this.isPeriodLocked();
    const t = this.summaryTotals || {};
    const resignedCount = (this.resignedEmployees || []).length;

    // Available periods (last 12 months)
    const periods = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('id-ID', { month: 'long', year: 'numeric' });
      periods.push({ val, label });
    }

    content.innerHTML = `
      <style>
        .compliance-table th, .compliance-table td {
          padding: 8px 10px;
          font-size: 12px;
          border-bottom: 1px solid #334155;
          white-space: nowrap;
        }
        .compliance-table th {
          background-color: #0f172a;
          color: #f8fafc;
          font-weight: 600;
        }
        .compliance-table-container {
          max-height: 540px;
          overflow: auto;
          border: 1px solid #334155;
          border-radius: 8px;
        }
        .compliance-table-container thead th {
          position: sticky;
          top: 0;
          z-index: 2;
        }
        .compliance-table-container tfoot th {
          position: sticky;
          bottom: 0;
          background: #1e293b;
          z-index: 2;
          border-top: 2px solid #3b82f6;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>

      <div class="page-header" style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px; margin-bottom: 20px;">
        <div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <h1 class="page-title" style="margin: 0; font-size: 1.6rem; font-weight: 700; color: #f8fafc;">📑 BPJS & PPh Reconciliation Report</h1>
            <span class="badge ${isLocked ? 'badge-success' : 'badge-warning'}" style="font-size: 0.8rem; padding: 4px 10px; border-radius: 6px;">
              ${isLocked ? '🔒 Periode Terkunci (Locked)' : '🔓 Periode Terbuka (Draft)'}
            </span>
          </div>
          <p class="page-description" style="margin: 6px 0 0 0; color: #94a3b8; font-size: 0.9rem;">
            Laporan Kepatuhan Statutori: Rekonsiliasi Iuran BPJS Kesehatan, BPJS Ketenagakerjaan (JKK, JKM, JHT), dan PPh 21 TER
          </p>
        </div>

        <!-- Filter & Action Controls -->
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; background: #1e293b; border: 1px solid #475569; border-radius: 6px; padding: 4px 10px; gap: 8px;">
            <label style="color: #94a3b8; font-size: 12px; font-weight: 600;">Periode:</label>
            <select id="compliance-period-select" class="form-select" style="background: transparent; color: #f8fafc; border: none; font-weight: bold; cursor: pointer; padding: 4px;" onchange="BPJSTaxCompliance.setPeriod(this.value)">
              ${periods.map(p => `<option value="${p.val}" ${p.val === this.activePeriod ? 'selected' : ''} style="background: #1e293b; color: #f8fafc;">${p.label} (${p.val})</option>`).join('')}
            </select>
          </div>

          <button class="btn btn-primary" onclick="BPJSTaxCompliance.loadData()" style="display: flex; align-items: center; gap: 6px;">
            🔄 Tampilkan Data
          </button>

          <button class="btn btn-success" onclick="BPJSTaxCompliance.exportToExcel()" style="display: flex; align-items: center; gap: 6px; background-color: #16a34a; border-color: #16a34a; font-weight: bold;">
            📊 Export Excel (XLSX)
          </button>

          <button class="btn btn-outline" onclick="BPJSTaxCompliance.exportToPDF()" style="display: flex; align-items: center; gap: 6px; border: 1px solid #3b82f6; color: #60a5fa;">
            📄 Export PDF
          </button>
        </div>
      </div>

      <!-- PROACTIVE BPJS CUT-OFF & MUTATION GUARD BANNER -->
      ${resignedCount > 0 ? `
        <div class="card mb-3" style="background: linear-gradient(135deg, #451a03 0%, #78350f 100%); border: 1px solid #d97706; border-radius: 10px; padding: 14px 18px; color: #fef3c7; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 20px;">🛡️</span>
                <strong style="font-size: 14px; color: #fef08a;">Pengingat Cut-Off Mutasi Keluar BPJS (${resignedCount} Karyawan Non-Aktif/Resign)</strong>
              </div>
              <p style="margin: 4px 0 0 28px; font-size: 12px; color: #fde68a;">
                Agar iuran BPJS bulan depan <strong>tidak tertagih oleh BPJS</strong>, segera unduh file mutasi berikut dan upload ke portal <strong>SIPP Online (BPJS TK)</strong> & <strong>e-Dabu (BPJS Kesehatan)</strong> sebelum batas cut-off (tgl 25).
              </p>
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button class="btn btn-warning" onclick="BPJSTaxCompliance.exportSippOffboarding('${this.activePeriod}')" style="background: #f59e0b; border: none; color: #1e1b4b; font-weight: bold; font-size: 12px; padding: 6px 12px; border-radius: 6px;">
                📥 Export SIPP BPJS TK (.xlsx)
              </button>
              <button class="btn btn-success" onclick="BPJSTaxCompliance.exportEdabuOffboarding('${this.activePeriod}')" style="background: #10b981; border: none; color: #ffffff; font-weight: bold; font-size: 12px; padding: 6px 12px; border-radius: 6px;">
                📥 Export e-Dabu BPJS Kes (.xlsx)
              </button>
            </div>
          </div>
        </div>
      ` : ''}

      <!-- METRIC CARDS ROW -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-bottom: 20px;">
        
        <!-- CARD 1: BPJS KES -->
        <div class="card" style="background: linear-gradient(135deg, #064e3b, #047857); border: 1px solid #059669; border-radius: 10px; padding: 14px; color: white;">
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.85;">🏥 Total BPJS Kesehatan</div>
          <div style="font-size: 1.4rem; font-weight: 800; margin: 4px 0;">Rp ${this.formatMoney(t.kesSubtotal || 0)}</div>
          <div style="font-size: 11px; opacity: 0.9; display: flex; justify-content: space-between;">
            <span>Emp (1%): Rp ${this.formatMoney(t.kesEmp || 0)}</span>
            <span>Comp (4%): Rp ${this.formatMoney(t.kesComp || 0)}</span>
          </div>
        </div>

        <!-- CARD 2: BPJS TK -->
        <div class="card" style="background: linear-gradient(135deg, #1e3a8a, #2563eb); border: 1px solid #3b82f6; border-radius: 10px; padding: 14px; color: white;">
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.85;">🛡️ Total BPJS TK (JHT+JKK+JKM)</div>
          <div style="font-size: 1.4rem; font-weight: 800; margin: 4px 0;">Rp ${this.formatMoney(t.tkSubtotal || 0)}</div>
          <div style="font-size: 11px; opacity: 0.9; display: flex; justify-content: space-between;">
            <span>JHT Emp (2%): Rp ${this.formatMoney(t.jhtEmp || 0)}</span>
            <span>Comp: Rp ${this.formatMoney((t.jhtComp || 0) + (t.jkkComp || 0) + (t.jkmComp || 0))}</span>
          </div>
        </div>

        <!-- CARD 3: PPH 21 -->
        <div class="card" style="background: linear-gradient(135deg, #701a75, #a21caf); border: 1px solid #c026d3; border-radius: 10px; padding: 14px; color: white;">
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.85;">🏛️ Total PPh 21 TER</div>
          <div style="font-size: 1.4rem; font-weight: 800; margin: 4px 0;">Rp ${this.formatMoney(t.pph21 || 0)}</div>
          <div style="font-size: 11px; opacity: 0.9;">
            <span>Bruto TER: Rp ${this.formatMoney(t.taxableGross || 0)}</span>
          </div>
        </div>

        <!-- CARD 4: BEBAN PERUSAHAAN -->
        <div class="card" style="background: linear-gradient(135deg, #7c2d12, #c2410c); border: 1px solid #ea580c; border-radius: 10px; padding: 14px; color: white;">
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.85;">💼 Total Beban Perusahaan</div>
          <div style="font-size: 1.4rem; font-weight: 800; margin: 4px 0;">Rp ${this.formatMoney(t.totalCompContribution || 0)}</div>
          <div style="font-size: 11px; opacity: 0.9;">
            <span>BPJS Kes 4% + BPJS TK 4.89%</span>
          </div>
        </div>

        <!-- CARD 5: GRAND TOTAL SETORAN -->
        <div class="card" style="background: linear-gradient(135deg, #0f172a, #1e293b); border: 1px solid #38bdf8; border-radius: 10px; padding: 14px; color: #38bdf8;">
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8;">💵 Total Penyetoran Statutori</div>
          <div style="font-size: 1.4rem; font-weight: 800; margin: 4px 0; color: #38bdf8;">Rp ${this.formatMoney(t.grandTotalRemittance || 0)}</div>
          <div style="font-size: 11px; color: #94a3b8;">
            <span>Total Karyawan + Beban Perusahaan</span>
          </div>
        </div>

      </div>

      <!-- MAIN SECTION: LIVE PREVIEW TABLE -->
      <div class="card" style="background: #1e293b; border: 1px solid #334155; border-radius: 10px; overflow: hidden;">
        <div class="card-header" style="background: #0f172a; border-bottom: 1px solid #334155; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <h3 style="margin: 0; font-size: 1rem; color: #f8fafc; font-weight: 600;">
            📋 Rincian Matriks Kepatuhan per Karyawan (${this.reconciliationData.length} Karyawan Aktif)
          </h3>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button class="btn btn-sm btn-outline" onclick="BPJSTaxCompliance.exportSippOffboarding()" style="font-size: 11px; border: 1px solid #f59e0b; color: #f59e0b;">
              📄 Template SIPP Keluar
            </button>
            <button class="btn btn-sm btn-outline" onclick="BPJSTaxCompliance.exportEdabuOffboarding()" style="font-size: 11px; border: 1px solid #10b981; color: #10b981;">
              📄 Template e-Dabu Non-Aktif
            </button>
          </div>
        </div>
        
        <div class="card-body" style="padding: 0;">
          <div id="compliance-table-container">
            ${this.renderTable()}
          </div>
        </div>
      </div>
    `;
  },

  renderTable() {
    if (!this.reconciliationData || this.reconciliationData.length === 0) {
      return `
        <div style="padding: 40px; text-align: center; color: #94a3b8;">
          <p style="font-size: 16px; margin-bottom: 8px;">Belum ada data rekonsiliasi untuk periode ${this.activePeriod}.</p>
          <button class="btn btn-primary" onclick="BPJSTaxCompliance.loadData()">Muat Ulang Data</button>
        </div>
      `;
    }

    const t = this.summaryTotals || {};

    return `
      <div class="compliance-table-container">
        <table class="table compliance-table" style="width: 100%; border-collapse: collapse; margin: 0;">
          <thead>
            <tr style="border-bottom: 2px solid #475569;">
              <th rowspan="2" class="sticky-no" style="text-align: center;">No</th>
              <th rowspan="2" class="sticky-nik" style="text-align: left;">NIK</th>
              <th rowspan="2" class="sticky-nama" style="text-align: left;">Nama Pegawai</th>
              <th rowspan="2" style="text-align: left;">Departemen</th>
              
              <!-- BPJS KES (4 Kolom) -->
              <th colspan="4" style="text-align: center; background: #064e3b; border-left: 1px solid #059669; border-right: 1px solid #059669;">🏥 BPJS Kesehatan</th>
              
              <!-- BPJS TK (6 Kolom) -->
              <th colspan="6" style="text-align: center; background: #1e3a8a; border-right: 1px solid #3b82f6;">🛡️ BPJS Ketenagakerjaan</th>
              
              <!-- PPH 21 TER (5 Kolom: Total Tunjangan, PTKP, Bruto TER, Tarif %, PPh 21 TER) -->
              <th colspan="5" style="text-align: center; background: #701a75; border-right: 1px solid #c026d3;">🏛️ PPh 21 TER (PP 58/2023)</th>

              <!-- REKONSILIASI FINAL (3 Kolom) -->
              <th colspan="3" style="text-align: center; background: #0f172a;">💵 Total Statutori</th>
            </tr>
            <tr style="background: #1e293b;">
              <!-- BPJS Kes Sub-headers -->
              <th style="text-align: right; background: #064e3b;">Upah Dasar Kes</th>
              <th style="text-align: right; background: #064e3b;">Emp (1%)</th>
              <th style="text-align: right; background: #064e3b;">Comp (4%)</th>
              <th style="text-align: right; background: #064e3b;">Subtotal Kes (5%)</th>

              <!-- BPJS TK Sub-headers -->
              <th style="text-align: right; background: #1e3a8a;">Upah Dasar TK</th>
              <th style="text-align: right; background: #1e3a8a;">JHT Emp (2%)</th>
              <th style="text-align: right; background: #1e3a8a;">JHT Comp (3.7%)</th>
              <th style="text-align: right; background: #1e3a8a;">JKK Comp (0.89%)</th>
              <th style="text-align: right; background: #1e3a8a;">JKM Comp (0.3%)</th>
              <th style="text-align: right; background: #1e3a8a;">Subtotal TK</th>

              <!-- PPh 21 Sub-headers: Total Tunjangan + PTKP sebelum Bruto & PPh TER -->
              <th style="text-align: right; background: #701a75; color: #34d399; font-weight: bold;">Total Tunjangan</th>
              <th style="text-align: center; background: #701a75; font-weight: bold; color: #fde047;">PTKP</th>
              <th style="text-align: right; background: #701a75;">Bruto TER</th>
              <th style="text-align: center; background: #701a75;">Tarif %</th>
              <th style="text-align: right; background: #701a75;">PPh 21 TER</th>

              <!-- Total Sub-headers -->
              <th style="text-align: right; background: #1e293b; color: #f87171;">Pot. Karyawan</th>
              <th style="text-align: right; background: #1e293b; color: #fb923c;">Beban Perusahaan</th>
              <th style="text-align: right; background: #1e293b; color: #38bdf8; font-weight: bold;">Grand Total</th>
            </tr>
          </thead>
          <tbody>
            ${this.reconciliationData.map((row, idx) => {
              return `
                <tr style="background: ${idx % 2 === 0 ? '#1e293b' : '#182234'};">
                  <td class="sticky-no" style="text-align: center; color: #94a3b8;">${idx + 1}</td>
                  <td class="sticky-nik"><span class="badge badge-secondary" style="font-size: 11px;">${row.nik}</span></td>
                  <td class="sticky-nama">
                    <strong>${row.name}</strong>
                    ${!row.isBpjsHealthEnabled || !row.isBpjsTkEnabled ? '<span class="badge badge-warning" style="font-size: 9px; margin-left: 4px;" title="BPJS Dinonaktifkan di Master Karyawan">Non-BPJS</span>' : ''}
                  </td>
                  <td>${row.department}</td>

                  <!-- Kes -->
                  <td style="text-align: right; color: #94a3b8;">${this.formatMoney(row.bpjsKesBase)}</td>
                  <td style="text-align: right; color: #34d399;">${this.formatMoney(row.kesEmp)}</td>
                  <td style="text-align: right; color: #6ee7b7;">${this.formatMoney(row.kesComp)}</td>
                  <td style="text-align: right; font-weight: 600; color: #a7f3d0;">${this.formatMoney(row.kesSubtotal)}</td>

                  <!-- TK -->
                  <td style="text-align: right; color: #94a3b8;">${this.formatMoney(row.bpjsTkBase)}</td>
                  <td style="text-align: right; color: #60a5fa;">${this.formatMoney(row.jhtEmp)}</td>
                  <td style="text-align: right; color: #93c5fd;">${this.formatMoney(row.jhtComp)}</td>
                  <td style="text-align: right; color: #93c5fd;">${this.formatMoney(row.jkkComp)}</td>
                  <td style="text-align: right; color: #93c5fd;">${this.formatMoney(row.jkmComp)}</td>
                  <td style="text-align: right; font-weight: 600; color: #bfdbfe;">${this.formatMoney(row.tkSubtotal)}</td>

                  <!-- PPh (Total Tunjangan Drawer + PTKP + Bruto TER + PPh) -->
                  <td style="text-align: right; background: rgba(16, 185, 129, 0.05); vertical-align: middle;">
                    <button class="btn btn-sm" onclick="BPJSTaxCompliance.openAllowanceDrawer('${row.id}', ${idx})"
                            style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.4); font-weight: 600; padding: 2px 6px; font-size: 11px; border-radius: 5px; cursor: pointer; display: inline-flex; align-items: center; gap: 3px;"
                            title="Klik untuk melihat rincian transparan komponen tunjangan & lembur">
                      <span>Rp ${this.formatMoney(row.totalAllowance || 0)}</span>
                      <span style="font-size: 10px; opacity: 0.9;">🔍</span>
                    </button>
                  </td>
                  <td style="text-align: center;"><span class="badge badge-info" style="font-size: 10px; font-weight: bold;">${row.ptkp}</span></td>
                  <td style="text-align: right; color: #94a3b8;">${this.formatMoney(row.taxableGross)}</td>
                  <td style="text-align: center; color: #f0abfc;">${row.terRate}% (${row.terCat})</td>
                  <td style="text-align: right; font-weight: 600; color: #f472b6;">${this.formatMoney(row.pph21)}</td>

                  <!-- Total Statutori -->
                  <td style="text-align: right; font-weight: 600; color: #f87171;">${this.formatMoney(row.totalEmpDeduction)}</td>
                  <td style="text-align: right; font-weight: 600; color: #fb923c;">${this.formatMoney(row.totalCompContribution)}</td>
                  <td style="text-align: right; font-weight: 800; color: #38bdf8;">${this.formatMoney(row.grandTotalRemittance)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
          <tfoot>
            <tr style="font-weight: bold; background: #0f172a; color: #f8fafc;">
              <th colspan="4" style="text-align: right; padding: 10px;">TOTAL REKONSILIASI:</th>
              
              <!-- Kes Totals -->
              <th style="text-align: right;">${this.formatMoney(t.bpjsKesBase || 0)}</th>
              <th style="text-align: right; color: #34d399;">${this.formatMoney(t.kesEmp || 0)}</th>
              <th style="text-align: right; color: #6ee7b7;">${this.formatMoney(t.kesComp || 0)}</th>
              <th style="text-align: right; color: #a7f3d0;">${this.formatMoney(t.kesSubtotal || 0)}</th>

              <!-- TK Totals -->
              <th style="text-align: right;">${this.formatMoney(t.bpjsTkBase || 0)}</th>
              <th style="text-align: right; color: #60a5fa;">${this.formatMoney(t.jhtEmp || 0)}</th>
              <th style="text-align: right; color: #93c5fd;">${this.formatMoney(t.jhtComp || 0)}</th>
              <th style="text-align: right; color: #93c5fd;">${this.formatMoney(t.jkkComp || 0)}</th>
              <th style="text-align: right; color: #93c5fd;">${this.formatMoney(t.jkmComp || 0)}</th>
              <th style="text-align: right; color: #bfdbfe;">${this.formatMoney(t.tkSubtotal || 0)}</th>

              <!-- PPh Totals -->
              <th style="text-align: right; color: #34d399;">${this.formatMoney(t.totalAllowance || 0)}</th>
              <th style="text-align: center;">-</th>
              <th style="text-align: right;">${this.formatMoney(t.taxableGross || 0)}</th>
              <th style="text-align: center;">-</th>
              <th style="text-align: right; color: #f472b6;">${this.formatMoney(t.pph21 || 0)}</th>

              <!-- Final Totals -->
              <th style="text-align: right; color: #f87171;">${this.formatMoney(t.totalEmpDeduction || 0)}</th>
              <th style="text-align: right; color: #fb923c;">${this.formatMoney(t.totalCompContribution || 0)}</th>
              <th style="text-align: right; color: #38bdf8; font-size: 13px;">${this.formatMoney(t.grandTotalRemittance || 0)}</th>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
  },

  openAllowanceDrawer(id, idx) {
    let row = null;
    if (idx !== undefined && idx !== null && this.reconciliationData && this.reconciliationData[idx]) {
      row = this.reconciliationData[idx];
    } else if (id && this.reconciliationData) {
      row = this.reconciliationData.find(r => String(r.id) === String(id)) ||
            this.reconciliationData.find(r => String(r.nik) === String(id));
    }
    
    if (!row && typeof Storage !== 'undefined' && Storage.getPayroll) {
      const allPay = Storage.getPayroll() || [];
      row = allPay.find(p => p.period === this.activePeriod && (String(p.id) === String(id) || String(p.nik) === String(id))) ||
            allPay.find(p => String(p.id) === String(id) || String(p.nik) === String(id));
    }

    if (!row) {
      alert('Data rincian karyawan tidak ditemukan.');
      return;
    }

    this.closeAllowanceDrawer();

    let customEarningsSum = 0;
    const customEarningsList = [];
    Object.entries(row.custom_components || {}).forEach(([name, comp]) => {
      if (comp && comp.type === 'earnings' && comp.amount > 0) {
        customEarningsSum += Number(comp.amount || 0);
        customEarningsList.push({ name, amount: Number(comp.amount || 0) });
      }
    });

    const mealPay = Number(row.meal_pay || row.meal_allowance || 0);
    const nightMealPay = Number(row.night_meal_pay || 0);
    const presencePay = Number(row.presence_pay || row.tunj_kehadiran || 0);
    const prodPay = Number(row.production_pay || row.bonus_produksi || 0);
    const otPay = Number(row.overtime_pay || row.uang_lembur || 0);
    const otHours = Number(row.overtime_hours || 0);
    const tunjTetap = Number(row.fixed_allowance || row.tunj_tetap || 0);
    const varAllowance = Number(row.variable_allowance || row.tunj_variabel || 0);
    const transportPay = Number(row.transport_allowance || row.tunj_transport || 0);
    const positionPay = Number(row.position_allowance || row.tunj_jabatan || 0);
    const tunjLuarKota = Number(row.tunj_luar_kota || row.dinas_luar_kota || 0);
    const bonus = Number(row.bonus || row.thr || 0);
    const deficiency = Number(row.previous_month_deficiency || row.selisih_kurang_gaji || 0);
    const adhocAllowance = Number(row.adhoc_allowance || 0);

    const totalTunjangan = row.totalAllowance !== undefined 
      ? Number(row.totalAllowance)
      : (mealPay + nightMealPay + presencePay + prodPay + otPay + tunjTetap + varAllowance + transportPay + positionPay + tunjLuarKota + bonus + deficiency + adhocAllowance + customEarningsSum);

    const drawerOverlay = document.createElement('div');
    drawerOverlay.id = 'allowance-detail-drawer';
    drawerOverlay.style = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(0, 0, 0, 0.65); backdrop-filter: blur(4px);
      z-index: 10050; display: flex; justify-content: flex-end;
      animation: fadeIn 0.2s ease-out;
    `;
    drawerOverlay.onclick = (e) => {
      if (e.target === drawerOverlay) BPJSTaxCompliance.closeAllowanceDrawer();
    };

    drawerOverlay.innerHTML = `
      <div style="
        width: 460px; max-width: 92vw; height: 100%;
        background: #0f172a; border-left: 1px solid #334155;
        box-shadow: -10px 0 30px rgba(0,0,0,0.6);
        display: flex; flex-direction: column;
        animation: slideInRight 0.25s ease-out;
      ">
        <!-- HEADER -->
        <div style="padding: 18px 20px; background: #1e293b; border-bottom: 1px solid #334155; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h3 style="margin: 0; font-size: 1.1rem; color: #f8fafc; font-weight: 700;">Rincian Komponen Tunjangan</h3>
            <span style="font-size: 12px; color: #94a3b8;">${row.name} (${row.nik})</span>
          </div>
          <button class="btn btn-sm" onclick="BPJSTaxCompliance.closeAllowanceDrawer()" style="background: rgba(255,255,255,0.08); border: 1px solid #475569; color: #cbd5e1; border-radius: 6px; padding: 4px 10px; cursor: pointer; font-size: 14px;">✕</button>
        </div>

        <!-- TOTAL BANNER -->
        <div style="padding: 18px 20px; background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(5, 150, 105, 0.22)); border-bottom: 1px solid rgba(16, 185, 129, 0.3); text-align: center;">
          <div style="font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.05em; color: #34d399; font-weight: 600;">Total Tunjangan & Lembur Periode ${this.activePeriod}</div>
          <div style="font-size: 1.85rem; font-weight: 800; color: #10b981; margin-top: 4px;">Rp ${this.formatMoney(totalTunjangan)}</div>
          <div style="font-size: 11.5px; color: #94a3b8; margin-top: 4px;">Diakumulasikan ke dalam Bruto TER PPh 21 & Rekonsiliasi</div>
        </div>

        <!-- SCROLLABLE BREAKDOWN -->
        <div style="padding: 18px 20px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 10px;">
          ${tunjTetap > 0 ? `
            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: #f1f5f9; font-size: 13px;">💼 Tunjangan Tetap (Fixed)</strong>
                <div style="font-size: 11px; color: #94a3b8;">Tunjangan tetap bulanan karyawan</div>
              </div>
              <span style="font-weight: 700; color: #10b981; font-size: 14px;">Rp ${this.formatMoney(tunjTetap)}</span>
            </div>
          ` : ''}

          ${mealPay > 0 ? `
            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: #f1f5f9; font-size: 13px;">🍱 Uang Makan (Meal)</strong>
                <div style="font-size: 11px; color: #94a3b8;">Kehadiran reguler siang (${row.work_days || 0} hari)</div>
              </div>
              <span style="font-weight: 700; color: #10b981; font-size: 14px;">Rp ${this.formatMoney(mealPay)}</span>
            </div>
          ` : ''}

          ${nightMealPay > 0 ? `
            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: #f1f5f9; font-size: 13px;">🌙 Uang Makan Malam</strong>
                <div style="font-size: 11px; color: #94a3b8;">Shift malam / lembur pulang &ge; 19:00</div>
              </div>
              <span style="font-weight: 700; color: #34d399; font-size: 14px;">Rp ${this.formatMoney(nightMealPay)}</span>
            </div>
          ` : ''}

          ${presencePay > 0 ? `
            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: #f1f5f9; font-size: 13px;">🌟 Tunjangan Kehadiran (Red Day)</strong>
                <div style="font-size: 11px; color: #94a3b8;">Kerja di hari Minggu / Libur Nasional</div>
              </div>
              <span style="font-weight: 700; color: #38bdf8; font-size: 14px;">Rp ${this.formatMoney(presencePay)}</span>
            </div>
          ` : ''}

          ${otPay > 0 ? `
            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: #f1f5f9; font-size: 13px;">⏱️ Uang Lembur (Overtime)</strong>
                <div style="font-size: 11px; color: #94a3b8;">${otHours} Jam Terverifikasi @ 20k/jam</div>
              </div>
              <span style="font-weight: 700; color: #fbbf24; font-size: 14px;">Rp ${this.formatMoney(otPay)}</span>
            </div>
          ` : ''}

          ${prodPay > 0 ? `
            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: #f1f5f9; font-size: 13px;">🏭 Bonus Produksi</strong>
                <div style="font-size: 11px; color: #94a3b8;">Insentif output produksi kilang</div>
              </div>
              <span style="font-weight: 700; color: #a78bfa; font-size: 14px;">Rp ${this.formatMoney(prodPay)}</span>
            </div>
          ` : ''}

          ${varAllowance > 0 ? `
            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: #f1f5f9; font-size: 13px;">📈 Tunjangan Variabel</strong>
                <div style="font-size: 11px; color: #94a3b8;">Tunjangan operasional & kinerja</div>
              </div>
              <span style="font-weight: 700; color: #f8fafc; font-size: 14px;">Rp ${this.formatMoney(varAllowance)}</span>
            </div>
          ` : ''}

          ${transportPay > 0 ? `
            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: #f1f5f9; font-size: 13px;">🚗 Tunjangan Transport</strong>
                <div style="font-size: 11px; color: #94a3b8;">Transportasi & mobilitas dinas</div>
              </div>
              <span style="font-weight: 700; color: #38bdf8; font-size: 14px;">Rp ${this.formatMoney(transportPay)}</span>
            </div>
          ` : ''}

          ${positionPay > 0 ? `
            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: #f1f5f9; font-size: 13px;">👑 Tunjangan Jabatan</strong>
                <div style="font-size: 11px; color: #94a3b8;">Tunjangan tanggung jawab struktural</div>
              </div>
              <span style="font-weight: 700; color: #facc15; font-size: 14px;">Rp ${this.formatMoney(positionPay)}</span>
            </div>
          ` : ''}

          ${tunjLuarKota > 0 ? `
            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: #f1f5f9; font-size: 13px;">✈️ Tunjangan Dinas Luar Kota</strong>
                <div style="font-size: 11px; color: #94a3b8;">Akomodasi tugas luar wilayah</div>
              </div>
              <span style="font-weight: 700; color: #60a5fa; font-size: 14px;">Rp ${this.formatMoney(tunjLuarKota)}</span>
            </div>
          ` : ''}

          ${bonus > 0 ? `
            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: #f1f5f9; font-size: 13px;">🎁 Bonus / THR</strong>
                <div style="font-size: 11px; color: #94a3b8;">Bonus apresiasi performa</div>
              </div>
              <span style="font-weight: 700; color: #f43f5e; font-size: 14px;">Rp ${this.formatMoney(bonus)}</span>
            </div>
          ` : ''}

          ${adhocAllowance > 0 ? `
            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: #f1f5f9; font-size: 13px;">➕ Ad-hoc / Override Allowance</strong>
                <div style="font-size: 11px; color: #94a3b8;">Penyesuaian manual periode berjalan</div>
              </div>
              <span style="font-weight: 700; color: #34d399; font-size: 14px;">Rp ${this.formatMoney(adhocAllowance)}</span>
            </div>
          ` : ''}

          ${deficiency > 0 ? `
            <div style="background: rgba(59, 130, 246, 0.1); border: 1px solid #3b82f6; border-radius: 8px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: #60a5fa; font-size: 13px;">⚖️ Selisih Kurang Gaji</strong>
                <div style="font-size: 11px; color: #93c5fd;">Kompensasi kekurangan periode lalu</div>
              </div>
              <span style="font-weight: 700; color: #60a5fa; font-size: 14px;">Rp ${this.formatMoney(deficiency)}</span>
            </div>
          ` : ''}

          ${customEarningsList.map(c => `
            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: #f1f5f9; font-size: 13px;">✨ ${c.name}</strong>
                <div style="font-size: 11px; color: #94a3b8;">Komponen pendapatan kustom</div>
              </div>
              <span style="font-weight: 700; color: #a7f3d0; font-size: 14px;">Rp ${this.formatMoney(c.amount)}</span>
            </div>
          `).join('')}

          ${totalTunjangan === 0 ? `
            <div style="text-align: center; padding: 30px 20px; color: #94a3b8; background: #1e293b; border: 1px dashed #334155; border-radius: 8px;">
              <span style="font-size: 32px; display: block; margin-bottom: 8px;">ℹ️</span>
              <strong>Tidak ada tunjangan tambahan aktif</strong>
              <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Karyawan ini hanya menerima Gaji Pokok (Total Tunjangan: Rp 0).</div>
            </div>
          ` : ''}

          <!-- AUDIT TABLE OF ALL TRACKED ALLOWANCES -->
          <div style="margin-top: 10px; background: #182234; border: 1px solid #334155; border-radius: 8px; padding: 12px 14px;">
            <div style="font-size: 11.5px; font-weight: 700; color: #94a3b8; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em;">Ringkasan Audit Semua Komponen:</div>
            <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
              <tbody>
                <tr style="border-bottom: 1px solid #23354d;"><td style="padding: 4px 0; color: #cbd5e1;">Tunjangan Tetap</td><td style="text-align: right; font-weight: 600; color: ${tunjTetap > 0 ? '#10b981' : '#64748b'};">Rp ${this.formatMoney(tunjTetap)}</td></tr>
                <tr style="border-bottom: 1px solid #23354d;"><td style="padding: 4px 0; color: #cbd5e1;">Uang Makan Siang</td><td style="text-align: right; font-weight: 600; color: ${mealPay > 0 ? '#10b981' : '#64748b'};">Rp ${this.formatMoney(mealPay)}</td></tr>
                <tr style="border-bottom: 1px solid #23354d;"><td style="padding: 4px 0; color: #cbd5e1;">Uang Makan Malam</td><td style="text-align: right; font-weight: 600; color: ${nightMealPay > 0 ? '#10b981' : '#64748b'};">Rp ${this.formatMoney(nightMealPay)}</td></tr>
                <tr style="border-bottom: 1px solid #23354d;"><td style="padding: 4px 0; color: #cbd5e1;">Uang Lembur</td><td style="text-align: right; font-weight: 600; color: ${otPay > 0 ? '#10b981' : '#64748b'};">Rp ${this.formatMoney(otPay)}</td></tr>
                <tr style="border-bottom: 1px solid #23354d;"><td style="padding: 4px 0; color: #cbd5e1;">Bonus Produksi</td><td style="text-align: right; font-weight: 600; color: ${prodPay > 0 ? '#10b981' : '#64748b'};">Rp ${this.formatMoney(prodPay)}</td></tr>
                <tr style="border-bottom: 1px solid #23354d;"><td style="padding: 4px 0; color: #cbd5e1;">Tunj. Kehadiran (Red Day)</td><td style="text-align: right; font-weight: 600; color: ${presencePay > 0 ? '#10b981' : '#64748b'};">Rp ${this.formatMoney(presencePay)}</td></tr>
                <tr style="border-bottom: 1px solid #23354d;"><td style="padding: 4px 0; color: #cbd5e1;">Tunjangan Variabel</td><td style="text-align: right; font-weight: 600; color: ${varAllowance > 0 ? '#10b981' : '#64748b'};">Rp ${this.formatMoney(varAllowance)}</td></tr>
                <tr style="border-bottom: 1px solid #23354d;"><td style="padding: 4px 0; color: #cbd5e1;">Tunjangan Transport</td><td style="text-align: right; font-weight: 600; color: ${transportPay > 0 ? '#10b981' : '#64748b'};">Rp ${this.formatMoney(transportPay)}</td></tr>
                <tr style="border-bottom: 1px solid #23354d;"><td style="padding: 4px 0; color: #cbd5e1;">Tunjangan Jabatan</td><td style="text-align: right; font-weight: 600; color: ${positionPay > 0 ? '#10b981' : '#64748b'};">Rp ${this.formatMoney(positionPay)}</td></tr>
                <tr><td style="padding: 4px 0; color: #cbd5e1;">Bonus / THR / Penyesuaian</td><td style="text-align: right; font-weight: 600; color: ${(bonus + adhocAllowance + deficiency) > 0 ? '#10b981' : '#64748b'};">Rp ${this.formatMoney(bonus + adhocAllowance + deficiency)}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- FOOTER -->
        <div style="padding: 14px 20px; background: #1e293b; border-top: 1px solid #334155; display: flex; justify-content: flex-end;">
          <button class="btn btn-secondary" onclick="BPJSTaxCompliance.closeAllowanceDrawer()" style="width: 100%;">Tutup Rincian</button>
        </div>
      </div>
    `;

    document.body.appendChild(drawerOverlay);
  },

  closeAllowanceDrawer() {
    const existing = document.getElementById('allowance-detail-drawer');
    if (existing) existing.remove();
  },

  _buildSheetData(records, sheetTitle) {
    const isLocked = this.isPeriodLocked();
    const headers = [
      'No', 'NIK', 'Nama Pegawai', 'Departemen', 'Jabatan',
      'Upah Dasar Kes', 'BPJS Kes Emp (1%)', 'BPJS Kes Comp (4%)', 'Total BPJS Kes (5%)',
      'Upah Dasar TK', 'JHT Emp (2%)', 'JHT Comp (3.7%)', 'JKK Comp (0.89%)', 'JKM Comp (0.3%)', 'Total BPJS TK',
      'Total Tunjangan', 'PTKP', 'Penghasilan Bruto TER', 'Kategori TER', 'Tarif TER (%)', 'PPh 21 TER (Rp)',
      'Total Potongan Karyawan', 'Total Beban Perusahaan', 'Grand Total Penyetoran'
    ];

    const aoaData = [
      [`PT GOLDEN ALURA - LAPORAN REKONSILIASI BPJS & PPH 21 (${sheetTitle.toUpperCase()})`],
      [`Periode: ${this.activePeriod}`, `Status: ${isLocked ? 'TERKUNCI (LOCKED)' : 'DRAFT (OPEN)'}`, `Total Karyawan: ${records.length}`, `Tanggal Cetak: ${new Date().toLocaleString('id-ID')}`],
      [],
      headers
    ];

    const totals = {
      bpjsKesBase: 0, kesEmp: 0, kesComp: 0, kesSubtotal: 0,
      bpjsTkBase: 0, jhtEmp: 0, jhtComp: 0, jkkComp: 0, jkmComp: 0, tkSubtotal: 0,
      totalAllowance: 0, taxableGross: 0, pph21: 0,
      totalEmpDeduction: 0, totalCompContribution: 0, grandTotalRemittance: 0
    };

    records.forEach((r, idx) => {
      totals.bpjsKesBase += (r.bpjsKesBase || 0);
      totals.kesEmp += (r.kesEmp || 0);
      totals.kesComp += (r.kesComp || 0);
      totals.kesSubtotal += (r.kesSubtotal || 0);
      totals.bpjsTkBase += (r.bpjsTkBase || 0);
      totals.jhtEmp += (r.jhtEmp || 0);
      totals.jhtComp += (r.jhtComp || 0);
      totals.jkkComp += (r.jkkComp || 0);
      totals.jkmComp += (r.jkmComp || 0);
      totals.tkSubtotal += (r.tkSubtotal || 0);
      totals.totalAllowance += (r.totalAllowance || 0);
      totals.taxableGross += (r.taxableGross || 0);
      totals.pph21 += (r.pph21 || 0);
      totals.totalEmpDeduction += (r.totalEmpDeduction || 0);
      totals.totalCompContribution += (r.totalCompContribution || 0);
      totals.grandTotalRemittance += (r.grandTotalRemittance || 0);

      aoaData.push([
        idx + 1,
        r.nik,
        r.name,
        r.department,
        r.position,
        r.bpjsKesBase,
        r.kesEmp,
        r.kesComp,
        r.kesSubtotal,
        r.bpjsTkBase,
        r.jhtEmp,
        r.jhtComp,
        r.jkkComp,
        r.jkmComp,
        r.tkSubtotal,
        r.totalAllowance || 0,
        r.ptkp,
        r.taxableGross,
        r.terCat,
        r.terRate,
        r.pph21,
        r.totalEmpDeduction,
        r.totalCompContribution,
        r.grandTotalRemittance
      ]);
    });

    // Total Row
    aoaData.push([
      'TOTAL',
      '',
      '',
      '',
      '',
      totals.bpjsKesBase,
      totals.kesEmp,
      totals.kesComp,
      totals.kesSubtotal,
      totals.bpjsTkBase,
      totals.jhtEmp,
      totals.jhtComp,
      totals.jkkComp,
      totals.jkmComp,
      totals.tkSubtotal,
      totals.totalAllowance,
      '',
      totals.taxableGross,
      '',
      '',
      totals.pph21,
      totals.totalEmpDeduction,
      totals.totalCompContribution,
      totals.grandTotalRemittance
    ]);

    const ws = XLSX.utils.aoa_to_sheet(aoaData);
    const colWidths = headers.map((h, i) => {
      let maxLen = h.length;
      aoaData.forEach(row => {
        if (row[i] !== undefined && row[i] !== null) {
          const valLen = String(row[i]).length;
          if (valLen > maxLen) maxLen = valLen;
        }
      });
      return { wch: Math.min(maxLen + 3, 30) };
    });
    ws['!cols'] = colWidths;
    return ws;
  },

  exportToExcel() {
    if (!this.reconciliationData || this.reconciliationData.length === 0) {
      alert('Tidak ada data rekonsiliasi untuk diexport.');
      return;
    }

    if (typeof XLSX === 'undefined') {
      alert('Library XLSX belum termuat. Mohon refresh halaman.');
      return;
    }

    const activeList = this.reconciliationData.filter(r => r.status !== 'NON-AKTIF' && r.status !== 'non_active' && r.status !== 'inactive' && !r.resignation_date);
    const inactiveList = this.reconciliationData.filter(r => r.status === 'NON-AKTIF' || r.status === 'non_active' || r.status === 'inactive' || r.resignation_date);

    const wb = XLSX.utils.book_new();

    // Sheet 1: Karyawan Aktif
    const wsActive = this._buildSheetData(activeList, 'Karyawan Aktif');
    XLSX.utils.book_append_sheet(wb, wsActive, "Karyawan Aktif");

    // Sheet 2: Karyawan Non-Aktif / Arsip
    const wsInactive = this._buildSheetData(inactiveList, 'Karyawan Non-Aktif & Arsip');
    XLSX.utils.book_append_sheet(wb, wsInactive, "Karyawan Non-Aktif");

    const fileName = `Rekonsiliasi_BPJS_PPh21_${this.activePeriod}.xlsx`;
    XLSX.writeFile(wb, fileName);
  },

  exportToPDF() {
    if (!this.reconciliationData || this.reconciliationData.length === 0) {
      alert('Tidak ada data rekonsiliasi untuk diexport.');
      return;
    }

    if (typeof jspdf === 'undefined' && typeof window.jspdf === 'undefined') {
      alert('Library jsPDF belum termuat.');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4'); // Landscape

    const isLocked = this.isPeriodLocked();
    const t = this.summaryTotals || {};

    doc.setFontSize(14);
    doc.text('PT GOLDEN ALURA - LAPORAN REKONSILIASI BPJS & PPH 21', 14, 12);
    doc.setFontSize(9);
    doc.text(`Periode: ${this.activePeriod} | Status: ${isLocked ? 'TERKUNCI' : 'DRAFT'} | Dicetak: ${new Date().toLocaleString('id-ID')}`, 14, 18);

    const body = this.reconciliationData.map((r, i) => [
      i + 1,
      r.nik,
      r.name,
      r.department,
      this.formatMoney(r.bpjsKesBase),
      this.formatMoney(r.kesEmp),
      this.formatMoney(r.kesComp),
      this.formatMoney(r.bpjsTkBase),
      this.formatMoney(r.jhtEmp),
      this.formatMoney(r.jhtComp),
      this.formatMoney(r.jkkComp),
      this.formatMoney(r.jkmComp),
      this.formatMoney(r.totalAllowance || 0),
      r.ptkp,
      this.formatMoney(r.pph21),
      this.formatMoney(r.grandTotalRemittance)
    ]);

    // Totals row
    body.push([
      'TOTAL',
      '',
      '',
      '',
      this.formatMoney(t.bpjsKesBase || 0),
      this.formatMoney(t.kesEmp || 0),
      this.formatMoney(t.kesComp || 0),
      this.formatMoney(t.bpjsTkBase || 0),
      this.formatMoney(t.jhtEmp || 0),
      this.formatMoney(t.jhtComp || 0),
      this.formatMoney(t.jkkComp || 0),
      this.formatMoney(t.jkmComp || 0),
      this.formatMoney(t.totalAllowance || 0),
      '',
      this.formatMoney(t.pph21 || 0),
      this.formatMoney(t.grandTotalRemittance || 0)
    ]);

    doc.autoTable({
      startY: 22,
      head: [
        ['No', 'NIK', 'Nama', 'Dept', 'Upah Kes', 'Kes 1%', 'Kes 4%', 'Upah TK', 'JHT 2%', 'JHT 3.7%', 'JKK', 'JKM', 'Tunjangan', 'PTKP', 'PPh 21', 'Grand Total']
      ],
      body: body,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 8 },
      styles: { fontSize: 7, cellPadding: 2 },
      footStyles: { fillColor: [30, 41, 59], fontStyle: 'bold' }
    });

    doc.save(`BPJS_PPh21_Reconciliation_${this.activePeriod}.pdf`);
  },

  exportSippOffboarding(targetPeriod = null) {
    const allEmployees = typeof Storage !== 'undefined' && Storage.getEmployees ? Storage.getEmployees() : [];
    let inactiveList = allEmployees.filter(e => e.status === 'NON-AKTIF' || e.status === 'non_active' || e.status === 'inactive' || e.resign_date || e.resignation_date);

    if (targetPeriod) {
      inactiveList = inactiveList.filter(e => {
        const rDate = e.resignation_date || e.resign_date;
        return rDate && rDate.startsWith(targetPeriod);
      });
    }

    if (inactiveList.length === 0) {
      alert(`Tidak ada data karyawan non-aktif/resign untuk periode ${targetPeriod || 'ini'}.`);
      return;
    }

    if (typeof XLSX === 'undefined') {
      alert('Library XLSX belum termuat.');
      return;
    }

    const headers = [
      'No', 'Nomor KPJ', 'NIK KTP', 'Nama Tenaga Kerja', 'Tanggal Lahir',
      'Tanggal Keluar', 'Sebab Keluar', 'Departemen', 'Keterangan'
    ];

    const aoaData = [
      ['BPJS KETENAGAKERJAAN - FORMULIR TENAGA KERJA KELUAR (SIPP ONLINE)'],
      ['PT GOLDEN ALURA', `Periode Mutasi: ${targetPeriod || 'Semua Non-Aktif'}`, `Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}`],
      [],
      headers
    ];

    inactiveList.forEach((e, idx) => {
      aoaData.push([
        idx + 1,
        e.bpjs_employment || '-',
        e.ktp || e.id_card || '-',
        e.name || '',
        e.birth_date || '-',
        e.resignation_date || e.resign_date || '-',
        e.resignation_reason || e.resign_reason || 'Mengundurkan Diri',
        e.department || '-',
        'Mutasi Tenaga Kerja Keluar (Non-Aktifkan Iuran)'
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(aoaData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SIPP_TK_Keluar');

    const fileName = `SIPP_BPJSTK_Tenaga_Kerja_Keluar_${targetPeriod || 'All'}.xlsx`;
    XLSX.writeFile(wb, fileName);
  },

  exportEdabuOffboarding(targetPeriod = null) {
    const allEmployees = typeof Storage !== 'undefined' && Storage.getEmployees ? Storage.getEmployees() : [];
    let inactiveList = allEmployees.filter(e => e.status === 'NON-AKTIF' || e.status === 'non_active' || e.status === 'inactive' || e.resign_date || e.resignation_date);

    if (targetPeriod) {
      inactiveList = inactiveList.filter(e => {
        const rDate = e.resignation_date || e.resign_date;
        return rDate && rDate.startsWith(targetPeriod);
      });
    }

    if (inactiveList.length === 0) {
      alert(`Tidak ada data karyawan non-aktif/resign untuk periode ${targetPeriod || 'ini'}.`);
      return;
    }

    if (typeof XLSX === 'undefined') {
      alert('Library XLSX belum termuat.');
      return;
    }

    const headers = [
      'No', 'Nomor Kartu BPJS Kesehatan', 'NIK KTP', 'Nomor Kartu Keluarga', 'Nama Peserta',
      'Tanggal Berhenti', 'Alasan Non-Aktif', 'Status Kepesertaan', 'Keterangan'
    ];

    const aoaData = [
      ['BPJS KESEHATAN - FORMULIR MUTASI PESERTA NON-AKTIF (e-DABU)'],
      ['PT GOLDEN ALURA', `Periode Mutasi: ${targetPeriod || 'Semua Non-Aktif'}`, `Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}`],
      [],
      headers
    ];

    inactiveList.forEach((e, idx) => {
      aoaData.push([
        idx + 1,
        e.bpjs_health || '-',
        e.ktp || e.id_card || '-',
        e.kk_number || '-',
        e.name || '',
        e.resignation_date || e.resign_date || '-',
        e.resignation_reason || e.resign_reason || 'Resign / Berhenti Bekerja',
        'Non-Aktif Badan Usaha',
        'Mutasi Peserta Non-Aktif (Stop Tagihan Iuran)'
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(aoaData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'eDabu_NonAktif');

    const fileName = `eDabu_BPJSKes_Mutasi_NonAktif_${targetPeriod || 'All'}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }
};

window.BPJSTaxCompliance = BPJSTaxCompliance;
if (typeof module !== 'undefined') module.exports = BPJSTaxCompliance;
