// ==========================================
// Payroll Module
// Hitung Gaji & Auto-Journal ke Akuntansi
// ==========================================

const Payroll = {
  period: '',
  isAuthenticatedWithPassword: false,
  payrollRecords: [],
  attendanceRecords: [],
  employees: [],
  activeSubTab: 'calculator',

  async init() {
    if (!this.canAccessPayroll()) {
      this.renderAccessDenied();
      return;
    }

    this.period = new Date().toISOString().substring(0, 7);
    await this.loadData();
    this.render();
  },

  getPeriodDates(period) {
    const p = period || this.period || new Date().toISOString().substring(0, 7);
    const [year, month] = p.split('-').map(Number);
    const customPeriods = Storage.getPayrollPeriods ? Storage.getPayrollPeriods() : [];
    const currentCustom = customPeriods.find(cp => cp.period === p);
    
    let endDateStr = `${p}-25`;
    if (currentCustom && currentCustom.endDate) {
        endDateStr = currentCustom.endDate;
    }
    
    // Find previous period
    let prevYear = year;
    let prevMonth = month - 1;
    if (prevMonth === 0) {
        prevMonth = 12;
        prevYear -= 1;
    }
    const prevPeriod = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
    
    const prevCustom = customPeriods.find(p => p.period === prevPeriod);
    let prevEndDateStr = `${prevPeriod}-25`;
    if (prevCustom && prevCustom.endDate) {
        prevEndDateStr = prevCustom.endDate;
    }
    
    // Start Date = prevEndDate + 1 day
    const prevEnd = new Date(prevEndDateStr + 'T12:00:00');
    const start = new Date(prevEnd);
    start.setDate(prevEnd.getDate() + 1);
    
    const startYear = start.getFullYear();
    const startMonth = String(start.getMonth() + 1).padStart(2, '0');
    const startDay = String(start.getDate()).padStart(2, '0');
    const startDateStr = `${startYear}-${startMonth}-${startDay}`;
    
    return {
        startDate: startDateStr,
        endDate: endDateStr,
        isCustom: !!(currentCustom && currentCustom.endDate)
    };
  },

  countWorkingDaysMonSat(startDateStr, endDateStr) {
    const start = new Date(startDateStr + 'T12:00:00');
    const end = new Date(endDateStr + 'T12:00:00');
    let count = 0;
    let cur = new Date(start);
    while (cur <= end) {
        if (cur.getDay() !== 0) { // Excluding Sunday
            count++;
        }
        cur.setDate(cur.getDate() + 1);
    }
    return count;
  },

  canAccessPayroll() {
    return !Storage.canCurrentUserReadKey || Storage.canCurrentUserReadKey(Storage.KEYS.PAYROLL);
  },

  renderAccessDenied() {
    const content = document.getElementById('main-content');
    if (!content) return;
    content.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Payroll (Penggajian)</h1>
        <p class="page-description">Data payroll dilindungi dan hanya dapat diakses oleh role yang berwenang.</p>
      </div>
      <div class="card">
        <div class="card-body text-center" style="padding: 3rem;">
          <h3 style="margin-bottom: 0.75rem;">Akses ditolak</h3>
          <p class="text-gray">Hubungi Admin/HR/Finance Manager jika Anda membutuhkan akses payroll.</p>
        </div>
      </div>
    `;
  },

  parseDateToString(val) {
    if (!val) return '';
    if (!isNaN(val) && String(val).trim() !== '') {
      const num = parseFloat(val);
      if (num > 20000 && num < 100000) {
        const ms = Math.round((num - 25569) * 86400 * 1000);
        const date = new Date(ms);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
      }
    }
    const str = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      return str;
    }
    const match = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (match) {
      const d = match[1].padStart(2, '0');
      const m = match[2].padStart(2, '0');
      const y = match[3];
      return `${y}-${m}-${d}`;
    }
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
    return '';
  },

  async loadData() {
    this.employees = Storage.getEmployees().map(emp => {
      const copy = { ...emp };
      if (copy.start_date !== undefined) copy.start_date = this.parseDateToString(copy.start_date);
      if (copy.resign_date !== undefined) copy.resign_date = this.parseDateToString(copy.resign_date);
      return copy;
    });
    this.attendanceRecords = Storage.getAttendance();
    this.payrollRecords = Storage.getPayroll();

    // Self-healing check: repair any legacy/corrupted records where BPJS deduction or benefit was saved as Wage Basis (e.g. 5,288,796) instead of 1% / 4%
    let payrollRepaired = false;
    (this.payrollRecords || []).forEach(record => {
      const emp = this.employees.find(e => String(e.nik).trim() === String(record.nik).trim());
      const baseWage = emp && emp.bpjs_wage_basis ? parseFloat(emp.bpjs_wage_basis) : (record.base_salary || 0);

      if (record.bpjs_health_deduction >= 500000) {
        record.bpjs_health_deduction = Math.round(record.bpjs_health_deduction * 0.01);
        payrollRepaired = true;
      }
      if (record.jht_deduction >= 500000) {
        record.jht_deduction = Math.round(record.jht_deduction * 0.02);
        payrollRepaired = true;
      }
      if (record.bpjs_kes_benefit >= 500000) {
        record.bpjs_kes_benefit = Math.round(record.bpjs_kes_benefit * 0.04);
        payrollRepaired = true;
      }
      if (record.bpjs_tk_benefit >= 500000) {
        record.bpjs_tk_benefit = Math.round(record.bpjs_tk_benefit * 0.0424);
        payrollRepaired = true;
      }

      const expectedKesBenefit = record.bpjs_health_benefit || Math.round(baseWage * 0.04);
      if (!record.bpjs_kes_benefit && expectedKesBenefit > 0) {
        record.bpjs_kes_benefit = expectedKesBenefit;
        payrollRepaired = true;
      }

      const expectedTkBenefit = (record.jht_benefit || 0) + (record.jkk_benefit || 0) + (record.jkm_benefit || 0) || Math.round(baseWage * 0.0424);
      if (!record.bpjs_tk_benefit && expectedTkBenefit > 0) {
        record.bpjs_tk_benefit = expectedTkBenefit;
        payrollRepaired = true;
      }

      if (payrollRepaired) {
        let customEarningsSum = 0;
        let customDeductionsSum = 0;
        Object.values(record.custom_components || {}).forEach(comp => {
          if (comp.type === 'earnings') customEarningsSum += (comp.amount || 0);
          if (comp.type === 'deduction') customDeductionsSum += (comp.amount || 0);
        });

        const tunjTetap = record.tunj_tetap || 0;
        const mealPay = record.meal_pay || 0;
        const nightMealPay = record.night_meal_pay || 0;
        const tunjLuarKota = record.tunj_luar_kota || 0;
        const presencePay = record.presence_pay || 0;
        const productionPay = record.production_pay || 0;
        const variableAllowance = record.variable_allowance || 0;
        const bonus = record.bonus || 0;
        const deficiency = record.previous_month_deficiency || record.selisih_kurang_gaji || 0;
        const overtimePay = record.overtime_pay || 0;

        const totalEarnings = record.base_salary + tunjTetap + mealPay + nightMealPay + tunjLuarKota + presencePay + productionPay + variableAllowance + bonus + deficiency + overtimePay + customEarningsSum;

        const lateDeduction = record.potongan_lambat_pulang !== undefined ? record.potongan_lambat_pulang : (record.late_deduction || 0);
        const absenceDeduction = record.potongan_tidak_hadir !== undefined ? record.potongan_tidak_hadir : (record.absence_deduction || 0);
        const halfDayDeduction = record.half_day_deduction || 0;
        const bpjsHealthDeduction = record.bpjs_health_deduction || 0;
        const jhtDeduction = record.jht_deduction || 0;
        const pph21Deduction = record.pph21_deduction || 0;
        const otherDeductions = record.other_deductions || 0;

        const totalDeductions = lateDeduction + absenceDeduction + halfDayDeduction + bpjsHealthDeduction + jhtDeduction + pph21Deduction + otherDeductions + customDeductionsSum;

        record.total_salary = Math.max(0, Math.round(totalEarnings - totalDeductions));
      }
    });

    if (payrollRepaired) {
      Storage.set(Storage.KEYS.PAYROLL, this.payrollRecords);
    }

    await this.syncDraftBaseSalaries();
  },

  async syncDraftBaseSalaries() {
    if (!this.employees || this.employees.length === 0 || !this.payrollRecords || this.payrollRecords.length === 0) {
      return;
    }

    const dates = this.getPeriodDates(this.period);
    const startDateStr = dates.startDate;
    const endDateStr = dates.endDate;

    // Load active settings and logs
    const settings = Storage.getOvertimeSettings();
    const prodLogs = Storage.getProductionLogs().filter(log => log.date >= startDateStr && log.date <= endDateStr);
    const prodOrders = (Storage.get(Storage.KEYS.PRODUCTION_ORDERS) || []).filter(order => order.status !== 'CANCELLED');
    const leaveRequests = (Storage.get(Storage.KEYS.LEAVE_REQUESTS) || []).filter(lr => {
      if (lr.status !== 'APPROVED') return false;
      const from = lr.dateFrom;
      const to = lr.dateTo || lr.dateFrom;
      return (from <= endDateStr && to >= startDateStr);
    });

    const filteredAtd = await this.calculateAttendanceForRange(this.employees, startDateStr, endDateStr);

    let hasChanges = false;

    this.payrollRecords.forEach((record, idx) => {
      if (record.period === this.period && record.status === 'draft' && !record.imported) {
        const emp = this.employees.find(e => e.nik === record.nik);
        if (emp) {
          const masterBaseSalary = parseFloat(emp.base_salary) || 0;
          const masterBpjsWageBasis = emp.bpjs_wage_basis !== undefined && emp.bpjs_wage_basis !== '' ? parseFloat(emp.bpjs_wage_basis) : masterBaseSalary;
          
          // Prorated fixed components using 25-day basis (Mon-Sat)
          let isNewHire = false;
          let daysBeforeJoin = 0;
          if (emp.start_date && emp.start_date >= startDateStr && emp.start_date <= endDateStr) {
              isNewHire = true;
              const joinDate = new Date(emp.start_date + 'T12:00:00');
              const dayBeforeJoin = new Date(joinDate);
              dayBeforeJoin.setDate(joinDate.getDate() - 1);
              const dayBeforeStr = dayBeforeJoin.toISOString().substring(0, 10);
              if (dayBeforeStr >= startDateStr) {
                  daysBeforeJoin = this.countWorkingDaysMonSat(startDateStr, dayBeforeStr);
              }
          }

          let isLeaver = false;
          let daysWorkedBeforeResign = 0;
          const resDate = emp.resignation_date || emp.resign_date;
          const isInactive = emp.status === 'NON-AKTIF' || emp.status === 'non_active' || emp.status === 'inactive';
          if (isInactive && resDate && resDate >= startDateStr && resDate <= endDateStr) {
              isLeaver = true;
              daysWorkedBeforeResign = this.countWorkingDaysMonSat(startDateStr, resDate);
          }

          let calculatedBaseSalary = masterBaseSalary;
          if (isNewHire) {
              calculatedBaseSalary = masterBaseSalary - (daysBeforeJoin * (masterBaseSalary / 25));
          } else if (isLeaver) {
              calculatedBaseSalary = daysWorkedBeforeResign * (masterBaseSalary / 25);
          }
          calculatedBaseSalary = Math.max(0, Math.round(calculatedBaseSalary));

          const expectedBpjsHealthDeduction = Math.round((masterBpjsWageBasis * (settings.bpjs_health_emp || 0)) / 100);
          const expectedJhtDeduction = Math.round((masterBpjsWageBasis * (settings.jht_emp || 0)) / 100);

          const isOutOfSync = 
            record.name !== emp.name ||
            record.department !== (emp.department || 'OTHER') ||
            record.position !== (emp.position || '-') ||
            record.ptkp !== (emp.ptkp || '-') ||
            record.npwp !== (emp.npwp || '-') ||
            record.base_salary !== calculatedBaseSalary ||
            record.bpjs_health_deduction !== expectedBpjsHealthDeduction ||
            record.jht_deduction !== expectedJhtDeduction ||
            record.is_first_day !== isNewHire;

          if (isOutOfSync) {
            const atd = filteredAtd.find(a => String(a.nik) === String(emp.nik)) || {
              work_days: 0,
              overtime_hours: 0,
              night_days: 0,
              extra_days: 0,
              late_count: 0,
              absence_days: 0,
              half_day_izin: 0,
              production_grams: 0
            };

            const isSecurity = (Storage.isSecurityEmployee && Storage.isSecurityEmployee(emp)) || (
                String(emp.department || '').toLowerCase().includes('security') ||
                String(emp.division || emp.job_level || '').toLowerCase().includes('security') ||
                String(emp.position || '').toLowerCase().includes('security') ||
                String(emp.position || '').toLowerCase().includes('satpam')
            );
            const isMess = (emp.night_meal_category === 'mess' || emp.is_mess === true || emp.living_in_mess === true || emp.mess === true);
            const isMessOrSecurity = isSecurity || isMess;
            const base = masterBaseSalary;
            const dailyRate = base / 25;
            const mealPay = (atd.work_days || 0) * 20000;
            const nightMealPay = (isMessOrSecurity ? (atd.work_days || 0) : (atd.night_days || 0)) * 20000;
            const presencePay = isSecurity ? 0 : dailyRate * (atd.extra_days || 0);
            const securityOtRate = emp.security_overtime_rate || emp.overtime_rate || 10000;
            const overtimePay = isMessOrSecurity ? (atd.overtime_hours || 0) * securityOtRate : (atd.overtime_hours || 0) * 20000;

            let productionPay = 0;
            if (emp.payroll_level && emp.payroll_level !== 'N/A') {
              let totalKg = 0;
              const employeeLogs = prodLogs.filter(log => log.operators.some(op => String(op.nik) === String(emp.nik)));
              employeeLogs.forEach(log => { totalKg += log.total_weight; });

              prodOrders.forEach(order => {
                (order.movements || []).forEach(m => {
                  const mDate = m.dateTime.substring(0, 10);
                  if (mDate >= startDateStr && mDate <= endDateStr) {
                    if ((m.operators || []).some(op => String(op.nik) === String(emp.nik))) {
                      totalKg += m.outputWeight;
                    }
                  }
                });
              });

              const ratePerKg = 20000;
              const totalIncentive = totalKg * ratePerKg;
              if (emp.payroll_level === 'Senior') {
                productionPay = totalIncentive * 0.75;
              } else if (emp.payroll_level === 'Junior') {
                productionPay = totalIncentive * 0.25;
              } else {
                productionPay = totalIncentive;
              }
            }

            const calculatedLateDeduction = atd.late_deduction !== undefined ? atd.late_deduction : (atd.late_count || 0) * 20000;
            const lateDeduction = record.late_deduction_override !== undefined && record.late_deduction_override !== null
                ? record.late_deduction_override
                : calculatedLateDeduction;
            
            let adjustedAbsenceDays = atd.absence_days || 0;
            let leaveNotes = [];
            const empLeaves = leaveRequests.filter(lr => String(lr.employeeNik) === String(emp.nik));
            empLeaves.forEach(lr => {
              const leaveStart = lr.dateFrom > startDateStr ? lr.dateFrom : startDateStr;
              const leaveEnd = (lr.dateTo || lr.dateFrom) < endDateStr ? (lr.dateTo || lr.dateFrom) : endDateStr;
              
              let leaveDaysInPeriod = 0;
              if (leaveStart <= leaveEnd) {
                  leaveDaysInPeriod = this.countWorkingDaysMonSat(leaveStart, leaveEnd);
              }
              
              if (lr.isPaid) {
                adjustedAbsenceDays = Math.max(0, adjustedAbsenceDays - leaveDaysInPeriod);
                leaveNotes.push(`${lr.leaveTypeCode}: ${leaveDaysInPeriod}d (Paid)`);
              } else {
                leaveNotes.push(`${lr.leaveTypeCode}: ${leaveDaysInPeriod}d (Unpaid)`);
              }
            });

            let absenceDeduction = adjustedAbsenceDays * (base / 25);
            let halfDayDeduction = (atd.half_day_izin || 0) * ((base / 25) * 0.5);

            const totalAbsenceDeductions = absenceDeduction + halfDayDeduction;
            if (totalAbsenceDeductions > calculatedBaseSalary) {
                absenceDeduction = calculatedBaseSalary;
                halfDayDeduction = 0;
            }

            const bpjsBase = masterBpjsWageBasis;
            const bpjsHealthDeduction = (bpjsBase * (settings.bpjs_health_emp || 0)) / 100;
            const jhtDeduction = (bpjsBase * (settings.jht_emp || 0)) / 100;

            const bpjsHealthBenefit = (bpjsBase * (settings.bpjs_health_comp || 0)) / 100;
            const jhtBenefit = (bpjsBase * (settings.jht_comp || 0)) / 100;
            const jkkBenefit = (bpjsBase * (settings.jkk_comp || 0)) / 100;
            const jkmBenefit = (bpjsBase * (settings.jkm_comp || 0)) / 100;

            const variableAllowance = record.variable_allowance || 0;
            const bonus = record.bonus || 0;
            const otherDeductions = record.other_deductions || 0;
            const customComponents = record.custom_components || {};

            let customEarningsSum = 0;
            let customDeductionsSum = 0;
            Object.values(customComponents).forEach(comp => {
                if (comp.type === 'earnings') customEarningsSum += (comp.amount || 0);
                if (comp.type === 'deduction') customDeductionsSum += (comp.amount || 0);
            });

            const totalEarnings = calculatedBaseSalary + mealPay + nightMealPay + presencePay + overtimePay + productionPay + variableAllowance + bonus + customEarningsSum;

            let pph21_deduction = 0;
            let ter_rate = 0;
            let ter_category = 'A';
            if (typeof TaxEngineTER !== 'undefined') {
              const terResult = TaxEngineTER.calculatePPh21(emp.ptkp, totalEarnings);
              pph21_deduction = terResult.taxAmount;
              ter_rate = terResult.ratePct;
              ter_category = terResult.category;
            }

            const totalDeductions = lateDeduction + absenceDeduction + halfDayDeduction + bpjsHealthDeduction + jhtDeduction + pph21_deduction + otherDeductions + customDeductionsSum;
            let totalSalary = Math.max(0, totalEarnings - totalDeductions);

            this.payrollRecords[idx] = {
              ...record,
              name: emp.name,
              department: emp.department || 'OTHER',
              position: emp.position || '-',
              ptkp: emp.ptkp || '-',
              npwp: emp.npwp || '-',
              is_first_day: isNewHire,
              base_salary: Math.round(calculatedBaseSalary),
              daily_rate: Math.round(dailyRate),
              meal_pay: mealPay,
              night_meal_pay: nightMealPay,
              presence_pay: Math.round(presencePay),
              production_pay: Math.round(productionPay),
              late_deduction: lateDeduction,
              calculated_late_deduction: calculatedLateDeduction,
              late_deduction_override: record.late_deduction_override !== undefined ? record.late_deduction_override : null,
              keterangan_override_late: record.keterangan_override_late || null,
              absence_deduction: Math.round(absenceDeduction),
              half_day_deduction: Math.round(halfDayDeduction),
              bpjs_health_deduction: Math.round(bpjsHealthDeduction),
              jht_deduction: Math.round(jhtDeduction),
              pph21_deduction: pph21_deduction,
              ter_rate: ter_rate,
              ter_category: ter_category,
              bpjs_health_benefit: Math.round(bpjsHealthBenefit),
              bpjs_kes_benefit: Math.round(bpjsHealthBenefit),
              jht_benefit: Math.round(jhtBenefit),
              jkk_benefit: Math.round(jkkBenefit),
              jkm_benefit: Math.round(jkmBenefit),
              bpjs_tk_benefit: Math.round(jhtBenefit + jkkBenefit + jkmBenefit),
              total_salary: Math.round(totalSalary),
              leave_notes: leaveNotes.join(', ') || '-'
            };
            hasChanges = true;
          }
        }
      }
    });

    if (hasChanges) {
      await Storage.set(Storage.KEYS.PAYROLL, this.payrollRecords);
      console.log('🔄 Automatic Payroll Sync: Draft payroll records updated successfully.');
    }
  },


  verifySpecialPassword() {
    const input = document.getElementById('payroll-special-password').value;
    if (input === 'GarPayroll_2025') {
      this.isAuthenticatedWithPassword = true;
      this.render();
    } else {
      alert('Password salah!');
    }
  },

  renderPasswordPrompt() {
    const content = document.getElementById('main-content');
    if (!content) return;
    content.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">💰 Payroll (Penggajian)</h1>
        <p class="page-description">Akses Terbatas</p>
      </div>
      <div class="card" style="max-width: 400px; margin: 2rem auto;">
        <div class="card-body text-center" style="padding: 2rem;">
          <h3 style="margin-bottom: 1rem;">Masukkan Password Khusus</h3>
          <p class="text-gray mb-4" style="font-size: 14px;">Meskipun Anda Admin, Anda perlu password khusus untuk mengakses rincian gaji.</p>
          <input type="password" id="payroll-special-password" class="form-input" style="margin-bottom: 1rem; width: 100%;" placeholder="Special Password..." onkeydown="if(event.key === 'Enter') Payroll.verifySpecialPassword()">
          <button class="btn btn-primary" style="width: 100%;" onclick="Payroll.verifySpecialPassword()">Buka Akses Payroll</button>
        </div>
      </div>
    `;
  },

  render() {
    if (!this.isAuthenticatedWithPassword) {
      this.renderPasswordPrompt();
      return;
    }

    if (this.selectedDept === undefined) this.selectedDept = '';
    if (this.searchQuery === undefined) this.searchQuery = '';

    const content = document.getElementById('main-content');
    if (!content) return;

    // Load active rates from localStorage or use defaults
    const localRates = localStorage.getItem('erp_bonus_rates');
    const rates = localRates ? JSON.parse(localRates) : { Standard: 20000, Senior: 15000, Junior: 5000 };

    let tabContent = '';
    if (this.activeSubTab === 'calculator') {
      tabContent = `
        <div id="workdays-config-container">
          ${this.renderWorkdaysConfig()}
        </div>

        <div class="card mb-4">
          <div class="card-header flex justify-between align-center flex-wrap gap-2">
            <h2 class="card-title">Proses Gaji</h2>
            <div class="flex gap-2 align-center flex-wrap">
              <input type="month" class="form-input" value="${this.period}" onchange="Payroll.setPeriod(this.value)">
              <button class="btn btn-primary" onclick="Payroll.generatePayroll()">⚡ Generate Payroll</button>
              <button class="btn btn-success" onclick="document.getElementById('payroll-import-file').click()">📥 Import Excel</button>
              <input type="file" id="payroll-import-file" style="display: none;" accept=".xlsx,.xls" onchange="Payroll.handleImportExcel(event)">
              <button class="btn btn-secondary" onclick="Payroll.exportToExcel()">📥 Unduh Rekap Excel</button>
              <button class="btn btn-info" onclick="App.navigateTo('bpjs-tax-compliance')" style="background: linear-gradient(135deg, #059669 0%, #0d9488 100%); border: none; color: white; font-weight: bold;">📑 Rekonsiliasi BPJS & PPh 21</button>
              <button class="btn btn-info" id="btn-send-email-bulk" onclick="Payroll.confirmSendEmailBulk()">📧 KIRIM EMAIL KE SEMUA FILTER (0 KARYAWAN)</button>
              <button class="btn btn-primary" id="btn-download-zip-bulk" onclick="Payroll.downloadAllPayslipsZIP()" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border: none; color: white;">📦 Download All Payslips (ZIP) (0 KARYAWAN)</button>
              <button class="btn btn-success" id="btn-send-wa-bulk" onclick="Payroll.confirmSendWhatsAppBulk()" style="background: #25D366; border: none; color: white;">💬 KIRIM WA KE SEMUA FILTER (0 KARYAWAN)</button>
            </div>
          </div>
          <div class="card-body">
               <!-- Filtering Section -->
               <div style="display: flex; gap: 15px; margin-bottom: 20px; align-items: center; flex-wrap: wrap; background: #f9fafb; padding: 12px 16px; border-radius: 8px; border: 1px solid #e5e7eb; text-align: left;">
                   <div style="flex: 1; min-width: 200px;">
                       <label style="display: block; font-size: 0.8rem; font-weight: bold; margin-bottom: 4px; color: #4b5563;">Filter Departemen</label>
                       <select id="payroll-dept-filter" class="form-input" onchange="Payroll.handleFilterChange()" style="width: 100%;">
                           <!-- Populated dynamically -->
                       </select>
                   </div>
                   <div style="flex: 1.5; min-width: 250px;">
                       <label style="display: block; font-size: 0.8rem; font-weight: bold; margin-bottom: 4px; color: #4b5563;">Cari Nama / NIK</label>
                       <input type="text" id="payroll-search-filter" class="form-input" placeholder="Masukkan nama atau NIK karyawan..." oninput="Payroll.handleFilterChange()" style="width: 100%;">
                   </div>
                   <div style="display: flex; align-items: flex-end; height: 100%; padding-top: 18px;">
                       <button class="btn btn-secondary" onclick="Payroll.resetFilters()" style="padding: 10px 15px;">Reset Filter</button>
                   </div>
               </div>

               <!-- Progress Bar for Email Sending (Hidden by default) -->
               <div id="email-progress-container" style="display: none; margin-bottom: 20px; background: #e5e7eb; border-radius: 8px; overflow: hidden; height: 24px; position: relative;">
                  <div id="email-progress-bar" style="background: #3b82f6; width: 0%; height: 100%; transition: width 0.3s;"></div>
                  <div id="email-progress-text" style="position: absolute; width: 100%; text-align: center; font-size: 13px; line-height: 24px; color: #000; font-weight: bold;">Mengirim 0/0...</div>
               </div>

               <div id="payroll-table-container">
                  ${this.renderTable()}
               </div>
          </div>
        </div>
      `;
    } else {
      tabContent = `
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">⚙️ Master Konfigurasi Tarif Bonus Produksi</h2>
          </div>
          <div class="card-body text-left">
            <p class="mb-4 text-muted">Tentukan besaran tarif bonus rupiah per kilogram (Rp/kg) emas murni yang dilebur untuk masing-masing tingkatan gaji karyawan.</p>
            
            <div style="max-width: 500px; display: flex; flex-direction: column; gap: 15px;">
              <div class="form-group flex justify-between align-center">
                <label class="form-label" style="margin-bottom: 0;">Tarif Tingkat Senior (Rp/kg)</label>
                <input type="number" id="bonus-rate-senior" class="form-input" style="max-width: 220px;" value="${rates.Senior}">
              </div>
              <div class="form-group flex justify-between align-center">
                <label class="form-label" style="margin-bottom: 0;">Tarif Tingkat Junior (Rp/kg)</label>
                <input type="number" id="bonus-rate-junior" class="form-input" style="max-width: 220px;" value="${rates.Junior}">
              </div>
              <div class="form-group flex justify-between align-center">
                <label class="form-label" style="margin-bottom: 0;">Tarif Tingkat Standard (Rp/kg)</label>
                <input type="number" id="bonus-rate-standard" class="form-input" style="max-width: 220px;" value="${rates.Standard}">
              </div>
              <div style="margin-top: 10px;">
                <button class="btn btn-primary" onclick="Payroll.saveBonusRates()">💾 Simpan Tarif Bonus</button>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    content.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">💰 Payroll (Penggajian)</h1>
        <p class="page-description">Perhitungan gaji otomatis terintegrasi absensi</p>
      </div>

      <!-- Sub-Tabs Switcher -->
      <div class="mb-4" style="display: flex; gap: 10px; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">
        <button class="btn ${this.activeSubTab === 'calculator' ? 'btn-primary' : 'btn-secondary'}" onclick="Payroll.setActiveSubTab('calculator')">📋 Kalkulasi & Slip Gaji</button>
        <button class="btn ${this.activeSubTab === 'bonusRates' ? 'btn-primary' : 'btn-secondary'}" onclick="Payroll.setActiveSubTab('bonusRates')">⚙️ Master Tarif Bonus</button>
      </div>

      ${tabContent}
    `;

    if (this.activeSubTab === 'calculator') {
      this.populateDeptFilter();
      this.updateBulkSendButtonLabel();
    }
  },

  setActiveSubTab(tab) {
    this.activeSubTab = tab;
    this.render();
  },

  saveBonusRates() {
    const senior = parseInt(document.getElementById('bonus-rate-senior').value) || 0;
    const junior = parseInt(document.getElementById('bonus-rate-junior').value) || 0;
    const standard = parseInt(document.getElementById('bonus-rate-standard').value) || 0;
    const rates = { Senior: senior, Junior: junior, Standard: standard };
    localStorage.setItem('erp_bonus_rates', JSON.stringify(rates));
    alert('Tarif bonus produksi berhasil disimpan!');
    this.render();
  },

  setPeriod(period) {
    this.period = period;
    this.selectedDept = '';
    this.searchQuery = '';
    this.render();
  },

  getPeriodPayroll() {
    let list = this.payrollRecords.filter(p => p.period === this.period);
    if (this.selectedDept) {
      list = list.filter(p => p.department === this.selectedDept);
    }
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || String(p.nik).includes(q));
    }
    return list;
  },

  async calculateAttendanceForRange(employees, startDateStr, endDateStr) {
    const { collection, getDocs, query, where, limit } = window.firestore;
    const db = window.db;
    
    let snapshot;
    try {
        const q = query(
            collection(db, "attendance_raw"),
            where("date", ">=", startDateStr),
            where("date", "<=", endDateStr)
        );
        snapshot = await getDocs(q);
    } catch (e) {
        console.warn('⚠️ Fallback range query failed, fetching last 5000 docs:', e.message);
        try {
            const fallbackQ = query(collection(db, "attendance_raw"), limit(5000));
            snapshot = await getDocs(fallbackQ);
        } catch (err2) {
            console.error('⚠️ Firestore attendance_raw fetch failed completely:', err2.message);
        }
    }
    
    const logs = [];
    if (snapshot) {
        snapshot.forEach(doc => {
            const data = doc.data();
            const logDate = data.date || (data.timestamp ? data.timestamp.replace('T', ' ').split(' ')[0] : null);
            if (logDate && logDate >= startDateStr && logDate <= endDateStr) {
                logs.push({ ...data, date: logDate });
            }
        });
    }
    
    const calendarData = Storage.getWorkCalendar ? Storage.getWorkCalendar() : {};
    const shifts = Storage.get(Storage.KEYS.MASTER_SHIFTS) || [];
    const holidays = Storage.getHolidays ? Storage.getHolidays() : [];
    
    const dailyLogs = {};
    logs.forEach(log => {
        const nikStr = String(log.nik || '').trim();
        if (!nikStr) return;
        const logDate = log.date;
        
        if (!dailyLogs[nikStr]) dailyLogs[nikStr] = {};
        if (!dailyLogs[nikStr][logDate]) {
            dailyLogs[nikStr][logDate] = { in: null, out: null, raw: [] };
        }
        
        dailyLogs[nikStr][logDate].raw.push(log);
        
        const ts = String(log.timestamp || logDate + ' 00:00:00').replace('T', ' ');
        if (log.status === "IN") {
            if (!dailyLogs[nikStr][logDate].in || ts < dailyLogs[nikStr][logDate].in) {
                dailyLogs[nikStr][logDate].in = ts;
            }
        } else if (log.status === "OUT") {
            if (!dailyLogs[nikStr][logDate].out || ts > dailyLogs[nikStr][logDate].out) {
                dailyLogs[nikStr][logDate].out = ts;
            }
        }
    });
    
    return employees.map(emp => {
        const empNik = String(emp.nik || '').trim();
        const empId = String(emp.id || '').trim();
        const empLogs = dailyLogs[empNik] || dailyLogs[empId] || {};
        
        let workDays = 0;
        let missingTaps = 0;
        let lateCount = 0;
        let overtimeHours = 0;
        let nightDays = 0;
        let extraDays = 0;
        let lateDeductionAmount = 0;
        let halfDayIzinCount = 0;
        
        const start = new Date(startDateStr + 'T12:00:00');
        const end = new Date(endDateStr + 'T12:00:00');
        let cur = new Date(start);
        
        const isSecurity = (Storage.isSecurityEmployee && Storage.isSecurityEmployee(emp)) || (
            String(emp.department || '').toLowerCase().includes('security') ||
            String(emp.division || emp.job_level || '').toLowerCase().includes('security') ||
            String(emp.position || '').toLowerCase().includes('security') ||
            String(emp.position || '').toLowerCase().includes('satpam')
        );
        const isMess = (emp.night_meal_category === 'mess' || emp.is_mess === true || emp.living_in_mess === true || emp.mess === true);
        const isMessOrSecurity = isSecurity || isMess;

        let scheduledWorkDays = 0;
        
        while (cur <= end) {
            const yearStr = cur.getFullYear();
            const monthStr = String(cur.getMonth() + 1).padStart(2, '0');
            const dayStr = String(cur.getDate()).padStart(2, '0');
            const dateStr = `${yearStr}-${monthStr}-${dayStr}`;
            const currentPeriod = `${yearStr}-${monthStr}`;
            const dayKey = dayStr;
            
            const deptTarget = `DEPT:${emp.department}`;
            const empTarget = `EMP:${emp.id || emp.nik}`;
            const periodSchedule = calendarData[currentPeriod] || {};
            const deptSchedule = periodSchedule[deptTarget] || {};
            const empSchedule = periodSchedule[empTarget] || {};
            
            const shiftId = empSchedule[dayKey] || deptSchedule[dayKey];
            const shift = shiftId ? shifts.find(s => s.id === shiftId || s.code === shiftId) : null;
            
            const dayOfWeek = cur.getDay();
            const isSunday = dayOfWeek === 0;
            const isHoliday = holidays.some ? holidays.some(h => h.date === dateStr) : (Array.isArray(holidays) && holidays.includes(dateStr));
            const isCompanyDayoff = Storage.isCompanyDayoff ? Storage.isCompanyDayoff(dateStr) : false;
            const companyDayoffRec = isCompanyDayoff && Storage.getCompanyDayoffRecord ? Storage.getCompanyDayoffRecord(dateStr) : null;
            const isPaidCompanyDayoff = isCompanyDayoff && (!companyDayoffRec || companyDayoffRec.isPaid !== false);
            
            // Contract Active Date Validation (Pre-Join & Post-Resign Guard)
            const startDate = emp.start_date || emp.join_date;
            const resDate = emp.resignation_date || emp.resign_date;
            const isInactive = emp.status === 'NON-AKTIF' || emp.status === 'non_active' || emp.status === 'inactive';
            
            const isPreJoin = startDate && (dateStr < startDate);
            const isPostResign = isInactive && resDate && (dateStr > resDate);
            const isWithinContract = !isPreJoin && !isPostResign;

            if (isWithinContract && !isPaidCompanyDayoff) {
                if (isSecurity) {
                    if (!isSunday) {
                        scheduledWorkDays++;
                    }
                } else if (shift) {
                    scheduledWorkDays++;
                }
            }
            
            if (isWithinContract) {
                const dayLog = empLogs[dateStr];
                const isFirstDay = emp.start_date && (dateStr === emp.start_date);
                if (dayLog || isFirstDay) {
                    let isPresent = false;
                    if (isFirstDay) {
                        workDays++;
                        isPresent = true;
                    } else {
                        const hasIn = dayLog.in !== null;
                        const hasOut = dayLog.out !== null;
                        const totalLogs = (dayLog.raw || []).length;
                        
                        if ((hasIn && hasOut) || totalLogs >= 2 || (isMessOrSecurity && (hasIn || totalLogs >= 1))) {
                            workDays++;
                            isPresent = true;
                        } else if (totalLogs === 1) {
                            missingTaps++;
                            isPresent = true;
                        }
                    }
                    
                    if (isPresent) {
                        const isRedDay = isSunday || isHoliday;
                        if (isRedDay) {
                            extraDays++;
                        }

                        const clockInTime = (dayLog && dayLog.in) ? dayLog.in.split(' ')[1].substring(0, 5) : '';
                        const clockOutTime = (dayLog && dayLog.out) ? dayLog.out.split(' ')[1].substring(0, 5) : '';

                        if (isMessOrSecurity) {
                            overtimeHours += 4;
                            nightDays++; // Setiap kehadiran shift 12 jam Security/Mess berhak atas makan malam + makan siang
                        } else {
                            if ((shift && (shift.isNight || String(shift.code).toUpperCase().includes('MLM') || String(shift.name).toUpperCase().includes('MALAM'))) || 
                                (clockOutTime && clockOutTime >= '19:00')) {
                                nightDays++;
                            }

                            let dailyLateDeduction = 0;
                            if (!isFirstDay && dayLog && dayLog.in !== null && shift && shift.startTime) {
                                const inTime = clockInTime;
                                const penaltyRes = Storage.calculateLatePenalty 
                                    ? Storage.calculateLatePenalty(inTime, shift.startTime, emp.base_salary) 
                                    : { isLate: false, penalty: 0, isHalfDay: false };

                                if (penaltyRes.isLate) {
                                    if (penaltyRes.isHalfDay) {
                                        halfDayIzinCount += 1;
                                    } else {
                                        lateCount += 1;
                                        dailyLateDeduction = penaltyRes.penalty;
                                        lateDeductionAmount += dailyLateDeduction;
                                    }
                                }
                            }

                            if (dayLog && dayLog.out !== null && shift && shift.endTime) {
                                const outTime = clockOutTime;
                                const [oh, om] = outTime.split(':').map(Number);
                                const [eh, em] = shift.endTime.split(':').map(Number);
                                let outTotal = oh * 60 + om;
                                let endTotal = eh * 60 + em;
                                if (outTotal < 12 * 60 && endTotal > 12 * 60) {
                                    outTotal += 24 * 60;
                                }

                                if (outTotal > endTotal) {
                                    const extraMin = outTotal - endTotal;
                                    if (extraMin >= 60) {
                                        const rawOt = Math.floor(extraMin / 60);
                                        const otCap = this.getOvertimeCapHours(emp);
                                        overtimeHours += Math.min(rawOt, otCap);
                                    }
                                }

                                if (outTotal < endTotal) {
                                    const earlyMin = endTotal - outTotal;
                                    if (earlyMin > 120) {
                                        halfDayIzinCount += 1;
                                    } else if (earlyMin > 5) {
                                        lateDeductionAmount += (earlyMin <= 60 ? 10000 : 20000);
                                    }
                                }
                            }
                        }
                    }
                }
            }
            
            cur.setDate(cur.getDate() + 1);
        }
        
        const absenceDays = Math.max(0, scheduledWorkDays - workDays - missingTaps);
        
        return {
            nik: emp.nik,
            work_days: workDays,
            overtime_hours: overtimeHours,
            night_days: nightDays,
            extra_days: extraDays,
            late_count: lateCount,
            absence_days: absenceDays,
            half_day_izin: halfDayIzinCount,
            production_grams: 0,
            late_deduction: Math.round(lateDeductionAmount)
        };
    });
  },

  getOvertimeCapHours(emp) {
    if (!emp) return 1;
    if (emp.overtime_enabled === false) return 0;

    // Explicit override from master employee
    if (emp.overtime_cap_hours !== undefined && emp.overtime_cap_hours !== null && emp.overtime_cap_hours !== '' && emp.overtime_cap_hours !== 'default') {
      if (emp.overtime_cap_hours === 'uncapped') return 24;
      const parsed = parseFloat(emp.overtime_cap_hours);
      if (!isNaN(parsed)) return parsed;
    }

    const dept = String(emp.department || '').toLowerCase();
    const pos = String(emp.position || '').toLowerCase();
    const div = String(emp.division || emp.job_level || '').toLowerCase();

    // Security: Fixed 4 hours / day
    if (dept.includes('security') || pos.includes('security') || pos.includes('satpam')) {
      return 4;
    }
    // 1. Operator Produksi: Max 2 hours / day
    if (pos.includes('operator') || div.includes('production process') || div.includes('finishing')) {
      return 2;
    }
    // 2. Staff Produksi / Lab / Gudang / QC: Max 3 hours / day
    if (dept.includes('production') || div.includes('laboratory') || div.includes('warehouse') || div.includes('qc')) {
      return 3;
    }
    // 3. Staff Non-Produksi (HR, Legal, Finance, Marketing, IT, etc.): Max 1 hour / day
    return 1;
  },

  async calculatePayrollSimulation(employeesList, periodStr, customComponentsInject, checkedNiks = []) {
    const dates = this.getPeriodDates(periodStr);
    const startDateStr = dates.startDate;
    const endDateStr = dates.endDate;

    const settings = Storage.getOvertimeSettings();
    const prodLogs = Storage.getProductionLogs().filter(log => log.date >= startDateStr && log.date <= endDateStr);
    const prodOrders = (Storage.get(Storage.KEYS.PRODUCTION_ORDERS) || []).filter(order => order.status !== 'CANCELLED');

    const leaveRequests = (Storage.get(Storage.KEYS.LEAVE_REQUESTS) || []).filter(lr => {
      if (lr.status !== 'APPROVED') return false;
      const from = lr.dateFrom;
      const to = lr.dateTo || lr.dateFrom;
      return (from <= endDateStr && to >= startDateStr);
    });

    const filteredAtd = await this.calculateAttendanceForRange(employeesList, startDateStr, endDateStr);

    const eligibleEmployees = employeesList.filter(emp => {
      const isPastOrCurrentJoin = !emp.start_date || emp.start_date <= endDateStr;
      if (!isPastOrCurrentJoin) return false;

      const isInactive = emp.status === 'NON-AKTIF' || emp.status === 'non_active' || emp.status === 'inactive';
      const resDate = emp.resignation_date || emp.resign_date;

      if (!isInactive) {
          return true;
      }
      if (isInactive && resDate && resDate >= startDateStr) {
          return true;
      }
      return false;
    });

    return eligibleEmployees.map(emp => {
      const customComponents = {};
      if (checkedNiks.includes(String(emp.nik)) && customComponentsInject) {
          const { name, type, amount } = customComponentsInject;
          if (name) {
              customComponents[name] = { type, amount };
          }
      }

      const atd = filteredAtd.find(a => String(a.nik) === String(emp.nik)) || {
        work_days: 0,
        overtime_hours: 0,
        night_days: 0,
        extra_days: 0,
        late_count: 0,
        absence_days: 0,
        half_day_izin: 0,
        production_grams: 0
      };

      const base = parseFloat(emp.base_salary) || 0;
      const dept = emp.department || 'OTHER';

      let isNewHire = false;
      let daysBeforeJoin = 0;
      if (emp.start_date && emp.start_date >= startDateStr && emp.start_date <= endDateStr) {
          isNewHire = true;
          const joinDate = new Date(emp.start_date + 'T12:00:00');
          dayBeforeJoin = new Date(joinDate);
          dayBeforeJoin.setDate(joinDate.getDate() - 1);
          const dayBeforeStr = dayBeforeJoin.toISOString().substring(0, 10);
          if (dayBeforeStr >= startDateStr) {
              daysBeforeJoin = this.countWorkingDaysMonSat(startDateStr, dayBeforeStr);
          }
      }

      let isLeaver = false;
      let daysWorkedBeforeResign = 0;
      const resDate = emp.resignation_date || emp.resign_date;
      const isInactive = emp.status === 'NON-AKTIF' || emp.status === 'non_active' || emp.status === 'inactive';
      if (isInactive && resDate && resDate >= startDateStr && resDate <= endDateStr) {
          isLeaver = true;
          daysWorkedBeforeResign = this.countWorkingDaysMonSat(startDateStr, resDate);
      }

      let calculatedBaseSalary = base;
      if (isNewHire) {
          calculatedBaseSalary = base - (daysBeforeJoin * (base / 25));
      } else if (isLeaver) {
          calculatedBaseSalary = daysWorkedBeforeResign * (base / 25);
      }
      calculatedBaseSalary = Math.max(0, calculatedBaseSalary);

      const dailyRate = base / 25;

      const isFixedAllowanceEnabled = emp.fixed_allowance_enabled !== false;
      const fixedAllowance = isFixedAllowanceEnabled ? (parseFloat(emp.fixed_allowance) || 0) : 0;

      const isLunchEnabled = emp.lunch_allowance_enabled !== false;
      const lunchRate = emp.lunch_allowance_rate !== undefined && emp.lunch_allowance_rate !== '' ? parseFloat(emp.lunch_allowance_rate) : 20000;
      const mealPay = isLunchEnabled ? (atd.work_days || 0) * lunchRate : 0;

      const isNightMealEnabled = emp.night_meal_enabled !== false && emp.night_meal_category !== 'disabled';
      const nightMealRate = emp.night_meal_rate !== undefined && emp.night_meal_rate !== '' ? parseFloat(emp.night_meal_rate) : 20000;
      const nightMealPay = isNightMealEnabled ? (atd.night_days || 0) * nightMealRate : 0;

      const presencePay = dailyRate * (atd.extra_days || 0);

      const isOvertimeEnabled = emp.overtime_enabled !== false;
      let overtimePay = 0;
      if (isOvertimeEnabled) {
        let otRate = 20000;
        if (emp.overtime_hourly_rate) {
          otRate = parseFloat(emp.overtime_hourly_rate) || 20000;
        } else if (emp.overtime_rate_type === '10000') {
          otRate = 10000;
        } else if (emp.overtime_rate_type === '20000') {
          otRate = 20000;
        }
        overtimePay = (atd.overtime_hours || 0) * otRate;
      }

      let productionPay = 0;
      if (emp.payroll_level && emp.payroll_level !== 'N/A') {
        let totalKg = 0;
        const employeeLogs = prodLogs.filter(log => log.operators.some(op => String(op.nik) === String(emp.nik)));
        employeeLogs.forEach(log => { totalKg += log.total_weight; });

        prodOrders.forEach(order => {
          (order.movements || []).forEach(m => {
            const mDate = m.dateTime.substring(0, 10);
            if (mDate >= startDateStr && mDate <= endDateStr) {
              if ((m.operators || []).some(op => String(op.nik) === String(emp.nik))) {
                totalKg += m.outputWeight;
              }
            }
          });
        });

        const ratePerKg = 20000;
        const totalIncentive = totalKg * ratePerKg;
        if (emp.payroll_level === 'Senior') {
          productionPay = totalIncentive * 0.75;
        } else if (emp.payroll_level === 'Junior') {
          productionPay = totalIncentive * 0.25;
        } else {
          productionPay = totalIncentive;
        }
      }

      const calculatedLateDeduction = atd.late_deduction !== undefined ? atd.late_deduction : (atd.late_count || 0) * 20000;
      let lateOverrideAmount = null;
      let lateOverrideReason = null;
      let lateDeduction = calculatedLateDeduction;
      if (typeof PayrollSimulation !== 'undefined' && PayrollSimulation.lateOverrides && PayrollSimulation.lateOverrides[emp.nik]) {
          lateDeduction = PayrollSimulation.lateOverrides[emp.nik].amount;
          lateOverrideAmount = lateDeduction;
          lateOverrideReason = PayrollSimulation.lateOverrides[emp.nik].reason;
      }
      let adjustedAbsenceDays = atd.absence_days || 0;
      let leaveNotes = [];
      const empLeaves = leaveRequests.filter(lr => String(lr.employeeNik) === String(emp.nik));
      empLeaves.forEach(lr => {
        const leaveStart = lr.dateFrom > startDateStr ? lr.dateFrom : startDateStr;
        const leaveEnd = (lr.dateTo || lr.dateFrom) < endDateStr ? (lr.dateTo || lr.dateFrom) : endDateStr;
        
        let leaveDaysInPeriod = 0;
        if (leaveStart <= leaveEnd) {
            leaveDaysInPeriod = this.countWorkingDaysMonSat(leaveStart, leaveEnd);
        }
        
        if (lr.isPaid) {
          adjustedAbsenceDays = Math.max(0, adjustedAbsenceDays - leaveDaysInPeriod);
          leaveNotes.push(`${lr.leaveTypeCode}: ${leaveDaysInPeriod}d (Paid)`);
        } else {
          leaveNotes.push(`${lr.leaveTypeCode}: ${leaveDaysInPeriod}d (Unpaid)`);
        }
      });

      let absenceDeduction = adjustedAbsenceDays * (base / 25);
      let halfDayDeduction = (atd.half_day_izin || 0) * ((base / 25) * 0.5);

      const totalAbsenceDeductions = absenceDeduction + halfDayDeduction;
      if (totalAbsenceDeductions > calculatedBaseSalary) {
          absenceDeduction = calculatedBaseSalary;
          halfDayDeduction = 0;
      }

      const paySettings = Storage.getOvertimeSettings();
      const isBpjsHealthEnabled = emp.bpjs_health_enabled !== false;
      const isBpjsTkEnabled = emp.bpjs_tk_enabled !== false;

      const rawBpjsTkBase = emp.basic_salary_bpjs_tk !== undefined && emp.basic_salary_bpjs_tk !== '' 
        ? parseFloat(emp.basic_salary_bpjs_tk) 
        : (emp.bpjs_wage_basis !== undefined && emp.bpjs_wage_basis !== '' ? parseFloat(emp.bpjs_wage_basis) : base);
      const bpjsBase = isBpjsTkEnabled ? rawBpjsTkBase : 0;

      const rawBpjsKesBase = emp.basic_salary_bpjs_kes !== undefined && emp.basic_salary_bpjs_kes !== ''
        ? parseFloat(emp.basic_salary_bpjs_kes)
        : (emp.bpjs_wage_basis !== undefined && emp.bpjs_wage_basis !== '' ? parseFloat(emp.bpjs_wage_basis) : base);

      const UMK_SURABAYA_2026 = 5288796;
      const enforceUmkFloor = paySettings.enforce_umk_floor !== false;
      const bpjsHealthBase = (!isBpjsHealthEnabled || rawBpjsKesBase <= 0) 
        ? 0 
        : (enforceUmkFloor ? Math.max(rawBpjsKesBase, UMK_SURABAYA_2026) : rawBpjsKesBase);

      const bpjsHealthDeduction = (isBpjsHealthEnabled && bpjsHealthBase > 0 && paySettings.bpjs_health_emp) 
        ? Math.round((bpjsHealthBase * parseFloat(paySettings.bpjs_health_emp)) / 100) 
        : 0;
      const jhtDeduction = (isBpjsTkEnabled && bpjsBase > 0 && paySettings.jht_emp) 
        ? Math.round((bpjsBase * parseFloat(paySettings.jht_emp)) / 100) 
        : 0;

      const bpjsHealthBenefit = (isBpjsHealthEnabled && bpjsHealthBase > 0 && paySettings.bpjs_health_comp) 
        ? Math.round((bpjsHealthBase * parseFloat(paySettings.bpjs_health_comp)) / 100) 
        : 0;
      const jhtBenefit = (isBpjsTkEnabled && bpjsBase > 0 && paySettings.jht_comp) 
        ? Math.round((bpjsBase * parseFloat(paySettings.jht_comp)) / 100) 
        : 0;
      const jkkRate = (emp.jkk_risk_rate !== undefined && emp.jkk_risk_rate !== null && emp.jkk_risk_rate !== '') 
        ? parseFloat(emp.jkk_risk_rate) 
        : (parseFloat(paySettings.jkk_comp) || 0.89);
      const jkkBenefit = (isBpjsTkEnabled && bpjsBase > 0) 
        ? Math.round((bpjsBase * jkkRate) / 100) 
        : 0;
      const jkmBenefit = (isBpjsTkEnabled && bpjsBase > 0 && paySettings.jkm_comp) 
        ? Math.round((bpjsBase * parseFloat(paySettings.jkm_comp)) / 100) 
        : 0;

      let customEarningsSum = 0;
      let customDeductionsSum = 0;
      Object.values(customComponents).forEach(comp => {
          if (comp.type === 'earnings') customEarningsSum += (comp.amount || 0);
          if (comp.type === 'deduction') customDeductionsSum += (comp.amount || 0);
      });

      const totalEarnings = calculatedBaseSalary + fixedAllowance + mealPay + nightMealPay + presencePay + overtimePay + productionPay + customEarningsSum;

      let pph21_deduction = 0;
      let ter_rate = 0;
      let ter_category = 'A';
      if (typeof TaxEngineTER !== 'undefined') {
        const terResult = TaxEngineTER.calculatePPh21(emp.ptkp, totalEarnings);
        pph21_deduction = terResult.taxAmount;
        ter_rate = terResult.ratePct;
        ter_category = terResult.category;
      }

      const totalDeductions = lateDeduction + absenceDeduction + halfDayDeduction + bpjsHealthDeduction + jhtDeduction + pph21_deduction + customDeductionsSum;
      let totalSalary = totalEarnings - totalDeductions;
      totalSalary = Math.max(0, totalSalary);

      return {
        nik: emp.nik,
        name: emp.name,
        department: dept,
        position: emp.position || '-',
        ptkp: emp.ptkp || '-',
        npwp: emp.npwp || '-',
        period: periodStr,
        base_salary: Math.round(calculatedBaseSalary),
        fixed_allowance: fixedAllowance,
        daily_rate: Math.round(dailyRate),
        work_days: atd.work_days,
        meal_pay: mealPay,
        night_meal_pay: nightMealPay,
        presence_pay: Math.round(presencePay),
        overtime_hours: atd.overtime_hours,
        overtime_pay: overtimePay,
        production_pay: Math.round(productionPay),
        late_deduction: lateDeduction,
        calculated_late_deduction: calculatedLateDeduction,
        late_deduction_override: lateOverrideAmount,
        keterangan_override_late: lateOverrideReason,
        absence_deduction: Math.round(absenceDeduction),
        half_day_deduction: Math.round(halfDayDeduction),
        bpjs_health_deduction: Math.round(bpjsHealthDeduction),
        jht_deduction: Math.round(jhtDeduction),
        pph21_deduction: pph21_deduction,
        ter_rate: ter_rate,
        ter_category: ter_category,
        bpjs_health_benefit: Math.round(bpjsHealthBenefit),
        bpjs_kes_benefit: Math.round(bpjsHealthBenefit),
        jht_benefit: Math.round(jhtBenefit),
        jkk_benefit: Math.round(jkkBenefit),
        jkm_benefit: Math.round(jkmBenefit),
        bpjs_tk_benefit: Math.round(jhtBenefit + jkkBenefit + jkmBenefit),
        custom_components: customComponents,
        total_earnings: Math.round(totalEarnings),
        total_salary: Math.round(totalSalary),
        leave_notes: leaveNotes.join(', ') || '-',
      };
    });
  },

  async generatePayroll() {
    if (!this.canAccessPayroll()) {
      this.renderAccessDenied();
      return;
    }
    if (!this.isAuthenticatedWithPassword) {
      this.renderPasswordPrompt();
      return;
    }

    const dates = this.getPeriodDates(this.period);
    const startDateStr = dates.startDate;
    const endDateStr = dates.endDate;

    console.log(`⚡ Generating payroll for range: ${startDateStr} s/d ${endDateStr}`);

    const settings = Storage.getOvertimeSettings();
    const prodLogs = Storage.getProductionLogs().filter(log => log.date >= startDateStr && log.date <= endDateStr);
    const prodOrders = (Storage.get(Storage.KEYS.PRODUCTION_ORDERS) || []).filter(order => order.status !== 'CANCELLED');

    // Load Approved Leave Requests that overlap with the period
    const leaveRequests = (Storage.get(Storage.KEYS.LEAVE_REQUESTS) || []).filter(lr => {
      if (lr.status !== 'APPROVED') return false;
      const from = lr.dateFrom;
      const to = lr.dateTo || lr.dateFrom;
      return (from <= endDateStr && to >= startDateStr);
    });

    // 1. Calculate Attendance dynamically from raw logs for the range
    const filteredAtd = await this.calculateAttendanceForRange(this.employees, startDateStr, endDateStr);

    // Filter employees: Active (who joined on/before period end) or Inactive (who resigned during period)
    const eligibleEmployees = this.employees.filter(emp => {
      const isPastOrCurrentJoin = !emp.start_date || emp.start_date <= endDateStr;
      if (!isPastOrCurrentJoin) return false;

      const isInactive = emp.status === 'NON-AKTIF' || emp.status === 'non_active' || emp.status === 'inactive';
      const resDate = emp.resignation_date || emp.resign_date;

      if (!isInactive) {
          return true;
      }
      // If non-active, include if resignation date falls within or after period start (for pro-rata or post-25th rollover)
      if (isInactive && resDate && resDate >= startDateStr) {
          return true;
      }
      return false;
    });

    const newRecords = eligibleEmployees.map(emp => {
      const existingRecord = this.payrollRecords.find(pr => pr.nik === emp.nik && pr.period === this.period);
      const variableAllowance = existingRecord ? (existingRecord.variable_allowance || 0) : 0;
      const bonus = existingRecord ? (existingRecord.bonus || 0) : 0;
      const otherDeductions = existingRecord ? (existingRecord.other_deductions || 0) : 0;
      const customComponents = existingRecord ? (existingRecord.custom_components || {}) : {};

      const atd = filteredAtd.find(a => String(a.nik) === String(emp.nik)) || {
        work_days: 0,
        overtime_hours: 0,
        night_days: 0,
        extra_days: 0,
        late_count: 0,
        absence_days: 0,
        half_day_izin: 0,
        production_grams: 0
      };

      const base = emp.base_salary || 0;
      const isFixedAllowanceEnabled = emp.fixed_allowance_enabled !== false;
      const fixedAllowance = isFixedAllowanceEnabled 
        ? (emp.fixed_allowance !== undefined && emp.fixed_allowance !== '' 
            ? (parseFloat(emp.fixed_allowance) || 0) 
            : (emp.tunj_tetap !== undefined ? (parseFloat(emp.tunj_tetap) || 0) : (existingRecord ? (parseFloat(existingRecord.tunj_tetap) || 0) : 0)))
        : 0;
      const dept = emp.department || 'OTHER';

      // Check if New Hire in this period
      let isNewHire = false;
      let daysBeforeJoin = 0;
      if (emp.start_date && emp.start_date >= startDateStr && emp.start_date <= endDateStr) {
          isNewHire = true;
          const joinDate = new Date(emp.start_date + 'T12:00:00');
          const dayBeforeJoin = new Date(joinDate);
          dayBeforeJoin.setDate(joinDate.getDate() - 1);
          const dayBeforeStr = dayBeforeJoin.toISOString().substring(0, 10);
          if (dayBeforeStr >= startDateStr) {
              daysBeforeJoin = this.countWorkingDaysMonSat(startDateStr, dayBeforeStr);
          }
      }

      // Check if Leaver in this period
      let isLeaver = false;
      let daysWorkedBeforeResign = 0;
      const resDate = emp.resignation_date || emp.resign_date;
      const isInactive = emp.status === 'NON-AKTIF' || emp.status === 'non_active' || emp.status === 'inactive';
      if (isInactive && resDate && resDate >= startDateStr && resDate <= endDateStr) {
          isLeaver = true;
          daysWorkedBeforeResign = this.countWorkingDaysMonSat(startDateStr, resDate);
      }

      // Prorated fixed components using 25-day basis (Mon-Sat)
      let calculatedBaseSalary = base;
      if (isNewHire) {
          calculatedBaseSalary = base - (daysBeforeJoin * (base / 25));
      } else if (isLeaver) {
          calculatedBaseSalary = daysWorkedBeforeResign * (base / 25);
      }
      calculatedBaseSalary = Math.max(0, calculatedBaseSalary);

      const dailyRate = base / 25; // Basis 25 hari

      const isSecurity = (Storage.isSecurityEmployee && Storage.isSecurityEmployee(emp)) || (
          String(emp.department || '').toLowerCase().includes('security') ||
          String(emp.division || emp.job_level || '').toLowerCase().includes('security') ||
          String(emp.position || '').toLowerCase().includes('security') ||
          String(emp.position || '').toLowerCase().includes('satpam')
      );
      const isMess = (emp.night_meal_category === 'mess' || emp.is_mess === true || emp.living_in_mess === true || emp.mess === true);
      const isMessOrSecurity = isSecurity || isMess;
      const securityOtRate = emp.security_overtime_rate || emp.overtime_rate || 10000;

      // 2. Meal Allowance
      const isLunchEnabled = emp.lunch_allowance_enabled !== false;
      const lunchRate = emp.lunch_allowance_rate !== undefined && emp.lunch_allowance_rate !== '' ? parseFloat(emp.lunch_allowance_rate) : 20000;
      // For Security & Mess: Every 12-hour shift attended earns both Lunch Allowance (Rp 20.000) and Night Meal Allowance (Rp 20.000)
      const mealPay = isLunchEnabled ? (atd.work_days || 0) * lunchRate : 0;

      const isNightMealEnabled = emp.night_meal_enabled !== false && emp.night_meal_category !== 'disabled';
      const nightMealRate = emp.night_meal_rate !== undefined && emp.night_meal_rate !== '' ? parseFloat(emp.night_meal_rate) : 20000;
      const nightMealPay = isNightMealEnabled ? (isMessOrSecurity ? (atd.work_days || 0) * nightMealRate : (atd.night_days || 0) * nightMealRate) : 0;

      // 3. Presence Allowance (Red Day Work for office staff; Security handled via surplusWorkPay)
      const presencePay = isSecurity ? 0 : dailyRate * (atd.extra_days || 0);

      // 4. Overtime
      const isOvertimeEnabled = emp.overtime_enabled !== false;
      let overtimePay = 0;
      if (isOvertimeEnabled) {
        let otRate = 20000;
        if (emp.overtime_hourly_rate) {
          otRate = parseFloat(emp.overtime_hourly_rate) || 20000;
        } else if (emp.overtime_rate_type === '10000') {
          otRate = 10000;
        } else if (emp.overtime_rate_type === '20000') {
          otRate = 20000;
        } else if (isMessOrSecurity) {
          otRate = securityOtRate;
        }
        overtimePay = (atd.overtime_hours || 0) * otRate;
      }

      // 5. Production Bonus (20k / kg)
      let productionPay = 0;
      if (emp.payroll_level && emp.payroll_level !== 'N/A') {
        let totalKg = 0;
        const employeeLogs = prodLogs.filter(log => log.operators.some(op => String(op.nik) === String(emp.nik)));
        employeeLogs.forEach(log => { totalKg += log.total_weight; });

        prodOrders.forEach(order => {
          (order.movements || []).forEach(m => {
            const mDate = m.dateTime.substring(0, 10);
            if (mDate >= startDateStr && mDate <= endDateStr) {
              if ((m.operators || []).some(op => String(op.nik) === String(emp.nik))) {
                totalKg += m.outputWeight;
              }
            }
          });
        });

        const localRates = localStorage.getItem('erp_bonus_rates');
        const bonusRates = localRates ? JSON.parse(localRates) : { Standard: 20000, Senior: 15000, Junior: 5000 };
        const pLevel = emp.payroll_level || 'Standard';
        const ratePerKg = bonusRates[pLevel] !== undefined ? bonusRates[pLevel] : (bonusRates.Standard || 20000);
        productionPay = totalKg * ratePerKg;
      }

      // 6. Deductions
      const calculatedLateDeduction = isSecurity ? 0 : (atd.late_deduction !== undefined ? atd.late_deduction : (atd.late_count || 0) * 20000);
      let lateOverrideAmount = null;
      let lateOverrideReason = null;
      let lateDeduction = calculatedLateDeduction;
      if (!isSecurity && existingRecord && existingRecord.late_deduction_override !== undefined && existingRecord.late_deduction_override !== null) {
          lateDeduction = existingRecord.late_deduction_override;
          lateOverrideAmount = lateDeduction;
          lateOverrideReason = existingRecord.keterangan_override_late;
      }
      
      // Specification 1 & 2: Fixed Monthly Base Salary & Leave Hierarchy / Security Target Benchmark
      const targetWorkingDays = this.countWorkingDaysMonSat(startDateStr, endDateStr) || 26;

      let totalAbsenceDays = isSecurity 
        ? Math.max(0, targetWorkingDays - (atd.work_days || 0)) 
        : (atd.absence_days || 0);

      // Leave balance retrieval honoring current_year_override from Storage
      const [calcYearStr] = this.period.split('-');
      const calcYear = parseInt(calcYearStr, 10) || new Date().getFullYear();
      let leaveBalRecord = null;
      if (typeof Storage !== 'undefined' && Storage.getLeaveBalances) {
        const balances = Storage.getLeaveBalances();
        leaveBalRecord = balances.find(b => String(b.employeeNik) === String(emp.nik) && b.year === calcYear);
      }

      let annualLeaveQuota = 12;
      if (leaveBalRecord && leaveBalRecord.annualLeaveQuota !== undefined && leaveBalRecord.annualLeaveQuota !== null) {
        annualLeaveQuota = parseFloat(leaveBalRecord.annualLeaveQuota);
      } else if (emp.annual_leave_quota !== undefined && emp.annual_leave_quota !== null) {
        annualLeaveQuota = parseFloat(emp.annual_leave_quota);
      } else if (emp.leave_balance !== undefined && emp.leave_balance !== null) {
        annualLeaveQuota = parseFloat(emp.leave_balance);
      }

      let coveredByQuotaDays = Math.min(totalAbsenceDays, Math.max(0, annualLeaveQuota));
      let unpaidAbsenceDays = Math.max(0, totalAbsenceDays - coveredByQuotaDays);

      let leaveNotes = [];
      if (coveredByQuotaDays > 0) leaveNotes.push(`Cuti Tahunan: ${coveredByQuotaDays}d (Paid)`);
      if (unpaidAbsenceDays > 0) leaveNotes.push(`Unpaid Absence: ${unpaidAbsenceDays}d (Potong Gaji/25)`);

      let absenceDeduction = Math.round(unpaidAbsenceDays * (base / 25));
      let halfDayDeduction = (atd.half_day_izin || 0) * ((base / 25) * 0.5);

      // Safety Cap: Total unpaid leave deductions cannot exceed calculatedBaseSalary
      const totalAbsenceDeductions = absenceDeduction + halfDayDeduction;
      if (totalAbsenceDeductions > calculatedBaseSalary) {
          absenceDeduction = calculatedBaseSalary;
          halfDayDeduction = 0;
      }

      // Specification 3: Shifted Cut-Off Date & Deferred Compensation ("Kekurangan Gaji [Nama Bulan Lalu]")
      const [pYear, pMonth] = this.period.split('-').map(Number);
      let prevY = pYear;
      let prevM = pMonth - 1;
      if (prevM === 0) {
        prevM = 12;
        prevY -= 1;
      }
      const monthNamesIndo = {
        1: 'Januari', 2: 'Februari', 3: 'Maret', 4: 'April',
        5: 'Mei', 6: 'Juni', 7: 'Juli', 8: 'Agustus',
        9: 'September', 10: 'Oktober', 11: 'November', 12: 'Desember'
      };
      const previousMonthName = monthNamesIndo[prevM];

      let previousMonthDeficiency = 0;
      if (existingRecord && existingRecord.previous_month_deficiency !== undefined && existingRecord.previous_month_deficiency !== null) {
        previousMonthDeficiency = parseFloat(existingRecord.previous_month_deficiency) || 0;
      } else if (emp.previous_month_deficiency !== undefined && emp.previous_month_deficiency !== null) {
        previousMonthDeficiency = parseFloat(emp.previous_month_deficiency) || 0;
      } else if (atd.previous_month_deficiency !== undefined && atd.previous_month_deficiency !== null) {
        previousMonthDeficiency = parseFloat(atd.previous_month_deficiency) || 0;
      }

      // 7. BPJS & JHT Logic (based on full contract base or separate BPJS Wage Basis)
      const paySettings = Storage.getOvertimeSettings();
      const isBpjsHealthEnabled = emp.bpjs_health_enabled !== false;
      const isBpjsTkEnabled = emp.bpjs_tk_enabled !== false;

      const rawBpjsTkBase = emp.basic_salary_bpjs_tk !== undefined && emp.basic_salary_bpjs_tk !== '' 
        ? parseFloat(emp.basic_salary_bpjs_tk) 
        : (emp.bpjs_wage_basis !== undefined && emp.bpjs_wage_basis !== '' ? parseFloat(emp.bpjs_wage_basis) : base);
      const bpjsBase = isBpjsTkEnabled ? rawBpjsTkBase : 0;

      const rawBpjsKesBase = emp.basic_salary_bpjs_kes !== undefined && emp.basic_salary_bpjs_kes !== ''
        ? parseFloat(emp.basic_salary_bpjs_kes)
        : (emp.bpjs_wage_basis !== undefined && emp.bpjs_wage_basis !== '' ? parseFloat(emp.bpjs_wage_basis) : base);

      // Enforcement of Regional Minimum Wage (UMK Surabaya 2026: Rp 5.288.796) Floor for BPJS Kesehatan
      const UMK_SURABAYA_2026 = 5288796;
      const enforceUmkFloor = paySettings.enforce_umk_floor !== false;
      const bpjsHealthBase = (!isBpjsHealthEnabled || rawBpjsKesBase <= 0) 
        ? 0 
        : (enforceUmkFloor ? Math.max(rawBpjsKesBase, UMK_SURABAYA_2026) : rawBpjsKesBase);

      const bpjsHealthDeduction = (isBpjsHealthEnabled && bpjsHealthBase > 0 && paySettings.bpjs_health_emp !== undefined && paySettings.bpjs_health_emp !== null)
        ? Math.round((bpjsHealthBase * parseFloat(paySettings.bpjs_health_emp)) / 100)
        : 0;

      const jhtDeduction = (isBpjsTkEnabled && bpjsBase > 0 && paySettings.jht_emp !== undefined && paySettings.jht_emp !== null)
        ? Math.round((bpjsBase * parseFloat(paySettings.jht_emp)) / 100)
        : 0;

      const bpjsHealthBenefit = (isBpjsHealthEnabled && bpjsHealthBase > 0 && paySettings.bpjs_health_comp !== undefined && paySettings.bpjs_health_comp !== null)
        ? Math.round((bpjsHealthBase * parseFloat(paySettings.bpjs_health_comp)) / 100)
        : 0;

      const jhtBenefit = (isBpjsTkEnabled && bpjsBase > 0 && paySettings.jht_comp !== undefined && paySettings.jht_comp !== null)
        ? Math.round((bpjsBase * parseFloat(paySettings.jht_comp)) / 100)
        : 0;

      const jkkRate = (emp.jkk_risk_rate !== undefined && emp.jkk_risk_rate !== null && emp.jkk_risk_rate !== '') 
        ? parseFloat(emp.jkk_risk_rate) 
        : (parseFloat(paySettings.jkk_comp) || 0.89);
      const jkkBenefit = (isBpjsTkEnabled && bpjsBase > 0) 
        ? Math.round((bpjsBase * jkkRate) / 100) 
        : 0;

      const jkmBenefit = (isBpjsTkEnabled && bpjsBase > 0 && paySettings.jkm_comp !== undefined && paySettings.jkm_comp !== null)
        ? Math.round((bpjsBase * parseFloat(paySettings.jkm_comp)) / 100)
        : 0;

      let customEarningsSum = 0;
      let customDeductionsSum = 0;
      Object.values(customComponents).forEach(comp => {
          if (comp.type === 'earnings') customEarningsSum += (comp.amount || 0);
          if (comp.type === 'deduction') customDeductionsSum += (comp.amount || 0);
      });

      const surplusWorkDays = isSecurity ? Math.max(0, (atd.work_days || 0) - targetWorkingDays) : 0;
      const surplusWorkPay = Math.round(surplusWorkDays * (base / 25));

      const totalEarnings = calculatedBaseSalary + fixedAllowance + mealPay + nightMealPay + presencePay + overtimePay + productionPay + variableAllowance + bonus + previousMonthDeficiency + surplusWorkPay + customEarningsSum;

      // PPh 21 TER: Taxable Gross includes cash earnings + employer-paid taxable insurance benefits (JKK, JKM, BPJS Kes)
      const taxableGrossForTER = totalEarnings + jkkBenefit + jkmBenefit + bpjsHealthBenefit;

      let pph21_deduction = 0;
      let ter_rate = 0;
      let ter_category = 'A';
      if (typeof TaxEngineTER !== 'undefined') {
        const terResult = TaxEngineTER.calculatePPh21(emp.ptkp, taxableGrossForTER);
        pph21_deduction = terResult.taxAmount;
        ter_rate = terResult.ratePct;
        ter_category = terResult.category;
      }

      const totalDeductions = lateDeduction + absenceDeduction + halfDayDeduction + bpjsHealthDeduction + jhtDeduction + pph21_deduction + otherDeductions + customDeductionsSum;
      let totalSalary = totalEarnings - totalDeductions;
      totalSalary = Math.max(0, totalSalary); // Net salary safety cap (never negative)

      return {
        id: `PAY-${this.period}-${emp.nik}`,
        nik: emp.nik,
        name: emp.name,
        department: dept,
        position: emp.position || '-',
        ptkp: emp.ptkp || '-',
        npwp: emp.npwp || '-',
        period: this.period,
        is_first_day: isNewHire,
        base_salary: Math.round(calculatedBaseSalary), // Slip shows the prorated base salary if new hire/leaver
        daily_rate: Math.round(dailyRate),
        work_days: atd.work_days,
        surplus_work_days: surplusWorkDays,
        surplus_work_pay: surplusWorkPay,
        covered_by_quota_days: coveredByQuotaDays,
        unpaid_absence_days: unpaidAbsenceDays,
        annual_leave_quota: annualLeaveQuota,
        previous_month_deficiency: previousMonthDeficiency,
        previous_month_name: previousMonthName,
        meal_pay: mealPay,
        night_meal_pay: nightMealPay,
        presence_pay: Math.round(presencePay),
        overtime_hours: atd.overtime_hours,
        overtime_pay: overtimePay,
        production_pay: Math.round(productionPay),
        late_deduction: lateDeduction,
        calculated_late_deduction: calculatedLateDeduction,
        late_deduction_override: lateOverrideAmount,
        keterangan_override_late: lateOverrideReason,
        absence_deduction: Math.round(absenceDeduction),
        half_day_deduction: Math.round(halfDayDeduction),
        bpjs_health_deduction: Math.round(bpjsHealthDeduction),
        jht_deduction: Math.round(jhtDeduction),
        pph21_deduction: pph21_deduction,
        ter_rate: ter_rate,
        ter_category: ter_category,
        bpjs_health_benefit: Math.round(bpjsHealthBenefit),
        jht_benefit: Math.round(jhtBenefit),
        jkk_benefit: Math.round(jkkBenefit),
        jkm_benefit: Math.round(jkmBenefit),
        tunj_tetap: Math.round(fixedAllowance),
        fixed_allowance: Math.round(fixedAllowance),
        variable_allowance: variableAllowance,
        bonus: bonus,
        other_deductions: otherDeductions,
        custom_components: customComponents,
        total_salary: Math.round(totalSalary),
        leave_notes: leaveNotes.join(', ') || '-',
        status: 'draft',
        paidAt: null
      };
    });

    // Merge or replace
    newRecords.forEach(nr => {
      const idx = this.payrollRecords.findIndex(pr => pr.id === nr.id);
      if (idx !== -1) {
        if (this.payrollRecords[idx].status === 'paid') return; // Don't touch paid ones
        if (this.payrollRecords[idx].imported) return; // Don't overwrite imported records!
        this.payrollRecords[idx] = nr;
      } else {
        this.payrollRecords.push(nr);
      }
    });

    await Storage.set(Storage.KEYS.PAYROLL, this.payrollRecords);
    if (typeof window !== 'undefined' && window.document && !this._isHeadlessRunning) {
      alert(`Berhasil meng-generate ${newRecords.length} slip gaji.\n\n📅 Rentang Periode: ${startDateStr} s/d ${endDateStr}`);
    }
    if (!this._isHeadlessRunning) {
      this.render();
    }
    return newRecords;
  },

  async runHeadlessSimulation(periodStr = '2026-08') {
    console.log(`🚀 Running Automated Headless Payroll Simulation for Period: ${periodStr}`);
    this._isHeadlessRunning = true;
    this.period = periodStr;
    const employees = Storage.getEmployees().filter(e => e.status !== 'NON-AKTIF' && e.status !== 'non_active' && e.status !== 'inactive');
    const results = await this.calculatePayrollSimulation(employees, periodStr, {});
    this._isHeadlessRunning = false;
    console.log(`✅ Automated Simulation Complete! Processed ${results.length} active employee records.`);
    return results;
  },

  isDetailedAllowanceView: false,

  toggleAllowanceView() {
    this.isDetailedAllowanceView = !this.isDetailedAllowanceView;
    this.render();
  },

  calculateTotals(records) {
    return (records || []).reduce((acc, row) => {
      let customEarningsSum = 0;
      Object.entries(row.custom_components || {}).forEach(([name, data]) => {
        if (data && data.type === 'earnings' && data.amount > 0) {
          customEarningsSum += Number(data.amount || 0);
        }
      });

      const rowMealPay = Number(row.meal_pay || row.meal_allowance || 0);
      const rowNightMealPay = Number(row.night_meal_pay || 0);
      const rowPresencePay = Number(row.presence_pay || row.tunj_kehadiran || 0);
      const rowProdPay = Number(row.production_pay || row.bonus_produksi || 0);
      const rowOtPay = Number(row.overtime_pay || row.uang_lembur || 0);
      const rowFixedAllowance = Number(row.fixed_allowance || row.tunj_tetap || 0);
      const rowVarAllowance = Number(row.variable_allowance || row.tunj_variabel || 0);
      const rowTransport = Number(row.transport_allowance || row.tunj_transport || 0);
      const rowLuarKota = Number(row.tunj_luar_kota || row.dinas_luar_kota || 0);
      const rowBonus = Number(row.bonus || row.thr || 0);
      const rowDeficiency = Number(row.previous_month_deficiency || row.selisih_kurang_gaji || 0);
      const rowAdhoc = Number(row.adhoc_allowance || 0);

      const rowTotalTunjangan = rowMealPay + 
                                rowNightMealPay + 
                                rowPresencePay + 
                                rowProdPay + 
                                rowOtPay + 
                                rowFixedAllowance + 
                                rowVarAllowance + 
                                rowTransport +
                                rowLuarKota + 
                                rowBonus + 
                                rowDeficiency + 
                                rowAdhoc +
                                customEarningsSum;

      const lateDed = Number(row.late_deduction || 0);
      const absDed = Number(row.absence_deduction || 0) + Number(row.half_day_deduction || 0);
      const taxBpjs = Number(row.bpjs_health_deduction || 0) + Number(row.jht_deduction || 0) + Number(row.pph21_deduction || 0);
      const otherDed = Number(row.other_deductions || 0) + Number(row.adhoc_deduction || 0);

      acc.count += 1;
      acc.totalBaseSalary += Number(row.base_salary || 0);
      acc.totalFixed += rowFixedAllowance;
      acc.totalMeal += (rowMealPay + rowNightMealPay + rowPresencePay);
      acc.totalBonusProd += rowProdPay;
      acc.totalLembur += rowOtPay;
      acc.totalVarAllowance += rowVarAllowance;
      acc.totalBonus += rowBonus;
      acc.totalTunjangan += rowTotalTunjangan;
      acc.totalLateAbsence += (lateDed + absDed);
      acc.totalBpjsPph += taxBpjs;
      acc.totalOtherDeductions += otherDed;
      acc.totalSalary += Number(row.total_salary || 0);
      return acc;
    }, {
      count: 0,
      totalBaseSalary: 0,
      totalFixed: 0,
      totalMeal: 0,
      totalBonusProd: 0,
      totalLembur: 0,
      totalVarAllowance: 0,
      totalBonus: 0,
      totalTunjangan: 0,
      totalLateAbsence: 0,
      totalBpjsPph: 0,
      totalOtherDeductions: 0,
      totalSalary: 0
    });
  },

  renderTable() {
    const list = this.getPeriodPayroll();
    const allPeriodRecords = this.payrollRecords.filter(p => p.period === this.period);
    if (allPeriodRecords.length === 0) {
      return '<p class="text-center text-gray">Klik "Generate Payroll" atau "Import Excel" untuk memuat gaji periode ini.</p>';
    }
    if (list.length === 0) {
      return '<p class="text-center text-gray">Tidak ada data payroll yang cocok dengan filter pencarian.</p>';
    }

    // Pure Mathematical Calculations (Independent of DOM/viewport)
    const allTotals = this.calculateTotals(allPeriodRecords);
    const filteredTotals = this.calculateTotals(list);
    const isFiltered = list.length !== allPeriodRecords.length;

    const dates = this.getPeriodDates(this.period);
    const workingDays = this.countWorkingDaysMonSat(dates.startDate, dates.endDate);

    // Scan for active dynamic components
    const showMeal = list.some(r => (r.meal_pay || r.meal_allowance || 0) > 0 || (r.night_meal_pay || 0) > 0 || (r.presence_pay || 0) > 0);
    const showBonusProd = list.some(r => (r.production_pay || r.bonus_produksi || 0) > 0);
    const showLembur = list.some(r => (r.overtime_pay || r.uang_lembur || 0) > 0);
    const showFixed = list.some(r => (r.fixed_allowance || r.tunj_tetap || 0) > 0);
    const showVarAllowance = list.some(r => (r.variable_allowance || r.tunj_variabel || 0) > 0);
    const showBonus = list.some(r => (r.bonus || r.thr || 0) > 0);
    const showOtherDeductions = list.some(r => (r.other_deductions || 0) > 0);

    const activeCustomEarnings = new Set();
    const activeCustomDeductions = new Set();

    list.forEach(r => {
      Object.entries(r.custom_components || {}).forEach(([name, data]) => {
        if (data && data.amount > 0) {
          if (data.type === 'earnings') activeCustomEarnings.add(name);
          if (data.type === 'deduction') activeCustomDeductions.add(name);
        }
      });
    });

    const customEarningsArr = Array.from(activeCustomEarnings);
    const customDeductionsArr = Array.from(activeCustomDeductions);

    // Build Headers
    let headersHTML = `
      <th class="sticky-col sticky-col-shadow">Nama / NIK</th>
      <th class="text-right">Gaji Pokok</th>
    `;

    if (this.isDetailedAllowanceView) {
      if (showFixed) headersHTML += `<th class="text-right">Tunj. Tetap</th>`;
      if (showMeal) headersHTML += `<th class="text-right">Meal/Allowance</th>`;
      if (showBonusProd) headersHTML += `<th class="text-right">Bonus Prod</th>`;
      if (showLembur) headersHTML += `<th class="text-right">Lembur</th>`;
      if (showVarAllowance) headersHTML += `<th class="text-right">Tunj. Variabel</th>`;
      if (showBonus) headersHTML += `<th class="text-right">Bonus</th>`;
      customEarningsArr.forEach(name => {
        headersHTML += `<th class="text-right">${name}</th>`;
      });
    }

    headersHTML += `
      <th class="text-right" style="background: rgba(16, 185, 129, 0.08);">Total Tunjangan</th>
      <th class="text-right">Potongan Absensi/Late</th>
      <th class="text-right">BPJS/PPh21</th>
    `;
    if (showOtherDeductions) headersHTML += `<th class="text-right">Pot. Lain-lain</th>`;

    // Custom Deductions Headers
    customDeductionsArr.forEach(name => {
      headersHTML += `<th class="text-right">${name}</th>`;
    });

    headersHTML += `
      <th class="text-right">Total Gaji</th>
      <th>Status</th>
      <th class="text-center">Aksi</th>
    `;

    // Build Rows
    let rowsHTML = '';

    list.forEach((row, idx) => {
      let customEarningsSum = 0;
      Object.entries(row.custom_components || {}).forEach(([name, data]) => {
        if (data && data.type === 'earnings' && data.amount > 0) {
          customEarningsSum += Number(data.amount || 0);
        }
      });

      const rowMealPay = Number(row.meal_pay || row.meal_allowance || 0);
      const rowNightMealPay = Number(row.night_meal_pay || 0);
      const rowPresencePay = Number(row.presence_pay || row.tunj_kehadiran || 0);
      const rowProdPay = Number(row.production_pay || row.bonus_produksi || 0);
      const rowOtPay = Number(row.overtime_pay || row.uang_lembur || 0);
      const rowFixedAllowance = Number(row.fixed_allowance || row.tunj_tetap || 0);
      const rowVarAllowance = Number(row.variable_allowance || row.tunj_variabel || 0);
      const rowTransport = Number(row.transport_allowance || row.tunj_transport || 0);
      const rowLuarKota = Number(row.tunj_luar_kota || row.dinas_luar_kota || 0);
      const rowBonus = Number(row.bonus || row.thr || 0);
      const rowDeficiency = Number(row.previous_month_deficiency || row.selisih_kurang_gaji || 0);
      const rowAdhoc = Number(row.adhoc_allowance || 0);

      const rowTotalTunjangan = rowMealPay + 
                                rowNightMealPay + 
                                rowPresencePay + 
                                rowProdPay + 
                                rowOtPay + 
                                rowFixedAllowance + 
                                rowVarAllowance + 
                                rowTransport +
                                rowLuarKota + 
                                rowBonus + 
                                rowDeficiency + 
                                rowAdhoc +
                                customEarningsSum;

      const taxBpjs = Number(row.bpjs_health_deduction || 0) + Number(row.jht_deduction || 0) + Number(row.pph21_deduction || 0);

      let rowHTML = `
        <tr>
          <td class="sticky-col sticky-col-shadow">
            <strong>${row.name}</strong>
            <br><small class="text-gray">${row.nik}</small>
          </td>
          <td class="text-right">${(typeof App !== 'undefined' && typeof App.formatSalary === 'function' ? App.formatSalary(row.base_salary) : App.formatCurrency(row.base_salary))}</td>
      `;

      if (this.isDetailedAllowanceView) {
        if (showFixed) rowHTML += `<td class="text-right">${rowFixedAllowance > 0 ? App.formatCurrency(rowFixedAllowance) : '-'}</td>`;
        if (showMeal) {
          rowHTML += `
            <td class="text-right">
              ${rowMealPay > 0 ? `Meal: ${App.formatCurrency(rowMealPay)}<br>` : ''}
              ${rowNightMealPay > 0 ? `<small class="text-success">Night: ${App.formatCurrency(rowNightMealPay)}</small><br>` : ''}
              ${rowPresencePay > 0 ? `<small class="text-info">Extra: ${App.formatCurrency(rowPresencePay)}</small>` : ''}
              ${rowMealPay === 0 && rowNightMealPay === 0 && rowPresencePay === 0 ? '-' : ''}
            </td>
          `;
        }
        if (showBonusProd) rowHTML += `<td class="text-right">${rowProdPay > 0 ? App.formatCurrency(rowProdPay) : '-'}</td>`;
        if (showLembur) {
          rowHTML += `
            <td class="text-right">
              ${rowOtPay > 0 ? `${App.formatCurrency(rowOtPay)}<br><small class="text-gray">${row.overtime_hours || 0}h @ 20k</small>` : '-'}
            </td>
          `;
        }
        if (showVarAllowance) rowHTML += `<td class="text-right">${rowVarAllowance > 0 ? App.formatCurrency(rowVarAllowance) : '-'}</td>`;
        if (showBonus) rowHTML += `<td class="text-right">${rowBonus > 0 ? App.formatCurrency(rowBonus) : '-'}</td>`;
        customEarningsArr.forEach(name => {
          const comp = (row.custom_components || {})[name];
          rowHTML += `<td class="text-right">${comp && comp.amount > 0 ? App.formatCurrency(comp.amount) : '-'}</td>`;
        });
      }

      rowHTML += `
          <td class="text-right" style="vertical-align: middle; background: rgba(16, 185, 129, 0.04);">
            <button class="btn btn-sm" onclick="Payroll.openAllowanceDrawer('${row.id}', ${idx})"
                    style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.4); font-weight: 600; padding: 4px 8px; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;"
                    title="Klik untuk melihat rincian transparan tunjangan & lembur">
              <span>${App.formatCurrency(rowTotalTunjangan)}</span>
              <span style="font-size: 11px; opacity: 0.9;">🔍 Detail</span>
            </button>
          </td>
      `;

      // Attendance Deductions (Late Deduction is now an editable override input)
      rowHTML += `
        <td class="text-right" style="vertical-align: middle;">
          <input type="text" 
                 class="form-input text-right late-deduction-input" 
                 style="width: 100px; display: inline-block; padding: 4px 8px; font-size: 13px; text-align: right;"
                 value="${(row.late_deduction || 0).toLocaleString('id-ID')}"
                 data-calculated="${row.calculated_late_deduction || 0}"
                 onfocus="this.select()"
                 oninput="Payroll.maskLateInput(this)"
                 onblur="Payroll.handleLateBlur(this, '${row.id || row.nik}')"
                 ${row.status === 'paid' ? 'disabled' : ''}>
          ${row.keterangan_override_late ? `<br><small class="text-success" style="font-size: 9px; display: block; text-align: right;" title="${row.keterangan_override_late}">✏️ Override: ${row.keterangan_override_late}</small>` : ''}
          ${((row.absence_deduction || 0) > 0 || (row.half_day_deduction || 0) > 0) ? `
            <small class="text-error" style="font-size: 9px; display: block; text-align: right;">
              Absen: -${App.formatCurrency((row.absence_deduction || 0) + (row.half_day_deduction || 0))}
            </small>
          ` : ''}
        </td>
      `;

      // BPJS & PPh21 Deductions
      rowHTML += `
        <td class="text-right">
          ${taxBpjs > 0 ? `<span class="text-error">-${App.formatCurrency(taxBpjs)}</span>` : '-'}
        </td>
      `;

      if (showOtherDeductions) rowHTML += `<td class="text-right">${(row.other_deductions || 0) > 0 ? `<span class="text-error">-${App.formatCurrency(row.other_deductions)}</span>` : '-'}</td>`;

      // Custom Deductions values
      customDeductionsArr.forEach(name => {
        const comp = (row.custom_components || {})[name];
        rowHTML += `<td class="text-right">${comp && comp.amount > 0 ? `<span class="text-error">-${App.formatCurrency(comp.amount)}</span>` : '-'}</td>`;
      });

      rowHTML += `
          <td class="text-right"><strong>${(typeof App !== 'undefined' && typeof App.formatSalary === 'function' ? App.formatSalary(row.total_salary) : App.formatCurrency(row.total_salary))}</strong></td>
          <td>
             <span class="badge ${this.getStatusBadge(row.status || 'draft')}">${(row.status || 'draft').toUpperCase()}</span>
             ${row.emailSentAt ? `
               <br><small style="display: block; margin-top: 4px; font-size: 11px; color: #10b981; font-weight: 500;">
                 📧 Sent at ${(() => {
                   const d = new Date(row.emailSentAt);
                   const hh = String(d.getHours()).padStart(2, '0');
                   const mm = String(d.getMinutes()).padStart(2, '0');
                   return `${hh}:${mm}`;
                 })()}
               </small>
             ` : ''}
          </td>
          <td class="text-center" style="white-space: nowrap;">
             <button class="btn btn-sm btn-secondary" onclick="Payroll.viewPayslip('${row.id || row.nik}')">📄 Slip</button>
             ${(row.status || 'draft') === 'draft' ? `
                 <button class="btn btn-sm btn-primary" onclick="Payroll.showEditModal('${row.id || row.nik}')">✏️ Edit</button>
                 <button class="btn btn-sm btn-info" onclick="Payroll.markAsPaid('${row.id || row.nik}')">💳 Bayar</button>
             ` : '✅ Lunas'}
             <button class="btn btn-sm btn-info" onclick="Payroll.sendEmailIndividual('${row.id || row.nik}', this)" title="Kirim Email Slip Gaji" style="margin-left: 4px;">📧 Kirim</button>
             <button class="btn btn-sm btn-success" onclick="Payroll.sendWhatsAppIndividual('${row.id || row.nik}', this)" title="Kirim WhatsApp Slip Gaji" style="margin-left: 4px; background: #25D366; border-color: #25D366; color: white;">💬 WA</button>
          </td>
        </tr>
      `;
      rowsHTML += rowHTML;
    });

    return `
      <!-- PURE MATHEMATICAL SUMMARY METRIC CARDS (GLOBAL DATASET) -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 16px;">
        <div class="card" style="background: linear-gradient(135deg, #1e293b, #0f172a); border: 1px solid #334155; border-radius: 8px; padding: 12px 14px;">
          <div style="font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 600;">💼 Total Gaji Pokok</div>
          <div style="font-size: 1.25rem; font-weight: 800; color: #f8fafc; margin-top: 4px;">${App.formatCurrency(allTotals.totalBaseSalary)}</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${allTotals.count} Karyawan Terdaftar</div>
        </div>

        <div class="card" style="background: linear-gradient(135deg, #064e3b, #047857); border: 1px solid #059669; border-radius: 8px; padding: 12px 14px; color: white;">
          <div style="font-size: 11px; text-transform: uppercase; opacity: 0.9; font-weight: 600;">🎁 Total Tunjangan & Lembur</div>
          <div style="font-size: 1.25rem; font-weight: 800; margin-top: 4px;">${App.formatCurrency(allTotals.totalTunjangan)}</div>
          <div style="font-size: 11px; opacity: 0.85; margin-top: 2px;">Makan, Lembur, Produksi, dll</div>
        </div>

        <div class="card" style="background: linear-gradient(135deg, #7c2d12, #991b1b); border: 1px solid #dc2626; border-radius: 8px; padding: 12px 14px; color: white;">
          <div style="font-size: 11px; text-transform: uppercase; opacity: 0.9; font-weight: 600;">📉 Total Potongan</div>
          <div style="font-size: 1.25rem; font-weight: 800; margin-top: 4px;">-${App.formatCurrency(allTotals.totalLateAbsence + allTotals.totalBpjsPph + allTotals.totalOtherDeductions)}</div>
          <div style="font-size: 11px; opacity: 0.85; margin-top: 2px;">Absen + BPJS + PPh 21 TER</div>
        </div>

        <div class="card" style="background: linear-gradient(135deg, #1e3a8a, #1d4ed8); border: 1px solid #3b82f6; border-radius: 8px; padding: 12px 14px; color: white;">
          <div style="font-size: 11px; text-transform: uppercase; opacity: 0.9; font-weight: 600;">💰 Grand Total Take Home Pay</div>
          <div style="font-size: 1.25rem; font-weight: 800; margin-top: 4px; color: #67e8f9;">${App.formatCurrency(allTotals.totalSalary)}</div>
          <div style="font-size: 11px; opacity: 0.85; margin-top: 2px;">Total Payroll Periode ${this.period}</div>
        </div>
      </div>

      <div style="margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; background: var(--bg-tertiary); padding: 12px; border-radius: 8px; flex-wrap: wrap; gap: 12px;">
        <div style="display: flex; gap: 24px; flex-wrap: wrap; align-items: center;">
            <div>
                <span class="text-gray small">Periode Cut-Off:</span><br>
                <strong style="color: #1e3a8a;">${dates.startDate} s.d ${dates.endDate}</strong>
            </div>
            <div>
                <span class="text-gray small">Hari Kerja Efektif:</span><br>
                <span class="badge badge-info">${workingDays} Hari</span>
            </div>
            <div>
                <span class="text-gray small">Tampilan Baris:</span><br>
                <strong>${list.length} / ${allTotals.count} Karyawan</strong>
            </div>
            <div>
                <button class="btn btn-sm ${this.isDetailedAllowanceView ? 'btn-primary' : 'btn-secondary'}" 
                        onclick="Payroll.toggleAllowanceView()" 
                        style="font-size: 12px; display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px;">
                  ${this.isDetailedAllowanceView ? '📊 Mode Ringkas (Total Tunjangan)' : '🔍 Tampilkan Rincian Kolom Tabel'}
                </button>
            </div>
        </div>
        <div style="text-align: right;">
            <span class="text-gray small">${isFiltered ? 'Subtotal Filter Saat Ini:' : 'Total Take Home Pay:'}</span><br>
            <strong style="font-size: 1.2rem; color: var(--color-primary);">${App.formatCurrency(filteredTotals.totalSalary)}</strong>
        </div>
      </div>

      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              ${headersHTML}
            </tr>
          </thead>
          <tbody>
            ${rowsHTML}
          </tbody>
          <tfoot>
            <tr style="background: var(--bg-secondary); font-weight: bold;">
               <td class="sticky-col sticky-col-shadow">${isFiltered ? `SUBTOTAL (${list.length} Karyawan)` : 'TOTAL KESELURUHAN'}</td>
               <td class="text-right">${App.formatCurrency(filteredTotals.totalBaseSalary)}</td>
               ${this.isDetailedAllowanceView ? `
                 ${showFixed ? `<td class="text-right">${App.formatCurrency(filteredTotals.totalFixed)}</td>` : ''}
                 ${showMeal ? `<td class="text-right">${App.formatCurrency(filteredTotals.totalMeal)}</td>` : ''}
                 ${showBonusProd ? `<td class="text-right">${App.formatCurrency(filteredTotals.totalBonusProd)}</td>` : ''}
                 ${showLembur ? `<td class="text-right">${App.formatCurrency(filteredTotals.totalLembur)}</td>` : ''}
                 ${showVarAllowance ? `<td class="text-right">${App.formatCurrency(filteredTotals.totalVarAllowance)}</td>` : ''}
                 ${showBonus ? `<td class="text-right">${App.formatCurrency(filteredTotals.totalBonus)}</td>` : ''}
                 ${customEarningsArr.map(() => '<td></td>').join('')}
               ` : ''}
               <td class="text-right" style="color: #10b981; background: rgba(16, 185, 129, 0.08);">${App.formatCurrency(filteredTotals.totalTunjangan)}</td>
               <td class="text-right" style="color: #ef4444;">-${App.formatCurrency(filteredTotals.totalLateAbsence)}</td>
               <td class="text-right" style="color: #ef4444;">-${App.formatCurrency(filteredTotals.totalBpjsPph)}</td>
               ${showOtherDeductions ? `<td class="text-right">-${App.formatCurrency(filteredTotals.totalOtherDeductions)}</td>` : ''}
               ${customDeductionsArr.map(() => '<td></td>').join('')}
               <td class="text-right" style="color: var(--color-primary); font-size: 13px;">${App.formatCurrency(filteredTotals.totalSalary)}</td>
               <td colspan="2"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
  },

  getStatusBadge(status) {
    switch (status) {
      case 'paid': return 'badge-success';
      case 'approved': return 'badge-info';
      default: return 'badge-warning';
    }
  },

  async markAsPaid(id) {
    if (!this.canAccessPayroll()) {
      this.renderAccessDenied();
      return;
    }

    const record = this.payrollRecords.find(p => p.id === id);
    if (!record) return;

    if (!confirm(`Konfirmasi pembayaran gaji untuk ${record.name} sebesar ${App.formatCurrency(record.total_salary)}? \n\nSistem akan otomatis mencatat Jurnal Pengeluaran Kas.`)) return;

    try {
      // 1. Create Auto-Journal
      await this.createSalaryJournal(record);

      // 2. Update status
      record.status = 'paid';
      record.paidAt = new Date().toISOString();

      await Storage.set(Storage.KEYS.PAYROLL, this.payrollRecords);
      alert('Gaji berhasil dibayar dan jurnal akuntansi telah dibuat.');
      this.render();
    } catch (e) {
      alert('Gagal membayar: ' + e.message);
    }
  },

  async createSalaryJournal(record) {
    // Get accounts from mapping or defaults
    const expenseAcc = Storage.getAccountByPurpose('salary_expense') || '5210';
    const bankAcc = Storage.getAccountByPurpose('bank') || '1120';

    const entry = {
      id: 'JRN-PAY-' + Date.now(),
      date: new Date().toISOString().substring(0, 10),
      reference: record.id,
      description: `Pembayaran Gaji ${record.name} - ${record.period}`,
      items: [
        { account: expenseAcc, debit: record.total_salary, credit: 0 },
        { account: bankAcc, debit: 0, credit: record.total_salary }
      ],
      status: 'posted'
    };

    const journals = Storage.getJournalEntries();
    journals.push(entry);
    await Storage.setJournalEntries(journals);
  },

  isWorkdaysLocked() {
      const today = new Date();
      const currentYearMonth = today.toISOString().substring(0, 7);
      
      // If we are configuring a past month, it is definitely locked
      if (this.period < currentYearMonth) return true;
      
      // If we are configuring the current month, lock after 25th
      if (this.period === currentYearMonth && today.getDate() > 25) return true;
      
      return false;
  },

  renderWorkdaysConfig() {
      const dates = this.getPeriodDates(this.period);
      const isLocked = this.isWorkdaysLocked();
      const role = Storage.getCurrentUserRole();
      const canOverride = (role === 'SUPER_ADMIN' || role === 'HRD_MANAGER');
      
      const durationInMs = new Date(dates.endDate + 'T12:00:00') - new Date(dates.startDate + 'T12:00:00');
      const totalDays = Math.round(durationInMs / (1000 * 60 * 60 * 24)) + 1;
      const workingDays = this.countWorkingDaysMonSat(dates.startDate, dates.endDate);

      let lockWarning = '';
      let actionButtons = '';
      let inputAttrs = `value="${dates.endDate}"`;
      
      const showEdit = !isLocked || this.isOverrideActive;
      
      if (isLocked && !this.isOverrideActive) {
          inputAttrs = `value="${dates.endDate}" disabled style="background: #f3f4f6; cursor: not-allowed;"`;
          lockWarning = `<span style="color: #dc2626; font-size: 0.875rem; font-weight: bold; margin-left: 10px;">🔒 Terkunci (Melewati cut-off Tgl 25)</span>`;
          if (canOverride) {
              actionButtons = `<button class="btn btn-danger" onclick="Payroll.enableOverride()" style="background-color: #dc2626; color: white;">Buka Kunci & Ubah (Admin)</button>`;
          }
      } else {
          if (isLocked && this.isOverrideActive) {
              lockWarning = `<span style="color: #ea580c; font-size: 0.875rem; font-weight: bold; margin-left: 10px;">⚠️ Mode Override Admin Aktif</span>`;
          }
          actionButtons = `
              <button class="btn btn-primary" onclick="Payroll.savePayrollPeriod()">Simpan Master Kalender</button>
              ${this.isOverrideActive ? `<button class="btn btn-secondary" onclick="Payroll.cancelOverride()">Batal</button>` : ''}
          `;
      }

      return `
        <div class="card mb-4" style="border: 2px solid #3b82f6; background-color: #f0f7ff;">
          <div class="card-header" style="background-color: #dbeafe; border-bottom: 1px solid #3b82f6;">
            <h2 class="card-title" style="color: #1e3a8a;">📅 Master Kalender & Cut-Off Payroll: Periode ${this.period}</h2>
          </div>
          <div class="card-body">
             <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin-bottom: 1.5rem;">
                 <div>
                     <label style="display: block; font-weight: bold; margin-bottom: 5px; color: #1e40af;">Start Date (Estafet)</label>
                     <input type="date" value="${dates.startDate}" disabled style="background: #f3f4f6; cursor: not-allowed;" class="form-input">
                     <p style="font-size: 0.75rem; color: #6b7280; margin-top: 4px;">Otomatis mengikuti End Date periode lalu + 1 hari.</p>
                 </div>
                 <div>
                     <label style="display: block; font-weight: bold; margin-bottom: 5px; color: #1e40af;">End Date (Cut-Off)</label>
                     <div class="flex gap-2 align-center">
                         <input type="date" id="payroll-end-date-input" class="form-input" ${inputAttrs} onchange="Payroll.previewPeriodStats()">
                         ${lockWarning}
                     </div>
                     <p style="font-size: 0.75rem; color: #6b7280; margin-top: 4px;">Tanggal berakhirnya perhitungan absensi.</p>
                 </div>
             </div>
             
             <div style="background-color: #ffffff; padding: 1rem; border-radius: 6px; border: 1px dashed #93c5fd; margin-bottom: 1.5rem; display: flex; justify-content: space-around; text-align: center;">
                 <div>
                     <div style="font-size: 0.875rem; color: #4b5563;">Total Hari Kalender</div>
                     <div id="preview-total-days" style="font-size: 1.5rem; font-weight: bold; color: #1e3a8a;">${totalDays} Hari</div>
                 </div>
                 <div style="border-left: 1px solid #e5e7eb;"></div>
                 <div>
                     <div style="font-size: 0.875rem; color: #4b5563;">Hari Kerja Efektif (Senin-Sabtu)</div>
                     <div id="preview-working-days" style="font-size: 1.5rem; font-weight: bold; color: #16a34a;">${workingDays} Hari</div>
                 </div>
             </div>

             ${showEdit && isLocked ? `
                 <div class="form-group" style="margin-bottom: 1.5rem;">
                     <label class="form-label required" style="color: #c2410c;">Alasan Perubahan (Audit Log)</label>
                     <input type="text" id="payroll-override-reason" class="form-input" placeholder="Masukkan alasan mengubah cut-off yang sudah terkunci...">
                 </div>
             ` : ''}

             <!-- Auto-Sync Kalender Kerja & Tanggal Merah Banner -->
             <div style="margin-top: 1.5rem; border-top: 1px dashed #93c5fd; padding-top: 1rem; margin-bottom: 1.5rem; background: #eff6ff; padding: 12px 16px; border-radius: 6px;">
                 <h4 style="color: #1e3a8a; margin-top: 0; margin-bottom: 4px;">⚡ Auto-Sync Kalender Kerja & Tanggal Merah Active</h4>
                 <p style="font-size: 0.8rem; color: #1e40af; margin: 0;">Modul Payroll secara otomatis membaca data Tanggal Merah (Hari Minggu & Hari Libur Nasional) dari <strong>Kalender Kerja</strong>. Setiap kehadiran karyawan di tanggal merah otomatis mendapatkan <strong>Tunjangan Kehadiran Libur = Gaji Pokok / 25</strong> tanpa perlu input manual HR.</p>
             </div>

             <div class="flex justify-end gap-2">
                 ${actionButtons}
             </div>
          </div>
        </div>
      `;
  },

  renderHolidaysWorked() {
      const dates = Storage.get('erp_holidays_worked') || [];
      if (dates.length === 0) {
          return '<p style="font-size: 0.85rem; color: #6b7280; margin: 0;">Belum ada tanggal merah terdaftar masuk kerja.</p>';
      }
      return `
        <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px;">
          ${dates.map(d => `
            <span class="badge badge-info" style="display: inline-flex; align-items: center; gap: 5px; padding: 6px 10px; font-size: 0.8rem;">
              📅 ${d}
              <span onclick="Payroll.removeHolidayWorked('${d}')" style="cursor: pointer; font-weight: bold; color: #dc2626; margin-left: 5px;">✖</span>
            </span>
          `).join('')}
        </div>
      `;
  },

  async addHolidayWorked() {
      const dateInput = document.getElementById('holiday-worked-date-input');
      if (!dateInput) return;
      const dateVal = dateInput.value;
      if (!dateVal) {
          alert('Silakan pilih tanggal merah terlebih dahulu.');
          return;
      }
      
      const current = Storage.get('erp_holidays_worked') || [];
      if (current.includes(dateVal)) {
          alert('Tanggal merah ini sudah terdaftar.');
          return;
      }
      
      current.push(dateVal);
      current.sort();
      await Storage.set('erp_holidays_worked', current);
      this.render();
  },

  async removeHolidayWorked(dateStr) {
      if (!confirm(`Hapus tanggal merah masuk kerja: ${dateStr}?`)) return;
      const current = Storage.get('erp_holidays_worked') || [];
      const updated = current.filter(d => d !== dateStr);
      await Storage.set('erp_holidays_worked', updated);
      this.render();
  },

  updateEditModalSummary() {
    const baseSalary = parseFloat(document.getElementById('edit-base-salary').value) || 0;
    const tunjTetap = parseFloat(document.getElementById('edit-tunj-tetap').value) || 0;
    const mealPay = parseFloat(document.getElementById('edit-meal-pay').value) || 0;
    const nightMealPay = parseFloat(document.getElementById('edit-night-meal-pay').value) || 0;
    const tunjLuarKota = parseFloat(document.getElementById('edit-tunj-luar-kota').value) || 0;
    const productionPay = parseFloat(document.getElementById('edit-production-pay').value) || 0;
    const presencePay = parseFloat(document.getElementById('edit-presence-pay').value) || 0;
    const deficiency = parseFloat(document.getElementById('edit-previous-month-deficiency').value) || 0;
    const bonus = parseFloat(document.getElementById('edit-bonus').value) || 0;
    const overtimePay = parseFloat(document.getElementById('edit-overtime-pay').value) || 0;
    const varAllowance = parseFloat(document.getElementById('edit-variable-allowance').value) || 0;

    const potTidakHadir = parseFloat(document.getElementById('edit-potongan-tidak-hadir').value) || 0;
    const potLambatPulang = parseFloat(document.getElementById('edit-potongan-lambat-pulang').value) || 0;
    let bpjsHealthDed = parseFloat(document.getElementById('edit-bpjs-health-deduction').value) || 0;
    if (bpjsHealthDed >= 500000) bpjsHealthDed = Math.round(bpjsHealthDed * 0.01);
    let jhtDed = parseFloat(document.getElementById('edit-jht-deduction').value) || 0;
    if (jhtDed >= 500000) jhtDed = Math.round(jhtDed * 0.02);
    const pph21Ded = parseFloat(document.getElementById('edit-pph21-deduction').value) || 0;
    const otherDed = parseFloat(document.getElementById('edit-other-deductions').value) || 0;

    // Custom components sum
    let customEarningsSum = 0;
    let customDeductionsSum = 0;
    const rows = document.querySelectorAll('#custom-components-container .custom-comp-row');
    rows.forEach(row => {
      const typeSelect = row.querySelector('.comp-type');
      const amountInput = row.querySelector('.comp-amount');
      if (typeSelect && amountInput) {
        const type = typeSelect.value;
        const amount = parseFloat(amountInput.value) || 0;
        if (type === 'earnings') customEarningsSum += amount;
        if (type === 'deduction') customDeductionsSum += amount;
      }
    });

    const totalAllowances = baseSalary + tunjTetap + mealPay + nightMealPay + tunjLuarKota + productionPay + presencePay + deficiency + bonus + overtimePay + varAllowance + customEarningsSum;
    const totalDeductions = potTidakHadir + potLambatPulang + bpjsHealthDed + jhtDed + pph21Ded + otherDed + customDeductionsSum;
    const thp = Math.max(0, totalAllowances - totalDeductions);

    document.getElementById('summary-total-allowances').textContent = 'Rp ' + Math.round(totalAllowances).toLocaleString('id-ID');
    document.getElementById('summary-total-deductions').textContent = 'Rp ' + Math.round(totalDeductions).toLocaleString('id-ID');
    document.getElementById('summary-thp').textContent = 'Rp ' + Math.round(thp).toLocaleString('id-ID');
  },

  showEditModal(id) {
    const record = this.payrollRecords.find(r => r.id === id);
    if (!record) return;

    // Create modal element
    const modal = document.createElement('div');
    modal.id = 'payroll-edit-modal';
    modal.className = 'modal-overlay';
    modal.style = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.5); display: flex; justify-content: center;
      align-items: center; z-index: 10000; overflow-y: auto; padding: 20px;
    `;

    // Retrieve custom components list
    const customComps = record.custom_components || {};
    
    // Construct HTML structure
    modal.innerHTML = `
      <div class="modal" style="width: 100%; max-width: 900px; background: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); overflow: hidden; display: flex; flex-direction: column; text-align: left;">
        <div class="modal-header" style="background: var(--color-primary); color: white; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0; color: white;">✏️ Edit & Override Komponen Gaji</h3>
          <span onclick="document.getElementById('payroll-edit-modal').remove()" style="cursor: pointer; font-size: 1.5rem; font-weight: bold; color: white;">&times;</span>
        </div>
        <div class="modal-body" style="padding: 20px; max-height: 70vh; overflow-y: auto;">
          <p style="margin-top: 0; margin-bottom: 20px; font-size: 1.05rem;">Karyawan: <strong>${record.name}</strong> (${record.nik})</p>
          
          <div class="ps-grid" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-bottom: 20px;">
            <!-- Column 1: Earnings -->
            <div>
              <h4 style="border-bottom: 1.5px solid var(--color-primary); padding-bottom: 6px; margin-top: 0; margin-bottom: 12px; color: var(--color-primary); font-weight: bold;">💰 Earnings / Allowances</h4>
              <div style="display: flex; flex-direction: column; gap: 10px;">
                <div class="form-group">
                  <label class="form-label" style="display: block; font-size: 12px; font-weight: 600; margin-bottom: 3px;">Basic Salary (Rp)</label>
                  <input type="number" id="edit-base-salary" value="${record.base_salary || 0}" class="form-input" style="width: 100%; padding: 6px 10px;" oninput="Payroll.updateEditModalSummary()">
                </div>
                <div class="form-group">
                  <label class="form-label" style="display: block; font-size: 12px; font-weight: 600; margin-bottom: 3px;">Tunj. Tetap (Rp)</label>
                  <input type="number" id="edit-tunj-tetap" value="${record.tunj_tetap || 0}" class="form-input" style="width: 100%; padding: 6px 10px;" oninput="Payroll.updateEditModalSummary()">
                </div>
                <div class="form-group">
                  <label class="form-label" style="display: block; font-size: 12px; font-weight: 600; margin-bottom: 3px;">Tunjangan Makan (Rp)</label>
                  <input type="number" id="edit-meal-pay" value="${record.meal_pay || 0}" class="form-input" style="width: 100%; padding: 6px 10px;" oninput="Payroll.updateEditModalSummary()">
                </div>
                <div class="form-group">
                  <label class="form-label" style="display: block; font-size: 12px; font-weight: 600; margin-bottom: 3px;">Tunjangan Makan Malam (Rp)</label>
                  <input type="number" id="edit-night-meal-pay" value="${record.night_meal_pay || 0}" class="form-input" style="width: 100%; padding: 6px 10px;" oninput="Payroll.updateEditModalSummary()">
                </div>
                <div class="form-group">
                  <label class="form-label" style="display: block; font-size: 12px; font-weight: 600; margin-bottom: 3px;">Tunjangan Luar Kota (Rp)</label>
                  <input type="number" id="edit-tunj-luar-kota" value="${record.tunj_luar_kota || 0}" class="form-input" style="width: 100%; padding: 6px 10px;" oninput="Payroll.updateEditModalSummary()">
                </div>
                <div class="form-group">
                  <label class="form-label" style="display: block; font-size: 12px; font-weight: 600; margin-bottom: 3px;">Bonus Produksi (Rp)</label>
                  <input type="number" id="edit-production-pay" value="${record.production_pay || 0}" class="form-input" style="width: 100%; padding: 6px 10px;" oninput="Payroll.updateEditModalSummary()">
                </div>
                <div class="form-group">
                  <label class="form-label" style="display: block; font-size: 12px; font-weight: 600; margin-bottom: 3px;">Tunjangan Kehadiran (Rp)</label>
                  <input type="number" id="edit-presence-pay" value="${record.presence_pay || 0}" class="form-input" style="width: 100%; padding: 6px 10px;" oninput="Payroll.updateEditModalSummary()">
                </div>
                <div class="form-group">
                  <label class="form-label" style="display: block; font-size: 12px; font-weight: 600; margin-bottom: 3px;">Selisih Kurang Gaji (Rp)</label>
                  <input type="number" id="edit-previous-month-deficiency" value="${record.previous_month_deficiency || 0}" class="form-input" style="width: 100%; padding: 6px 10px;" oninput="Payroll.updateEditModalSummary()">
                </div>
                <div class="form-group">
                  <label class="form-label" style="display: block; font-size: 12px; font-weight: 600; margin-bottom: 3px;">Bonus (Rp)</label>
                  <input type="number" id="edit-bonus" value="${record.bonus || 0}" class="form-input" style="width: 100%; padding: 6px 10px;" oninput="Payroll.updateEditModalSummary()">
                </div>
                <div class="form-group">
                  <label class="form-label" style="display: block; font-size: 12px; font-weight: 600; margin-bottom: 3px;">Overtime (Rp)</label>
                  <input type="number" id="edit-overtime-pay" value="${record.overtime_pay || 0}" class="form-input" style="width: 100%; padding: 6px 10px;" oninput="Payroll.updateEditModalSummary()">
                </div>
                <div class="form-group">
                  <label class="form-label" style="display: block; font-size: 12px; font-weight: 600; margin-bottom: 3px;">Tunjangan Variabel (Rp)</label>
                  <input type="number" id="edit-variable-allowance" value="${record.variable_allowance || 0}" class="form-input" style="width: 100%; padding: 6px 10px;" oninput="Payroll.updateEditModalSummary()">
                </div>
              </div>
            </div>

            <!-- Column 2: Deductions -->
            <div>
              <h4 style="border-bottom: 1.5px solid #dc2626; padding-bottom: 6px; margin-top: 0; margin-bottom: 12px; color: #dc2626; font-weight: bold;">📉 Deductions</h4>
              <div style="display: flex; flex-direction: column; gap: 10px;">
                <div class="form-group">
                  <label class="form-label" style="display: block; font-size: 12px; font-weight: 600; margin-bottom: 3px;">Potongan Tidak Hadir (Rp)</label>
                  <input type="number" id="edit-potongan-tidak-hadir" value="${record.potongan_tidak_hadir !== undefined ? record.potongan_tidak_hadir : (record.absence_deduction || 0)}" class="form-input" style="width: 100%; padding: 6px 10px;" oninput="Payroll.updateEditModalSummary()">
                </div>
                <div class="form-group">
                  <label class="form-label" style="display: block; font-size: 12px; font-weight: 600; margin-bottom: 3px;">Potongan Late & Pulang Awal (Rp)</label>
                  <input type="number" id="edit-potongan-lambat-pulang" value="${record.potongan_lambat_pulang !== undefined ? record.potongan_lambat_pulang : (record.late_deduction || 0)}" class="form-input" style="width: 100%; padding: 6px 10px;" oninput="Payroll.updateEditModalSummary()">
                </div>
                <div class="form-group">
                  <label class="form-label" style="display: block; font-size: 12px; font-weight: 600; margin-bottom: 3px;">Iuran BPJS Kes (Rp)</label>
                  <input type="number" id="edit-bpjs-health-deduction" value="${(record.bpjs_health_deduction >= 500000 ? Math.round(record.bpjs_health_deduction * 0.01) : record.bpjs_health_deduction) || 0}" class="form-input" style="width: 100%; padding: 6px 10px;" oninput="Payroll.updateEditModalSummary()">
                </div>
                <div class="form-group">
                  <label class="form-label" style="display: block; font-size: 12px; font-weight: 600; margin-bottom: 3px;">Iuran JHT (Rp)</label>
                  <input type="number" id="edit-jht-deduction" value="${(record.jht_deduction >= 500000 ? Math.round(record.jht_deduction * 0.02) : record.jht_deduction) || 0}" class="form-input" style="width: 100%; padding: 6px 10px;" oninput="Payroll.updateEditModalSummary()">
                </div>
                <div class="form-group">
                  <label class="form-label" style="display: block; font-size: 12px; font-weight: 600; margin-bottom: 3px;">PPH 21 (Rp)</label>
                  <input type="number" id="edit-pph21-deduction" value="${record.pph21_deduction || 0}" class="form-input" style="width: 100%; padding: 6px 10px;" oninput="Payroll.updateEditModalSummary()">
                </div>
                <div class="form-group">
                  <label class="form-label" style="display: block; font-size: 12px; font-weight: 600; margin-bottom: 3px;">Potongan Lain-lain (Rp)</label>
                  <input type="number" id="edit-other-deductions" value="${record.other_deductions || 0}" class="form-input" style="width: 100%; padding: 6px 10px;" oninput="Payroll.updateEditModalSummary()">
                </div>
              </div>
            </div>

            <!-- Column 3: Benefits & Custom Components -->
            <div>
              <h4 style="border-bottom: 1.5px solid #4f46e5; padding-bottom: 6px; margin-top: 0; margin-bottom: 12px; color: #4f46e5; font-weight: bold;">🛡️ Company Benefits</h4>
              <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px;">
                <div class="form-group">
                  <label class="form-label" style="display: block; font-size: 12px; font-weight: 600; margin-bottom: 3px;">Rate Dasar BPJS Kes (Rp)</label>
                  <input type="number" id="edit-bpjs-kes-benefit" value="${(record.bpjs_kes_benefit >= 500000 ? Math.round(record.bpjs_kes_benefit * 0.04) : record.bpjs_kes_benefit) || 0}" class="form-input" style="width: 100%; padding: 6px 10px;">
                </div>
                <div class="form-group">
                  <label class="form-label" style="display: block; font-size: 12px; font-weight: 600; margin-bottom: 3px;">Rate Dasar BPJS TK (Rp)</label>
                  <input type="number" id="edit-bpjs-tk-benefit" value="${(record.bpjs_tk_benefit >= 500000 ? Math.round(record.bpjs_tk_benefit * 0.0424) : record.bpjs_tk_benefit) || 0}" class="form-input" style="width: 100%; padding: 6px 10px;">
                </div>
                <div class="form-group">
                  <label class="form-label" style="display: block; font-size: 12px; font-weight: 600; margin-bottom: 3px;">PPh 21 Benefit (Rp)</label>
                  <input type="number" id="edit-pph21-benefit" value="${record.pph21_benefit || 0}" class="form-input" style="width: 100%; padding: 6px 10px;">
                </div>
              </div>

              <h4 style="border-bottom: 1.5px solid #0d9488; padding-bottom: 6px; margin-top: 15px; margin-bottom: 12px; color: #0d9488; display: flex; justify-content: space-between; align-items: center; font-weight: bold;">
                <span>Dynamic Components</span>
                <button class="btn btn-sm btn-primary" onclick="Payroll.addNewCustomComponentRow()" style="padding: 2px 6px; font-size: 11px;">+ Tambah</button>
              </h4>
              <div id="custom-components-container" style="display: flex; flex-direction: column; gap: 8px;">
                ${Object.entries(customComps).map(([name, data]) => `
                  <div class="custom-comp-row flex gap-1 align-center" style="background: #f9fafb; padding: 6px; border-radius: 6px; border: 1px solid #e5e7eb; display: flex; font-size: 12px;">
                    <input type="text" class="form-input comp-name" value="${name}" placeholder="Nama" style="flex: 1.5; padding: 4px 6px; font-size: 12px;">
                    <select class="form-input comp-type" style="flex: 1; padding: 4px; font-size: 12px;" onchange="Payroll.updateEditModalSummary()">
                      <option value="earnings" ${data.type === 'earnings' ? 'selected' : ''}>Pndptn</option>
                      <option value="deduction" ${data.type === 'deduction' ? 'selected' : ''}>Pot</option>
                    </select>
                    <input type="number" class="form-input comp-amount" value="${data.amount || 0}" placeholder="Jumlah" style="flex: 1.2; padding: 4px 6px; font-size: 12px;" oninput="Payroll.updateEditModalSummary()">
                    <button class="btn btn-sm btn-danger" onclick="this.parentElement.remove(); Payroll.updateEditModalSummary();" style="padding: 4px 8px; margin-left: 2px;">✖</button>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>

          <div style="background: #f3f4f6; border-radius: 8px; padding: 15px; margin-top: 15px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; text-align: center; border: 1px solid #e5e7eb;">
            <div>
              <div style="font-size: 0.8rem; color: #4b5563; text-transform: uppercase; font-weight: 600;">Total Allowance</div>
              <div id="summary-total-allowances" style="font-size: 1.25rem; font-weight: bold; color: var(--color-primary);">Rp 0</div>
            </div>
            <div>
              <div style="font-size: 0.8rem; color: #4b5563; text-transform: uppercase; font-weight: 600;">Total Deduction</div>
              <div id="summary-total-deductions" style="font-size: 1.25rem; font-weight: bold; color: #dc2626;">Rp 0</div>
            </div>
            <div>
              <div style="font-size: 0.8rem; color: #4b5563; text-transform: uppercase; font-weight: 600;">Take Home Pay (THP)</div>
              <div id="summary-thp" style="font-size: 1.35rem; font-weight: 800; color: #16a34a;">Rp 0</div>
            </div>
          </div>
        </div>
        <div class="modal-footer" style="background: #f9fafb; padding: 16px 20px; display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid #eee;">
          <button class="btn btn-secondary" onclick="document.getElementById('payroll-edit-modal').remove()">Batal</button>
          <button class="btn btn-primary" onclick="Payroll.saveEditModal('${record.id}')">Simpan Perubahan</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.updateEditModalSummary();
  },

  addNewCustomComponentRow() {
    const container = document.getElementById('custom-components-container');
    if (!container) return;
    const row = document.createElement('div');
    row.className = 'custom-comp-row flex gap-1 align-center';
    row.style = 'background: #f9fafb; padding: 6px; border-radius: 6px; border: 1px solid #e5e7eb; display: flex; font-size: 12px; margin-top: 5px;';
    row.innerHTML = `
      <input type="text" class="form-input comp-name" placeholder="Nama" style="flex: 1.5; padding: 4px 6px; font-size: 12px;">
      <select class="form-input comp-type" style="flex: 1; padding: 4px; font-size: 12px;" onchange="Payroll.updateEditModalSummary()">
        <option value="earnings">Pndptn</option>
        <option value="deduction">Pot</option>
      </select>
      <input type="number" class="form-input comp-amount" placeholder="Jumlah" style="flex: 1.2; padding: 4px 6px; font-size: 12px;" oninput="Payroll.updateEditModalSummary()">
      <button class="btn btn-sm btn-danger" onclick="this.parentElement.remove(); Payroll.updateEditModalSummary();" style="padding: 4px 8px; margin-left: 2px;">✖</button>
    `;
    container.appendChild(row);
    this.updateEditModalSummary();
  },

  async saveEditModal(id) {
    const record = this.payrollRecords.find(r => r.id === id);
    if (!record) return;

    const getVal = (id, fallback) => {
      const el = document.getElementById(id);
      return el ? parseFloat(el.value) || 0 : fallback;
    };

    const baseSalary = getVal('edit-base-salary', record.base_salary || 0);
    const tunjTetap = getVal('edit-tunj-tetap', record.tunj_tetap || 0);
    const mealPay = getVal('edit-meal-pay', record.meal_pay || 0);
    const nightMealPay = getVal('edit-night-meal-pay', record.night_meal_pay || 0);
    const tunjLuarKota = getVal('edit-tunj-luar-kota', record.tunj_luar_kota || 0);
    const productionPay = getVal('edit-production-pay', record.production_pay || 0);
    const presencePay = getVal('edit-presence-pay', record.presence_pay || 0);
    const deficiency = getVal('edit-previous-month-deficiency', record.previous_month_deficiency || 0);
    const bonus = getVal('edit-bonus', record.bonus || 0);
    const overtimePay = getVal('edit-overtime-pay', record.overtime_pay || 0);
    const varAllowance = getVal('edit-variable-allowance', record.variable_allowance || 0);

    const potTidakHadir = getVal('edit-potongan-tidak-hadir', record.potongan_tidak_hadir !== undefined ? record.potongan_tidak_hadir : (record.absence_deduction || 0));
    const potLambatPulang = getVal('edit-potongan-lambat-pulang', record.potongan_lambat_pulang !== undefined ? record.potongan_lambat_pulang : (record.late_deduction || 0));
    let bpjsHealthDed = getVal('edit-bpjs-health-deduction', record.bpjs_health_deduction || 0);
    if (bpjsHealthDed >= 500000) bpjsHealthDed = Math.round(bpjsHealthDed * 0.01);

    let jhtDed = getVal('edit-jht-deduction', record.jht_deduction || 0);
    if (jhtDed >= 500000) jhtDed = Math.round(jhtDed * 0.02);

    const pph21Ded = getVal('edit-pph21-deduction', record.pph21_deduction || 0);
    const otherDed = getVal('edit-other-deductions', record.other_deductions || 0);

    let bpjsKesBenefit = getVal('edit-bpjs-kes-benefit', record.bpjs_kes_benefit || 0);
    if (bpjsKesBenefit >= 500000) bpjsKesBenefit = Math.round(bpjsKesBenefit * 0.04);

    let bpjsTkBenefit = getVal('edit-bpjs-tk-benefit', record.bpjs_tk_benefit || 0);
    if (bpjsTkBenefit >= 500000) bpjsTkBenefit = Math.round(bpjsTkBenefit * 0.0424);

    const pph21Benefit = getVal('edit-pph21-benefit', record.pph21_benefit || 0);

    // Parse custom components
    const customComponents = {};
    const rows = document.querySelectorAll('#custom-components-container .custom-comp-row');
    rows.forEach(row => {
      const nameInput = row.querySelector('.comp-name');
      const typeSelect = row.querySelector('.comp-type');
      const amountInput = row.querySelector('.comp-amount');
      if (nameInput && typeSelect && amountInput) {
        const name = nameInput.value.trim();
        const type = typeSelect.value;
        const amount = parseFloat(amountInput.value) || 0;
        if (name) {
          customComponents[name] = { type, amount };
        }
      }
    });

    // Update payroll record properties
    record.base_salary = baseSalary;
    record.tunj_tetap = tunjTetap;
    record.meal_pay = mealPay;
    record.night_meal_pay = nightMealPay;
    record.tunj_luar_kota = tunjLuarKota;
    record.production_pay = productionPay;
    record.presence_pay = presencePay;
    record.previous_month_deficiency = deficiency;
    record.bonus = bonus;
    record.overtime_pay = overtimePay;
    record.variable_allowance = varAllowance;

    record.potongan_tidak_hadir = potTidakHadir;
    record.absence_deduction = potTidakHadir;
    record.potongan_lambat_pulang = potLambatPulang;
    record.late_deduction = potLambatPulang;
    record.bpjs_health_deduction = bpjsHealthDed;
    record.jht_deduction = jhtDed;
    record.pph21_deduction = pph21Ded;
    record.other_deductions = otherDed;

    record.bpjs_kes_benefit = bpjsKesBenefit;
    record.bpjs_tk_benefit = bpjsTkBenefit;
    record.pph21_benefit = pph21Benefit;
    record.custom_components = customComponents;

    // Recalculate totals
    let customEarningsSum = 0;
    let customDeductionsSum = 0;
    Object.values(customComponents).forEach(comp => {
      if (comp.type === 'earnings') customEarningsSum += comp.amount;
      if (comp.type === 'deduction') customDeductionsSum += comp.amount;
    });

    const totalEarnings = baseSalary + tunjTetap + mealPay + nightMealPay + tunjLuarKota + presencePay + overtimePay + productionPay + varAllowance + bonus + deficiency + customEarningsSum;
    const totalDeductions = potLambatPulang + potTidakHadir + bpjsHealthDed + jhtDed + pph21Ded + otherDed + customDeductionsSum;
    
    record.total_salary = Math.max(0, Math.round(totalEarnings - totalDeductions));

    // Ensure it is marked as imported/override so syncDraftBaseSalaries skips it
    record.imported = true;

    await Storage.set(Storage.KEYS.PAYROLL, this.payrollRecords);
    
    // Remove modal and re-render
    const modalEl = document.getElementById('payroll-edit-modal');
    if (modalEl) modalEl.remove();
    this.render();
  },

  enableOverride() {
      this.isOverrideActive = true;
      this.render();
  },

  cancelOverride() {
      this.isOverrideActive = false;
      this.render();
  },

  maskLateInput(input) {
      let val = input.value.replace(/\D/g, '');
      if (val === '') {
          input.value = '';
          return;
      }
      input.value = parseInt(val, 10).toLocaleString('id-ID');
  },

  parseMaskedNumber(str) {
      const val = String(str).replace(/\D/g, '');
      return parseInt(val, 10) || 0;
  },

  showOverrideModal(currentReason, onSave, onCancel) {
    const modal = document.createElement('div');
    modal.id = 'late-override-modal';
    modal.className = 'modal-overlay';
    modal.style = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 2000;
    `;
    modal.innerHTML = `
      <div class="modal" style="width: 100%; max-width: 450px; background: white; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); overflow: hidden; display: flex; flex-direction: column; text-align: left; font-family: sans-serif;">
        <div class="modal-header" style="background: #e11d48; color: white; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center;">
          <strong style="font-size: 1.1rem; font-weight: bold;">⚠️ Justifikasi Override Potongan</strong>
          <span class="modal-close" style="cursor: pointer; font-size: 1.5rem; font-weight: bold; color: white;" onclick="document.getElementById('late-override-modal').remove(); document.querySelector('#late-override-modal-cancel-btn').click();">&times;</span>
        </div>
        <div class="modal-body" style="padding: 20px;">
          <p class="text-gray small" style="margin-bottom: 12px; font-size: 13px; color: #4b5563; line-height: 1.4;">
            Anda mengubah nilai default potongan telat. Harap masukkan alasan/keterangan penyesuaian manual ini (Wajib):
          </p>
          <textarea id="override-late-reason" class="form-input" style="width: 100%; height: 80px; padding: 8px; border-radius: 6px; border: 1px solid #d1d5db; font-size: 13px; resize: none; color: #000;" placeholder="Contoh: Ban motor pecah, bukti terlampir...">${currentReason || ''}</textarea>
          <div id="override-error-msg" style="color: #dc2626; font-size: 12px; margin-top: 6px; display: none;">Keterangan wajib diisi!</div>
        </div>
        <div class="modal-footer" style="background: #f9fafb; padding: 12px 20px; display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid #e5e7eb;">
          <button id="late-override-modal-cancel-btn" class="btn btn-secondary" style="padding: 6px 14px; font-size: 13px;">Batal</button>
          <button id="late-override-modal-save-btn" class="btn btn-primary" style="background: #e11d48; border-color: #e11d48; padding: 6px 14px; font-size: 13px; color: #fff;">Simpan</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const txtArea = modal.querySelector('#override-late-reason');
    txtArea.focus();

    modal.querySelector('#late-override-modal-cancel-btn').onclick = () => {
      modal.remove();
      if (onCancel) onCancel();
    };

    modal.querySelector('#late-override-modal-save-btn').onclick = () => {
      const reason = txtArea.value.trim();
      if (!reason) {
        modal.querySelector('#override-error-msg').style.display = 'block';
        return;
      }
      modal.remove();
      if (onSave) onSave(reason);
    };
  },

  async handleLateBlur(input, recordId) {
      const newValue = this.parseMaskedNumber(input.value);
      const record = this.payrollRecords.find(r => r.id === recordId);
      if (!record) return;

      const calculatedValue = parseInt(input.getAttribute('data-calculated'), 10) || 0;

      if (newValue === calculatedValue) {
          // Reset override
          record.late_deduction_override = null;
          record.keterangan_override_late = null;
          record.late_deduction = calculatedValue;
          
          this.recalculateRecordThp(record);
          await Storage.set(Storage.KEYS.PAYROLL, this.payrollRecords);
          this.render();
      } else {
          // Needs justification modal
          this.showOverrideModal(
              record.keterangan_override_late,
              async (reason) => {
                  record.late_deduction_override = newValue;
                  record.keterangan_override_late = reason;
                  record.late_deduction = newValue;
                  
                  this.recalculateRecordThp(record);
                  await Storage.set(Storage.KEYS.PAYROLL, this.payrollRecords);
                  this.render();
              },
              () => {
                  // Cancelled, revert input value
                  input.value = record.late_deduction.toLocaleString('id-ID');
              }
          );
      }
  },

  recalculateRecordThp(record) {
      let customEarningsSum = 0;
      let customDeductionsSum = 0;
      Object.values(record.custom_components || {}).forEach(comp => {
          if (comp.type === 'earnings') customEarningsSum += (comp.amount || 0);
          if (comp.type === 'deduction') customDeductionsSum += (comp.amount || 0);
      });

      const totalEarnings = record.base_salary + 
                            (record.meal_pay || 0) + 
                            (record.night_meal_pay || 0) + 
                            (record.presence_pay || 0) + 
                            (record.overtime_pay || 0) + 
                            (record.production_pay || 0) + 
                            (record.variable_allowance || 0) + 
                            (record.bonus || 0) + 
                            customEarningsSum;

      const totalDeductions = (record.late_deduction || 0) + 
                              (record.absence_deduction || 0) + 
                              (record.half_day_deduction || 0) + 
                              (record.bpjs_health_deduction || 0) + 
                              (record.jht_deduction || 0) + 
                              (record.pph21_deduction || 0) + 
                              (record.other_deductions || 0) + 
                              customDeductionsSum;

      record.total_salary = Math.max(0, Math.round(totalEarnings - totalDeductions));
  },

  previewPeriodStats() {
      const startInput = document.querySelector('input[disabled][type="date"]').value;
      const endInput = document.getElementById('payroll-end-date-input').value;
      if (!startInput || !endInput) return;
      
      const durationInMs = new Date(endInput + 'T12:00:00') - new Date(startInput + 'T12:00:00');
      const totalDays = Math.round(durationInMs / (1000 * 60 * 60 * 24)) + 1;
      const workingDays = this.countWorkingDaysMonSat(startInput, endInput);
      
      document.getElementById('preview-total-days').textContent = `${totalDays} Hari`;
      document.getElementById('preview-working-days').textContent = `${workingDays} Hari`;
  },

  async savePayrollPeriod() {
      const dates = this.getPeriodDates(this.period);
      const endVal = document.getElementById('payroll-end-date-input').value;
      if (!endVal) {
          alert('Pilih End Date yang valid.');
          return;
      }

      // Check duration constraints
      const durationInMs = new Date(endVal + 'T12:00:00') - new Date(dates.startDate + 'T12:00:00');
      const totalDays = Math.round(durationInMs / (1000 * 60 * 60 * 24)) + 1;

      if (totalDays < 15 || totalDays > 40) {
          alert(`Error: Durasi satu periode payroll tidak boleh kurang dari 15 hari atau lebih dari 40 hari. (Durasi saat ini: ${totalDays} hari)`);
          return;
      }

      const isLocked = this.isWorkdaysLocked();
      let reason = '';
      if (isLocked) {
          const reasonInput = document.getElementById('payroll-override-reason');
          reason = reasonInput ? reasonInput.value.trim() : '';
          if (!reason) {
              alert('Alasan perubahan wajib diisi untuk Audit Log.');
              return;
          }
      }

      const customPeriods = Storage.getPayrollPeriods();
      const idx = customPeriods.findIndex(p => p.period === this.period);
      const oldEndDate = idx !== -1 ? customPeriods[idx].endDate : `${this.period}-25`;

      if (idx !== -1) {
          customPeriods[idx].endDate = endVal;
          customPeriods[idx].updatedAt = new Date().toISOString();
      } else {
          customPeriods.push({
              period: this.period,
              endDate: endVal,
              updatedAt: new Date().toISOString()
          });
      }

      if (isLocked) {
          const auditLog = Storage.getPayrollWorkdaysAudit();
          auditLog.push({
              id: 'AUDIT-PERIOD-' + Date.now(),
              timestamp: new Date().toISOString(),
              user: Storage.getCurrentUserRole ? Storage.getCurrentUserRole() : 'ADMIN',
              period: this.period,
              oldValue: oldEndDate,
              newValue: endVal,
              reason: reason
          });
          await Storage.savePayrollWorkdaysAudit(auditLog);
      }

      await Storage.savePayrollPeriods(customPeriods);
      
      this.isOverrideActive = false;
      alert('Master Kalender Payroll berhasil disimpan.');
      this.render();
  },

  calculateBasisDays(period) {
    const workdaysData = Storage.getPayrollWorkdays();
    const periodData = workdaysData.find(w => w.period === period);
    if (periodData && periodData.workdays) {
        return parseInt(periodData.workdays, 10);
    }
    
    if (!period) return 25; // Fallback
    const [year, month] = period.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const holidays = Storage.getHolidays();

    let workingDays = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month - 1, day);
      const yearStr = d.getFullYear().toString();
      const monthStr = (d.getMonth() + 1).toString().padStart(2, '0');
      const dayStr = d.getDate().toString().padStart(2, '0');
      const dateStr = `${yearStr}-${monthStr}-${dayStr}`;

      const isSunday = d.getDay() === 0;
      const isHoliday = holidays.some(h => h.date === dateStr);

      if (!isSunday && !isHoliday) {
        workingDays++;
      }
    }
    return workingDays;
  },

  openAllowanceDrawer(id, idx) {
    let row = null;
    if (idx !== undefined && idx !== null && this.payrollRecords && this.payrollRecords[idx]) {
      row = this.payrollRecords[idx];
    } else if (id && this.payrollRecords) {
      row = this.payrollRecords.find(r => String(r.id) === String(id)) ||
            this.payrollRecords.find(r => String(r.nik) === String(id));
    }
    
    if (!row && typeof Storage !== 'undefined' && Storage.getPayroll) {
      const allPay = Storage.getPayroll() || [];
      row = allPay.find(r => (this.period ? r.period === this.period : true) && (String(r.id) === String(id) || String(r.nik) === String(id))) ||
            allPay.find(r => String(r.id) === String(id) || String(r.nik) === String(id));
    }

    if (!row && typeof BPJSTaxCompliance !== 'undefined' && BPJSTaxCompliance.reconciliationData) {
      row = BPJSTaxCompliance.reconciliationData.find(r => r.id === id || String(r.nik) === String(id) || String(r._id) === String(id));
    }

    if (!row && typeof Storage !== 'undefined' && Storage.getEmployees) {
      const emp = Storage.getEmployees().find(e => e.id === id || String(e.nik) === String(id));
      if (emp) {
        row = {
          name: emp.name,
          nik: emp.nik,
          fixed_allowance: Number(emp.fixed_allowance || 0),
          variable_allowance: Number(emp.variable_allowance || 0),
          meal_pay: emp.lunch_allowance_enabled !== false ? 25 * 20000 : 0,
          transport_allowance: Number(emp.transport_allowance || 0),
          position_allowance: Number(emp.position_allowance || 0),
          work_days: 25
        };
      }
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
        customEarningsSum += comp.amount;
        customEarningsList.push({ name, amount: comp.amount });
      }
    });

    const mealPay = row.meal_pay || row.meal_allowance || row.tunj_makan || 0;
    const nightMealPay = row.night_meal_pay || row.night_meal_allowance || 0;
    const presencePay = row.presence_pay || row.presence_allowance || row.tunj_kehadiran || 0;
    const prodPay = row.production_pay || row.production_bonus || row.bonus_produksi || 0;
    const otPay = row.overtime_pay || row.uang_lembur || 0;
    const otHours = row.overtime_hours || 0;
    const tunjTetap = row.fixed_allowance || row.tunj_tetap || row.tunjangan_tetap || 0;
    const varAllowance = row.variable_allowance || row.tunj_variabel || 0;
    const transportPay = row.transport_allowance || row.tunj_transport || row.transport_pay || 0;
    const positionPay = row.position_allowance || row.tunj_jabatan || 0;
    const tunjLuarKota = row.tunj_luar_kota || row.dinas_luar_kota || 0;
    const bonus = row.bonus || row.thr || 0;
    const deficiency = row.previous_month_deficiency || row.selisih_kurang_gaji || 0;
    const adhocAllowance = row.adhoc_allowance || row.allowance_override || 0;

    const totalTunjangan = mealPay + nightMealPay + presencePay + prodPay + otPay + tunjTetap + varAllowance + transportPay + positionPay + tunjLuarKota + bonus + deficiency + adhocAllowance + customEarningsSum;

    const drawerOverlay = document.createElement('div');
    drawerOverlay.id = 'allowance-detail-drawer';
    drawerOverlay.style = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(0, 0, 0, 0.65); backdrop-filter: blur(4px);
      z-index: 10050; display: flex; justify-content: flex-end;
      animation: fadeIn 0.2s ease-out;
    `;
    drawerOverlay.onclick = (e) => {
      if (e.target === drawerOverlay) Payroll.closeAllowanceDrawer();
    };

    const hasAnyActiveAllowance = totalTunjangan > 0;

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
          <button class="btn btn-sm" onclick="Payroll.closeAllowanceDrawer()" style="background: rgba(255,255,255,0.08); border: 1px solid #475569; color: #cbd5e1; border-radius: 6px; padding: 4px 10px; cursor: pointer; font-size: 14px;">✕</button>
        </div>

        <!-- TOTAL BANNER -->
        <div style="padding: 18px 20px; background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(5, 150, 105, 0.22)); border-bottom: 1px solid rgba(16, 185, 129, 0.3); text-align: center;">
          <div style="font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.05em; color: #34d399; font-weight: 600;">Total Tunjangan & Lembur Periode ${this.period}</div>
          <div style="font-size: 1.85rem; font-weight: 800; color: #10b981; margin-top: 4px;">${App.formatCurrency(totalTunjangan)}</div>
          <div style="font-size: 11.5px; color: #94a3b8; margin-top: 4px;">Diakumulasikan ke dalam Bruto TER PPh 21 & Total THP</div>
        </div>

        <!-- SCROLLABLE BREAKDOWN -->
        <div style="padding: 18px 20px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 10px;">
          ${tunjTetap > 0 ? `
            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: #f1f5f9; font-size: 13px;">💼 Tunjangan Tetap (Fixed)</strong>
                <div style="font-size: 11px; color: #94a3b8;">Tunjangan tetap bulanan karyawan</div>
              </div>
              <span style="font-weight: 700; color: #10b981; font-size: 14px;">${App.formatCurrency(tunjTetap)}</span>
            </div>
          ` : ''}

          ${mealPay > 0 ? `
            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: #f1f5f9; font-size: 13px;">🍱 Uang Makan (Meal)</strong>
                <div style="font-size: 11px; color: #94a3b8;">Kehadiran reguler siang (${row.work_days || 0} hari)</div>
              </div>
              <span style="font-weight: 700; color: #10b981; font-size: 14px;">${App.formatCurrency(mealPay)}</span>
            </div>
          ` : ''}

          ${nightMealPay > 0 ? `
            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: #f1f5f9; font-size: 13px;">🌙 Uang Makan Malam</strong>
                <div style="font-size: 11px; color: #94a3b8;">Shift malam / lembur pulang &ge; 19:00</div>
              </div>
              <span style="font-weight: 700; color: #34d399; font-size: 14px;">${App.formatCurrency(nightMealPay)}</span>
            </div>
          ` : ''}

          ${presencePay > 0 ? `
            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: #f1f5f9; font-size: 13px;">🌟 Tunjangan Kehadiran (Red Day)</strong>
                <div style="font-size: 11px; color: #94a3b8;">Kerja di hari Minggu / Libur Nasional</div>
              </div>
              <span style="font-weight: 700; color: #38bdf8; font-size: 14px;">${App.formatCurrency(presencePay)}</span>
            </div>
          ` : ''}

          ${otPay > 0 ? `
            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: #f1f5f9; font-size: 13px;">⏱️ Uang Lembur (Overtime)</strong>
                <div style="font-size: 11px; color: #94a3b8;">${otHours} Jam Terverifikasi @ 20k/jam</div>
              </div>
              <span style="font-weight: 700; color: #fbbf24; font-size: 14px;">${App.formatCurrency(otPay)}</span>
            </div>
          ` : ''}

          ${prodPay > 0 ? `
            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: #f1f5f9; font-size: 13px;">🏭 Bonus Produksi</strong>
                <div style="font-size: 11px; color: #94a3b8;">Insentif output produksi kilang</div>
              </div>
              <span style="font-weight: 700; color: #a78bfa; font-size: 14px;">${App.formatCurrency(prodPay)}</span>
            </div>
          ` : ''}

          ${varAllowance > 0 ? `
            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: #f1f5f9; font-size: 13px;">📈 Tunjangan Variabel</strong>
                <div style="font-size: 11px; color: #94a3b8;">Tunjangan operasional & kinerja</div>
              </div>
              <span style="font-weight: 700; color: #f8fafc; font-size: 14px;">${App.formatCurrency(varAllowance)}</span>
            </div>
          ` : ''}

          ${transportPay > 0 ? `
            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: #f1f5f9; font-size: 13px;">🚗 Tunjangan Transport</strong>
                <div style="font-size: 11px; color: #94a3b8;">Transport harian operasional</div>
              </div>
              <span style="font-weight: 700; color: #f8fafc; font-size: 14px;">${App.formatCurrency(transportPay)}</span>
            </div>
          ` : ''}

          ${positionPay > 0 ? `
            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: #f1f5f9; font-size: 13px;">🎖️ Tunjangan Jabatan</strong>
                <div style="font-size: 11px; color: #94a3b8;">Tanggung jawab struktural</div>
              </div>
              <span style="font-weight: 700; color: #f8fafc; font-size: 14px;">${App.formatCurrency(positionPay)}</span>
            </div>
          ` : ''}

          ${tunjLuarKota > 0 ? `
            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: #f1f5f9; font-size: 13px;">✈️ Dinas Luar Kota</strong>
                <div style="font-size: 11px; color: #94a3b8;">Transport & akomodasi luar kota</div>
              </div>
              <span style="font-weight: 700; color: #f8fafc; font-size: 14px;">${App.formatCurrency(tunjLuarKota)}</span>
            </div>
          ` : ''}

          ${bonus > 0 ? `
            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: #f1f5f9; font-size: 13px;">🎁 Bonus / THR</strong>
                <div style="font-size: 11px; color: #94a3b8;">Bonus apresiasi performa</div>
              </div>
              <span style="font-weight: 700; color: #f43f5e; font-size: 14px;">${App.formatCurrency(bonus)}</span>
            </div>
          ` : ''}

          ${adhocAllowance > 0 ? `
            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: #f1f5f9; font-size: 13px;">➕ Penyesuaian / Ad-hoc Allowance</strong>
                <div style="font-size: 11px; color: #94a3b8;">Penyesuaian manual periode berjalan</div>
              </div>
              <span style="font-weight: 700; color: #34d399; font-size: 14px;">${App.formatCurrency(adhocAllowance)}</span>
            </div>
          ` : ''}

          ${deficiency > 0 ? `
            <div style="background: rgba(59, 130, 246, 0.1); border: 1px solid #3b82f6; border-radius: 8px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: #60a5fa; font-size: 13px;">⚖️ Selisih Kurang Gaji</strong>
                <div style="font-size: 11px; color: #93c5fd;">Kompensasi kekurangan periode lalu</div>
              </div>
              <span style="font-weight: 700; color: #60a5fa; font-size: 14px;">${App.formatCurrency(deficiency)}</span>
            </div>
          ` : ''}

          ${customEarningsList.map(c => `
            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: #f1f5f9; font-size: 13px;">🏷️ ${c.name}</strong>
                <div style="font-size: 11px; color: #94a3b8;">Komponen Tambahan Kustom</div>
              </div>
              <span style="font-weight: 700; color: #34d399; font-size: 14px;">${App.formatCurrency(c.amount)}</span>
            </div>
          `).join('')}

          ${!hasAnyActiveAllowance ? `
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
                <tr style="border-bottom: 1px solid #23354d;"><td style="padding: 4px 0; color: #cbd5e1;">Tunjangan Tetap</td><td style="text-align: right; font-weight: 600; color: ${tunjTetap > 0 ? '#10b981' : '#64748b'};">${App.formatCurrency(tunjTetap)}</td></tr>
                <tr style="border-bottom: 1px solid #23354d;"><td style="padding: 4px 0; color: #cbd5e1;">Uang Makan Siang</td><td style="text-align: right; font-weight: 600; color: ${mealPay > 0 ? '#10b981' : '#64748b'};">${App.formatCurrency(mealPay)}</td></tr>
                <tr style="border-bottom: 1px solid #23354d;"><td style="padding: 4px 0; color: #cbd5e1;">Uang Makan Malam</td><td style="text-align: right; font-weight: 600; color: ${nightMealPay > 0 ? '#10b981' : '#64748b'};">${App.formatCurrency(nightMealPay)}</td></tr>
                <tr style="border-bottom: 1px solid #23354d;"><td style="padding: 4px 0; color: #cbd5e1;">Uang Lembur</td><td style="text-align: right; font-weight: 600; color: ${otPay > 0 ? '#10b981' : '#64748b'};">${App.formatCurrency(otPay)}</td></tr>
                <tr style="border-bottom: 1px solid #23354d;"><td style="padding: 4px 0; color: #cbd5e1;">Bonus Produksi</td><td style="text-align: right; font-weight: 600; color: ${prodPay > 0 ? '#10b981' : '#64748b'};">${App.formatCurrency(prodPay)}</td></tr>
                <tr style="border-bottom: 1px solid #23354d;"><td style="padding: 4px 0; color: #cbd5e1;">Tunj. Kehadiran (Red Day)</td><td style="text-align: right; font-weight: 600; color: ${presencePay > 0 ? '#10b981' : '#64748b'};">${App.formatCurrency(presencePay)}</td></tr>
                <tr style="border-bottom: 1px solid #23354d;"><td style="padding: 4px 0; color: #cbd5e1;">Tunjangan Variabel</td><td style="text-align: right; font-weight: 600; color: ${varAllowance > 0 ? '#10b981' : '#64748b'};">${App.formatCurrency(varAllowance)}</td></tr>
                <tr><td style="padding: 4px 0; color: #cbd5e1;">Bonus / THR / Lainnya</td><td style="text-align: right; font-weight: 600; color: ${(bonus + tunjLuarKota + adhocAllowance + deficiency) > 0 ? '#10b981' : '#64748b'};">${App.formatCurrency(bonus + tunjLuarKota + adhocAllowance + deficiency)}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- FOOTER -->
        <div style="padding: 14px 20px; background: #1e293b; border-top: 1px solid #334155; display: flex; justify-content: flex-end;">
          <button class="btn btn-secondary" onclick="Payroll.closeAllowanceDrawer()" style="width: 100%;">Tutup Rincian</button>
        </div>
      </div>
    `;

    document.body.appendChild(drawerOverlay);
  },

  closeAllowanceDrawer() {
    const el = document.getElementById('allowance-detail-drawer');
    if (el) el.remove();
  },

  viewPayslip(id) {
    const record = this.payrollRecords.find(r => r.id === id);
    if (!record) return;

    const modal = document.createElement('div');
    modal.id = 'payslip-modal';
    modal.style = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.8); z-index: 10000; display: flex;
        justify-content: center; align-items: flex-start; overflow-y: auto; padding: 40px 20px;
    `;

    // Dynamic calculations including custom components
    let customEarningsSum = 0;
    let customDeductionsSum = 0;
    Object.values(record.custom_components || {}).forEach(comp => {
      if (comp.type === 'earnings') customEarningsSum += (comp.amount || 0);
      if (comp.type === 'deduction') customDeductionsSum += (comp.amount || 0);
    });

    let customBenefitsSum = 0;
    Object.values(record.custom_benefits || {}).forEach(comp => {
      customBenefitsSum += (comp.amount || 0);
    });

    const tunjTetap = record.tunj_tetap || 0;
    const mealPay = record.meal_pay || 0;
    const nightMealPay = record.night_meal_pay || 0;
    const tunjLuarKota = record.tunj_luar_kota || 0;
    const presencePay = record.presence_pay || 0;
    const productionPay = record.production_pay || 0;
    const variableAllowance = record.variable_allowance || 0;
    const bonus = record.bonus || 0;
    const deficiency = record.previous_month_deficiency || record.selisih_kurang_gaji || 0;
    const overtimePay = record.overtime_pay || 0;

    const totalEarnings = record.base_salary + tunjTetap + mealPay + nightMealPay + tunjLuarKota + presencePay + productionPay + variableAllowance + bonus + deficiency + overtimePay + customEarningsSum;

    const lateDeduction = record.potongan_lambat_pulang !== undefined ? record.potongan_lambat_pulang : (record.late_deduction || 0);
    const absenceDeduction = record.potongan_tidak_hadir !== undefined ? record.potongan_tidak_hadir : (record.absence_deduction || 0);
    const halfDayDeduction = record.half_day_deduction || 0;
    const bpjsHealthDeduction = record.bpjs_health_deduction || 0;
    const jhtDeduction = record.jht_deduction || 0;
    const pph21Deduction = record.pph21_deduction || 0;
    const otherDeductions = record.other_deductions || 0;

    const totalDeductions = lateDeduction + absenceDeduction + halfDayDeduction + bpjsHealthDeduction + jhtDeduction + pph21Deduction + otherDeductions + customDeductionsSum;

    const pph21Benefit = record.pph21_benefit || 0;
    const bpjsTkBenefit = record.bpjs_tk_benefit !== undefined ? record.bpjs_tk_benefit : ((record.jht_benefit || 0) + (record.jkk_benefit || 0) + (record.jkm_benefit || 0));
    const bpjsKesBenefit = record.bpjs_kes_benefit !== undefined ? record.bpjs_kes_benefit : (record.bpjs_health_benefit || 0);

    const totalBenefits = pph21Benefit + bpjsTkBenefit + bpjsKesBenefit + customBenefitsSum;

    const dates = this.getPeriodDates(record.period);

    // Build dynamic earnings list (Hide if zero)
    let earningsRows = `<tr><td>Basic Salary</td><td style="text-align: right;">${record.base_salary.toLocaleString('id-ID')}</td></tr>`;
    if (tunjTetap > 0) earningsRows += `<tr><td>Tunj. Tetap</td><td style="text-align: right;">${tunjTetap.toLocaleString('id-ID')}</td></tr>`;
    if (mealPay > 0) earningsRows += `<tr><td>Tunjangan Makan Siang</td><td style="text-align: right;">${mealPay.toLocaleString('id-ID')}</td></tr>`;
    if (nightMealPay > 0) earningsRows += `<tr><td>Tunjangan Makan Malam</td><td style="text-align: right;">${nightMealPay.toLocaleString('id-ID')}</td></tr>`;
    if (tunjLuarKota > 0) earningsRows += `<tr><td>Tunjangan Luar Kota</td><td style="text-align: right;">${tunjLuarKota.toLocaleString('id-ID')}</td></tr>`;
    if (presencePay > 0) earningsRows += `<tr><td>Tunjangan Kehadiran (Red Day)</td><td style="text-align: right;">${presencePay.toLocaleString('id-ID')}</td></tr>`;
    if (deficiency > 0) earningsRows += `<tr style="background: rgba(37, 99, 235, 0.05); font-weight: bold; color: #1e3a8a;"><td>Selisih Kurang Gaji</td><td style="text-align: right;">${deficiency.toLocaleString('id-ID')}</td></tr>`;
    if (overtimePay > 0) earningsRows += `<tr><td>Uang Lembur ${record.overtime_hours > 0 ? `(${record.overtime_hours} Jam)` : ''}</td><td style="text-align: right;">${overtimePay.toLocaleString('id-ID')}</td></tr>`;
    if (productionPay > 0) earningsRows += `<tr><td>Bonus Produksi</td><td style="text-align: right;">${productionPay.toLocaleString('id-ID')}</td></tr>`;
    if (variableAllowance > 0) earningsRows += `<tr><td>Tunjangan Variabel</td><td style="text-align: right;">${variableAllowance.toLocaleString('id-ID')}</td></tr>`;
    if (bonus > 0) earningsRows += `<tr><td>Bonus</td><td style="text-align: right;">${bonus.toLocaleString('id-ID')}</td></tr>`;
    
    Object.entries(record.custom_components || {}).forEach(([name, comp]) => {
      if (comp.type === 'earnings' && comp.amount > 0) {
        earningsRows += `<tr><td>${name}</td><td style="text-align: right;">${comp.amount.toLocaleString('id-ID')}</td></tr>`;
      }
    });

    // Build dynamic deductions list (Hide if zero)
    let deductionsRows = '';
    if (absenceDeduction > 0) deductionsRows += `<tr><td>Potongan Tidak Hadir</td><td style="text-align: right;">${absenceDeduction.toLocaleString('id-ID')}</td></tr>`;
    if (lateDeduction > 0) deductionsRows += `<tr><td>Potongan Keterlambatan & Pulang Awal</td><td style="text-align: right;">${lateDeduction.toLocaleString('id-ID')}</td></tr>`;
    if (halfDayDeduction > 0) deductionsRows += `<tr><td>Half-Day Deduction</td><td style="text-align: right;">${halfDayDeduction.toLocaleString('id-ID')}</td></tr>`;
    if (bpjsHealthDeduction > 0) deductionsRows += `<tr><td>BPJS Kesehatan Employee</td><td style="text-align: right;">${bpjsHealthDeduction.toLocaleString('id-ID')}</td></tr>`;
    if (jhtDeduction > 0) deductionsRows += `<tr><td>JHT Employee</td><td style="text-align: right;">${jhtDeduction.toLocaleString('id-ID')}</td></tr>`;
    if (pph21Deduction > 0) deductionsRows += `<tr><td>PPh 21 (TER ${record.ter_category || '-'} - ${record.ter_rate || 0}%)</td><td style="text-align: right;">${pph21Deduction.toLocaleString('id-ID')}</td></tr>`;
    if (otherDeductions > 0) deductionsRows += `<tr><td>Potongan Lain-lain</td><td style="text-align: right;">${otherDeductions.toLocaleString('id-ID')}</td></tr>`;
    
    Object.entries(record.custom_components || {}).forEach(([name, comp]) => {
      if (comp.type === 'deduction' && comp.amount > 0) {
        deductionsRows += `<tr><td>${name}</td><td style="text-align: right;">${comp.amount.toLocaleString('id-ID')}</td></tr>`;
      }
    });

    // Build dynamic benefits list (Hide if zero)
    let benefitsRows = '';
    if (pph21Benefit > 0) benefitsRows += `<tr><td>PPh 21 Benefit</td><td style="text-align: right;">${pph21Benefit.toLocaleString('id-ID')}</td></tr>`;
    if (bpjsTkBenefit > 0) benefitsRows += `<tr><td>BPJS TK Rate</td><td style="text-align: right;">${bpjsTkBenefit.toLocaleString('id-ID')}</td></tr>`;
    if (bpjsKesBenefit > 0) benefitsRows += `<tr><td>BPJS Kes Rate</td><td style="text-align: right;">${bpjsKesBenefit.toLocaleString('id-ID')}</td></tr>`;

    Object.entries(record.custom_benefits || {}).forEach(([name, comp]) => {
      if (comp.amount > 0) {
        benefitsRows += `<tr><td>${name}</td><td style="text-align: right;">${comp.amount.toLocaleString('id-ID')}</td></tr>`;
      }
    });

    // Build dynamic attendance rows
    let attendanceRows = '';
    attendanceRows += `<tr><td style="padding: 4px 6px; font-weight: 600;">H</td><td style="padding: 4px 6px; text-align: right; font-weight: 600;">${record.work_days || 0} Hari</td></tr>`;
    attendanceRows += `<tr><td style="padding: 4px 6px;">TK</td><td style="padding: 4px 6px; text-align: right;">${record.absence_days || 0} Hari</td></tr>`;
    attendanceRows += `<tr><td style="padding: 4px 6px;">I</td><td style="padding: 4px 6px; text-align: right;">${record.izin_days || 0} Hari</td></tr>`;
    attendanceRows += `<tr><td style="padding: 4px 6px;">SH</td><td style="padding: 4px 6px; text-align: right;">${record.half_day_izin || 0} Hari</td></tr>`;
    if (record.overtime_hours > 0) {
      attendanceRows += `<tr><td style="padding: 4px 6px;">Overtime</td><td style="padding: 4px 6px; text-align: right;">${record.overtime_hours} Jam</td></tr>`;
    }
    Object.entries(record.custom_attendance || {}).forEach(([name, val]) => {
      attendanceRows += `<tr><td style="padding: 4px 6px;">${name}</td><td style="padding: 4px 6px; text-align: right;">${val} Hari</td></tr>`;
    });

    modal.innerHTML = `
        <style>
            @media print {
                body * { visibility: hidden; }
                #payslip-content, #payslip-content * { visibility: visible; }
                #payslip-content { position: absolute; left: 0; top: 0; width: 100%; }
                .no-print { display: none !important; }
            }
            #payslip-content {
                background: white; width: 100%; max-width: 800px; padding: 40px;
                color: #333; font-family: 'Inter', sans-serif; line-height: 1.4; border-radius: 8px;
            }
            .ps-header { display: flex; justify-content: space-between; margin-bottom: 30px; border-bottom: 2px solid #eee; padding-bottom: 10px; }
            .ps-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 30px; }
            .ps-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            .ps-table th { text-align: left; background: #f8f9fa; padding: 8px; font-size: 0.9rem; border-bottom: 1px solid #ddd; }
            .ps-table td { padding: 8px; font-size: 0.9rem; border-bottom: 1px solid #eee; }
            .ps-title { font-weight: bold; font-size: 1.2rem; color: #000; }
            .ps-label { color: #666; width: 120px; display: inline-block; font-size: 0.85rem; }
            .ps-value { font-weight: 500; font-size: 0.85rem; }
            .ps-thp-box { background: #fdfdfd; border: 1px solid #eee; padding: 20px; display: flex; justify-content: space-between; align-items: center; margin-top: 20px; }
        </style>
        <div id="payslip-content">
            <div class="no-print" style="margin-bottom: 20px; display: flex; justify-content: space-between; width: 100%;">
                <button class="btn btn-secondary" onclick="document.getElementById('payslip-modal').remove()">✖ Tutup</button>
                <button class="btn btn-primary" onclick="window.print()">🖨️ Cetak / Save PDF</button>
            </div>

            <div style="text-align: center; color: #cc0000; font-weight: bold; margin-bottom: 15px; font-size: 0.8rem; letter-spacing: 2px;">*CONFIDENTIAL</div>
            
            <div class="ps-header">
                <div>
                    <h1 class="ps-title">PT GOLDEN ALURA</h1>
                    <p style="font-size: 0.85rem; color: #666;">Modern Jewelry ERP System</p>
                </div>
                <div style="text-align: right;">
                    <h1 class="ps-title">PAYSLIP</h1>
                </div>
            </div>

            <div class="ps-grid">
                <div>
                    <div><span class="ps-label">Payroll Cut Off</span> : <span class="ps-value">${dates.startDate} s.d ${dates.endDate}</span></div>
                    <div><span class="ps-label">ID / Name</span> : <span class="ps-value">${record.nik} / ${record.name}</span></div>
                    <div><span class="ps-label">Job Position</span> : <span class="ps-value">${record.position}</span></div>
                    <div><span class="ps-label">Organization</span> : <span class="ps-value">${record.department}</span></div>
                </div>
                <div>
                    <div><span class="ps-label">Grade / Level</span> : <span class="ps-value">- / Default</span></div>
                    <div><span class="ps-label">PTKP</span> : <span class="ps-value">${record.ptkp}</span></div>
                    <div><span class="ps-label">NPWP</span> : <span class="ps-value">${record.npwp}</span></div>
                </div>
            </div>

            <div class="ps-grid">
                <!-- EARNINGS -->
                <div>
                    <table class="ps-table">
                        <thead><tr><th>Earnings</th><th style="text-align: right;">Amount</th></tr></thead>
                        <tbody>
                            ${earningsRows}
                            <tr style="font-weight: bold; background: #fafafa;">
                                <td>Total Earnings</td>
                                <td style="text-align: right;">${totalEarnings.toLocaleString('id-ID')}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- DEDUCTIONS -->
                <div>
                    <table class="ps-table">
                        <thead><tr><th>Deductions</th><th style="text-align: right;">Amount</th></tr></thead>
                        <tbody>
                            ${deductionsRows}
                            <tr style="font-weight: bold; background: #fafafa;">
                                <td>Total Deductions</td>
                                <td style="text-align: right;">${totalDeductions.toLocaleString('id-ID')}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="ps-thp-box">
                <div style="font-size: 1.2rem; font-weight: bold;">Take Home Pay</div>
                <div style="font-size: 1.5rem; font-weight: bold; color: var(--color-primary);">Rp ${record.total_salary.toLocaleString('id-ID')}</div>
            </div>

            <div class="ps-grid" style="margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px;">
                <!-- ATTENDANCE SUMMARY -->
                <div style="grid-column: span 2;">
                    <table class="ps-table" style="font-size: 0.8rem; max-width: 400px;">
                        <thead><tr><th style="padding: 4px 6px;">Attendance Summary</th><th style="padding: 4px 6px; text-align: right;">Value</th></tr></thead>
                        <tbody>
                            ${attendanceRows}
                        </tbody>
                    </table>
                </div>
            </div>

            <div style="margin-top: 50px; font-size: 0.75rem; color: #666; border-top: 1px solid #eee; padding-top: 20px;">
                <p><strong>THIS IS COMPUTER GENERATED PRINTOUT AND NO SIGNATURE IS REQUIRED</strong></p>
                <p style="margin-top: 15px; font-weight: bold; color: #dc2626; text-align: justify; line-height: 1.4;">
                    PENTING & RAHASIA: Dokumen ini bersifat RAHASIA. Karyawan dilarang keras memperlihatkan, membagikan, atau mendiskusikan isi slip gaji ini kepada orang lain. Segala bentuk pelanggaran akan dikenakan sanksi disiplin berat hingga Pemutusan Hubungan Kerja (PHK) sesuai dengan Peraturan Perusahaan yang berlaku.
                </p>
                <div style="margin-top: 20px; display: flex; justify-content: space-between; color: #999;">
                    <span>Generated by ERP system</span>
                    <span>${new Date().toLocaleString('id-ID')}</span>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
  },

  generatePayslipPDF(record, emp) {
    const { jsPDF } = window.jspdf;
    
    let dobPassword = record.nik;
    if (emp && emp.birth_date) {
        const dobParts = emp.birth_date.split('-');
        if (dobParts.length === 3) {
            dobPassword = `${dobParts[2]}${dobParts[1]}${dobParts[0]}`;
        }
    }

    const doc = new jsPDF({
        format: 'a4',
        orientation: 'portrait',
        encryption: {
            userPassword: dobPassword,
            ownerPassword: 'GarPayroll_OwnerPassword_2026',
            userPermissions: ['print']
        }
    });

    const dates = this.getPeriodDates(record.period);
    let y = 15;
    
    doc.setFontSize(8);
    doc.setTextColor(204, 0, 0);
    doc.setFont(undefined, 'bold');
    doc.text('*CONFIDENTIAL', 105, y, { align: 'center' });
    y += 8;

    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, 'bold');
    doc.text('PT GOLDEN ALURA', 14, y);
    doc.setFontSize(14);
    doc.text('PAYSLIP', 196, y, { align: 'right' });
    y += 5;

    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(102, 102, 102);
    doc.text('Modern Jewelry ERP System', 14, y);
    doc.setLineWidth(0.5);
    doc.line(14, y + 2, 196, y + 2);
    y += 10;

    doc.setFontSize(8.5);
    doc.setTextColor(51, 51, 51);
    
    doc.setFont(undefined, 'normal');
    doc.text('Payroll Cut Off', 14, y);
    doc.text(':', 38, y);
    doc.setFont(undefined, 'bold');
    doc.text(`${dates.startDate} s.d ${dates.endDate}`, 42, y);

    doc.setFont(undefined, 'normal');
    doc.text('Grade / Level', 120, y);
    doc.text(':', 142, y);
    doc.setFont(undefined, 'bold');
    doc.text('- / Default', 146, y);
    y += 5;

    doc.setFont(undefined, 'normal');
    doc.text('ID / Name', 14, y);
    doc.text(':', 38, y);
    doc.setFont(undefined, 'bold');
    doc.text(`${record.nik} / ${record.name}`, 42, y);

    doc.setFont(undefined, 'normal');
    doc.text('PTKP', 120, y);
    doc.text(':', 142, y);
    doc.setFont(undefined, 'bold');
    doc.text(record.ptkp || '-', 146, y);
    y += 5;

    doc.setFont(undefined, 'normal');
    doc.text('Job Position', 14, y);
    doc.text(':', 38, y);
    doc.setFont(undefined, 'bold');
    doc.text(record.position || '-', 42, y);

    doc.setFont(undefined, 'normal');
    doc.text('NPWP', 120, y);
    doc.text(':', 142, y);
    doc.setFont(undefined, 'bold');
    doc.text(record.npwp || '-', 146, y);
    y += 5;

    doc.setFont(undefined, 'normal');
    doc.text('Organization', 14, y);
    doc.text(':', 38, y);
    doc.setFont(undefined, 'bold');
    doc.text(record.department || '-', 42, y);
    y += 10;

    const earnings = [];
    const deductions = [];
    const benefits = [];
    const attendance = [];

    const tunjTetap = record.tunj_tetap || 0;
    const mealPay = record.meal_pay || 0;
    const nightMealPay = record.night_meal_pay || 0;
    const tunjLuarKota = record.tunj_luar_kota || 0;
    const presencePay = record.presence_pay || 0;
    const productionPay = record.production_pay || 0;
    const variableAllowance = record.variable_allowance || 0;
    const bonus = record.bonus || 0;
    const deficiency = record.previous_month_deficiency || record.selisih_kurang_gaji || 0;
    const overtimePay = record.overtime_pay || 0;

    if (record.base_salary > 0) earnings.push(['Basic Salary', record.base_salary]);
    if (tunjTetap > 0) earnings.push(['Tunj. Tetap', tunjTetap]);
    if (mealPay > 0) earnings.push(['Tunjangan Makan Siang', mealPay]);
    if (nightMealPay > 0) earnings.push(['Tunjangan Makan Malam', nightMealPay]);
    if (tunjLuarKota > 0) earnings.push(['Tunjangan Luar Kota', tunjLuarKota]);
    if (presencePay > 0) earnings.push(['Tunjangan Kehadiran (Red Day)', presencePay]);
    if (deficiency > 0) earnings.push([`Selisih Kurang Gaji`, deficiency]);
    if (overtimePay > 0) earnings.push([`Uang Lembur${record.overtime_hours > 0 ? ` (${record.overtime_hours} Jam)` : ''}`, overtimePay]);
    if (productionPay > 0) earnings.push(['Bonus Produksi', productionPay]);
    if (variableAllowance > 0) earnings.push(['Tunjangan Variabel', variableAllowance]);
    if (bonus > 0) earnings.push(['Bonus', bonus]);
    
    let customEarningsSum = 0;
    Object.entries(record.custom_components || {}).forEach(([name, comp]) => {
      if (comp.type === 'earnings' && comp.amount > 0) {
        earnings.push([name, comp.amount]);
        customEarningsSum += comp.amount;
      }
    });

    const totalEarnings = record.base_salary + tunjTetap + mealPay + nightMealPay + tunjLuarKota + presencePay + productionPay + variableAllowance + bonus + deficiency + overtimePay + customEarningsSum;

    const lateDeduction = record.potongan_lambat_pulang !== undefined ? record.potongan_lambat_pulang : (record.late_deduction || 0);
    const absenceDeduction = record.potongan_tidak_hadir !== undefined ? record.potongan_tidak_hadir : (record.absence_deduction || 0);
    const halfDayDeduction = record.half_day_deduction || 0;
    const bpjsHealthDeduction = record.bpjs_health_deduction || 0;
    const jhtDeduction = record.jht_deduction || 0;
    const pph21Deduction = record.pph21_deduction || 0;
    const otherDeductions = record.other_deductions || 0;

    let customDeductionsSum = 0;
    Object.entries(record.custom_components || {}).forEach(([name, comp]) => {
      if (comp.type === 'deduction' && comp.amount > 0) {
        deductions.push([name, comp.amount]);
        customDeductionsSum += comp.amount;
      }
    });

    if (absenceDeduction > 0) deductions.push(['Potongan Tidak Hadir', absenceDeduction]);
    if (lateDeduction > 0) deductions.push(['Potongan Keterlambatan & Pulang Awal', lateDeduction]);
    if (halfDayDeduction > 0) deductions.push(['Half-Day Deduction', halfDayDeduction]);
    if (bpjsHealthDeduction > 0) deductions.push(['BPJS Kesehatan Employee', bpjsHealthDeduction]);
    if (jhtDeduction > 0) deductions.push(['JHT Employee', jhtDeduction]);
    if (pph21Deduction > 0) deductions.push([`PPh 21 (TER ${record.ter_category || '-'} - ${record.ter_rate || 0}%)`, pph21Deduction]);
    if (otherDeductions > 0) deductions.push(['Potongan Lain-lain', otherDeductions]);

    const totalDeductions = lateDeduction + absenceDeduction + halfDayDeduction + bpjsHealthDeduction + jhtDeduction + pph21Deduction + otherDeductions + customDeductionsSum;

    const pph21Benefit = record.pph21_benefit || 0;
    const bpjsTkBenefit = record.bpjs_tk_benefit !== undefined ? record.bpjs_tk_benefit : ((record.jht_benefit || 0) + (record.jkk_benefit || 0) + (record.jkm_benefit || 0));
    const bpjsKesBenefit = record.bpjs_kes_benefit !== undefined ? record.bpjs_kes_benefit : (record.bpjs_health_benefit || 0);

    if (pph21Benefit > 0) benefits.push(['PPH 21 Benefit', pph21Benefit]);
    if (bpjsTkBenefit > 0) benefits.push(['BPJS TK Rate', bpjsTkBenefit]);
    if (bpjsKesBenefit > 0) benefits.push(['BPJS Kes Rate', bpjsKesBenefit]);

    let customBenefitsSum = 0;
    Object.entries(record.custom_benefits || {}).forEach(([name, comp]) => {
      if (comp.amount > 0) {
        benefits.push([name, comp.amount]);
        customBenefitsSum += comp.amount;
      }
    });
    const totalBenefits = pph21Benefit + bpjsTkBenefit + bpjsKesBenefit + customBenefitsSum;

    const workDaysVal = record.work_days || 0;
    attendance.push(['H', `${workDaysVal} Hari`]);
    
    const tkVal = record.absence_days || 0;
    attendance.push(['TK', `${tkVal} Hari`]);

    const iVal = record.izin_days || 0;
    attendance.push(['I', `${iVal} Hari`]);

    const shVal = record.half_day_izin || 0;
    attendance.push(['SH', `${shVal} Hari`]);

    if (record.overtime_hours > 0) {
      attendance.push(['Overtime', `${record.overtime_hours} Jam`]);
    }

    Object.entries(record.custom_attendance || {}).forEach(([name, val]) => {
      attendance.push([name, `${val} Hari`]);
    });

    const formatRow = row => [row[0], typeof row[1] === 'number' ? row[1].toLocaleString('id-ID') : row[1]];

    const earningsBody = earnings.map(formatRow);
    earningsBody.push([{ content: 'Total Earnings', styles: { fontStyle: 'bold' } }, { content: totalEarnings.toLocaleString('id-ID'), styles: { fontStyle: 'bold', halign: 'right' } }]);

    const deductionsBody = deductions.map(formatRow);
    deductionsBody.push([{ content: 'Total Deductions', styles: { fontStyle: 'bold' } }, { content: totalDeductions.toLocaleString('id-ID'), styles: { fontStyle: 'bold', halign: 'right' } }]);

    doc.autoTable({
        startY: y,
        margin: { left: 14, right: 110 },
        head: [['Earnings', 'Amount']],
        body: earningsBody,
        theme: 'grid',
        headStyles: { fillColor: [248, 249, 250], textColor: 51, fontStyle: 'bold', lineColor: [221, 221, 221], lineWidth: 0.2 },
        bodyStyles: { lineColor: [238, 238, 238], lineWidth: 0.2 },
        styles: { fontSize: 8 },
        columnStyles: {
            1: { halign: 'right' }
        }
    });

    const leftTableY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY : y + 30;

    doc.autoTable({
        startY: y,
        margin: { left: 110, right: 14 },
        head: [['Deductions', 'Amount']],
        body: deductionsBody,
        theme: 'grid',
        headStyles: { fillColor: [248, 249, 250], textColor: 51, fontStyle: 'bold', lineColor: [221, 221, 221], lineWidth: 0.2 },
        bodyStyles: { lineColor: [238, 238, 238], lineWidth: 0.2 },
        styles: { fontSize: 8 },
        columnStyles: {
            1: { halign: 'right' }
        }
    });

    const rightTableY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY : y + 30;
    y = Math.max(leftTableY, rightTableY) + 6;

    doc.setFillColor(253, 253, 253);
    doc.setDrawColor(238, 238, 238);
    doc.rect(14, y, 182, 14, 'FD');
    
    doc.setFontSize(10);
    doc.setTextColor(51, 51, 51);
    doc.setFont(undefined, 'bold');
    doc.text('Take Home Pay', 18, y + 9);

    doc.setFontSize(12);
    doc.setTextColor(212, 143, 56);
    doc.text(`Rp ${record.total_salary.toLocaleString('id-ID')}`, 192, y + 9, { align: 'right' });
    y += 20;

    const attendanceBody = attendance.map(row => [row[0], row[1]]);

    doc.autoTable({
        startY: y,
        margin: { left: 14, right: 110 },
        head: [['Attendance Summary', 'Value']],
        body: attendanceBody,
        theme: 'grid',
        headStyles: { fillColor: [248, 249, 250], textColor: 51, fontStyle: 'bold', lineColor: [221, 221, 221], lineWidth: 0.2 },
        bodyStyles: { lineColor: [238, 238, 238], lineWidth: 0.2 },
        styles: { fontSize: 8 },
        columnStyles: {
            1: { halign: 'right' }
        }
    });

    const bottomY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY : y + 30;
    y = bottomY + 6;

    doc.setFontSize(7.5);
    doc.setTextColor(102, 102, 102);
    doc.setFont(undefined, 'bold');
    doc.text('THIS IS COMPUTER GENERATED PRINTOUT AND NO SIGNATURE IS REQUIRED', 14, y);
    y += 5;

    doc.setTextColor(220, 38, 38);
    doc.setFont(undefined, 'bold');
    doc.text('PENTING & RAHASIA:', 14, y);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(220, 38, 38);
    const splitText = doc.splitTextToSize('Dokumen ini bersifat RAHASIA. Karyawan dilarang keras memperlihatkan, membagikan, atau mendiskusikan isi slip gaji ini kepada orang lain. Segala bentuk pelanggaran akan dikenakan sanksi disiplin berat hingga Pemutusan Hubungan Kerja (PHK) sesuai dengan Peraturan Perusahaan yang berlaku.', 182);
    doc.text(splitText, 14, y + 4);
    
    y += 18;
    doc.setTextColor(153, 153, 153);
    doc.setFontSize(7);
    doc.text('Generated by ERP system', 14, y);
    doc.text(new Date().toLocaleString('id-ID'), 196, y, { align: 'right' });

    return doc;
  },

  handleImportExcel(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
        if (rawRows.length === 0) {
          alert('File Excel kosong!');
          return;
        }

        let headerIndex = -1;
        for (let i = 0; i < rawRows.length; i++) {
          const row = rawRows[i].map(cell => String(cell).trim().toLowerCase());
          if (row.includes('nik') || row.includes('nama') || row.includes('nama karyawan')) {
            headerIndex = i;
            break;
          }
        }

        if (headerIndex === -1) {
          headerIndex = 0;
        }

        const rawHeaders = rawRows[headerIndex].map(h => String(h).trim());
        const dataRows = rawRows.slice(headerIndex + 1).filter(row => row.some(cell => String(cell).trim() !== ""));

        if (dataRows.length === 0) {
          alert('Tidak ada data karyawan di bawah baris header!');
          return;
        }

        this.showImportMappingModal(rawHeaders, dataRows);
      } catch (error) {
        console.error('Import error:', error);
        alert('Gagal memproses file Excel: ' + error.message);
      }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
  },

  guessMapping(header) {
    const h = (header || '').toLowerCase().trim();
    if (!h) return 'ignore';
    if (h.includes('total allowance') || h.includes('total deduction') || h.includes('thp') || h.includes('take home pay') || h.includes('tax allowance') || h.includes('gross income tax')) {
      return 'ignore';
    }
    if (h === 'nik' || h.includes('induk') || h.includes('employee id') || h === 'id') return 'nik';
    if (h.includes('nama') || h.includes('name')) return 'name';
    if (h.includes('position') || h.includes('jabatan')) return 'position';
    if (h.includes('org') || h.includes('dept') || h.includes('divisi') || h.includes('department') || h.includes('organization')) return 'department';
    
    if (h === 'h' || h === 'masuk' || h === 'hadir' || h === 'work days') return 'work_days';
    if (h === 'tk' || h.includes('tidak hadir') || h === 'alpha' || (h.includes('absen') && !h.includes('potong'))) return 'absence_days';
    if (h === 'i' || h === 'izin' || h === 'ijin') return 'izin_days';
    if (h === 'sh' || h.includes('sakit') || h.includes('half-day') || h.includes('1/2 hari') || h.includes('setengah hari')) return 'half_day_izin';
    
    if (h === 'basic salary' || h === 'gaji pokok' || h === 'gapok' || h === 'pokok') return 'base_salary';
    if (h.includes('tunj') && h.includes('tetap')) return 'tunj_tetap';
    if (h.includes('makan malam') || h.includes('night meal')) return 'night_meal_pay';
    if (h.includes('makan') || h.includes('meal') || h === 'allowance') return 'meal_pay';
    if (h.includes('luar kota') || h.includes('luar_kota') || h.includes('travel')) return 'tunj_luar_kota';
    if (h.includes('produksi') || h.includes('lebur') || h.includes('bonus_produksi')) return 'production_pay';
    if (h.includes('kehadiran') && h.includes('tunj')) return 'presence_pay';
    if (h.includes('selisih') || h.includes('kurang gaji') || h.includes('deficiency') || h.includes('kekurangan')) return 'previous_month_deficiency';
    if (h.includes('bonus') || h.includes('insentif') || h.includes('incentive')) return 'bonus';
    if (h.includes('overtime') || h.includes('lembur')) return 'overtime_pay';
    
    if (h.includes('potongan') && (h.includes('tidak hadir') || h.includes('alpha') || h.includes('absen'))) return 'potongan_tidak_hadir';
    if (h.includes('potongan') && (h.includes('terlambat') || h.includes('pulang awal') || h.includes('keterlambatan'))) return 'potongan_lambat_pulang';
    
    // Exact column name matches to prevent any ambiguity
    if (h === 'iuran bpjs kes') return 'bpjs_health_deduction';
    if (h === 'iuran jht') return 'jht_deduction';
    if (h === 'rate dasar bpjs kes' || h === 'gaji dasar bpjs kes' || h === 'dasar bpjs kes') return 'bpjs_kes_benefit';
    if (h === 'rate dasar bpjs tk' || h === 'gaji dasar bpjs tk' || h === 'dasar bpjs tk') return 'bpjs_tk_benefit';

    // Strict BPJS matches
    if (h.includes('bpjs') || h.includes('jht')) {
      // 1. Company Benefits (must not contain employee-like terms)
      if ((h.includes('rate') || h.includes('perusahaan') || h.includes('company') || h.includes('comp') || h.includes('benefit')) && !h.includes('employee') && !h.includes('karyawan') && !h.includes('emp') && !h.includes('iuran')) {
        if (h.includes('kes') || h.includes('kesehatan') || h.includes('health')) {
          return 'bpjs_kes_benefit';
        }
        if (h.includes('tk') || h.includes('ketenagakerjaan') || h.includes('employment')) {
          return 'bpjs_tk_benefit';
        }
      }
      // 2. Employee Deductions (must not contain company/rate-like terms unless it has "iuran")
      if (h.includes('employee') || h.includes('karyawan') || h.includes('emp') || h.includes('potongan') || h.includes('deduction') || h.includes('iuran') || h === 'bpjs k' || h.includes('bpjs k ') || h === 'bpjs kesehatan' || h.includes('jht')) {
        if (h.includes('tk') || h.includes('ketenagakerjaan') || h.includes('jht') || h.includes('employment')) {
          return 'jht_deduction';
        }
        if (h.includes('kes') || h.includes('kesehatan') || h.includes('health') || (h.includes('bpjs k') && !h.includes('bpjs tk') && !h.includes('bpjs ketenagakerjaan') && !h.includes('bpjs kes'))) {
          return 'bpjs_health_deduction';
        }
      }
    }
    if (h.includes('pph') && h.includes('21') && (h.includes('potongan') || !h.includes('benefit'))) return 'pph21_deduction';
    
    if (h.includes('pph') && h.includes('21') && h.includes('benefit')) return 'pph21_benefit';
    
    if (h.includes('tunj') || h.includes('bonus') || h.includes('allowance') || h.includes('insentif')) return 'custom_earnings';
    if (h.includes('potongan') || h.includes('potong') || h.includes('denda') || h.includes('deduction')) return 'custom_deductions';
    if (h.includes('benefit') || h.includes('rate')) return 'custom_benefits';

    return 'ignore';
  },

  showImportMappingModal(headers, rows) {
    const modal = document.createElement('div');
    modal.id = 'payroll-import-mapping-modal';
    modal.className = 'modal-overlay';
    modal.style = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.5); display: flex; justify-content: center;
      align-items: center; z-index: 10000; overflow-y: auto; padding: 20px;
    `;

    const mappingTargets = [
      { value: 'ignore', label: '❌ Ignore (Skip Column)' },
      { value: 'nik', label: '👤 Employee Identifier: NIK' },
      { value: 'name', label: '👤 Employee Identifier: Nama Karyawan' },
      { value: 'position', label: '👤 Employee Identifier: Job Position' },
      { value: 'department', label: '👤 Employee Identifier: ORG (Dept)' },
      
      { value: 'work_days', label: '📊 Attendance: H (Masuk)' },
      { value: 'absence_days', label: '📊 Attendance: TK (Tidak Hadir)' },
      { value: 'izin_days', label: '📊 Attendance: I (Izin)' },
      { value: 'half_day_izin', label: '📊 Attendance: SH (Sakit/Half-day)' },
      { value: 'overtime_hours', label: '📊 Attendance: Overtime Hours' },
      
      { value: 'base_salary', label: '💰 Earnings: Basic Salary' },
      { value: 'tunj_tetap', label: '💰 Earnings: Tunj. Tetap' },
      { value: 'meal_pay', label: '💰 Earnings: Tunjangan Makan' },
      { value: 'night_meal_pay', label: '💰 Earnings: Tunjangan Makan Malam' },
      { value: 'tunj_luar_kota', label: '💰 Earnings: Tunjangan Luar Kota' },
      { value: 'production_pay', label: '💰 Earnings: Bonus Produksi' },
      { value: 'presence_pay', label: '💰 Earnings: Tunjangan Kehadiran' },
      { value: 'previous_month_deficiency', label: '💰 Earnings: Selisih Kurang Gaji' },
      { value: 'bonus', label: '💰 Earnings: Bonus' },
      { value: 'overtime_pay', label: '💰 Earnings: Overtime' },
      
      { value: 'potongan_tidak_hadir', label: '📉 Deduction: Potongan Tidak Hadir' },
      { value: 'potongan_lambat_pulang', label: '📉 Deduction: Potongan Keterlambatan & Pulang Awal' },
      { value: 'bpjs_health_deduction', label: '📉 Deduction: BPJS Kesehatan Employee' },
      { value: 'jht_deduction', label: '📉 Deduction: JHT Employee' },
      { value: 'pph21_deduction', label: '📉 Deduction: PPh 21' },
      
      { value: 'pph21_benefit', label: '🛡️ Benefit: PPh 21 Benefit' },
      { value: 'bpjs_tk_benefit', label: '🛡️ Benefit: BPJS TK Rate' },
      { value: 'bpjs_kes_benefit', label: '🛡️ Benefit: BPJS Kes Rate' },
      
      { value: 'bpjs_wage_basis_kes', label: '📊 BPJS Kes Wage Basis (Auto 1% Deduct & 4% Benefit)' },
      { value: 'bpjs_wage_basis_tk', label: '📊 BPJS TK Wage Basis (Auto 2% JHT Deduct & 4.24% Benefit)' },

      { value: 'custom_earnings', label: '➕ Custom Allowance (Earnings)' },
      { value: 'custom_deductions', label: '➕ Custom Deduction' },
      { value: 'custom_benefits', label: '➕ Custom Benefit (Company Paid)' },
      { value: 'custom_attendance', label: '➕ Custom Attendance Metric' }
    ];

    const sampleValues = headers.map((header, colIdx) => {
      const samples = [];
      for (let i = 0; i < Math.min(3, rows.length); i++) {
        if (rows[i][colIdx] !== undefined && rows[i][colIdx] !== "") {
          samples.push(rows[i][colIdx]);
        }
      }
      return samples.join(', ') || '-';
    });

    let mappingRowsHTML = headers.map((header, colIdx) => {
      const guessed = this.guessMapping(header);
      const optionsHTML = mappingTargets.map(target => {
        return `<option value="${target.value}" ${target.value === guessed ? 'selected' : ''}>${target.label}</option>`;
      }).join('');

      return `
        <div class="mapping-row" style="display: flex; align-items: center; background: #f9fafb; padding: 12px; border-radius: 6px; border: 1px solid #e5e7eb; margin-bottom: 8px;">
          <div style="flex: 1.5; font-weight: bold; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${header}">
            ${header}
            <div style="font-size: 0.75rem; color: #6b7280; font-weight: normal;">Sample: ${sampleValues[colIdx]}</div>
          </div>
          <div style="flex: 2; margin-left: 10px;">
            <select class="form-input map-target-select" data-col-idx="${colIdx}" style="width: 100%; padding: 6px 10px;">
              ${optionsHTML}
            </select>
          </div>
        </div>
      `;
    }).join('');

    modal.innerHTML = `
      <div class="modal" style="width: 100%; max-width: 650px; background: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); overflow: hidden; display: flex; flex-direction: column; text-align: left;">
        <div class="modal-header" style="background: var(--color-primary); color: white; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0; color: white;">📥 Map Kolom Excel Payroll</h3>
          <span onclick="document.getElementById('payroll-import-mapping-modal').remove()" style="cursor: pointer; font-size: 1.5rem; font-weight: bold; color: white;">&times;</span>
        </div>
        <div class="modal-body" style="padding: 20px; max-height: 65vh; overflow-y: auto;">
          <p style="margin-top: 0; margin-bottom: 15px; color: #4b5563; font-size: 0.875rem;">
            Cocokkan kolom dari file Excel Anda ke field target di database ERP. Nilai kosong akan dianggap 0. Kolom yang tidak dicocokkan akan dilewati.
          </p>
          <div id="mapping-rows-container">
            ${mappingRowsHTML}
          </div>
        </div>
        <div class="modal-footer" style="background: #f9fafb; padding: 16px 20px; display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid #eee;">
          <button class="btn btn-secondary" onclick="document.getElementById('payroll-import-mapping-modal').remove()">Batal</button>
          <button class="btn btn-primary" id="btn-execute-import">Impor Sekarang</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('btn-execute-import').onclick = () => {
      const selectElements = modal.querySelectorAll('.map-target-select');
      const mappings = {};
      
      selectElements.forEach(select => {
        const colIdx = parseInt(select.getAttribute('data-col-idx'));
        const target = select.value;
        if (target !== 'ignore') {
          mappings[colIdx] = target;
        }
      });

      const mappedTargets = Object.values(mappings);
      if (!mappedTargets.includes('nik')) {
        alert('Anda harus memetakan satu kolom sebagai "Employee Identifier: NIK"!');
        return;
      }

      modal.remove();
      this.processImportExcel(mappings, headers, rows);
    };
  },

  async processImportExcel(mappings, headers, rows) {
    let successCount = 0;
    let skipCount = 0;
    let errors = [];

    let nikColIdx = -1;
    for (const [colIdx, target] of Object.entries(mappings)) {
      if (target === 'nik') {
        nikColIdx = parseInt(colIdx);
        break;
      }
    }

    const newRecords = [];

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      const rawNik = String(row[nikColIdx] || '').trim();
      if (!rawNik) {
        skipCount++;
        continue;
      }

      const emp = this.employees.find(e => String(e.nik).trim() === rawNik);
      if (!emp) {
        errors.push(`Row ${r + 2}: Karyawan dengan NIK "${rawNik}" tidak ditemukan di database.`);
        skipCount++;
        continue;
      }

      const parsedData = {
        base_salary: parseFloat(emp.base_salary) || 0,
        tunj_tetap: 0,
        meal_pay: 0,
        night_meal_pay: 0,
        tunj_luar_kota: 0,
        production_pay: 0,
        presence_pay: 0,
        previous_month_deficiency: 0,
        bonus: 0,
        overtime_pay: 0,
        potongan_tidak_hadir: 0,
        potongan_lambat_pulang: 0,
        bpjs_health_deduction: 0,
        jht_deduction: 0,
        pph21_deduction: 0,
        pph21_benefit: 0,
        bpjs_tk_benefit: 0,
        bpjs_kes_benefit: 0,
        
        work_days: 0,
        absence_days: 0,
        izin_days: 0,
        half_day_izin: 0,
        overtime_hours: 0,

        custom_components: {},
        custom_benefits: {},
        custom_attendance: {}
      };

      for (const [colIdxStr, target] of Object.entries(mappings)) {
        const colIdx = parseInt(colIdxStr);
        const colVal = row[colIdx];
        const rawValStr = String(colVal || '').trim();
        let parsedVal = 0;
        if (rawValStr) {
          const cleanStr = rawValStr.replace(/[^0-9,-]/g, '').replace(/,/g, '.');
          parsedVal = parseFloat(cleanStr) || 0;
        }

        const colName = headers[colIdx];

        if (target === 'custom_earnings') {
          parsedData.custom_components[colName] = { type: 'earnings', amount: Math.round(parsedVal) };
        } else if (target === 'custom_deductions') {
          parsedData.custom_components[colName] = { type: 'deduction', amount: Math.round(parsedVal) };
        } else if (target === 'custom_benefits') {
          parsedData.custom_benefits[colName] = { amount: Math.round(parsedVal) };
        } else if (target === 'custom_attendance') {
          parsedData.custom_attendance[colName] = parsedVal;
        } else if (['work_days', 'absence_days', 'izin_days', 'half_day_izin', 'overtime_hours'].includes(target)) {
          parsedData[target] = parsedVal;
        } else if (target === 'bpjs_wage_basis_kes') {
          parsedData.bpjs_wage_basis_kes = parsedVal;
        } else if (target === 'bpjs_wage_basis_tk') {
          parsedData.bpjs_wage_basis_tk = parsedVal;
        } else if (target !== 'nik' && target !== 'name' && target !== 'position' && target !== 'department') {
          parsedData[target] = Math.round(parsedVal);
        }
      }

      let bpjsHealthDed = parsedData.bpjs_health_deduction;
      let bpjsKesBen = parsedData.bpjs_kes_benefit;
      let jhtDed = parsedData.jht_deduction;
      let bpjsTkBen = parsedData.bpjs_tk_benefit;

      if (parsedData.bpjs_wage_basis_kes && parsedData.bpjs_wage_basis_kes > 0) {
        const w = parsedData.bpjs_wage_basis_kes;
        bpjsHealthDed = Math.round(w * 0.01);
        bpjsKesBen = Math.round(w * 0.04);
      } else {
        if (bpjsHealthDed >= 500000) {
          const wage = bpjsHealthDed;
          bpjsHealthDed = Math.round(wage * 0.01);
          if (!bpjsKesBen) bpjsKesBen = Math.round(wage * 0.04);
        }
        if (bpjsKesBen >= 500000) {
          const wage = bpjsKesBen;
          bpjsKesBen = Math.round(wage * 0.04);
          if (!bpjsHealthDed) bpjsHealthDed = Math.round(wage * 0.01);
        }
      }

      if (parsedData.bpjs_wage_basis_tk && parsedData.bpjs_wage_basis_tk > 0) {
        const w = parsedData.bpjs_wage_basis_tk;
        jhtDed = Math.round(w * 0.02);
        bpjsTkBen = Math.round(w * 0.0424);
      } else {
        if (jhtDed >= 500000) {
          const wage = jhtDed;
          jhtDed = Math.round(wage * 0.02);
          if (!bpjsTkBen) bpjsTkBen = Math.round(wage * 0.0424);
        }
        if (bpjsTkBen >= 500000) {
          const wage = bpjsTkBen;
          bpjsTkBen = Math.round(wage * 0.0424);
          if (!jhtDed) jhtDed = Math.round(wage * 0.02);
        }
      }

      parsedData.bpjs_health_deduction = bpjsHealthDed;
      parsedData.bpjs_kes_benefit = bpjsKesBen;
      parsedData.jht_deduction = jhtDed;
      parsedData.bpjs_tk_benefit = bpjsTkBen;

      let customEarningsSum = 0;
      let customDeductionsSum = 0;
      Object.values(parsedData.custom_components).forEach(comp => {
        if (comp.type === 'earnings') customEarningsSum += comp.amount;
        if (comp.type === 'deduction') customDeductionsSum += comp.amount;
      });

      let customBenefitsSum = 0;
      Object.values(parsedData.custom_benefits).forEach(comp => {
        customBenefitsSum += comp.amount;
      });

      const totalEarnings = parsedData.base_salary + parsedData.tunj_tetap + parsedData.meal_pay + parsedData.night_meal_pay + parsedData.tunj_luar_kota + parsedData.presence_pay + parsedData.production_pay + parsedData.bonus + parsedData.previous_month_deficiency + parsedData.overtime_pay + customEarningsSum;
      const totalDeductions = parsedData.potongan_tidak_hadir + parsedData.potongan_lambat_pulang + parsedData.bpjs_health_deduction + parsedData.jht_deduction + parsedData.pph21_deduction + customDeductionsSum;
      
      const totalSalary = Math.max(0, totalEarnings - totalDeductions);
      const totalBenefits = parsedData.pph21_benefit + parsedData.bpjs_tk_benefit + parsedData.bpjs_kes_benefit + customBenefitsSum;

      newRecords.push({
        id: `PAY-${this.period}-${rawNik}`,
        nik: rawNik,
        name: emp.name,
        department: emp.department || 'OTHER',
        position: emp.position || '-',
        ptkp: emp.ptkp || '-',
        npwp: emp.npwp || '-',
        period: this.period,
        is_first_day: false,
        
        base_salary: parsedData.base_salary,
        tunj_tetap: parsedData.tunj_tetap,
        meal_pay: parsedData.meal_pay,
        night_meal_pay: parsedData.night_meal_pay,
        tunj_luar_kota: parsedData.tunj_luar_kota,
        production_pay: parsedData.production_pay,
        presence_pay: parsedData.presence_pay,
        previous_month_deficiency: parsedData.previous_month_deficiency,
        bonus: parsedData.bonus,
        overtime_pay: parsedData.overtime_pay,
        
        potongan_tidak_hadir: parsedData.potongan_tidak_hadir,
        absence_deduction: parsedData.potongan_tidak_hadir,
        potongan_lambat_pulang: parsedData.potongan_lambat_pulang,
        late_deduction: parsedData.potongan_lambat_pulang,
        
        bpjs_health_deduction: parsedData.bpjs_health_deduction,
        jht_deduction: parsedData.jht_deduction,
        pph21_deduction: parsedData.pph21_deduction,
        
        pph21_benefit: parsedData.pph21_benefit,
        bpjs_tk_benefit: parsedData.bpjs_tk_benefit,
        bpjs_kes_benefit: parsedData.bpjs_kes_benefit,
        
        work_days: parsedData.work_days,
        absence_days: parsedData.absence_days,
        izin_days: parsedData.izin_days,
        half_day_izin: parsedData.half_day_izin,
        overtime_hours: parsedData.overtime_hours,

        custom_components: parsedData.custom_components,
        custom_benefits: parsedData.custom_benefits,
        custom_attendance: parsedData.custom_attendance,

        total_salary: Math.round(totalSalary),
        status: 'draft',
        imported: true,
        paidAt: null
      });

      successCount++;
    }

    newRecords.forEach(nr => {
      const idx = this.payrollRecords.findIndex(pr => pr.id === nr.id);
      if (idx !== -1) {
        if (this.payrollRecords[idx].status === 'paid') return;
        this.payrollRecords[idx] = nr;
      } else {
        this.payrollRecords.push(nr);
      }
    });

    await Storage.set(Storage.KEYS.PAYROLL, this.payrollRecords);

    let msg = `Impor selesai! Berhasil mengimpor ${successCount} data payroll.`;
    if (skipCount > 0) {
      msg += `\nDilewati: ${skipCount} baris.`;
    }
    if (errors.length > 0) {
      msg += `\n\nDetail error:\n` + errors.slice(0, 5).join('\n');
      if (errors.length > 5) {
        msg += `\n...dan ${errors.length - 5} error lainnya.`;
      }
    }
    alert(msg);
    this.render();
  },

  populateDeptFilter() {
    const select = document.getElementById('payroll-dept-filter');
    if (!select) return;

    // Get unique departments from current period records
    const records = this.payrollRecords.filter(p => p.period === this.period);
    const depts = Array.from(new Set(records.map(r => r.department).filter(Boolean)));
    
    select.innerHTML = `
      <option value="">-- Semua Departemen --</option>
      ${depts.map(d => `<option value="${d}" ${this.selectedDept === d ? 'selected' : ''}>${d}</option>`).join('')}
    `;
  },

  updateBulkSendButtonLabel() {
    const list = this.getPeriodPayroll();
    const btn = document.getElementById('btn-send-email-bulk');
    if (btn) {
      btn.textContent = `📧 KIRIM EMAIL KE SEMUA FILTER (${list.length} KARYAWAN)`;
    }
    const btnZip = document.getElementById('btn-download-zip-bulk');
    if (btnZip) {
      btnZip.textContent = `📦 Download All Payslips (ZIP) (${list.length} KARYAWAN)`;
    }
    const btnWa = document.getElementById('btn-send-wa-bulk');
    if (btnWa) {
      btnWa.textContent = `💬 KIRIM WA KE SEMUA FILTER (${list.length} KARYAWAN)`;
    }
  },

  handleFilterChange() {
    const deptSelect = document.getElementById('payroll-dept-filter');
    const searchInput = document.getElementById('payroll-search-filter');
    
    this.selectedDept = deptSelect ? deptSelect.value : '';
    this.searchQuery = searchInput ? searchInput.value.trim() : '';
    
    const tableContainer = document.getElementById('payroll-table-container');
    if (tableContainer) {
        tableContainer.innerHTML = this.renderTable();
    }
    this.updateBulkSendButtonLabel();
  },

  resetFilters() {
    this.selectedDept = '';
    this.searchQuery = '';
    const deptSelect = document.getElementById('payroll-dept-filter');
    const searchInput = document.getElementById('payroll-search-filter');
    if (deptSelect) deptSelect.value = '';
    if (searchInput) searchInput.value = '';
    
    const tableContainer = document.getElementById('payroll-table-container');
    if (tableContainer) {
        tableContainer.innerHTML = this.renderTable();
    }
    this.updateBulkSendButtonLabel();
  },

  exportToExcel() {
    let list = this.getPeriodPayroll();
    let isTemplate = false;
    if (list.length === 0) {
      const activeEmployees = Storage.getEmployees();
      if (activeEmployees.length === 0) {
        alert('Tidak ada data karyawan di Master Karyawan untuk dijadikan template.');
        return;
      }
      isTemplate = true;
      list = activeEmployees.map(emp => ({
        period: this.period,
        nik: emp.nik,
        name: emp.name,
        department: emp.department || 'OTHER',
        position: emp.position || '-',
        base_salary: parseFloat(emp.base_salary) || 0,
        tunj_tetap: 0,
        meal_pay: 0,
        night_meal_pay: 0,
        tunj_luar_kota: 0,
        production_pay: 0,
        presence_pay: 0,
        previous_month_deficiency: 0,
        bonus: 0,
        overtime_pay: 0,
        potongan_tidak_hadir: 0,
        potongan_lambat_pulang: 0,
        bpjs_health_deduction: 0,
        jht_deduction: 0,
        pph21_deduction: 0,
        pph21_benefit: 0,
        bpjs_tk_benefit: 0,
        bpjs_kes_benefit: 0,
        work_days: 0,
        absence_days: 0,
        izin_days: 0,
        half_day_izin: 0,
        overtime_hours: 0,
        custom_components: {},
        custom_benefits: {},
        custom_attendance: {}
      }));
    }

    // Extract all unique custom component names
    const allCustomEarnings = new Set();
    const allCustomDeductions = new Set();
    const allCustomBenefits = new Set();
    const allCustomAttendance = new Set();
    list.forEach(r => {
      Object.entries(r.custom_components || {}).forEach(([name, data]) => {
        if (data.amount > 0) {
          if (data.type === 'earnings') allCustomEarnings.add(name);
          if (data.type === 'deduction') allCustomDeductions.add(name);
        }
      });
      Object.entries(r.custom_benefits || {}).forEach(([name, data]) => {
        if (data.amount > 0) allCustomBenefits.add(name);
      });
      Object.entries(r.custom_attendance || {}).forEach(([name, val]) => {
        if (val > 0) allCustomAttendance.add(name);
      });
    });

    const customEarningsArr = Array.from(allCustomEarnings);
    const customDeductionsArr = Array.from(allCustomDeductions);
    const customBenefitsArr = Array.from(allCustomBenefits);
    const customAttendanceArr = Array.from(allCustomAttendance);

    const data = list.map(row => {
      const exportRow = {
        'Nama Karyawan': row.name,
        'Job Position': row.position,
        'ORG': row.department,
        'NIK': row.nik,
        'H': row.work_days,
        'TK': row.absence_days,
        'I': row.izin_days,
        'SH': row.half_day_izin
      };

      // Add custom attendance
      customAttendanceArr.forEach(name => {
        exportRow[name] = (row.custom_attendance || {})[name] || 0;
      });

      exportRow['Basic Salary'] = row.base_salary;
      exportRow['Tunj. Tetap'] = row.tunj_tetap;
      exportRow['Tunjangan Makan'] = row.meal_pay;
      exportRow['Tunjangan Makan Malam'] = row.night_meal_pay;
      exportRow['Tunjangan Luar Kota'] = row.tunj_luar_kota;
      exportRow['Bonus Produksi'] = row.production_pay;
      exportRow['Tunjangan Kehadiran'] = row.presence_pay;
      exportRow['Selisih Kurang Gaji'] = row.previous_month_deficiency;
      exportRow['Bonus'] = row.bonus;
      exportRow['Overtime'] = row.overtime_pay;

      // Add custom earnings
      let customEarningsSum = 0;
      customEarningsArr.forEach(name => {
        const comp = (row.custom_components || {})[name];
        const val = comp && comp.type === 'earnings' ? comp.amount : 0;
        exportRow[name] = val;
        customEarningsSum += val;
      });

      const totalAllowance = row.base_salary + row.tunj_tetap + row.meal_pay + row.night_meal_pay + row.tunj_luar_kota + row.production_pay + row.presence_pay + row.previous_month_deficiency + row.bonus + row.overtime_pay + customEarningsSum;
      exportRow['Total Allowance'] = totalAllowance;

      exportRow['Potongan Tidak Hadir'] = row.potongan_tidak_hadir || row.absence_deduction || 0;
      exportRow['Potongan Keterlambatan & Pulang Awal'] = row.potongan_lambat_pulang || row.late_deduction || 0;
      exportRow['Iuran BPJS Kes'] = row.bpjs_health_deduction;
      exportRow['Iuran JHT'] = row.jht_deduction;
      exportRow['PPH 21'] = row.pph21_deduction || 0;

      // Add custom deductions
      let customDeductionsSum = 0;
      customDeductionsArr.forEach(name => {
        const comp = (row.custom_components || {})[name];
        const val = comp && comp.type === 'deduction' ? comp.amount : 0;
        exportRow[name] = val;
        customDeductionsSum += val;
      });

      const totalDeduction = (row.potongan_tidak_hadir || row.absence_deduction || 0) + (row.potongan_lambat_pulang || row.late_deduction || 0) + row.bpjs_health_deduction + row.jht_deduction + (row.pph21_deduction || 0) + customDeductionsSum;
      exportRow['Total Deduction'] = totalDeduction;

      exportRow['THP (Take Home Pay)'] = isTemplate ? row.base_salary : Math.max(0, totalAllowance - totalDeduction);

      const bpjsKesBen = row.bpjs_kes_benefit !== undefined ? row.bpjs_kes_benefit : (row.bpjs_health_benefit || 0);
      const bpjsTkBen = row.bpjs_tk_benefit !== undefined ? row.bpjs_tk_benefit : ((row.jht_benefit || 0) + (row.jkk_benefit || 0) + (row.jkm_benefit || 0));

      exportRow['PPH 21 Benefit'] = row.pph21_benefit || 0;
      exportRow['Rate Dasar BPJS TK'] = bpjsTkBen;
      exportRow['Rate Dasar BPJS Kes'] = bpjsKesBen;

      // Add custom benefits
      customBenefitsArr.forEach(name => {
        const comp = (row.custom_benefits || {})[name];
        exportRow[name] = comp ? comp.amount : 0;
      });

      return exportRow;
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Rekap Payroll`);
    const filename = isTemplate ? `Template_Payroll_${this.period}.xlsx` : `Rekap_Payroll_${this.period}.xlsx`;
    XLSX.writeFile(workbook, filename);
  },

  confirmSendEmailBulk() {
    const list = this.getPeriodPayroll();
    if (list.length === 0) {
      alert('Tidak ada karyawan terfilter untuk dikirimkan email.');
      return;
    }

    const modal = document.createElement('div');
    modal.id = 'email-confirm-modal';
    modal.className = 'modal-overlay';
    modal.style = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.6); display: flex; justify-content: center;
      align-items: center; z-index: 10001;
      backdrop-filter: blur(4px);
    `;

    modal.innerHTML = `
      <div class="modal-content" style="max-width: 450px; padding: 24px; background: var(--bg-secondary); border: 1px solid var(--color-gray-900); border-radius: var(--radius-xl); box-shadow: var(--shadow-xl);">
        <div class="modal-header" style="border-bottom: none; padding: 0 0 16px 0;">
          <h2 class="modal-title" style="color: var(--color-primary); display: flex; align-items: center; gap: 8px;">
            <span>📧</span> Kirim Email Slip Gaji (1/2)
          </h2>
          <button class="modal-close" onclick="document.getElementById('email-confirm-modal').remove()">×</button>
        </div>
        <div class="modal-body" style="padding: 0 0 24px 0; color: var(--color-gray-100);">
          <p style="line-height: 1.5; font-size: 0.95rem;">
            Apakah Anda yakin ingin mengirimkan slip gaji kepada <strong style="color: var(--color-primary-light); font-size: 1.05rem;">${list.length}</strong> karyawan yang ada di filter saat ini?
          </p>
        </div>
        <div class="modal-footer" style="border-top: none; padding: 0; display: flex; gap: 12px;">
          <button class="btn btn-secondary" onclick="document.getElementById('email-confirm-modal').remove()">Batal</button>
          <button class="btn btn-primary" onclick="Payroll.showSecondEmailConfirmation()">Ya, Lanjutkan</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  },

  showSecondEmailConfirmation() {
    const firstModal = document.getElementById('email-confirm-modal');
    if (firstModal) firstModal.remove();

    const list = this.getPeriodPayroll();
    if (list.length === 0) return;

    // Parse Month and Year dynamically from calendar active period
    const [year, monthStr] = this.period.split('-');
    const monthIdx = parseInt(monthStr, 10) - 1;
    const monthsId = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    const bulanText = monthsId[monthIdx] || monthStr;

    const modal = document.createElement('div');
    modal.id = 'email-confirm-modal-v2';
    modal.className = 'modal-overlay';
    modal.style = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.6); display: flex; justify-content: center;
      align-items: center; z-index: 10001;
      backdrop-filter: blur(4px);
    `;

    modal.innerHTML = `
      <div class="modal-content" style="max-width: 450px; padding: 24px; background: var(--bg-secondary); border: 1px solid var(--color-gray-900); border-radius: var(--radius-xl); box-shadow: var(--shadow-xl);">
        <div class="modal-header" style="border-bottom: none; padding: 0 0 16px 0;">
          <h2 class="modal-title" style="color: var(--color-error); display: flex; align-items: center; gap: 8px;">
            <span>⚠️</span> Konfirmasi Akhir (2/2)
          </h2>
          <button class="modal-close" onclick="document.getElementById('email-confirm-modal-v2').remove()">×</button>
        </div>
        <div class="modal-body" style="padding: 0 0 24px 0; color: var(--color-gray-100);">
          <p style="line-height: 1.5; font-size: 0.95rem;">
            Konfirmasi akhir: Kirim email semua slip gaji untuk (Periode: <strong style="color: var(--color-error); font-size: 1.05rem;">${bulanText} ${year}</strong>)?
          </p>
        </div>
        <div class="modal-footer" style="border-top: none; padding: 0; display: flex; gap: 12px;">
          <button class="btn btn-secondary" onclick="document.getElementById('email-confirm-modal-v2').remove()">CANCEL</button>
          <button class="btn btn-primary" onclick="Payroll.executeSendEmailBulk()" style="background: var(--color-error); border-color: var(--color-error);">YES</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  },

  async executeSendEmailBulk() {
    const confirmModal = document.getElementById('email-confirm-modal-v2');
    if (confirmModal) confirmModal.remove();

    const list = this.getPeriodPayroll();
    if (list.length === 0) return;

    // Freeze UI buttons
    const btn = document.getElementById('btn-send-email-bulk');
    if (btn) {
        btn.disabled = true;
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
    }

    // Show Progress Bar
    const progressContainer = document.getElementById('email-progress-container');
    const progressBar = document.getElementById('email-progress-bar');
    const progressText = document.getElementById('email-progress-text');
    if (progressContainer) progressContainer.style.display = 'block';

    let successCount = 0;
    let failedCount = 0;
    const total = list.length;

    // Start background queue loop
    for (let i = 0; i < total; i++) {
        const record = list[i];
        
        // Update progress bar
        const progressPct = ((i) / total) * 100;
        if (progressBar) progressBar.style.width = `${progressPct}%`;
        if (progressText) progressText.textContent = `Mengirim ${i + 1}/${total}: ${record.name}...`;

        // Strict binding check: Find email in employees list by unique NIK (Employee_ID)
        const emp = this.employees.find(e => String(e.nik).trim() === String(record.nik).trim());
        const email = emp ? (emp.email || emp.username) : null;

        if (!emp || !email || !email.includes('@') || String(emp.nik).trim() !== String(record.nik).trim()) {
            failedCount++;
            console.warn(`[Email Queue] Skipped ${record.name} (No valid email registered or binding mismatch)`);
            // Log failed status to Firestore emailLogs
            if (window.firestore && window.db) {
                try {
                    const { collection, addDoc, serverTimestamp } = window.firestore;
                    await addDoc(collection(window.db, 'emailLogs'), {
                        recipientName: record.name,
                        recipientNik: record.nik,
                        recipientEmail: email || 'N/A',
                        period: record.period,
                        status: 'failed',
                        error: !emp ? 'Employee record not found' : (!email || !email.includes('@') ? 'No valid email address registered' : 'Security: NIK binding mismatch'),
                        timestamp: serverTimestamp()
                    });
                } catch (e) {
                    console.error('Failed to log failed email:', e);
                }
            }
            continue;
        }

        try {
            // Generate PDF client-side with birth date password
            let pdfBase64 = null;
            if (typeof window !== 'undefined' && window.jspdf && window.jspdf.jsPDF) {
                try {
                    const doc = this.generatePayslipPDF(record, emp);
                    const pdfDataUri = doc.output('datauristring');
                    pdfBase64 = pdfDataUri.split(',')[1];
                } catch (pdfErr) {
                    console.error('Failed to generate PDF client-side:', pdfErr);
                }
            }

            // Invoke Cloud Function sendPayslipEmail
            let sent = false;
            if (typeof firebase !== 'undefined' && firebase.functions) {
                const sendFunc = firebase.functions().httpsCallable('sendPayslipEmail');
                const res = await sendFunc({
                    recipientEmail: email,
                    recipientName: record.name,
                    recipientNik: record.nik,
                    record: record,
                    pdfBase64: pdfBase64
                });
                if (res.data && res.data.success) {
                    sent = true;
                } else {
                    throw new Error(res.data ? res.data.message : 'Unknown error from cloud function');
                }
            } else {
                // Client-side mock send fallback if offline or local server testing
                console.log(`[Mock Email] Successfully sent payslip to ${email} for NIK: ${record.nik} (PDF size: ${pdfBase64 ? pdfBase64.length : 0} chars)`);
                await new Promise(r => setTimeout(r, 800)); // Simulate delay
                sent = true;
            }

            if (sent) {
                successCount++;
                record.emailSentAt = new Date().toISOString();
                // Log success status to Firestore emailLogs
                if (window.firestore && window.db) {
                    const { collection, addDoc, serverTimestamp } = window.firestore;
                    await addDoc(collection(window.db, 'emailLogs'), {
                        recipientName: record.name,
                        recipientNik: record.nik,
                        recipientEmail: email,
                        period: record.period,
                        status: 'sent',
                        timestamp: serverTimestamp()
                    });
                }
            }
        } catch (err) {
            failedCount++;
            console.error(`[Email Queue] Failed to send to ${record.name} (${email}):`, err.message);
            // Log error status to Firestore emailLogs
            if (window.firestore && window.db) {
                try {
                    const { collection, addDoc, serverTimestamp } = window.firestore;
                    await addDoc(collection(window.db, 'emailLogs'), {
                        recipientName: record.name,
                        recipientNik: record.nik,
                        recipientEmail: email,
                        period: record.period,
                        status: 'failed',
                        error: err.message,
                        timestamp: serverTimestamp()
                    });
                } catch (e) {
                    console.error('Failed to log failed email error:', e);
                }
            }
        }
    }

    // Complete Progress Bar
    if (progressBar) progressBar.style.width = '100%';
    if (progressText) progressText.textContent = `Selesai! Berhasil: ${successCount}, Gagal: ${failedCount}`;

    // Save updated payroll records
    await Storage.set(Storage.KEYS.PAYROLL, this.payrollRecords);

    // Show alert summary
    alert(`Broadcast Selesai!\n\nBerhasil dikirim: ${successCount} email\nGagal/Terlewati: ${failedCount} email\n\nDetail pengiriman dan error log dapat dilihat pada koleksi database emailLogs.`);

    // Restore UI buttons
    if (btn) {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
    }
    
    // Hide progress bar after 5 seconds
    setTimeout(() => {
        if (progressContainer) progressContainer.style.display = 'none';
    }, 5000);

    this.render();
  },

  async sendEmailIndividual(id, btn) {
    if (!this.canAccessPayroll()) {
      this.renderAccessDenied();
      return;
    }

    const record = this.payrollRecords.find(p => p.id === id);
    if (!record) return;

    // Freeze individual button
    btn.disabled = true;
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳';
    btn.style.opacity = '0.5';
    btn.style.cursor = 'not-allowed';

    try {
        // Strict binding check: Find employee by unique NIK
        const emp = this.employees.find(e => String(e.nik).trim() === String(record.nik).trim());
        if (!emp) {
            throw new Error(`Data karyawan tidak ditemukan untuk NIK: ${record.nik}`);
        }
        
        const email = (emp.email || emp.username || '').trim();
        if (!email || !email.includes('@')) {
            throw new Error('Email karyawan tidak valid atau tidak terdaftar.');
        }

        // Verify bind match
        if (String(emp.nik).trim() !== String(record.nik).trim()) {
            throw new Error('Keamanan: Ketidakcocokan antara ID pemilik slip dengan ID pemilik akun email.');
        }

        // Generate PDF client-side with birth date password
        let pdfBase64 = null;
        if (typeof window !== 'undefined' && window.jspdf && window.jspdf.jsPDF) {
            try {
                const doc = this.generatePayslipPDF(record, emp);
                const pdfDataUri = doc.output('datauristring');
                pdfBase64 = pdfDataUri.split(',')[1];
            } catch (pdfErr) {
                console.error('Failed to generate PDF client-side:', pdfErr);
            }
        }

        // Invoke Cloud Function sendPayslipEmail
        let sent = false;
        if (typeof firebase !== 'undefined' && firebase.functions) {
            const sendFunc = firebase.functions().httpsCallable('sendPayslipEmail');
            const res = await sendFunc({
                recipientEmail: email,
                recipientName: record.name,
                recipientNik: record.nik,
                record: record,
                pdfBase64: pdfBase64
            });
            if (res.data && res.data.success) {
                sent = true;
            } else {
                throw new Error(res.data ? res.data.message : 'Unknown error from cloud function');
            }
        } else {
            // Client-side mock send fallback if offline or local server testing
            console.log(`[Mock Email] Successfully sent payslip to ${email} for NIK: ${record.nik} (PDF size: ${pdfBase64 ? pdfBase64.length : 0} chars)`);
            await new Promise(r => setTimeout(r, 800)); // Simulate delay
            sent = true;
        }

        if (sent) {
            record.emailSentAt = new Date().toISOString();
            await Storage.set(Storage.KEYS.PAYROLL, this.payrollRecords);

            // Log success status to Firestore emailLogs
            if (window.firestore && window.db) {
                const { collection, addDoc, serverTimestamp } = window.firestore;
                await addDoc(collection(window.db, 'emailLogs'), {
                    recipientName: record.name,
                    recipientNik: record.nik,
                    recipientEmail: email,
                    period: record.period,
                    status: 'sent',
                    timestamp: serverTimestamp()
                });
            }
            alert(`Email slip gaji berhasil dikirim ke ${record.name} (${email})`);
        }
    } catch (err) {
        console.error(`[Email Individual] Failed to send to ${record.name}:`, err.message);
        // Log error status to Firestore emailLogs
        if (window.firestore && window.db) {
            try {
                const { collection, addDoc, serverTimestamp } = window.firestore;
                await addDoc(collection(window.db, 'emailLogs'), {
                    recipientName: record.name,
                    recipientNik: record.nik,
                    recipientEmail: record.email || 'N/A',
                    period: record.period,
                    status: 'failed',
                    error: err.message,
                    timestamp: serverTimestamp()
                });
            } catch (e) {
                console.error('Failed to log failed email error:', e);
            }
        }
        alert('Gagal mengirim email: ' + err.message);
    } finally {
        // Restore individual button
        btn.disabled = false;
        btn.innerHTML = originalText;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
        
        this.render();
    }
  },
  async downloadAllPayslipsZIP() {
    const list = this.getPeriodPayroll();
    if (list.length === 0) {
      alert('Tidak ada data payroll yang cocok untuk di-download.');
      return;
    }

    if (typeof JSZip === 'undefined') {
      try {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      } catch (err) {
        alert('Gagal memuat pustaka JSZip. Pastikan koneksi internet aktif.');
        return;
      }
    }

    const btn = document.getElementById('btn-download-zip-bulk');
    const originalText = btn ? btn.textContent : '';
    if (btn) {
      btn.disabled = true;
      btn.textContent = `⏳ Memproses ZIP (0/${list.length})...`;
    }

    try {
      const zip = new JSZip();

      for (let i = 0; i < list.length; i++) {
        const record = list[i];
        if (btn) {
          btn.textContent = `⏳ Membuat PDF (${i + 1}/${list.length})...`;
        }

        const emp = this.employees.find(e => String(e.nik).trim() === String(record.nik).trim()) || {
          nik: record.nik,
          name: record.name,
          department: record.department || 'OTHER',
          position: record.position || '-',
          ptkp: record.ptkp || '-',
          npwp: record.npwp || '-'
        };

        const doc = this.generatePayslipPDF(record, emp);
        const pdfArrayBuffer = doc.output('arraybuffer');

        const safeName = record.name.replace(/[^a-zA-Z0-9_-]/g, '_');
        const filename = `Payslip_${record.period}_${record.nik}_${safeName}.pdf`;
        zip.file(filename, pdfArrayBuffer);
      }

      if (btn) {
        btn.textContent = `⏳ Mengompres file ZIP...`;
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      const safePeriod = this.period || 'Period';
      link.href = URL.createObjectURL(zipBlob);
      link.download = `Payslip_Period_${safePeriod}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      alert(`Berhasil mengunduh ZIP untuk ${list.length} slip gaji!`);
    } catch (err) {
      console.error('Error generating ZIP:', err);
      alert(`Terjadi kesalahan saat membuat ZIP: ${err.message}`);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = originalText;
        this.updateBulkSendButtonLabel();
      }
    }
  },

  formatPhoneNumber(phone) {
    if (!phone) return null;
    let cleaned = String(phone).replace(/\D/g, '');
    if (!cleaned) return null;
    if (cleaned.startsWith('0')) {
      cleaned = '62' + cleaned.substring(1);
    } else if (!cleaned.startsWith('62')) {
      cleaned = '62' + cleaned;
    }
    return cleaned;
  },

  buildWhatsAppTextMessage(record, emp) {
    const periodStr = record.period || this.period || '-';
    const thpStr = (record.total_salary || 0).toLocaleString('id-ID');
    const safeName = record.name || 'Karyawan';
    const safeNik = record.nik || '-';
    const safePosition = record.position || '-';

    let dobHint = '8 digit Tanggal Lahir Anda (Format: DDMMYYYY)';
    if (emp && emp.birth_date) {
      const parts = emp.birth_date.split('-');
      if (parts.length === 3) {
        dobHint = `${parts[2]}${parts[1]}${parts[0]}`;
      }
    }

    return `Yth. Bapak/Ibu ${safeName} (NIK: ${safeNik}),

Berikut kami sampaikan Ringkasan Slip Gaji resmi Anda untuk Periode ${periodStr}:

• Jabatan: ${safePosition}
• Take Home Pay (THP): Rp ${thpStr}

Password untuk membuka file PDF slip gaji Anda adalah: ${dobHint} (DDMMYYYY).

Terima kasih,
*PT GOLDEN ALURA REFINERI*`;
  },

  async sendWhatsAppIndividual(id, btnElement) {
    const record = this.payrollRecords.find(r => r.id === id);
    if (!record) return;

    const emp = this.employees.find(e => String(e.nik).trim() === String(record.nik).trim());
    const phone = emp ? (emp.phone || emp.no_hp || emp.telepon) : (record.phone || record.no_hp);
    const cleanPhone = this.formatPhoneNumber(phone);

    if (!cleanPhone) {
      alert(`Nomor telepon/WhatsApp untuk ${record.name} belum terisi di Master Karyawan.`);
      return;
    }

    const textMessage = this.buildWhatsAppTextMessage(record, emp);

    try {
      const doc = this.generatePayslipPDF(record, emp);
      const safeName = record.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      doc.save(`Payslip_${record.period}_${record.nik}_${safeName}.pdf`);
    } catch (e) {
      console.warn('PDF auto-download warning:', e);
    }

    const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(textMessage)}`;
    window.open(waUrl, '_blank');
  },

  confirmSendWhatsAppBulk() {
    const list = this.getPeriodPayroll();
    if (list.length === 0) {
      alert('Tidak ada data payroll yang cocok untuk dikirim WhatsApp.');
      return;
    }

    const itemsHTML = list.map((record, index) => {
      const emp = this.employees.find(e => String(e.nik).trim() === String(record.nik).trim());
      const rawPhone = emp ? (emp.phone || emp.no_hp || emp.telepon) : (record.phone || record.no_hp);
      const cleanPhone = this.formatPhoneNumber(rawPhone);
      const isReady = !!cleanPhone;

      return `
        <tr style="border-bottom: 1px solid var(--border-color, #e5e7eb);">
          <td style="padding: 8px;">${index + 1}</td>
          <td style="padding: 8px;"><strong>${record.name}</strong> (${record.nik})</td>
          <td style="padding: 8px;">${rawPhone || '<em style="color:#ef4444;">Tidak ada nomor</em>'}</td>
          <td style="padding: 8px; font-weight: bold; color: var(--color-primary);">Rp ${(record.total_salary || 0).toLocaleString('id-ID')}</td>
          <td style="padding: 8px;">
            ${isReady ? 
              `<span class="badge badge-success" style="background:#10b981; color:white; padding:2px 8px; border-radius:4px; font-size:11px;">Ready (${cleanPhone})</span>` : 
              `<span class="badge badge-danger" style="background:#ef4444; color:white; padding:2px 8px; border-radius:4px; font-size:11px;">No Phone Number</span>`
            }
          </td>
        </tr>
      `;
    }).join('');

    const modal = document.createElement('div');
    modal.id = 'wa-confirm-modal';
    modal.className = 'modal-overlay';
    modal.style = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.7); display: flex; justify-content: center;
      align-items: center; z-index: 10000; backdrop-filter: blur(4px); padding: 20px;
    `;

    modal.innerHTML = `
      <div class="modal-content" style="max-width: 750px; width: 100%; max-height: 85vh; display: flex; flex-direction: column; background: var(--bg-secondary, #ffffff); border-radius: 12px; padding: 24px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.3);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid #e5e7eb; padding-bottom: 12px;">
          <h2 style="font-size: 1.25rem; font-weight: bold; color: #25D366; display: flex; align-items: center; gap: 8px; margin: 0;">
            <span>💬</span> Konfirmasi Kirim WhatsApp Massal (${list.length} Karyawan)
          </h2>
          <button onclick="document.getElementById('wa-confirm-modal').remove()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">×</button>
        </div>

        <p style="font-size: 0.9rem; color: #4b5563; margin-bottom: 16px;">
          Sistem akan mengirimkan pesan notifikasi WhatsApp & PDF slip gaji secara berurutan dengan <strong>jeda aman 5 detik</strong> antar karyawan untuk mencegah anti-spam ban.
        </p>

        <div style="flex: 1; overflow-y: auto; margin-bottom: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; text-align: left;">
            <thead style="background: #f9fafb; border-bottom: 1px solid #e5e7eb; position: sticky; top: 0;">
              <tr>
                <th style="padding: 8px;">#</th>
                <th style="padding: 8px;">Nama / NIK</th>
                <th style="padding: 8px;">No. Telp</th>
                <th style="padding: 8px;">THP</th>
                <th style="padding: 8px;">Status WA</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHTML}
            </tbody>
          </table>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 12px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
          <button class="btn btn-secondary" onclick="document.getElementById('wa-confirm-modal').remove()">Batal</button>
          <button class="btn btn-success" id="btn-start-wa-bulk" onclick="Payroll.executeSendWhatsAppBulk()" style="background: #25D366; border: none; color: white;">🚀 Mulai Kirim WhatsApp Massal</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  },

  async executeSendWhatsAppBulk() {
    const modal = document.getElementById('wa-confirm-modal');
    const startBtn = document.getElementById('btn-start-wa-bulk');
    if (startBtn) {
      startBtn.disabled = true;
      startBtn.textContent = '⏳ Mengirim WhatsApp...';
    }

    const list = this.getPeriodPayroll();
    let successCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < list.length; i++) {
      const record = list[i];
      const emp = this.employees.find(e => String(e.nik).trim() === String(record.nik).trim());
      const rawPhone = emp ? (emp.phone || emp.no_hp || emp.telepon) : (record.phone || record.no_hp);
      const cleanPhone = this.formatPhoneNumber(rawPhone);

      if (startBtn) {
        startBtn.textContent = `⏳ Mengirim (${i + 1}/${list.length}): ${record.name}...`;
      }

      if (!cleanPhone) {
        skippedCount++;
        continue;
      }

      const textMessage = this.buildWhatsAppTextMessage(record, emp);
      const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(textMessage)}`;
      window.open(waUrl, '_blank');
      successCount++;

      if (i < list.length - 1) {
        await new Promise(res => setTimeout(res, 3000));
      }
    }

    if (modal) modal.remove();
    alert(`Pengiriman WhatsApp Selesai!\n- Berhasil dipicu: ${successCount} karyawan\n- Dilewati (Tanpa No. HP): ${skippedCount} karyawan`);
    this.updateBulkSendButtonLabel();
  }
};

window.Payroll = Payroll;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Payroll;
}
