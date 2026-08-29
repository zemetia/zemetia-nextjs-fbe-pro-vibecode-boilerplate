-- Harga satuan order penjualan: 4 → 8 desimal.
--
-- Harga inilah yang dihitung balik ketika petugas mengetik total, jadi skalanya
-- yang menentukan apakah total itu selamat pulang-pergi: pembulatan di `d`
-- desimal menggeser total sebanyak `0,5 × 10⁻ᵈ × berat`. Di empat desimal, total
-- 75.000 atas 5.300 troy oz kembali sebagai 74.999,77. Delapan desimal menahan
-- pergeserannya di bawah satu sen untuk berat sampai ~1.000.000 satuan.
--
-- Melebarkan skala tidak pernah kehilangan data: nilai lama ikut terbawa apa
-- adanya, hanya dengan nol di belakangnya.

ALTER TABLE "sales_orders" ALTER COLUMN "pricePerUnit" TYPE DECIMAL(18,8);
