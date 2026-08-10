import React, { useState, useEffect } from 'react';
import { Settings, Download, Upload, Image, Building2, ShieldCheck, Database, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function SystemSettingsPage() {
  const [profile, setProfile] = useState({
    companyName: 'PT TAN (Trifactor Export & Trading)',
    logoUrl: '',
    address: 'Kawasan Industri & Pergudangan Gold Center, Jakarta, Indonesia',
    phone: '+62-21-555-8899',
    email: 'info@pt-tan.co.id',
    npwp: '01.234.567.8-012.000',
    nibPeb: '1234567890123 (NIB Ekspor PPN 0%)',
    currencyDefault: 'USD'
  });

  const [restoreFile, setRestoreFile] = useState(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = () => {
    if (typeof window !== 'undefined' && window.Storage) {
      const saved = window.Storage.get('pttan_company_profile');
      if (saved) setProfile(saved);
    }
  };

  const handleSaveProfile = (e) => {
    e.preventDefault();
    if (typeof window !== 'undefined' && window.Storage) {
      window.Storage.set('pttan_company_profile', profile);
      alert('✅ Profil Perusahaan & Setting Logo PT TAN Berhasil Disimpan!');
    }
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfile({ ...profile, logoUrl: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  // Backup System JSON Export
  const handleBackupExport = () => {
    if (typeof window !== 'undefined' && window.Storage) {
      const backupData = {
        app: 'PT TAN ERP',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        chartOfAccounts: window.Storage.get(window.Storage.KEYS.CHART_OF_ACCOUNTS) || [],
        items: window.Storage.get(window.Storage.KEYS.ITEMS) || [],
        customers: window.Storage.get(window.Storage.KEYS.CUSTOMERS) || [],
        suppliers: window.Storage.get(window.Storage.KEYS.SUPPLIERS) || [],
        purchaseOrders: window.Storage.get('erp_purchase_orders') || [],
        paymentVouchers: window.Storage.get(window.Storage.KEYS.PAYMENT_VOUCHERS) || [],
        receiptVouchers: window.Storage.get(window.Storage.KEYS.RECEIPT_VOUCHERS) || [],
        journals: window.Storage.get(window.Storage.KEYS.JOURNAL_ENTRIES) || [],
        companyProfile: profile
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `BACKUP_PTTAN_ERP_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      alert('✅ File Backup Database Sistem PT TAN (.json) Berhasil Diunduh!');
    }
  };

  // Restore System JSON Import
  const handleRestoreImport = () => {
    if (!restoreFile) {
      alert('Pilih file backup (.json) terlebih dahulu.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.app || !data.app.includes('TAN')) {
          if (!confirm('Peringatan: Format file backup tidak dikenal sebagai PT TAN. Tetap lanjutkan restore?')) {
            return;
          }
        }

        if (typeof window !== 'undefined' && window.Storage) {
          if (data.chartOfAccounts) window.Storage.set(window.Storage.KEYS.CHART_OF_ACCOUNTS, data.chartOfAccounts);
          if (data.items) window.Storage.set(window.Storage.KEYS.ITEMS, data.items);
          if (data.customers) window.Storage.set(window.Storage.KEYS.CUSTOMERS, data.customers);
          if (data.suppliers) window.Storage.set(window.Storage.KEYS.SUPPLIERS, data.suppliers);
          if (data.purchaseOrders) window.Storage.set('erp_purchase_orders', data.purchaseOrders);
          if (data.paymentVouchers) window.Storage.set(window.Storage.KEYS.PAYMENT_VOUCHERS, data.paymentVouchers);
          if (data.receiptVouchers) window.Storage.set(window.Storage.KEYS.RECEIPT_VOUCHERS, data.receiptVouchers);
          if (data.journals) window.Storage.set(window.Storage.KEYS.JOURNAL_ENTRIES, data.journals);
          if (data.companyProfile) {
            setProfile(data.companyProfile);
            window.Storage.set('pttan_company_profile', data.companyProfile);
          }

          alert('🎉 Restore Data System PT TAN Berhasil Dilakukan! Halaman akan diperbarui.');
          window.location.reload();
        }
      } catch (err) {
        alert('❌ Gagal merestore data: File JSON rusak atau tidak valid.');
      }
    };
    reader.readAsText(restoreFile);
  };

  return (
    <div>
      {/* Header */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Settings color="#f59e0b" size={24} /> Setting Perusahaan, Logo, Backup & Restore System
        </h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          Manajemen Branding PT TAN, Header Cetakan Kop Surat/Invoice, Backup File JSON, & Safeguard Restore Data
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        {/* Company Profile & Logo Setting */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px', color: '#fbbf24' }}>
            <Building2 size={20} /> Setting Profil & Logo Perusahaan (Kop Dokumen)
          </h3>

          <form onSubmit={handleSaveProfile}>
            <div style={{ marginBottom: '16px', textAlign: 'center', background: 'rgba(15,23,42,0.6)', padding: '16px', borderRadius: '12px', border: '1px dashed var(--border-color)' }}>
              {profile.logoUrl ? (
                <img src={profile.logoUrl} alt="Logo PT TAN" style={{ maxHeight: '80px', marginBottom: '10px' }} />
              ) : (
                <div style={{ padding: '20px', color: 'var(--text-muted)' }}>Belum ada logo terpasang</div>
              )}
              <div>
                <label htmlFor="logo-input" className="btn-primary" style={{ padding: '6px 14px', fontSize: '0.75rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Image size={14} /> Unggah Logo PT TAN Baru
                </label>
                <input id="logo-input" type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label className="form-label">Nama Perusahaan Resmi</label>
              <input className="form-input" value={profile.companyName} onChange={e => setProfile({ ...profile, companyName: e.target.value })} />
            </div>
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label className="form-label">Alamat Kantor & Pabrik</label>
              <input className="form-input" value={profile.address} onChange={e => setProfile({ ...profile, address: e.target.value })} />
            </div>
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label className="form-label">Telepon / Fax</label>
              <input className="form-input" value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} />
            </div>
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label className="form-label">NPWP Perusahaan</label>
              <input className="form-input" value={profile.npwp} onChange={e => setProfile({ ...profile, npwp: e.target.value })} />
            </div>
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label">NIB & Registrasi Ekspor Bea Cukai</label>
              <input className="form-input" value={profile.nibPeb} onChange={e => setProfile({ ...profile, nibPeb: e.target.value })} />
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%' }}>
              <CheckCircle2 size={16} /> Simpan Setting Profil & Logo
            </button>
          </form>
        </div>

        {/* Backup & Restore Data Management */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px', color: '#38bdf8' }}>
            <Database size={20} /> Backup & Restore Database Sistem
          </h3>

          {/* Backup Section */}
          <div style={{ background: 'rgba(15,23,42,0.6)', padding: '20px', borderRadius: '12px', marginBottom: '20px', border: '1px solid rgba(56,189,248,0.2)' }}>
            <h4 style={{ color: '#38bdf8', fontSize: '0.95rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Download size={16} /> Export Backup Data (.json)
            </h4>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Unduh seluruh database sistem (COA, PO Impor/Lokal, Faktur Ekspor, Voucher, Kartu Stok Vault, & Master Data) ke file backup `.json`.
            </p>
            <button className="btn-primary" style={{ width: '100%', background: 'linear-gradient(135deg, #0284c7, #0369a1)' }} onClick={handleBackupExport}>
              <Download size={16} /> Unduh Backup Database JSON
            </button>
          </div>

          {/* Restore Section */}
          <div style={{ background: 'rgba(15,23,42,0.6)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(245,158,11,0.2)' }}>
            <h4 style={{ color: '#fbbf24', fontSize: '0.95rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Upload size={16} /> Import Restore Data (.json)
            </h4>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Pulihkan database sistem dari file cadangan `.json` sebelumnya.
            </p>
            
            <input
              type="file"
              accept=".json"
              onChange={e => setRestoreFile(e.target.files[0])}
              style={{ width: '100%', marginBottom: '12px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}
            />

            <button className="btn-primary" style={{ width: '100%', background: 'linear-gradient(135deg, #d97706, #b45309)' }} onClick={handleRestoreImport}>
              <Upload size={16} /> Restore Data System Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
