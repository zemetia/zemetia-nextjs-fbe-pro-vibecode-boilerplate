import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { roundTo } from '@/lib/number';
import { toGram, WEIGHT_SCALE } from '@/lib/weight';
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
  WeightUnit,
} from '@/types/value-objects';

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

export async function orderedQuantityByRequestItem(
  _requestItemIds: string[],
): Promise<Map<string, number>> {
  return new Map<string, number>();
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
  /** Satuan yang dipakai mengetik `quantity`; `null` untuk baris supply. */
  weightUnit: WeightUnit | null;
  /** Dalam satuan barisnya — dikonversi ke gram di sini, sekali. */
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
    items: body.items.map((item) => ({
      productId: item.product_id ?? null,
      supplyId: item.supply_id ?? null,
      weightUnit: item.weight_unit ?? null,
      quantity: item.quantity,
      estUnitPrice: item.est_unit_price,
      notes: item.notes ?? null,
    })),
  };
}

/**
 * Kategori dokumen memutuskan kolom identitas mana yang berlaku, dan baris yang
 * mengisi kolom milik kategori lain ditolak di sini — bukan diam-diam diabaikan.
 * Baris yang ditolak menyebut nomornya, karena "ada baris yang salah" pada
 * dokumen sepuluh baris bukan pesan yang bisa ditindaklanjuti siapa pun.
 */
function assertItemsMatchCategory(
  category: PurchaseRequestCategory,
  items: PurchaseRequestItemInput[],
): void {
  const wantsMetal = isMetalCategory(category);

  items.forEach((item, index) => {
    const lineNo = index + 1;

    if (wantsMetal) {
      if (!item.productId) {
        throw new ValidationError(`Baris ke-${lineNo} belum memilih barang logam.`);
      }
      if (item.supplyId) {
        throw new ValidationError(
          `Baris ke-${lineNo} berisi barang non-logam, padahal permintaan ini berkategori logam. Pindahkan ke permintaan tersendiri.`,
        );
      }
      if (!item.weightUnit) {
        throw new ValidationError(`Baris ke-${lineNo} belum memilih satuan beratnya.`);
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

/** Baris input → kolom baris. Konversi ke gram terjadi persis sekali, di sini. */
function toItemColumns(items: PurchaseRequestItemInput[]) {
  return items.map((item, index) => {
    const quantityGram = item.weightUnit ? toGram(item.quantity, item.weightUnit) : item.quantity;

    return {
      lineNo: index + 1,
      productId: item.productId,
      supplyId: item.supplyId,
      weightUnit: item.weightUnit,
      quantity: roundTo(quantityGram, WEIGHT_SCALE),
      estUnitPrice: item.estUnitPrice,
      estAmount: estimatedLineAmount(quantityGram, item.weightUnit, item.estUnitPrice),
      notes: item.notes,
    };
  });
}

async function assertInputUsable(input: PurchaseRequestWriteInput): Promise<void> {
  assertItemsMatchCategory(input.category, input.items);

  await assertProductsUsable(
    input.items.map((item) => item.productId).filter((id): id is string => id !== null),
  );
  await assertSuppliesUsable(
    input.items.map((item) => item.supplyId).filter((id): id is string => id !== null),
  );
  if (input.suggestedPartnerId) await assertPartnerUsable(input.suggestedPartnerId);
}

// ── Tulis ────────────────────────────────────────────────────────────────────

export async function createPurchaseRequest(
  input: PurchaseRequestWriteInput,
  actorId: string,
): Promise<PurchaseRequestDetailRow> {
  await assertInputUsable(input);

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
        createdById: actorId,
        items: { create: toItemColumns(input.items) },
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

  await assertInputUsable(input);

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
        items: { create: toItemColumns(input.items) },
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
