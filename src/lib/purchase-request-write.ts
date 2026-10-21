import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { roundTo } from '@/lib/number';
import { WEIGHT_SCALE } from '@/lib/weight';
import {
  canApprovePurchaseRequest,
  canVoidPurchaseRequest,
  estimatedLineAmount,
  isMetalCategory,
  isPurchaseRequestEditable,
} from '@/lib/purchase-request';
import { createWithPurchaseRequestNumber } from '@/lib/purchase-request-number';
import { toUtcDateOnly } from '@/lib/date';
import type { CreatePurchaseRequestInput } from '@/lib/validations';
import type {
  PurchaseRequestCategory,
  PurchaseRequestPriority,
} from '@/types/value-objects';

const WEIGHT_CATEGORY_CODE = 'WEIGHT';

/**
 * Gerbang tulis permintaan pembelian. **Ia tidak pernah menyentuh emas maupun
 * uang** — tidak ada jurnal, tidak ada lot, tidak ada mutasi. Yang dijaganya
 * cuma tiga hal yang tidak bisa dijawab payload sendirian: barisnya menunjuk
 * master yang benar untuk kategorinya, masternya masih aktif, dan transisinya
 * memang boleh dari status sekarang.
 */

export const PURCHASE_REQUEST_INCLUDE = {
  suggestedPartner: { select: { id: true, name: true } },
  items: {
    orderBy: { lineNo: 'asc' },
    include: {
      product: { select: { id: true, code: true, name: true, metal: true, form: true } },
      supply: { select: { id: true, code: true, name: true, category: true, unit: true } },
      unit: {
        select: {
          id: true,
          code: true,
          symbol: true,
          name: true,
          conversionFactor: true,
          isAnchor: true,
          category: { select: { code: true } },
        },
      },
    },
  },
} satisfies Prisma.PurchaseRequestInclude;

export const PURCHASE_REQUEST_DETAIL_INCLUDE = {
  ...PURCHASE_REQUEST_INCLUDE,
  createdBy: { select: { id: true, name: true } },
  approvedBy: { select: { id: true, name: true } },
  voidedBy: { select: { id: true, name: true } },
} satisfies Prisma.PurchaseRequestInclude;

export type PurchaseRequestRow = Prisma.PurchaseRequestGetPayload<{
  include: typeof PURCHASE_REQUEST_INCLUDE;
}>;

export type PurchaseRequestDetailRow = Prisma.PurchaseRequestGetPayload<{
  include: typeof PURCHASE_REQUEST_DETAIL_INCLUDE;
}>;

/**
 * Sisa tiap baris dihitung dari `PurchaseOrderItem.purchaseRequestItemId` —
 * relasi yang skema sediakan justru untuk ini. `weightGram` sudah gram apa
 * pun `weightUnit` barisnya, dan baris PR logam juga selalu gram (anchor
 * kategori `WEIGHT`), jadi keduanya langsung dijumlah tanpa konversi. PO
 * yang dibatalkan tidak ikut terhitung — barangnya tidak pernah datang.
 */
export async function orderedQuantityByRequestItem(
  requestItemIds: string[],
): Promise<Map<string, number>> {
  if (requestItemIds.length === 0) return new Map();

  const rows = await prisma.purchaseOrderItem.groupBy({
    by: ['purchaseRequestItemId'],
    where: {
      purchaseRequestItemId: { in: requestItemIds },
      purchase: { status: { not: 'VOID' } },
    },
    _sum: { weightGram: true },
  });

  const map = new Map<string, number>();
  for (const row of rows) {
    if (row.purchaseRequestItemId) {
      map.set(row.purchaseRequestItemId, Number(row._sum.weightGram ?? 0));
    }
  }
  return map;
}

/**
 * Seluruh barisnya sudah tertutup PO. Permintaan tanpa baris tidak pernah
 * terpenuhi — kalau tidak, PR kosong akan berdiri di layar sebagai "sudah jadi
 * PO" tanpa satu pun PO.
 */
export function isRequestFulfilled(
  items: { id: string; quantity: Prisma.Decimal }[],
  ordered: Map<string, number>,
): boolean {
  if (items.length === 0) return false;

  return items.every((item) => (ordered.get(item.id) ?? 0) >= Number(item.quantity));
}

export function hasAnyOrder(
  items: { id: string }[],
  ordered: Map<string, number>,
): boolean {
  return items.some((item) => (ordered.get(item.id) ?? 0) > 0);
}

// ── Penjaga isi ──────────────────────────────────────────────────────────────

export interface PurchaseRequestItemInput {
  /** Terisi untuk kategori logam. */
  productId: string | null;
  /** Terisi untuk kategori supply. */
  supplyId: string | null;
  /** Satuan yang dipakai mengetik `quantity` — wajib untuk semua kategori. */
  unitId: string;
  /** Dalam satuan barisnya — dikonversi ke anchor kategorinya di sini, sekali. */
  quantity: number;
  estUnitPrice: number;
  notes: string | null;
}

export interface PurchaseRequestWriteInput {
  category: PurchaseRequestCategory;
  date: Date;
  requiredDate: Date | null;
  department: string;
  priority: PurchaseRequestPriority;
  suggestedPartnerId: string | null;
  currencyCode: string;
  notes: string | null;
  items: PurchaseRequestItemInput[];
  /** Legacy `PurchaseRequestPage`: nama pemohon & rekomendasi supplier sebagai teks bebas. */
  requesterName: string | null;
  recommendedSupplier: string | null;
}

/**
 * Payload tervalidasi → input gerbang. Satu tempat, dipakai `POST` dan `PATCH`:
 * dua salinan pemetaan yang sama adalah dua tempat untuk lupa memindahkan satu
 * field saat formnya bertambah.
 */
export function toPurchaseRequestWriteInput(
  body: CreatePurchaseRequestInput,
): PurchaseRequestWriteInput {
  return {
    category: body.category,
    date: toUtcDateOnly(body.date),
    requiredDate: body.required_date ? toUtcDateOnly(body.required_date) : null,
    department: body.department,
    priority: body.priority ?? 'NORMAL',
    suggestedPartnerId: body.suggested_partner_id ?? null,
    currencyCode: body.currency_code ?? 'IDR',
    notes: body.notes ?? null,
    requesterName: body.requester_name ?? null,
    recommendedSupplier: body.recommended_supplier ?? null,
    items: body.items.map((item) => ({
      productId: item.product_id ?? null,
      supplyId: item.supply_id ?? null,
      unitId: item.unit_id,
      quantity: item.quantity,
      estUnitPrice: item.est_unit_price,
      notes: item.notes ?? null,
    })),
  };
}

interface UnitRef {
  id: string;
  conversionFactor: number;
  categoryCode: string;
  isActive: boolean;
}

/**
 * Kategori dokumen memutuskan kolom identitas mana yang berlaku, dan baris yang
 * mengisi kolom milik kategori lain ditolak di sini — bukan diam-diam diabaikan.
 * Baris yang ditolak menyebut nomornya, karena "ada baris yang salah" pada
 * dokumen sepuluh baris bukan pesan yang bisa ditindaklanjuti siapa pun.
 *
 * Baris logam wajib memilih satuan berkategori `WEIGHT` — barang berat tidak
 * pernah dijual per liter atau per meter. Baris supply bebas memilih kategori
 * satuan apa pun (`VOLUME` untuk jerigen, `UNIT` untuk pcs, dst).
 */
function assertItemsMatchCategory(
  category: PurchaseRequestCategory,
  items: PurchaseRequestItemInput[],
  units: Map<string, UnitRef>,
): void {
  const wantsMetal = isMetalCategory(category);

  items.forEach((item, index) => {
    const lineNo = index + 1;
    const unit = units.get(item.unitId);
    if (!unit) {
      throw new NotFoundError(`Baris ke-${lineNo} memilih satuan yang tidak ditemukan.`);
    }
    if (!unit.isActive) {
      throw new ValidationError(`Baris ke-${lineNo} memilih satuan yang sudah nonaktif.`);
    }

    if (wantsMetal) {
      if (!item.productId) {
        throw new ValidationError(`Baris ke-${lineNo} belum memilih barang logam.`);
      }
      if (item.supplyId) {
        throw new ValidationError(
          `Baris ke-${lineNo} berisi barang non-logam, padahal permintaan ini berkategori logam. Pindahkan ke permintaan tersendiri.`,
        );
      }
      if (unit.categoryCode !== WEIGHT_CATEGORY_CODE) {
        throw new ValidationError(`Baris ke-${lineNo} harus memilih satuan berat, bukan satuan lain.`);
      }
      return;
    }

    if (!item.supplyId) {
      throw new ValidationError(`Baris ke-${lineNo} belum memilih barang non-logam.`);
    }
    if (item.productId) {
      throw new ValidationError(
        `Baris ke-${lineNo} berisi barang logam, padahal permintaan ini berkategori barang non-logam. Pindahkan ke permintaan tersendiri.`,
      );
    }
  });
}

async function loadUnits(unitIds: string[]): Promise<Map<string, UnitRef>> {
  const rows = await prisma.unit.findMany({
    where: { id: { in: unitIds } },
    select: { id: true, conversionFactor: true, isActive: true, category: { select: { code: true } } },
  });

  const map = new Map<string, UnitRef>();
  for (const row of rows) {
    map.set(row.id, {
      id: row.id,
      conversionFactor: Number(row.conversionFactor),
      categoryCode: row.category.code,
      isActive: row.isActive,
    });
  }
  return map;
}

async function assertProductsUsable(productIds: string[]): Promise<void> {
  if (productIds.length === 0) return;

  const rows = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, isActive: true },
  });

  if (rows.length !== new Set(productIds).size) {
    throw new NotFoundError('Ada barang yang dipilih tapi tidak ditemukan di master.');
  }

  const inactive = rows.find((row) => !row.isActive);
  if (inactive) {
    throw new ValidationError(`Barang ${inactive.name} sudah nonaktif, jadi tidak bisa diminta.`);
  }
}

async function assertSuppliesUsable(supplyIds: string[]): Promise<void> {
  if (supplyIds.length === 0) return;

  const rows = await prisma.supply.findMany({
    where: { id: { in: supplyIds } },
    select: { id: true, name: true, isActive: true },
  });

  if (rows.length !== new Set(supplyIds).size) {
    throw new NotFoundError('Ada barang non-logam yang dipilih tapi tidak ditemukan di master.');
  }

  const inactive = rows.find((row) => !row.isActive);
  if (inactive) {
    throw new ValidationError(`Barang ${inactive.name} sudah nonaktif, jadi tidak bisa diminta.`);
  }
}

/**
 * Mitra yang **diusulkan** — jadi yang diperiksa cuma bahwa ia memang supplier.
 * Asalnya (dalam / luar negeri) sengaja tidak digerbangi di sini: usulan pengaju
 * bukan keputusan, dan yang benar-benar mengikat diperiksa saat PO dibuat oleh
 * `assertPartnerMatchesType` di gerbang pembelian.
 */
async function assertPartnerUsable(partnerId: string): Promise<void> {
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    select: { name: true, isSupplier: true, isActive: true },
  });
  if (!partner) throw new NotFoundError('Mitra yang diusulkan tidak ditemukan.');
  if (!partner.isActive) {
    throw new ValidationError(`Mitra ${partner.name} sudah nonaktif, jadi tidak bisa diusulkan.`);
  }
  if (!partner.isSupplier) {
    throw new ValidationError(`Mitra ${partner.name} tidak berperan sebagai supplier.`);
  }
}

/** Baris input → kolom baris. Konversi ke satuan anchor terjadi persis sekali, di sini. */
function toItemColumns(items: PurchaseRequestItemInput[], units: Map<string, UnitRef>) {
  return items.map((item, index) => {
    const unit = units.get(item.unitId);
    if (!unit) throw new NotFoundError(`Baris ke-${index + 1} memilih satuan yang tidak ditemukan.`);

    const quantityAnchor = item.quantity * unit.conversionFactor;

    return {
      lineNo: index + 1,
      productId: item.productId,
      supplyId: item.supplyId,
      unitId: item.unitId,
      quantity: roundTo(quantityAnchor, WEIGHT_SCALE),
      estUnitPrice: item.estUnitPrice,
      estAmount: estimatedLineAmount(quantityAnchor, unit.conversionFactor, item.estUnitPrice),
      notes: item.notes,
    };
  });
}

async function assertInputUsable(input: PurchaseRequestWriteInput): Promise<Map<string, UnitRef>> {
  const units = await loadUnits(input.items.map((item) => item.unitId));
  assertItemsMatchCategory(input.category, input.items, units);

  await assertProductsUsable(
    input.items.map((item) => item.productId).filter((id): id is string => id !== null),
  );
  await assertSuppliesUsable(
    input.items.map((item) => item.supplyId).filter((id): id is string => id !== null),
  );
  if (input.suggestedPartnerId) await assertPartnerUsable(input.suggestedPartnerId);

  return units;
}

// ── Tulis ────────────────────────────────────────────────────────────────────

export async function createPurchaseRequest(
  input: PurchaseRequestWriteInput,
  actorId: string,
): Promise<PurchaseRequestDetailRow> {
  const units = await assertInputUsable(input);

  return createWithPurchaseRequestNumber(input.date, (number) =>
    prisma.purchaseRequest.create({
      data: {
        number,
        category: input.category,
        date: input.date,
        requiredDate: input.requiredDate,
        department: input.department,
        priority: input.priority,
        suggestedPartnerId: input.suggestedPartnerId,
        currencyCode: input.currencyCode,
        notes: input.notes,
        requesterName: input.requesterName,
        recommendedSupplier: input.recommendedSupplier,
        createdById: actorId,
        items: { create: toItemColumns(input.items, units) },
      },
      include: PURCHASE_REQUEST_DETAIL_INCLUDE,
    }),
  );
}

async function loadRequest(id: string) {
  const request = await prisma.purchaseRequest.findUnique({
    where: { id },
    select: { id: true, number: true, status: true, category: true },
  });
  if (!request) throw new NotFoundError('Permintaan pembelian yang dipilih tidak ditemukan.');

  return request;
}

/**
 * Barisnya ditulis ulang seluruhnya, bukan ditambal per baris. Yang boleh diubah
 * hanyalah draft — dan draft belum pernah ditunjuk PO mana pun, jadi tidak ada
 * tautan yang bisa putus karenanya.
 */
export async function updatePurchaseRequest(
  id: string,
  input: PurchaseRequestWriteInput,
): Promise<PurchaseRequestDetailRow> {
  const request = await loadRequest(id);
  if (!isPurchaseRequestEditable(request.status)) {
    throw new ConflictError(
      'Permintaan yang sudah disetujui tidak bisa diubah lagi — batalkan lalu ajukan permintaan baru bila kebutuhannya berubah.',
    );
  }

  const units = await assertInputUsable(input);

  return prisma.$transaction(async (tx) => {
    await tx.purchaseRequestItem.deleteMany({ where: { requestId: id } });

    return tx.purchaseRequest.update({
      where: { id },
      data: {
        category: input.category,
        date: input.date,
        requiredDate: input.requiredDate,
        department: input.department,
        priority: input.priority,
        suggestedPartnerId: input.suggestedPartnerId,
        currencyCode: input.currencyCode,
        notes: input.notes,
        requesterName: input.requesterName,
        recommendedSupplier: input.recommendedSupplier,
        items: { create: toItemColumns(input.items, units) },
      },
      include: PURCHASE_REQUEST_DETAIL_INCLUDE,
    });
  });
}

export async function deletePurchaseRequest(id: string): Promise<void> {
  const request = await loadRequest(id);
  if (request.status !== 'DRAFT') {
    throw new ConflictError(
      'Hanya permintaan berstatus draft yang bisa dihapus. Yang sudah disetujui dibatalkan, bukan dihapus.',
    );
  }

  await prisma.purchaseRequest.delete({ where: { id } });
}

export async function approvePurchaseRequest(
  id: string,
  actorId: string,
): Promise<PurchaseRequestDetailRow> {
  const request = await loadRequest(id);
  if (!canApprovePurchaseRequest(request.status)) {
    throw new ConflictError('Permintaan ini sudah pernah diputuskan.');
  }

  const itemCount = await prisma.purchaseRequestItem.count({ where: { requestId: id } });
  if (itemCount === 0) {
    throw new ValidationError('Permintaan tanpa satu pun baris barang tidak bisa disetujui.');
  }

  return prisma.purchaseRequest.update({
    where: { id },
    data: { status: 'APPROVED', approvedAt: new Date(), approvedById: actorId },
    include: PURCHASE_REQUEST_DETAIL_INCLUDE,
  });
}

/**
 * Permintaan yang sudah melahirkan PO tidak dibatalkan: PO-nya berdiri sendiri
 * dan tetap berlaku, dan mencoret asal-usulnya cuma membuat asalnya tidak bisa
 * dibaca lagi. Yang begitu ditutup dengan membatalkan PO-nya lebih dulu.
 */
export async function voidPurchaseRequest(
  id: string,
  actorId: string,
  reason: string,
): Promise<PurchaseRequestDetailRow> {
  const request = await loadRequest(id);
  if (!canVoidPurchaseRequest(request.status)) {
    throw new ConflictError('Permintaan ini sudah dibatalkan.');
  }

  const items = await prisma.purchaseRequestItem.findMany({
    where: { requestId: id },
    select: { id: true },
  });
  const ordered = await orderedQuantityByRequestItem(items.map((item) => item.id));

  if (hasAnyOrder(items, ordered)) {
    throw new ValidationError(
      'Permintaan ini sudah punya PO, jadi tidak bisa dibatalkan. Batalkan dulu PO-nya bila pesanannya memang tidak jadi.',
    );
  }

  return prisma.purchaseRequest.update({
    where: { id },
    data: { status: 'VOID', voidedAt: new Date(), voidedById: actorId, voidReason: reason },
    include: PURCHASE_REQUEST_DETAIL_INCLUDE,
  });
}
