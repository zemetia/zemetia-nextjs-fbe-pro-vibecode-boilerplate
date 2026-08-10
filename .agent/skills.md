# 🤖 AI Agent Skills: Tutorial & Registry

## 📖 Apa itu `skills.md`?
`skills.md` adalah **blueprint** atau buku panduan untuk sistem otonom ERP. File ini memberitahu kita (dan AI Assistant) apa saja tugas-tugas yang bisa dijalankan secara otomatis di balik layar.

---

##  Daftar Agent Saat Ini (General)

### 1. Asset Guardian (`asset_guardian`)
- **Trigger**: Otomatis saat masuk ke dashboard Fixed Assets.
- **Logic**: Hitung penyusutan bulanan yang belum tercatat.
- **Output**: Jurnal Otomatis (`DEPR-YYYY-MM`).

### 2. Risk Commander (`risk_commander`)
- **Trigger**: Setiap 30 menit.
- **Logic**: Cek risiko finansial (Kas < Limit atau Hutang > 80%).
- **Output**: Desktop Notification.

### 3. TTB Sentinel (`ttb_sentinel`)
- **Trigger**: Polling real-time.
- **Logic**: Cek Tanda Terima Barang yang belum di-approve > 24 jam.
- **Output**: Alert Notifikasi di Sidebar.

---

## 🎖️ Specialized Gold Refinery Agents (Business Critical)

### 4. Mass Balance Auditor (`mass_balance_agent`)
- **Trigger**: Penutupan Batch Produksi.
- **Data Source**: `JobOrder.js`, `ProductionBatch.js`.
- **Logic**: 
    - Bandingkan: `Berat Input` vs (`Berat Output` + `Loss yang diizinkan`).
    - Jika selisih (discrepancy) > 0.05g, buat alert "Potential Loss".
- **Output**: Notifikasi Audit ke Owner.

### 5. Purity Variance Detective (`purity_detective`)
- **Trigger**: Input hasil Assay Lab.
- **Data Source**: `LabQualityTest.js`.
- **Logic**: 
    - Bandingkan: `Kadar Estimasi Customer` vs `Kadar Aktual Lab`.
    - Tandai customer jika selisih kadar terlalu sering melenceng jauh.
- **Output**: Update Risk Level di Master Customer.

### 6. Recovery Hunter (`recovery_hunter`)
- **Trigger**: Input bulanan `Gold Dust Recovery`.
- **Logic**: Hitung efisiensi pengembalian emas dari debu/lantai dibandingkan total leburan.
- **Output**: Skor "Refinery Health" di Dashboard.

### 7. Gold Price Watcher (`price_exposure_agent`)
- **Trigger**: Perubahan harga emas harian.
- **Logic**: Hitung nilai total emas titipan (Custody) yang berisiko jika harga fluktuatif.
- **Output**: Notifikasi Strategi Hedging.
