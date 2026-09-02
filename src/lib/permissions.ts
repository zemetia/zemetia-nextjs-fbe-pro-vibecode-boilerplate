/**
 * Permission catalog — the single source of truth for every permission in the
 * system. One entry per **API operation**, not per CRUD verb: an endpoint that
 * needs its own gate gets its own key, so a role can be granted exactly the
 * operations it needs (e.g. `users:assign-role` without `users:list`).
 *
 * Adding a module = append a `PermissionModule` below, then run `npm run db:seed`
 * — the seed inserts new keys, refreshes copy, and prunes keys that no longer
 * exist here (cascading to role_permissions).
 *
 * `endpoint` is documentation only. Enforcement is `requirePermission(key)`
 * inside the route handler.
 */

export interface PermissionDef {
  /** Operation slug — unique within its resource. Becomes `<resource>:<action>`. */
  readonly action: string;
  readonly label: string;
  readonly endpoint: string;
  readonly description: string;
}

export interface PermissionResource {
  readonly resource: string;
  readonly label: string;
  readonly permissions: readonly PermissionDef[];
}

export interface PermissionModule {
  readonly module: string;
  readonly label: string;
  readonly resources: readonly PermissionResource[];
}

export const PERMISSION_MODULES = [
  {
    module: 'dashboard',
    label: 'Dashboard',
    resources: [
      {
        resource: 'dashboard',
        label: 'Executive Dashboard',
        permissions: [
          {
            action: 'view',
            label: 'Buka dashboard',
            endpoint: 'GET /admin',
            description: 'Melihat Executive Dashboard & Control Center serta KPI bisnis real-time',
          },
        ],
      },
    ],
  },
  {
    module: 'purchasing',
    label: 'Pembelian',
    resources: [
      {
        resource: 'purchase-requests',
        label: 'Permintaan Pembelian (PR)',
        permissions: [
          {
            action: 'list',
            label: 'Lihat daftar',
            endpoint: 'GET /api/purchase-requests',
            description: 'Melihat daftar permintaan pembelian beserta statusnya',
          },
          {
            action: 'detail',
            label: 'Lihat detail',
            endpoint: 'GET /api/purchase-requests/[id]',
            description: 'Melihat satu permintaan pembelian beserta seluruh barisnya',
          },
          {
            action: 'create',
            label: 'Buat PR',
            endpoint: 'POST /api/purchase-requests',
            description: 'Mengajukan permintaan pembelian baru sebagai draft',
          },
          {
            action: 'update',
            label: 'Ubah draft',
            endpoint: 'PATCH /api/purchase-requests/[id]',
            description: 'Mengubah permintaan yang masih berstatus draft',
          },
          {
            action: 'delete',
            label: 'Hapus draft',
            endpoint: 'DELETE /api/purchase-requests/[id]',
            description: 'Menghapus permintaan yang masih draft dan belum pernah disetujui',
          },
          {
            action: 'approve',
            label: 'Setujui PR',
            endpoint: 'PATCH /api/purchase-requests/[id]/status',
            description: 'Menyetujui permintaan sehingga isinya terkunci dan siap dikonversi ke PO',
          },
          {
            action: 'void',
            label: 'Batalkan PR',
            endpoint: 'PATCH /api/purchase-requests/[id]/status',
            description: 'Membatalkan permintaan beserta alasannya; barisnya tetap disimpan',
          },
        ],
      },
      {
        resource: 'local-purchases',
        label: 'PO Emas Lokal',
        permissions: [
          {
            action: 'list',
            label: 'Lihat daftar',
            endpoint: 'GET /api/metal-purchases',
            description: 'Melihat daftar PO/kuitansi pembelian logam lokal maupun impor',
          },
          {
            action: 'detail',
            label: 'Lihat detail',
            endpoint: 'GET /api/metal-purchases/[id]',
            description: 'Melihat detail transaksi pembelian logam beserta baris dan TTB-nya',
          },
          {
            action: 'create',
            label: 'Buat PO/kuitansi',
            endpoint: 'POST /api/metal-purchases',
            description: 'Menerbitkan PO/kuitansi pembelian logam baru sebagai draft — atau langsung diterima bila Direct Payment',
          },
          {
            action: 'update',
            label: 'Ubah draft',
            endpoint: 'PATCH /api/metal-purchases/[id]',
            description: 'Mengubah data pembelian yang masih draft',
          },
          {
            action: 'delete',
            label: 'Hapus draft',
            endpoint: 'DELETE /api/metal-purchases/[id]',
            description: 'Menghapus draft pembelian yang belum pernah dikonfirmasi',
          },
          {
            action: 'confirm',
            label: 'Konfirmasi PO',
            endpoint: 'PATCH /api/metal-purchases/[id]/status',
            description: 'Mengunci kesepakatan pembelian sehingga siap menerima TTB — juga izin memutuskan pengajuan di inbox konfirmasi',
          },
          {
            action: 'void',
            label: 'Batalkan PO',
            endpoint: 'PATCH /api/metal-purchases/[id]/status',
            description: 'Membatalkan PO yang belum punya TTB terkonfirmasi, beserta alasannya',
          },
        ],
      },
      {
        resource: 'import-purchases',
        label: 'PO Emas Impor',
        permissions: [
          {
            action: 'list',
            label: 'Lihat daftar',
            endpoint: 'GET /api/metal-purchases?type=IMPORT',
            description: 'Melihat daftar PO pembelian emas impor valas',
          },
          {
            action: 'detail',
            label: 'Lihat detail',
            endpoint: 'GET /api/metal-purchases/[id]',
            description: 'Melihat detail PO impor beserta baris dan TTB-nya',
          },
          {
            action: 'create',
            label: 'Buat PO impor',
            endpoint: 'POST /api/metal-purchases',
            description: 'Menerbitkan PO impor baru sebagai draft',
          },
          {
            action: 'update',
            label: 'Ubah draft',
            endpoint: 'PATCH /api/metal-purchases/[id]',
            description: 'Mengubah PO impor yang masih draft',
          },
          {
            action: 'delete',
            label: 'Hapus draft',
            endpoint: 'DELETE /api/metal-purchases/[id]',
            description: 'Menghapus draft PO impor yang belum pernah dikonfirmasi',
          },
          {
            action: 'confirm',
            label: 'Konfirmasi PO impor',
            endpoint: 'PATCH /api/metal-purchases/[id]/status',
            description: 'Mengunci kesepakatan PO impor sehingga siap menerima TTB',
          },
          {
            action: 'void',
            label: 'Batalkan PO impor',
            endpoint: 'PATCH /api/metal-purchases/[id]/status',
            description: 'Membatalkan PO impor yang belum punya TTB terkonfirmasi, beserta alasannya',
          },
        ],
      },
      {
        resource: 'scrap-purchases',
        label: 'Pembelian Scrap',
        permissions: [
          {
            action: 'list',
            label: 'Lihat daftar',
            endpoint: 'GET /api/metal-purchases?type=SCRAP_LOCAL',
            description: 'Melihat daftar pembelian pecahan emas scrap',
          },
          {
            action: 'detail',
            label: 'Lihat detail',
            endpoint: 'GET /api/metal-purchases/[id]',
            description: 'Melihat detail pembelian scrap beserta kadar XRF dan leburannya',
          },
          {
            action: 'create',
            label: 'Buat pembelian scrap',
            endpoint: 'POST /api/metal-purchases',
            description: 'Menerbitkan pembelian scrap baru',
          },
          {
            action: 'update',
            label: 'Ubah draft',
            endpoint: 'PATCH /api/metal-purchases/[id]',
            description: 'Mengubah pembelian scrap yang masih draft',
          },
          {
            action: 'delete',
            label: 'Hapus draft',
            endpoint: 'DELETE /api/metal-purchases/[id]',
            description: 'Menghapus pembelian scrap yang belum pernah dikonfirmasi',
          },
          {
            action: 'confirm',
            label: 'Konfirmasi pembelian scrap',
            endpoint: 'PATCH /api/metal-purchases/[id]/status',
            description: 'Mengunci pembelian scrap sehingga stok masuk vault scrap',
          },
          {
            action: 'void',
            label: 'Batalkan pembelian scrap',
            endpoint: 'PATCH /api/metal-purchases/[id]/status',
            description: 'Membatalkan pembelian scrap yang belum punya TTB terkonfirmasi, beserta alasannya',
          },
        ],
      },
      {
        resource: 'goods-receipts',
        label: 'Penerimaan Barang (TTB)',
        permissions: [
          {
            action: 'list',
            label: 'Lihat daftar',
            endpoint: 'GET /api/metal-purchase-deliveries',
            description: 'Melihat tanda terima barang (TTB) masuk brankas vault, lintas PO',
          },
          {
            action: 'detail',
            label: 'Lihat detail',
            endpoint: 'GET /api/metal-purchase-deliveries/[id]',
            description: 'Melihat rincian penerimaan fisik dan jurnal yang lahir darinya',
          },
          {
            action: 'create',
            label: 'Buat TTB',
            endpoint: 'POST /api/metal-purchase-deliveries',
            description: 'Mencatat rencana penerimaan fisik barang dari kurir/supplier sebagai draft',
          },
          {
            action: 'update',
            label: 'Ubah draft',
            endpoint: 'PATCH /api/metal-purchase-deliveries/[id]',
            description: 'Mengubah TTB yang masih draft',
          },
          {
            action: 'delete',
            label: 'Hapus draft',
            endpoint: 'DELETE /api/metal-purchase-deliveries/[id]',
            description: 'Menghapus draft TTB yang belum berjalan',
          },
          {
            action: 'confirm',
            label: 'Konfirmasi penerimaan',
            endpoint: 'PATCH /api/metal-purchase-deliveries/[id]/status',
            description: 'Menyatakan barang diterima fisik di vault — melahirkan lot, mutasi stok, dan jurnal — juga izin memutuskan pengajuan di inbox konfirmasi',
          },
          {
            action: 'void',
            label: 'Batalkan TTB',
            endpoint: 'PATCH /api/metal-purchase-deliveries/[id]/status',
            description: 'Membatalkan TTB beserta lot, mutasi, dan jurnal yang lahir darinya, selama belum bergerak',
          },
        ],
      },
    ],
  },
  {
    module: 'inventory',
    label: 'Gudang & Vault',
    resources: [
      {
        resource: 'metal-lots',
        label: 'Stok & Kartu Vault',
        permissions: [
          {
            action: 'list',
            label: 'Lihat daftar lot',
            endpoint: 'GET /api/metal-lots',
            description: 'Melihat daftar lot batangan, perhiasan, scrap, dan saldo berjalan',
          },
          {
            action: 'detail',
            label: 'Lihat detail lot',
            endpoint: 'GET /api/metal-lots/[id]',
            description: 'Melihat detail satu lot beserta nomor sertifikat dan kadar',
          },
          {
            action: 'positions',
            label: 'Lihat posisi brankas',
            endpoint: 'GET /api/metal-stock/positions',
            description: 'Melihat rekap posisi persediaan brankas vault per akun dan bentuk fisik',
          },
          {
            action: 'transfer',
            label: 'Transfer antar-vault',
            endpoint: 'POST /api/inventory/transfers',
            description: 'Mencatat mutasi transfer fisik emas antar brankas/lokasi',
          },
        ],
      },
      {
        resource: 'silver-alloy',
        label: 'Tambah Perak (Alloy)',
        permissions: [
          {
            action: 'list',
            label: 'Lihat riwayat alloy',
            endpoint: 'GET /api/inventory/silver-alloy',
            description: 'Melihat riwayat penambahan perak alloy ke emas batangan',
          },
          {
            action: 'create',
            label: 'Tambah perak alloy',
            endpoint: 'POST /api/inventory/silver-alloy',
            description: 'Mencatat pencampuran perak murni untuk penyesuaian kadar emas',
          },
        ],
      },
      {
        resource: 'local-deliveries',
        label: 'Surat Jalan Pengeluaran (Lokal)',
        permissions: [
          {
            action: 'list',
            label: 'Lihat daftar',
            endpoint: 'GET /api/sales/deliveries',
            description: 'Melihat daftar surat jalan pengeluaran emas lokal',
          },
          {
            action: 'detail',
            label: 'Lihat detail',
            endpoint: 'GET /api/sales/deliveries/[id]',
            description: 'Melihat rincian pengeluaran fisik, segel brankas, dan serah terima kurir',
          },
          {
            action: 'create',
            label: 'Buat surat jalan',
            endpoint: 'POST /api/sales/deliveries',
            description: 'Menerbitkan surat jalan pengeluaran fisik emas lokal dari vault',
          },
          {
            action: 'confirm',
            label: 'Konfirmasi serah terima',
            endpoint: 'PATCH /api/sales/deliveries/[id]/confirm',
            description: 'Mengonfirmasi serah terima fisik emas ke pembeli/kurir',
          },
          {
            action: 'void',
            label: 'Batalkan surat jalan',
            endpoint: 'PATCH /api/sales/deliveries/[id]/void',
            description: 'Membatalkan surat jalan yang sudah dikonfirmasi (mutasi & jurnal ikut dibatalkan)',
          },
          {
            action: 'delete',
            label: 'Hapus/batalkan',
            endpoint: 'DELETE /api/sales/deliveries/[id]',
            description: 'Membatalkan surat jalan pengeluaran lokal',
          },
        ],
      },
      {
        resource: 'export-deliveries',
        label: 'Surat Jalan Pengeluaran (Ekspor)',
        permissions: [
          {
            action: 'list',
            label: 'Lihat daftar',
            endpoint: 'GET /api/sales/export-deliveries',
            description: 'Melihat daftar surat jalan pengeluaran perhiasan ekspor',
          },
          {
            action: 'detail',
            label: 'Lihat detail',
            endpoint: 'GET /api/sales/export-deliveries/[id]',
            description: 'Melihat packing list, segel brankas, dan serah terima pengawal kargo bandara',
          },
          {
            action: 'create',
            label: 'Buat surat jalan ekspor',
            endpoint: 'POST /api/sales/export-deliveries',
            description: 'Menerbitkan surat jalan ekspor & packing list',
          },
          {
            action: 'confirm',
            label: 'Konfirmasi serah terima kargo',
            endpoint: 'PATCH /api/sales/export-deliveries/[id]/confirm',
            description: 'Mengonfirmasi serah terima fisik ke armada kargo ekspor (Brinks/Malca-Amit)',
          },
          {
            action: 'void',
            label: 'Batalkan surat jalan ekspor',
            endpoint: 'PATCH /api/sales/export-deliveries/[id]/void',
            description: 'Membatalkan surat jalan ekspor yang sudah dikonfirmasi (mutasi & jurnal ikut dibatalkan)',
          },
          {
            action: 'delete',
            label: 'Hapus/batalkan',
            endpoint: 'DELETE /api/sales/export-deliveries/[id]',
            description: 'Membatalkan surat jalan ekspor',
          },
        ],
      },
      {
        resource: 'finished-goods',
        label: 'Master Perhiasan (Finished Goods)',
        permissions: [
          {
            action: 'list',
            label: 'Lihat katalog',
            endpoint: 'GET /api/products/finished-goods',
            description: 'Melihat katalog model perhiasan ekspor',
          },
          {
            action: 'detail',
            label: 'Lihat detail',
            endpoint: 'GET /api/products/finished-goods/[id]',
            description: 'Melihat spesifikasi karat, berat, dan formula model perhiasan',
          },
          {
            action: 'create',
            label: 'Tambah model',
            endpoint: 'POST /api/products/finished-goods',
            description: 'Menambahkan master model perhiasan baru',
          },
          {
            action: 'update',
            label: 'Ubah model',
            endpoint: 'PATCH /api/products/finished-goods/[id]',
            description: 'Mengubah data spesifikasi model perhiasan',
          },
          {
            action: 'set-status',
            label: 'Aktif/nonaktif',
            endpoint: 'PATCH /api/products/finished-goods/[id]/status',
            description: 'Menonaktifkan model perhiasan yang tidak diproduksi lagi',
          },
        ],
      },
    ],
  },
  {
    module: 'production',
    label: 'Produksi',
    resources: [
      {
        resource: 'production-orders',
        label: 'SPK Produksi Perhiasan',
        permissions: [
          {
            action: 'list',
            label: 'Lihat daftar',
            endpoint: 'GET /api/production-orders',
            description: 'Melihat daftar SPK beserta progres dan susutnya',
          },
          {
            action: 'detail',
            label: 'Lihat detail',
            endpoint: 'GET /api/production-orders/[id]',
            description: 'Melihat satu SPK beserta neraca bahan dan riwayat mutasinya',
          },
          {
            action: 'create',
            label: 'Buat SPK',
            endpoint: 'POST /api/production-orders',
            description: 'Membuat rencana produksi baru — nomornya dibuat otomatis',
          },
          {
            action: 'update',
            label: 'Ubah SPK',
            endpoint: 'PATCH /api/production-orders/[id]',
            description: 'Mengubah rencana selama SPK masih berstatus draft',
          },
          {
            action: 'delete',
            label: 'Hapus draft',
            endpoint: 'DELETE /api/production-orders/[id]',
            description: 'Menghapus SPK yang masih draft dan belum menyentuh emas',
          },
          {
            action: 'release',
            label: 'Rilis ke produksi',
            endpoint: 'PATCH /api/production-orders/[id]/status',
            description: 'Merilis SPK sehingga bahan boleh keluar dan hasil boleh dicatat',
          },
          {
            action: 'issue',
            label: 'Keluarkan bahan',
            endpoint: 'POST /api/production-orders/[id]/issues',
            description: 'Memindahkan bahan baku dari penyimpanan ke lokasi produksi',
          },
          {
            action: 'receive',
            label: 'Catat hasil',
            endpoint: 'POST /api/production-orders/[id]/receipts',
            description: 'Mencatat perhiasan jadi, sisa bahan, susut, dan alloy',
          },
          {
            action: 'return',
            label: 'Kembalikan bahan',
            endpoint: 'POST /api/production-orders/[id]/returns',
            description: 'Mengembalikan bahan yang tidak jadi diolah ke penyimpanan',
          },
          {
            action: 'close',
            label: 'Tutup SPK',
            endpoint: 'PATCH /api/production-orders/[id]/status',
            description: 'Menutup SPK setelah sisa bahannya nol dan mengunci susutnya',
          },
          {
            action: 'void',
            label: 'Batalkan SPK',
            endpoint: 'PATCH /api/production-orders/[id]/status',
            description: 'Membatalkan SPK yang belum menghasilkan barang',
          },
        ],
      },
    ],
  },
  {
    module: 'sales',
    label: 'Penjualan',
    resources: [
      {
        resource: 'local-sales',
        label: 'Penjualan Emas Lokal',
        permissions: [
          {
            action: 'list',
            label: 'Lihat daftar',
            endpoint: 'GET /api/sales/local',
            description: 'Melihat daftar penjualan logam mulia lokal IDR',
          },
          {
            action: 'detail',
            label: 'Lihat detail',
            endpoint: 'GET /api/sales/local/[id]',
            description: 'Melihat rincian transaksi penjualan emas lokal',
          },
          {
            action: 'create',
            label: 'Buat penjualan',
            endpoint: 'POST /api/sales/local',
            description: 'Mencatat order penjualan emas lokal (tunai/tempo)',
          },
          {
            action: 'confirm',
            label: 'Konfirmasi SO',
            endpoint: 'PATCH /api/sales/local/[id]/status',
            description: 'Mengonfirmasi sales order lokal (draft menjadi terkunci)',
          },
          {
            action: 'void',
            label: 'Batalkan SO',
            endpoint: 'PATCH /api/sales/local/[id]/status',
            description: 'Membatalkan sales order lokal yang sudah dikonfirmasi',
          },
          {
            action: 'delete',
            label: 'Hapus/batalkan',
            endpoint: 'DELETE /api/sales/local/[id]',
            description: 'Membatalkan transaksi penjualan lokal',
          },
        ],
      },
      {
        resource: 'local-invoices',
        label: 'Faktur Penjualan Lokal',
        permissions: [
          {
            action: 'list',
            label: 'Lihat daftar',
            endpoint: 'GET /api/sales/invoices',
            description: 'Melihat daftar faktur penjualan lokal (PMK 48/2023)',
          },
          {
            action: 'detail',
            label: 'Lihat detail',
            endpoint: 'GET /api/sales/invoices/[id]',
            description: 'Melihat detail faktur dan pengakuan piutang/uang muka',
          },
          {
            action: 'create',
            label: 'Buat faktur',
            endpoint: 'POST /api/sales/invoices',
            description: 'Menerbitkan faktur komersial penjualan lokal',
          },
          {
            action: 'post',
            label: 'Posting jurnal',
            endpoint: 'PATCH /api/sales/invoices/[id]/post',
            description: 'Memposting jurnal piutang dan omset penjualan lokal',
          },
          {
            action: 'void',
            label: 'Batalkan faktur',
            endpoint: 'PATCH /api/sales/invoices/[id]/void',
            description: 'Membatalkan faktur penjualan lokal',
          },
        ],
      },
      {
        resource: 'export-sales-orders',
        label: 'Sales Order Ekspor',
        permissions: [
          {
            action: 'list',
            label: 'Lihat daftar',
            endpoint: 'GET /api/sales/orders',
            description: 'Melihat daftar Sales Order ekspor perhiasan',
          },
          {
            action: 'detail',
            label: 'Lihat detail',
            endpoint: 'GET /api/sales/orders/[id]',
            description: 'Melihat kontrak SO ekspor dan penetapan harga fixing USD',
          },
          {
            action: 'create',
            label: 'Buat SO ekspor',
            endpoint: 'POST /api/sales/orders',
            description: 'Membuat kontrak sales order ekspor baru',
          },
          {
            action: 'update',
            label: 'Ubah SO ekspor',
            endpoint: 'PATCH /api/sales/orders/[id]',
            description: 'Mengubah rincian kontrak SO ekspor',
          },
          {
            action: 'approve',
            label: 'Setujui SO ekspor',
            endpoint: 'PATCH /api/sales/orders/[id]/approve',
            description: 'Menyetujui dan mengunci harga SO ekspor',
          },
          {
            action: 'void',
            label: 'Batalkan SO ekspor',
            endpoint: 'PATCH /api/sales/orders/[id]/void',
            description: 'Membatalkan kontrak SO ekspor',
          },
        ],
      },
      {
        resource: 'export-invoices',
        label: 'Faktur Ekspor (USD)',
        permissions: [
          {
            action: 'list',
            label: 'Lihat daftar',
            endpoint: 'GET /api/sales/export-invoices',
            description: 'Melihat daftar faktur komersial ekspor USD (PPN 0%)',
          },
          {
            action: 'detail',
            label: 'Lihat detail',
            endpoint: 'GET /api/sales/export-invoices/[id]',
            description: 'Melihat rincian faktur ekspor, PEB, dan rekening BCA USD',
          },
          {
            action: 'create',
            label: 'Buat faktur ekspor',
            endpoint: 'POST /api/sales/export-invoices',
            description: 'Menerbitkan Commercial Invoice ekspor USD resmi',
          },
          {
            action: 'post',
            label: 'Posting jurnal',
            endpoint: 'PATCH /api/sales/export-invoices/[id]/post',
            description: 'Memposting jurnal piutang ekspor USD',
          },
          {
            action: 'void',
            label: 'Batalkan faktur ekspor',
            endpoint: 'PATCH /api/sales/export-invoices/[id]/void',
            description: 'Membatalkan faktur komersial ekspor',
          },
        ],
      },
      {
        resource: 'customers',
        label: 'Master Customer',
        permissions: [
          {
            action: 'list',
            label: 'Lihat daftar',
            endpoint: 'GET /api/customers',
            description: 'Melihat daftar pelanggan lokal dan buyer ekspor',
          },
          {
            action: 'detail',
            label: 'Lihat detail',
            endpoint: 'GET /api/customers/[id]',
            description: 'Melihat profil pelanggan, limit kredit, dan kontak',
          },
          {
            action: 'create',
            label: 'Tambah customer',
            endpoint: 'POST /api/customers',
            description: 'Mendaftarkan customer baru',
          },
          {
            action: 'update',
            label: 'Ubah customer',
            endpoint: 'PATCH /api/customers/[id]',
            description: 'Mengubah data pelanggan',
          },
          {
            action: 'set-status',
            label: 'Aktif/nonaktif',
            endpoint: 'PATCH /api/customers/[id]/status',
            description: 'Menonaktifkan pelanggan',
          },
        ],
      },
    ],
  },
  {
    module: 'finance',
    label: 'Keuangan',
    resources: [
      {
        resource: 'cash-vouchers',
        label: 'Voucher Kas & Bank',
        permissions: [
          {
            action: 'list',
            label: 'Lihat daftar',
            endpoint: 'GET /api/cash-vouchers',
            description: 'Melihat daftar voucher kas, bank, dan memorial (BKK/BKM/BBK/BBM)',
          },
          {
            action: 'detail',
            label: 'Lihat detail',
            endpoint: 'GET /api/cash-vouchers/[id]',
            description: 'Membuka satu voucher beserta rincian dan jurnalnya',
          },
          {
            action: 'create',
            label: 'Tambah voucher',
            endpoint: 'POST /api/cash-vouchers',
            description: 'Membuat voucher kas/bank baru sebagai draft',
          },
          {
            action: 'update',
            label: 'Ubah voucher',
            endpoint: 'PATCH /api/cash-vouchers/[id]',
            description: 'Mengubah voucher yang masih berstatus draft',
          },
          {
            action: 'submit',
            label: 'Ajukan verifikasi',
            endpoint: 'PATCH /api/cash-vouchers/[id]/status',
            description: 'Mengajukan draft voucher untuk diverifikasi kasir/finance',
          },
          {
            action: 'approve',
            label: 'Verifikasi',
            endpoint: 'PATCH /api/cash-vouchers/[id]/status',
            description: 'Menyetujui voucher yang diajukan, atau mengembalikannya ke draft',
          },
          {
            action: 'post',
            label: 'Posting jurnal',
            endpoint: 'PATCH /api/cash-vouchers/[id]/status',
            description: 'Memasukkan voucher yang sudah disetujui ke buku besar',
          },
          {
            action: 'void',
            label: 'Batalkan',
            endpoint: 'PATCH /api/cash-vouchers/[id]/status',
            description: 'Membatalkan voucher yang sudah disetujui atau diposting, beserta jurnalnya',
          },
          {
            action: 'delete',
            label: 'Hapus',
            endpoint: 'DELETE /api/cash-vouchers/[id]',
            description: 'Menghapus voucher yang masih berstatus draft',
          },
        ],
      },
      {
        resource: 'cheques',
        label: 'Master Buku Cek & Giro',
        permissions: [
          {
            action: 'list',
            label: 'Lihat daftar',
            endpoint: 'GET /api/finance/cheques',
            description: 'Melihat daftar buku cek dan bilyet giro bank BCA',
          },
          {
            action: 'detail',
            label: 'Lihat detail',
            endpoint: 'GET /api/finance/cheques/[id]',
            description: 'Melihat status tiap lembar cek (tersedia, cair, batal)',
          },
          {
            action: 'create',
            label: 'Daftarkan buku cek',
            endpoint: 'POST /api/finance/cheques',
            description: 'Mendaftarkan seri buku cek/giro baru dari bank',
          },
          {
            action: 'update',
            label: 'Update status lembar',
            endpoint: 'PATCH /api/finance/cheques/[id]/leaves',
            description: 'Memperbarui status pencairan atau pembatalan lembar cek',
          },
          {
            action: 'set-status',
            label: 'Aktif/nonaktif buku',
            endpoint: 'PATCH /api/finance/cheques/[id]/status',
            description: 'Menutup buku cek yang sudah habis atau tidak dipakai',
          },
        ],
      },
    ],
  },
  {
    module: 'accounting',
    label: 'Akuntansi',
    resources: [
      {
        resource: 'accounts',
        label: 'Bagan Akun (COA)',
        permissions: [
          {
            action: 'list',
            label: 'Lihat bagan akun',
            endpoint: 'GET /api/accounts',
            description: 'Melihat struktur bagan akun SAK EMKM beserta saldo tiap akun',
          },
          {
            action: 'create',
            label: 'Tambah akun',
            endpoint: 'POST /api/accounts',
            description: 'Menambah akun atau header baru — kode akun dibuat otomatis dari induknya',
          },
          {
            action: 'update',
            label: 'Ubah akun',
            endpoint: 'PATCH /api/accounts/[id]',
            description: 'Mengubah nama, keterangan, dan penanda kepemilikan sebuah akun',
          },
          {
            action: 'set-status',
            label: 'Aktif/nonaktif',
            endpoint: 'PATCH /api/accounts/[id]/status',
            description: 'Menutup akun agar tidak bisa dipakai transaksi baru, atau membukanya lagi',
          },
          {
            action: 'delete',
            label: 'Hapus akun',
            endpoint: 'DELETE /api/accounts/[id]',
            description: 'Menghapus akun yang belum punya turunan dan belum pernah dipakai transaksi',
          },
        ],
      },
      {
        resource: 'journal-entries',
        label: 'Jurnal Umum',
        permissions: [
          {
            action: 'list',
            label: 'Lihat daftar',
            endpoint: 'GET /api/journal-entries',
            description: 'Melihat daftar jurnal umum dari seluruh modul transaksi',
          },
          {
            action: 'detail',
            label: 'Lihat detail',
            endpoint: 'GET /api/journal-entries/[id]',
            description: 'Membuka satu jurnal beserta baris debit dan kreditnya',
          },
          {
            action: 'create',
            label: 'Tambah jurnal',
            endpoint: 'POST /api/journal-entries',
            description: 'Membuat jurnal manual baru — tersimpan sebagai draft',
          },
          {
            action: 'update',
            label: 'Ubah jurnal',
            endpoint: 'PATCH /api/journal-entries/[id]',
            description: 'Mengubah isi jurnal manual yang masih draft',
          },
          {
            action: 'post',
            label: 'Posting jurnal',
            endpoint: 'PATCH /api/journal-entries/[id]/status',
            description: 'Memasukkan jurnal draft ke buku besar sehingga ikut dihitung saldo',
          },
          {
            action: 'void',
            label: 'Batalkan jurnal',
            endpoint: 'PATCH /api/journal-entries/[id]/status',
            description: 'Membatalkan jurnal yang sudah diposting — barisnya tetap tersimpan',
          },
          {
            action: 'delete',
            label: 'Hapus jurnal',
            endpoint: 'DELETE /api/journal-entries/[id]',
            description: 'Menghapus jurnal manual yang masih draft dan belum pernah diposting',
          },
        ],
      },
      {
        resource: 'financial-reports',
        label: 'Laporan Keuangan SAK EMKM',
        permissions: [
          {
            action: 'view',
            label: 'Lihat laporan keuangan',
            endpoint: 'GET /api/reports/financial',
            description: 'Melihat Laba Rugi, Posisi Keuangan (Neraca), Arus Kas, Perubahan Ekuitas, dan CALK',
          },
          {
            action: 'export',
            label: 'Cetak / Ekspor PDF',
            endpoint: 'GET /api/reports/financial/export',
            description: 'Mengekspor laporan keuangan ke format cetak PDF resmi',
          },
        ],
      },
      {
        resource: 'ledger-reports',
        label: 'Laporan Buku Besar',
        permissions: [
          {
            action: 'general-ledger',
            label: 'Buku besar',
            endpoint: 'GET /api/reports/ledger',
            description: 'Melihat mutasi dan saldo berjalan satu akun dalam satu periode',
          },
          {
            action: 'trial-balance',
            label: 'Neraca saldo',
            endpoint: 'GET /api/reports/trial-balance',
            description: 'Melihat saldo awal, mutasi, dan saldo akhir seluruh akun',
          },
        ],
      },
    ],
  },
  {
    module: 'master-data',
    label: 'Master Data',
    resources: [
      {
        resource: 'partners',
        label: 'Mitra Usaha (Supplier)',
        permissions: [
          {
            action: 'list',
            label: 'Lihat daftar',
            endpoint: 'GET /api/partners',
            description: 'Melihat daftar mitra usaha beserta peran, kategori, dan negaranya',
          },
          {
            action: 'detail',
            label: 'Lihat detail',
            endpoint: 'GET /api/partners/[id]',
            description: 'Melihat detail satu mitra beserta data kontak, pajak, dan banknya',
          },
          {
            action: 'create',
            label: 'Tambah mitra',
            endpoint: 'POST /api/partners',
            description: 'Mendaftarkan mitra baru — kode mitra dibuat otomatis',
          },
          {
            action: 'update',
            label: 'Ubah mitra',
            endpoint: 'PATCH /api/partners/[id]',
            description: 'Mengubah data mitra yang sudah terdaftar, termasuk peran dan kategorinya',
          },
          {
            action: 'set-status',
            label: 'Aktif/nonaktif',
            endpoint: 'PATCH /api/partners/[id]/status',
            description: 'Menonaktifkan mitra agar tidak bisa dipilih lagi, atau mengaktifkannya',
          },
          {
            action: 'request-verification',
            label: 'Ajukan verifikasi',
            endpoint: 'POST /api/partners/[id]/verification',
            description: 'Mengajukan mitra untuk diverifikasi (KYP) — hanya bisa bila data wajibnya sudah lengkap',
          },
          {
            action: 'review-verification',
            label: 'Setujui/tolak verifikasi',
            endpoint: 'PATCH /api/partners/[id]/verification',
            description: 'Memutuskan pengajuan verifikasi mitra; persetujuan memberi status terverifikasi selama 2 tahun',
          },
        ],
      },
      {
        resource: 'supplies',
        label: 'Barang Non-Logam (Bahan Baku)',
        permissions: [
          {
            action: 'list',
            label: 'Lihat daftar',
            endpoint: 'GET /api/supplies',
            description: 'Melihat daftar barang non-logam beserta satuan belinya',
          },
          {
            action: 'create',
            label: 'Tambah barang',
            endpoint: 'POST /api/supplies',
            description: 'Menambahkan barang non-logam baru ke master',
          },
          {
            action: 'update',
            label: 'Ubah barang',
            endpoint: 'PATCH /api/supplies/[id]',
            description: 'Mengubah kode, nama, kategori, atau satuan barang non-logam',
          },
          {
            action: 'set-status',
            label: 'Aktif/nonaktif',
            endpoint: 'PATCH /api/supplies/[id]/status',
            description: 'Menonaktifkan barang yang sudah tidak dibeli lagi, atau mengaktifkannya',
          },
        ],
      },
      {
        resource: 'units',
        label: 'Master Satuan & Konversi',
        permissions: [
          {
            action: 'list',
            label: 'Lihat daftar satuan',
            endpoint: 'GET /api/units',
            description: 'Melihat daftar tipe satuan, anchor, dan faktor konversinya',
          },
          {
            action: 'create',
            label: 'Tambah satuan',
            endpoint: 'POST /api/units',
            description: 'Menambahkan tipe satuan atau satuan pengukuran baru',
          },
          {
            action: 'update',
            label: 'Ubah satuan',
            endpoint: 'PATCH /api/units/[id]',
            description: 'Mengubah rasio konversi atau status satuan',
          },
          {
            action: 'convert',
            label: 'Kalkulator konversi',
            endpoint: 'POST /api/units/convert',
            description: 'Melakukan kalkulasi konversi antar satuan',
          },
        ],
      },
    ],
  },
  {
    module: 'approvals',
    label: 'Persetujuan',
    resources: [
      {
        resource: 'approvals',
        label: 'Konfirmasi Direktur',
        permissions: [
          {
            action: 'list',
            label: 'Buka daftar konfirmasi',
            endpoint: 'GET /api/approvals',
            description: 'Melihat seluruh permintaan konfirmasi yang masuk dari berbagai modul beserta pengajunya',
          },
          {
            action: 'request',
            label: 'Ajukan konfirmasi',
            endpoint: 'POST /api/approvals',
            description: 'Mengajukan sebuah dokumen untuk dikonfirmasi direktur, dan menarik kembali pengajuannya sendiri',
          },
          {
            action: 'decide',
            label: 'Putuskan konfirmasi',
            endpoint: 'PATCH /api/approvals/[id]',
            description: 'Menyetujui atau menolak dokumen yang diajukan ke Direktur',
          },
        ],
      },
    ],
  },
  {
    module: 'administration',
    label: 'Pengaturan & Administrasi',
    resources: [
      {
        resource: 'system-settings',
        label: 'Pengaturan Sistem',
        permissions: [
          {
            action: 'view',
            label: 'Buka pengaturan sistem',
            endpoint: 'GET /api/system/settings',
            description: 'Melihat profil perusahaan, pengaturan logo, dan status sistem',
          },
          {
            action: 'update',
            label: 'Ubah identitas perusahaan',
            endpoint: 'PATCH /api/system/settings',
            description: 'Mengubah data kop perusahaan, nama legal, dan logo',
          },
          {
            action: 'backup',
            label: 'Backup data sistem',
            endpoint: 'GET /api/system/backup',
            description: 'Mengunduh file arsip cadangan data sistem',
          },
          {
            action: 'restore',
            label: 'Restore database',
            endpoint: 'POST /api/system/restore',
            description: 'Memulihkan database dari arsip cadangan',
          },
        ],
      },
      {
        resource: 'users',
        label: 'Pengguna',
        permissions: [
          {
            action: 'list',
            label: 'Lihat daftar',
            endpoint: 'GET /api/users',
            description: 'Melihat daftar pengguna beserta role-nya',
          },
          {
            action: 'create',
            label: 'Tambah',
            endpoint: 'POST /api/users',
            description: 'Menambahkan pengguna baru beserta role awalnya',
          },
          {
            action: 'assign-role',
            label: 'Ubah role',
            endpoint: 'PATCH /api/users/[id]/role',
            description: 'Mengganti role yang dipakai seorang pengguna',
          },
          {
            action: 'set-status',
            label: 'Aktif/nonaktif',
            endpoint: 'PATCH /api/users/[id]/status',
            description: 'Menonaktifkan pengguna agar tidak bisa masuk, atau mengaktifkannya lagi',
          },
        ],
      },
      {
        resource: 'roles',
        label: 'Role',
        permissions: [
          {
            action: 'list',
            label: 'Lihat daftar',
            endpoint: 'GET /api/roles',
            description: 'Melihat daftar role',
          },
          {
            action: 'detail',
            label: 'Lihat detail',
            endpoint: 'GET /api/roles/[id]',
            description: 'Melihat detail satu role beserta izin yang dimilikinya',
          },
          {
            action: 'create',
            label: 'Buat',
            endpoint: 'POST /api/roles',
            description: 'Membuat role baru',
          },
          {
            action: 'update',
            label: 'Ubah',
            endpoint: 'PATCH /api/roles/[id]',
            description: 'Mengubah nama dan deskripsi role',
          },
          {
            action: 'delete',
            label: 'Hapus',
            endpoint: 'DELETE /api/roles/[id]',
            description: 'Menghapus role yang tidak dipakai pengguna mana pun',
          },
          {
            action: 'set-permissions',
            label: 'Atur izin',
            endpoint: 'PUT /api/roles/[id]/permissions',
            description: 'Menentukan izin apa saja yang dimiliki sebuah role',
          },
        ],
      },
      {
        resource: 'permissions',
        label: 'Izin',
        permissions: [
          {
            action: 'list',
            label: 'Lihat katalog',
            endpoint: 'GET /api/permissions',
            description: 'Melihat katalog izin yang tersedia untuk diberikan ke role',
          },
        ],
      },
    ],
  },
] as const satisfies readonly PermissionModule[];

type ResourcesOf<M> = M extends { resources: readonly (infer R)[] } ? R : never;

type KeysOf<R> = R extends {
  resource: infer Resource extends string;
  permissions: readonly (infer P)[];
}
  ? P extends { action: infer Action extends string }
    ? `${Resource}:${Action}`
    : never
  : never;

/** Literal union of every key in the catalog — typos fail to compile. */
export type PermissionKey = KeysOf<ResourcesOf<(typeof PERMISSION_MODULES)[number]>>;

export interface PermissionCatalogEntry extends PermissionDef {
  readonly key: string;
  readonly resource: string;
  readonly resourceLabel: string;
  readonly module: string;
  readonly moduleLabel: string;
}

/** Flattened catalog, in declaration order — drives seeding and UI ordering. */
export const PERMISSION_CATALOG: readonly PermissionCatalogEntry[] = PERMISSION_MODULES.flatMap(
  (module) =>
    module.resources.flatMap((resource) =>
      resource.permissions.map((permission) => ({
        ...permission,
        key: `${resource.resource}:${permission.action}`,
        resource: resource.resource,
        resourceLabel: resource.label,
        module: module.module,
        moduleLabel: module.label,
      })),
    ),
);

export const PERMISSION_CATALOG_BY_KEY = new Map(
  PERMISSION_CATALOG.map((entry) => [entry.key, entry]),
);
