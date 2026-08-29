# Testing & Verification

← [Blueprint INDEX](./INDEX.md)

---

## Konfigurasi

Jest dikonfigurasi inline di [package.json](../../package.json):

| Pengaturan | Nilai |
|---|---|
| `testEnvironment` | `jsdom` |
| `setupFilesAfterEach` | [tests/setup.js](../../tests/setup.js) |
| `testMatch` | `**/tests/**/*.test.js`, `**/tests/**/*.spec.js` |
| `collectCoverageFrom` | `modules/**/*.js`, `data/**/*.js` |

`collectCoverageFrom` **tidak menyertakan `src/`**. Cakupan yang dilaporkan mengukur mesin legacy, bukan aplikasi yang dipakai user. Jangan mengutip angka coverage sebagai bukti bahwa halaman React aman.

[tests/setup.js](../../tests/setup.js) memasang mock `localStorage`, `alert`, `confirm` (selalu `true`), dan `prompt`, lalu membersihkannya di `beforeEach`. Artinya: `window.confirm()` di kode selalu dianggap "ya" dalam test — jalur pembatalan tidak teruji kecuali mock-nya diubah eksplisit.

---

## Perintah

```bash
npm run test:unit
```

```bash
npm test
```

| Perintah | Cakupan |
|---|---|
| `npm test` | Seluruh `tests/` |
| `npm run test:unit` | 25 file di `tests/unit/` |
| `npm run test:integration` | 2 file di `tests/integration/` |
| `npm run test:coverage` | Laporan coverage (hanya `modules/` + `data/`) |
| `npm run test:e2e` | Cypress — **belum ada spec** |

---

## Apa yang sebenarnya ter-cover

| Area | Test |
|---|---|
| Payroll & HR | `payroll_cutoff` · `payroll_import` · `payroll_simulation_integration` · `payroll_email_broadcast` · `hr_workflows` · `work_calendar` |
| Refinery & produksi | `refinery_pooling` · `refinery_simulation` · `refining_math` · `gold_production` · `masterPurity` · `makloon_edit` |
| Akuntansi | `journalEntry` · `balanceSheet` · `finance_reports` |
| Voucher | `payment_voucher_habit` · `receipt_voucher_edit` · `payment_voucher_visibility` |
| Lain-lain | `inventory` · `kyc` · `hrd_crm` · `settings` · `dataProtection` · `lm_import_trading` |

Nyaris semuanya menguji modul **dorman**. Tidak ada satu pun test untuk `src/` — tidak ada test komponen, tidak ada test `storageService`, tidak ada test alur 2 tahap 1159→1157.

Konsekuensi praktis: `npm run test:unit` hijau **tidak** berarti perubahan di `src/` aman. Itu hanya berarti tidak ada regresi di mesin legacy.

---

## Verifikasi sebelum menyatakan selesai

Urutan minimum untuk perubahan di `src/`:

1. **Build** — `npm run build` harus lolos. Ini satu-satunya pemeriksaan sintaks otomatis yang ada di repo ini (tidak ada TypeScript, tidak ada ESLint).
2. **Jalankan** — `npm run dev`, buka halaman yang disentuh, konsol browser tanpa exception.
3. **Lakukan alurnya** — isi form, submit, cek record dan jurnalnya benar-benar tersimpan (`localStorage`, atau tab Buku Besar).
4. **Regresi legacy** — `npm run test:unit` bila `modules/` atau `data/` tersentuh.

Untuk perubahan di `modules/` atau `data/`, langkah 4 wajib dan tidak boleh dilewati.

Laporkan hasil verifikasi apa adanya: apa yang dijalankan, apa keluarannya, apa yang **tidak** diuji. Menyatakan "sudah dites" tanpa menjalankan apa pun adalah kesalahan paling mahal di repo ini — lihat [../knowledge/LEARN.md](../knowledge/LEARN.md).

---

## Menulis test baru

Untuk logika di `modules/` atau `data/`: ikuti pola yang ada di `tests/unit/` — `require()` modulnya, siapkan `localStorage` lewat mock, panggil fungsinya, periksa hasil.

Untuk `src/`: `@testing-library/dom` dan `@testing-library/jest-dom` sudah ada di devDependencies, tapi belum ada test React sama sekali dan tidak ada `@testing-library/react`. Membuat test React berarti menambah dependensi — konfirmasikan ke user dulu.

Kandidat test paling bernilai bila diminta menambah cakupan, berurutan:

1. Alur 2 tahap 1159→1157 — jurnal tahap 1 dan 2 seimbang dan memakai kode akun yang ada di COA
2. `storageService` — guard `window.Storage` tidak ada, kembalikan default aman
3. Saldo berjalan Buku Besar — urutan kronologis benar (bug yang masih hidup)
4. Kalkulasi landed cost impor — konversi oz→gram dan premium all-in

---

← [Blueprint INDEX](./INDEX.md)
