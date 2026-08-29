import type { Prisma, ProductionOrderStatus } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { resolvePendingApprovals } from '@/lib/approval-hooks';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { formatNumber } from '@/lib/number';
import { purityFromKarat } from '@/lib/metal-lot';
import { createWithProductionOrderNumber } from '@/lib/production-number';
import {
  canCloseProductionOrder,
  canReleaseProductionOrder,
  canVoidProductionOrder,
  isProductionOrderEditable,
  isOverLossTolerance,
  lossPercentOf,
} from '@/lib/production';

export const PRODUCTION_ORDER_INCLUDE = {} as const satisfies Prisma.ProductionOrderInclude;

export const PRODUCTION_ORDER_DETAIL_INCLUDE = {
  createdBy: { select: { id: true, name: true } },
  releasedBy: { select: { id: true, name: true } },
  closedBy: { select: { id: true, name: true } },
  voidedBy: { select: { id: true, name: true } },
} as const satisfies Prisma.ProductionOrderInclude;

export type ProductionOrderRow = Prisma.ProductionOrderGetPayload<{
  include: typeof PRODUCTION_ORDER_INCLUDE;
}>;

export type ProductionOrderDetailRow = Prisma.ProductionOrderGetPayload<{
  include: typeof PRODUCTION_ORDER_DETAIL_INCLUDE;
}>;

export interface ProductionBalance {
  issuedFineGram: number;
  returnedFineGram: number;
  consumedFineGram: number;
  outputFineGram: number;
  outputGrossWeightGram: number;
  outputPieceCount: number;
  lossFineGram: number;
  alloyGram: number;
  wipFineGram: number;
}

export const EMPTY_PRODUCTION_BALANCE: ProductionBalance = {
  issuedFineGram: 0,
  returnedFineGram: 0,
  consumedFineGram: 0,
  outputFineGram: 0,
  outputGrossWeightGram: 0,
  outputPieceCount: 0,
  lossFineGram: 0,
  alloyGram: 0,
  wipFineGram: 0,
};

export async function productionBalance(
  _orderId: string,
  _client: Prisma.TransactionClient = prisma,
): Promise<ProductionBalance> {
  return EMPTY_PRODUCTION_BALANCE;
}

export async function productionBalances(
  _orderIds: readonly string[],
): Promise<Map<string, ProductionBalance>> {
  return new Map();
}

interface OrderForWrite {
  id: string;
  number: string;
  status: ProductionOrderStatus;
  lossTolerancePercent: Prisma.Decimal;
}

async function loadOrder(id: string, client: Prisma.TransactionClient): Promise<OrderForWrite> {
  const order = await client.productionOrder.findUnique({
    where: { id },
    select: {
      id: true,
      number: true,
      status: true,
      lossTolerancePercent: true,
    },
  });
  if (!order) throw new NotFoundError('SPK yang dipilih tidak ditemukan.');

  return order;
}

export interface ProductionOrderWriteInput {
  date: Date;
  targetDate: Date | null;
  modelName?: string | null;
  karat: number;
  targetGrossWeightGram: number;
  targetPieceCount: number | null;
  locationName?: string | null;
  lossTolerancePercent: number;
  notes: string | null;
}

function purityFor(karat: number): number {
  const purity = purityFromKarat(karat);
  if (purity === undefined) {
    throw new ValidationError('Karat yang dipilih belum terdaftar di daftar kadar.');
  }

  return purity;
}

export async function createProductionOrder(
  input: ProductionOrderWriteInput,
  actorId: string,
): Promise<ProductionOrderDetailRow> {
  const purityPercent = purityFor(input.karat);

  return createWithProductionOrderNumber(input.date, (number) =>
    prisma.productionOrder.create({
      data: {
        number,
        date: input.date,
        targetDate: input.targetDate,
        modelName: input.modelName,
        karat: input.karat,
        purityPercent,
        targetGrossWeightGram: input.targetGrossWeightGram,
        targetPieceCount: input.targetPieceCount,
        locationName: input.locationName,
        lossTolerancePercent: input.lossTolerancePercent,
        notes: input.notes,
        createdById: actorId,
      },
      include: PRODUCTION_ORDER_DETAIL_INCLUDE,
    }),
  );
}

export async function updateProductionOrder(
  id: string,
  input: ProductionOrderWriteInput,
): Promise<ProductionOrderDetailRow> {
  const order = await loadOrder(id, prisma);
  if (!isProductionOrderEditable(order.status)) {
    throw new ConflictError(
      'SPK yang sudah dirilis tidak bisa diubah lagi — batalkan lalu buat SPK baru bila rencananya berubah.',
    );
  }

  const purityPercent = purityFor(input.karat);

  return prisma.productionOrder.update({
    where: { id },
    data: {
      date: input.date,
      targetDate: input.targetDate,
      modelName: input.modelName,
      karat: input.karat,
      purityPercent,
      targetGrossWeightGram: input.targetGrossWeightGram,
      targetPieceCount: input.targetPieceCount,
      locationName: input.locationName,
      lossTolerancePercent: input.lossTolerancePercent,
      notes: input.notes,
    },
    include: PRODUCTION_ORDER_DETAIL_INCLUDE,
  });
}

export async function deleteProductionOrder(id: string, actorId: string): Promise<void> {
  const order = await loadOrder(id, prisma);
  if (!isProductionOrderEditable(order.status)) {
    throw new ConflictError(
      'Hanya SPK berstatus draft yang bisa dihapus. SPK yang sudah dirilis dibatalkan, bukan dihapus.',
    );
  }

  await prisma.$transaction(async (tx) => {
    await resolvePendingApprovals('PRODUCTION_ORDER_RELEASE', id, 'CANCELLED', actorId, null, tx);
    await tx.productionOrder.delete({ where: { id } });
  });
}

export async function releaseProductionOrder(
  id: string,
  actorId: string,
  client: Prisma.TransactionClient = prisma,
): Promise<ProductionOrderDetailRow> {
  const order = await loadOrder(id, client);
  if (!canReleaseProductionOrder(order.status)) {
    throw new ConflictError('SPK ini sudah pernah dirilis.');
  }

  const released = await client.productionOrder.update({
    where: { id },
    data: { status: 'RELEASED', releasedAt: new Date(), releasedById: actorId },
    include: PRODUCTION_ORDER_DETAIL_INCLUDE,
  });

  await resolvePendingApprovals('PRODUCTION_ORDER_RELEASE', id, 'APPROVED', actorId, null, client);

  return released;
}

export async function closeProductionOrder(
  id: string,
  actorId: string,
  closeNote: string | null,
): Promise<ProductionOrderDetailRow> {
  const order = await loadOrder(id, prisma);
  if (!canCloseProductionOrder(order.status)) {
    throw new ConflictError('Hanya SPK yang sedang berjalan yang bisa ditutup.');
  }

  const balance = await productionBalance(id);

  const lossPercent = lossPercentOf(balance.lossFineGram, balance.consumedFineGram);
  const tolerance = Number(order.lossTolerancePercent);

  if (isOverLossTolerance(lossPercent, tolerance) && !closeNote?.trim()) {
    throw new ValidationError(
      `Susut ${formatNumber(lossPercent, { decimalScale: 2 })}% melebihi toleransi ${formatNumber(tolerance, { decimalScale: 2 })}%. Tulis penjelasannya sebelum SPK ditutup.`,
    );
  }

  return prisma.productionOrder.update({
    where: { id },
    data: {
      status: 'CLOSED',
      closedAt: new Date(),
      closedById: actorId,
      closeNote: closeNote?.trim() ? closeNote.trim() : null,
    },
    include: PRODUCTION_ORDER_DETAIL_INCLUDE,
  });
}

export async function voidProductionOrder(
  id: string,
  actorId: string,
  reason: string,
): Promise<ProductionOrderDetailRow> {
  const order = await loadOrder(id, prisma);
  if (!canVoidProductionOrder(order.status)) {
    throw new ConflictError('SPK ini sudah ditutup atau sudah dibatalkan.');
  }

  return prisma.productionOrder.update({
    where: { id },
    data: { status: 'VOID', voidedAt: new Date(), voidedById: actorId, voidReason: reason },
    include: PRODUCTION_ORDER_DETAIL_INCLUDE,
  });
}

export async function productionMovements(_orderId: string) {
  return [];
}

export async function issueMaterial(
  _orderId: string,
  _input: unknown,
  _actorId: string,
) {
  return null;
}

export async function receiveOutput(
  _orderId: string,
  _input: unknown,
  _actorId: string,
) {
  return null;
}

export async function returnMaterial(
  _orderId: string,
  _input: unknown,
  _actorId: string,
) {
  return null;
}

