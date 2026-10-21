'use client';

import { useState } from 'react';
import {
  Ban,
  CreditCard,
  Filter,
  Lock,
  MoreHorizontal,
  Plus,
  Search,
} from 'lucide-react';

import { useLocalStorage, useToast } from '@/hooks';
import { formatCurrency, formatNumber } from '@/lib/number';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FormModal } from '@/components/ui/FormModal';
import { Input } from '@/components/ui/Input';
import { NumberInput } from '@/components/ui/NumberInput';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Typography } from '@/components/ui/Typography';

export interface ChequeLeaf {
  checkNumber: string;
  status: 'AVAILABLE' | 'USED' | 'VOID';
  voucherNo?: string;
  payee?: string;
  amount?: number;
  dueDate?: string;
  isCleared?: boolean;
}

export interface ChequeBook {
  id: string;
  bookNumber: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  currency: string;
  seriesPrefix: string;
  startNumber: number;
  endNumber: number;
  totalLeaves: number;
  maxLimitPerCheque: number;
  totalBookLimit: number;
  issuedDate: string;
  leaves: ChequeLeaf[];
}

const DEFAULT_CHEQUE_BOOKS: ChequeBook[] = [
  {
    id: 'BOOK-BCA-001',
    bookNumber: 'CHQ-BCA-2026-01',
    bankCode: 'BCA-001',
    bankName: 'Bank BCA (KCU Thamrin)',
    accountNumber: '889-012-3456',
    currency: 'IDR',
    seriesPrefix: 'BG-BCA-',
    startNumber: 1001,
    endNumber: 1025,
    totalLeaves: 25,
    maxLimitPerCheque: 500000000,
    totalBookLimit: 12500000000,
    issuedDate: '2026-08-01',
    leaves: Array.from({ length: 25 }, (_, i) => {
      const num = 1001 + i;
      if (num === 1001) {
        return {
          checkNumber: `BG-BCA-${num}`,
          status: 'USED',
          voucherNo: 'BCK-2026-0001',
          payee: 'PT Sinar Logam Mulia',
          amount: 350000000,
          dueDate: '2026-08-30',
          isCleared: false,
        };
      }
      if (num === 1002) {
        return {
          checkNumber: `BG-BCA-${num}`,
          status: 'USED',
          voucherNo: 'BCK-2026-0002',
          payee: 'CV Emas Sejahtera',
          amount: 220000000,
          dueDate: '2026-08-20',
          isCleared: true,
        };
      }
      return {
        checkNumber: `BG-BCA-${num}`,
        status: 'AVAILABLE',
        voucherNo: '-',
        payee: '-',
        amount: 0,
        dueDate: '-',
        isCleared: false,
      };
    }),
  },
];

export function MasterChequeView() {
  const toast = useToast();
  const [chequeBooks, setChequeBooks] = useLocalStorage<ChequeBook[]>(
    'pttan_cheque_books',
    DEFAULT_CHEQUE_BOOKS,
  );

  const [bankFilter, setBankFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const [newForm, setNewForm] = useState({
    bookNumber: `CHQ-BCA-${new Date().getFullYear()}-02`,
    bankName: 'Bank BCA (KCU Thamrin)',
    accountNumber: '889-012-3456',
    seriesPrefix: 'BG-BCA-',
    startNumber: 1026,
    endNumber: 1050,
    maxLimitPerCheque: 500000000,
  });

  const allLeaves = chequeBooks.flatMap((b) => b.leaves || []);
  const totalAvailable = allLeaves.filter((l) => l.status === 'AVAILABLE').length;
  const totalUsed = allLeaves.filter((l) => l.status === 'USED' && !l.isCleared).length;
  const totalCleared = allLeaves.filter((l) => l.status === 'USED' && l.isCleared).length;
  const totalVoid = allLeaves.filter((l) => l.status === 'VOID').length;

  function handleCreateBook() {
    const start = Number(newForm.startNumber);
    const end = Number(newForm.endNumber);

    if (end < start) {
      toast.warning('Rentang Nomor Tidak Valid: Nomor akhir cek harus lebih besar atau sama dengan nomor awal.');
      return;
    }

    const totalLeaves = end - start + 1;
    const generatedLeaves: ChequeLeaf[] = [];
    for (let i = start; i <= end; i++) {
      generatedLeaves.push({
        checkNumber: `${newForm.seriesPrefix}${i}`,
        status: 'AVAILABLE',
        voucherNo: '-',
        payee: '-',
        amount: 0,
        dueDate: '-',
        isCleared: false,
      });
    }

    const newBook: ChequeBook = {
      id: `BOOK-${Date.now()}`,
      bookNumber: newForm.bookNumber,
      bankCode: 'BCA-001',
      bankName: newForm.bankName,
      accountNumber: newForm.accountNumber,
      currency: 'IDR',
      seriesPrefix: newForm.seriesPrefix,
      startNumber: start,
      endNumber: end,
      totalLeaves,
      maxLimitPerCheque: Number(newForm.maxLimitPerCheque),
      totalBookLimit: totalLeaves * Number(newForm.maxLimitPerCheque),
      issuedDate: new Date().toISOString().slice(0, 10),
      leaves: generatedLeaves,
    };

    setChequeBooks([newBook, ...chequeBooks]);
    toast.success(`Buku Cek/BG (${newBook.bookNumber}) berhasil didaftarkan dengan ${totalLeaves} lembar.`);
    setShowAddModal(false);
  }

  function handleVoidLeaf(bookId: string, checkNumber: string) {
    const updated = chequeBooks.map((book) => {
      if (book.id === bookId || book.bookNumber === bookId) {
        return {
          ...book,
          leaves: book.leaves.map((leaf) =>
            leaf.checkNumber === checkNumber
              ? { ...leaf, status: 'VOID' as const }
              : leaf,
          ),
        };
      }
      return book;
    });

    setChequeBooks(updated);
    toast.success(`Lembar Cek ${checkNumber} berhasil dibatalkan (VOID).`);
  }

  const filteredBooks = chequeBooks.filter((book) => {
    if (bankFilter !== 'ALL' && book.bankName !== bankFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        book.bookNumber.toLowerCase().includes(q) ||
        book.bankName.toLowerCase().includes(q) ||
        book.leaves.some((l) => l.checkNumber.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <Typography variant="muted" className="text-xs">Total Buku Cek</Typography>
            <div className="text-foreground mt-1 text-2xl font-bold tabular-nums">
              {formatNumber(chequeBooks.length)}
            </div>
            <Typography variant="muted" className="text-[11px]">Buku teregistrasi</Typography>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <Typography variant="muted" className="text-xs">Siap Pakai</Typography>
            <div className="mt-1 text-2xl font-bold text-emerald-600 tabular-nums dark:text-emerald-400">
              {formatNumber(totalAvailable)}
            </div>
            <Typography variant="muted" className="text-[11px]">Lembar aktif</Typography>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <Typography variant="muted" className="text-xs">Menunggu Kliring</Typography>
            <div className="mt-1 text-2xl font-bold text-amber-600 tabular-nums dark:text-amber-400">
              {formatNumber(totalUsed)}
            </div>
            <Typography variant="muted" className="text-[11px]">Cek beredar (2115)</Typography>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <Typography variant="muted" className="text-xs">Cair di Bank</Typography>
            <div className="text-primary mt-1 text-2xl font-bold tabular-nums">
              {formatNumber(totalCleared)}
            </div>
            <Typography variant="muted" className="text-[11px]">Selesai kliring</Typography>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <Typography variant="muted" className="text-xs">Dibatalkan (Void)</Typography>
            <div className="text-destructive mt-1 text-2xl font-bold tabular-nums">
              {formatNumber(totalVoid)}
            </div>
            <Typography variant="muted" className="text-[11px]">Lembar rusak/batal</Typography>
          </CardContent>
        </Card>
      </div>

      {/* Filter & Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="text-foreground-subtle pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" aria-hidden="true" />
            <Input
              placeholder="Cari nomor buku, bank, atau seri cek…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="text-foreground-subtle h-4 w-4" aria-hidden="true" />
            <select
              className="border-input bg-background text-foreground rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={bankFilter}
              onChange={(e) => setBankFilter(e.target.value)}
            >
              <option value="ALL">Semua Bank Penerbit</option>
              <option value="Bank BCA (KCU Thamrin)">Bank BCA (KCU Thamrin)</option>
              <option value="Bank Mandiri (Cabang Jakarta)">Bank Mandiri</option>
              <option value="Bank CIMB Niaga">Bank CIMB Niaga</option>
            </select>
          </div>
        </div>

        <Button
          onClick={() => setShowAddModal(true)}
          leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
        >
          Daftarkan Buku Cek / BG Baru
        </Button>
      </div>

      {/* Cheque Books Register List */}
      <div className="space-y-6">
        {filteredBooks.length === 0 ? (
          <Card className="shadow-sm">
            <CardContent className="p-8 text-center">
              <Typography variant="muted">
                Belum ada buku cek atau bilyet giro yang sesuai dengan pencarian.
              </Typography>
            </CardContent>
          </Card>
        ) : (
          filteredBooks.map((book) => {
            const availableLeaves = book.leaves.filter((l) => l.status === 'AVAILABLE');
            const usedLeaves = book.leaves.filter((l) => l.status === 'USED');
            const voidLeaves = book.leaves.filter((l) => l.status === 'VOID');

            return (
              <Card key={book.id} className="shadow-sm">
                <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-border pb-4">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <CreditCard className="text-primary h-5 w-5" aria-hidden="true" />
                      {book.bookNumber} — {book.bankName}
                    </CardTitle>
                    <Typography variant="muted" className="text-xs">
                      No. Rekening: <strong className="text-foreground">{book.accountNumber}</strong> · Rentang Seri: <code className="font-mono text-xs">{book.seriesPrefix}{book.startNumber} s/d {book.seriesPrefix}{book.endNumber}</code>
                    </Typography>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="success" size="sm">
                      {formatNumber(availableLeaves.length)} Tersedia
                    </Badge>
                    <Badge variant="secondary" size="sm">
                      {formatNumber(usedLeaves.length)} Terpakai
                    </Badge>
                    {voidLeaves.length > 0 && (
                      <Badge variant="destructive" size="sm">
                        {formatNumber(voidLeaves.length)} Void
                      </Badge>
                    )}
                    <Badge variant="outline" size="sm">
                      <Lock className="mr-1 h-3 w-3 inline" aria-hidden="true" />
                      Maks / Lembar: {formatCurrency(book.maxLimitPerCheque)}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>No. Seri Lembar Cek / BG</TableHead>
                        <TableHead>Status Lembar</TableHead>
                        <TableHead>No. Voucher BBK/BCK</TableHead>
                        <TableHead>Penerima (Payee)</TableHead>
                        <TableHead className="text-right">Nominal Digunakan</TableHead>
                        <TableHead>Jatuh Tempo Kliring</TableHead>
                        <TableHead>Status Pencairan</TableHead>
                        <TableHead className="w-16 text-center">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {book.leaves.map((leaf, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono font-medium text-xs">
                            {leaf.checkNumber}
                          </TableCell>
                          <TableCell>
                            {leaf.status === 'AVAILABLE' && (
                              <Badge variant="success" size="sm" dot>Tersedia</Badge>
                            )}
                            {leaf.status === 'USED' && (
                              <Badge variant="warning" size="sm" dot>Terpakai</Badge>
                            )}
                            {leaf.status === 'VOID' && (
                              <Badge variant="destructive" size="sm" dot>Batal (Void)</Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-foreground-muted">
                            {leaf.voucherNo || '—'}
                          </TableCell>
                          <TableCell className="text-foreground-muted">
                            {leaf.payee || '—'}
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {leaf.amount && leaf.amount > 0 ? formatCurrency(leaf.amount) : '—'}
                          </TableCell>
                          <TableCell className="text-foreground-muted">
                            {leaf.dueDate || '—'}
                          </TableCell>
                          <TableCell>
                            {leaf.status === 'USED' ? (
                              leaf.isCleared ? (
                                <Badge variant="success" size="sm">Cair di Bank</Badge>
                              ) : (
                                <Badge variant="secondary" size="sm">Menunggu Kliring</Badge>
                              )
                            ) : (
                              '—'
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="h-8 w-8 p-0 text-foreground-muted hover:text-foreground hover:bg-surface-raised cursor-pointer mx-auto"
                                  aria-label={`Aksi untuk lembar ${leaf.checkNumber}`}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48 z-[1100]">
                                {leaf.status === 'AVAILABLE' ? (
                                  <DropdownMenuItem
                                    onClick={() => handleVoidLeaf(book.id, leaf.checkNumber)}
                                    className="flex items-center gap-2 text-destructive focus:text-destructive cursor-pointer"
                                  >
                                    <Ban className="h-4 w-4" />
                                    <span>Batalkan (Void)</span>
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem disabled>
                                    <span className="text-foreground-subtle text-xs">Tidak ada aksi</span>
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Modal Tambah Buku Cek Baru */}
      <FormModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        title="Daftarkan Buku Cek / Bilyet Giro Baru"
        description="Registrasi nomor seri lembar buku cek dari bank dan tentukan batas plafon per lembar."
        submitLabel="Simpan & Generate Lembar Cek"
        onSubmit={handleCreateBook}
      >
        <div className="space-y-4">
          <Input
            label="Nomor Registrasi Buku"
            required
            value={newForm.bookNumber}
            onChange={(e) => setNewForm({ ...newForm, bookNumber: e.target.value })}
            placeholder="mis. CHQ-BCA-2026-02"
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Bank Penerbit"
              required
              value={newForm.bankName}
              onChange={(e) => setNewForm({ ...newForm, bankName: e.target.value })}
            />
            <Input
              label="Nomor Rekening"
              required
              value={newForm.accountNumber}
              onChange={(e) => setNewForm({ ...newForm, accountNumber: e.target.value })}
            />
          </div>

          <Input
            label="Prefix Awalan Nomor Seri"
            required
            value={newForm.seriesPrefix}
            onChange={(e) => setNewForm({ ...newForm, seriesPrefix: e.target.value })}
            placeholder="mis. BG-BCA- atau CEK-MDR-"
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Nomor Lembar Awal"
              type="number"
              required
              value={String(newForm.startNumber)}
              onChange={(e) => setNewForm({ ...newForm, startNumber: Number(e.target.value) })}
            />
            <Input
              label="Nomor Lembar Akhir"
              type="number"
              required
              value={String(newForm.endNumber)}
              onChange={(e) => setNewForm({ ...newForm, endNumber: Number(e.target.value) })}
            />
          </div>

          <div className="border-warning/30 bg-warning/5 rounded-lg border p-3">
            <label className="text-warning text-xs font-semibold uppercase tracking-wider block mb-1">
              Batas Plafon Maksimal per Lembar Cek (IDR)
            </label>
            <NumberInput
              value={newForm.maxLimitPerCheque}
              onChange={(val) => setNewForm({ ...newForm, maxLimitPerCheque: val ?? 0 })}
              leftAddon={<span className="text-sm">Rp</span>}
            />
            <Typography variant="muted" className="mt-1 text-[11px]">
              Voucher kasir tidak dapat melampaui nominal batas ini saat memilih lembar cek terkait.
            </Typography>
          </div>
        </div>
      </FormModal>
    </div>
  );
}

MasterChequeView.displayName = 'MasterChequeView';
