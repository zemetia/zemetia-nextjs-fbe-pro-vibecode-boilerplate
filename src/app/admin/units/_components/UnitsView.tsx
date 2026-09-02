'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Scale,
  ArrowRightLeft,
  Sparkles,
  Layers,
  HelpCircle,
  Plus,
  CheckCircle2,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { toast } from 'sonner';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  NumberInput,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui';
import { convertUnits, getConversionBreakdown, type UnitConversionParams } from '@/lib/unit-conversion';
import { unitService } from '@/services/unit.service';
import type { UnitCategoryVO } from '@/types/value-objects';

export function UnitsView() {
  const queryClient = useQueryClient();

  // Load categories and their units
  const { data: categories = [], isLoading } = useQuery<UnitCategoryVO[]>({
    queryKey: ['unit-categories'],
    queryFn: () => unitService.listCategories(),
  });

  const [activeCategoryCode, setActiveCategoryCode] = useState<string>('WEIGHT');

  // Interactive Calculator state
  const [calcCategoryCode, setCalcCategoryCode] = useState<string>('WEIGHT');
  const [calcAmount, setCalcAmount] = useState<number>(1);
  const [calcFromCode, setCalcFromCode] = useState<string>('CG');
  const [calcToCode, setCalcToCode] = useState<string>('KG');

  // New Unit Dialog state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newSymbol, setNewSymbol] = useState('');
  const [newFactor, setNewFactor] = useState<number>(1);
  const [newIsAnchor, setNewIsAnchor] = useState(false);
  const [newNotes, setNewNotes] = useState('');

  // Active category in the tabs
  const currentCategory = useMemo(() => {
    return categories.find((c) => c.code === activeCategoryCode) ?? categories[0];
  }, [categories, activeCategoryCode]);

  // Active category in the calculator
  const currentCalcCategory = useMemo(() => {
    return categories.find((c) => c.code === calcCategoryCode) ?? categories[0];
  }, [categories, calcCategoryCode]);

  // Current units for calculator
  const calcUnits = useMemo(() => {
    return currentCalcCategory?.units ?? [];
  }, [currentCalcCategory]);

  const anchorUnit = useMemo(() => {
    return currentCalcCategory?.units.find((u) => u.isAnchor);
  }, [currentCalcCategory]);

  // Find from and to units
  const selectedFromUnit = useMemo(() => {
    return calcUnits.find((u) => u.code === calcFromCode) ?? calcUnits[0];
  }, [calcUnits, calcFromCode]);

  const selectedToUnit = useMemo(() => {
    return calcUnits.find((u) => u.code === calcToCode) ?? calcUnits[1] ?? calcUnits[0];
  }, [calcUnits, calcToCode]);

  // Perform client-side conversion for instant feedback
  const conversionResult = useMemo(() => {
    if (!selectedFromUnit || !selectedToUnit || !anchorUnit) return null;

    const fromParams: UnitConversionParams = {
      code: selectedFromUnit.code,
      name: selectedFromUnit.name,
      symbol: selectedFromUnit.symbol,
      categoryCode: selectedFromUnit.categoryCode,
      isAnchor: selectedFromUnit.isAnchor,
      conversionFactor: selectedFromUnit.conversionFactor,
    };

    const toParams: UnitConversionParams = {
      code: selectedToUnit.code,
      name: selectedToUnit.name,
      symbol: selectedToUnit.symbol,
      categoryCode: selectedToUnit.categoryCode,
      isAnchor: selectedToUnit.isAnchor,
      conversionFactor: selectedToUnit.conversionFactor,
    };

    const anchorParams: UnitConversionParams = {
      code: anchorUnit.code,
      name: anchorUnit.name,
      symbol: anchorUnit.symbol,
      categoryCode: anchorUnit.categoryCode,
      isAnchor: anchorUnit.isAnchor,
      conversionFactor: anchorUnit.conversionFactor,
    };

    try {
      const breakdown = getConversionBreakdown(calcAmount, fromParams, toParams, anchorParams, 8);
      const converted = convertUnits(calcAmount, fromParams, toParams, 8);
      return { ...breakdown, converted };
    } catch {
      return null;
    }
  }, [calcAmount, selectedFromUnit, selectedToUnit, anchorUnit]);

  // Swap From and To units
  const handleSwapUnits = () => {
    const prevFrom = selectedFromUnit?.code ?? '';
    const prevTo = selectedToUnit?.code ?? '';
    setCalcFromCode(prevTo);
    setCalcToCode(prevFrom);
  };

  // Switch calculator category
  const handleCalcCategoryChange = (catCode: string) => {
    setCalcCategoryCode(catCode);
    const cat = categories.find((c) => c.code === catCode);
    if (cat && cat.units.length > 0) {
      if (catCode === 'WEIGHT') {
        setCalcFromCode('CG');
        setCalcToCode('KG');
      } else {
        const anchor = cat.units.find((u) => u.isAnchor) ?? cat.units[0];
        const second = cat.units.find((u) => !u.isAnchor) ?? cat.units[0];
        if (second && anchor) {
          setCalcFromCode(second.code);
          setCalcToCode(anchor.code);
        }
      }
    }
  };

  // Add unit mutation
  const addUnitMutation = useMutation({
    mutationFn: async () => {
      if (!currentCategory) throw new Error('Kategori tidak dipilih');
      return unitService.createUnit({
        code: newCode.trim().toUpperCase(),
        name: newName.trim(),
        symbol: newSymbol.trim(),
        category_id: currentCategory.id,
        is_anchor: newIsAnchor,
        conversion_factor: newFactor,
        notes: newNotes.trim() || undefined,
      });
    },
    onSuccess: (created) => {
      toast.success(`Satuan ${created.name} (${created.symbol}) berhasil ditambahkan!`);
      setIsAddOpen(false);
      setNewCode('');
      setNewName('');
      setNewSymbol('');
      setNewFactor(1);
      setNewIsAnchor(false);
      setNewNotes('');
      void queryClient.invalidateQueries({ queryKey: ['unit-categories'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Gagal menambahkan satuan baru';
      toast.error(msg);
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-fg-primary">
              Master Satuan & Konversi
            </h1>
            <Badge variant="outline" className="border-gold/30 text-gold bg-gold/5 font-semibold">
              Multi-Anchor Engine
            </Badge>
          </div>
          <p className="text-sm text-fg-soft mt-1">
            Standarisasi tipe satuan (Berat, Kuantitas, Volume, Panjang) dengan basis Anchor terpusat untuk akurasi transaksi ERP.
          </p>
        </div>

        <Button
          onClick={() => setIsAddOpen(true)}
          className="bg-gold text-canvas hover:bg-gold/90 font-medium flex items-center gap-2 shadow-sm"
        >
          <Plus className="h-4 w-4" />
          <span>Tambah Satuan</span>
        </Button>
      </div>

      {/* KPI Top Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {categories.map((cat) => {
          const anchor = cat.units.find((u) => u.isAnchor);
          return (
            <Card key={cat.id} className="border-line/60 bg-surface/40 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
                    {cat.code}
                  </span>
                  <Scale className="h-4 w-4 text-gold/70" />
                </div>
                <CardTitle className="text-base font-semibold text-fg-primary">
                  {cat.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between text-xs mt-1">
                  <span className="text-fg-soft">Satuan Anchor:</span>
                  <Badge variant="outline" className="border-gold/30 text-gold bg-gold/10 font-bold px-2 py-0.5">
                    ⭐ {anchor?.name ?? '—'} ({anchor?.symbol ?? '—'})
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs mt-2 text-fg-muted">
                  <span>Terdaftar:</span>
                  <span>{cat.units.length} satuan</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Interactive Converter Widget */}
      <Card className="border-gold/30 bg-surface/50 backdrop-blur-md shadow-lg overflow-hidden">
        <div className="border-b border-gold/20 bg-gold/[0.04] px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-gold" />
              <h2 className="text-base font-semibold text-gold">
                Kalkulator Konversi Satuan Interaktif (Live Multi-Anchor)
              </h2>
            </div>
            <span className="text-xs text-fg-muted">
              Presisi Floating Point Tinggi SAK EMKM
            </span>
          </div>
        </div>

        <CardContent className="p-6 space-y-6">
          {/* Controls Bar */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-12 items-end">
            {/* Category Select */}
            <div className="md:col-span-3 space-y-1.5">
              <Label className="text-xs font-medium text-fg-soft">Tipe Satuan</Label>
              <Select
                value={calcCategoryCode}
                onChange={(e) => handleCalcCategoryChange(e.target.value)}
                className="w-full bg-field border-line focus:border-gold"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>

            {/* Amount Input */}
            <div className="md:col-span-3 space-y-1.5">
              <Label className="text-xs font-medium text-fg-soft">Nilai Angka</Label>
              <NumberInput
                value={calcAmount}
                onChange={(val) => setCalcAmount(val ?? 0)}
                decimalScale={8}
                className="w-full bg-field border-line focus:border-gold font-mono text-base"
                placeholder="Masukkan nilai..."
              />
            </div>

            {/* From Unit */}
            <div className="md:col-span-2 space-y-1.5">
              <Label className="text-xs font-medium text-fg-soft">Dari Satuan</Label>
              <Select
                value={selectedFromUnit?.code ?? ''}
                onChange={(e) => setCalcFromCode(e.target.value)}
                className="w-full bg-field border-line focus:border-gold"
              >
                {calcUnits.map((u) => (
                  <option key={u.id} value={u.code}>
                    {u.symbol} — {u.name} {u.isAnchor ? '⭐ (Anchor)' : ''}
                  </option>
                ))}
              </Select>
            </div>

            {/* Swap Button */}
            <div className="md:col-span-1 flex justify-center pb-0.5">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleSwapUnits}
                className="h-10 w-10 border-line hover:border-gold hover:text-gold"
                title="Tukar Satuan Asal dan Tujuan"
              >
                <ArrowRightLeft className="h-4 w-4" />
              </Button>
            </div>

            {/* To Unit */}
            <div className="md:col-span-3 space-y-1.5">
              <Label className="text-xs font-medium text-fg-soft">Ke Satuan Tujuan</Label>
              <Select
                value={selectedToUnit?.code ?? ''}
                onChange={(e) => setCalcToCode(e.target.value)}
                className="w-full bg-field border-line focus:border-gold"
              >
                {calcUnits.map((u) => (
                  <option key={u.id} value={u.code}>
                    {u.symbol} — {u.name} {u.isAnchor ? '⭐ (Anchor)' : ''}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* Conversion Result Box */}
          {conversionResult && (
            <div className="rounded-lg border border-gold/25 bg-canvas/60 p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-line/40 pb-3">
                <span className="text-xs font-medium uppercase tracking-wider text-fg-muted">
                  Hasil Konversi Langsung
                </span>
                <span className="text-xs text-gold/80 font-mono">
                  Anchor Basis: {anchorUnit?.name} (1 {anchorUnit?.symbol})
                </span>
              </div>

              <div className="flex flex-wrap items-baseline gap-3">
                <span className="text-2xl font-bold text-fg-soft font-mono">
                  {calcAmount} {selectedFromUnit?.symbol}
                </span>
                <span className="text-2xl font-bold text-gold">=</span>
                <span className="text-3xl font-extrabold text-gold font-mono tracking-tight">
                  {conversionResult.converted} {selectedToUnit?.symbol}
                </span>
                <span className="text-sm text-fg-muted">
                  ({selectedToUnit?.name})
                </span>
              </div>

              {/* Step-by-Step Breakdown */}
              <div className="rounded-md bg-surface/60 border border-line/50 p-3.5 text-xs space-y-2">
                <div className="flex items-center gap-1.5 font-semibold text-fg-primary">
                  <HelpCircle className="h-3.5 w-3.5 text-gold" />
                  <span>Jejak Langkah Perhitungan Matematis:</span>
                </div>
                <div className="space-y-1.5 font-mono text-fg-soft pl-5">
                  {conversionResult.steps.map((step, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span className="text-gold font-bold">•</span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
                <div className="pt-2 border-t border-line/30 flex items-center justify-between text-fg-muted">
                  <span>Alur konversi:</span>
                  <span className="font-semibold text-gold font-mono">
                    {conversionResult.formulaSummary}
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Units Master Table by Category Tabs */}
      <Card className="border-line/60 bg-surface/30 backdrop-blur-sm">
        <CardHeader className="pb-3 border-b border-line/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-gold" />
              <CardTitle className="text-lg font-bold text-fg-primary">
                Daftar Satuan Per Kategori
              </CardTitle>
            </div>
            <span className="text-xs text-fg-soft">
              Setiap kategori memiliki tepat 1 Satuan Anchor acuan
            </span>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          <Tabs
            value={activeCategoryCode}
            onValueChange={setActiveCategoryCode}
            className="space-y-4"
          >
            <TabsList className="bg-canvas border border-line/70 p-1">
              {categories.map((c) => (
                <TabsTrigger
                  key={c.id}
                  value={c.code}
                  className="data-[state=active]:bg-gold data-[state=active]:text-canvas font-medium text-xs sm:text-sm px-4"
                >
                  {c.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {categories.map((cat) => {
              const currentAnchor = cat.units.find((u) => u.isAnchor);

              return (
                <TabsContent key={cat.id} value={cat.code} className="space-y-4 pt-2">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-md bg-canvas/40 border border-line/40">
                    <div className="text-xs text-fg-soft">
                      {cat.description}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-fg-muted">Satuan Anchor Kategori Ini:</span>
                      <Badge className="bg-gold text-canvas font-bold">
                        ⭐ {currentAnchor?.name} ({currentAnchor?.symbol})
                      </Badge>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-md border border-line">
                    <Table>
                      <TableHeader className="bg-canvas/80">
                        <TableRow className="border-b border-line">
                          <TableHead className="w-16 font-semibold">Kode</TableHead>
                          <TableHead className="font-semibold">Nama Satuan</TableHead>
                          <TableHead className="w-24 font-semibold">Simbol</TableHead>
                          <TableHead className="w-36 font-semibold text-center">Tipe</TableHead>
                          <TableHead className="font-semibold">Rasio ke Anchor (1 Unit = X Anchor)</TableHead>
                          <TableHead className="font-semibold">Rasio dari Anchor (1 Anchor = Y Unit)</TableHead>
                          <TableHead className="font-semibold">Catatan</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoading ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-fg-muted">
                              Memuat master satuan...
                            </TableCell>
                          </TableRow>
                        ) : cat.units.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-fg-muted">
                              Belum ada satuan yang didaftarkan pada kategori ini.
                            </TableCell>
                          </TableRow>
                        ) : (
                          cat.units.map((unit) => (
                            <TableRow
                              key={unit.id}
                              className={unit.isAnchor ? 'bg-gold/[0.04] font-medium' : ''}
                            >
                              <TableCell className="font-mono text-xs font-bold text-gold">
                                {unit.code}
                              </TableCell>
                              <TableCell className="text-fg-primary font-medium">
                                <div className="flex items-center gap-2">
                                  <span>{unit.name}</span>
                                  {unit.isAnchor && (
                                    <CheckCircle2 className="h-3.5 w-3.5 text-gold" />
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="font-mono font-bold text-fg-primary">
                                {unit.symbol}
                              </TableCell>
                              <TableCell className="text-center">
                                {unit.isAnchor ? (
                                  <Badge className="bg-gold text-canvas font-bold text-[10px] px-2 py-0.5">
                                    ⭐ ANCHOR
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="border-line text-fg-soft text-[10px]">
                                    Relatif
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="font-mono text-xs text-fg-primary">
                                {unit.ratioToAnchorLabel}
                              </TableCell>
                              <TableCell className="font-mono text-xs text-fg-soft">
                                {unit.ratioFromAnchorLabel}
                              </TableCell>
                              <TableCell className="text-xs text-fg-muted max-w-xs truncate">
                                {unit.notes}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        </CardContent>
      </Card>

      {/* Dialog Tambah Satuan */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-lg bg-surface border-line text-fg-primary">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gold flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Tambah Satuan Baru
            </DialogTitle>
            <DialogDescription className="text-xs text-fg-soft">
              Daftarkan satuan baru untuk kategori <strong>{currentCategory?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Kode Satuan *</Label>
                <Input
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                  placeholder="Misal: TON, RIM, ML"
                  className="font-mono uppercase bg-field border-line focus:border-gold"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Simbol Satuan *</Label>
                <Input
                  value={newSymbol}
                  onChange={(e) => setNewSymbol(e.target.value)}
                  placeholder="Misal: t, rim, mL"
                  className="bg-field border-line focus:border-gold"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Nama Satuan Lengkap *</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Misal: Ton Metrik"
                className="bg-field border-line focus:border-gold"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">
                  Faktor Terhadap Anchor ({currentCategory?.units.find((u) => u.isAnchor)?.symbol}) *
                </Label>
                <span className="text-[11px] text-gold font-mono">
                  1 {newSymbol || 'Unit'} = {newFactor} {currentCategory?.units.find((u) => u.isAnchor)?.symbol}
                </span>
              </div>
              <NumberInput
                value={newFactor}
                onChange={(val) => setNewFactor(val ?? 1)}
                decimalScale={8}
                className="font-mono bg-field border-line focus:border-gold"
                placeholder="Misal: 1000 untuk KG, 0.01 untuk Centigram"
              />
              <p className="text-[11px] text-fg-muted">
                Contoh: Jika 1 Ton = 1.000.000 Gram, isi 1000000. Jika 1 Centigram = 0,01 Gram, isi 0.01.
              </p>
            </div>

            <div className="flex items-center gap-2 p-3 rounded-md bg-canvas/40 border border-line">
              <input
                type="checkbox"
                id="newIsAnchor"
                checked={newIsAnchor}
                onChange={(e) => {
                  setNewIsAnchor(e.target.checked);
                  if (e.target.checked) setNewFactor(1);
                }}
                className="h-4 w-4 rounded border-line text-gold focus:ring-gold"
              />
              <Label htmlFor="newIsAnchor" className="text-xs cursor-pointer text-fg-primary">
                Jadikan sebagai <strong>Satuan Anchor</strong> baru untuk kategori ini (faktor akan diset 1).
              </Label>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Catatan (Opsional)</Label>
              <Input
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Keterangan penggunaan..."
                className="bg-field border-line focus:border-gold"
              />
            </div>
          </div>

          <DialogFooter className="border-t border-line/40 pt-4 flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAddOpen(false)}
              className="border-line"
            >
              Batal
            </Button>
            <Button
              type="button"
              onClick={() => addUnitMutation.mutate()}
              disabled={!newCode || !newName || !newSymbol || addUnitMutation.isPending}
              className="bg-gold text-canvas hover:bg-gold/90 font-medium"
            >
              {addUnitMutation.isPending ? 'Menyimpan...' : 'Simpan Satuan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
