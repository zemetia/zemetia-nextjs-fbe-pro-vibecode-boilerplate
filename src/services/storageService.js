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

export const getFinishedGoods = () => {
  if (typeof window !== 'undefined' && window.Storage) {
    return window.Storage.get('pttan_master_finished_goods') || [
      { id: 'JWL-RNG-750-001', sku: 'JWL-RNG-750-001', name: 'Dubai Arabian Casting Ring', type: 'Cincin (Ring)', karat: '750', purity: 75.0, goldColor: 'Yellow Gold', stdWeightGram: 4.50, laborFeeIDRPerGram: 15000, hsCode: '7113.19.90', inventoryAccount: '1160' },
      { id: 'JWL-CHN-700-005', sku: 'JWL-CHN-700-005', name: 'Italian Hollow Rope Chain', type: 'Kalung (Necklace)', karat: '700', purity: 70.0, goldColor: 'Rose Gold', stdWeightGram: 12.00, laborFeeIDRPerGram: 18000, hsCode: '7113.19.90', inventoryAccount: '1160' },
      { id: 'JWL-BNG-375-010', sku: 'JWL-BNG-375-010', name: 'Stamped Diamond Cut Bangle', type: 'Gelang (Bangle)', karat: '375', purity: 37.5, goldColor: 'White Gold', stdWeightGram: 8.50, laborFeeIDRPerGram: 12000, hsCode: '7113.19.90', inventoryAccount: '1160' }
    ];
  }
  return [];
};

export const saveFinishedGood = async (fg) => {
  if (typeof window !== 'undefined' && window.Storage) {
    const list = getFinishedGoods();
    list.unshift(fg);
    return await window.Storage.set('pttan_master_finished_goods', list);
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
