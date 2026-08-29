-- AlterEnum
-- Postgres cannot drop a value from an enum in place, so the type is rebuilt.
-- `PRODUCTION` splits into three: any existing row was a finished conversion, so
-- it maps to PRODUCTION_RECEIPT.
CREATE TYPE "GoldMovementType_new" AS ENUM ('RECEIPT', 'SORT', 'TRANSFER', 'SEAL', 'REFINE_OUT', 'REFINE_IN', 'PRODUCTION_ISSUE', 'PRODUCTION_RECEIPT', 'PRODUCTION_RETURN', 'ISSUE', 'ADJUSTMENT');
ALTER TABLE "gold_movements" ALTER COLUMN "type" TYPE "GoldMovementType_new" USING (
  CASE "type"::text WHEN 'PRODUCTION' THEN 'PRODUCTION_RECEIPT' ELSE "type"::text END
)::"GoldMovementType_new";
DROP TYPE "GoldMovementType";
ALTER TYPE "GoldMovementType_new" RENAME TO "GoldMovementType";

-- CreateEnum
CREATE TYPE "ProductionOrderStatus" AS ENUM ('DRAFT', 'RELEASED', 'CLOSED', 'VOID');

-- AlterTable
ALTER TABLE "gold_lots" ADD COLUMN     "sourceProductionOrderId" TEXT,
ADD COLUMN     "stoneWeightGram" DECIMAL(14,4);

-- CreateTable
CREATE TABLE "production_orders" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "ProductionOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "date" DATE NOT NULL,
    "targetDate" DATE,
    "jewelryModelId" TEXT NOT NULL,
    "karat" INTEGER NOT NULL,
    "purityPercent" DECIMAL(7,4) NOT NULL,
    "targetGrossWeightGram" DECIMAL(14,4) NOT NULL,
    "targetPieceCount" INTEGER,
    "locationId" TEXT NOT NULL,
    "lossTolerancePercent" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "closeNote" TEXT,
    "createdById" TEXT NOT NULL,
    "releasedById" TEXT,
    "releasedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "closedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "production_orders_number_key" ON "production_orders"("number");

-- CreateIndex
CREATE INDEX "production_orders_status_idx" ON "production_orders"("status");

-- CreateIndex
CREATE INDEX "production_orders_date_idx" ON "production_orders"("date");

-- CreateIndex
CREATE INDEX "production_orders_jewelryModelId_idx" ON "production_orders"("jewelryModelId");

-- CreateIndex
CREATE INDEX "production_orders_locationId_idx" ON "production_orders"("locationId");

-- CreateIndex
CREATE INDEX "gold_lots_sourceProductionOrderId_idx" ON "gold_lots"("sourceProductionOrderId");

-- AddForeignKey
ALTER TABLE "gold_lots" ADD CONSTRAINT "gold_lots_sourceProductionOrderId_fkey" FOREIGN KEY ("sourceProductionOrderId") REFERENCES "production_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_jewelryModelId_fkey" FOREIGN KEY ("jewelryModelId") REFERENCES "jewelry_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "storage_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_releasedById_fkey" FOREIGN KEY ("releasedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
