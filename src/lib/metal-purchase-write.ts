import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { toUtcDateOnly } from '@/lib/date';
import { partnerOriginFromCountry } from '@/lib/partner';
import { computeMetalPurchaseItem, METAL_PURCHASE_STATUS_LABELS } from '@/lib/metal-purchase';
import type { CreateMetalPurchaseInput } from '@/lib/validations';

/**
 * Pemeriksaan referensi yang dilakukan setiap penulisan pembelian — supplier
 * harus aktif dan berperan `isSupplier` dengan asal yang cocok (`type`), dan
 * produk harus aktif. Hidup terpisah dari route supaya create dan update tidak
 * bisa menegakkannya berbeda.
 */
export async function assertPartnerMatchesType(
  partnerId: string,
  type: 'LOCAL' | 'IMPORT',
): Promise<void> {
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    select: { name: true, isActive: true, isSupplier: true, country: { select: { iso2: true } } },
  });

  if (!partner) throw new NotFoundError('Supplier yang dipilih tidak ditemukan.');
  if (!partner.isActive) {
    throw new ValidationError(`Supplier ${partner.name} sudah nonaktif, jadi tidak bisa dipakai untuk pembelian baru.`);
  }
  if (!partner.isSupplier) {
    throw new ValidationError(`${partner.name} belum berperan sebagai supplier di master mitra.`);
  }

  const origin = partnerOriginFromCountry(partner.country.iso2);
  const expected = type === 'LOCAL' ? 'LOCAL' : 'OVERSEAS';
  if (origin !== expected) {
    throw new ValidationError(
      type === 'LOCAL'
        ? `${partner.name} berasal dari luar negeri, jadi tidak bisa dipakai untuk pembelian lokal.`
        : `${partner.name} berasal dari dalam negeri, jadi tidak bisa dipakai untuk pembelian import.`,
    );
  }
}

export async function assertProductsUsable(productIds: readonly string[]): Promise<void> {
  const unique = [...new Set(productIds)];
  const products = await prisma.product.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true, isActive: true },
  });

  if (products.length !== unique.length) {
    throw new NotFoundError('Ada barang pada pembelian ini yang sudah tidak terdaftar.');
  }
  for (const product of products) {
    if (!product.isActive) {
      throw new ValidationError(`Produk ${product.name} sudah nonaktif, jadi tidak bisa dipakai untuk pembelian baru.`);
    }
  }
}

export interface PreparedMetalPurchaseItem {
  lineNo: number;
  productId: string;
  weightUnit: 'GRAM' | 'TROY_OUNCE';
  weightGram: number;
  purityPercent: number;
  fineWeightGram: number;
  priceBasis: 'GROSS' | 'FINE';
  pricePerUnit: number;
  amount: number;
  notes: string | null;
  purchaseRequestItemId: string | null;
}

/**
 * Menyiapkan baris barang: kadar untuk logam murni terkunci dari
 * `Product.defaultPurityPercent`, `priceBasis` diturunkan server dari bentuk
 * produk (batangan = GROSS, scrap/perhiasan = FINE) — tidak pernah dipilih
 * client, dan `amount` dihitung ulang di sini supaya nilainya tidak pernah
 * dikirim client.
 *
 * `requestItemProductById` datang dari `linkMetalPurchaseRequest()` — baris
 * yang merujuk `purchase_request_item_id` wajib menunjuk baris PR yang benar
 * ada pada PR yang sama dan memilih produk yang sama, atau ditolak di sini.
 * Tanpanya, satu baris bisa "melunasi" sisa baris PR yang barangnya berbeda.
 */
export async function prepareMetalPurchaseItems(
  items: CreateMetalPurchaseInput['items'],
  requestItemProductById?: Map<string, string>,
): Promise<PreparedMetalPurchaseItem[]> {
  const products = await prisma.product.findMany({
    where: { id: { in: items.map((item) => item.product_id) } },
    select: { id: true, form: true, purityLocked: true, defaultPurityPercent: true },
  });
  const byId = new Map(products.map((product) => [product.id, product]));

  return items.map((item, index) => {
    const lineNo = index + 1;
    const product = byId.get(item.product_id);
    if (!product) throw new NotFoundError('Ada barang pada pembelian ini yang sudah tidak terdaftar.');

    let purchaseRequestItemId: string | null = null;
    if (item.purchase_request_item_id) {
      if (!requestItemProductById) {
        throw new ValidationError(
          `Baris ke-${lineNo} merujuk baris Purchase Request, padahal dokumen ini tidak menyebut PR asalnya.`,
        );
      }
      const expectedProductId = requestItemProductById.get(item.purchase_request_item_id);
      if (expectedProductId === undefined) {
        throw new NotFoundError(`Baris ke-${lineNo} merujuk baris PR yang tidak ada pada PR ini.`);
      }
      if (expectedProductId !== item.product_id) {
        throw new ValidationError(
          `Baris ke-${lineNo} memilih barang yang berbeda dari baris PR yang dirujuknya.`,
        );
      }
      purchaseRequestItemId = item.purchase_request_item_id;
    }

    const purityPercent =
      product.purityLocked && product.defaultPurityPercent
        ? Number(product.defaultPurityPercent)
        : item.purity_percent;

    const priceBasis: 'GROSS' | 'FINE' = product.purityLocked ? 'GROSS' : 'FINE';

    const computed = computeMetalPurchaseItem({
      weight: item.weight_gram,
      weightUnit: item.weight_unit,
      purityPercent,
      pure: product.purityLocked,
      priceBasis,
      pricePerUnit: item.price_per_unit,
    });

    return {
      lineNo,
      productId: item.product_id,
      weightUnit: item.weight_unit,
      weightGram: computed.weightGram,
      purityPercent,
      fineWeightGram: computed.fineWeightGram,
      priceBasis,
      pricePerUnit: item.price_per_unit,
      amount: computed.amount,
      notes: item.notes,
      purchaseRequestItemId,
    };
  });
}

export function toMetalPurchaseCharges(charges: CreateMetalPurchaseInput['charges']) {
  return charges.map((charge, index) => ({
    lineNo: index + 1,
    name: charge.name,
    amountIdr: charge.amount_idr,
  }));
}

export function metalPurchaseColumns(body: CreateMetalPurchaseInput, goodsAmount: number) {
  return {
    type: body.type,
    paymentType: body.payment_type,
    partnerId: body.partner_id,
    date: toUtcDateOnly(body.date),
    dueDate: body.due_date ? toUtcDateOnly(body.due_date) : null,
    supplierInvoiceNumber: body.supplier_invoice_number,
    currencyCode: body.currency_code,
    exchangeRate: body.exchange_rate,
    pibNumber: body.pib_number,
    sppbNumber: body.sppb_number,
    mawbNumber: body.mawb_number,
    courierName: body.courier_name,
    courierMandateNumber: body.courier_mandate_number,
    pickupLocation: body.pickup_location,
    goodsAmount,
    notes: body.notes,
  };
}

const PURCHASE_REQUEST_CATEGORY_BY_TYPE = {
  IMPORT: 'GOLD_IMPORT',
  LOCAL: 'GOLD_LOCAL',
} as const;

export interface LinkedPurchaseRequest {
  id: string;
  /** Baris PR-nya: `requestItemId → productId`, dipakai memvalidasi rujukan baris PO. */
  itemProductById: Map<string, string>;
}

/**
 * Memvalidasi PR yang dijadikan referensi PO, lalu menyiapkan relasinya.
 * PR wajib sudah APPROVED dan kategorinya harus cocok dengan tipe dokumen
 * (IMPORT → GOLD_IMPORT, LOCAL → GOLD_LOCAL) — cermin aturan konversi legacy
 * (hanya PR emas impor/lokal yang bisa jadi PO emas; non-logam lewat jalurnya
 * sendiri). Sisa PR-nya tidak dikunci di sini — ia hasil agregasi
 * (`orderedQuantityByRequestItem()`), bukan status yang ditulis: satu PR
 * boleh dikonversi berkali-kali sampai seluruh barisnya tertutup.
 */
export async function linkMetalPurchaseRequest(
  purchaseRequestId: string,
  type: 'LOCAL' | 'IMPORT',
): Promise<LinkedPurchaseRequest> {
  const request = await prisma.purchaseRequest.findUnique({
    where: { id: purchaseRequestId },
    select: {
      id: true,
      number: true,
      status: true,
      category: true,
      items: { select: { id: true, productId: true } },
    },
  });

  if (!request) throw new NotFoundError('Purchase Request yang dirujuk tidak ditemukan.');
  if (request.status !== 'APPROVED') {
    throw new ValidationError(
      `PR ${request.number} belum disetujui (status ${request.status}), jadi belum bisa dikonversi menjadi PO.`,
    );
  }
  const expected = PURCHASE_REQUEST_CATEGORY_BY_TYPE[type];
  if (request.category !== expected) {
    throw new ValidationError(
      `PR ${request.number} berkategori ${request.category}, tidak bisa dijadikan PO ${type === 'IMPORT' ? 'impor' : 'lokal'}.`,
    );
  }

  const itemProductById = new Map(
    request.items
      .filter((item): item is { id: string; productId: string } => item.productId !== null)
      .map((item) => [item.id, item.productId]),
  );

  return { id: request.id, itemProductById };
}

/** Hanya draft yang boleh dikonfirmasi atau dibatalkan lewat handler yang sesuai. */
export async function assertMetalPurchaseDraft(id: string): Promise<{ id: string }> {
  const purchase = await prisma.purchaseOrder.findUnique({ where: { id }, select: { status: true } });
  if (!purchase) throw new NotFoundError('Pembelian yang dipilih tidak ditemukan.');
  if (purchase.status !== 'DRAFT') {
    throw new ConflictError(
      `Pembelian ini berstatus ${METAL_PURCHASE_STATUS_LABELS[purchase.status]}, jadi tidak bisa diubah lagi.`,
    );
  }
  return { id };
}

export async function confirmMetalPurchase(
  id: string,
  actorId: string,
  tx: Prisma.TransactionClient,
): Promise<void> {
  const purchase = await tx.purchaseOrder.findUnique({ where: { id }, select: { status: true } });
  if (!purchase) throw new NotFoundError('Pembelian yang dipilih tidak ditemukan.');
  if (purchase.status !== 'DRAFT') {
    throw new ConflictError(
      `Pembelian ini berstatus ${METAL_PURCHASE_STATUS_LABELS[purchase.status]}, jadi tidak bisa dikonfirmasi.`,
    );
  }

  await tx.purchaseOrder.update({
    where: { id },
    data: { status: 'CONFIRMED', confirmedById: actorId, confirmedAt: new Date() },
  });
}

/** Draft belum menyentuh apa pun, jadi boleh dihapus utuh — cascade menghapus items/charges-nya. */
export async function deleteMetalPurchase(id: string): Promise<void> {
  const purchase = await prisma.purchaseOrder.findUnique({ where: { id }, select: { status: true } });
  if (!purchase) throw new NotFoundError('Pembelian yang dipilih tidak ditemukan.');
  if (purchase.status !== 'DRAFT') {
    throw new ConflictError('Hanya draft yang bisa dihapus. Pembelian yang sudah dikonfirmasi dibatalkan, bukan dihapus.');
  }

  await prisma.purchaseOrder.delete({ where: { id } });
}

export async function voidMetalPurchase(
  id: string,
  actorId: string,
  reason: string,
  tx: Prisma.TransactionClient,
): Promise<void> {
  const purchase = await tx.purchaseOrder.findUnique({ where: { id }, select: { status: true } });
  if (!purchase) throw new NotFoundError('Pembelian yang dipilih tidak ditemukan.');
  if (purchase.status !== 'CONFIRMED') {
    throw new ConflictError(
      `Pembelian ini berstatus ${METAL_PURCHASE_STATUS_LABELS[purchase.status]}, jadi tidak bisa dibatalkan.`,
    );
  }

  await tx.purchaseOrder.update({
    where: { id },
    data: { status: 'VOID', voidedById: actorId, voidedAt: new Date(), voidReason: reason },
  });
}
