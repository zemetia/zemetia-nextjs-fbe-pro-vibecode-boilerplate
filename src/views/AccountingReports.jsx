import React, { useState, useEffect } from 'react';
import {
  BookOpen, FileText, Plus, Search, Filter, Printer, DollarSign,
  ArrowUpRight, ArrowDownRight, Scale, Clock, Award, ShieldCheck,
  CheckCircle2, TrendingUp, AlertTriangle, Layers
} from 'lucide-react';
import {
  getCOA,
  getExportDeliveryOrders,
  getJournalEntries,
  saveJournalEntries,
  getExportInvoices,
  getLocalPurchases,
  getPurchaseOrders,
  getNextReferenceNumber
} from '../services/storageService';
import {
  Modal,
  useModal,
  toast,
  NumberInput,
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty
} from '../components/ui';

export default function AccountingReports() {
  const { modalProps, showModal } = useModal();
  const [activeTab, setActiveTab] = useState('journals'); // journals, gl, trial, income, balance, cashflow, aging, calk
  const [journals, setJournals] = useState([]);
  const [selectedAccountCode, setSelectedAccountCode] = useState('1157');
  const [showAddForm, setShowAddForm] = useState(false);
  const [coaList, setCoaList] = useState([]);
  const [exportInvoices, setExportInvoices] = useState([]);
  const [localPurchases, setLocalPurchases] = useState([]);
  const [importPOs, setImportPOs] = useState([]);

  const [newJournal, setNewJournal] = useState({
    date: new Date().toISOString().split('T')[0],
    description: 'Jurnal Penyesuaian / Transaksi Kas Ops',
    debitAccount: '1157',
    creditAccount: '2111',
    amount: 10000000
  });

  useEffect(() => {
    const detailCOA = getCOA().filter(a => a.type === 'detail');
    setCoaList(detailCOA);
    loadFinancialData();
  }, [activeTab]);

  const loadFinancialData = () => {
    setJournals(getJournalEntries());
    setExportInvoices(getExportInvoices());
    setLocalPurchases(getLocalPurchases());
    setImportPOs(getPurchaseOrders());
  };

  const handleCreateJournal = async (e) => {
    e.preventDefault();
    if (!newJournal.amount || !newJournal.description) {
      toast.warning('Deskripsi dan nominal jurnal wajib diisi.');
      return;
    }

    const entryNum = await getNextReferenceNumber('journal');

    const debitAccName = coaList.find(a => a.code === newJournal.debitAccount)?.name || newJournal.debitAccount;
    const creditAccName = coaList.find(a => a.code === newJournal.creditAccount)?.name || newJournal.creditAccount;

    const entry = {
      id: Date.now(),
      entryNumber: entryNum,
      date: newJournal.date,
      description: newJournal.description,
      lines: [
        { accountCode: newJournal.debitAccount, accountName: debitAccName, debit: Number(newJournal.amount), credit: 0 },
        { accountCode: newJournal.creditAccount, accountName: creditAccName, debit: 0, credit: Number(newJournal.amount) }
      ],
      createdAt: new Date().toISOString()
    };

    const list = getJournalEntries();
    list.unshift(entry);
    await saveJournalEntries(list);

    showModal({
      variant: 'success',
      title: `✅ Jurnal Mutasi (${entry.entryNumber}) Diposting`,
      message: `${entry.description}\n• Debet: ${debitAccName} Rp ${Number(newJournal.amount).toLocaleString()}\n• Kredit: ${creditAccName} Rp ${Number(newJournal.amount).toLocaleString()}`
    });
    loadFinancialData();
    setShowAddForm(false);
  };

  // ==========================================
  // DYNAMIC FINANCIAL ENGINE CALCULATIONS
  // ==========================================

  // 1. Account Balances Map from all Journals
  const accountBalances = {};
  coaList.forEach(acc => {
    accountBalances[acc.code] = {
      code: acc.code,
      name: acc.name,
      category: acc.category,
      totalDebit: 0,
      totalCredit: 0,
      balance: 0
    };
  });

  journals.forEach(j => {
    j.lines?.forEach(l => {
      const code = l.accountCode;
      if (!accountBalances[code]) {
        accountBalances[code] = {
          code: code,
          name: l.accountName || code,
          category: code.startsWith('1') ? 'aset' : code.startsWith('2') ? 'kewajiban' : code.startsWith('3') ? 'ekuitas' : code.startsWith('4') ? 'pendapatan' : 'beban',
          totalDebit: 0,
          totalCredit: 0,
          balance: 0
        };
      }
      accountBalances[code].totalDebit += Number(l.debit || 0);
      accountBalances[code].totalCredit += Number(l.credit || 0);
    });
  });

  // Calculate Net Balances based on standard normal balance rules
  Object.values(accountBalances).forEach(acc => {
    const isDebitNormal = acc.category === 'aset' || acc.category === 'beban' || acc.code.startsWith('1') || acc.code.startsWith('5') || acc.code.startsWith('6');
    if (isDebitNormal) {
      acc.balance = acc.totalDebit - acc.totalCredit;
    } else {
      acc.balance = acc.totalCredit - acc.totalDebit;
    }
  });

  // 2. General Ledger (GL) Mutations for selected account (Chronologically Sorted)
  const selectedAcc = accountBalances[selectedAccountCode] || { code: selectedAccountCode, name: selectedAccountCode, category: 'aset' };
  const isSelectedDebitNormal = selectedAcc.category === 'aset' || selectedAcc.category === 'beban' || selectedAccountCode.startsWith('1') || selectedAccountCode.startsWith('5') || selectedAccountCode.startsWith('6');

  // Chronological copy for GL calculation
  const chronologicalJournals = [...journals].sort((a, b) => new Date(a.date) - new Date(b.date));
  const glMutations = [];
  let runningBalance = 0;

  chronologicalJournals.forEach(j => {
    j.lines?.forEach(line => {
      if (line.accountCode === selectedAccountCode) {
        const debit = Number(line.debit || 0);
        const credit = Number(line.credit || 0);
        if (isSelectedDebitNormal) {
          runningBalance += (debit - credit);
        } else {
          runningBalance += (credit - debit);
        }
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

  // 3. Trial Balance Summaries
  let trialTotalDebit = 0;
  let trialTotalCredit = 0;
  const trialAccounts = Object.values(accountBalances).filter(a => a.totalDebit > 0 || a.totalCredit > 0 || a.balance !== 0);
  trialAccounts.forEach(a => {
    trialTotalDebit += a.totalDebit;
    trialTotalCredit += a.totalCredit;
  });

  // 4. Laba Rugi SAK EMKM
  const revenueAccounts = Object.values(accountBalances).filter(a => a.code.startsWith('4') || a.category === 'pendapatan');
  const hppAccounts = Object.values(accountBalances).filter(a => a.code.startsWith('5') || a.category === 'hpp');
  const opexAccounts = Object.values(accountBalances).filter(a => (a.code.startsWith('6') || a.category === 'beban') && !a.code.startsWith('5'));

  const totalPendapatan = revenueAccounts.reduce((sum, a) => sum + Math.max(0, a.balance), 0);
  const totalHPP = hppAccounts.reduce((sum, a) => sum + Math.max(0, a.balance), 0);
  const totalOpex = opexAccounts.reduce((sum, a) => sum + Math.max(0, a.balance), 0);
  const labaKotor = totalPendapatan - totalHPP;
  const labaBersih = labaKotor - totalOpex;

  // 5. Neraca / Posisi Keuangan SAK EMKM
  const assetAccounts = Object.values(accountBalances).filter(a => a.code.startsWith('1') || a.category === 'aset');
  const liabilityAccounts = Object.values(accountBalances).filter(a => a.code.startsWith('2') || a.category === 'kewajiban');
  const equityAccounts = Object.values(accountBalances).filter(a => a.code.startsWith('3') || a.category === 'ekuitas');

  const totalAset = assetAccounts.reduce((sum, a) => sum + a.balance, 0);
  const totalKewajiban = liabilityAccounts.reduce((sum, a) => sum + a.balance, 0);
  const modalDisetor = equityAccounts.reduce((sum, a) => sum + a.balance, 0);
  const totalEkuitas = modalDisetor + labaBersih;
  const totalKewajibanDanEkuitas = totalKewajiban + totalEkuitas;
  const isBalanceMatch = Math.abs(totalAset - totalKewajibanDanEkuitas) < 1;

  // 6. Arus Kas Langsung (Direct Cash Flow)
  let cashInflow = 0;
  let cashOutflow = 0;
  const cashMovements = [];

  chronologicalJournals.forEach(j => {
    j.lines?.forEach(line => {
      const isCashOrBank = line.accountCode.startsWith('111') || line.accountCode.startsWith('112');
      if (isCashOrBank) {
        const debit = Number(line.debit || 0);
        const credit = Number(line.credit || 0);
        if (debit > 0) {
          cashInflow += debit;
          cashMovements.push({
            date: j.date,
            journalNo: j.entryNumber,
            description: j.description,
            account: line.accountName || line.accountCode,
            type: 'IN',
            amount: debit
          });
        }
        if (credit > 0) {
          cashOutflow += credit;
          cashMovements.push({
            date: j.date,
            journalNo: j.entryNumber,
            description: j.description,
            account: line.accountName || line.accountCode,
            type: 'OUT',
            amount: credit
          });
        }
      }
    });
  });
  const netCashFlow = cashInflow - cashOutflow;

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
              8 Laporan Keuangan Resmi Dinamis: Jurnal Umum, Buku Besar, Neraca Saldo, Laba Rugi SAK, Posisi Keuangan (Neraca), Arus Kas, Aging AR/AP, & CALK
            </p>
          </div>

          <div className="flex gap-2.5">
            <button
              className="btn-primary"
              onClick={() => showModal({
                variant: 'info',
                title: '🖨️ Cetak Laporan Keuangan SAK EMKM PT TAN',
                message: `Laporan Keuangan PT TAN (SAK EMKM):\n\n• Total Pendapatan Usaha: Rp ${totalPendapatan.toLocaleString()}\n• Total HPP & Beban: Rp ${(totalHPP + totalOpex).toLocaleString()}\n• Laba Bersih Usaha: Rp ${labaBersih.toLocaleString()}\n• Total Aset: Rp ${totalAset.toLocaleString()}\n• Total Kewajiban & Ekuitas: Rp ${totalKewajibanDanEkuitas.toLocaleString()}\n• Status Neraca: ${isBalanceMatch ? '✅ SEIMBANG (BALANCED)' : '⚠️ SELISIH'}\n\nBerkas laporan siap dicetak atau diekspor ke PDF.`
              })}
            >
              <Printer size={16} /> Cetak Laporan PDF
            </button>
            <button
              className="btn-primary bg-linear-135 from-gold to-gold-dark font-bold text-white"
              onClick={() => setShowAddForm(!showAddForm)}
            >
              <Plus size={16} /> Input Jurnal Manual
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[
            { id: 'journals', label: '📖 Mutasi Jurnal Umum' },
            { id: 'gl', label: '📒 Buku Besar (General Ledger)' },
            { id: 'trial', label: '⚖️ Neraca Saldo (Trial Balance)' },
            { id: 'income', label: '📈 Laba Rugi SAK EMKM' },
            { id: 'balance', label: '🏛️ Posisi Keuangan (Neraca)' },
            { id: 'cashflow', label: '💵 Arus Kas (Cash Flow)' },
            { id: 'aging', label: '⏱️ Aging AR / AP' },
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
            <h4 className="text-gold-light mb-3.5 text-[0.95rem]">➕ Form Input Jurnal Penyesuaian Manual</h4>
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

      {/* Tab 3: Neraca Saldo (Trial Balance) */}
      {activeTab === 'trial' && (
        <div className="glass-panel p-6">
          <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
            <h3 className="font-heading text-[1.1rem] text-gold-light">
              ⚖️ Laporan Neraca Saldo (Trial Balance SAK EMKM Dinamis)
            </h3>
            <span className={`badge ${Math.abs(trialTotalDebit - trialTotalCredit) < 1 ? 'badge-emerald' : 'badge-rose'}`}>
              {Math.abs(trialTotalDebit - trialTotalCredit) < 1 ? '✅ Debet = Kredit Seimbang' : '⚠️ Selisih Terdeteksi'}
            </span>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kode Akun</TableHead>
                <TableHead>Nama Akun Keuangan</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead className="text-right">Total Debet (IDR)</TableHead>
                <TableHead className="text-right">Total Kredit (IDR)</TableHead>
                <TableHead className="text-right">Saldo Netto Akhir</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trialAccounts.length === 0 ? (
                <TableEmpty colSpan={6} message="Belum ada data neraca saldo untuk periode ini." />
              ) : (
                trialAccounts.map(acc => (
                  <TableRow key={acc.code}>
                    <TableCell><strong>{acc.code}</strong></TableCell>
                    <TableCell>{acc.name}</TableCell>
                    <TableCell><span className="badge text-xs">{acc.category?.toUpperCase() || 'SAK'}</span></TableCell>
                    <TableCell className="text-right text-emerald-light">{acc.totalDebit > 0 ? `Rp ${acc.totalDebit.toLocaleString()}` : '-'}</TableCell>
                    <TableCell className="text-right text-danger">{acc.totalCredit > 0 ? `Rp ${acc.totalCredit.toLocaleString()}` : '-'}</TableCell>
                    <TableCell className="text-right font-bold text-gold-light">
                      Rp {acc.balance.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            <TableFooter>
              <TableRow className="font-extrabold text-[0.95rem]">
                <TableCell colSpan={3}>TOTAL NERACA SALDO</TableCell>
                <TableCell className="text-right text-emerald-light">Rp {trialTotalDebit.toLocaleString()}</TableCell>
                <TableCell className="text-right text-danger">Rp {trialTotalCredit.toLocaleString()}</TableCell>
                <TableCell className="text-right text-gold-light">
                  {Math.abs(trialTotalDebit - trialTotalCredit) < 1 ? '✅ Balanced' : '⚠️ Unbalanced'}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}

      {/* Tab 4: Laporan Laba Rugi */}
      {activeTab === 'income' && (
        <div className="glass-panel p-6">
          <h3 className="font-heading text-[1.2rem] mb-5 text-gold-light flex items-center gap-2">
            <TrendingUp size={22} /> Laporan Laba Rugi SAK EMKM (Dihitung Real-Time dari Jurnal)
          </h3>

          <div className="bg-[rgba(15,23,42,0.6)] p-6 rounded-[12px] border border-line space-y-6">
            {/* 1. Pendapatan */}
            <div>
              <div className="flex justify-between items-center border-b border-emerald/30 pb-2 mb-3">
                <strong className="text-emerald-light text-[1rem]">I. PENDAPATAN USAHA (REVENUE)</strong>
                <span className="badge badge-emerald">PPN 0% EKSPOR</span>
              </div>
              {revenueAccounts.length === 0 ? (
                <div className="text-fg-muted text-sm py-2">Belum ada jurnal pendapatan usaha.</div>
              ) : (
                revenueAccounts.map(a => (
                  <div key={a.code} className="flex justify-between my-2 text-sm">
                    <span>{a.code} - {a.name}</span>
                    <span className="font-medium text-emerald-light">Rp {a.balance.toLocaleString()}</span>
                  </div>
                ))
              )}
              <div className="flex justify-between font-bold text-emerald-light text-[1.05rem] pt-3 border-t border-line/50">
                <span>TOTAL PENDAPATAN USAHA</span>
                <span>Rp {totalPendapatan.toLocaleString()}</span>
              </div>
            </div>

            {/* 2. HPP */}
            <div>
              <div className="flex justify-between items-center border-b border-danger/30 pb-2 mb-3">
                <strong className="text-danger text-[1rem]">II. HARGA POKOK PENJUALAN (HPP)</strong>
                <span className="badge badge-rose">BIAYA PEROLEHAN EMAS</span>
              </div>
              {hppAccounts.length === 0 ? (
                <div className="text-fg-muted text-sm py-2">Belum ada jurnal HPP penjualan.</div>
              ) : (
                hppAccounts.map(a => (
                  <div key={a.code} className="flex justify-between my-2 text-sm">
                    <span>{a.code} - {a.name}</span>
                    <span className="font-medium text-danger">(Rp {a.balance.toLocaleString()})</span>
                  </div>
                ))
              )}
              <div className="flex justify-between font-bold text-danger text-[1.05rem] pt-3 border-t border-line/50">
                <span>TOTAL HARGA POKOK PENJUALAN</span>
                <span>(Rp {totalHPP.toLocaleString()})</span>
              </div>
            </div>

            {/* Laba Kotor */}
            <div className="flex justify-between font-bold text-[1.1rem] bg-white/[0.03] p-3 rounded-[8px] text-sky-light">
              <span>LABA KOTOR (GROSS PROFIT)</span>
              <span>Rp {labaKotor.toLocaleString()}</span>
            </div>

            {/* 3. Beban Operasional */}
            {opexAccounts.length > 0 && (
              <div>
                <strong className="text-amber-400 text-[1rem] block border-b border-amber-400/30 pb-2 mb-3">
                  III. BEBAN OPERASIONAL & UMUM
                </strong>
                {opexAccounts.map(a => (
                  <div key={a.code} className="flex justify-between my-2 text-sm">
                    <span>{a.code} - {a.name}</span>
                    <span className="font-medium text-danger">(Rp {a.balance.toLocaleString()})</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold text-amber-400 text-[1.05rem] pt-3 border-t border-line/50">
                  <span>TOTAL BEBAN OPERASIONAL</span>
                  <span>(Rp {totalOpex.toLocaleString()})</span>
                </div>
              </div>
            )}

            {/* Laba Bersih Akhir */}
            <div className="flex justify-between font-extrabold text-[1.25rem] text-gold-light bg-[rgba(245,158,11,0.12)] p-4 rounded-[10px] border border-gold/40">
              <span>LABA BERSIH PERIODE BERJALAN PT TAN</span>
              <span>Rp {labaBersih.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Laporan Posisi Keuangan (Neraca) */}
      {activeTab === 'balance' && (
        <div className="glass-panel p-6">
          <div className="flex justify-between items-center mb-5 flex-wrap gap-4">
            <h3 className="font-heading text-[1.2rem] text-sky-light flex items-center gap-2">
              <Scale size={22} /> Laporan Posisi Keuangan (Neraca SAK EMKM Dinamis)
            </h3>
            <span className={`badge ${isBalanceMatch ? 'badge-emerald' : 'badge-rose'}`}>
              {isBalanceMatch ? '✅ Keseimbangan Neraca Sempurna' : '⚠️ Selisih Terdeteksi'}
            </span>
          </div>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-6">
            {/* Sisi Kiri: ASET */}
            <div className="bg-[rgba(15,23,42,0.6)] p-5 rounded-[12px] border border-line">
              <h4 className="text-emerald-light font-bold text-[1.05rem] mb-4 border-b border-emerald/30 pb-2">
                ASET (ASSETS)
              </h4>
              <div className="space-y-2.5">
                {assetAccounts.filter(a => a.balance !== 0).map(a => (
                  <div key={a.code} className="flex justify-between text-sm">
                    <span>{a.code} - {a.name}</span>
                    <span className="font-medium text-emerald-light">Rp {a.balance.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-extrabold text-emerald-light text-[1.15rem] mt-6 border-t-2 border-line pt-3">
                <span>TOTAL ASET</span>
                <span>Rp {totalAset.toLocaleString()}</span>
              </div>
            </div>

            {/* Sisi Kanan: KEWAJIBAN & EKUITAS */}
            <div className="bg-[rgba(15,23,42,0.6)] p-5 rounded-[12px] border border-line flex flex-col justify-between">
              <div>
                <h4 className="text-sky-light font-bold text-[1.05rem] mb-4 border-b border-sky/30 pb-2">
                  KEWAJIBAN & EKUITAS
                </h4>

                <div className="mb-5">
                  <div className="text-xs font-bold text-fg-soft mb-2">KEWAJIBAN (LIABILITIES):</div>
                  <div className="space-y-2">
                    {liabilityAccounts.filter(a => a.balance !== 0).length === 0 ? (
                      <div className="text-fg-muted text-xs">Tidak ada saldo hutang aktif.</div>
                    ) : (
                      liabilityAccounts.filter(a => a.balance !== 0).map(a => (
                        <div key={a.code} className="flex justify-between text-sm">
                          <span>{a.code} - {a.name}</span>
                          <span className="font-medium text-sky-light">Rp {a.balance.toLocaleString()}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold text-fg-soft mb-2">EKUITAS (EQUITY):</div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>3110 - Modal Disetor Pemilik</span>
                      <span className="font-medium text-gold-light">Rp {modalDisetor.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>3210 - Saldo Laba Bersih Periode Berjalan</span>
                      <span className="font-medium text-emerald-light">Rp {labaBersih.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between font-extrabold text-sky-light text-[1.15rem] mt-6 border-t-2 border-line pt-3">
                <span>TOTAL KEWAJIBAN & EKUITAS</span>
                <span>Rp {totalKewajibanDanEkuitas.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 6: Laporan Arus Kas */}
      {activeTab === 'cashflow' && (
        <div className="glass-panel p-6">
          <h3 className="font-heading text-[1.2rem] mb-5 text-emerald-light flex items-center gap-2">
            <DollarSign size={22} /> Laporan Arus Kas Langsung (Direct Cash Flow Real-Time)
          </h3>

          <div className="bg-[rgba(15,23,42,0.6)] p-6 rounded-[12px] border border-line mb-6">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4 mb-5">
              <div className="bg-white/[0.03] p-4 rounded-[10px]">
                <div className="text-xs text-fg-soft">Total Arus Kas Masuk (Inflow):</div>
                <div className="text-[1.3rem] font-bold text-emerald-light">+ Rp {cashInflow.toLocaleString()}</div>
              </div>
              <div className="bg-white/[0.03] p-4 rounded-[10px]">
                <div className="text-xs text-fg-soft">Total Arus Kas Keluar (Outflow):</div>
                <div className="text-[1.3rem] font-bold text-danger">- Rp {cashOutflow.toLocaleString()}</div>
              </div>
              <div className="bg-white/[0.03] p-4 rounded-[10px]">
                <div className="text-xs text-fg-soft">Kenaikan / (Penurunan) Kas Bersih:</div>
                <div className={`text-[1.3rem] font-extrabold ${netCashFlow >= 0 ? 'text-gold-light' : 'text-danger'}`}>
                  {netCashFlow >= 0 ? `+ Rp ${netCashFlow.toLocaleString()}` : `- Rp ${Math.abs(netCashFlow).toLocaleString()}`}
                </div>
              </div>
            </div>

            <h4 className="text-fg-soft text-xs font-bold mb-3">RINCIAN MUTASI KAS & BANK TERAKHIR:</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>No. Jurnal</TableHead>
                  <TableHead>Akun Kas / Bank</TableHead>
                  <TableHead>Keterangan</TableHead>
                  <TableHead className="text-right">Nominal Arus Kas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cashMovements.length === 0 ? (
                  <TableEmpty colSpan={5} message="Belum ada mutasi arus kas tercatat." />
                ) : (
                  cashMovements.slice(-10).reverse().map((cm, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{cm.date}</TableCell>
                      <TableCell><strong>{cm.journalNo}</strong></TableCell>
                      <TableCell>{cm.account}</TableCell>
                      <TableCell>{cm.description}</TableCell>
                      <TableCell className={`text-right font-bold ${cm.type === 'IN' ? 'text-emerald-light' : 'text-danger'}`}>
                        {cm.type === 'IN' ? `+ Rp ${cm.amount.toLocaleString()}` : `- Rp ${cm.amount.toLocaleString()}`}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Tab 7: Aging AR / AP */}
      {activeTab === 'aging' && (
        <div className="glass-panel p-6">
          <h3 className="font-heading text-[1.2rem] mb-4 text-sky-light flex items-center gap-2">
            <Clock size={20} /> Laporan Umur Piutang & Utang (AR / AP Aging Real-Time)
          </h3>

          <div className="space-y-6">
            <div>
              <h4 className="text-emerald-light font-bold text-sm mb-3">📋 REKAPITULASI PIUTANG EKSPOR (ACCOUNTS RECEIVABLE):</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No. Invoice</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Nama Buyer Ekspor</TableHead>
                    <TableHead className="text-right">Total Tagihan USD</TableHead>
                    <TableHead className="text-right">Sisa Piutang (USD)</TableHead>
                    <TableHead className="text-right">Nilai Piutang (IDR)</TableHead>
                    <TableHead>Status Pembayaran</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exportInvoices.length === 0 ? (
                    <TableEmpty colSpan={7} message="Tidak ada piutang ekspor." />
                  ) : (
                    exportInvoices.map(inv => (
                      <TableRow key={inv.id || inv.invoiceNo}>
                        <TableCell><strong>{inv.invoiceNo}</strong></TableCell>
                        <TableCell>{inv.date}</TableCell>
                        <TableCell><strong>{inv.buyerName}</strong></TableCell>
                        <TableCell className="text-right font-medium">$ {(inv.totalUSD || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right font-bold text-gold-light">
                          $ {(typeof inv.remainingBalanceUSD !== 'undefined' ? inv.remainingBalanceUSD : inv.totalUSD || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-emerald-light font-bold">
                          Rp {(inv.totalIDR || 0).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <span className={`badge ${inv.paymentStatus === 'PAID' ? 'badge-emerald' : 'badge-gold'}`}>
                            {inv.paymentStatus || 'UNPAID'}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div>
              <h4 className="text-danger font-bold text-sm mb-3">📋 REKAPITULASI HUTANG PEMBELIAN EMAS (ACCOUNTS PAYABLE):</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ref Dokumen</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Supplier Emas</TableHead>
                    <TableHead>Jenis Pengadaan</TableHead>
                    <TableHead className="text-right">Total Tagihan (IDR)</TableHead>
                    <TableHead className="text-right">Sisa Hutang (IDR)</TableHead>
                    <TableHead>Status Pelunasan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...localPurchases, ...importPOs].filter(p => p.paymentStatus !== 'PAID').length === 0 ? (
                    <TableEmpty colSpan={7} message="Semua hutang pembelian emas telah lunas." />
                  ) : (
                    [...localPurchases, ...importPOs].filter(p => p.paymentStatus !== 'PAID').map((p, idx) => (
                      <TableRow key={p.id || idx}>
                        <TableCell><strong>{p.poNumber || p.receiptNo || p.id}</strong></TableCell>
                        <TableCell>{p.date || p.orderDate}</TableCell>
                        <TableCell><strong>{p.supplierName || p.supplier}</strong></TableCell>
                        <TableCell>
                          <span className="badge text-xs">
                            {String(p.poNumber || '').includes('IMP') ? 'Impor LBMA' : 'Lokal Tempo'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          Rp {Number(p.totalAmount || p.totalLandedCostIDR || p.total || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-extrabold text-danger">
                          Rp {Number(p.remainingBalanceIDR || p.totalAmount || p.totalLandedCostIDR || 0).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <span className="badge badge-rose">
                            {p.paymentStatus || 'UNPAID'}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 8: CALK SAK EMKM */}
      {activeTab === 'calk' && (
        <div className="glass-panel p-6">
          <h3 className="font-heading text-[1.2rem] mb-4 text-gold-light flex items-center gap-2">
            <Award size={20} /> Catatan Atas Laporan Keuangan (CALK SAK EMKM PT TAN)
          </h3>
          <div className="bg-[rgba(15,23,42,0.6)] p-6 rounded-[12px] border border-line text-[0.85rem] leading-[1.8] space-y-4">
            <div>
              <h4 className="text-gold-light font-bold text-sm mb-1">1. Entitas & Kegiatan Usaha</h4>
              <p className="text-fg-soft">
                PT. Triliun Anugrah Nusantara (PT TAN) adalah perseroan terbatas yang bergerak dalam bidang perdagangan besar logam mulia dan perhiasan emas (KBLI 46691) serta industri manufaktur perhiasan emas khusus ekspor (KBLI 32111). Laporan keuangan disusun berdasarkan Standar Akuntansi Keuangan Entitas Mikro, Kecil, dan Menengah (SAK EMKM).
              </p>
            </div>

            <div>
              <h4 className="text-gold-light font-bold text-sm mb-1">2. Kebijakan Pengakuan Persediaan Emas (Alur 2 Tahap)</h4>
              <p className="text-fg-soft">
                Pengadaan emas lokal dicatat melalui mekanisme pengamanan 2 tahap: pengeluaran dana tunai mendebet akun <code>1159</code> (Persediaan Emas Transit Kurir), dan baru dipindahkan ke akun <code>1157</code> (Persediaan Emas Murni Vault Utama) setelah emas ditimbang dan diverifikasi oleh 4 tanda tangan serah terima fisik di brankas PT TAN.
              </p>
            </div>

            <div>
              <h4 className="text-gold-light font-bold text-sm mb-1">3. Kebijakan Impor & PPh 22 Dibayar di Muka</h4>
              <p className="text-fg-soft">
                Impor emas batangan LBMA dinilai berdasarkan Landed Cost (FOB + Freight + Asuransi BRINKS). PPh Pasal 22 Impor sebesar 0,25% diakui sebagai Pajak Dibayar di Muka (Akun <code>1135</code>) dan tidak dikapitalisasi ke nilai persediaan emas.
              </p>
            </div>

            <div>
              <h4 className="text-gold-light font-bold text-sm mb-1">4. Fasilitas Perpajakan PPN 0% Ekspor</h4>
              <p className="text-fg-soft">
                Penjualan perhiasan emas ke luar negeri (Dubai DMCC, dsb.) memenuhi kriteria ekspor Barang Kena Pajak Berwujud sesuai PMK dan dikenai tarif Pajak Pertambahan Nilai (PPN) 0% dengan dokumen pelengkap Pemberitahuan Ekspor Barang (PEB).
              </p>
            </div>
          </div>
        </div>
      )}

      <Modal {...modalProps} />
    </div>
  );
}
