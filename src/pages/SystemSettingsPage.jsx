import React, { useState, useEffect } from 'react';
import { Settings, Download, Upload, Image, Building2, ShieldCheck, Database, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  getCompanyProfile,
  saveCompanyProfile,
  getAllSystemData,
  restoreSystemData
} from '../services/storageService';
import Modal, { useModal } from '../components/ui/Modal';

export default function SystemSettingsPage() {
  const { modalProps, showModal } = useModal();
  const [profile, setProfile] = useState({
    companyName: 'PT. Triliun Anugrah Nusantara (PT TAN)',
    logoUrl: '/logo/logo-tan.png',
    address: 'Sentra Niaga Puri Indah Blok T2 No. 12, Kembangan, Jakarta Barat 11610',
    phone: '(021) 5830-1988 / 0811-9876-5432',
    email: 'procurement@tan-gold.co.id',
    npwp: '01.234.567.8-035.000',
    nibPeb: '1234567890123 (NIB Ekspor PPN 0%)',
    currencyDefault: 'USD'
  });

  const [restoreFile, setRestoreFile] = useState(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = () => {
    const saved = getCompanyProfile();
    if (saved) setProfile(saved);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    await saveCompanyProfile(profile);
    showModal({ variant: 'success', title: '✅ Profil Perusahaan Tersimpan', message: 'Profil perusahaan & setting logo PT TAN berhasil disimpan.' });
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
    const backupData = getAllSystemData();
    backupData.companyProfile = profile;

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `BACKUP_PTTAN_ERP_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    showModal({ variant: 'success', title: '✅ Backup Terunduh', message: 'File backup database sistem PT TAN (.json) berhasil diunduh.' });
  };

  // Restore System JSON Import
  const handleRestoreImport = () => {
    if (!restoreFile) {
      showModal({ variant: 'warning', title: 'File Backup Belum Dipilih', message: 'Pilih file backup (.json) terlebih dahulu.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.app || !data.app.includes('TAN')) {
          showModal({
            variant: 'confirm',
            title: '⚠️ Format Backup Tidak Dikenal',
            message: 'File ini tidak dikenali sebagai backup PT TAN. Tetap lanjutkan restore?\n\nSeluruh data sistem saat ini akan ditimpa.',
            confirmLabel: 'Tetap Restore',
            onConfirm: () => applyRestore(data)
          });
          return;
        }

        applyRestore(data);
      } catch (err) {
        showModal({ variant: 'error', title: '❌ Gagal Merestore Data', message: 'File JSON rusak atau tidak valid.' });
      }
    };
    reader.readAsText(restoreFile);
  };

  const applyRestore = async (data) => {
    await restoreSystemData(data);
    if (data.companyProfile) {
      setProfile(data.companyProfile);
    }

    // Reload dijalankan saat modal ditutup — kalau langsung, pesannya tak sempat terbaca.
    showModal({
      variant: 'success',
      title: '🎉 Restore Data System PT TAN Berhasil',
      message: 'Halaman akan dimuat ulang setelah dialog ini ditutup.',
      confirmLabel: 'Muat Ulang Halaman',
      onDismiss: () => window.location.reload()
    });
  };

  return (
    <div>
      {/* Header */}
      <div className="glass-panel p-6 mb-6">
        <h2 className="font-heading text-[1.3rem] flex items-center gap-2.5">
          <Settings color="#f59e0b" size={24} /> Setting Perusahaan, Logo, Backup & Restore System
        </h2>
        <p className="text-[0.8rem] text-fg-soft">
          Manajemen Branding PT TAN, Header Cetakan Kop Surat/Invoice, Backup File JSON, & Safeguard Restore Data
        </p>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-6">
        {/* Company Profile & Logo Setting */}
        <div className="glass-panel p-6">
          <h3 className="font-heading text-[1.1rem] mb-4 flex items-center gap-2.5 text-gold-light">
            <Building2 size={20} /> Setting Profil & Logo Perusahaan (Kop Dokumen)
          </h3>

          <form onSubmit={handleSaveProfile}>
            <div className="mb-4 rounded-[12px] border border-dashed border-line bg-[rgba(15,23,42,0.6)] p-4 text-center">
              {profile.logoUrl ? (
                <img className="max-h-[80px] mb-2.5" src={profile.logoUrl} alt="Logo PT TAN" />
              ) : (
                <div className="p-5 text-fg-muted">Belum ada logo terpasang</div>
              )}
              <div>
                <label htmlFor="logo-input" className="btn-primary py-1.5 px-3.5 text-xs cursor-pointer inline-flex items-center gap-1.5">
                  <Image size={14} /> Unggah Logo PT TAN Baru
                </label>
                <input className="hidden" id="logo-input" type="file" accept="image/*" onChange={handleLogoUpload} />
              </div>
            </div>

            <div className="form-group mb-3">
              <label className="form-label">Nama Perusahaan Resmi</label>
              <input className="form-input" value={profile.companyName} onChange={e => setProfile({ ...profile, companyName: e.target.value })} />
            </div>
            <div className="form-group mb-3">
              <label className="form-label">Alamat Kantor & Pabrik</label>
              <input className="form-input" value={profile.address} onChange={e => setProfile({ ...profile, address: e.target.value })} />
            </div>
            <div className="form-group mb-3">
              <label className="form-label">Telepon / Fax</label>
              <input className="form-input" value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} />
            </div>
            <div className="form-group mb-3">
              <label className="form-label">NPWP Perusahaan</label>
              <input className="form-input" value={profile.npwp} onChange={e => setProfile({ ...profile, npwp: e.target.value })} />
            </div>
            <div className="form-group mb-4">
              <label className="form-label">NIB & Registrasi Ekspor Bea Cukai</label>
              <input className="form-input" value={profile.nibPeb} onChange={e => setProfile({ ...profile, nibPeb: e.target.value })} />
            </div>

            <button type="submit" className="btn-primary w-full">
              <CheckCircle2 size={16} /> Simpan Setting Profil & Logo
            </button>
          </form>
        </div>

        {/* Backup & Restore Data Management */}
        <div className="glass-panel p-6">
          <h3 className="font-heading text-[1.1rem] mb-4 flex items-center gap-2.5 text-sky-light">
            <Database size={20} /> Backup & Restore Database Sistem
          </h3>

          {/* Backup Section */}
          <div className="bg-[rgba(15,23,42,0.6)] p-5 rounded-[12px] mb-5 border border-[rgba(56,189,248,0.2)]">
            <h4 className="text-sky-light text-[0.95rem] mb-2 flex items-center gap-1.5">
              <Download size={16} /> Export Backup Data (.json)
            </h4>
            <p className="text-[0.78rem] text-fg-soft mb-3.5">
              Unduh seluruh database sistem (COA, PO Impor/Lokal, Faktur Ekspor, Voucher, Kartu Stok Vault, & Master Data) ke file backup `.json`.
            </p>
            <button className="btn-primary w-full bg-[linear-gradient(135deg,_#0284c7,_#0369a1)]" onClick={handleBackupExport}>
              <Download size={16} /> Unduh Backup Database JSON
            </button>
          </div>

          {/* Restore Section */}
          <div className="bg-[rgba(15,23,42,0.6)] p-5 rounded-[12px] border border-[rgba(245,158,11,0.2)]">
            <h4 className="text-gold-light text-[0.95rem] mb-2 flex items-center gap-1.5">
              <Upload size={16} /> Import Restore Data (.json)
            </h4>
            <p className="text-[0.78rem] text-fg-soft mb-3.5">
              Pulihkan database sistem dari file cadangan `.json` sebelumnya.
            </p>
            
            <input className="w-full mb-3 text-[0.8rem] text-fg-soft"
              type="file"
              accept=".json"
              onChange={e => setRestoreFile(e.target.files[0])}
            />

            <button className="btn-primary w-full bg-[linear-gradient(135deg,_#d97706,_#b45309)]" onClick={handleRestoreImport}>
              <Upload size={16} /> Restore Data System Now
            </button>
          </div>
        </div>
      </div>

      <Modal {...modalProps} />
    </div>
  );
}
