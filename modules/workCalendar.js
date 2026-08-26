// ==========================================
// HR - Work Calendar Module
// ==========================================

const WorkCalendar = {
    currentYearMonth: '',
    currentTarget: '', // Format: "DEPT:CODE" or "EMP:ID"
    calendarData: {},
    shifts: [],

    // âââ Preset Department Groups ââââââââââââââââââââââââââââââââ
    DEPT_GROUPS: [
        {
            id: 'back_office',
            label: 'ð¢ Back Office',
            color: '#4f46e5',
            keywords: ['finance', 'accounting', 'human', 'hr', 'information', 'it', 'sales', 'marketing', 'admin']
        },
        {
            id: 'production',
            label: 'ð­ Production & Refinery',
            label: '🏭 Production & Refinery',
            color: '#059669',
            keywords: ['production', 'refinery', 'quality', 'lab', 'qc', 'warehouse', 'gudang']
        },
        {
            id: 'cleaning',
            label: '🧹 Cleaning Service / OB',
            color: '#d97706',
            keywords: ['cleaning', 'ob', 'office boy', 'janitor', 'kebersihan']
        }
    ],

    getRealCurrentYearMonth() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    },

    isHistoricalMonth(yearMonth) {
        if (!yearMonth) return false;
        const currentReal = this.getRealCurrentYearMonth();
        return yearMonth < currentReal;
    },

    getHolidayRecord(dateFullStr) {
        const holidaysList = Storage.getHolidays ? Storage.getHolidays() : [];
        return holidaysList.find(h => h.date === dateFullStr);
    },

    isOfficialNationalHoliday(dateFullStr) {
        const h = this.getHolidayRecord(dateFullStr);
        if (!h) return false;
        const name = String(h.name || h.description || '').toLowerCase();
        const type = String(h.type || '').toLowerCase();

        // 📌 Policy: "Cuti Bersama" is NOT an official company holiday in WorkCalendar (treated as normal working day)
        // Only official national holidays (excluding Cuti Bersama) are locked non-working red dates.
        if (type === 'cuti bersama' || name.includes('cuti bersama') || h.isNationalHoliday === false) {
            return false;
        }
        return true;
    },

    isCutiBersama(dateFullStr) {
        const h = this.getHolidayRecord(dateFullStr);
        if (!h) return false;
        const name = String(h.name || h.description || '').toLowerCase();
        const type = String(h.type || '').toLowerCase();
        return type === 'cuti bersama' || name.includes('cuti bersama') || h.isNationalHoliday === false;
    },

    
    isEmployeeResignedOnDate(target, dateFullStr) {
        if (typeof target === 'string' && target.startsWith('EMP:')) {
            const empId = target.replace('EMP:', '');
            const employees = Storage.getEmployees ? Storage.getEmployees() : [];
            const emp = employees.find(e => String(e.id) === String(empId) || String(e.nik) === String(empId));
            if (emp && (emp.status === 'NON-AKTIF' || emp.status === 'non_active' || emp.status === 'inactive')) {
                if (!emp.resignation_date || dateFullStr > emp.resignation_date) {
                    return true; // Resigned!
                }
            }
        }
        return false;
    },

    init() {
        const now = new Date();
        this.currentYearMonth = this.currentYearMonth || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        this.shifts = Storage.getMasterShifts();

        // Load dari localStorage (fast) — lalu validasi dan perbaiki jika perlu
        const localData = Storage.getWorkCalendar(); // sudah di-unwrap di storage.js
        this.calendarData = localData;

        this.render();
        console.log('📅 Work Calendar module initialized. Keys:', Object.keys(this.calendarData));

        // Async: Fetch official national holidays from API for the active year
        const [yStr] = this.currentYearMonth.split('-');
        if (Storage.syncHolidaysFromAPI) {
            Storage.syncHolidaysFromAPI(parseInt(yStr, 10)).then(() => this.render());
        }

        // Async: Jika data kosong, coba load langsung dari Firestore sebagai fallback
        this._loadFromFirestoreIfEmpty();

        // Salin Jadwal Bulan Lalu HANYA jika bulan berjalan (atau bulan depan) belum memiliki konfigurasi shift, DAN BUKAN bulan historis
        if (!this.isHistoricalMonth(this.currentYearMonth)) {
            if (!this.calendarData[this.currentYearMonth] || Object.keys(this.calendarData[this.currentYearMonth]).length === 0) {
                this.rolloverPreviousMonth(this.currentYearMonth);
            }
        }
    },

    // Load dari Firestore secara langsung jika localStorage terdeteksi kosong atau corrupt
    async _loadFromFirestoreIfEmpty() {
        const isEmpty = !this.calendarData || Object.keys(this.calendarData).length === 0;
        if (!isEmpty) return; // Data sudah ada, tidak perlu fetch
        if (!window.FirebaseSync || !window.FirebaseSync.isEnabled()) return;

        try {
            const db = window.db;
            const { collection, getDocs } = window.firestore;
            console.log('🔄 [WorkCalendar] localStorage kosong. Mencoba load langsung dari Firestore...');

            const snapshot = await getDocs(collection(db, 'workCalendar'));
            let merged = {};
            snapshot.forEach(doc => {
                const d = doc.data();
                // Unwrap value wrapper jika ada
                if (d && d.value && typeof d.value === 'object' && !Array.isArray(d.value)) {
                    Object.assign(merged, d.value);
                } else if (d && typeof d === 'object') {
                    // Might be data stored directly without wrapper (old format)
                    const keys = Object.keys(d).filter(k => k !== '_syncedAt');
                    keys.forEach(k => { if (k.match(/^\d{4}-\d{2}$/)) merged[k] = d[k]; });
                }
            });

            if (Object.keys(merged).length > 0) {
                console.log('✅ [WorkCalendar] Berhasil load dari Firestore. Menyimpan ke cache lokal...');
                this.calendarData = merged;
                // Heal localStorage
                try { localStorage.setItem(Storage.KEYS.WORK_CALENDAR, JSON.stringify(merged)); } catch(e) {}
                this.render(); // Re-render dengan data yang sudah benar
            } else {
                console.log('ℹ️ [WorkCalendar] Firestore juga kosong untuk collection workCalendar.');
            }
        } catch (err) {
            console.warn('⚠️ [WorkCalendar] Gagal load dari Firestore:', err.message);
        }
    },

    async saveCalendar() {
        await Storage.saveWorkCalendar(this.calendarData);
        AuditLog.log('hr_work_calendar', 'save', this.currentYearMonth, { target: this.currentTarget });
    },

    async saveCalendarManual() {
        if (this.isHistoricalMonth(this.currentYearMonth)) {
            const msg = `🔒 Bulan ${this.currentYearMonth} adalah data historis yang sudah terkunci (read-only).`;
            if (window.showToast) window.showToast(msg, 'warning');
            else alert(msg);
            return;
        }
        await this.saveCalendar();
        if (window.showToast) {
            window.showToast('✅ Pengaturan Shift berhasil disimpan dan di-lock.', 'success');
        } else {
            alert('✅ Pengaturan Shift berhasil disimpan dan di-lock.');
        }
    },

    setTarget(target) {
        this.currentTarget = target;
        this.render();
    },

    async setYearMonth(yearMonth) {
        this.currentYearMonth = yearMonth;

        const [yStr] = yearMonth.split('-');
        if (Storage.syncHolidaysFromAPI) {
            Storage.syncHolidaysFromAPI(parseInt(yStr, 10)).then(() => this.render());
        }

        if (this.isHistoricalMonth(yearMonth)) {
            // Historical month: Read-only, DO NOT trigger auto-copy
            this.render();
        } else if (!this.calendarData[yearMonth] || Object.keys(this.calendarData[yearMonth]).length === 0) {
            await this.rolloverPreviousMonth(yearMonth);
        } else {
            this.render();
        }
    },

    // ─── Copy Routine Shift Schedules From Previous Month ─────────────────────────
    async rolloverPreviousMonth(explicitTargetMonth = null) {
        const targetPeriod = explicitTargetMonth || this.currentYearMonth;

        // 🔒 Guard 1: Historical Month Lock - Do NOT allow copying into a past historical month
        if (this.isHistoricalMonth(targetPeriod)) {
            const msg = `🔒 Bulan ${targetPeriod} adalah data historis yang sudah terkunci (read-only). Salin Jadwal Bulan Lalu hanya dapat diterapkan untuk bulan berjalan atau bulan mendatang.`;
            if (window.showToast) window.showToast(msg, 'warning');
            else alert(msg);
            this.render();
            return false;
        }

        const [yStr, mStr] = targetPeriod.split('-');
        let y = parseInt(yStr, 10);
        let m = parseInt(mStr, 10);
        let prevM = m - 1;
        let prevY = y;
        if (prevM === 0) { prevM = 12; prevY = y - 1; }
        const prevPeriodKey = `${prevY}-${String(prevM).padStart(2, '0')}`;

        // 🔒 Guard 2: Read source data using deep clone so previous month object can NEVER be mutated
        const sourceData = this.calendarData[prevPeriodKey];
        if (!sourceData || Object.keys(sourceData).length === 0) {
            if (explicitTargetMonth) {
                const msg = `⚠️ Data kalender bulan lalu (${prevPeriodKey}) belum memiliki konfigurasi shift.`;
                if (window.showToast) window.showToast(msg, 'warning');
                else alert(msg);
            }
            this.render();
            return false;
        }

        // Deep copy source data to isolate previous month from any modifications
        const prevData = JSON.parse(JSON.stringify(sourceData));

        if (!this.calendarData[targetPeriod]) this.calendarData[targetPeriod] = {};

        const daysInTargetMonth = new Date(y, m, 0).getDate();
        let copiedCount = 0;
        let holidaySkipped = 0;

        Object.keys(prevData).forEach(target => {
            if (!this.calendarData[targetPeriod][target]) {
                this.calendarData[targetPeriod][target] = {};
            }
            for (let d = 1; d <= daysInTargetMonth; d++) {
                const dStr = String(d).padStart(2, '0');
                const dateFullStr = `${targetPeriod}-${dStr}`;

                // Check if already manually overridden
                if (this.calendarData[targetPeriod][target][dStr]) continue;

                // Official National Holiday Check (Excludes Cuti Bersama which is normal working day)
                const isHoliday = this.isOfficialNationalHoliday(dateFullStr);
                if (isHoliday) {
                    delete this.calendarData[targetPeriod][target][dStr];
                    holidaySkipped++;
                    continue;
                }

                // Copy shift string strictly to targetPeriod ONLY
                const prevShiftId = prevData[target][dStr];
                if (prevShiftId && typeof prevShiftId === 'string') {
                    this.calendarData[targetPeriod][target][dStr] = String(prevShiftId);
                    copiedCount++;
                }
            }
        });

        await this.saveCalendar();
        this.render();

        const msg = `✅ Salin Jadwal Bulan Lalu dari bulan ${prevPeriodKey} ke bulan target ${targetPeriod} selesai (${copiedCount} entri shift diterapkan, ${holidaySkipped} hari libur nasional dilindungi). Data historis ${prevPeriodKey} tetap aman & terkunci.`;
        if (window.showToast) window.showToast(msg, 'success');
        else if (explicitTargetMonth) alert(msg);
        return true;
    },

    assignShift(day, shiftId) {
        if (this.isHistoricalMonth(this.currentYearMonth)) {
            const msg = `🔒 Bulan ${this.currentYearMonth} adalah data historis yang sudah terkunci (read-only) dan tidak dapat diubah.`;
            if (window.showToast) window.showToast(msg, 'warning');
            else alert(msg);
            return;
        }
        if (!this.currentTarget) {
            alert('Pilih Departemen atau Karyawan terlebih dahulu');
            return;
        }
        if (!this.calendarData[this.currentYearMonth]) this.calendarData[this.currentYearMonth] = {};
        if (!this.calendarData[this.currentYearMonth][this.currentTarget]) this.calendarData[this.currentYearMonth][this.currentTarget] = {};

        const dayStr = String(day).padStart(2, '0');
        if (shiftId === '') {
            delete this.calendarData[this.currentYearMonth][this.currentTarget][dayStr];
        } else {
            this.calendarData[this.currentYearMonth][this.currentTarget][dayStr] = shiftId;
        }
        this.saveCalendar();
        this.render();
    },

    // ─── Bulk Assignment ───
    async bulkAssignShift(targets, shiftId, startDate, endDate, dayFilter = 'all') {
        if (!targets || targets.length === 0) { alert('Pilih minimal 1 departemen/karyawan.'); return; }
        if (shiftId === undefined || shiftId === null) { alert('Pilih shift terlebih dahulu.'); return; }

        const start = new Date(startDate);
        const end = new Date(endDate);
        let assigned = 0;
        let holidaySkipped = 0;
        let historicalSkipped = 0;

        targets.forEach(target => {
            let curr = new Date(start);
            while (curr <= end) {
                const y = curr.getFullYear();
                const mStr = String(curr.getMonth() + 1).padStart(2, '0');
                const dStr = String(curr.getDate()).padStart(2, '0');
                const dateFullStr = `${y}-${mStr}-${dStr}`;
                const periodKey = `${y}-${mStr}`;

                // 🔒 Guard: Do NOT modify historical months
                if (this.isHistoricalMonth(periodKey)) {
                    historicalSkipped++;
                    curr.setDate(curr.getDate() + 1);
                    continue;
                }

                const dow = curr.getDay(); // 0=Sun, 6=Sat
                let matchesFilter = false;

                if (dayFilter === 'all') matchesFilter = true;
                else if (dayFilter === 'mon_sat' && dow !== 0) matchesFilter = true;
                else if (dayFilter === 'mon_fri' && dow >= 1 && dow <= 5) matchesFilter = true;
                else if (dayFilter === 'saturday' && dow === 6) matchesFilter = true;
                else if (dayFilter === 'sunday' && dow === 0) matchesFilter = true;

                if (matchesFilter) {
                    // Suppress shift generation post resignation date
                    if (this.isEmployeeResignedOnDate(target, dateFullStr)) {
                        delete this.calendarData[periodKey]?.[target]?.[dStr];
                        continue;
                    }
                    // OFFICIAL NATIONAL HOLIDAY GUARD:
                    // Official National Holidays must not be overwritten with working shifts.
                    // (Note: Cuti Bersama dates are treated as normal working days so shifts CAN be assigned to them)
                    const isHoliday = this.isOfficialNationalHoliday(dateFullStr);
                    if (isHoliday && shiftId !== '') {
                        holidaySkipped++;
                    } else {
                        if (!this.calendarData[periodKey]) this.calendarData[periodKey] = {};
                        if (!this.calendarData[periodKey][target]) this.calendarData[periodKey][target] = {};

                        if (shiftId === '') {
                            delete this.calendarData[periodKey][target][dStr];
                        } else {
                            this.calendarData[periodKey][target][dStr] = shiftId;
                        }
                        assigned++;
                    }
                }
                curr.setDate(curr.getDate() + 1);
            }
        });

        await this.saveCalendar();

        const shift = this.shifts.find(s => s.id === shiftId);
        const shiftName = shift ? shift.name : (shiftId === '' ? 'Kosongkan' : shiftId);
        let note = `✅ Shift "${shiftName}" berhasil di-assign ke ${targets.length} target (${assigned} hari-target).`;
        if (holidaySkipped > 0) {
            note += `\n🇮🇩 ${holidaySkipped} tanggal merah (Libur Nasional) otomatis dilindungi dari bentrokan shift.`;
        }
        if (historicalSkipped > 0) {
            note += `\n🔒 ${historicalSkipped} entri pada bulan historis dilewati (data terkunci/read-only).`;
        }

        if (window.showToast) {
            window.showToast(note, 'success');
        } else {
            alert(note);
        }
        this.render();
    },

    // ─── Render ───────────────────────────────────────────
    render() {
        const mainContent = document.getElementById('main-content');
        if (!mainContent) return;
        const departments = Storage.getDepartments ? Storage.getDepartments() : (Storage.get(Storage.KEYS.DEPARTMENTS) || []);
        const employees = Storage.getEmployees();

        const [year, month] = this.currentYearMonth.split('-');
        const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
        const firstDayIdx = new Date(parseInt(year), parseInt(month) - 1, 1).getDay();
        const isHistorical = this.isHistoricalMonth(this.currentYearMonth);

        mainContent.innerHTML = `
            <div class="page-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                <div>
                    <h1 class="page-title">📅 Kalender Kerja</h1>
                    <p class="page-subtitle">Atur jadwal shift departemen atau karyawan per bulan (Libur Nasional & Salin Jadwal Bulan Lalu)</p>
                </div>
                ${isHistorical ? `
                    <div style="background: rgba(217, 119, 6, 0.2); color: #f59e0b; border: 1px solid #d97706; padding: 6px 14px; border-radius: 20px; font-size: 0.85rem; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
                        🔒 Data Historis Bulan ${this.currentYearMonth} Terkunci (Read-Only)
                    </div>
                ` : ''}
            </div>

            <!-- ── Filter Bar ── -->
            <div class="card" style="margin-bottom: 1.5rem;">
                <div class="card-body" style="display: flex; gap: 1rem; flex-wrap: wrap; align-items: flex-end; justify-content: space-between;">
                    <div style="display: flex; gap: 1rem; flex-wrap: wrap; align-items: flex-end;">
                        <div class="form-group" style="min-width: 150px; margin-bottom: 0;">
                            <label class="form-label">Bulan/Tahun</label>
                            <input type="month" class="form-input" value="${this.currentYearMonth}" onchange="WorkCalendar.setYearMonth(this.value)">
                        </div>
                        <div class="form-group" style="min-width: 260px; margin-bottom: 0;">
                            <label class="form-label">Lihat Kalender (Dept/Karyawan)</label>
                            <select class="form-select" onchange="WorkCalendar.setTarget(this.value)">
                                <option value="">-- Pilih Target --</option>
                                <optgroup label="Departemen (7 Departemen Utama)">
                                    ${departments.map(d => `<option value="DEPT:${d.code}" ${this.currentTarget === 'DEPT:' + d.code ? 'selected' : ''}>${d.name}</option>`).join('')}
                                </optgroup>
                                <optgroup label="Karyawan">
                                    ${employees.map(e => `<option value="EMP:${e.id || e.nik}" ${this.currentTarget === 'EMP:' + (e.id || e.nik) ? 'selected' : ''}>${e.nik || e.id} - ${e.name}</option>`).join('')}
                                </optgroup>
                            </select>
                        </div>
                        <div style="display: flex; gap: 0.5rem; margin-bottom: 0; flex-wrap: wrap;">
                            <button class="btn btn-primary" onclick="WorkCalendar.showBulkModal()" style="white-space: nowrap;" ${isHistorical ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
                                ⚡ Atur Massal (Bulk)
                            </button>
                            <button class="btn btn-secondary" onclick="WorkCalendar.rolloverPreviousMonth(WorkCalendar.currentYearMonth)" title="Salin otomatis jadwal shift rutin dari bulan lalu" style="white-space: nowrap;" ${isHistorical ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
                                📋 Salin Jadwal Bulan Lalu
                            </button>
                            <button class="btn" onclick="WorkCalendar.showCompanyDayoffModal()" title="Tetapkan hari kerja yang diliburkan mendadak karena pemadaman/musibah" style="white-space: nowrap; background: #f59e0b; color: #18181b; font-weight: 600;">
                                ⚡ Libur Khusus (Day-Off Perusahaan)
                            </button>
                        </div>
                    </div>
                    <div style="margin-bottom: 0;">
                        <button class="btn btn-success" onclick="WorkCalendar.saveCalendarManual()" style="white-space: nowrap; font-weight: bold;" ${isHistorical ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
                            💾 Simpan & Lock Setting
                        </button>
                    </div>
                </div>
            </div>

            <!-- ── Calendar ── -->
            ${this.currentTarget ? `
            <div class="calendar-grid-container card">
                <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                    <h3>Kalender ${this.currentTarget.startsWith('DEPT:') ? 'Departemen' : 'Karyawan'}: ${this.currentTarget.split(':')[1]}</h3>
                    <div style="font-size: 0.78rem; color: var(--text-secondary);">
                        ${isHistorical ? '🔒 Data bulan historis ini bersifat Read-Only' : '💡 Libur Nasional & Libur Khusus Perusahaan (Day-Off) dihitung sebagai <strong>Paid Non-Working Day</strong>.'}
                    </div>
                </div>
                <div class="card-body">
                    <div style="display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; font-weight: bold; padding-bottom: 10px; border-bottom: 1px solid var(--border-color);">
                        <div style="color: #ef4444;">Minggu</div>
                        <div>Senin</div><div>Selasa</div><div>Rabu</div><div>Kamis</div><div>Jumat</div>
                        <div style="color: #3b82f6;">Sabtu</div>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px; margin-top: 10px;">
                        ${this.renderCalendarDays(firstDayIdx, daysInMonth)}
                    </div>
                </div>
            </div>
            ` : `<div class="card" style="padding: 3rem; text-align: center; color: var(--text-secondary);">
                    Pilih Departemen atau Karyawan untuk melihat kalender, atau gunakan <strong>⚡ Atur Massal</strong> untuk mengisi jadwal beberapa dept sekaligus.
                 </div>`}
        `;
    },

    renderCalendarDays(firstDayIdx, daysInMonth) {
        let html = '';
        for (let i = 0; i < firstDayIdx; i++) {
            html += '<div style="height: 95px;"></div>';
        }

        // Primary: data keyed by currentTarget (EMP:ID or DEPT:CODE)
        const monthData = this.calendarData[this.currentYearMonth] || {};
        const directScheduled = monthData[this.currentTarget] || {};

        // Fallback: if viewing an employee (EMP:ID), also look up the DEPT:CODE data
        let deptScheduled = {};
        if (this.currentTarget.startsWith('EMP:')) {
            const empId = this.currentTarget.slice(4);
            const employees = Storage.getEmployees();
            const emp = employees.find(e => String(e.id) === String(empId) || String(e.nik) === String(empId));
            if (emp && emp.department) {
                const deptCode = Storage.getDepartmentCode ? Storage.getDepartmentCode(emp.department) : emp.department;
                deptScheduled = monthData['DEPT:' + deptCode] || monthData['DEPT:' + emp.department] || {};
            }
        }

        // Merge: direct EMP assignment takes priority over DEPT assignment
        const scheduled = Object.assign({}, deptScheduled, directScheduled);
        const [year, month] = this.currentYearMonth.split('-');
        const isHistorical = this.isHistoricalMonth(this.currentYearMonth);

        for (let day = 1; day <= daysInMonth; day++) {
            const dayStr = String(day).padStart(2, '0');
            const dateFullStr = `${this.currentYearMonth}-${dayStr}`;
            const shiftId = scheduled[dayStr];
            const shift = this.shifts.find(s => s.id === shiftId);
            const dow = new Date(parseInt(year), parseInt(month) - 1, day).getDay();
            const isWeekend = (dow === 0 || dow === 6);

            const isNationalHoliday = this.isOfficialNationalHoliday(dateFullStr);
            const isCutiBersamaDate = this.isCutiBersama(dateFullStr);
            const isCompanyDayoffDate = Storage.isCompanyDayoff ? Storage.isCompanyDayoff(dateFullStr) : false;
            const companyDayoffRec = isCompanyDayoffDate && Storage.getCompanyDayoffRecord ? Storage.getCompanyDayoffRecord(dateFullStr) : null;
            const holidayRec = this.getHolidayRecord(dateFullStr);
            const isRedDay = isWeekend || isNationalHoliday;

            const cardBg = isNationalHoliday
                ? 'background: rgba(239, 68, 68, 0.14); border: 1px solid rgba(239, 68, 68, 0.5);'
                : (isCompanyDayoffDate ? 'background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.5);' : (isWeekend ? 'background: rgba(239, 68, 68, 0.05);' : (isCutiBersamaDate ? 'background: rgba(59, 130, 246, 0.04);' : '')));

            const isBlockedCell = isHistorical || isNationalHoliday;
            const cursorStyle = isBlockedCell ? 'cursor: not-allowed; opacity: 0.9;' : 'cursor: pointer;';

            html += `
                <div style="height: 95px; border: 1px solid var(--border-color); border-radius: 6px; padding: 5px;
                            background: var(--bg-secondary); ${cardBg} ${cursorStyle} transition: transform .1s;"
                     onclick="WorkCalendar.showShiftPicker(${day})"
                     onmouseenter="${isBlockedCell ? '' : "this.style.transform='scale(1.03)'"}" onmouseleave="${isBlockedCell ? '' : "this.style.transform='scale(1)'"}">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: bold; font-size: 0.85rem; color: ${isRedDay ? '#ef4444' : 'inherit'};">${day}</span>
                        ${isNationalHoliday ? `<span style="font-size: 9px; background: #ef4444; color: white; padding: 1px 5px; border-radius: 3px; font-weight: bold;" title="${holidayRec?.name || 'Libur Nasional'}">🇮🇩 Libur</span>` : ''}
                        ${isCompanyDayoffDate ? `<span style="font-size: 9px; background: #f59e0b; color: #78350f; font-weight: bold; padding: 1px 4px; border-radius: 3px;" title="${companyDayoffRec?.name}: ${companyDayoffRec?.reason}">⚡ Dayoff</span>` : ''}
                        ${isCutiBersamaDate && !isCompanyDayoffDate ? `<span style="font-size: 9px; background: #3b82f6; color: white; padding: 1px 4px; border-radius: 3px;" title="${holidayRec?.name || 'Cuti Bersama (Kerja Normal)'}">CB (Kerja)</span>` : ''}
                    </div>
                    ${isNationalHoliday ? `
                        <div style="color: #ef4444; font-weight: bold; border-radius: 4px; padding: 4px 5px; margin-top: 4px; font-size: 0.68rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; background: rgba(239, 68, 68, 0.18);">
                            🇮🇩 ${holidayRec?.name || 'Libur Nasional'}
                        </div>
                    ` : (isCompanyDayoffDate ? `
                        <div style="color: #d97706; font-weight: bold; border-radius: 4px; padding: 3px 4px; margin-top: 4px; font-size: 0.68rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; background: rgba(245, 158, 11, 0.2);">
                            ⚡ ${companyDayoffRec?.name || 'Libur Khusus (Paid)'}
                        </div>
                    ` : (shift ? `
                        <div style="background: var(--color-primary); color: white; border-radius: 4px;
                                     padding: 3px 4px; margin-top: 4px; font-size: 0.7rem;
                                     overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            ${shift.name}<br>${shift.startTime}-${shift.endTime}
                        </div>
                    ` : `<div style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 4px;">(Libur/Default)</div>`))}
                </div>
            `;
        }
        return html;
    },

    showShiftPicker(day) {
        const dayStr = String(day).padStart(2, '0');
        const dateFullStr = `${this.currentYearMonth}-${dayStr}`;
        const holidayRec = this.getHolidayRecord(dateFullStr);

        if (this.isOfficialNationalHoliday(dateFullStr)) {
            const msg = `🔒 Tanggal ${day} (${holidayRec?.name || 'Libur Nasional'}) adalah Hari Libur Nasional resmi yang dikunci otomatis oleh sistem. Shift kerja tidak dapat ditugaskan pada tanggal merah ini.`;
            if (window.showToast) window.showToast(msg, 'warning');
            else alert(msg);
            return;
        }

        if (this.isHistoricalMonth(this.currentYearMonth)) {
            const msg = `🔒 Bulan ${this.currentYearMonth} adalah data historis yang sudah terkunci (read-only) dan tidak dapat diubah.`;
            if (window.showToast) window.showToast(msg, 'warning');
            else alert(msg);
            return;
        }

        // Use same fallback logic as renderCalendarDays: DEPT data merged under EMP data
        const monthData = this.calendarData[this.currentYearMonth] || {};
        const directScheduled = monthData[this.currentTarget] || {};
        let deptScheduled = {};
        if (this.currentTarget.startsWith('EMP:')) {
            const empId = this.currentTarget.slice(4);
            const emp = (Storage.getEmployees() || []).find(e => e.id === empId);
            if (emp && emp.department) {
                deptScheduled = monthData['DEPT:' + emp.department] || {};
            }
        }
        const scheduled = Object.assign({}, deptScheduled, directScheduled);
        const currentShiftId = scheduled[String(day).padStart(2, '0')] || '';

        const el = document.createElement('div');
        el.className = 'modal-overlay';
        el.innerHTML = `
            <div class="modal" style="max-width: 320px;">
                <div class="modal-header">
                    <h3 class="modal-title">Pilih Shift â Tanggal ${day}</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                        <button class="btn ${currentShiftId === '' ? 'btn-danger' : 'btn-secondary'}"
                                onclick="WorkCalendar.assignShift(${day}, ''); this.closest('.modal-overlay').remove();">
                            ð« Kosongkan / Libur
                        </button>
                        ${this.shifts.map(s => `
                            <button class="btn ${currentShiftId === s.id ? 'btn-primary' : 'btn-secondary'}"
                                    onclick="WorkCalendar.assignShift(${day}, '${s.id}'); this.closest('.modal-overlay').remove();">
                                ð ${s.name} (${s.startTime}â${s.endTime})
                            </button>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(el);
    },

    // âââ Bulk Modal âââââââââââââââââââââââââââââââââââââââââââââââ
    showBulkModal() {
        const departments = Storage.getDepartments ? Storage.getDepartments() : (Storage.get(Storage.KEYS.DEPARTMENTS) || []);
        const employees = Storage.getEmployees() || [];

        // Match depts to preset groups
        const getGroupForDept = (dept) => {
            const label = (dept.name || '').toLowerCase();
            for (const g of this.DEPT_GROUPS) {
                if (g.keywords.some(kw => label.includes(kw))) return g.id;
            }
            return 'other';
        };

        const grouped = {};
        this.DEPT_GROUPS.forEach(g => { grouped[g.id] = []; });
        grouped['other'] = [];
        departments.forEach(d => { grouped[getGroupForDept(d)].push(d); });

        const [y, m] = this.currentYearMonth.split('-');
        const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
        const defaultStart = `${this.currentYearMonth}-01`;
        const defaultEnd = `${this.currentYearMonth}-${lastDay}`;

        const renderGroup = (groupId, groupLabel, groupColor, depts) => {
            if (depts.length === 0) return '';
            return `
                <div style="margin-bottom: 0.75rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem;">
                        <span style="font-weight: 600; color: ${groupColor}; font-size: 0.85rem;">${groupLabel}</span>
                        <button type="button" class="btn btn-sm" style="padding: 2px 6px; font-size: 0.68rem;"
                                onclick="WorkCalendar._toggleGroup('${groupId}', true)">Pilih Semua</button>
                        <button type="button" class="btn btn-sm btn-secondary" style="padding: 2px 6px; font-size: 0.68rem;"
                                onclick="WorkCalendar._toggleGroup('${groupId}', false)">Batal</button>
                    </div>
                    <div class="bulk-group" data-group="${groupId}" style="display: flex; flex-wrap: wrap; gap: 0.4rem;">
                        ${depts.map(d => `
                            <label style="display: flex; align-items: center; gap: 0.3rem; background: var(--bg-secondary);
                                          border: 1px solid var(--border-color); border-radius: 6px; padding: 4px 10px;
                                          cursor: pointer; font-size: 0.8rem; white-space: nowrap;">
                                <input type="checkbox" name="bulk_target" value="DEPT:${d.code}" data-group="${groupId}"
                                       style="accent-color: ${groupColor};">
                                ${d.name}
                            </label>
                        `).join('')}
                    </div>
                </div>
            `;
        };

        const el = document.createElement('div');
        el.className = 'modal-overlay';
        el.id = 'bulk-assign-modal';
        el.innerHTML = `
            <div class="modal" style="max-width: 720px; width: 95%; max-height: 90vh; display: flex; flex-direction: column;">
                <div class="modal-header">
                    <h3 class="modal-title">â¡ Atur Massal Shift (Rotasi & Override Friendly)</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                </div>
                <div class="modal-body" style="overflow-y: auto; flex: 1; padding-right: 10px;">
                    <!-- Step 1: Pilih Shift -->
                    <div style="margin-bottom: 1.2rem;">
                        <label style="font-weight: 600; display: block; margin-bottom: 0.4rem; font-size: 0.9rem;">â  Pilih Shift yang Akan Diterapkan</label>
                        <select id="bulk-shift-select" class="form-select">
                            <option value="">-- Pilih Shift --</option>
                            ${this.shifts.map(s => `<option value="${s.id}">ð ${s.name} (${s.startTime}â${s.endTime})</option>`).join('')}
                            <option value="__clear__">ð« Kosongkan / Hapus Shift</option>
                        </select>
                    </div>

                    <!-- Step 2: Pilih Rentang Tanggal & Filter Hari -->
                    <div style="margin-bottom: 1.2rem; background: var(--bg-secondary); padding: 12px; border-radius: 8px;">
                        <label style="font-weight: 600; display: block; margin-bottom: 0.6rem; font-size: 0.9rem;">â¡ Atur Rentang Tanggal & Filter Hari</label>
                        <div style="display: flex; gap: 1rem; margin-bottom: 0.8rem;">
                            <div style="flex: 1;">
                                <span style="font-size: 0.78rem; font-weight: bold; color: var(--text-secondary);">Mulai Tanggal</span>
                                <input type="date" id="bulk-start-date" class="form-input" value="${defaultStart}">
                            </div>
                            <div style="flex: 1;">
                                <span style="font-size: 0.78rem; font-weight: bold; color: var(--text-secondary);">Sampai Tanggal</span>
                                <input type="date" id="bulk-end-date" class="form-input" value="${defaultEnd}">
                            </div>
                        </div>
                        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                            <label style="display: flex; align-items: center; gap: 0.3rem; cursor: pointer; padding: 4px 10px; border: 1px solid var(--border-color); border-radius: 12px; font-size: 0.78rem; background: var(--bg-primary);">
                                <input type="radio" name="bulk_mode" value="all" checked> Semua Hari
                            </label>
                            <label style="display: flex; align-items: center; gap: 0.3rem; cursor: pointer; padding: 4px 10px; border: 1px solid var(--border-color); border-radius: 12px; font-size: 0.78rem; background: var(--bg-primary);">
                                <input type="radio" name="bulk_mode" value="mon_sat"> SeninâSabtu
                            </label>
                            <label style="display: flex; align-items: center; gap: 0.3rem; cursor: pointer; padding: 4px 10px; border: 1px solid var(--border-color); border-radius: 12px; font-size: 0.78rem; background: var(--bg-primary);">
                                <input type="radio" name="bulk_mode" value="mon_fri"> SeninâJumat
                            </label>
                            <label style="display: flex; align-items: center; gap: 0.3rem; cursor: pointer; padding: 4px 10px; border: 1px solid var(--border-color); border-radius: 12px; font-size: 0.78rem; background: var(--bg-primary);">
                                <input type="radio" name="bulk_mode" value="saturday"> Sabtu Saja
                            </label>
                            <label style="display: flex; align-items: center; gap: 0.3rem; cursor: pointer; padding: 4px 10px; border: 1px solid var(--border-color); border-radius: 12px; font-size: 0.78rem; background: var(--bg-primary);">
                                <input type="radio" name="bulk_mode" value="sunday"> Minggu Saja
                            </label>
                        </div>
                    </div>

                    <!-- Step 3: Pilih Target -->
                    <div style="margin-bottom: 1.2rem;">
                        <label style="font-weight: 600; display: block; margin-bottom: 0.5rem; font-size: 0.9rem;">â¢ Pilih Target (Departemen atau Karyawan)</label>
                        
                        <!-- Tab Headers -->
                        <div style="display: flex; border-bottom: 2px solid var(--border-color); margin-bottom: 0.8rem; gap: 1rem;">
                            <button type="button" id="tab-btn-depts" class="btn" style="background:none; border:none; border-bottom:3px solid #4f46e5; border-radius:0; padding:6px 12px; font-weight:bold; color:var(--text-primary);" onclick="document.getElementById('bulk-depts-section').style.display='block'; document.getElementById('bulk-emps-section').style.display='none';">ð¢ Departemen</button>
                            <button type="button" id="tab-btn-emps" class="btn" style="background:none; border:none; border-radius:0; padding:6px 12px; font-weight:bold; color:var(--text-secondary);" onclick="document.getElementById('bulk-depts-section').style.display='none'; document.getElementById('bulk-emps-section').style.display='block';">ð¤ Karyawan (Searchable)</button>
                        </div>

                        <!-- Departemen Selection Section -->
                        <div id="bulk-depts-section">
                            <div style="display: flex; justify-content: flex-end; gap: 0.4rem; margin-bottom: 0.5rem;">
                                <button type="button" class="btn btn-sm" onclick="WorkCalendar._toggleAll(true)">Pilih Semua Dept</button>
                                <button type="button" class="btn btn-sm btn-secondary" onclick="WorkCalendar._toggleAll(false)">Hapus Semua Dept</button>
                            </div>
                            ${this.DEPT_GROUPS.map(g => renderGroup(g.id, g.label, g.color, grouped[g.id])).join('')}
                            ${grouped['other'].length > 0 ? renderGroup('other', 'ð Lainnya', '#6b7280', grouped['other']) : ''}
                        </div>

                        <!-- Karyawan (Searchable) Section -->
                        <div id="bulk-emps-section" style="display: none;">
                            <div style="margin-bottom: 0.6rem; display: flex; gap: 0.5rem;">
                                <input type="text" id="emp-search-input" class="form-input" placeholder="ð Cari nama karyawan..." oninput="WorkCalendar._filterEmployees(this.value)">
                                <button type="button" class="btn btn-sm btn-secondary" onclick="document.querySelectorAll('input[name=\'bulk_target\'][data-type=\'emp\']').forEach(cb => cb.checked = false); WorkCalendar._updateBulkSummary();">Clear</button>
                            </div>
                            <div style="max-height: 180px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 6px; padding: 8px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.4rem;" id="emp-checkboxes-container">
                                ${employees.map(e => `
                                    <label class="emp-item-label" data-name="${e.name.toLowerCase()}" style="display: flex; align-items: center; gap: 0.3rem; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px; padding: 4px 8px; cursor: pointer; font-size: 0.8rem;">
                                        <input type="checkbox" name="bulk_target" value="EMP:${e.id}" data-type="emp">
                                        <div>
                                            <div style="font-weight:bold;">${e.name}</div>
                                            <div style="font-size:10px; color:var(--text-secondary);">${e.id} | ${e.department}</div>
                                        </div>
                                    </label>
                                `).join('')}
                            </div>
                        </div>
                    </div>

                    <!-- Summary -->
                    <div id="bulk-summary" style="background: var(--bg-secondary); border: 1px solid var(--border-color);
                                                   border-radius: 8px; padding: 0.75rem; font-size: 0.85rem; margin-bottom: 1rem;
                                                   color: var(--text-secondary);">
                        Pilih shift dan target di atas untuk melihat ringkasan.
                    </div>
                </div>
                <div class="modal-footer" style="padding: 12px 24px;">
                    <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Batal</button>
                    <button class="btn btn-primary" onclick="WorkCalendar._executeBulk()" style="min-width: 140px;">
                        â¡ Terapkan Sekarang
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(el);

        const deptsBtn = el.querySelector('#tab-btn-depts');
        const empsBtn = el.querySelector('#tab-btn-emps');
        deptsBtn.addEventListener('click', () => {
            deptsBtn.style.color = 'var(--text-primary)';
            deptsBtn.style.borderBottom = '3px solid #4f46e5';
            empsBtn.style.color = 'var(--text-secondary)';
            empsBtn.style.borderBottom = 'none';
        });
        empsBtn.addEventListener('click', () => {
            empsBtn.style.color = 'var(--text-primary)';
            empsBtn.style.borderBottom = '3px solid #4f46e5';
            deptsBtn.style.color = 'var(--text-secondary)';
            deptsBtn.style.borderBottom = 'none';
        });

        // Live summary update
        el.addEventListener('change', () => this._updateBulkSummary());
        this._updateBulkSummary();
    },

    _filterEmployees(queryStr) {
        const q = queryStr.toLowerCase().trim();
        const items = document.querySelectorAll('#emp-checkboxes-container .emp-item-label');
        items.forEach(item => {
            const name = item.dataset.name || '';
            if (name.includes(q)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    },

    _toggleGroup(groupId, checked) {
        document.querySelectorAll(`input[name="bulk_target"][data-group="${groupId}"]`).forEach(cb => {
            cb.checked = checked;
        });
        this._updateBulkSummary();
    },

    _toggleAll(checked) {
        document.querySelectorAll('input[name="bulk_target"]').forEach(cb => { cb.checked = checked; });
        this._updateBulkSummary();
    },

    _updateBulkSummary() {
        const summary = document.getElementById('bulk-summary');
        if (!summary) return;
        const targets = [...document.querySelectorAll('input[name="bulk_target"]:checked')].map(cb => cb.value);
        const shiftId = document.getElementById('bulk-shift-select')?.value;
        const startDate = document.getElementById('bulk-start-date')?.value;
        const endDate = document.getElementById('bulk-end-date')?.value;
        const mode = document.querySelector('input[name="bulk_mode"]:checked')?.value || 'all';
        const shift = this.shifts.find(s => s.id === shiftId);
        const modeLabel = { mon_sat: 'SeninâSabtu', mon_fri: 'SeninâJumat', saturday: 'Sabtu Saja', sunday: 'Minggu Saja', weekends: 'SabtuâMinggu', all: 'Semua Hari' };

        if (targets.length === 0 || !shiftId) {
            summary.innerHTML = 'Pilih shift dan target di atas untuk melihat ringkasan.';
            summary.style.color = 'var(--text-secondary)';
            return;
        }

        const deptsCount = targets.filter(t => t.startsWith('DEPT:')).length;
        const empsCount = targets.filter(t => t.startsWith('EMP:')).length;

        summary.style.color = 'var(--text-primary)';
        summary.innerHTML = `
            <strong>ð Ringkasan:</strong><br>
            â¢ Shift: <strong>${shiftId === '__clear__' ? 'ð« Kosongkan' : (shift ? shift.name + ' (' + shift.startTime + 'â' + shift.endTime + ')' : shiftId)}</strong><br>
            â¢ Rentang: <strong>${startDate} s/d ${endDate}</strong> (${modeLabel[mode]})<br>
            â¢ Target: <strong>${deptsCount} Departemen & ${empsCount} Karyawan</strong>
        `;
    },

    async _executeBulk() {
        const targets = [...document.querySelectorAll('input[name="bulk_target"]:checked')].map(cb => cb.value);
        const shiftId = document.getElementById('bulk-shift-select')?.value;
        const startDate = document.getElementById('bulk-start-date')?.value;
        const endDate = document.getElementById('bulk-end-date')?.value;
        const mode = document.querySelector('input[name="bulk_mode"]:checked')?.value || 'all';

        if (!shiftId) { alert('Pilih shift terlebih dahulu.'); return; }
        if (targets.length === 0) { alert('Pilih minimal 1 departemen/karyawan.'); return; }
        if (!startDate || !endDate) { alert('Tentukan rentang tanggal.'); return; }

        const realShiftId = shiftId === '__clear__' ? '' : shiftId;

        document.getElementById('bulk-assign-modal')?.remove();
        await this.bulkAssignShift(targets, realShiftId, startDate, endDate, mode);
    },

    // ─── Company Emergency Day-off Management ───
    showCompanyDayoffModal() {
        const modalId = 'company-dayoff-modal';
        let modal = document.getElementById(modalId);
        if (!modal) {
            modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'modal-overlay hidden';
            document.body.appendChild(modal);
        }

        const currentMonthDayoffs = Storage.getCompanyDayoffs ? Storage.getCompanyDayoffs().filter(d => d.date && d.date.startsWith(this.currentYearMonth)) : [];
        const today = new Date().toISOString().split('T')[0];

        modal.innerHTML = `
            <div class="modal" style="max-width: 580px; background: #181B22; border: 1px solid #374151; border-radius: 12px; color: white;">
                <div class="modal-header" style="background: transparent; border-bottom: 1px solid #374151; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center;">
                    <h3 class="modal-title" style="color: #f59e0b; font-size: 18px; font-weight: 600; margin: 0;">⚡ Libur Khusus Perusahaan (Emergency Day-Off)</h3>
                    <button class="modal-close" onclick="WorkCalendar.closeCompanyDayoffModal()" style="color: #9ca3af; background: none; border: none; font-size: 24px; cursor: pointer; line-height: 1;">×</button>
                </div>
                <div class="modal-body" style="padding: 20px;">
                    <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); color: #fbbf24; padding: 10px 14px; border-radius: 8px; font-size: 12px; line-height: 1.5; margin-bottom: 16px;">
                        <strong>📌 Ketentuan Libur Khusus / Day-Off Perusahaan:</strong><br>
                        • Digunakan jika perusahaan meliburkan hari kerja secara mendadak/insidental (misal: <strong>Pemadaman Listrik PLN, Bencana/Banjir, Keputusan Direksi</strong>).<br>
                        • Hari yang diliburkan dihitung sebagai <strong>Hari Libur Berbayar (Paid Non-Working Day)</strong>, tidak memotong jatah cuti tahunan, dan tidak dianggap alpa pada Payroll.
                    </div>

                    <form id="formCompanyDayoff" onsubmit="event.preventDefault(); WorkCalendar.submitCompanyDayoffForm();">
                        <div class="grid-2" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;">
                            <div class="form-group">
                                <label class="block text-xs font-medium text-gray-400 mb-1" style="display: block; font-size: 12px; color: #9ca3af; margin-bottom: 4px;">TANGGAL LIBUR KHUSUS *</label>
                                <input type="date" id="cdo-date" class="form-input" style="width: 100%; background: #212631; border: 1px solid #374151; border-radius: 8px; padding: 8px 10px; color: white; font-size: 14px;" value="${today}" required>
                            </div>
                            <div class="form-group">
                                <label class="block text-xs font-medium text-gray-400 mb-1" style="display: block; font-size: 12px; color: #9ca3af; margin-bottom: 4px;">STATUS PEMBAYARAN GAJI</label>
                                <select id="cdo-paid" class="form-select" style="width: 100%; background: #212631; border: 1px solid #374151; border-radius: 8px; padding: 8px 10px; color: white; font-size: 14px;">
                                    <option value="true" selected>Gaji Dibayar Penuh (Paid Day-Off)</option>
                                    <option value="false">Tidak Dibayar (Unpaid Day-Off)</option>
                                </select>
                            </div>
                        </div>

                        <div class="form-group mb-3" style="margin-bottom: 14px;">
                            <label class="block text-xs font-medium text-gray-400 mb-1" style="display: block; font-size: 12px; color: #9ca3af; margin-bottom: 4px;">JUDUL / NAMA HARI LIBUR *</label>
                            <input type="text" id="cdo-name" class="form-input" style="width: 100%; background: #212631; border: 1px solid #374151; border-radius: 8px; padding: 8px 10px; color: white; font-size: 14px;" placeholder="Contoh: Pemadaman Listrik PLN Pabrik" required>
                        </div>

                        <div class="form-group mb-4" style="margin-bottom: 16px;">
                            <label class="block text-xs font-medium text-gray-400 mb-1" style="display: block; font-size: 12px; color: #9ca3af; margin-bottom: 4px;">ALASAN / CATATAN KHUSUS *</label>
                            <textarea id="cdo-reason" rows="2" class="form-input" style="width: 100%; background: #212631; border: 1px solid #374151; border-radius: 8px; padding: 8px 10px; color: white; font-size: 13px;" placeholder="Tuliskan penyebab atau dasar instruksi libur operasional pabrik..." required></textarea>
                        </div>

                        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-bottom: 20px;">
                            <button type="submit" class="btn btn-warning" style="padding: 8px 20px; background: #f59e0b; color: #18181b; font-weight: bold; border: none; border-radius: 8px; cursor: pointer;">
                                ➕ Tetapkan Libur Khusus
                            </button>
                        </div>
                    </form>

                    <div style="border-top: 1px solid #374151; padding-top: 14px;">
                        <h4 style="font-size: 13px; font-weight: 600; color: #d1d5db; margin-bottom: 8px;">Daftar Libur Khusus Bulan Ini (${this.currentYearMonth}):</h4>
                        ${currentMonthDayoffs.length === 0 ? '<p style="font-size: 12px; color: #6b7280;">Belum ada hari libur khusus yang ditetapkan pada bulan ini.</p>' : `
                            <div style="max-height: 140px; overflow-y: auto;">
                                ${currentMonthDayoffs.map(d => `
                                    <div style="display: flex; justify-content: space-between; align-items: center; background: #212631; padding: 8px 12px; border-radius: 6px; margin-bottom: 6px; font-size: 12px;">
                                        <div>
                                            <strong style="color: #fbbf24;">${d.date}</strong> - <span>${d.name}</span><br>
                                            <small style="color: #9ca3af;">${d.reason} (${d.isPaid ? 'Paid' : 'Unpaid'})</small>
                                        </div>
                                        <button type="button" class="btn btn-sm btn-danger" onclick="WorkCalendar.deleteCompanyDayoff('${d.id}')" style="padding: 3px 8px; font-size: 11px;">Hapus</button>
                                    </div>
                                `).join('')}
                            </div>
                        `}
                    </div>
                </div>
            </div>
        `;

        modal.classList.remove('hidden');
    },

    closeCompanyDayoffModal() {
        const modal = document.getElementById('company-dayoff-modal');
        if (modal) modal.classList.add('hidden');
    },

    submitCompanyDayoffForm() {
        const date = document.getElementById('cdo-date')?.value;
        const name = document.getElementById('cdo-name')?.value;
        const reason = document.getElementById('cdo-reason')?.value;
        const isPaid = document.getElementById('cdo-paid')?.value === 'true';

        if (!date || !name || !reason) {
            alert('Lengkapi seluruh form sebelum menyimpan.');
            return;
        }

        if (Storage.addCompanyDayoff) {
            Storage.addCompanyDayoff({ date, name, reason, isPaid });
        }

        alert(`Hari libur khusus (${name}) pada tanggal ${date} berhasil ditetapkan.`);
        this.closeCompanyDayoffModal();
        this.render();
    },

    deleteCompanyDayoff(id) {
        if (!confirm('Hapus penetapan libur khusus perusahaan ini?')) return;
        if (Storage.deleteCompanyDayoff) {
            Storage.deleteCompanyDayoff(id);
        }
        alert('Hari libur khusus berhasil dihapus.');
        this.closeCompanyDayoffModal();
        this.render();
    }
};

window.WorkCalendar = WorkCalendar;

