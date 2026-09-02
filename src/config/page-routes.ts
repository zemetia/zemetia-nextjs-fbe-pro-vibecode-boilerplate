export const PAGE_ROUTE_MAP: Record<string, string> = {
  'dashboard': '/admin',
  'purchase-request': '/admin/purchases/requests',
  'import-trading': '/admin/purchases/import',
  'local-trading': '/admin/purchases/local',
  'scrap-melting': '/admin/purchases/scrap',
  'goods-receipt': '/admin/purchases/goods-receipt',
  'warehouse-mgmt': '/admin/inventory',
  'silver-alloy': '/admin/inventory/silver-alloy',
  'jewelry-production': '/admin/production',
  'local-sales': '/admin/sales/local',
  'local-do': '/admin/sales/delivery-order',
  'local-invoicing': '/admin/sales/invoicing',
  'export-so': '/admin/sales/orders',
  'export-invoicing': '/admin/sales/export',
  'export-do': '/admin/sales/export-delivery-order',
  'accounting-journals': '/admin/accounting/journals',
  'journals': '/admin/accounting/journals',
  'voucher-mgmt': '/admin/finance/vouchers',
  'vouchers': '/admin/finance/vouchers',
  'master-cheques': '/admin/finance/cheques',
  'accounting-reports': '/admin/reports/accounting',
  'coa-setting': '/admin/accounts',
  'master-suppliers': '/admin/partners',
  'master-items': '/admin/supplies',
  'master-finished-goods': '/admin/inventory/models',
  'master-customers': '/admin/partners/customers',
  'system-settings': '/admin/system/settings',
};

export const getRouteForPageId = (pageId: string): string => {
  const target = PAGE_ROUTE_MAP[pageId];
  return typeof target === 'string' ? target : '/admin';
};
