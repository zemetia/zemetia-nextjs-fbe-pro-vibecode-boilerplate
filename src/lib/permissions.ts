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
    module: 'administration',
    label: 'Administrasi',
    resources: [
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
  /**
   * Persetujuan hanya punya **dua** izin, dan itu disengaja.
   *
   * Membuka inbox dan mengajukan permintaan adalah wewenang yang berdiri sendiri,
   * jadi keduanya punya key. Tapi *memutuskan* tidak: menyetujui permintaan
   * konfirmasi PO memakai ulang `metal-purchases:confirm`, permintaan penerimaan
   * memakai `metal-purchase-deliveries:confirm`, dan seterusnya — petanya di
   * `APPROVAL_KIND_PERMISSION` (`src/lib/approval.ts`).
   *
   * Alasannya: menyetujui lewat inbox dan mengkonfirmasi lewat halaman dokumen
   * menghasilkan peristiwa yang sama persis. Memberinya key kedua berarti sebuah
   * role bisa punya salah satunya saja — dan yang punya `approvals:approve-purchase`
   * tanpa `metal-purchases:confirm` mendapatkan pintu samping ke tindakan yang
   * ditolak di pintu depan.
   */
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
            description:
              'Melihat seluruh permintaan konfirmasi yang masuk dari berbagai modul beserta pengajunya',
          },
          {
            action: 'request',
            label: 'Ajukan konfirmasi',
            endpoint: 'POST /api/approvals',
            description:
              'Mengajukan sebuah dokumen untuk dikonfirmasi direktur, dan menarik kembali pengajuannya sendiri',
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
        label: 'Mitra Usaha',
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
            label: 'Tambah',
            endpoint: 'POST /api/partners',
            description: 'Mendaftarkan mitra baru — kode mitra dibuat otomatis',
          },
          {
            action: 'update',
            label: 'Ubah',
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
            description:
              'Mengajukan mitra untuk diverifikasi (KYP) — hanya bisa bila data wajibnya sudah lengkap',
          },
          {
            action: 'review-verification',
            label: 'Setujui/tolak verifikasi',
            endpoint: 'PATCH /api/partners/[id]/verification',
            description:
              'Memutuskan pengajuan verifikasi mitra; persetujuan memberi status terverifikasi selama 2 tahun',
          },
        ],
      },
      /**
       * Barang non-logam — bahan kimia, alat pakai habis, keperluan kantor.
       * Resource tersendiri dan bukan menumpang `partners`: yang merawat daftar
       * asam nitrat adalah lab, bukan bagian yang mendaftarkan supplier.
       */
      {
        resource: 'supplies',
        label: 'Barang Non-Logam',
        permissions: [
          {
            action: 'list',
            label: 'Lihat daftar',
            endpoint: 'GET /api/supplies',
            description: 'Melihat daftar barang non-logam beserta satuan belinya',
          },
          {
            action: 'create',
            label: 'Tambah',
            endpoint: 'POST /api/supplies',
            description: 'Menambahkan barang non-logam baru ke master',
          },
          {
            action: 'update',
            label: 'Ubah',
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
    ],
  },
  {
    module: 'inventory',
    label: 'Penyimpanan',
    resources: [
      {
        resource: 'metal-lots',
        label: 'Lot Emas',
        permissions: [
          {
            action: 'list',
            label: 'Lihat daftar',
            endpoint: 'GET /api/metal-lots',
            description: 'Melihat daftar lot batangan, perhiasan, scrap, dan bal beserta sisanya',
          },
          {
            action: 'detail',
            label: 'Lihat detail',
            endpoint: 'GET /api/metal-lots/[id]',
            description: 'Melihat detail satu lot beserta identitasnya',
          },
          {
            action: 'positions',
            label: 'Lihat posisi stok',
            endpoint: 'GET /api/metal-stock/positions',
            description: 'Melihat rekap posisi emas per bentuk',
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
        label: 'SPK Produksi',
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
    module: 'purchasing',
    label: 'Pembelian',
    resources: [
      {
        resource: 'purchase-requests',
        label: 'Permintaan Pembelian',
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
            label: 'Buat',
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
            label: 'Setujui',
            endpoint: 'PATCH /api/purchase-requests/[id]/status',
            description: 'Menyetujui permintaan sehingga isinya terkunci',
          },
          {
            action: 'void',
            label: 'Batalkan',
            endpoint: 'PATCH /api/purchase-requests/[id]/status',
            description: 'Membatalkan permintaan beserta alasannya; barisnya tetap disimpan',
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
            description: 'Melihat struktur bagan akun beserta saldo tiap akun',
          },
          {
            action: 'create',
            label: 'Tambah',
            endpoint: 'POST /api/accounts',
            description: 'Menambah akun atau header baru — kode akun dibuat otomatis dari induknya',
          },
          {
            action: 'update',
            label: 'Ubah',
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
            label: 'Hapus',
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
            description: 'Melihat daftar jurnal umum dari seluruh modul',
          },
          {
            action: 'detail',
            label: 'Lihat detail',
            endpoint: 'GET /api/journal-entries/[id]',
            description: 'Membuka satu jurnal beserta baris debit dan kreditnya',
          },
          {
            action: 'create',
            label: 'Tambah',
            endpoint: 'POST /api/journal-entries',
            description: 'Membuat jurnal manual baru — tersimpan sebagai draft, belum masuk buku',
          },
          {
            action: 'update',
            label: 'Ubah',
            endpoint: 'PATCH /api/journal-entries/[id]',
            description: 'Mengubah isi jurnal manual yang masih draft',
          },
          {
            action: 'post',
            label: 'Posting',
            endpoint: 'PATCH /api/journal-entries/[id]/status',
            description: 'Memasukkan jurnal draft ke buku besar sehingga ikut dihitung saldo',
          },
          {
            action: 'void',
            label: 'Batalkan',
            endpoint: 'PATCH /api/journal-entries/[id]/status',
            description: 'Membatalkan jurnal yang sudah diposting — barisnya tetap tersimpan',
          },
          {
            action: 'delete',
            label: 'Hapus',
            endpoint: 'DELETE /api/journal-entries/[id]',
            description: 'Menghapus jurnal manual yang masih draft dan belum pernah diposting',
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
    module: 'finance',
    label: 'Keuangan',
    resources: [
      {
        resource: 'cash-vouchers',
        label: 'Voucher Keuangan',
        permissions: [
          {
            action: 'list',
            label: 'Lihat daftar',
            endpoint: 'GET /api/cash-vouchers',
            description: 'Melihat daftar voucher kas, bank, dan memorial',
          },
          {
            action: 'detail',
            label: 'Lihat detail',
            endpoint: 'GET /api/cash-vouchers/[id]',
            description: 'Membuka satu voucher beserta rincian dan jurnalnya',
          },
          {
            action: 'create',
            label: 'Tambah',
            endpoint: 'POST /api/cash-vouchers',
            description: 'Membuat voucher baru sebagai draft',
          },
          {
            action: 'update',
            label: 'Ubah',
            endpoint: 'PATCH /api/cash-vouchers/[id]',
            description: 'Mengubah voucher yang masih berstatus draft',
          },
          {
            action: 'submit',
            label: 'Ajukan verifikasi',
            endpoint: 'PATCH /api/cash-vouchers/[id]/status',
            description: 'Mengajukan draft voucher untuk diverifikasi',
          },
          {
            action: 'approve',
            label: 'Verifikasi',
            endpoint: 'PATCH /api/cash-vouchers/[id]/status',
            description:
              'Menyetujui voucher yang diajukan, atau mengembalikannya ke draft dengan catatan',
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
