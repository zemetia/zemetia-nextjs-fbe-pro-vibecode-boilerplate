// ==========================================
// Attendance Module
// Kelola Absensi Karyawan (Import from Face Recognition)
// ==========================================

const Attendance = {
  activePeriod: '', // YYYY-MM
  records: [],
  employees: [],

  async init() {
    this.activePeriod = new Date().toISOString().substring(0, 7);
    await this.loadData();
    this.render();
  },

  getPeriodCutoffRange(periodStr) {
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

    const dates = [];
    let curr = new Date(startDateStr + 'T12:00:00');
    const end = new Date(endDateStr + 'T12:00:00');
    while (curr <= end) {
      dates.push(curr.toISOString().substring(0, 10));
      curr.setDate(curr.getDate() + 1);
    }
    return { startDateStr, endDateStr, dates };
  },

  async loadData() {
    this.employees = Storage.getEmployees();
    this.records = Storage.getAttendance();
  },

  render() {
    const content = document.getElementById('main-content');
    content.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">📅 Absensi Karyawan</h1>
        <p class="page-description">Kelola data kehadiran untuk perhitungan Payroll</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">1. Pilih Periode</h2>
          </div>
          <div class="card-body">
            <input type="month" id="period-selector" class="form-input" value="${this.activePeriod}" onchange="Attendance.setPeriod(this.value)">
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h2 class="card-title">2. Import Data</h2>
          </div>
          <div class="card-body">
            <div class="flex flex-col gap-2">
              <input type="file" id="attendance-file" class="hidden" accept=".csv,.xlsx,.xls" onchange="Attendance.handleFileUpload(this)">
              <button class="btn btn-primary" onclick="document.getElementById('attendance-file').click()">
                📥 Upload Excel/CSV Face Recognition
              </button>
              <button class="btn btn-dark" onclick="Attendance.syncFromHardware()">
                🔌 Sync dari Mesin Solution X802
              </button>
              <p class="text-gray small">Support: NIK, Nama, Hari Kerja, Jam Lembur</p>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h2 class="card-title">3. Status</h2>
          </div>
          <div class="card-body">
            <div id="sync-status">
               <span class="badge badge-info">${this.getFilteredRecords().length} Data Terisi untuk ${this.activePeriod}</span>
            </div>
            <div class="mt-3">
              <button class="btn btn-sm btn-outline" onclick="Attendance.viewRawLogs()">🔍 Lihat Log Mentah Mesin</button>
              <div id="raw-logs-container" class="mt-2" style="font-size: 0.8rem; max-height: 150px; overflow-y: auto; background: var(--bg-secondary); padding: 5px; border-radius: 4px; display: none;"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header flex justify-between align-center">
          <h2 class="card-title">Rekap Kehadiran - ${this.activePeriod}</h2>
          <div class="flex gap-2">
            <button class="btn btn-sm btn-outline" onclick="Attendance.exportToExcel()">📄 Export Excel</button>
            <button class="btn btn-sm btn-success" onclick="Attendance.saveAll()">💾 Simpan Semua</button>
          </div>
        </div>
        <div class="card-body">
          <div id="attendance-table-container">
            ${this.renderTable()}
          </div>
        </div>
      </div>
    `;
  },

  setPeriod(period) {
    this.activePeriod = period;
    this.render();
  },

  getEligibleEmployees(cutoffStartStr, cutoffEndStr) {
    const startStr = cutoffStartStr || this.getPeriodCutoffRange(this.activePeriod).startDateStr;
    const endStr = cutoffEndStr || this.getPeriodCutoffRange(this.activePeriod).endDateStr;

    return this.employees.filter(emp => {
      const isPastOrCurrentJoin = !emp.start_date || emp.start_date <= endStr;
      if (!isPastOrCurrentJoin) return false;

      const isInactive = emp.status === 'NON-AKTIF' || emp.status === 'non_active' || emp.status === 'inactive';
      const resDate = emp.resignation_date || emp.resign_date;

      if (!isInactive) {
        return true;
      }
      // If inactive, include if resignation date falls within or after cutoff start
      if (isInactive && resDate && resDate >= startStr) {
        return true;
      }
      return false;
    });
  },

  getFilteredRecords() {
    return this.records.filter(r => r.period === this.activePeriod);
  },

  renderTable() {
    const filtered = this.getFilteredRecords();
    const cutoff = this.getPeriodCutoffRange(this.activePeriod);
    const eligibleEmployees = this.getEligibleEmployees(cutoff.startDateStr, cutoff.endDateStr);

    // Combine eligible employees with attendance records
    const tableData = eligibleEmployees.map(emp => {
      const record = filtered.find(r => String(r.nik) === String(emp.nik)) || {
        nik: emp.nik,
        name: emp.name,
        period: this.activePeriod,
        work_days: 0,
        overtime_hours: 0,
        late_minutes: 0,
        production_grams: 0,
        is_manual: false
      };
      return record;
    });

    if (tableData.length === 0) return '<p class="text-center text-gray">Belum ada data karyawan aktif untuk periode cut-off ini.</p>';

    return `
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>NIK</th>
              <th>Nama</th>
              <th width="100">Work (Days)</th>
              <th width="100">Overtime (Hours)</th>
              <th width="100">Night (Days)</th>
              <th width="100">Red Day Work</th>
              <th width="100">Late (Count)</th>
              <th width="100">Absence (Days)</th>
              <th width="100">Half-Day (Count)</th>
              <th>Status</th>
              <th width="80">Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${tableData.map(row => {
              const hasWarning = row.missing_taps > 0;
              const rowStyle = hasWarning ? 'background-color: rgba(255, 193, 7, 0.2);' : '';
              const warningBadge = hasWarning ? `<br><span class="badge badge-warning" style="font-size:0.6rem; cursor:help; margin-top:4px; display:inline-block;" title="Ada ${row.missing_taps} hari dengan 1x tap saja (lupa absen pulang).">⚠️ Lupa Absen (${row.missing_taps})</span>` : '';
              
              const leaveBadges = (row.leave_records && row.leave_records.length > 0)
                ? `<div style="margin-top: 4px; display: flex; gap: 4px; flex-wrap: wrap;">${row.leave_records.map(l => `<span class="badge badge-info" style="font-size: 9px; padding: 1px 4px;" title="${l.dateFrom}: ${l.notes || l.type}">${l.isPartial ? '⏱️ ' + (l.partialTime || 'Dispensasi') : '🏖️ ' + l.type}</span>`).join('')}</div>`
                : '';

              return `
              <tr style="${rowStyle}">
                <td>
                  <span class="badge badge-secondary">${row.nik}</span>
                  ${warningBadge}
                </td>
                <td>
                  <strong>${row.name}</strong>
                  ${leaveBadges}
                </td>
                <td>
                  <input type="number" class="form-input text-center" value="${row.work_days}" 
                         onchange="Attendance.updateCell('${row.nik}', 'work_days', this.value)">
                </td>
                <td>
                  <input type="number" class="form-input text-center" value="${row.overtime_hours}"
                         onchange="Attendance.updateCell('${row.nik}', 'overtime_hours', this.value)">
                </td>
                <td>
                  <input type="number" class="form-input text-center" value="${row.night_days || 0}"
                         onchange="Attendance.updateCell('${row.nik}', 'night_days', this.value)">
                </td>
                <td>
                  <input type="number" class="form-input text-center" value="${row.extra_days || 0}"
                         title="Days worked on Sundays or National Holidays"
                         onchange="Attendance.updateCell('${row.nik}', 'extra_days', this.value)">
                </td>
                <td>
                  <input type="number" class="form-input text-center" value="${row.late_count || 0}"
                         onchange="Attendance.updateCell('${row.nik}', 'late_count', this.value)">
                </td>
                <td>
                  <input type="number" class="form-input text-center" value="${row.absence_days || 0}"
                         onchange="Attendance.updateCell('${row.nik}', 'absence_days', this.value)">
                </td>
                <td>
                  <input type="number" class="form-input text-center" value="${row.half_day_izin || 0}"
                         onchange="Attendance.updateCell('${row.nik}', 'half_day_izin', this.value)">
                </td>
                <td>
                  ${row.is_manual ? '<span class="badge badge-warning">Manual</span>' : '<span class="badge badge-success">Import</span>'}
                </td>
                <td>
                  <div class="flex gap-1">
                    <button class="btn btn-sm btn-info" onclick="Attendance.showDailyDetail('${row.nik}')" title="Detail Harian per Shift">🕙 Shift</button>
                    <button class="btn btn-sm btn-dark" onclick="Attendance.viewHardwareLogs('${row.nik}')" title="Lihat Log Mesin Asli">📟 Log</button>
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

  updateCell(nik, field, value) {
    let recordIndex = this.records.findIndex(r => String(r.nik) === String(nik) && r.period === this.activePeriod);

    if (recordIndex === -1) {
      const emp = this.employees.find(e => String(e.nik) === String(nik));
      this.records.push({
        id: `ATD-${this.activePeriod}-${nik}`,
        nik: nik,
        name: emp ? emp.name : 'Unknown',
        period: this.activePeriod,
        work_days: 0,
        overtime_hours: 0,
        night_days: 0,
        extra_days: 0,
        late_count: 0,
        absence_days: 0,
        half_day_izin: 0,
        production_grams: 0,
        is_manual: true
      });
      recordIndex = this.records.length - 1;
    }

    this.records[recordIndex][field] = parseFloat(value) || 0;
    this.records[recordIndex].is_manual = true;

    // Don't re-render everything to avoid losing focus, just update local data
    console.log(`Updated ${nik} ${field} to ${value}`);
  },

  async handleFileUpload(input) {
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];

    try {
      if (typeof XLSX === 'undefined') {
        alert('⚠️ Library XLSX belum dimuat. Silakan periksa koneksi.');
        return;
      }

      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

      if (jsonData.length === 0) {
        alert("⚠️ File Kosong atau format tidak dikenali.");
        return;
      }

      const batchId = `BATCH-IMP-${Date.now()}`;
      const importedLogs = [];
      let dateRangeStart = "";
      let dateRangeEnd = "";

      jsonData.forEach((row) => {
        const nik = String(
          row.NIK || row["No. Induk"] || row["Employee ID"] || row.ID || row.PIN || row["Id Karyawan"] || ""
        ).trim();
        if (!nik) return;

        let dateStr = String(row.Date || row.Tanggal || row.Tgl || row["Hari/Tgl"] || "").trim();
        if (dateStr.includes("/")) {
          const parts = dateStr.split("/");
          if (parts.length === 3) {
            if (parts[0].length === 4) {
              dateStr = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
            } else {
              dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
          }
        }
        if (!dateStr || dateStr.length < 10) return;

        if (!dateRangeStart || dateStr < dateRangeStart) dateRangeStart = dateStr;
        if (!dateRangeEnd || dateStr > dateRangeEnd) dateRangeEnd = dateStr;

        const shiftName = String(row.Shift || row["Jam Shift"] || "Regular").trim();
        let shiftStartStr = "08:30"; // Default Mon-Fri
        const dayOfWeek = new Date(dateStr + "T12:00:00").getDay();
        if (dayOfWeek === 6) shiftStartStr = "08:00"; // Saturday default

        if (row["Shift Start"] || row["Jam Masuk Scheduled"]) {
          shiftStartStr = String(row["Shift Start"] || row["Jam Masuk Scheduled"]).trim().substring(0, 5);
        }

        const clockIn = String(row["Clock In"] || row["Clock-In"] || row.Masuk || row["Jam Masuk"] || row.In || "").trim();
        const clockOut = String(row["Clock Out"] || row["Clock-Out"] || row.Keluar || row["Jam Keluar"] || row.Out || "").trim();
        const statusField = String(row.Status || row.H || row.Kehadiran || "H").trim();

        // Map presence indicator strictly to code "H"
        const isPresent = (clockIn || clockOut || statusField.toUpperCase() === "H");

        if (clockIn && isPresent) {
          const penaltyCalc = Storage.calculateLatePenalty ? Storage.calculateLatePenalty(clockIn, shiftStartStr, 5000000, dateStr) : { isLate: false, penalty: 0, tier: 0 };
          importedLogs.push({
            batchId,
            nik,
            name: String(row.Name || row.Nama || row["Nama Karyawan"] || "").trim(),
            date: dateStr,
            time: clockIn.substring(0, 5),
            timestamp: `${dateStr} ${clockIn.length === 5 ? clockIn + ':00' : clockIn}`,
            status: "IN",
            source: "IMPORT_EXCEL",
            batchName: file.name,
            shift: shiftName,
            is_manual: false,
            ruleEvaluated: true,
            isLate: penaltyCalc.isLate,
            latePenalty: penaltyCalc.penalty,
            penaltyTier: penaltyCalc.tier,
            imported_at: new Date().toISOString()
          });
        }

        if (clockOut && isPresent) {
          importedLogs.push({
            batchId,
            nik,
            name: String(row.Name || row.Nama || row["Nama Karyawan"] || "").trim(),
            date: dateStr,
            time: clockOut.substring(0, 5),
            timestamp: `${dateStr} ${clockOut.length === 5 ? clockOut + ':00' : clockOut}`,
            status: "OUT",
            source: "IMPORT_EXCEL",
            batchName: file.name,
            shift: shiftName,
            is_manual: false,
            imported_at: new Date().toISOString()
          });
        }
      });

      if (importedLogs.length === 0) {
        alert("⚠️ Tidak ada data absensi valid di file.");
        return;
      }

      // Save raw overrides locally
      const localOverrides = Storage.get('erp_attendance_raw_overrides') || [];
      const updatedLogs = [...localOverrides, ...importedLogs];
      await Storage.set('erp_attendance_raw_overrides', updatedLogs);

      // Save batch record
      const batchRecord = {
        batchId,
        filename: file.name,
        importedAt: new Date().toISOString(),
        recordCount: importedLogs.length,
        period: this.activePeriod,
        dateRange: `${dateRangeStart} s/d ${dateRangeEnd}`
      };

      if (Storage.saveAttendanceImportBatch) {
        await Storage.saveAttendanceImportBatch(batchRecord);
      }

      alert(`✅ Berhasil mengimpor ${importedLogs.length} log absensi (Batch ID: ${batchId}).\n\n📌 Rules Grace Period & Denda Telat Berjenjang telah dihitung otomatis!`);
      await this.loadData();
      this.render();
    } catch (e) {
      console.error("Import failed:", e);
      alert("❌ Gagal mengimpor file: " + e.message);
    } finally {
      if (input) input.value = "";
    }
  },

  async undoImport(batchId) {
    if (!confirm(`⚠️ Apakah Anda yakin ingin membatalkan (Undo) impor batch ${batchId}?`)) return;
    try {
      if (Storage.undoAttendanceImportBatch) {
        await Storage.undoAttendanceImportBatch(batchId);
      }
      alert(`✅ Impor batch ${batchId} berhasil dibatalkan (Undo)!`);
      await this.loadData();
      this.render();
    } catch(e) {
      alert("Gagal membatalkan: " + e.message);
    }
  },

  async saveAll() {
    try {
      await Storage.saveAttendance(this.records);
      alert('Data absensi berhasil disimpan!');
      this.render();
    } catch (e) {
      alert('Gagal menyimpan: ' + e.message);
    }
  },

  async exportToExcel() {
    if (typeof XLSX === 'undefined') {
      alert('Library Excel belum dimuat. Periksa koneksi internet Anda.');
      return;
    }

    const filtered = this.getFilteredRecords();
    const cutoffInfo = this.getPeriodCutoffRange(this.activePeriod);

    // Fetch raw logs for the matrix and real overtime calculation
    let logs = [];
    if (FirebaseSync.isEnabled()) {
      try {
        const db = window.db;
        const { collection, getDocs, query, where } = window.firestore;
        const snap = await getDocs(query(collection(db, "attendance_raw"), where("date", ">=", cutoffInfo.startDateStr), where("date", "<=", cutoffInfo.endDateStr)));
        snap.forEach(doc => {
          logs.push(doc.data());
        });
      } catch (err) {
        console.warn("Failed to fetch raw logs for export:", err.message);
      }
    }

    // Merge manual overrides
    const localOverrides = localStorage.getItem("erp_attendance_raw_overrides") 
      ? JSON.parse(localStorage.getItem("erp_attendance_raw_overrides")) 
      : [];
    const filteredOverrides = localOverrides.filter(l => l.date >= cutoffInfo.startDateStr && l.date <= cutoffInfo.endDateStr);
    logs = [...logs, ...filteredOverrides];

    const calendarData = Storage.getWorkCalendar() || {};
    const shifts = Storage.getMasterShifts() || [];
    const eligibleEmployees = this.getEligibleEmployees(cutoffInfo.startDateStr, cutoffInfo.endDateStr);

    // 1. Generate Sheet 1: Summary with Real Overtime Calculations
    const summaryData = eligibleEmployees.map(emp => {
      const row = filtered.find(r => String(r.nik) === String(emp.nik)) || {};

      const deptTarget = `DEPT:${emp.department}`;
      const empTarget = `EMP:${emp.id || emp.nik}`;

      let totalRealOvertime = 0;
      let hasAbnormalOvertime = false;

      const empLogs = logs.filter(l => String(l.nik) === String(emp.nik));
      
      const dailyLogsForRealOt = {};
      empLogs.forEach(log => {
        if (!dailyLogsForRealOt[log.date]) {
          dailyLogsForRealOt[log.date] = { in: null, out: null, inIsManual: false, outIsManual: false };
        }
        if (log.status === "IN") {
          const ts = log.timestamp || `${log.date} 00:00:00`;
          if (log.is_manual || !dailyLogsForRealOt[log.date].in || !dailyLogsForRealOt[log.date].inIsManual || ts < dailyLogsForRealOt[log.date].in) {
            dailyLogsForRealOt[log.date].in = ts;
            if (log.is_manual) dailyLogsForRealOt[log.date].inIsManual = true;
          }
        } else if (log.status === "OUT") {
          const ts = log.timestamp || `${log.date} 00:00:00`;
          if (log.is_manual || !dailyLogsForRealOt[log.date].out || !dailyLogsForRealOt[log.date].outIsManual || ts > dailyLogsForRealOt[log.date].out) {
            dailyLogsForRealOt[log.date].out = ts;
            if (log.is_manual) dailyLogsForRealOt[log.date].outIsManual = true;
          }
        }
      });

      cutoffInfo.dates.forEach(dateKey => {
        const startDate = emp.start_date || emp.join_date;
        const resDate = emp.resignation_date || emp.resign_date;
        const isInactive = emp.status === 'NON-AKTIF' || emp.status === 'non_active' || emp.status === 'inactive';
        
        const isPreJoin = startDate && (dateKey < startDate);
        const isPostResign = isInactive && resDate && (dateKey > resDate);
        if (isPreJoin || isPostResign) return;

        const dayStr = dateKey.split('-')[2];
        const datePeriod = dateKey.substring(0, 7);
        const periodCalData = calendarData[datePeriod] || {};
        const deptSched = periodCalData[deptTarget] || {};
        const empSched = periodCalData[empTarget] || {};

        const shiftId = empSched[dayStr] || deptSched[dayStr];
        const shift = shifts.find(s => s.id === shiftId);

        const isSecurity = shift && (
          String(shift.id).toUpperCase().includes('SEC') || 
          String(shift.name).toUpperCase().includes('SEC')
        );

        if (isSecurity) {
          if (dailyLogsForRealOt[dateKey] && dailyLogsForRealOt[dateKey].in) {
            totalRealOvertime += 4;
          }
        } else if (shift && shift.endTime && dailyLogsForRealOt[dateKey] && dailyLogsForRealOt[dateKey].out) {
          const outTime = dailyLogsForRealOt[dateKey].out.split(' ')[1].substring(0, 5);
          const [hOut, mOut] = outTime.split(':').map(Number);
          const [hEnd, mEnd] = shift.endTime.split(':').map(Number);
          let outTotal = hOut * 60 + mOut;
          let endTotal = hEnd * 60 + mEnd;

          // Handle overnight shifts
          if (outTotal < 12 * 60 && endTotal > 12 * 60) {
            outTotal += 24 * 60;
          }

          if (outTotal > endTotal) {
            const extraHours = (outTotal - endTotal) / 60;
            if (extraHours > 0) {
              totalRealOvertime += extraHours;
              if (extraHours > 5) {
                hasAbnormalOvertime = true;
              }
            }
          }
        }
      });

      return {
        'NIK': row.nik || emp.nik,
        'Nama': row.name || emp.name,
        'Periode': this.activePeriod,
        'Work Days': row.work_days || 0,
        'Overtime Hours (Capped)': row.overtime_hours || 0,
        'Real Overtime (Uncapped)': Math.round(totalRealOvertime * 100) / 100,
        'Overtime Status': hasAbnormalOvertime ? 'CHECK' : '',
        'Night Days': row.night_days || 0,
        'Red Day Work': row.extra_days || 0,
        'Late Count': row.late_count || 0,
        'Absence Days': row.absence_days || 0,
        'Half Day Izin': row.half_day_izin || 0
      };
    });

    // 2. Generate Sheet 2: Attendance Matrix (H vs Blank vs -)
    const matrixData = eligibleEmployees.map(emp => {
      const rowObj = {
        'NIK': emp.nik,
        'Nama': emp.name
      };

      const startDate = emp.start_date || emp.join_date;
      const resDate = emp.resignation_date || emp.resign_date;
      const isInactive = emp.status === 'NON-AKTIF' || emp.status === 'non_active' || emp.status === 'inactive';

      cutoffInfo.dates.forEach(dateKey => {
        const isPreJoin = startDate && (dateKey < startDate);
        const isPostResign = isInactive && resDate && (dateKey > resDate);
        if (isPreJoin || isPostResign) {
          rowObj[dateKey] = '-';
        } else {
          const dayLogs = logs.filter(l => String(l.nik) === String(emp.nik) && l.date === dateKey);
          rowObj[dateKey] = dayLogs.length > 0 ? 'H' : '';
        }
      });
      return rowObj;
    });

    // 3. Generate Sheet 3: Detail Harian (Payroll-Ready)
    const payrollDetails = [];
    const daysIndo = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const holidaysList = Storage.getHolidays ? Storage.getHolidays() : [];

    eligibleEmployees.forEach(emp => {
      const deptTarget = `DEPT:${emp.department}`;
      const empTarget = `EMP:${emp.id || emp.nik}`;

      const empLogs = logs.filter(l => String(l.nik) === String(emp.nik));

      const dailyLogs = {};
      empLogs.forEach(log => {
        if (!dailyLogs[log.date]) {
          dailyLogs[log.date] = { in: null, out: null, inIsManual: false, outIsManual: false };
        }
        if (log.status === "IN") {
          const ts = log.timestamp || `${log.date} 00:00:00`;
          if (log.is_manual || !dailyLogs[log.date].in || !dailyLogs[log.date].inIsManual || ts < dailyLogs[log.date].in) {
            dailyLogs[log.date].in = ts;
            if (log.is_manual) dailyLogs[log.date].inIsManual = true;
          }
        } else if (log.status === "OUT") {
          const ts = log.timestamp || `${log.date} 00:00:00`;
          if (log.is_manual || !dailyLogs[log.date].out || !dailyLogs[log.date].outIsManual || ts > dailyLogs[log.date].out) {
            dailyLogs[log.date].out = ts;
            if (log.is_manual) dailyLogs[log.date].outIsManual = true;
          }
        }
      });

      cutoffInfo.dates.forEach(dateKey => {
        const startDate = emp.start_date || emp.join_date;
        const resDate = emp.resignation_date || emp.resign_date;
        const isInactive = emp.status === 'NON-AKTIF' || emp.status === 'non_active' || emp.status === 'inactive';
        
        const isPreJoin = startDate && (dateKey < startDate);
        const isPostResign = isInactive && resDate && (dateKey > resDate);
        const isWithinContract = !isPreJoin && !isPostResign;

        const dayStr = dateKey.split('-')[2];
        const dow = new Date(dateKey + 'T12:00:00').getDay();
        const dayName = daysIndo[dow];
        const datePeriod = dateKey.substring(0, 7);
        const periodCalData = calendarData[datePeriod] || {};
        const deptSched = periodCalData[deptTarget] || {};
        const empSched = periodCalData[empTarget] || {};

        const shiftId = empSched[dayStr] || deptSched[dayStr];
        const shift = shifts.find(s => s.id === shiftId);

        // Determine Status Hari
        let statusHari = 'W';
        const holiday = holidaysList.find(h => h.date === dateKey);

        if (dow === 0) {
          statusHari = 'DO';
        } else if (holiday) {
          if (holiday.name.toLowerCase().includes('cuti bersama')) {
            statusHari = 'CB';
          } else {
            statusHari = 'PH';
          }
        } else if (dow === 6) {
          statusHari = 'HD';
        }

        // Determine Schedule In & Schedule Out
        let schedIn = "-";
        let schedOut = "-";

        if (shift && shift.startTime && shift.endTime) {
          schedIn = shift.startTime.substring(0, 5);
          schedOut = shift.endTime.substring(0, 5);
        } else if (statusHari === 'W') {
          schedIn = "08:30";
          schedOut = "17:00";
        } else if (statusHari === 'HD') {
          schedIn = "08:00";
          schedOut = "13:00";
        }

        const log = dailyLogs[dateKey] || {};
        const actualIn = log.in ? log.in.split(' ')[1].substring(0, 5) : "-";
        const actualOut = log.out ? log.out.split(' ')[1].substring(0, 5) : "-";

        // Determine Status Kehadiran (H, I, C, S, A, -)
        let statusKehadiran = "-";
        if (!isWithinContract) {
          statusKehadiran = "-";
          statusHari = isPreJoin ? "Pre-Join" : "Post-Resign";
          schedIn = "-";
          schedOut = "-";
        } else if (actualIn !== "-" || actualOut !== "-") {
          statusKehadiran = "H";
        } else if (statusHari === 'W' || statusHari === 'HD') {
          statusKehadiran = "A";
        }

        // Calculate Late Duration (Minutes)
        let lateMinutes = 0;
        if (actualIn !== "-" && schedIn !== "-") {
          const [inH, inM] = actualIn.split(':').map(Number);
          const [sInH, sInM] = schedIn.split(':').map(Number);
          const actInMins = inH * 60 + inM;
          const schInMins = sInH * 60 + sInM;
          if (actInMins > schInMins) {
            lateMinutes = actInMins - schInMins;
          }
        }

        // Calculate Early Departure (Minutes)
        let earlyMinutes = 0;
        if (actualOut !== "-" && schedOut !== "-") {
          const [outH, outM] = actualOut.split(':').map(Number);
          const [sOutH, sOutM] = schedOut.split(':').map(Number);
          let actOutMins = outH * 60 + outM;
          let schOutMins = sOutH * 60 + sOutM;
          
          if (schOutMins > actOutMins) {
            earlyMinutes = schOutMins - actOutMins;
          }
        }

        // Calculate Overtime (Hours)
        let overtimeHours = 0;
        const isSecurity = shift && (
          String(shift.id).toUpperCase().includes('SEC') || 
          String(shift.name).toUpperCase().includes('SEC')
        );

        if (isSecurity) {
          if (actualIn !== "-") {
            overtimeHours = 4;
          }
        } else if (schedOut !== "-" && actualOut !== "-") {
          const [hOut, mOut] = actualOut.split(':').map(Number);
          const [hEnd, mEnd] = schedOut.split(':').map(Number);
          let outTotal = hOut * 60 + mOut;
          let endTotal = hEnd * 60 + mEnd;

          // Overnight
          if (outTotal < 12 * 60 && endTotal > 12 * 60) {
            outTotal += 24 * 60;
          }

          if (outTotal > endTotal) {
            const extraMinutes = outTotal - endTotal;
            overtimeHours = Math.round((extraMinutes / 60) * 100) / 100;
          }
        }

        payrollDetails.push({
          'Employee ID': emp.nik,
          'Nama Karyawan': emp.name,
          'Departemen': emp.department || '-',
          'Tanggal': dateKey,
          'Hari': dayName,
          'Kode Shift': statusHari,
          'Schedule In': schedIn,
          'Schedule Out': schedOut,
          'Actual In': actualIn,
          'Actual Out': actualOut,
          'Status': statusKehadiran,
          'Late Duration (Minutes)': lateMinutes,
          'Early Departure (Minutes)': earlyMinutes,
          'Overtime (Hours)': overtimeHours
        });
      });
    });

    if (summaryData.length === 0) {
      alert('Tidak ada data untuk diexport.');
      return;
    }

    const workbook = XLSX.utils.book_new();

    const summaryWorksheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summaryWorksheet, "Rekap Summary");

    const matrixWorksheet = XLSX.utils.json_to_sheet(matrixData);
    XLSX.utils.book_append_sheet(workbook, matrixWorksheet, "Matriks Kehadiran");

    const payrollWorksheet = XLSX.utils.json_to_sheet(payrollDetails);
    XLSX.utils.book_append_sheet(workbook, payrollWorksheet, "Detail Harian Payroll");

    XLSX.writeFile(workbook, `Rekap_Absensi_${this.activePeriod}.xlsx`);
  },

  // --- NEW: Daily Detail with Shift Integration ---
  async showDailyDetail(nik) {
    const employee = this.employees.find(e => String(e.nik) === String(nik));
    if (!employee) return;

    // Show loading indicator first
    const loadingModal = document.createElement('div');
    loadingModal.className = 'modal-overlay';
    loadingModal.id = 'shift-loading-modal';
    loadingModal.innerHTML = `
      <div class="modal" style="max-width: 400px; text-align: center; padding: 40px;">
        <p style="font-size: 1.1rem;">⏳ Memuat data shift kalender kerja...</p>
      </div>
    `;
    document.body.appendChild(loadingModal);

    const [year, month] = this.activePeriod.split('-');
    const daysInMonth = new Date(year, month, 0).getDate();

    // Load calendar data — try localStorage first, then Firestore as fallback
    let calendarData = Storage.getWorkCalendar();
    const hasPeriodData = calendarData[this.activePeriod] && Object.keys(calendarData[this.activePeriod]).length > 0;

    if (!hasPeriodData && window.db && window.firestore) {
      try {
        const { collection, getDocs } = window.firestore;
        const snapshot = await getDocs(collection(window.db, 'workCalendar'));
        let merged = {};
        snapshot.forEach(doc => {
          const d = doc.data();
          const src = (d.value && typeof d.value === 'object' && !Array.isArray(d.value)) ? d.value : d;
          Object.keys(src).filter(k => k.match(/^\d{4}-\d{2}$/)).forEach(k => { merged[k] = src[k]; });
        });
        if (Object.keys(merged).length > 0) {
          calendarData = merged;
          // Heal localStorage cache
          try { localStorage.setItem(Storage.KEYS.WORK_CALENDAR, JSON.stringify(merged)); } catch(e) {}
        }
      } catch(err) {
        console.warn('⚠️ Gagal load work calendar dari Firestore:', err.message);
      }
    }

    // Remove loading modal
    const loadingEl = document.getElementById('shift-loading-modal');
    if (loadingEl) loadingEl.remove();

    const shifts = Storage.getMasterShifts();
    const periodData = calendarData[this.activePeriod] || {};

    // Get assigned shifts for this employee
    // Check DEPT first, then EMP (EMP overrides DEPT)
    const deptTarget = `DEPT:${employee.department}`;
    const empTarget = `EMP:${employee.id || employee.nik}`;

    const deptSchedule = periodData[deptTarget] || {};
    const empSchedule = periodData[empTarget] || {};

    // Debug info
    const totalDeptDays = Object.keys(deptSchedule).length;
    const totalEmpDays = Object.keys(empSchedule).length;

    const dailyLogs = {};
    if (window.db && window.firestore) {
      try {
        const { collection, getDocs, query, where } = window.firestore;
        const q1 = query(collection(window.db, "attendance_raw"), where("nik", "==", String(employee.nik || '').trim()));
        const snapshot1 = await getDocs(q1);
        
        let docs = [];
        snapshot1.forEach(doc => docs.push(doc.data()));
        
        if (employee.id && String(employee.id).trim() !== String(employee.nik).trim()) {
           const q2 = query(collection(window.db, "attendance_raw"), where("nik", "==", String(employee.id).trim()));
           const snapshot2 = await getDocs(q2);
           snapshot2.forEach(doc => docs.push(doc.data()));
        }
        
        docs.forEach(log => {
          let logDate = null;
          if (log.date && typeof log.date === 'string' && log.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
            logDate = log.date;
          } else if (log.timestamp) {
            logDate = String(log.timestamp).replace('T', ' ').split(' ')[0];
          }
          const cutoffInfo = this.getPeriodCutoffRange(this.activePeriod);
          if (!logDate || logDate < cutoffInfo.startDateStr || logDate > cutoffInfo.endDateStr) return;
          
          if (!dailyLogs[logDate]) dailyLogs[logDate] = { in: null, out: null, inIsManual: false, outIsManual: false };
          
          const ts = String(log.timestamp || logDate + ' 00:00:00').replace('T', ' ');
          if (log.status === "IN") {
            if (log.is_manual || !dailyLogs[logDate].in || !dailyLogs[logDate].inIsManual || ts < dailyLogs[logDate].in) {
              dailyLogs[logDate].in = ts;
              if (log.is_manual) dailyLogs[logDate].inIsManual = true;
            }
          } else if (log.status === "OUT") {
            if (log.is_manual || !dailyLogs[logDate].out || !dailyLogs[logDate].outIsManual || ts > dailyLogs[logDate].out) {
              dailyLogs[logDate].out = ts;
              if (log.is_manual) dailyLogs[logDate].outIsManual = true;
            }
          }
        });
        
        for (const date in dailyLogs) {
           if (dailyLogs[date].in) dailyLogs[date].inTime = dailyLogs[date].in.split(' ')[1].substring(0, 5);
           if (dailyLogs[date].out) dailyLogs[date].outTime = dailyLogs[date].out.split(' ')[1].substring(0, 5);
        }
      } catch (err) {
        console.warn('⚠️ Gagal load raw attendance dari Firestore:', err.message);
      }
    }

    // Universal Cut-Off (26th prev month to 25th active month)
    const cutoffInfo = this.getPeriodCutoffRange(this.activePeriod);
    const daysIndo = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const monthsIndo = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

    const dailyRecords = cutoffInfo.dates.map((dateKey, idx) => {
      const fullDateObj = new Date(dateKey + 'T12:00:00');
      const dayName = daysIndo[fullDateObj.getDay()];
      const dayNum = dateKey.split('-')[2];
      const monthNum = parseInt(dateKey.split('-')[1], 10);
      const formattedDate = `${dayName}, ${dayNum} ${monthsIndo[monthNum]}`;

      const datePeriod = dateKey.substring(0, 7);
      const periodCalData = calendarData[datePeriod] || {};
      const deptSched = periodCalData[deptTarget] || {};
      const empSched = periodCalData[empTarget] || {};

      const shiftId = empSched[dayNum] || deptSched[dayNum];
      const shift = shifts.find(s => s.id === shiftId);
      const log = dailyLogs[dateKey] || {};

      return {
        idx: idx + 1,
        dateKey,
        dayStr: dayNum,
        formattedDate,
        shift,
        inTime: log.inTime || '',
        outTime: log.outTime || ''
      };
    });

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal" style="max-width: 950px; width: 95%; height: 90vh; display: flex; flex-direction: column;">
        <div class="modal-header">
          <h3 class="modal-title">Detail Jam Kerja (Cut-off 26–25): ${employee.id} - ${employee.name}</h3>
          <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
        </div>
        <div class="modal-body" style="overflow: auto; flex: 1;">
          <p class="mb-2 text-gray">Periode Cut-Off: <strong>${cutoffInfo.startDateStr} s.d. ${cutoffInfo.endDateStr}</strong> | Dept: <strong>${employee.department}</strong></p>
          <table class="table">
            <thead style="position: sticky; top: 0; background: var(--bg-secondary); z-index: 1;">
              <tr>
                <th style="min-width: 110px;">Hari, Tgl</th>
                <th>Shift</th>
                <th>Jam Shift</th>
                <th>Malam?</th>
                <th>Clock-In (Masuk)</th>
                <th>Clock-Out (Pulang)</th>
                <th>Telat (mnt)</th>
                <th>Lembur (Jam)</th>
              </tr>
            </thead>
            <tbody>
              ${dailyRecords.map(r => `
                <tr class="${!r.shift ? 'bg-gray-100' : ''}">
                  <td style="white-space: nowrap; font-weight: 500;">${r.formattedDate}</td>
                  <td>${r.shift ? `<strong>${r.shift.name}</strong>` : '<span class="text-gray">-</span>'}</td>
                  <td>${r.shift ? `${r.shift.startTime} - ${r.shift.endTime}` : '-'}</td>
                  <td style="text-align:center;">${r.shift && r.shift.isNight ? '🌙' : '-'}</td>
                  <td>
                    ${r.shift ? `
                      <input type="time" class="form-input daily-clock-in" data-day="${r.idx}" 
                             data-start="${r.shift.startTime}" value="${r.inTime}" onchange="Attendance.calculateDaily(this)">
                    ` : '<span class="text-gray">Libur</span>'}
                  </td>
                  <td>
                    ${r.shift ? `
                      <input type="time" class="form-input daily-clock-out" data-day="${r.idx}" 
                             data-end="${r.shift.endTime}" data-night="${r.shift.isNight ? 'true' : 'false'}" value="${r.outTime}" onchange="Attendance.calculateDaily(this)">
                    ` : '<span class="text-gray">Libur</span>'}
                  </td>
                  <td>
                    <span id="late-day-${r.idx}" class="daily-late-val">0</span>
                  </td>
                  <td>
                    <span id="ot-day-${r.idx}" class="daily-ot-val">0</span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <div class="modal-footer" style="padding: 1rem; border-top: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; gap: 1.5rem; flex-wrap: wrap;">
            <div style="font-weight: bold; color: #2563eb;">Hadir (Clock-In): <span id="modal-total-work">0</span> Hari</div>
            <div style="font-weight: bold; color: #d97706;">Lembur: <span id="modal-total-ot">0</span> Jam</div>
            <div style="font-weight: bold;">Shift Malam: <span id="modal-total-night">0</span> Hari</div>
            <div style="font-weight: bold; color: #dc2626;">Terlambat: <span id="modal-total-late">0</span> Kali</div>
          </div>
          <div class="flex gap-2">
            <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Tutup</button>
            <button class="btn btn-primary" onclick="Attendance.applyOvertimeToSummary('${nik}')">Update ke Ringkasan</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Auto-calculate for all days that have clock in/out
    dailyRecords.forEach(r => {
      if (r.shift && (r.inTime || r.outTime)) {
        const input = document.querySelector(`.daily-clock-in[data-day="${r.idx}"]`);
        if (input) Attendance.calculateDaily(input);
      }
    });
  },


  calculateDaily(input) {
    const day = input.dataset.day;
    const clockInInput = document.querySelector(`.daily-clock-in[data-day="${day}"]`);
    const clockOutInput = document.querySelector(`.daily-clock-out[data-day="${day}"]`);
    
    if (!clockInInput || !clockOutInput) return;
    
    const shiftStart = clockInInput.dataset.start;
    const shiftEnd = clockOutInput.dataset.end;
    
    const clockIn = clockInInput.value;
    const clockOut = clockOutInput.value;

    let lateMinutes = 0;
    if (clockIn && clockIn !== '-' && shiftStart) {
        const penaltyRes = Storage.calculateLatePenalty ? Storage.calculateLatePenalty(clockIn, shiftStart) : { isLate: false, lateMinutes: 0 };
        lateMinutes = penaltyRes.lateMinutes || 0;
    }
    const lateEl = document.getElementById(`late-day-${day}`);
    if (lateEl) lateEl.textContent = lateMinutes;

    // Requirement 3: Overtime calculation using floor per 1 full hour
    let overtimeHours = 0;
    if (clockOut && clockOut !== '-' && shiftEnd) {
        const [hOut, mOut] = clockOut.split(':').map(Number);
        const [hEnd, mEnd] = shiftEnd.split(':').map(Number);
        let outTotal = hOut * 60 + mOut;
        let endTotal = hEnd * 60 + mEnd;
        
        if (outTotal < 12 * 60 && endTotal > 12 * 60) {
            outTotal += 24 * 60; 
        }

        if (outTotal > endTotal) {
            const extraMinutes = outTotal - endTotal;
            overtimeHours = Math.floor(extraMinutes / 60);
        }
    }
    const otEl = document.getElementById(`ot-day-${day}`);
    if (otEl) otEl.textContent = overtimeHours;

    this.updateModalTotals();
  },

  updateModalTotals() {
    let totalOT = 0;
    let totalNight = 0;
    let totalLateCount = 0;
    let totalWorkDays = 0;
    
    document.querySelectorAll('.daily-clock-in').forEach(inInput => {
      const day = inInput.dataset.day;
      const outInput = document.querySelector(`.daily-clock-out[data-day="${day}"]`);
      const otVal = parseFloat(document.getElementById(`ot-day-${day}`)?.textContent) || 0;
      const lateVal = parseInt(document.getElementById(`late-day-${day}`)?.textContent) || 0;
      
      // Requirement 2: Work Days calculated if Clock-In is present!
      if (inInput.value && inInput.value !== '-') {
        totalWorkDays++;
      }

      totalOT += otVal;
      // Late count strictly counts arrivals > 5 mins late (Grace Period immunity) and <= 120 mins
      if (lateVal > 5 && lateVal <= 120) totalLateCount++;

      if (outInput && outInput.value && outInput.value !== '-' && outInput.dataset.night === 'true') {
        totalNight += 1;
      }
    });

    const otEl = document.getElementById('modal-total-ot');
    if (otEl) otEl.textContent = Math.floor(totalOT);
    
    const nightEl = document.getElementById('modal-total-night');
    if (nightEl) nightEl.textContent = totalNight;

    const lateEl = document.getElementById('modal-total-late');
    if (lateEl) lateEl.textContent = totalLateCount;

    const workEl = document.getElementById('modal-total-work');
    if (workEl) workEl.textContent = totalWorkDays;
  },

  applyOvertimeToSummary(nik) {
    let totalWorkDays = 0;
    let totalOT = 0;
    let totalNight = 0;
    let totalLateCount = 0;
    let totalHalfDay = 0;

    document.querySelectorAll('.daily-clock-in').forEach(inInput => {
      const day = inInput.dataset.day;
      const outInput = document.querySelector(`.daily-clock-out[data-day="${day}"]`);
      const shiftStart = inInput.dataset.start;
      const shiftEnd = outInput ? outInput.dataset.end : null;

      const clockIn = inInput.value;
      const clockOut = outInput ? outInput.value : '';

      if (clockIn && clockIn !== '-') {
        totalWorkDays++;
        if (shiftStart) {
          const penaltyRes = Storage.calculateLatePenalty ? Storage.calculateLatePenalty(clockIn, shiftStart) : { isLate: false };
          if (penaltyRes.isLate) {
            if (penaltyRes.isHalfDay) {
              totalHalfDay++;
            } else {
              totalLateCount++;
            }
          }
        }
      }

      if (clockOut && clockOut !== '-' && shiftEnd) {
        const [hOut, mOut] = clockOut.split(':').map(Number);
        const [hEnd, mEnd] = shiftEnd.split(':').map(Number);
        let outTotal = hOut * 60 + mOut;
        let endTotal = hEnd * 60 + mEnd;
        if (outTotal > endTotal) {
          totalOT += Math.floor((outTotal - endTotal) / 60);
        }
        if (outInput && outInput.dataset.night === 'true') {
          totalNight += 1;
        }
      }
    });

    this.updateCell(nik, 'work_days', totalWorkDays);
    this.updateCell(nik, 'overtime_hours', Math.floor(totalOT));
    this.updateCell(nik, 'night_days', totalNight);
    this.updateCell(nik, 'late_count', totalLateCount);

    const container = document.getElementById('attendance-table-container');
    if (container) container.innerHTML = this.renderTable();

    alert(`Update berhasil: Hadir ${totalWorkDays} hari, Lembur ${Math.floor(totalOT)} jam, ${totalLateCount} kali telat, ${totalNight} shift malam.`);
    document.querySelector('.modal-overlay')?.remove();
  },

  async syncFromHardware() {
    try {
      console.log("☁️ Memulai sinkronisasi dari Firebase Cloud...");
      
      if (!FirebaseSync.isEnabled()) {
          throw new Error("Koneksi Firebase tidak aktif.");
      }

      const db = window.db;
      const { collection, query, where, getDocs, limit } = window.firestore;
      
      const period = this.activePeriod; // YYYY-MM
      console.log(`🔍 Mengambil log untuk periode: ${period}`);

      // Fetch shift data for late calculation
      const calendarData = Storage.getWorkCalendar() || {};
      const shifts = Storage.getMasterShifts() || [];
      const periodSchedule = calendarData[period] || {};

      const cutoffInfo = this.getPeriodCutoffRange(period);
      console.log(`📅 Query range Cut-Off 26-25: ${cutoffInfo.startDateStr} s/d ${cutoffInfo.endDateStr}`);

      // Query Firestore dengan range yang benar
      const q = query(
          collection(db, "attendance_raw"),
          where("date", ">=", cutoffInfo.startDateStr),
          where("date", "<=", cutoffInfo.endDateStr)
      );

      let snapshot;
      try {
        snapshot = await getDocs(q);
        console.log(`📦 Range query berhasil: ${snapshot.size} dokumen.`);
      } catch (queryErr) {
        console.warn('⚠️ Range query gagal (kemungkinan index belum ada), fallback ke full scan:', queryErr.message);
        const fallbackQ = query(collection(db, "attendance_raw"), limit(5000));
        snapshot = await getDocs(fallbackQ);
        console.log(`📦 Full scan fallback: ${snapshot.size} dokumen total (akan difilter).`);
      }

      if (snapshot.empty) {
        alert(`Tidak ada log ditemukan di Server (Firebase) untuk periode ${period} (${cutoffInfo.startDateStr} s.d. ${cutoffInfo.endDateStr}).`);
        return;
      }

      console.log(`📥 Total dokumen dari Firestore: ${snapshot.size}. Memproses untuk periode cut-off ${period}...`);

      const parseLogDate = (log) => {
        if (log.date && log.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
          return log.date;
        }
        if (log.timestamp) {
          const normalized = String(log.timestamp).replace('T', ' ');
          return normalized.split(' ')[0];
        }
        return null;
      };

      const dailyLogs = {};
      let filteredCount = 0;
      const niksInCloud = new Set();

      snapshot.forEach(doc => {
        const log = doc.data();
        const logDate = parseLogDate(log);
        if (!logDate) return;
        
        if (logDate < cutoffInfo.startDateStr || logDate > cutoffInfo.endDateStr) return; // Skip log di luar rentang 26-25
        
        filteredCount++;
        const nikStr = String(log.nik || '').trim();
        if (!nikStr) return;

        niksInCloud.add(nikStr);
        if (!dailyLogs[nikStr]) dailyLogs[nikStr] = {};
        if (!dailyLogs[nikStr][logDate]) dailyLogs[nikStr][logDate] = { in: null, out: null, raw: [] };
        
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

      console.log(`✅ Log yang relevan untuk ${period}: ${filteredCount} dari ${snapshot.size} total. NIK unik: ${niksInCloud.size}`);
      
      if (filteredCount === 0) {
        alert(`Data ditemukan di Firestore (${snapshot.size} log total), namun TIDAK ADA yang cocok untuk periode cut-off ${period} (${cutoffInfo.startDateStr} s.d. ${cutoffInfo.endDateStr}).`);
        return;
      }

      // Update the main records
      const unknownIds = [];
      const updatedNiks = new Set();
      let updatedCount = 0;

      for (const nik in dailyLogs) {
        const employee = this.employees.find(e =>
          String(e.nik || '').trim() === nik ||
          String(e.id || '').trim() === nik
        );
        
        if (!employee) {
          unknownIds.push(nik);
          continue;
        }

        const isSecurity = (Storage.isSecurityEmployee && Storage.isSecurityEmployee(employee)) || (
            String(employee.department || '').toLowerCase().includes('security') ||
            String(employee.division || employee.job_level || '').toLowerCase().includes('security') ||
            String(employee.position || '').toLowerCase().includes('security') ||
            String(employee.position || '').toLowerCase().includes('satpam')
        );
        const isMess = (employee.night_meal_category === 'mess' || employee.is_mess === true || employee.living_in_mess === true || employee.mess === true);
        const isMessOrSecurity = isSecurity || isMess;
        const employeeDaily = dailyLogs[nik];
        let workDays = 0;
        let missingTaps = 0;
        let lateCount = 0;
        let halfDayIzinCount = 0;
        let securityOvertimeHours = 0;
        let securityNightDays = 0;
        
        const deptTarget = `DEPT:${employee.department}`;
        const empTarget = `EMP:${employee.id || employee.nik}`;
        const deptSchedule = periodSchedule[deptTarget] || {};
        const empSchedule = periodSchedule[empTarget] || {};

        for (const date in employeeDaily) {
          const dayLogs = employeeDaily[date];
          
          const hasIn = dayLogs.in !== null;
          const hasOut = dayLogs.out !== null;
          const totalLogs = (dayLogs.raw || []).length;

          // Any Clock-In counts as a valid Workday for Security and Mess employees
          if (hasIn || totalLogs >= 1) {
            workDays++;
          }

          // Automated Overtime (4h fixed per shift) & Shift Meal mapping for Security & Mess
          if (isMessOrSecurity) {
            if (hasIn || totalLogs >= 1) {
              securityOvertimeHours += 4; // 4 jam lembur tetap per kehadiran shift
              securityNightDays += 1;     // Otomatis berhak atas makan malam untuk setiap kehadiran shift 12 jam
            }
          } else {
            // Calendar-First Hierarchy: Bypass late penalties on Sundays, Holidays, and Company Dayoffs
            const calStatus = Storage.getDateCalendarStatus ? Storage.getDateCalendarStatus(date) : { isNonWorkingDay: false };

            if (hasIn && !calStatus.isNonWorkingDay) {
              const dow = new Date(date + 'T12:00:00').getDay();
              const rawClockIn = String(dayLogs.in || '').replace('T', ' ');
              const clockInTime = rawClockIn.split(' ')[1]?.substring(0, 5) || '00:00';

              let shiftStartStr = '08:30';
              const dayStr = date.split('-')[2];
              const shiftId = empSchedule[dayStr] || deptSchedule[dayStr];
              if (shiftId) {
                  const shift = shifts.find(s => s.id === shiftId);
                  if (shift && shift.startTime) {
                      shiftStartStr = shift.startTime;
                  }
              } else {
                  if (dow === 6) {
                      shiftStartStr = '08:00';
                  }
              }

              const penaltyRes = Storage.calculateLatePenalty 
                ? Storage.calculateLatePenalty(clockInTime, shiftStartStr, employee.base_salary, date) 
                : { isLate: false, isHalfDay: false };

              if (penaltyRes.isLate) {
                if (penaltyRes.isHalfDay) {
                  halfDayIzinCount++;
                } else {
                  lateCount++;
                }
              }
            }
          }
        }

        // Absence & Surplus Calculation: dynamic Mon-Sat target days for Security or scheduledWorkDays for office staff
        let securityTargetDays = 26;
        if (cutoffInfo && cutoffInfo.dates) {
            securityTargetDays = cutoffInfo.dates.filter(d => new Date(d + 'T12:00:00').getDay() !== 0).length || 26;
        }

        const scheduledWorkDays = isSecurity ? securityTargetDays : (
          Object.keys(empSchedule).length + Object.keys(deptSchedule).length > 0
            ? Object.keys({ ...deptSchedule, ...empSchedule }).length
            : 0
        );
        const absenceDays = Math.max(0, (isSecurity ? securityTargetDays : scheduledWorkDays) - workDays - missingTaps);

        if (workDays > 0 || missingTaps > 0 || lateCount > 0 || halfDayIzinCount > 0 || securityOvertimeHours > 0) {
          let recordIndex = this.records.findIndex(r => String(r.nik) === String(employee.nik) && r.period === period);
          
          if (recordIndex === -1) {
            this.records.push({
              id: `ATD-${period}-${employee.nik}`,
              nik: employee.nik,
              name: employee.name,
              period: period,
              work_days: workDays,
              overtime_hours: isMessOrSecurity ? securityOvertimeHours : 0,
              night_days: isMessOrSecurity ? securityNightDays : 0,
              extra_days: isMessOrSecurity ? Math.max(0, workDays - securityTargetDays) : 0,
              late_count: isMessOrSecurity ? 0 : lateCount,
              absence_days: absenceDays,
              half_day_izin: isMessOrSecurity ? 0 : halfDayIzinCount,
              production_grams: 0,
              is_manual: false,
              missing_taps: missingTaps,
              _lastSynced: new Date().toISOString()
            });
          } else {
            this.records[recordIndex].work_days = workDays;
            if (isMessOrSecurity) {
              this.records[recordIndex].overtime_hours = securityOvertimeHours;
              this.records[recordIndex].night_days = securityNightDays;
              this.records[recordIndex].extra_days = Math.max(0, workDays - securityTargetDays);
              this.records[recordIndex].late_count = 0;
              this.records[recordIndex].half_day_izin = 0;
            } else {
              this.records[recordIndex].late_count = lateCount;
              this.records[recordIndex].half_day_izin = halfDayIzinCount;
            }
            this.records[recordIndex].missing_taps = missingTaps;
            this.records[recordIndex].is_manual = false;
            this.records[recordIndex]._lastSynced = new Date().toISOString();
            this.records[recordIndex].absence_days = absenceDays;
          }
          
          updatedNiks.add(employee.nik);
          updatedCount++;
        }
      }

      // Auto-save the processed records to storage and cloud
      await Storage.saveAttendance(this.records);

      // Tampilkan ringkasan detail yang informatif
      const nikList = [...niksInCloud];
      const unmatched = unknownIds.filter((v, i, a) => a.indexOf(v) === i); // unique

      let message = `✅ Sinkronisasi Selesai!\n\n`;
      message += `📊 Statistik:\n`;
      message += `  • ${filteredCount} log absensi ditemukan untuk ${period}\n`;
      message += `  • ${nikList.length} ID unik di mesin\n`;
      message += `  • ${updatedCount} karyawan berhasil diupdate\n`;
      if (unmatched.length > 0) {
        message += `\n⚠️ ${unmatched.length} ID Mesin BELUM TERDAFTAR di ERP:\n`;
        message += unmatched.map(id => `  • PIN: ${id}`).join('\n');
        message += `\n\n👉 Masukkan ID ini ke kolom NIK di Master Karyawan agar absensi bisa terbaca.`;
      }
      
      alert(message);
      this.render();
      
    } catch (err) {
      console.error("Sync Error:", err);
      alert("Gagal Sinkron: " + err.message + "\n\nTips:\n1. Pastikan mesin Solution X802 terkoneksi ke Internet\n2. Firebase Function 'admsReceiver' harus aktif\n3. Cek konsol browser untuk detail error");
    }
  },

  async viewRawLogs() {
    const container = document.getElementById('raw-logs-container');
    if (!container) return;
    
    // Toggle visibility
    if (container.style.display === 'block' && container.innerHTML !== '' && !container.innerHTML.includes('italic')) {
      container.style.display = 'none';
      return;
    }
    
    container.style.display = 'block';
    container.innerHTML = '<p class="text-center italic">🔄 Mengambil log dari Cloud...</p>';

    try {
      if (!FirebaseSync.isEnabled()) throw new Error("Firebase is not active.");
      
      const db = window.db;
      const { collection, query, where, getDocs, orderBy, limit } = window.firestore;
      
      const currentPeriod = this.activePeriod;
      const [y, m] = currentPeriod.split('-').map(Number);
      const nextMonthStart = (() => {
        const next = new Date(y, m, 1);
        return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`;
      })();

      // Query berdasarkan tanggal (lebih banyak, tidak butuh orderBy index khusus)
      let snapshot;
      try {
        const q = query(
          collection(db, "attendance_raw"),
          where("date", ">=", `${currentPeriod}-01`),
          where("date", "<", nextMonthStart)
        );
        snapshot = await getDocs(q);
      } catch (err) {
        // Fallback tanpa index
        console.warn('Range query gagal, fallback:', err.message);
        const q2 = query(collection(db, "attendance_raw"), limit(200));
        snapshot = await getDocs(q2);
      }

      if (snapshot.empty) {
        container.innerHTML = '<p class="text-center text-danger">❌ Belum ada data masuk di Cloud untuk periode ini.</p>';
        return;
      }

      // Kumpulkan NIK dari karyawan terdaftar
      const registeredNiks = new Set(
        this.employees.map(e => [String(e.nik || ''), String(e.id || '')]).flat().filter(Boolean)
      );

      const logs = [];
      const cutoffInfo = this.getPeriodCutoffRange(currentPeriod);
      snapshot.forEach(doc => {
        const d = doc.data();
        const logDate = d.date || String(d.timestamp || '').substring(0, 10);
        if (logDate >= cutoffInfo.startDateStr && logDate <= cutoffInfo.endDateStr) logs.push(d);
      });

      // Urutkan: terbaru dulu
      logs.sort((a, b) => String(b.timestamp || b.date || '').localeCompare(String(a.timestamp || a.date || '')));

      // Kelompokkan per NIK
      const nikGroups = {};
      logs.forEach(log => {
        const nik = String(log.nik || '?');
        if (!nikGroups[nik]) nikGroups[nik] = { logs: [], matched: registeredNiks.has(nik) };
        nikGroups[nik].logs.push(log);
      });

      const nikCount = Object.keys(nikGroups).length;
      const unmatchedNiks = Object.keys(nikGroups).filter(n => !nikGroups[n].matched);

      let html = `
        <div style="font-weight:700; padding: 3px 0; border-bottom: 1px solid #666; margin-bottom: 4px;">
          📟 Log Mesin untuk ${currentPeriod}: <span style="color:#10b981">${logs.length} log</span> dari
          <span style="color:#60a5fa">${nikCount} ID mesin</span>
          ${unmatchedNiks.length > 0 ? `· <span style="color:#f59e0b">⚠️ ${unmatchedNiks.length} ID belum terdaftar di ERP</span>` : '· <span style="color:#10b981">✅ Semua terdaftar</span>'}
        </div>`;

      if (unmatchedNiks.length > 0) {
        html += `<div style="background:rgba(245,158,11,0.15); border-left:3px solid #f59e0b; padding:4px 8px; margin-bottom:6px; font-size:0.78rem;">
          <strong>ID belum terdaftar:</strong> ${unmatchedNiks.join(', ')} — Tambahkan ke Master Karyawan (kolom NIK)
        </div>`;
      }

      html += '<ul style="list-style: none; padding: 0; margin: 0;">';
      logs.slice(0, 50).forEach(log => {
        const nik = String(log.nik || '?');
        const isMatched = registeredNiks.has(nik);
        const statusColor = log.status === 'IN' ? '#10b981' : '#f59e0b';
        const nikColor = isMatched ? '#c084fc' : '#f87171';
        html += `<li style="border-bottom: 1px solid #333; padding: 3px 0; display:flex; gap:6px; align-items:center; font-size:0.78rem;">
          <span style="color:${statusColor}; font-weight:700; min-width:32px;">${log.status || '?'}</span>
          <span style="color:${nikColor}; min-width:60px;">NIK: <strong>${nik}</strong>${isMatched ? ' ✅' : ' ❌'}</span>
          <span style="color:#94a3b8;">${log.timestamp || log.date || '-'}</span>
        </li>`;
      });
      html += '</ul>';
      if (logs.length > 50) {
        html += `<p style="color:#94a3b8; font-size:0.75rem; text-align:center; margin-top:4px;">...dan ${logs.length - 50} log lainnya (tidak ditampilkan)</p>`;
      }
      
      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = `<p class="text-danger">Error: ${err.message}</p>`;
    }
  },

  async viewHardwareLogs(nik) {
    const employee = this.employees.find(e => String(e.nik) === String(nik) || String(e.id) === String(nik));
    const displayName = employee ? employee.name : `NIK: ${nik}`;
    const period = this.activePeriod;
    const cutoffInfo = this.getPeriodCutoffRange(period);

    try {
      let logs = [];

      if (FirebaseSync.isEnabled()) {
        const db = window.db;
        const { collection, query, where, getDocs } = window.firestore;
        
        // Fetch logs for this NIK. Try String and Number fallback query.
        let snapshot = await getDocs(query(collection(db, "attendance_raw"), where("nik", "==", String(nik))));
        
        if (snapshot.empty && !isNaN(Number(nik))) {
            snapshot = await getDocs(query(collection(db, "attendance_raw"), where("nik", "==", Number(nik))));
        }
        
        snapshot.forEach(doc => {
          const data = doc.data();
          const logDate = data.date || String(data.timestamp || '').substring(0, 10);
          if (logDate && logDate >= cutoffInfo.startDateStr && logDate <= cutoffInfo.endDateStr) {
            logs.push(data);
          }
        });
      }

      // Merge manual overrides from local storage
      const localOverrides = localStorage.getItem("erp_attendance_raw_overrides") 
        ? JSON.parse(localStorage.getItem("erp_attendance_raw_overrides")) 
        : [];
      const empOverrides = localOverrides.filter(l => String(l.nik) === String(nik) && l.date >= cutoffInfo.startDateStr && l.date <= cutoffInfo.endDateStr);
      logs = [...logs, ...empOverrides];

      logs.sort((a, b) => String(a.timestamp || '').localeCompare(String(b.timestamp || '')));

      const dailyLogs = {};
      cutoffInfo.dates.forEach(dStr => {
        dailyLogs[dStr] = { in: null, out: null, inIsManual: false, outIsManual: false, inDoc: null, outDoc: null, rawIn: null, rawOut: null };
      });

      logs.forEach(data => {
          const dDate = data.date || String(data.timestamp || '').substring(0, 10);
          if (!dailyLogs[dDate]) dailyLogs[dDate] = { in: null, out: null, inIsManual: false, outIsManual: false, inDoc: null, outDoc: null, rawIn: null, rawOut: null };
          
          if (data.status === 'IN') {
              if (data.is_manual || !dailyLogs[dDate].in || !dailyLogs[dDate].inIsManual) {
                  dailyLogs[dDate].in = data.time || String(data.timestamp || '').split(' ')[1]?.substring(0, 5);
                  dailyLogs[dDate].inIsManual = data.is_manual || false;
                  dailyLogs[dDate].inDoc = data;
              }
              if (!data.is_manual) {
                  dailyLogs[dDate].rawIn = data.time || String(data.timestamp || '').split(' ')[1]?.substring(0, 5);
              }
          } else if (data.status === 'OUT') {
              if (data.is_manual || !dailyLogs[dDate].out || !dailyLogs[dDate].outIsManual) {
                  dailyLogs[dDate].out = data.time || String(data.timestamp || '').split(' ')[1]?.substring(0, 5);
                  dailyLogs[dDate].outIsManual = data.is_manual || false;
                  dailyLogs[dDate].outDoc = data;
              }
              if (!data.is_manual) {
                  dailyLogs[dDate].rawOut = data.time || String(data.timestamp || '').split(' ')[1]?.substring(0, 5);
              }
          }
      });

      // Sort dates descending for display (25th active month down to 26th prev month)
      const sortedDates = cutoffInfo.dates.slice().reverse();

      let logsHtml = "";
      const formatTgl = (dStr) => {
          const d = new Date(dStr + 'T12:00:00');
          const days = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
          const mos = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
          return `${days[d.getDay()]}, ${d.getDate()} ${mos[d.getMonth()]} ${d.getFullYear()}`;
      };
      
      const calendarData = Storage.getWorkCalendar() || {};
      const shifts = Storage.getMasterShifts() || [];
      const periodSchedule = calendarData[period] || {};
      
      const deptTarget = employee ? `DEPT:${employee.department}` : '';
      const empTarget = employee ? `EMP:${employee.id || employee.nik}` : '';
      const deptSchedule = periodSchedule[deptTarget] || {};
      const empSchedule = periodSchedule[empTarget] || {};

      sortedDates.forEach(date => {
          const dayLogs = dailyLogs[date] || { in: null, out: null };
          const inTime = dayLogs.in || '-';
          const outTime = dayLogs.out || '-';
          
          let isLate = false;
          let penaltyBadge = '';
          const calStatus = Storage.getDateCalendarStatus ? Storage.getDateCalendarStatus(date) : { isNonWorkingDay: false };

          if (inTime !== '-' && !calStatus.isNonWorkingDay && !isSecurity) {
              let shiftStartStr = '08:30';
              const dayStr = date.split('-')[2];
              const shiftId = empSchedule[dayStr] || deptSchedule[dayStr];
              if (shiftId) {
                  const shift = shifts.find(s => s.id === shiftId);
                  if (shift && shift.startTime) {
                      shiftStartStr = shift.startTime;
                  }
              } else {
                  const dow = new Date(date + 'T12:00:00').getDay();
                  if (dow === 6) {
                      shiftStartStr = '08:00';
                  }
              }
              
              const penaltyRes = Storage.calculateLatePenalty 
                ? Storage.calculateLatePenalty(inTime, shiftStartStr, employee ? employee.base_salary : 5000000, date) 
                : { isLate: false, penalty: 0 };

              isLate = penaltyRes.isLate;
              if (isLate) {
                  if (penaltyRes.isHalfDay) {
                      penaltyBadge = ` <span class="badge badge-warning" style="font-size: 0.65rem; padding: 1px 4px; vertical-align: middle;" title="Terlambat >2 Jam (Izin 1/2 Hari)">⏱️ 1/2 Hari</span>`;
                  } else if (penaltyRes.penalty > 0) {
                      penaltyBadge = ` <span class="badge badge-danger" style="font-size: 0.65rem; padding: 1px 4px; vertical-align: middle;" title="Denda Keterlambatan: Rp ${penaltyRes.penalty.toLocaleString('id-ID')}">-${penaltyRes.penalty / 1000}k</span>`;
                  }
              }
          } else if (inTime !== '-' && calStatus.isNonWorkingDay) {
              penaltyBadge = ` <span class="badge badge-info" style="font-size: 0.65rem; padding: 1px 4px; vertical-align: middle; background: #e0e7ff; color: #4338ca;" title="${calStatus.reason || 'Hari Libur'}">🏖️ ${calStatus.reason || 'Libur'}</span>`;
          }
          
          logsHtml += `
              <tr>
                  <td style="white-space: nowrap; font-weight: 500;">${formatTgl(date)}</td>
                  <td>
                      <span style="color: ${isLate ? '#ef4444' : 'inherit'}; font-weight: ${isLate ? 'bold' : 'normal'};">${inTime}</span>${penaltyBadge}
                      ${dayLogs.inIsManual ? '<span style="color: #10b981; font-size: 0.75rem;" title="Manual: ' + (dayLogs.inDoc?.notes || '') + ' oleh ' + (dayLogs.inDoc?.updated_by || 'Admin') + '">✍️</span>' : ''}
                  </td>
                  <td>
                      <span style="color: #3b82f6; font-weight: 500;">${outTime}</span>
                      ${dayLogs.outIsManual ? '<span style="color: #10b981; font-size: 0.75rem;" title="Manual: ' + (dayLogs.outDoc?.notes || '') + ' oleh ' + (dayLogs.outDoc?.updated_by || 'Admin') + '">✍️</span>' : ''}
                  </td>
                  <td style="text-align: center;">
                      <button class="btn btn-sm btn-secondary" onclick="Attendance.openOverrideModal('${nik}', '${date}', '${dayLogs.in || ''}', '${dayLogs.out || ''}', '${dayLogs.rawIn || ''}', '${dayLogs.rawOut || ''}')">✏️ Edit</button>
                  </td>
              </tr>
          `;
      });

      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.style.zIndex = "10001";
      modal.innerHTML = `
        <div class="modal" style="max-width: 650px; max-height: 85vh; display: flex; flex-direction: column;">
          <div class="modal-header">
            <h3 class="modal-title">Log Mesin (Cut-Off 26–25): ${displayName}</h3>
            <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
          </div>
          <div class="modal-body" style="overflow-y: auto; flex: 1;">
            <p class="mb-2 text-gray" style="font-size: 0.85rem;">Periode Cut-Off: <strong>${cutoffInfo.startDateStr} s.d. ${cutoffInfo.endDateStr}</strong></p>
            <table class="table" style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="border-bottom: 2px solid #334155; text-align: left;">
                  <th style="padding: 10px 8px;">Tanggal</th>
                  <th style="padding: 10px 8px;">Clock In</th>
                  <th style="padding: 10px 8px;">Clock Out</th>
                  <th style="padding: 10px 8px; text-align: center;">Aksi</th>
                </tr>
              </thead>
              <tbody>
                ${logsHtml}
              </tbody>
            </table>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    } catch (err) {
      alert("Gagal memuat log: " + err.message);
    }
  },

  openOverrideModal(nik, date, currentIn, currentOut, rawIn, rawOut) {
      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.style.zIndex = "10002";
      
      const cleanIn = currentIn === '-' ? '' : currentIn;
      const cleanOut = currentOut === '-' ? '' : currentOut;

      modal.innerHTML = `
        <div class="modal" style="max-width: 400px; padding: 20px;">
          <div class="modal-header">
            <h3 class="modal-title" style="font-size: 1.1rem; font-weight: bold;">Penyesuaian Manual Log</h3>
            <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
          </div>
          <div class="modal-body">
            <p style="font-size: 0.8rem; color: #64748b; margin-bottom: 12px;">Karyawan NIK: <strong>${nik}</strong>, Tanggal: <strong>${date}</strong></p>
            <form onsubmit="Attendance.saveOverride(event, '${nik}', '${date}', '${rawIn}', '${rawOut}')">
              <div class="form-group mb-3">
                <label class="form-label" style="font-size: 0.85rem; font-weight: bold;">Manual Clock In (HH:MM)</label>
                <input type="text" id="manual-clock-in" class="form-input" placeholder="e.g. 08:30" value="${cleanIn}" pattern="[0-2][0-9]:[0-5][0-9]">
              </div>
              <div class="form-group mb-3">
                <label class="form-label" style="font-size: 0.85rem; font-weight: bold;">Manual Clock Out (HH:MM)</label>
                <input type="text" id="manual-clock-out" class="form-input" placeholder="e.g. 17:00" value="${cleanOut}" pattern="[0-2][0-9]:[0-5][0-9]">
              </div>
              <div class="form-group mb-3">
                <label class="form-label" style="font-size: 0.85rem; font-weight: bold;">Alasan Perubahan <span style="color:red;">*</span></label>
                <textarea id="override-reason" class="form-input" style="height: 60px;" required placeholder="Alasan penyesuaian wajib diisi..."></textarea>
              </div>
              <div class="flex justify-end gap-2" style="margin-top: 15px;">
                <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Batal</button>
                <button type="submit" class="btn btn-primary">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
  },

  async saveOverride(e, nik, date, rawIn, rawOut) {
      e.preventDefault();
      const manualIn = document.getElementById('manual-clock-in').value.trim();
      const manualOut = document.getElementById('manual-clock-out').value.trim();
      const reason = document.getElementById('override-reason').value.trim();

      if (!reason) {
          alert('Alasan perubahan wajib diisi!');
          return;
      }

      let adminUser = 'Admin';
      try {
          const auth = window.firebaseAuth ? window.firebaseAuth.getAuth() : null;
          if (auth && auth.currentUser) {
              adminUser = auth.currentUser.email || auth.currentUser.displayName || 'Admin';
          }
      } catch(err){}

      try {
          const db = window.db;
          const { collection, addDoc, getDocs, query, where, writeBatch } = window.firestore;

          const q = query(
              collection(db, "attendance_raw"),
              where("nik", "==", String(nik)),
              where("date", "==", date),
              where("is_manual", "==", true)
          );
          const snap = await getDocs(q);
          const batch = writeBatch(db);
          snap.forEach(docSnap => {
              batch.delete(docSnap.ref);
          });
          await batch.commit();

          if (manualIn) {
              await addDoc(collection(db, "attendance_raw"), {
                  nik: String(nik),
                  date: date,
                  time: manualIn,
                  timestamp: `${date} ${manualIn}:00`,
                  status: 'IN',
                  is_manual: true,
                  original_value: rawIn || '-',
                  updated_by: adminUser,
                  updated_at: new Date().toISOString(),
                  notes: reason
              });
          }

          if (manualOut) {
              await addDoc(collection(db, "attendance_raw"), {
                  nik: String(nik),
                  date: date,
                  time: manualOut,
                  timestamp: `${date} ${manualOut}:00`,
                  status: 'OUT',
                  is_manual: true,
                  original_value: rawOut || '-',
                  updated_by: adminUser,
                  updated_at: new Date().toISOString(),
                  notes: reason
              });
          }

          alert('Penyesuaian manual absensi berhasil disimpan!');
          e.target.closest('.modal-overlay').remove();
          
          const overlays = document.querySelectorAll('.modal-overlay');
          overlays.forEach(overlay => {
              if (overlay.innerHTML.includes('Log Mesin:')) {
                  overlay.remove();
              }
          });
          
          await this.viewHardwareLogs(nik);
          
          if (this.loadData) {
              await this.loadData();
              this.render();
          }
      } catch(err) {
          alert('Gagal menyimpan penyesuaian: ' + err.message);
      }
  }
};

window.Attendance = Attendance;
