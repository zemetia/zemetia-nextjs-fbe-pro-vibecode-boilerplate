import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { toUtcDateOnly } from '@/lib/date';
import { partnerOriginFromCountry } from '@/lib/partner';
import {
  computeSalesOrderItem,
  SALES_INVOICE_STATUS_LABELS,
  SALES_STATUS_LABELS,
} from '@/lib/sales';
import type { CreateSalesOrderInput, CreateSalesDeliveryInput, CreateSalesInvoiceInput } from '@/lib/validations';

/**
 * Pemeriksaan referensi yang dilakukan setiap penulisan penjualan — customer
 * harus aktif dan berperan `isCustomer` dengan asal yang cocok (`type`), dan
 * produk harus aktif. Hidup terpisah dari route supaya create dan update tidak
 * bisa menegakkannya berbeda.
 */
export async function assertPartnerIsSalesCustomer(
  partnerId: string,
  type: 'LOCAL' | 'EXPORT',
): Promise<void> {
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    select: { name: true, isActive: true, isCustomer: true, country: { select: { iso2: true } } },
  });

  if (!partner) throw new NotFoundError('Customer yang dipilih tidak ditemukan.');
  if (!partner.isActive) {
    throw new ValidationError(`Customer ${partner.name} sudah nonaktif, jadi tidak bisa dipakai untuk penjualan baru.`);
  }
  if (!partner.isCustomer) {
    throw new ValidationError(`${partner.name} belum berperan sebagai customer di master mitra.`);
  }

  const origin = partnerOriginFromCountry(partner.country.iso2);
  const expected = type === 'LOCAL' ? 'LOCAL' : 'OVERSEAS';
  if (origin !== expected) {
    throw new ValidationError(
      type === 'LOCAL'
        ? `${partner.name} berasal dari luar negeri, jadi tidak bisa dipakai untuk penjualan lokal.`
        : `${partner.name} berasal dari dalam negeri, jadi tidak bisa dipakai untuk penjualan ekspor.`,
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
    throw new NotFoundError('Ada barang pada penjualan ini yang sudah tidak terdaftar.');
  }
  for (const product of products) {
    if (!product.isActive) {
      throw new ValidationError(`Produk ${product.name} sudah nonaktif, jadi tidak bisa dipakai untuk penjualan baru.`);
    }
  }
}

export interface PreparedSalesOrderItem {
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
}

/**
 * Menyiapkan baris barang SO: kadar untuk logam murni terkunci dari
 * `Product.defaultPurityPercent`, `priceBasis` diturunkan server dari bentuk
 * produk (batangan = GROSS, scrap/perhiasan = FINE), dan `amount` dihitung
 * ulang di sini supaya nilainya tidak pernah dikirim client.
 */
export async function prepareSalesOrderItems(
  items: CreateSalesOrderInput['items'],
): Promise<PreparedSalesOrderItem[]> {
  const products = await prisma.product.findMany({
    where: { id: { in: items.map((item) => item.product_id) } },
    select: { id: true, form: true, purityLocked: true, defaultPurityPercent: true },
  });
  const byId = new Map(products.map((product) => [product.id, product]));

  return items.map((item, index) => {
    const product = byId.get(item.product_id);
    if (!product) throw new NotFoundError('Ada barang pada penjualan ini yang sudah tidak terdaftar.');

    const purityPercent =
      product.purityLocked && product.defaultPurityPercent
        ? Number(product.defaultPurityPercent)
        : item.purity_percent;

    const priceBasis: 'GROSS' | 'FINE' = product.purityLocked ? 'GROSS' : 'FINE';

    const computed = computeSalesOrderItem({
      weight: item.weight_gram,
      weightUnit: item.weight_unit,
      purityPercent,
      pure: product.purityLocked,
      priceBasis,
      pricePerUnit: item.price_per_unit,
    });

    return {
      lineNo: index + 1,
      productId: item.product_id,
      weightUnit: item.weight_unit,
      weightGram: computed.weightGram,
      purityPercent,
      fineWeightGram: computed.fineWeightGram,
      priceBasis,
      pricePerUnit: item.price_per_unit,
      amount: computed.amount,
      notes: item.notes,
    };
  });
}

export function salesOrderColumns(body: CreateSalesOrderInput, goodsAmount: number) {
  return {
    type: body.type,
    paymentType: body.payment_type,
    partnerId: body.partner_id,
    date: toUtcDateOnly(body.date),
    dueDate: body.due_date ? toUtcDateOnly(body.due_date) : null,
    customerPoNumber: body.customer_po_number,
    currencyCode: body.currency_code,
    exchangeRate: body.exchange_rate,
    goodsAmount,
    notes: body.notes,
  };
}

/** Hanya draft yang boleh dikonfirmasi, diubah, atau dihapus. */
export async function assertSalesOrderDraft(id: string): Promise<void> {
  const order = await prisma.salesOrder.findUnique({ where: { id }, select: { status: true } });
  if (!order) throw new NotFoundError('Sales order yang dipilih tidak ditemukan.');
  if (order.status !== 'DRAFT') {
    throw new ConflictError(
      `Sales order ini berstatus ${SALES_STATUS_LABELS[order.status]}, jadi tidak bisa diubah lagi.`,
    );
  }
}

export async function confirmSalesOrder(
  id: string,
  actorId: string,
  tx: Prisma.TransactionClient,
): Promise<void> {
  const order = await tx.salesOrder.findUnique({ where: { id }, select: { status: true } });
  if (!order) throw new NotFoundError('Sales order yang dipilih tidak ditemukan.');
  if (order.status !== 'DRAFT') {
    throw new ConflictError(
      `Sales order ini berstatus ${SALES_STATUS_LABELS[order.status]}, jadi tidak bisa dikonfirmasi.`,
    );
  }

  await tx.salesOrder.update({
    where: { id },
    data: { status: 'CONFIRMED', confirmedById: actorId, confirmedAt: new Date() },
  });
}

/** Draft belum menyentuh apa pun, jadi boleh dihapus utuh — cascade menghapus items-nya. */
export async function deleteSalesOrder(id: string): Promise<void> {
  const order = await prisma.salesOrder.findUnique({ where: { id }, select: { status: true } });
  if (!order) throw new NotFoundError('Sales order yang dipilih tidak ditemukan.');
  if (order.status !== 'DRAFT') {
    throw new ConflictError('Hanya draft yang bisa dihapus. Sales order yang sudah dikonfirmasi dibatalkan, bukan dihapus.');
  }

  await prisma.salesOrder.delete({ where: { id } });
}

export async function voidSalesOrder(
  id: string,
  actorId: string,
  reason: string,
  tx: Prisma.TransactionClient,
): Promise<void> {
  const order = await tx.salesOrder.findUnique({ where: { id }, select: { status: true } });
  if (!order) throw new NotFoundError('Sales order yang dipilih tidak ditemukan.');
  if (order.status !== 'CONFIRMED') {
    throw new ConflictError(
      `Sales order ini berstatus ${SALES_STATUS_LABELS[order.status]}, jadi tidak bisa dibatalkan.`,
    );
  }

  await tx.salesOrder.update({
    where: { id },
    data: { status: 'VOID', voidedById: actorId, voidedAt: new Date(), voidReason: reason },
  });
}

// ── Surat Jalan ──────────────────────────────────────────────────────────────

/** SO harus sudah dikonfirmasi sebelum barangnya boleh keluar. */
export async function assertSalesOrderConfirmed(orderId: string): Promise<void> {
  const order = await prisma.salesOrder.findUnique({
    where: { id: orderId },
    select: { status: true },
  });
  if (!order) throw new NotFoundError('Dokumen SO yang dipilih tidak ditemukan.');
  if (order.status !== 'CONFIRMED') {
    throw new ValidationError('Dokumen SO ini belum dikonfirmasi, jadi belum bisa mengeluarkan barang.');
  }
}

/** Setiap baris surat jalan wajib menunjuk barang SO yang sama dengan dokumennya. */
export async function assertLinesBelongToOrder(
  orderId: string,
  orderItemIds: readonly string[],
): Promise<void> {
  const unique = [...new Set(orderItemIds)];
  const items = await prisma.salesOrderItem.findMany({
    where: { id: { in: unique }, orderId },
    select: { id: true },
  });
  if (items.length !== unique.length) {
    throw new ValidationError('Ada baris barang yang tidak ditemukan pada dokumen SO ini.');
  }
}

export function toDeliveryLineRows(lines: CreateSalesDeliveryInput['lines']) {
  return lines.map((line) => ({
    orderItemId: line.order_item_id,
    lotId: line.lot_id,
    locationId: line.location_id,
    pieceCount: line.piece_count ?? 0,
    grossWeightGram: line.gross_weight_gram,
    purityPercent: line.purity_percent,
    fineWeightGram: Math.round(((line.gross_weight_gram * line.purity_percent) / 100) * 10000) / 10000,
    note: line.note,
  }));
}

export function toDeliveryChargeRows(charges: CreateSalesDeliveryInput['charges']) {
  return charges.map((charge, index) => ({
    lineNo: index + 1,
    name: charge.name,
    amountIdr: charge.amount_idr,
  }));
}

export function salesDeliveryColumns(body: CreateSalesDeliveryInput) {
  return {
    orderId: body.order_id,
    date: toUtcDateOnly(body.date),
    recipientName: body.recipient_name,
    deliveryMethod: body.delivery_method,
    courierName: body.courier_name,
    carrierName: body.carrier_name,
    awbNumber: body.awb_number,
    pebNumber: body.peb_number,
    sealNumber: body.seal_number,
    boxCount: body.box_count,
    goldCertificateNo: body.gold_certificate_no,
    purityCertificateNo: body.purity_certificate_no,
    notes: body.notes,
  };
}

export async function assertSalesDeliveryDraft(id: string): Promise<void> {
  const delivery = await prisma.salesDelivery.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!delivery) throw new NotFoundError('Surat jalan yang dipilih tidak ditemukan.');
  if (delivery.status !== 'DRAFT') {
    throw new ConflictError(
      `Surat jalan ini berstatus ${SALES_STATUS_LABELS[delivery.status]}, jadi tidak bisa diubah lagi.`,
    );
  }
}

export async function deleteSalesDelivery(id: string): Promise<void> {
  const delivery = await prisma.salesDelivery.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!delivery) throw new NotFoundError('Surat jalan yang dipilih tidak ditemukan.');
  if (delivery.status !== 'DRAFT') {
    throw new ConflictError('Hanya draft yang bisa dihapus. Surat jalan yang sudah berjalan dibatalkan, bukan dihapus.');
  }

  await prisma.salesDelivery.delete({ where: { id } });
}

/** Surat jalan yang sudah dikonfirmasi dibatalkan — mutasi & jurnalnya ikut di-VOID. */
export async function voidSalesDelivery(
  id: string,
  actorId: string,
  reason: string,
  tx: Prisma.TransactionClient,
): Promise<void> {
  const delivery = await tx.salesDelivery.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!delivery) throw new NotFoundError('Surat jalan yang dipilih tidak ditemukan.');
  if (delivery.status !== 'CONFIRMED') {
    throw new ConflictError(
      `Surat jalan ini berstatus ${SALES_STATUS_LABELS[delivery.status]}, jadi tidak bisa dibatalkan.`,
    );
  }

  await tx.salesDelivery.update({
    where: { id },
    data: { status: 'VOID', voidedById: actorId, voidedAt: new Date(), voidReason: reason },
  });
}

// ── Faktur ───────────────────────────────────────────────────────────────────

export function toInvoiceItemRows(items: CreateSalesInvoiceInput['items']) {
  return items.map((item) => ({
    orderItemId: item.order_item_id,
    weightGram: item.weight_gram,
    amount: item.amount,
  }));
}

export function salesInvoiceColumns(body: CreateSalesInvoiceInput) {
  return {
    orderId: body.order_id,
    date: toUtcDateOnly(body.date),
    dueDate: body.due_date ? toUtcDateOnly(body.due_date) : null,
    currencyCode: body.currency_code,
    exchangeRate: body.exchange_rate,
    subtotalAmount: body.subtotal_amount,
    dpAmount: body.dp_amount,
    totalAmount: body.total_amount,
    taxFacility: body.tax_facility,
    taxAmountIdr: body.tax_amount_idr,
    paymentMode: body.payment_mode,
    dheBcaAccount: body.dhe_bca_account,
    pebNumber: body.peb_number,
    awbNumber: body.awb_number,
    notes: body.notes,
  };
}

export async function assertSalesInvoiceDraft(id: string): Promise<void> {
  const invoice = await prisma.salesInvoice.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!invoice) throw new NotFoundError('Faktur yang dipilih tidak ditemukan.');
  if (invoice.status !== 'DRAFT') {
    throw new ConflictError(
      `Faktur ini berstatus ${SALES_INVOICE_STATUS_LABELS[invoice.status]}, jadi tidak bisa diubah lagi.`,
    );
  }
}
