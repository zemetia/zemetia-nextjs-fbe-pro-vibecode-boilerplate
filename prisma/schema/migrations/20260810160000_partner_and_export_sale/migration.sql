-- Supplier → Partner (Mitra), renamed in place: every row, foreign key and
-- gold-purchase reference survives. A partner now carries two independent axes —
-- legal form (`type`) and role (`isSupplier`/`isCustomer`) — because the same
-- entity trades in both directions (a local jeweller sells scrap in and buys
-- finished pieces out). Adds the export sales document on top.

-- ---------------------------------------------------------------- enums

ALTER TYPE "SupplierPaymentMethod" RENAME TO "PartnerPaymentMethod";

CREATE TYPE "PartnerType" AS ENUM ('COMPANY', 'INDIVIDUAL');
CREATE TYPE "CustomerCategory" AS ENUM ('EXPORT_BUYER', 'DOMESTIC_WHOLESALE', 'DOMESTIC_RETAIL');
CREATE TYPE "ExportSaleStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'VOID');

-- ------------------------------------------------------- table + names

ALTER TABLE "suppliers" RENAME TO "partners";

ALTER TABLE "partners" RENAME CONSTRAINT "suppliers_pkey" TO "partners_pkey";
ALTER TABLE "partners" RENAME CONSTRAINT "suppliers_countryId_fkey" TO "partners_countryId_fkey";
ALTER TABLE "partners" RENAME CONSTRAINT "suppliers_currencyCode_fkey" TO "partners_currencyCode_fkey";

ALTER INDEX "suppliers_code_key" RENAME TO "partners_code_key";
ALTER INDEX "suppliers_category_idx" RENAME TO "partners_supplierCategory_idx";
ALTER INDEX "suppliers_name_idx" RENAME TO "partners_name_idx";
ALTER INDEX "suppliers_isActive_idx" RENAME TO "partners_isActive_idx";

-- ------------------------------------------------------------- axes

ALTER TABLE "partners" RENAME COLUMN "category" TO "supplierCategory";
ALTER TABLE "partners" ALTER COLUMN "supplierCategory" DROP NOT NULL;

ALTER TABLE "partners"
  ADD COLUMN "legalName" TEXT,
  ADD COLUMN "type" "PartnerType" NOT NULL DEFAULT 'COMPANY',
  ADD COLUMN "isSupplier" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isCustomer" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "customerCategory" "CustomerCategory";

-- Everything registered before this migration was registered as a gold supplier.
UPDATE "partners" SET "isSupplier" = true;

-- ------------------------------------------------- terms, split by direction

ALTER TABLE "partners" RENAME COLUMN "paymentTermDays" TO "purchaseTermDays";
ALTER TABLE "partners" RENAME COLUMN "paymentMethod" TO "purchasePaymentMethod";

ALTER TABLE "partners"
  ADD COLUMN "salesTermDays" INTEGER,
  ADD COLUMN "salesPaymentMethod" "PartnerPaymentMethod";

-- `SUPP-0001` → `MTR-0001`. One prefix only, deliberately: the code generator
-- picks the highest code by length then value, so a mixed prefix would rank
-- `SUPP-…` above every new `MTR-…` forever and freeze the sequence.
UPDATE "partners" SET "code" = 'MTR-' || substring("code" from 6) WHERE "code" LIKE 'SUPP-%';

-- A partner with neither role is not a partner. Zod decides *which* category is
-- then required; this is the floor underneath it.
ALTER TABLE "partners" ADD CONSTRAINT "partners_role_check" CHECK ("isSupplier" OR "isCustomer");

CREATE INDEX "partners_type_idx" ON "partners"("type");
CREATE INDEX "partners_isSupplier_idx" ON "partners"("isSupplier");
CREATE INDEX "partners_isCustomer_idx" ON "partners"("isCustomer");
CREATE INDEX "partners_customerCategory_idx" ON "partners"("customerCategory");

-- ---------------------------------------------- gold purchases follow suit

ALTER TABLE "gold_purchases" RENAME COLUMN "supplierId" TO "partnerId";
ALTER TABLE "gold_purchases" RENAME CONSTRAINT "gold_purchases_supplierId_fkey" TO "gold_purchases_partnerId_fkey";
ALTER INDEX "gold_purchases_supplierId_idx" RENAME TO "gold_purchases_partnerId_idx";

-- ------------------------------------------------------------ export sales

CREATE TABLE "export_sales" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "ExportSaleStatus" NOT NULL DEFAULT 'DRAFT',
    "partnerId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "pebNumber" TEXT,
    "awbNumber" TEXT,
    "currencyCode" TEXT NOT NULL,
    "exchangeRate" DECIMAL(18,6) NOT NULL,
    "weightGram" DECIMAL(14,4) NOT NULL,
    "pricePerGram" DECIMAL(18,4) NOT NULL,
    "goodsAmount" DECIMAL(18,2) NOT NULL,
    "goodsAmountIdr" DECIMAL(18,2) NOT NULL,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "export_sales_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "export_sales_number_key" ON "export_sales"("number");
CREATE INDEX "export_sales_status_idx" ON "export_sales"("status");
CREATE INDEX "export_sales_date_idx" ON "export_sales"("date");
CREATE INDEX "export_sales_partnerId_idx" ON "export_sales"("partnerId");

ALTER TABLE "export_sales" ADD CONSTRAINT "export_sales_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "export_sales" ADD CONSTRAINT "export_sales_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "export_sales" ADD CONSTRAINT "export_sales_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "export_sales" ADD CONSTRAINT "export_sales_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "export_sales" ADD CONSTRAINT "export_sales_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
