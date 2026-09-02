import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  Search,
  Plus,
  CheckCircle2,
  ShieldCheck,
  Tag,
  FileSpreadsheet,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown
} from 'lucide-react';
import { getCOA, addCOAAccount, resetToDefaultCOA } from '../services/storageService';
import { formatCurrency } from '@/lib/number';
import {
  Modal,
  useModal,
  toast,
  CoaTable,
  CoaTableHeader,
  CoaTableBody,
  CoaTableRow,
  CoaTableHead,
  CoaTableCell,
  CoaTableEmpty
} from '../components/ui';

const DEFAULT_OPEN_UNTIL_LEVEL = 2;

const CATEGORY_TABS = [
  { id: 'all', label: 'Semua' },
  { id: 'aset', label: '1 - Aktiva' },
  { id: 'kewajiban', label: '2 - Passiva & Ekuitas' },
  { id: 'pendapatan', label: '3 - Pendapatan' },
  { id: 'beban', label: '4/5 - HPP & Beban' },
  { id: 'diluar_usaha', label: '6 - Di Luar Usaha' }
];

function getCategoryLabel(category, code) {
  const c = String(code || '');
  if (c.startsWith('1')) return 'Aset';
  if (c.startsWith('2')) return 'Kewajiban';
  if (c.startsWith('3')) return 'Ekuitas';
  if (c.startsWith('4')) return 'Pendapatan';
  if (c.startsWith('5')) return 'HPP & Beban';
  if (c.startsWith('6')) return 'Di Luar Usaha';

  const catMap = {
    aset: 'Aset',
    kewajiban: 'Kewajiban',
    ekuitas: 'Ekuitas',
    pendapatan: 'Pendapatan',
    beban: 'HPP & Beban',
    diluar_usaha: 'Di Luar Usaha',
    pendapatan_lain: 'Di Luar Usaha'
  };
  return catMap[category] || category || '-';
}

function getNormalBalance(category, code) {
  const c = String(code || '');
  if (c.startsWith('1') || c.startsWith('5')) return 'Debit';
  if (c.startsWith('2') || c.startsWith('3') || c.startsWith('4') || c.startsWith('6')) return 'Kredit';
  return 'Debit';
}

function buildCoaTree(rawAccounts) {
  const sorted = [...rawAccounts].sort((a, b) => (a.code || '').localeCompare(b.code || ''));
  const allCodes = new Set(sorted.map(a => a.code));

  function findParentCode(code) {
    const clean = String(code || '').replace(/[^0-9]/g, '');
    if (clean.length === 4 && clean.endsWith('000')) return null;

    for (let len = clean.length - 1; len >= 1; len--) {
      const prefix = clean.slice(0, len);
      if (allCodes.has(prefix)) return prefix;
      if (len < 4) {
        const padded = prefix.padEnd(4, '0');
        if (padded !== clean && allCodes.has(padded)) return padded;
      }
    }
    const classCode = clean.slice(0, 1) + '000';
    if (allCodes.has(classCode) && classCode !== clean) return classCode;
    return null;
  }

  const nodeMap = new Map();
  sorted.forEach(acc => {
    nodeMap.set(acc.code, {
      ...acc,
      parentId: findParentCode(acc.code),
      children: [],
      level: 1,
    });
  });

  const roots = [];
  nodeMap.forEach(node => {
    if (node.parentId && nodeMap.has(node.parentId)) {
      nodeMap.get(node.parentId).children.push(node);
    } else {
      roots.push(node);
    }
  });

  function assignLevel(node, depth) {
    node.level = depth;
    node.childCount = node.children.length;
    node.isHeader = node.type === 'header' || node.children.length > 0;
    node.children.forEach(child => assignLevel(child, depth + 1));
  }

  roots.forEach(r => assignLevel(r, 1));
  return roots;
}

function filterCoaTree(nodes, predicate) {
  return nodes.flatMap(node => {
    const filteredChildren = filterCoaTree(node.children, predicate);
    if (predicate(node) || filteredChildren.length > 0) {
      return [{
        ...node,
        children: filteredChildren,
        childCount: node.children.length
      }];
    }
    return [];
  });
}

export default function ChartOfAccounts() {
  const { modalProps, showModal } = useModal();
  const [accounts, setAccounts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showExportOnly, setShowExportOnly] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [overrides, setOverrides] = useState({});

  const [newAcc, setNewAcc] = useState({
    code: '',
    name: '',
    category: 'aset',
    type: 'detail'
  });

  const exportAccountCodes = useMemo(
    () => ['1125', '1132', '1135', '1157', '1158', '11502', '1160', '1152', '4110', '4120', '5114', '5115', '5118', '6110'],
    []
  );

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = () => {
    setAccounts(getCOA());
  };

  const handleReplaceWithExcelCOA = () => {
    showModal({
      variant: 'confirm',
      title: '⚠️ Ganti Seluruh Chart of Accounts',
      message: 'Seluruh COA aplikasi akan diganti dengan struktur resmi dari file "chart of account PT TAN.xlsx".\n\nAkun yang Anda tambahkan sendiri akan hilang. Lanjutkan?',
      confirmLabel: 'Ya, Ganti COA',
      onConfirm: replaceWithExcelCOA
    });
  };

  const replaceWithExcelCOA = async () => {
    const officialCoa = await resetToDefaultCOA();
    toast.success(`COA PT TAN berhasil di-replace dengan struktur resmi Excel (${officialCoa.length} akun).`);
    loadAccounts();
  };

  const handleAddAccount = async (e) => {
    e.preventDefault();
    if (!newAcc.code || !newAcc.name) {
      toast.warning('Kode akun dan nama akun wajib diisi.');
      return;
    }
    const res = await addCOAAccount({
      ...newAcc,
      balance: 0
    });
    if (res.success) {
      toast.success(`Akun ${newAcc.code} — ${newAcc.name} berhasil ditambahkan ke COA PT TAN.`);
      loadAccounts();
      setShowAddForm(false);
      setNewAcc({ code: '', name: '', category: 'aset', type: 'detail' });
    } else {
      toast.error(String(res.error));
    }
  };

  // Full tree
  const tree = useMemo(() => buildCoaTree(accounts), [accounts]);

  const isFiltered = searchQuery.trim() !== '' || selectedCategory !== 'all' || showExportOnly;

  // Filtered tree
  const filteredTree = useMemo(() => {
    if (!isFiltered) return tree;

    const q = searchQuery.toLowerCase().trim();

    const matchesSearch = (acc) => {
      if (!q) return true;
      return (
        (acc.code || '').toLowerCase().includes(q) ||
        (acc.name || '').toLowerCase().includes(q)
      );
    };

    const matchesCategory = (acc) => {
      if (selectedCategory === 'all') return true;
      const c = String(acc.code || '');
      if (selectedCategory === 'aset') return c.startsWith('1') || acc.category === 'aset';
      if (selectedCategory === 'kewajiban') return c.startsWith('2') || c.startsWith('3') || acc.category === 'kewajiban' || acc.category === 'ekuitas';
      if (selectedCategory === 'pendapatan') return c.startsWith('4') || acc.category === 'pendapatan';
      if (selectedCategory === 'beban') return c.startsWith('5') || acc.category === 'beban';
      if (selectedCategory === 'diluar_usaha') return c.startsWith('6') || acc.category === 'diluar_usaha' || acc.category === 'pendapatan_lain';
      return true;
    };

    const matchesExport = (acc) => {
      if (!showExportOnly) return true;
      return exportAccountCodes.includes(acc.code);
    };

    const predicate = (acc) => matchesSearch(acc) && matchesCategory(acc) && matchesExport(acc);
    return filterCoaTree(tree, predicate);
  }, [tree, isFiltered, searchQuery, selectedCategory, showExportOnly, exportAccountCodes]);

  // Expansion key tracking
  const nextExpansionKey = `${searchQuery}_${selectedCategory}_${showExportOnly}`;
  const [expansionKey, setExpansionKey] = useState(nextExpansionKey);
  if (expansionKey !== nextExpansionKey) {
    setExpansionKey(nextExpansionKey);
    setOverrides({});
  }

  const isOpen = (node) =>
    overrides[node.code] ?? (isFiltered || node.level <= DEFAULT_OPEN_UNTIL_LEVEL);

  const toggle = (node) =>
    setOverrides(prev => ({ ...prev, [node.code]: !isOpen(node) }));

  const handleExpandAll = () => {
    const next = {};
    function mark(nodes) {
      nodes.forEach(n => {
        if (n.children && n.children.length > 0) {
          next[n.code] = true;
          mark(n.children);
        }
      });
    }
    mark(filteredTree);
    setOverrides(next);
  };

  const handleCollapseAll = () => {
    const next = {};
    function mark(nodes) {
      nodes.forEach(n => {
        if (n.children && n.children.length > 0) {
          next[n.code] = false;
          mark(n.children);
        }
      });
    }
    mark(filteredTree);
    setOverrides(next);
  };

  function visibleRows(nodes) {
    return nodes.flatMap(node =>
      isOpen(node) ? [node, ...visibleRows(node.children)] : [node]
    );
  }

  const rows = visibleRows(filteredTree);

  return (
    <div className="space-y-6">
      {/* Header & Control Bar */}
      <div className="glass-panel p-6">
        <div className="flex justify-between items-center flex-wrap gap-4 mb-5">
          <div>
            <h2 className="font-heading text-[1.3rem] flex items-center gap-2.5">
              <BookOpen className="text-primary" size={24} /> Setting Chart of Accounts (COA Resmi PT TAN)
            </h2>
            <p className="text-[0.8rem] text-foreground-muted">
              Struktur Kode Akun Resmi PT TAN (Sesuai File Excel &quot;chart of account PT TAN.xlsx&quot;)
            </p>
          </div>

          <div className="flex gap-3 flex-wrap">
            <button
              type="button"
              className="btn-primary bg-linear-to-r from-sky-600 to-sky-700 text-white cursor-pointer"
              onClick={handleReplaceWithExcelCOA}
            >
              <FileSpreadsheet size={18} /> Replace COA Dari Excel PT TAN
            </button>

            <button
              type="button"
              className={`btn-primary text-white cursor-pointer ${
                showExportOnly
                  ? 'bg-linear-to-r from-emerald-600 to-emerald-700'
                  : 'bg-white/[0.08]'
              }`}
              onClick={() => setShowExportOnly(!showExportOnly)}
            >
              <ShieldCheck size={18} />
              {showExportOnly ? 'Tampilkan Semua Akun' : 'Filter Akun Ekspor PT TAN Only'}
            </button>

            <button
              type="button"
              className="btn-primary cursor-pointer"
              onClick={() => setShowAddForm(!showAddForm)}
            >
              <Plus size={18} /> Tambah Akun Baru
            </button>
          </div>
        </div>

        {/* Add Form Collapsible */}
        {showAddForm && (
          <form className="bg-field p-5 rounded-[12px] mb-5 border border-primary/40" onSubmit={handleAddAccount}>
            <h4 className="text-primary mb-3.5 text-[0.95rem] font-semibold">➕ Form Tambah Akun COA Baru</h4>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Kode Akun (misal 1113-3)</label>
                <input
                  className="form-input"
                  placeholder="Kode akun..."
                  value={newAcc.code}
                  onChange={e => setNewAcc({ ...newAcc, code: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Nama Akun Keuangan</label>
                <input
                  className="form-input"
                  placeholder="Nama akun..."
                  value={newAcc.name}
                  onChange={e => setNewAcc({ ...newAcc, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Kategori</label>
                <select
                  className="form-select"
                  value={newAcc.category}
                  onChange={e => setNewAcc({ ...newAcc, category: e.target.value })}
                >
                  <option value="aset">Aset (1xxx)</option>
                  <option value="kewajiban">Kewajiban (2xxx)</option>
                  <option value="ekuitas">Ekuitas (3xxx)</option>
                  <option value="pendapatan">Pendapatan (4xxx)</option>
                  <option value="beban">Beban / HPP (5xxx)</option>
                  <option value="diluar_usaha">Di Luar Usaha (6xxx)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Tipe Akun</label>
                <select
                  className="form-select"
                  value={newAcc.type}
                  onChange={e => setNewAcc({ ...newAcc, type: e.target.value })}
                >
                  <option value="detail">Detail (Bisa Di-jurnal)</option>
                  <option value="header">Header (Judul Kelompok)</option>
                </select>
              </div>
            </div>
            <button type="submit" className="btn-primary mt-3 cursor-pointer">
              <CheckCircle2 size={16} /> Simpan Akun Ke COA
            </button>
          </form>
        )}

        {/* Search & Category Filter Tabs */}
        <div className="flex gap-4 flex-wrap items-center justify-between">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-subtle" size={18} />
            <input
              className="form-input pl-9.5 w-full"
              placeholder="Cari kode atau nama akun..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExpandAll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border text-foreground-muted hover:text-foreground hover:bg-surface-raised transition-colors cursor-pointer"
              title="Buka semua tingkatan akun"
            >
              <ChevronsUpDown size={14} /> Buka Semua
            </button>
            <button
              type="button"
              onClick={handleCollapseAll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border text-foreground-muted hover:text-foreground hover:bg-surface-raised transition-colors cursor-pointer"
              title="Tutup tingkatan akun ke tingkat utama"
            >
              <ChevronsUpDown size={14} /> Tutup Semua
            </button>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 w-full sm:w-auto">
            {CATEGORY_TABS.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedCategory(tab.id)}
                className={`cursor-pointer whitespace-nowrap rounded-sm border border-line px-3.5 py-2 text-[0.8rem] transition-colors ${
                  selectedCategory === tab.id
                    ? 'bg-primary/20 font-semibold text-primary'
                    : 'bg-transparent font-normal text-foreground-muted hover:bg-white/[0.04]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* COA Tree Table (Tan-ERP style) */}
      <div className="glass-panel p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-heading text-[1.1rem]">
            📋 Bagan Akun Keuangan ({rows.length} akun ditampilkan / total {accounts.length})
          </h3>
          {showExportOnly && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">
              <Tag size={12} /> Menampilkan Akun Ekspor PT TAN
            </span>
          )}
        </div>

        {/* Tan-ERP Table Container */}
        <div className="rounded-lg border border-border overflow-hidden">
          <CoaTable>
            <CoaTableHeader>
              <CoaTableRow>
                <CoaTableHead className="w-32">Kode</CoaTableHead>
                <CoaTableHead>Nama Akun Keuangan</CoaTableHead>
                <CoaTableHead className="w-36">Kategori SAK</CoaTableHead>
                <CoaTableHead className="w-28">Saldo Normal</CoaTableHead>
                <CoaTableHead className="w-44 text-right">Saldo Terkini (IDR)</CoaTableHead>
                <CoaTableHead className="w-36 text-center">Penanda</CoaTableHead>
              </CoaTableRow>
            </CoaTableHeader>
            <CoaTableBody>
              {rows.length === 0 ? (
                <CoaTableEmpty colSpan={6} message="Tidak ada akun yang sesuai dengan pencarian atau filter." />
              ) : (
                rows.map(acc => {
                  const expandable = acc.children && acc.children.length > 0;
                  const open = expandable && isOpen(acc);
                  const isExportAccount = exportAccountCodes.includes(acc.code);

                  return (
                    <CoaTableRow
                      key={acc.code}
                      className={acc.isHeader ? 'bg-white/[0.02]' : undefined}
                    >
                      <CoaTableCell className="font-mono text-sm tabular-nums">
                        <strong className={acc.isHeader ? 'text-primary font-semibold' : 'font-normal text-foreground'}>
                          {acc.code}
                        </strong>
                      </CoaTableCell>

                      <CoaTableCell>
                        <div
                          className="flex items-center gap-2"
                          style={{ paddingLeft: `${(acc.level - 1) * 20}px` }}
                        >
                          {expandable ? (
                            <button
                              type="button"
                              onClick={() => toggle(acc)}
                              aria-expanded={open}
                              aria-label={`${open ? 'Tutup' : 'Buka'} ${acc.name}`}
                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-foreground-subtle transition-colors hover:bg-primary-subtle hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none cursor-pointer"
                            >
                              {open ? (
                                <ChevronDown className="h-4 w-4" aria-hidden="true" />
                              ) : (
                                <ChevronRight className="h-4 w-4" aria-hidden="true" />
                              )}
                            </button>
                          ) : (
                            <span className="h-5 w-5 shrink-0" aria-hidden="true" />
                          )}

                          <span
                            className={
                              acc.isHeader
                                ? 'font-semibold text-foreground'
                                : 'font-normal text-foreground'
                            }
                          >
                            {acc.name}
                          </span>

                          {expandable && (
                            <span className="inline-flex items-center rounded-full bg-surface-raised px-2 py-0.5 text-xs text-foreground-muted border border-border">
                              {acc.childCount} akun
                            </span>
                          )}
                          {isExportAccount && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-brand-subtle px-2 py-0.5 text-xs font-medium text-brand border border-brand/35">
                              <ShieldCheck className="h-3 w-3" /> TAN
                            </span>
                          )}
                        </div>
                      </CoaTableCell>

                      <CoaTableCell className="text-foreground-muted">
                        {getCategoryLabel(acc.category, acc.code)}
                      </CoaTableCell>

                      <CoaTableCell className="text-foreground-muted">
                        {getNormalBalance(acc.category, acc.code)}
                      </CoaTableCell>

                      <CoaTableCell className="text-right font-medium tabular-nums text-foreground">
                        {formatCurrency(acc.balance || 0)}
                      </CoaTableCell>

                      <CoaTableCell className="text-center">
                        {isExportAccount ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">
                            <ShieldCheck className="h-3 w-3" /> PT TAN Dedicated
                          </span>
                        ) : (
                          <span className="text-foreground-subtle text-xs">PT TAN Excel</span>
                        )}
                      </CoaTableCell>
                    </CoaTableRow>
                  );
                })
              )}
            </CoaTableBody>
          </CoaTable>
        </div>
      </div>

      <Modal {...modalProps} />
    </div>
  );
}
