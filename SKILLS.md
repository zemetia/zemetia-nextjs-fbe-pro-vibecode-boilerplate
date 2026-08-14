# ⚡ Karpathy-Inspired Vibe Coding Guidelines

Petunjuk dan pedoman coding berbasis observasi **Andrej Karpathy** terhadap kebiasaan buruk LLM saat coding, untuk menghasilkan kode yang bersih, minim bloat, dan terverifikasi penuh.

---

## 1. Think Before Coding (Pikirkan Sebelum Mengetik Kode)
**Don't assume. Don't hide confusion. Surface tradeoffs.**

- **State Assumptions Explicitly**: Jika instruksi atau alur bisnis ambigu (seperti cicilan hutang, akun transit), nyatakan asumsi atau tanyakan secara eksplisit, jangan berasumsi diam-diam.
- **Surface Tradeoffs**: Jika ada beberapa pilihan desain (misal 1-tahap vs 2-tahap jurnal), paparkan kelebihan dan kekurangannya.
- **Push Back When Overcomplicated**: Jika ada solusi yang jauh lebih simpel dan elegan, sampaikan dan hindari overengineering.
- **Stop When Confused**: Jika bingung atau aturan berbenturan, berhenti dan diskusikan terlebih dahulu.

---

## 2. Simplicity First (Sederhana & Anti-Bloat)
**Minimum code that solves the problem. Nothing speculative.**

- **No Speculative Code**: Jangan membuat fitur, abstraksi, atau konfigurasi rumit yang belum diminta.
- **No Premature Abstraction**: Jangan membuat factory/helper berlapis untuk logika sekali pakai. Jika 50 baris cukup, jangan tulis 200 baris.
- **Senior Engineer Simplicity Test**: Selalu tanyakan: *"Apakah senior engineer akan menilai kode ini ringkas dan jelas, atau terlalu rumit tanpa alasan?"*

---

## 3. Surgical Changes (Perubahan Presisi Bedah)
**Touch only what you must. Clean up only your own mess.**

- **No Orthogonal Edits**: Jangan merombak/mengubah format kode, komentar, atau styling di sekitarnya yang tidak rusak dan tidak terkait dengan tugas.
- **Match Existing Style**: Ikuti arsitektur, nama variabel, dan gaya penulisan yang sudah ada dalam proyek.
- **Preserve Unrelated Logic**: Jangan menghapus komentar atau kode lama yang tidak berhubungan dengan tugas saat ini.

---

## 4. Goal-Driven Execution & Verification
**Define success criteria upfront and verify with concrete proof.**

- **Strict Verification**: Selalu jalankan `node -c`, `vite build`, dan unit test (`jest`) hingga 100% lulus sebelum menganggap tugas selesai.
- **Show Proof**: Sertakan bukti verifikasi nyata (build time, log testing, hasil eksekusi).
