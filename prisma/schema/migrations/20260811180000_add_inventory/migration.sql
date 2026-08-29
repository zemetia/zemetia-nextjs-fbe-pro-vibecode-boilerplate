-- CreateEnum
CREATE TYPE "StorageLocationType" AS ENUM ('VAULT', 'SORTING', 'PRODUCTION', 'STORE', 'REFINERY', 'TRANSIT');

-- CreateEnum
CREATE TYPE "GoldLotForm" AS ENUM ('BAR', 'JEWELRY', 'SCRAP', 'BAL');

-- CreateEnum
CREATE TYPE "BalStage" AS ENUM ('OPEN', 'SEALED');

-- CreateEnum
CREATE TYPE "GoldMovementType" AS ENUM ('RECEIPT', 'SORT', 'TRANSFER', 'SEAL', 'REFINE_OUT', 'REFINE_IN', 'PRODUCTION', 'ISSUE', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "GoldMovementStatus" AS ENUM ('DRAFT', 'POSTED', 'VOID');

-- CreateEnum
CREATE TYPE "GoldMovementDirection" AS ENUM ('IN', 'OUT');

-- CreateTable
CREATE TABLE "storage_locations" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "StorageLocationType" NOT NULL,
    "partnerId" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storage_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jewelry_models" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "defaultKarat" INTEGER,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jewelry_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gold_lots" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "form" "GoldLotForm" NOT NULL,
    "serialNumber" TEXT,
    "certificateNumber" TEXT,
    "refinerName" TEXT,
    "jewelryModelId" TEXT,
    "karat" INTEGER,
    "pieceCount" INTEGER,
    "balStage" "BalStage",
    "assayedPurityPercent" DECIMAL(7,4),
    "purityPercent" DECIMAL(7,4) NOT NULL,
    "grossWeightGram" DECIMAL(14,4) NOT NULL,
    "fineWeightGram" DECIMAL(14,4) NOT NULL,
    "sourcePurchaseId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "gold_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gold_movements" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "type" "GoldMovementType" NOT NULL,
    "status" "GoldMovementStatus" NOT NULL DEFAULT 'DRAFT',
    "date" DATE NOT NULL,
    "lossFineGram" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "alloyGram" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "partnerId" TEXT,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "reason" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "postedById" TEXT,
    "postedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gold_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gold_movement_lines" (
    "id" TEXT NOT NULL,
    "movementId" TEXT NOT NULL,
    "direction" "GoldMovementDirection" NOT NULL,
    "lotId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "pieceCount" INTEGER NOT NULL DEFAULT 0,
    "grossWeightGram" DECIMAL(14,4) NOT NULL,
    "purityPercent" DECIMAL(7,4) NOT NULL,
    "fineWeightGram" DECIMAL(14,4) NOT NULL,
    "note" TEXT,

    CONSTRAINT "gold_movement_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "storage_locations_code_key" ON "storage_locations"("code");

-- CreateIndex
CREATE INDEX "storage_locations_type_idx" ON "storage_locations"("type");

-- CreateIndex
CREATE INDEX "storage_locations_isActive_idx" ON "storage_locations"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "jewelry_models_code_key" ON "jewelry_models"("code");

-- CreateIndex
CREATE INDEX "jewelry_models_category_idx" ON "jewelry_models"("category");

-- CreateIndex
CREATE INDEX "jewelry_models_isActive_idx" ON "jewelry_models"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "gold_lots_code_key" ON "gold_lots"("code");

-- CreateIndex
CREATE UNIQUE INDEX "gold_lots_serialNumber_key" ON "gold_lots"("serialNumber");

-- CreateIndex
CREATE INDEX "gold_lots_form_idx" ON "gold_lots"("form");

-- CreateIndex
CREATE INDEX "gold_lots_jewelryModelId_idx" ON "gold_lots"("jewelryModelId");

-- CreateIndex
CREATE INDEX "gold_lots_sourcePurchaseId_idx" ON "gold_lots"("sourcePurchaseId");

-- CreateIndex
CREATE INDEX "gold_lots_balStage_idx" ON "gold_lots"("balStage");

-- CreateIndex
CREATE UNIQUE INDEX "gold_movements_number_key" ON "gold_movements"("number");

-- CreateIndex
CREATE INDEX "gold_movements_type_idx" ON "gold_movements"("type");

-- CreateIndex
CREATE INDEX "gold_movements_status_idx" ON "gold_movements"("status");

-- CreateIndex
CREATE INDEX "gold_movements_date_idx" ON "gold_movements"("date");

-- CreateIndex
CREATE INDEX "gold_movements_referenceType_referenceId_idx" ON "gold_movements"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "gold_movement_lines_movementId_idx" ON "gold_movement_lines"("movementId");

-- CreateIndex
CREATE INDEX "gold_movement_lines_lotId_idx" ON "gold_movement_lines"("lotId");

-- CreateIndex
CREATE INDEX "gold_movement_lines_locationId_idx" ON "gold_movement_lines"("locationId");

-- AddForeignKey
ALTER TABLE "storage_locations" ADD CONSTRAINT "storage_locations_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gold_lots" ADD CONSTRAINT "gold_lots_jewelryModelId_fkey" FOREIGN KEY ("jewelryModelId") REFERENCES "jewelry_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gold_lots" ADD CONSTRAINT "gold_lots_sourcePurchaseId_fkey" FOREIGN KEY ("sourcePurchaseId") REFERENCES "gold_purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gold_lots" ADD CONSTRAINT "gold_lots_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gold_movements" ADD CONSTRAINT "gold_movements_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gold_movements" ADD CONSTRAINT "gold_movements_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gold_movements" ADD CONSTRAINT "gold_movements_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gold_movements" ADD CONSTRAINT "gold_movements_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gold_movement_lines" ADD CONSTRAINT "gold_movement_lines_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "gold_movements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gold_movement_lines" ADD CONSTRAINT "gold_movement_lines_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "gold_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gold_movement_lines" ADD CONSTRAINT "gold_movement_lines_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "storage_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
