// PDF Service Layer
// Clean ES module abstraction for PDF generation and document exports

const getExporter = () => {
  if (typeof window !== 'undefined' && window.PDFExporter) {
    return window.PDFExporter;
  }
  return null;
};

/**
 * Export Purchase Order (Impor / Lokal) to PDF
 */
export const exportPurchaseOrderPdf = async (order, config) => {
  const exporter = getExporter();
  if (exporter && typeof exporter.exportPurchaseOrder === 'function') {
    return await exporter.exportPurchaseOrder(order, config);
  }
  console.warn('PDFExporter.exportPurchaseOrder not available');
  return false;
};

/**
 * Alias for PO PDF export
 */
export const exportPOPdf = exportPurchaseOrderPdf;

/**
 * Export Surat Kuasa Kurir (Courier Authorization) to PDF
 */
export const exportCourierAuthorizationPdf = async (purchase, config) => {
  const exporter = getExporter();
  if (exporter && typeof exporter.exportCourierAuthorization === 'function') {
    return await exporter.exportCourierAuthorization(purchase, config);
  }
  console.warn('PDFExporter.exportCourierAuthorization not available');
  return false;
};

/**
 * Export TTB (Tanda Terima Barang / Goods Receipt) to PDF
 */
export const exportTTBPdf = async (receipt, config) => {
  const exporter = getExporter();
  if (exporter && typeof exporter.exportTTB === 'function') {
    return await exporter.exportTTB(receipt, config);
  }
  console.warn('PDFExporter.exportTTB not available');
  return false;
};

/**
 * Export Payment Voucher (Bukti Bank Keluar - BBK) to PDF
 */
export const exportPaymentVoucherPdf = async (voucher, config) => {
  const exporter = getExporter();
  if (exporter && typeof exporter.exportPaymentVoucher === 'function') {
    return await exporter.exportPaymentVoucher(voucher, config);
  }
  console.warn('PDFExporter.exportPaymentVoucher not available');
  return false;
};

/**
 * Export Receipt Voucher (Bukti Bank Masuk - BBM) to PDF
 */
export const exportReceiptVoucherPdf = async (voucher, config) => {
  const exporter = getExporter();
  if (exporter && typeof exporter.exportReceiptVoucher === 'function') {
    return await exporter.exportReceiptVoucher(voucher, config);
  }
  console.warn('PDFExporter.exportReceiptVoucher not available');
  return false;
};

/**
 * Export Scrap Purchase Receipt to PDF
 */
export const exportScrapPurchaseReceiptPdf = async (purchase, config) => {
  const exporter = getExporter();
  if (exporter && typeof exporter.exportScrapPurchaseReceipt === 'function') {
    return await exporter.exportScrapPurchaseReceipt(purchase, config);
  }
  console.warn('PDFExporter.exportScrapPurchaseReceipt not available');
  return false;
};

/**
 * Export Purchase Requisition / Request (PR) to PDF
 */
export const exportPurchaseRequisitionPdf = async (pr, config) => {
  const exporter = getExporter();
  if (exporter && typeof exporter.exportPurchaseRequisition === 'function') {
    return await exporter.exportPurchaseRequisition(pr, config);
  }
  console.warn('PDFExporter.exportPurchaseRequisition not available');
  return false;
};

/**
 * Alias for PR PDF export
 */
export const exportPurchaseRequestPdf = exportPurchaseRequisitionPdf;

/**
 * Export Export Sales Order to PDF
 */
export const exportSalesOrderPdf = async (salesOrder, config) => {
  const exporter = getExporter();
  if (exporter && typeof exporter.exportSalesOrder === 'function') {
    return await exporter.exportSalesOrder(salesOrder, config);
  }
  console.warn('PDFExporter.exportSalesOrder not available');
  return false;
};

/**
 * Export SPK Produksi Perhiasan to PDF
 */
export const exportProductionSPKPdf = async (spk, config) => {
  const exporter = getExporter();
  if (exporter && typeof exporter.exportProductionSPK === 'function') {
    return await exporter.exportProductionSPK(spk, config);
  }
  if (exporter && typeof exporter.exportJobOrder === 'function') {
    return await exporter.exportJobOrder(spk, config);
  }
  console.warn('PDFExporter.exportProductionSPK not available');
  return false;
};

/**
 * Alias for SPK PDF export
 */
export const exportSPKPdf = exportProductionSPKPdf;

/**
 * Export Job Order / Production SPK to PDF
 */
export const exportJobOrderPdf = async (jo, config) => {
  const exporter = getExporter();
  if (exporter && typeof exporter.exportProductionSPK === 'function') {
    return await exporter.exportProductionSPK(jo, config);
  }
  if (exporter && typeof exporter.exportJobOrder === 'function') {
    return await exporter.exportJobOrder(jo, config);
  }
  console.warn('PDFExporter.exportJobOrder not available');
  return false;
};

/**
 * Export General Ledger to PDF
 */
export const exportGeneralLedgerPdf = async (accountCode, dateFrom, dateTo, config) => {
  const exporter = getExporter();
  if (exporter && typeof exporter.exportGeneralLedger === 'function') {
    return await exporter.exportGeneralLedger(accountCode, dateFrom, dateTo, config);
  }
  console.warn('PDFExporter.exportGeneralLedger not available');
  return false;
};

/**
 * Export Journal Entries to PDF
 */
export const exportJournalEntriesPdf = async (entries, dateFrom, dateTo, config) => {
  const exporter = getExporter();
  if (exporter && typeof exporter.exportJournalEntries === 'function') {
    return await exporter.exportJournalEntries(entries, dateFrom, dateTo, config);
  }
  console.warn('PDFExporter.exportJournalEntries not available');
  return false;
};

/**
 * Export Income Statement to PDF
 */
export const exportIncomeStatementPdf = async (data, period, config) => {
  const exporter = getExporter();
  if (exporter && typeof exporter.exportIncomeStatement === 'function') {
    return await exporter.exportIncomeStatement(data, period, config);
  }
  console.warn('PDFExporter.exportIncomeStatement not available');
  return false;
};

/**
 * Export Balance Sheet to PDF
 */
export const exportBalanceSheetPdf = async (data, asOfDate, config) => {
  const exporter = getExporter();
  if (exporter && typeof exporter.exportBalanceSheet === 'function') {
    return await exporter.exportBalanceSheet(data, asOfDate, config);
  }
  console.warn('PDFExporter.exportBalanceSheet not available');
  return false;
};

/**
 * Export Cash Flow to PDF
 */
export const exportCashFlowPdf = async (data, period, config) => {
  const exporter = getExporter();
  if (exporter && typeof exporter.exportCashFlow === 'function') {
    return await exporter.exportCashFlow(data, period, config);
  }
  console.warn('PDFExporter.exportCashFlow not available');
  return false;
};

/**
 * Export Commercial Export Invoice to PDF (PPN 0%)
 */
export const exportCommercialInvoicePdf = async (invoice, config) => {
  const exporter = getExporter();
  if (exporter && typeof exporter.exportCommercialInvoice === 'function') {
    return await exporter.exportCommercialInvoice(invoice, config);
  }
  console.warn('PDFExporter.exportCommercialInvoice not available');
  return false;
};

/**
 * Alias for Commercial Invoice PDF export
 */
export const exportInvoicePdf = exportCommercialInvoicePdf;

/**
 * Export Surat Jalan Ekspor & Packing List (Delivery Order) to PDF
 */
export const exportExportDeliveryOrderPdf = async (deliveryOrder, config) => {
  const exporter = getExporter();
  if (exporter && typeof exporter.exportExportDeliveryOrder === 'function') {
    return await exporter.exportExportDeliveryOrder(deliveryOrder, config);
  }
  console.warn('PDFExporter.exportExportDeliveryOrder not available');
  return false;
};

/**
 * Alias for Export Delivery Order PDF export
 */
export const exportDeliveryOrderPdf = exportExportDeliveryOrderPdf;

/**
 * Export Faktur Penjualan Emas Lokal IDR to PDF
 */
export const exportLocalSalesInvoicePdf = async (sale, config) => {
  const exporter = getExporter();
  if (exporter && typeof exporter.exportLocalSalesInvoice === 'function') {
    return await exporter.exportLocalSalesInvoice(sale, config);
  }
  console.warn('PDFExporter.exportLocalSalesInvoice not available');
  return false;
};

/**
 * Export Surat Jalan & Serah Terima Emas Lokal to PDF
 */
export const exportLocalDeliveryOrderPdf = async (sale, config) => {
  const exporter = getExporter();
  if (exporter && typeof exporter.exportLocalDeliveryOrder === 'function') {
    return await exporter.exportLocalDeliveryOrder(sale, config);
  }
  console.warn('PDFExporter.exportLocalDeliveryOrder not available');
  return false;
};

