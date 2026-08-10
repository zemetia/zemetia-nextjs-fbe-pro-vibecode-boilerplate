// Storage Service Layer wrapping backend handlers in data/storage.js & modules/purchaseOrder.js

export const getCOA = () => {
  if (typeof window !== 'undefined' && window.Storage) {
    return window.Storage.get(window.Storage.KEYS.CHART_OF_ACCOUNTS) || window.Storage.getDefaultChartOfAccounts();
  }
  return [];
};

export const saveCOA = async (accounts) => {
  if (typeof window !== 'undefined' && window.Storage) {
    return await window.Storage.set(window.Storage.KEYS.CHART_OF_ACCOUNTS, accounts);
  }
  return false;
};

export const addCOAAccount = async (newAccount) => {
  const accounts = getCOA();
  if (accounts.some(a => a.code === newAccount.code)) {
    return { success: false, error: 'Kode akun sudah digunakan' };
  }
  accounts.push(newAccount);
  accounts.sort((a, b) => a.code.localeCompare(b.code));
  await saveCOA(accounts);
  return { success: true };
};

export const getMasterItems = () => {
  if (typeof window !== 'undefined' && window.Storage) {
    return window.Storage.getItems() || [];
  }
  return [];
};

export const saveMasterItem = async (item) => {
  if (typeof window !== 'undefined' && window.Storage) {
    const items = getMasterItems();
    items.unshift(item);
    return await window.Storage.set(window.Storage.KEYS.ITEMS, items);
  }
  return false;
};

export const getCustomers = () => {
  if (typeof window !== 'undefined' && window.Storage) {
    return window.Storage.get(window.Storage.KEYS.CUSTOMERS) || [];
  }
  return [];
};

export const saveCustomer = async (cust) => {
  if (typeof window !== 'undefined' && window.Storage) {
    const customers = getCustomers();
    customers.unshift(cust);
    return await window.Storage.set(window.Storage.KEYS.CUSTOMERS, customers);
  }
  return false;
};

export const getSuppliers = () => {
  if (typeof window !== 'undefined' && window.Storage) {
    return window.Storage.get(window.Storage.KEYS.SUPPLIERS) || [];
  }
  return [];
};

export const saveSupplier = async (supp) => {
  if (typeof window !== 'undefined' && window.Storage) {
    const suppliers = getSuppliers();
    suppliers.unshift(supp);
    return await window.Storage.set(window.Storage.KEYS.SUPPLIERS, suppliers);
  }
  return false;
};

export const getPurchaseOrders = () => {
  if (typeof window !== 'undefined' && window.PurchaseOrder) {
    return window.PurchaseOrder.getStoredOrders() || [];
  }
  return [];
};

export const createPurchaseOrder = async (orderData) => {
  if (typeof window !== 'undefined' && window.PurchaseOrder) {
    return await window.PurchaseOrder.createOrder(orderData);
  }
  return { success: false, errors: { system: 'PurchaseOrder module not ready' } };
};
