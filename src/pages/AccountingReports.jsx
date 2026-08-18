import React, { useState, useEffect } from 'react';
import { BookOpen, FileText, Plus, Search, Filter, Printer, DollarSign, ArrowUpRight, ArrowDownRight, Scale, Clock, Award } from 'lucide-react';
import { getCOA } from '../services/storageService';
import Modal, { useModal } from '../components/ui/Modal';
import NumberInput from '../components/ui/NumberInput';

export default function AccountingReports() {
  const { modalProps, showModal } = useModal();
  const [activeTab, setActiveTab] = useState('journals'); // journals, gl, trial, income, balance, cashflow, aging, calk
  const [journals, setJournals] = useState([]);
  const [selectedAccountCode, setSelectedAccountCode] = useState('1157');
  const [showAddForm, setShowAddForm] = useState(false);
  const [coaList, setCoaList] = useState([]);

  const [newJournal, setNewJournal] = useState({
    date: new Date().toISOString().split('T')[0],
    description: 'Jurnal Penyesuaian / Transaksi Kas Ops',
    debitAccount: '1157',
    creditAccount: '2110',
    amount: 10000000
  });

  useEffect(() => {
    setCoaList(getCOA().filter(a => a.type === 'detail'));
    loadJournals();
  }, [activeTab]);

  const loadJournals = () => {
    if (typeof window !== 'undefined' && window.Storage) {
      const stored = window.Storage.get(window.Storage.KEYS.JOURNAL_ENTRIES) || [];
      setJournals(stored);
    }
  };

  const handleCreateJournal = (e) => {
    e.preventDefault();
    if (!newJournal.amount || !newJournal.description) {
      showModal({ variant: 'warning', title: 'Data Belum Lengkap', message: 'Deskripsi dan nominal jurnal wajib diisi.' });
      return;
    }

    const entry = {
      id: Date.now(),
      entryNumber: `JRN-${Date.now().toString().slice(-6)}`,
      date: newJournal.date,
      description: newJournal.description,
      lines: [
        { accountCode: newJournal.debitAccount, accountName: coaList.find(a => a.code === newJournal.debitAccount)?.name || newJournal.debitAccount, debit: Number(newJournal.amount), credit: 0 },
        { accountCode: newJournal.creditAccount, accountName: coaList.find(a => a.code === newJournal.creditAccount)?.name || newJournal.creditAccount, debit: 0, credit: Number(newJournal.amount) }
      ],
      createdAt: new Date().toISOString()
    };

    if (typeof window !== 'undefined' && window.Storage) {
      const list = window.Storage.get(window.Storage.KEYS.JOURNAL_ENTRIES) || [];
      list.unshift(entry);
      window.Storage.set(window.Storage.KEYS.JOURNAL_ENTRIES, list);
      showModal({
        variant: 'success',
        title: `✅ Jurnal Mutasi (${entry.entryNumber}) Diposting`,
        message: `${entry.description}\nNominal: Rp ${Number(newJournal.amount).toLocaleString()}`
      });
      loadJournals();
      setShowAddForm(false);
    }
  };

  // Compute GL Mutations for selected account
  const glMutations = [];
  let runningBalance = 0;
  journals.forEach(j => {
    j.lines?.forEach(line => {
      if (line.accountCode === selectedAccountCode) {
        const debit = Number(line.debit || 0);
        const credit = Number(line.credit || 0);
        runningBalance += (debit - credit);
        glMutations.push({
          journalNo: j.entryNumber,
          date: j.date,
          description: j.description,
          debit,
          credit,
          balance: runningBalance
        });
      }
    });
  });

  return (
    <div>
      {/* Header Controls */}
      <div className="glass-panel p-6 mb-6">
        <div className="flex justify-between items-center flex-wrap gap-4 mb-5">
          <div>
            <h2 className="font-heading text-[1.3rem] flex items-center gap-2.5">
              <BookOpen color="#f59e0b" size={24} /> Modul Laporan Keuangan Lengkap SAK EMKM PT TAN
            </h2>
            <p className="text-[0.8rem] text-fg-soft">
              8 Laporan Keuangan Resmi (Jurnal Umum, Buku Besar, Neraca Saldo, Laba Rugi, Neraca, Arus Kas, Aging AR/AP, & CALK)
            </p>
          </div>

          <div className="flex gap-2.5">
            <button className="btn-primary" onClick={() => showModal({ variant: 'info', title: '🖨️ Cetak Laporan Keuangan PDF', message: 'Menyiapkan berkas PDF laporan keuangan PT TAN.' })}>
              <Printer size={16} /> Cetak Laporan PDF
            </button>
            <button className="btn-primary" onClick={() => setShowAddForm(!showAddForm)}>
              <Plus size={16} /> Input Jurnal Manual
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[
            { id: 'journals', label: '📖 Mutasi Jurnal' },
            { id: 'gl', label: '📒 Buku Besar' },
            { id: 'trial', label: '⚖️ Neraca Saldo' },
            { id: 'income', label: '📈 Laba Rugi SAK' },
            { id: 'balance', label: '🏛️ Posisi Keuangan (Neraca)' },
            { id: 'cashflow', label: '💵 Arus Kas' },
            { id: 'aging', label: '⏱️ Aging AR/AP' },
            { id: 'calk', label: '📜 CALK SAK EMKM' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`cursor-pointer whitespace-nowrap rounded-sm border border-line px-3.5 py-[9px] text-[0.8rem] ${
                activeTab === tab.id
                  ? 'bg-linear-135 from-gold to-gold-dark font-bold text-white'
                  : 'bg-[rgba(15,23,42,0.6)] font-medium text-fg-soft'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Form Add Manual Journal */}
        {showAddForm && (
          <form className="bg-[rgba(15,23,42,0.7)] p-5 rounded-[12px] mt-5 border border-gold" onSubmit={handleCreateJournal}>
            <h4 className="text-gold-light mb-3.5 text-[0.95rem]">➕ Form Input Jurnal Manual</h4>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Tanggal Jurnal</label>
                <input
                  type="date"
                  className="form-input"
                  value={newJournal.date}
                  onChange={e => setNewJournal({ ...newJournal, date: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Akun Debet</label>
                <select
                  className="form-select"
                  value={newJournal.debitAccount}
                  onChange={e => setNewJournal({ ...newJournal, debitAccount: e.target.value })}
                >
                  {coaList.map(a => (
                    <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Akun Kredit</label>
                <select
                  className="form-select"
                  value={newJournal.creditAccount}
                  onChange={e => setNewJournal({ ...newJournal, creditAccount: e.target.value })}
                >
                  {coaList.map(a => (
                    <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Nominal (IDR)</label>
                <NumberInput
                  value={newJournal.amount}
                  onChange={amount => setNewJournal({ ...newJournal, amount })}
                />
              </div>
              <div className="form-group col-span-2">
                <label className="form-label">Deskripsi Keterangan Jurnal</label>
                <input
                  className="form-input"
                  value={newJournal.description}
                  onChange={e => setNewJournal({ ...newJournal, description: e.target.value })}
                />
              </div>
            </div>
            <button type="submit" className="btn-primary mt-3">
              Posting Jurnal Ke Ledger
            </button>
          </form>
        )}
      </div>

      {/* Tab 1: Mutasi Jurnal Umum */}
      {activeTab === 'journals' && (
        <div className="glass-panel p-6">
          <h3 className="font-heading text-[1.1rem] mb-4">
            📖 Daftar Mutasi Jurnal Umum ({journals.length})
          </h3>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>No. Jurnal</th>
                  <th>Tanggal</th>
                  <th>Deskripsi Keterangan</th>
                  <th>Kode & Nama Akun</th>
                  <th className="text-right">Debet (IDR)</th>
                  <th className="text-right">Kredit (IDR)</th>
                </tr>
              </thead>
              <tbody>
                {journals.map(j => (
                  <React.Fragment key={j.id || j.entryNumber}>
                    {j.lines?.map((line, idx) => (
                      <tr key={idx} className={idx === 0 ? 'bg-white/[0.02]' : 'bg-transparent'}>
                        {idx === 0 && <td rowSpan={j.lines.length}><strong>{j.entryNumber}</strong></td>}
                        {idx === 0 && <td rowSpan={j.lines.length}>{j.date}</td>}
                        {idx === 0 && <td rowSpan={j.lines.length}>{j.description}</td>}
                        <td>
                          <span className={line.credit > 0 ? 'pl-5' : 'pl-0'}>
                            <strong>{line.accountCode}</strong> - {line.accountName}
                          </span>
                        </td>
                        <td className="text-right">
                          {line.debit > 0 ? `Rp ${line.debit.toLocaleString()}` : '-'}
                        </td>
                        <td className="text-right">
                          {line.credit > 0 ? `Rp ${line.credit.toLocaleString()}` : '-'}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Buku Besar (General Ledger) */}
      {activeTab === 'gl' && (
        <div className="glass-panel p-6">
          <div className="flex gap-4 items-center mb-5 flex-wrap">
            <label className="form-label mb-0">Pilih Akun Buku Besar:</label>
            <select
              className="form-select max-w-[360px]"
              value={selectedAccountCode}
              onChange={e => setSelectedAccountCode(e.target.value)}
            >
              {coaList.map(a => (
                <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
              ))}
            </select>
          </div>

          <h3 className="font-heading text-[1.1rem] mb-4">
            📒 Buku Besar Akun {selectedAccountCode} ({glMutations.length} Mutasi)
          </h3>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>No. Jurnal</th>
                  <th>Tanggal</th>
                  <th>Keterangan</th>
                  <th className="text-right">Debet (IDR)</th>
                  <th className="text-right">Kredit (IDR)</th>
                  <th className="text-right">Saldo Akhir (IDR)</th>
                </tr>
              </thead>
              <tbody>
                {glMutations.length === 0 ? (
                  <tr><td className="text-center p-7.5 text-fg-muted" colSpan="6">Belum ada mutasi untuk akun ini</td></tr>
                ) : (
                  glMutations.map((m, i) => (
                    <tr key={i}>
                      <td><strong>{m.journalNo}</strong></td>
                      <td>{m.date}</td>
                      <td>{m.description}</td>
                      <td className={`text-right ${m.debit > 0 ? 'text-emerald-light' : 'text-inherit'}`}>{m.debit > 0 ? `Rp ${m.debit.toLocaleString()}` : '-'}</td>
                      <td className={`text-right ${m.credit > 0 ? 'text-danger' : 'text-inherit'}`}>{m.credit > 0 ? `Rp ${m.credit.toLocaleString()}` : '-'}</td>
                      <td className="text-right font-bold text-gold-light">Rp {m.balance.toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Neraca Saldo (Trial Balance) */}
      {activeTab === 'trial' && (
        <div className="glass-panel p-6">
          <h3 className="font-heading text-[1.1rem] mb-4 text-gold-light">
            ⚖️ Laporan Neraca Saldo (Trial Balance SAK EMKM)
          </h3>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Kode Akun</th>
                  <th>Nama Akun Keuangan</th>
                  <th className="text-right">Total Debet (IDR)</th>
                  <th className="text-right">Total Kredit (IDR)</th>
                  <th className="text-right">Saldo Akhir</th>
                </tr>
              </thead>
              <tbody>
                {coaList.map(acc => (
                  <tr key={acc.code}>
                    <td><strong>{acc.code}</strong></td>
                    <td>{acc.name}</td>
                    <td className="text-right">Rp {(acc.balance || 0).toLocaleString()}</td>
                    <td className="text-right">Rp 0</td>
                    <td className="text-right font-bold">Rp {(acc.balance || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Laporan Laba Rugi */}
      {activeTab === 'income' && (
        <div className="glass-panel p-6">
          <h3 className="font-heading text-[1.2rem] mb-5 text-gold-light">
            📈 Laporan Laba Rugi SAK EMKM (Ekspor PPN 0%)
          </h3>
          <div className="bg-[rgba(15,23,42,0.6)] p-5 rounded-[12px]">
            <div className="border-b border-line pb-3 mb-3">
              <strong className="text-emerald-light">PENDAPATAN EKSPOR (PPN 0%)</strong>
              <div className="flex justify-between my-2 mx-0">
                <span>4110 - Pendapatan Ekspor Logam Mulia</span>
                <span>Rp 1.500.000.000</span>
              </div>
              <div className="flex justify-between my-2 mx-0">
                <span>4120 - Pendapatan Ekspor Perhiasan Emas</span>
                <span>Rp 850.000.000</span>
              </div>
              <div className="flex justify-between font-bold text-emerald-light text-[1.05rem] mt-2.5">
                <span>TOTAL PENDAPATAN EKSPOR</span>
                <span>Rp 2.350.000.000</span>
              </div>
            </div>

            <div className="border-b border-line pb-3 mb-3">
              <strong className="text-danger">HARGA POKOK PENJUALAN (HPP)</strong>
              <div className="flex justify-between my-2 mx-0">
                <span>5114 - HPP Ekspor LM Lokal</span>
                <span>(Rp 1.200.000.000)</span>
              </div>
              <div className="flex justify-between my-2 mx-0">
                <span>5115 - HPP Ekspor LM Import (Landed Cost)</span>
                <span>(Rp 650.000.000)</span>
              </div>
              <div className="flex justify-between font-bold text-danger text-[1.05rem] mt-2.5">
                <span>TOTAL HPP PENJUALAN</span>
                <span>(Rp 1.850.000.000)</span>
              </div>
            </div>

            <div className="flex justify-between font-extrabold text-[1.2rem] text-gold-light bg-[rgba(245,158,11,0.1)] p-3.5 rounded-[10px]">
              <span>LABA BERSIH USAHA EKSPOR PT TAN</span>
              <span>Rp 500.000.000</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Laporan Posisi Keuangan */}
      {activeTab === 'balance' && (
        <div className="glass-panel p-6">
          <h3 className="font-heading text-[1.2rem] mb-5 text-sky-light">
            🏛️ Laporan Posisi Keuangan (Neraca SAK EMKM)
          </h3>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-5">
            <div className="bg-[rgba(15,23,42,0.6)] p-5 rounded-[12px]">
              <h4 className="text-emerald-light mb-3">ASET (ASSETS)</h4>
              <div className="flex justify-between my-1.5 mx-0"><span>1125 - Bank Valas USD</span><span>Rp 850.000.000</span></div>
              <div className="flex justify-between my-1.5 mx-0"><span>1157 - Persediaan LM Lokal</span><span>Rp 1.250.000.000</span></div>
              <div className="flex justify-between my-1.5 mx-0"><span>1158 - Persediaan LM Import</span><span>Rp 2.100.000.000</span></div>
              <div className="flex justify-between my-1.5 mx-0"><span>1160 - Persediaan Perhiasan Ekspor</span><span>Rp 1.300.000.000</span></div>
              <div className="flex justify-between font-extrabold text-emerald-light mt-4 border-t border-line pt-2.5">
                <span>TOTAL ASET</span><span>Rp 5.500.000.000</span>
              </div>
            </div>

            <div className="bg-[rgba(15,23,42,0.6)] p-5 rounded-[12px]">
              <h4 className="text-sky-light mb-3">KEWAJIBAN & EKUITAS</h4>
              <div className="flex justify-between my-1.5 mx-0"><span>2110 - Utang Usaha</span><span>Rp 1.500.000.000</span></div>
              <div className="flex justify-between my-1.5 mx-0"><span>3110 - Modal Disetor</span><span>Rp 3.500.000.000</span></div>
              <div className="flex justify-between my-1.5 mx-0"><span>3210 - Saldo Laba Bersih</span><span>Rp 500.000.000</span></div>
              <div className="flex justify-between font-extrabold text-sky-light mt-4 border-t border-line pt-2.5">
                <span>TOTAL KEWAJIBAN & EKUITAS</span><span>Rp 5.500.000.000</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 6: Laporan Arus Kas */}
      {activeTab === 'cashflow' && (
        <div className="glass-panel p-6">
          <h3 className="font-heading text-[1.2rem] mb-5 text-emerald-light">
            💵 Laporan Arus Kas (Direct Cash Flow Method)
          </h3>
          <div className="bg-[rgba(15,23,42,0.6)] p-5 rounded-[12px]">
            <div className="my-2 mx-0 flex justify-between">
              <span>Arus Kas Dari Aktivitas Operasional (Penerimaan Ekspor & Pembelian LM)</span>
              <strong className="text-emerald-light">+ Rp 450.000.000</strong>
            </div>
            <div className="my-2 mx-0 flex justify-between">
              <span>Arus Kas Dari Aktivitas Investasi (Peralatan & Brankas Vault)</span>
              <strong className="text-danger">- Rp 50.000.000</strong>
            </div>
            <div className="flex justify-between font-extrabold text-[1.1rem] text-gold-light mt-4 border-t border-line pt-3">
              <span>KENAIKAN BERSIH KAS & BANK VALAS</span>
              <span>+ Rp 400.000.000</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 7: Aging AR/AP */}
      {activeTab === 'aging' && (
        <div className="glass-panel p-6">
          <h3 className="font-heading text-[1.2rem] mb-4 text-sky-light">
            ⏱️ Laporan Umur Piutang & Utang (AR/AP Aging Report)
          </h3>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Nama Mitra / Buyer</th>
                  <th>Kategori</th>
                  <th>1-30 Hari</th>
                  <th>31-60 Hari</th>
                  <th>61-90 Hari</th>
                  <th>&gt; 90 Hari</th>
                  <th className="text-right">Total Saldo</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Dubai Gold & Jewelry DMCC</strong></td>
                  <td><span className="badge badge-emerald">Piutang Ekspor</span></td>
                  <td className="text-emerald-light">$ 50,000.00</td>
                  <td>-</td>
                  <td>-</td>
                  <td>-</td>
                  <td className="text-right font-bold">$ 50,000.00</td>
                </tr>
                <tr>
                  <td><strong>Valcambi SA Switzerland</strong></td>
                  <td><span className="badge badge-gold">Utang Impor</span></td>
                  <td>$ 75,000.00</td>
                  <td>-</td>
                  <td>-</td>
                  <td>-</td>
                  <td className="text-right font-bold">$ 75,000.00</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 8: CALK SAK EMKM */}
      {activeTab === 'calk' && (
        <div className="glass-panel p-6">
          <h3 className="font-heading text-[1.2rem] mb-4 text-gold-light">
            📜 Catatan Atas Laporan Keuangan (CALK SAK EMKM)
          </h3>
          <div className="bg-[rgba(15,23,42,0.6)] p-5 rounded-[12px] text-[0.85rem] leading-[1.7]">
            <h4 className="text-gold-light mb-2">1. Umum & Dasar Penyusunan Laporan Keuangan</h4>
            <p>
              PT TAN didirikan di Indonesia dengan kegiatan usaha utama Trading Logam Mulia dan Produksi Perhiasan Emas Khusus Ekspor (PPN 0%). Laporan keuangan disusun berdasarkan Standar Akuntansi Keuangan Entitas Mikro, Kecil, dan Menengah (SAK EMKM).
            </p>

            <h4 className="text-gold-light mt-4 mb-2">2. Kebijakan Akuntansi Persediaan & Landed Cost</h4>
            <p>
              Persediaan emas murni impor dinilai berdasarkan Biaya Perolehan Landed Cost (Biaya Pembelian FOB + Bea Masuk + Freight & Asuransi Impor). PPh 22 Impor diakui sebagai Pajak Dibayar Di Muka (Aset Lancar) dan tidak dikapitalisasi ke nilai barang.
            </p>

            <h4 className="text-gold-light mt-4 mb-2">3. Transaksi Mata Uang Asing (Valas)</h4>
            <p>
              Transaksi ekspor dan impor dalam mata uang USD dikonversi ke mata uang fungsional Rupiah menggunakan Kurs BCA e-Rate pada tanggal transaksi. Selisih kurs diakui pada Laporan Laba Rugi (Akun `6110`).
            </p>
          </div>
        </div>
      )}

      <Modal {...modalProps} />
    </div>
  );
}
