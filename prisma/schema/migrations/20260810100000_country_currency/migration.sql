-- CreateEnum
CREATE TYPE "ContinentRegion" AS ENUM ('AFRICA', 'AMERICAS', 'ASIA', 'EUROPE', 'OCEANIA', 'ANTARCTICA');

-- CreateTable
CREATE TABLE "currencies" (
    "code" TEXT NOT NULL,
    "numericCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "decimalDigits" INTEGER NOT NULL DEFAULT 2,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "countries" (
    "id" TEXT NOT NULL,
    "iso2" TEXT NOT NULL,
    "iso3" TEXT NOT NULL,
    "numericCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "dialCode" TEXT NOT NULL,
    "region" "ContinentRegion" NOT NULL,
    "currencyCode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "currencies_numericCode_key" ON "currencies"("numericCode");

-- CreateIndex
CREATE UNIQUE INDEX "countries_iso2_key" ON "countries"("iso2");

-- CreateIndex
CREATE UNIQUE INDEX "countries_iso3_key" ON "countries"("iso3");

-- CreateIndex
CREATE UNIQUE INDEX "countries_numericCode_key" ON "countries"("numericCode");

-- CreateIndex
CREATE INDEX "countries_region_idx" ON "countries"("region");

-- CreateIndex
CREATE INDEX "countries_name_idx" ON "countries"("name");

-- AddForeignKey
ALTER TABLE "countries" ADD CONSTRAINT "countries_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
