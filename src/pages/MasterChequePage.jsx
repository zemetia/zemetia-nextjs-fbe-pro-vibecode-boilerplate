import React, { useState, useEffect } from 'react';
import { CreditCard, Plus, CheckCircle, AlertTriangle, ShieldCheck, Filter, Search, Ban, Clock, CheckSquare, Layers, Lock, BookOpen } from 'lucide-react';

export default function MasterChequePage() {
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
    if (typeof window !== 'undefined' && window.Storage) {
      const stored = window.Storage.get('pttan_cheque_books') || [
        {
          id: 'BOOK-BCA-2026A',
          bookNumber: 'BOOK-BCA-2026A',
          bankCode: 'BCA-001',
          bankName: 'Bank BCA (KCU Thamrin)',
          accountNumber: '889-012-3456',
          currency: 'IDR',
          seriesPrefix: 'BG-BCA-',
          startNumber: 998801,
          endNumber: 998825,
          totalLeaves: 25,
          maxLimitPerCheque: 500000000,
          totalBookLimit: 5000000000,
          issuedDate: '2026-08-01',
          leaves: [
            { checkNumber: 'BG-BCA-998801', status: 'USED', voucherNo: 'BCK-000101', payee: 'PT Antam Tbk', amount: 150000000, dueDate: '2026-08-15', isCleared: true },
            { checkNumber: 'BG-BCA-998802', status: 'USED', voucherNo: 'BCK-000102', payee: 'Pegadaian Jakarta', amount: 350000000, dueDate: '2026-08-20', isCleared: false },
            { checkNumber: 'BG-BCA-998803', status: 'VOID', voucherNo: '-', payee: '-', amount: 0, dueDate: '-', isCleared: false, notes: 'Salah Tulis / Batal' },
            { checkNumber: 'BG-BCA-998804', status: 'AVAILABLE', voucherNo: '-', payee: '-', amount: 0, dueDate: '-', isCleared: false },
            { checkNumber: 'BG-BCA-998805', status: 'AVAILABLE', voucherNo: '-', payee: '-', amount: 0, dueDate: '-', isCleared: false },
            { checkNumber: 'BG-BCA-998806', status: 'AVAILABLE', voucherNo: '-', payee: '-', amount: 0, dueDate: '-', isCleared: false },
            { checkNumber: 'BG-BCA-998807', status: 'AVAILABLE', voucherNo: '-', payee: '-', amount: 0, dueDate: '-', isCleared: false },
            { checkNumber: 'BG-BCA-998808', status: 'AVAILABLE', voucherNo: '-', payee: '-', amount: 0, dueDate: '-', isCleared: false },
            { checkNumber: 'BG-BCA-998809', status: 'AVAILABLE', voucherNo: '-', payee: '-', amount: 0, dueDate: '-', isCleared: false },
            { checkNumber: 'BG-BCA-998810', status: 'AVAILABLE', voucherNo: '-', payee: '-', amount: 0, dueDate: '-', isCleared: false }
          ]
        },
        {
          id: 'BOOK-MANDIRI-2026A',
          bookNumber: 'BOOK-MANDIRI-2026A',
          bankCode: 'MANDIRI-001',
          bankName: 'Bank Mandiri (Cabang Jakarta)',
          accountNumber: '123-00-9988776-5',
          currency: 'IDR',
          seriesPrefix: 'CEK-MDR-',
          startNumber: 445501,
          endNumber: 445525,
          totalLeaves: 25,
          maxLimitPerCheque: 300000000, // Rp 300 Juta
          totalBookLimit: 3000000000,
          issuedDate: '2026-08-05',
          leaves: [
            { checkNumber: 'CEK-MDR-445501', status: 'USED', voucherNo: 'BCK-000201', payee: 'Toko Emas Mulia', amount: 200000000, dueDate: '2026-08-18', isCleared: false },
            { checkNumber: 'CEK-MDR-445502', status: 'AVAILABLE', voucherNo: '-', payee: '-', amount: 0, dueDate: '-', isCleared: false },
            { checkNumber: 'CEK-MDR-445503', status: 'AVAILABLE', voucherNo: '-', payee: '-', amount: 0, dueDate: '-', isCleared: false },
            { checkNumber: 'CEK-MDR-445504', status: 'AVAILABLE', voucherNo: '-', payee: '-', amount: 0, dueDate: '-', isCleared: false }
          ]
        }
      ];
      setChequeBooks(stored);
      window.Storage.set('pttan_cheque_books', stored);
    }
  };

  // Tambah Master Buku Cek Baru
  const handleCreateBook = (e) => {
    e.preventDefault();
    const start = Number(newBookForm.startNumber);
    const end = Number(newBookForm.endNumber);

    if (end < start) {
      alert('Nomor akhir cek harus lebih besar atau sama dengan nomor awal.');
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

    if (typeof window !== 'undefined' && window.Storage) {
      const list = window.Storage.get('pttan_cheque_books') || [];
      list.unshift(newBook);
      window.Storage.set('pttan_cheque_books', list);
      alert(`✅ Master Buku Cek/BG (${newBook.bookNumber}) Berhasil Didaftarkan!\n• Jumlah Lembar: ${totalLeaves} Lembar\n• Plafon Maks per Lembar: Rp ${newBook.maxLimitPerCheque.toLocaleString()}`);
      loadChequeData();
      setShowAddBookModal(false);
    }
  };

  // Batalkan Lembar Cek (Void)
  const handleVoidLeaf = (bookId, checkNumber) => {
    if (!confirm(`Yakin ingin MEMBATALKAN (VOID) nomor lembar cek ${checkNumber}? Lembar ini tidak akan bisa digunakan lagi untuk transaksi.`)) {
      return;
    }

    if (typeof window !== 'undefined' && window.Storage) {
      const list = window.Storage.get('pttan_cheque_books') || [];
      const updated = list.map(b => {
        if (b.id === bookId || b.bookNumber === bookId) {
          return {
            ...b,
            leaves: b.leaves.map(l => l.checkNumber === checkNumber ? { ...l, status: 'VOID', notes: 'Dibatalkan / Rusak' } : l)
          };
        }
        return b;
      });
      window.Storage.set('pttan_cheque_books', updated);
      alert(`🚫 Lembar Cek ${checkNumber} Berhasil Dibatalkan (VOID).`);
      loadChequeData();
    }
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
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <BookOpen color="#f59e0b" size={24} /> Master Buku Cek / Bilyet Giro & Kontrol Plafon Bank
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Registrasi Buku Cek/BG Bank, Pembatasan Plafon Maksimal per Lembar Cek, & Pelacakan Lembar Siap Pakai
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn-primary" onClick={() => setShowAddBookModal(!showAddBookModal)}>
              <Plus size={16} /> Daftarkan Buku Cek / BG Baru
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={16} color="var(--text-muted)" />
            <select
              className="form-select"
              style={{ maxWidth: '240px' }}
              value={selectedBankFilter}
              onChange={e => setSelectedBankFilter(e.target.value)}
            >
              <option value="ALL">Semua Bank Penerbit</option>
              <option value="Bank BCA (KCU Thamrin)">Bank BCA (KCU Thamrin)</option>
              <option value="Bank Mandiri (Cabang Jakarta)">Bank Mandiri</option>
              <option value="Bank CIMB Niaga">Bank CIMB Niaga</option>
            </select>
          </div>

          <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
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
          <form onSubmit={handleCreateBook} style={{ background: 'rgba(15, 23, 42, 0.8)', padding: '20px', borderRadius: '12px', marginTop: '20px', border: '1px solid var(--accent-gold)' }}>
            <h4 style={{ color: '#fbbf24', marginBottom: '14px', fontSize: '0.95rem' }}>➕ Daftarkan Buku Cek / Bilyet Giro Baru dari Bank</h4>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">No. Registrasi Buku</label>
                <input
                  className="form-input"
                  style={{ fontWeight: 700, color: '#fbbf24' }}
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
              <div className="form-group" style={{ background: 'rgba(245,158,11,0.1)', padding: '10px', borderRadius: '8px', border: '1px solid #f59e0b' }}>
                <label className="form-label" style={{ color: '#fbbf24', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Lock size={15} /> Batas Plafon Maksimal per Lembar Cek (IDR)
                </label>
                <input
                  type="number"
                  className="form-input"
                  style={{ border: '1px solid #f59e0b', color: '#fbbf24', fontWeight: 800, fontSize: '1.05rem' }}
                  value={newBookForm.maxLimitPerCheque}
                  onChange={e => setNewBookForm({ ...newBookForm, maxLimitPerCheque: Number(e.target.value) })}
                />
                <small style={{ color: 'var(--text-muted)' }}>User tidak dapat menginput nominal melebihi batas ini saat menerbitkan voucher.</small>
              </div>
            </div>

            <button type="submit" className="btn-primary" style={{ marginTop: '12px' }}>
              <CheckCircle size={16} /> Simpan & Generate Seluruh Lembar Cek
            </button>
          </form>
        )}
      </div>

      {/* Books and Leaf Register */}
      {filteredBooks.map(book => {
        const availableLeaves = (book.leaves || []).filter(l => l.status === 'AVAILABLE');
        const usedLeaves = (book.leaves || []).filter(l => l.status === 'USED');
        const voidLeaves = (book.leaves || []).filter(l => l.status === 'VOID');

        return (
          <div key={book.id || book.bookNumber} className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px' }}>
              <div>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.15rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CreditCard size={20} /> {book.bookNumber} — {book.bankName}
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Rekening: <strong>{book.accountNumber || '889-012-3456'}</strong> | Seri: <code>{book.seriesPrefix}{book.startNumber} s/d {book.seriesPrefix}{book.endNumber}</code>
                </p>
              </div>

              {/* Status Chips */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <span className="badge badge-emerald" style={{ fontSize: '0.8rem' }}>
                  🟢 Tersedia: {availableLeaves.length} Lembar
                </span>
                <span className="badge badge-gold" style={{ fontSize: '0.8rem' }}>
                  ⏳ Terpakai: {usedLeaves.length} Lembar
                </span>
                <span className="badge badge-rose" style={{ fontSize: '0.8rem' }}>
                  🚫 Batal (Void): {voidLeaves.length} Lembar
                </span>
                <span className="badge badge-blue" style={{ fontSize: '0.8rem', background: 'rgba(56,189,248,0.15)', border: '1px solid #38bdf8', color: '#38bdf8' }}>
                  <Lock size={12} style={{ display: 'inline', marginRight: '4px' }} /> Maks / Lembar: Rp {Number(book.maxLimitPerCheque || 500000000).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Table of Leaves */}
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>No. Seri Lembar Cek/BG</th>
                    <th>Status Lembar</th>
                    <th>No. Voucher Terkait</th>
                    <th>Penerima (Payee)</th>
                    <th style={{ textAlign: 'right' }}>Nominal Digunakan</th>
                    <th>Jatuh Tempo Kliring</th>
                    <th>Status Pencairan</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {(book.leaves || []).map((leaf, idx) => (
                    <tr key={idx}>
                      <td>
                        <strong style={{ color: leaf.status === 'AVAILABLE' ? '#34d399' : leaf.status === 'VOID' ? '#ef4444' : '#fbbf24' }}>
                          {leaf.checkNumber}
                        </strong>
                      </td>
                      <td>
                        {leaf.status === 'AVAILABLE' && <span className="badge badge-emerald">🟢 TERSEDIA (SIAP PAKAI)</span>}
                        {leaf.status === 'USED' && <span className="badge badge-gold">⏳ TERPAKAI (DIKELUARKAN)</span>}
                        {leaf.status === 'VOID' && <span className="badge badge-rose">🚫 BATAL (VOID)</span>}
                      </td>
                      <td>{leaf.voucherNo || '-'}</td>
                      <td>{leaf.payee || '-'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: leaf.amount > 0 ? '#34d399' : 'var(--text-muted)' }}>
                        {leaf.amount > 0 ? `Rp ${leaf.amount.toLocaleString()}` : '-'}
                      </td>
                      <td>{leaf.dueDate || '-'}</td>
                      <td>
                        {leaf.status === 'USED' ? (
                          leaf.isCleared ? <span className="badge badge-emerald">✅ CAIR DI BANK</span> : <span className="badge badge-gold">⏳ MENUNGGU KLIRING</span>
                        ) : '-'}
                      </td>
                      <td>
                        {leaf.status === 'AVAILABLE' && (
                          <button
                            className="btn-primary"
                            style={{ padding: '4px 8px', fontSize: '0.7rem', background: 'rgba(239,68,68,0.2)', border: '1px solid #ef4444', color: '#ef4444' }}
                            onClick={() => handleVoidLeaf(book.id || book.bookNumber, leaf.checkNumber)}
                          >
                            <Ban size={12} /> Batalkan (Void)
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
