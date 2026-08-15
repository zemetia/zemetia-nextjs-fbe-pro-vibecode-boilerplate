# Knowledge System

← [Blueprint INDEX](./INDEX.md)

Dua file di `docs/knowledge/` menyimpan konteks yang **tidak** bisa disimpulkan dari kode atau riwayat git.

| File | Isi | Kapan ditulis |
|---|---|---|
| [THIS.md](../knowledge/THIS.md) | Identitas proyek, realita lapangan PT TAN, gaya developer, do's & don'ts, insight berjalan | Setiap kali ada preferensi, pola, atau fakta bisnis baru yang terungkap |
| [LEARN.md](../knowledge/LEARN.md) | Log koreksi & kesalahan | Setiap kali user mengoreksi AI, **atau** AI sendiri menyadari menyimpang dari yang diminta |

---

## THIS.md — cara pakai

- Baca sebelum merencanakan pekerjaan, bersama seksi blueprint yang relevan.
- Entri baru masuk ke bagian **Insights** dengan awalan tanggal.
- Entri yang sudah tidak berlaku ditandai `~~coret~~` — **jangan dihapus**. Riwayat keputusan itu sendiri adalah informasi.
- Fakta bisnis dari lapangan (nama supplier, cara bayar, jalur kurir, struktur harga) masuk ke sini, bukan ke komentar kode.

## LEARN.md — format entri

```
[YYYY-MM-DD] - [apa yang salah] - [pendekatan yang benar] - [pelajaran yang bisa dipindahkan]
```

Satu baris per entri. Bagian terpenting adalah pelajarannya — bagian yang mencegah kesalahan yang sama terulang.

**Pemicu menulis:**

- User bilang AI salah, melakukan yang tidak diminta, atau meleset dari maksudnya.
- AI melanggar hard constraint di [INDEX.md](./INDEX.md) atau non-negotiable di [CLAUDE.md](../../CLAUDE.md).
- AI menambah sesuatu yang tidak diminta (file, abstraksi, dependensi, komentar).
- AI menyatakan sesuatu selesai/teruji tanpa menjalankan verifikasinya.
- AI memakai kode akun, kunci storage, atau nomor dokumen yang ternyata tidak ada.

---

## Prioritas

Sistem ini adalah lapisan konteks **paling penting** setelah `CLAUDE.md` sendiri. Urutannya:

1. Cek `THIS.md` untuk konteks proyek & developer sebelum setiap tugas.
2. Cek `LEARN.md` untuk kesalahan lampau sebelum menulis kode.
3. Tulis ke keduanya begitu ada pengetahuan baru — jangan menunggu akhir sesi.

---

← [Blueprint INDEX](./INDEX.md)
