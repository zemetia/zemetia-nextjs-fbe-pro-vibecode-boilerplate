-- CreateEnum
CREATE TYPE "VoucherFund" AS ENUM ('CASH', 'BANK', 'MEMORIAL');

-- CreateEnum
CREATE TYPE "VoucherDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "VoucherStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'POSTED', 'VOID');

-- CreateEnum
CREATE TYPE "VoucherCategory" AS ENUM ('GENERAL_EXPENSE', 'EMPLOYEE', 'SUPPLIER');

-- CreateEnum
CREATE TYPE "VoucherPaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'CHEQUE', 'GIRO', 'CARD', 'VIRTUAL_ACCOUNT', 'LETTER_OF_CREDIT', 'ESCROW', 'GOLD', 'NETTING');

-- CreateEnum
CREATE TYPE "VoucherTransferChannel" AS ENUM ('BI_FAST', 'SKN', 'RTGS');

-- CreateTable
CREATE TABLE "cash_vouchers" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "VoucherStatus" NOT NULL DEFAULT 'DRAFT',
    "fund" "VoucherFund" NOT NULL,
    "direction" "VoucherDirection" NOT NULL,
    "date" DATE NOT NULL,
    "category" "VoucherCategory" NOT NULL,
    "counterpartyName" TEXT NOT NULL,
    "partnerId" TEXT,
    "purpose" TEXT NOT NULL,
    "contraAccountId" TEXT NOT NULL,
    "paymentMethod" "VoucherPaymentMethod" NOT NULL,
    "transferChannel" "VoucherTransferChannel",
    "bankName" TEXT,
    "bankAccountNo" TEXT,
    "referenceNumber" TEXT,
    "dueDate" DATE,
    "autoPostOnApproval" BOOLEAN NOT NULL DEFAULT true,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "postedById" TEXT,
    "postedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_voucher_lines" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "accountId" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "cash_voucher_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cash_vouchers_number_key" ON "cash_vouchers"("number");

-- CreateIndex
CREATE INDEX "cash_vouchers_status_idx" ON "cash_vouchers"("status");

-- CreateIndex
CREATE INDEX "cash_vouchers_date_idx" ON "cash_vouchers"("date");

-- CreateIndex
CREATE INDEX "cash_vouchers_fund_direction_idx" ON "cash_vouchers"("fund", "direction");

-- CreateIndex
CREATE INDEX "cash_vouchers_category_idx" ON "cash_vouchers"("category");

-- CreateIndex
CREATE INDEX "cash_vouchers_paymentMethod_idx" ON "cash_vouchers"("paymentMethod");

-- CreateIndex
CREATE INDEX "cash_vouchers_partnerId_idx" ON "cash_vouchers"("partnerId");

-- CreateIndex
CREATE INDEX "cash_vouchers_contraAccountId_idx" ON "cash_vouchers"("contraAccountId");

-- CreateIndex
CREATE INDEX "cash_vouchers_dueDate_idx" ON "cash_vouchers"("dueDate");

-- CreateIndex
CREATE INDEX "cash_voucher_lines_accountId_idx" ON "cash_voucher_lines"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "cash_voucher_lines_voucherId_lineNo_key" ON "cash_voucher_lines"("voucherId", "lineNo");

-- AddForeignKey
ALTER TABLE "cash_vouchers" ADD CONSTRAINT "cash_vouchers_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_vouchers" ADD CONSTRAINT "cash_vouchers_contraAccountId_fkey" FOREIGN KEY ("contraAccountId") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_vouchers" ADD CONSTRAINT "cash_vouchers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_vouchers" ADD CONSTRAINT "cash_vouchers_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_vouchers" ADD CONSTRAINT "cash_vouchers_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_vouchers" ADD CONSTRAINT "cash_vouchers_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_voucher_lines" ADD CONSTRAINT "cash_voucher_lines_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "cash_vouchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_voucher_lines" ADD CONSTRAINT "cash_voucher_lines_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

