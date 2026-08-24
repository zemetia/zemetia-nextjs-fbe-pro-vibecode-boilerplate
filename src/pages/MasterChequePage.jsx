import React, { useState, useEffect } from 'react';
import { CreditCard, Plus, CheckCircle, AlertTriangle, ShieldCheck, Filter, Search, Ban, Clock, CheckSquare, Layers, Lock, BookOpen } from 'lucide-react';
import { getChequeBooks, saveChequeBooks } from '../services/storageService';
import {
  Modal,
  useModal,
  NumberInput,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty
} from '../components/ui';

export default function MasterChequePage() {
  const { modalProps, showModal } = useModal();
  const [chequeBooks, setChequeBooks] = useState([]);
  const [selectedBankFilter, setSelectedBankFilter] = useState('ALL');
  const [showAddBookModal, setShowAddBookModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [newBookForm, setNewBookForm] = useState({
    bookNumber: 'BOOK-BCA-2026B',
    bankCode: 'BCA-001',
    bankName: 'Bank BCA (KCU Thamrin)',
    accountNumber: '889-012-3456',
    currency: 'IDR',
    seriesPrefix: 'BG-BCA-',
    startNumber: 998850,
    endNumber: 998874, // 25 lembar
    maxLimitPerCheque: 500000000, // Rp 500 Juta per lembar
    totalBookLimit: 5000000000, // Rp 5 Milyar total plafon buku
    description: 'Buku Bilyet Giro Operasional Pembelian Emas Lokal'
  });

  useEffect(() => {
    loadChequeData();
  }, []);

  const loadChequeData = () => {
    setChequeBooks(getChequeBooks());
  };

  // Tambah Master Buku Cek Baru
  const handleCreateBook = async (e) => {
    e.preventDefault();
    const start = Number(newBookForm.startNumber);
    const end = Number(newBookForm.endNumber);

    if (end < start) {
      showModal({ variant: 'warning', title: 'Rentang Nomor Tidak Valid', message: 'Nomor akhir cek harus lebih besar atau sama dengan nomor awal.' });
      return;
    }

    const totalLeaves = end - start + 1;
    const generatedLeaves = [];
    for (let i = start; i <= end; i++) {
      generatedLeaves.push({
        checkNumber: `${newBookForm.seriesPrefix}${i}`,
        status: 'AVAILABLE',
        voucherNo: '-',
        payee: '-',
        amount: 0,
        dueDate: '-',
        isCleared: false
      });
    }

    const newBook = {
      id: `BOOK-${Date.now()}`,
      bookNumber: newBookForm.bookNumber,
      bankCode: newBookForm.bankCode,
      bankName: newBookForm.bankName,
      accountNumber: newBookForm.accountNumber,
      currency: newBookForm.currency,
      seriesPrefix: newBookForm.seriesPrefix,
      startNumber: start,
      endNumber: end,
      totalLeaves,
      maxLimitPerCheque: Number(newBookForm.maxLimitPerCheque),
      totalBookLimit: Number(newBookForm.totalBookLimit),
      issuedDate: new Date().toISOString().split('T')[0],
      leaves: generatedLeaves
    };

    const list = getChequeBooks();
    list.unshift(newBook);
    await saveChequeBooks(list);
    showModal({
      variant: 'success',
      title: `✅ Buku Cek/BG (${newBook.bookNumber}) Terdaftar`,
      message: `• Jumlah lembar: ${totalLeaves} lembar\n• Plafon maks per lembar: Rp ${newBook.maxLimitPerCheque.toLocaleString()}`
    });
    loadChequeData();
    setShowAddBookModal(false);
  };

  // Batalkan Lembar Cek (Void)
  const handleVoidLeaf = (bookId, checkNumber) => {
    showModal({
      variant: 'confirm',
      title: `Batalkan (VOID) Lembar Cek ${checkNumber}`,
      message: 'Lembar ini tidak akan bisa dipakai lagi untuk transaksi apa pun.\n\nLanjutkan pembatalan?',
      confirmLabel: 'Ya, Batalkan Lembar',
      onConfirm: () => voidLeaf(bookId, checkNumber)
    });
  };

  const voidLeaf = async (bookId, checkNumber) => {
    const list = getChequeBooks();
    const updated = list.map(b => {
      if (b.id === bookId || b.bookNumber === bookId) {
        return {
          ...b,
          leaves: b.leaves.map(l => l.checkNumber === checkNumber ? { ...l, status: 'VOID', notes: 'Dibatalkan / Rusak' } : l)
        };
      }
      return b;
    });
    await saveChequeBooks(updated);
    showModal({ variant: 'success', title: '🚫 Lembar Cek Dibatalkan', message: `Lembar cek ${checkNumber} berhasil di-VOID.` });
    loadChequeData();
  };

  // Filtered Books
  const filteredBooks = chequeBooks.filter(b => {
    if (selectedBankFilter !== 'ALL' && b.bankName !== selectedBankFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return b.bookNumber.toLowerCase().includes(q) || b.bankName.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div>
      {/* Header Panel */}
      <div className="glass-panel p-6 mb-6">
        <div className="flex justify-between items-center flex-wrap gap-4 mb-5">
          <div>
            <h2 className="font-heading text-[1.3rem] flex items-center gap-2.5">
              <BookOpen color="#f59e0b" size={24} /> Master Buku Cek / Bilyet Giro & Kontrol Plafon Bank
            </h2>
            <p className="text-[0.8rem] text-fg-soft">
              Registrasi Buku Cek/BG Bank, Pembatasan Plafon Maksimal per Lembar Cek, & Pelacakan Lembar Siap Pakai
            </p>
          </div>

          <div className="flex gap-2.5">
            <button className="btn-primary" onClick={() => setShowAddBookModal(!showAddBookModal)}>
              <Plus size={16} /> Daftarkan Buku Cek / BG Baru
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex gap-3 flex-wrap items-center">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-fg-muted" />
            <select
              className="form-select max-w-[240px]"
              value={selectedBankFilter}
              onChange={e => setSelectedBankFilter(e.target.value)}
            >
              <option value="ALL">Semua Bank Penerbit</option>
              <option value="Bank BCA (KCU Thamrin)">Bank BCA (KCU Thamrin)</option>
              <option value="Bank Mandiri (Cabang Jakarta)">Bank Mandiri</option>
              <option value="Bank CIMB Niaga">Bank CIMB Niaga</option>
            </select>
          </div>

          <div className="flex-1 min-w-[220px] relative">
            <input
              className="form-input"
              placeholder="Cari nomor buku / bank..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Modal Form Tambah Buku Cek */}
        {showAddBookModal && (
          <form className="bg-[rgba(15,23,42,0.8)] p-5 rounded-[12px] mt-5 border border-gold" onSubmit={handleCreateBook}>
            <h4 className="text-gold-light mb-3.5 text-[0.95rem]">➕ Daftarkan Buku Cek / Bilyet Giro Baru dari Bank</h4>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">No. Registrasi Buku</label>
                <input
                  className="form-input font-bold text-gold-light"
                  value={newBookForm.bookNumber}
                  onChange={e => setNewBookForm({ ...newBookForm, bookNumber: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Bank Penerbit Buku Cek</label>
                <select
                  className="form-select"
                  value={newBookForm.bankName}
                  onChange={e => setNewBookForm({ ...newBookForm, bankName: e.target.value })}
                >
                  <option value="Bank BCA (KCU Thamrin)">Bank BCA (KCU Thamrin) - Rek 889-012-3456</option>
                  <option value="Bank Mandiri (Cabang Jakarta)">Bank Mandiri - Rek 123-00-9988776-5</option>
                  <option value="Bank CIMB Niaga">Bank CIMB Niaga</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Prefix Nomor Seri (Kode Awalan)</label>
                <input
                  className="form-input"
                  placeholder="Contoh: BG-BCA- atau CEK-MDR-"
                  value={newBookForm.seriesPrefix}
                  onChange={e => setNewBookForm({ ...newBookForm, seriesPrefix: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Nomor Lembar Awal</label>
                <input
                  type="number"
                  className="form-input"
                  value={newBookForm.startNumber}
                  onChange={e => setNewBookForm({ ...newBookForm, startNumber: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Nomor Lembar Akhir</label>
                <input
                  type="number"
                  className="form-input"
                  value={newBookForm.endNumber}
                  onChange={e => setNewBookForm({ ...newBookForm, endNumber: e.target.value })}
                />
              </div>

              {/* BATAS PLAFON MAKSIMAL PER LEMBAR */}
              <div className="form-group bg-[rgba(245,158,11,0.1)] p-2.5 rounded-sm border border-gold">
                <label className="form-label text-gold-light font-bold flex items-center gap-1.5">
                  <Lock size={15} /> Batas Plafon Maksimal per Lembar Cek (IDR)
                </label>
                <NumberInput
                  className="border border-gold text-gold-light font-extrabold text-[1.05rem]"
                  value={newBookForm.maxLimitPerCheque}
                  onChange={maxLimitPerCheque => setNewBookForm({ ...newBookForm, maxLimitPerCheque })}
                />
                <small className="text-fg-muted">User tidak dapat menginput nominal melebihi batas ini saat menerbitkan voucher.</small>
              </div>
            </div>

            <button type="submit" className="btn-primary mt-3">
              <CheckCircle size={16} /> Simpan & Generate Seluruh Lembar Cek
            </button>
          </form>
        )}
      </div>

      {/* Books and Leaf Register */}
      {filteredBooks.length === 0 ? (
        <div className="glass-panel p-6 mb-6">
          <div className="text-center py-8 text-fg-soft">Belum ada buku cek/BG yang sesuai dengan pencarian.</div>
        </div>
      ) : filteredBooks.map(book => {
        const availableLeaves = (book.leaves || []).filter(l => l.status === 'AVAILABLE');
        const usedLeaves = (book.leaves || []).filter(l => l.status === 'USED');
        const voidLeaves = (book.leaves || []).filter(l => l.status === 'VOID');

        return (
          <div key={book.id || book.bookNumber} className="glass-panel p-6 mb-6">
            <div className="flex justify-between items-center flex-wrap gap-3.5 mb-4.5 border-b border-line pb-3.5">
              <div>
                <h3 className="font-heading text-[1.15rem] text-gold-light flex items-center gap-2">
                  <CreditCard size={20} /> {book.bookNumber} — {book.bankName}
                </h3>
                <p className="text-[0.8rem] text-fg-soft">
                  Rekening: <strong>{book.accountNumber || '889-012-3456'}</strong> | Seri: <code>{book.seriesPrefix}{book.startNumber} s/d {book.seriesPrefix}{book.endNumber}</code>
                </p>
              </div>

              {/* Status Chips */}
              <div className="flex gap-2.5 flex-wrap">
                <span className="badge badge-emerald text-[0.8rem]">
                  🟢 Tersedia: {availableLeaves.length} Lembar
                </span>
                <span className="badge badge-gold text-[0.8rem]">
                  ⏳ Terpakai: {usedLeaves.length} Lembar
                </span>
                <span className="badge badge-rose text-[0.8rem]">
                  🚫 Batal (Void): {voidLeaves.length} Lembar
                </span>
                <span className="badge badge-blue text-[0.8rem] bg-[rgba(56,189,248,0.15)] border border-sky-light text-sky-light">
                  <Lock className="inline mr-1" size={12} /> Maks / Lembar: Rp {Number(book.maxLimitPerCheque || 500000000).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Table of Leaves */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No. Seri Lembar Cek/BG</TableHead>
                  <TableHead>Status Lembar</TableHead>
                  <TableHead>No. Voucher Terkait</TableHead>
                  <TableHead>Penerima (Payee)</TableHead>
                  <TableHead className="text-right">Nominal Digunakan</TableHead>
                  <TableHead>Jatuh Tempo Kliring</TableHead>
                  <TableHead>Status Pencairan</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(book.leaves || []).length === 0 ? (
                  <TableEmpty colSpan={8} message="Belum ada lembar cek/BG pada buku ini." />
                ) : (
                  (book.leaves || []).map((leaf, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <strong className={leaf.status === 'AVAILABLE' ? 'text-emerald-light' : leaf.status === 'VOID' ? 'text-danger' : 'text-gold-light'}>
                          {leaf.checkNumber}
                        </strong>
                      </TableCell>
                      <TableCell>
                        {leaf.status === 'AVAILABLE' && <span className="badge badge-emerald">🟢 TERSEDIA (SIAP PAKAI)</span>}
                        {leaf.status === 'USED' && <span className="badge badge-gold">⏳ TERPAKAI (DIKELUARKAN)</span>}
                        {leaf.status === 'VOID' && <span className="badge badge-rose">🚫 BATAL (VOID)</span>}
                      </TableCell>
                      <TableCell>{leaf.voucherNo || '-'}</TableCell>
                      <TableCell>{leaf.payee || '-'}</TableCell>
                      <TableCell className={`text-right font-bold ${leaf.amount > 0 ? 'text-emerald-light' : 'text-fg-muted'}`}>
                        {leaf.amount > 0 ? `Rp ${leaf.amount.toLocaleString()}` : '-'}
                      </TableCell>
                      <TableCell>{leaf.dueDate || '-'}</TableCell>
                      <TableCell>
                        {leaf.status === 'USED' ? (
                          leaf.isCleared ? <span className="badge badge-emerald">✅ CAIR DI BANK</span> : <span className="badge badge-gold">⏳ MENUNGGU KLIRING</span>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        {leaf.status === 'AVAILABLE' && (
                          <button
                            className="btn-primary py-1 px-2 text-[0.7rem] bg-[rgba(239,68,68,0.2)] border border-danger text-danger"
                            onClick={() => handleVoidLeaf(book.id || book.bookNumber, leaf.checkNumber)}
                          >
                            <Ban size={12} /> Batalkan (Void)
                          </button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        );
      })}

      <Modal {...modalProps} />
    </div>
  );
}
