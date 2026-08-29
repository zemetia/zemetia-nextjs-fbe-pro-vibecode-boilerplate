-- CreateEnum
CREATE TYPE "GoldPurchaseType" AS ENUM ('IMPORT', 'LOCAL', 'SCRAP');

-- CreateEnum
CREATE TYPE "GoldPurchaseStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'VOID');

-- CreateTable
CREATE TABLE "gold_purchases" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "type" "GoldPurchaseType" NOT NULL,
    "status" "GoldPurchaseStatus" NOT NULL DEFAULT 'DRAFT',
    "supplierId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "exchangeRate" DECIMAL(18,6) NOT NULL,
    "pricePerGram" DECIMAL(18,4) NOT NULL,
    "weightGram" DECIMAL(14,4) NOT NULL,
    "purityPercent" DECIMAL(7,4),
    "fineWeightGram" DECIMAL(14,4) NOT NULL,
    "importDutyIdr" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "freightInsuranceIdr" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "goodsAmount" DECIMAL(18,2) NOT NULL,
    "goodsAmountIdr" DECIMAL(18,2) NOT NULL,
    "totalIdr" DECIMAL(18,2) NOT NULL,
    "barSeries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gold_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gold_purchases_number_key" ON "gold_purchases"("number");

-- CreateIndex
CREATE INDEX "gold_purchases_type_idx" ON "gold_purchases"("type");

-- CreateIndex
CREATE INDEX "gold_purchases_status_idx" ON "gold_purchases"("status");

-- CreateIndex
CREATE INDEX "gold_purchases_date_idx" ON "gold_purchases"("date");

-- CreateIndex
CREATE INDEX "gold_purchases_supplierId_idx" ON "gold_purchases"("supplierId");

-- AddForeignKey
ALTER TABLE "gold_purchases" ADD CONSTRAINT "gold_purchases_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gold_purchases" ADD CONSTRAINT "gold_purchases_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gold_purchases" ADD CONSTRAINT "gold_purchases_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gold_purchases" ADD CONSTRAINT "gold_purchases_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gold_purchases" ADD CONSTRAINT "gold_purchases_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
