// Run directly via `tsx prisma/seed.ts`, outside Next.js's own env loading —
// load .env explicitly so `prisma.ts`'s DATABASE_URL is populated.
try {
  process.loadEnvFile();
} catch {
  // No .env file (e.g. CI, where env vars are injected directly) — fine.
}

/**
 * Orchestrator only. Each domain lives in its own seeder under `prisma/seeders/`
 * and is individually idempotent; this file just fixes the order in which they
 * run, since roles need the permission rows and the bootstrap user needs the
 * Super Admin role.
 *
 * Adding an ERP module = add `<domain>.seeder.ts`, export it from the barrel,
 * and append one line below.
 */
async function main() {
  // Imported dynamically, not at the top: every module below transitively pulls
  // `@/lib/prisma`, which reads DATABASE_URL at module-eval time — a static
  // import would be hoisted above the loadEnvFile() call.
  const { prisma } = await import('@/lib/prisma');
  const {
    seedPermissions,
    seedRoles,
    seedUsers,
    seedCurrencies,
    seedCountries,
    seedAccounts,
    seedProducts,
    seedUnits,
    seedPartners,
    seedCustomers,
    seedSupplies,
  } = await import('./seeders');

  try {
    const permissions = await seedPermissions();
    const roles = await seedRoles(permissions);
    await seedUsers(roles);

    // Reference data. Currencies first — countries carry the FK.
    await seedCurrencies();
    await seedCountries();

    // Chart of accounts — the full standard tree; company-specific extras are
    // added from the UI.
    await seedAccounts();

    // Master barang — baris dokumen pembelian menunjuk ke sini, jadi tanpa satu
    // pun produk aktif form pembelian tidak punya apa pun untuk dipilih.
    await seedProducts();

    // Master satuan & tipe satuan — anchor-based conversion
    await seedUnits();

    // Master mitra (supplier + customer legacy) + bahan operasional (supply) —
    // wajib sesudah currency & country (FK-nya), supaya form PR/PO/SO yang
    // sudah tersambung database punya pilihan.
    await seedPartners();
    await seedCustomers();
    await seedSupplies();

    console.log('Seed complete.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
