import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import LmImportTrading from './pages/LmImportTrading';
import LmLocalTrading from './pages/LmLocalTrading';
import BuyingScrapMelting from './pages/BuyingScrapMelting';
import JewelryProduction from './pages/JewelryProduction';
import ExportInvoicing from './pages/ExportInvoicing';
import WarehouseManagement from './pages/WarehouseManagement';
import ChartOfAccounts from './pages/ChartOfAccounts';
import VoucherManagement from './pages/VoucherManagement';
import MasterItemPage from './pages/MasterItemPage';
import MasterCustomer from './pages/MasterCustomer';
import MasterSupplier from './pages/MasterSupplier';
import AccountingReports from './pages/AccountingReports';
import SystemSettingsPage from './pages/SystemSettingsPage';

export default function App() {
  const [activePage, setActivePage] = useState('dashboard');

  const getPageTitle = () => {
    switch (activePage) {
      case 'dashboard': return 'Executive Dashboard & Control Center';
      case 'import-trading': return 'Pembelian LM Import & Landed Costing';
      case 'local-trading': return 'Pembelian & Trading LM Lokal IDR';
      case 'scrap-melting': return 'Pembelian Pecahan Scrap & SPK Lebur';
      case 'jewelry-production': return 'Produksi Perhiasan & Alloy Karat Calculator';
      case 'export-invoicing': return 'Faktur Ekspor USD (PPN 0%)';
      case 'warehouse-mgmt': return 'Modul Gudang & Kartu Stok Brankas Vault';
      case 'voucher-mgmt': return 'Manajemen Voucher Kas & Bank (BKK / BKM / BBK / BBM)';
      case 'master-items': return 'Master Data Barang & Produk Emas';
      case 'master-customers': return 'Master Customer & Buyer Ekspor';
      case 'master-suppliers': return 'Master Supplier Emas (Impor & Lokal)';
      case 'accounting-reports': return 'Jurnal Mutasi & Laporan Keuangan SAK EMKM';
      case 'coa-setting': return 'Setting Chart of Accounts (COA SAK EMKM)';
      case 'system-settings': return 'Setting Logo Perusahaan, Backup & Restore Database System';
      default: return 'PT TAN Enterprise ERP';
    }
  };

  const renderContent = () => {
    switch (activePage) {
      case 'dashboard': return <Dashboard setActivePage={setActivePage} />;
      case 'import-trading': return <LmImportTrading />;
      case 'local-trading': return <LmLocalTrading />;
      case 'scrap-melting': return <BuyingScrapMelting />;
      case 'jewelry-production': return <JewelryProduction />;
      case 'export-invoicing': return <ExportInvoicing />;
      case 'warehouse-mgmt': return <WarehouseManagement />;
      case 'voucher-mgmt': return <VoucherManagement />;
      case 'master-items': return <MasterItemPage />;
      case 'master-customers': return <MasterCustomer />;
      case 'master-suppliers': return <MasterSupplier />;
      case 'accounting-reports': return <AccountingReports />;
      case 'coa-setting': return <ChartOfAccounts />;
      case 'system-settings': return <SystemSettingsPage />;
      default: return <Dashboard setActivePage={setActivePage} />;
    }
  };

  return (
    <div className="app-container">
      <Sidebar activePage={activePage} setActivePage={setActivePage} />
      <div className="main-content">
        <Navbar pageTitle={getPageTitle()} />
        {renderContent()}
      </div>
    </div>
  );
}
