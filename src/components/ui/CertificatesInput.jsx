import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Wand2, Layers, AlertCircle, Scale } from 'lucide-react';
import { cn } from '../../utils/cn';
import { TagInput } from './TagInput';
import { Input } from './Input';
import { Button } from './Button';
import Combobox from './Combobox';
import { Badge } from './Badge';

export const TROY_OUNCE_TO_GRAM = 31.1034768;

/**
 * Ukuran keping batangan standar pasar/refinery (PAMP/Valcambi/Argor/Antam & Good Delivery).
 * Diambil langsung dari kaidah domain logam mulia tan-erp.
 */
export const BAR_WEIGHTS = {
  GRAM: [1, 2, 3, 5, 10, 20, 25, 50, 100, 250, 500, 1000],
  TROY_OUNCE: [1, 2, 5, 10, 20, 50, 100, 400, 500, 1000]
};

export const WEIGHT_UNIT_LABELS = {
  GRAM: 'g',
  TROY_OUNCE: 'oz'
};

let seq = 0;
function nextKey(prefix = 'cert') {
  seq += 1;
  return `${prefix}-${Date.now()}-${seq}`;
}

export function barWeightLabel(value, unit = 'GRAM') {
  if (value === undefined || value === null) return '';
  const num = Number(value);
  if (unit === 'GRAM' && num >= 1000 && num % 1000 === 0) {
    return `${(num / 1000).toLocaleString('id-ID')} kg`;
  }
  const suffix = unit === 'GRAM' ? 'g' : 'oz';
  return `${num.toLocaleString('id-ID', { maximumFractionDigits: 4 })} ${suffix}`;
}

export function barWeightOptions(unit = 'GRAM', include) {
  const normalizedUnit = unit === 'TROY_OUNCE' || unit === 'oz' ? 'TROY_OUNCE' : 'GRAM';
  const list = [...(BAR_WEIGHTS[normalizedUnit] || BAR_WEIGHTS.GRAM)];

  if (include !== undefined && Number(include) > 0 && !list.includes(Number(include))) {
    list.push(Number(include));
    list.sort((a, b) => a - b);
  }

  return list.map((w) => ({
    value: String(w),
    label: barWeightLabel(w, normalizedUnit)
  }));
}

export function largestBarWeightAtMost(value, unit = 'GRAM') {
  const normalizedUnit = unit === 'TROY_OUNCE' || unit === 'oz' ? 'TROY_OUNCE' : 'GRAM';
  const list = BAR_WEIGHTS[normalizedUnit] || BAR_WEIGHTS.GRAM;
  let found = undefined;
  for (const weight of list) {
    if (weight <= value) found = weight;
  }
  return found;
}

/**
 * Membagi total berat ke sejumlah keping secara cerdas proporsional (greedy terbesar yang muat).
 * Mendukung Gram dan Troy Ounce (oz).
 * Menjamin prinsip konservasi massa: keping terakhir menyerap sisa alokasi berat.
 */
export function splitBarWeights(total, pieceCount, unit = 'GRAM') {
  if (pieceCount <= 0) return [];
  const normalizedUnit = unit === 'TROY_OUNCE' || unit === 'oz' ? 'TROY_OUNCE' : 'GRAM';
  const sizes = BAR_WEIGHTS[normalizedUnit] || BAR_WEIGHTS.GRAM;
  const smallest = Math.min(...sizes);
  const largest = Math.max(...sizes);

  const weights = [];
  let remaining = Math.round(Math.max(Number(total || 0), 0) * 10000) / 10000;

  for (let index = 0; index < pieceCount; index += 1) {
    if (index === pieceCount - 1) {
      const lastWeight = remaining > 0 ? remaining : (largestBarWeightAtMost(remaining, normalizedUnit) ?? smallest);
      weights.push(Math.round(lastWeight * 10000) / 10000);
      break;
    }
    const share = Math.min(remaining / (pieceCount - index), largest);
    const weight = largestBarWeightAtMost(share, normalizedUnit) ?? smallest;
    weights.push(weight);
    remaining = Math.round(Math.max(remaining - weight, 0) * 10000) / 10000;
  }

  return weights;
}

/**
 * Otomatis menghitung dan memetakan daftar nomor seri / sertifikat batangan ke berat kepingan
 * menggunakan algoritma greedy splitBarWeights.
 * Menghasilkan array keping batangan lengkap dengan key, serialNumber, dan weight.
 */
export function autoCalculateCertificates(rawInput, totalWeight, unit = 'GRAM') {
  let serials = [];
  if (Array.isArray(rawInput)) {
    serials = rawInput.map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object') {
        return String(item.serialNumber || item.serialNo || item.serial || '').trim();
      }
      return '';
    }).filter(Boolean);
  } else if (typeof rawInput === 'string') {
    serials = rawInput.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
  }

  if (serials.length === 0) return [];

  const normalizedUnit = unit === 'TROY_OUNCE' || unit === 'oz' ? 'TROY_OUNCE' : 'GRAM';
  const target = Number(totalWeight) > 0 ? Number(totalWeight) : (normalizedUnit === 'TROY_OUNCE' ? 32.1507 : 1000);
  const weights = splitBarWeights(target, serials.length, normalizedUnit);

  return serials.map((serialNumber, idx) => ({
    key: `cert-${Date.now()}-${idx + 1}-${Math.random().toString(36).substring(2, 7)}`,
    serialNumber,
    weight: weights[idx] !== undefined ? weights[idx] : (normalizedUnit === 'TROY_OUNCE' ? 1 : 1000)
  }));
}

/**
 * Helper untuk normalisasi format input value (string / array string / array object).
 */
function parseInitialCertificates(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    if (value.length === 0) return [];
    if (typeof value[0] === 'object' && value[0] !== null) {
      return value.map((c) => ({
        key: c.key || nextKey('cert'),
        serialNumber: String(c.serialNumber || c.serialNo || c.serial || '').trim(),
        weight: c.weight !== undefined && c.weight !== null && !isNaN(Number(c.weight)) && Number(c.weight) > 0 ? Number(c.weight) : undefined
      }));
    }
    return value.map((str) => ({
      key: nextKey('cert'),
      serialNumber: String(str).trim(),
      weight: undefined
    })).filter((c) => c.serialNumber !== '');
  }
  if (typeof value === 'string') {
    return value
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((serialNumber) => ({
        key: nextKey('cert'),
        serialNumber,
        weight: undefined
      }));
  }
  return [];
}

/**
 * CertificatesInput component dari tan-erp (porting untuk React 19).
 * 
 * Digunakan pada form penerimaan TTB (Tanda Terima Barang Vault) dan form yang memerlukan
 * pemetaan nomor sertifikat otomatis ke berat batangan, lengkap dengan versi Gram dan Troy Ounce (oz).
 */
export function CertificatesInput({
  value,
  onChange,
  weightUnit = 'GRAM',
  onUnitChange,
  allowUnitToggle = false,
  targetWeight,
  disabled = false,
  label = 'Nomor Sertifikat / Nomor Seri Batangan',
  error,
  className
}) {
  const [activeUnit, setActiveUnit] = useState(() => {
    return weightUnit === 'TROY_OUNCE' || weightUnit === 'oz' ? 'TROY_OUNCE' : 'GRAM';
  });

  useEffect(() => {
    const next = weightUnit === 'TROY_OUNCE' || weightUnit === 'oz' ? 'TROY_OUNCE' : 'GRAM';
    setActiveUnit(next);
  }, [weightUnit]);

  const unitSuffix = WEIGHT_UNIT_LABELS[activeUnit];

  // List keping batangan - inisialisasi dan langsung hitung dengan algoritma jika sertifikat sudah ada
  const [items, setItems] = useState(() => {
    const parsed = parseInitialCertificates(value);
    const target = targetWeight !== undefined && targetWeight !== null ? Number(targetWeight) : undefined;
    if (parsed.length > 0 && target && target > 0) {
      const hasUnweighted = parsed.some((it) => it.weight === undefined || it.weight === null || isNaN(it.weight) || it.weight <= 0);
      if (hasUnweighted) {
        const weights = splitBarWeights(target, parsed.length, activeUnit);
        return parsed.map((it, idx) => ({
          ...it,
          weight: weights[idx] ?? (activeUnit === 'TROY_OUNCE' ? 1 : 1000)
        }));
      }
    }
    return parsed;
  });

  // Chip input serial numbers yang belum di-generate ke keping
  const [draftSerials, setDraftSerials] = useState([]);

  // Sidik jari daftar serial terakhir yang kita kirim sendiri lewat onChange.
  // Tanpa ini, nomor yang baru diketik di TagInput kembali lagi lewat prop `value`
  // dan ikut dipetakan ke berat — pemetaan harus lahir dari tombol, bukan dari koma.
  const lastEmittedRef = useRef(null);

  // Sinkronisasi saat value prop berubah dari luar (misal penarikan PO di TTB)
  // Langsung hitung dengan algoritma secara otomatis jika ada sertifikat
  useEffect(() => {
    const parsed = parseInitialCertificates(value);
    const currentSerials = items.map((i) => i.serialNumber).join(',');
    const newSerials = parsed.map((i) => i.serialNumber).join(',');

    // Pantulan dari onChange kita sendiri (mis. nomor yang masih berupa chip draft) —
    // bukan data baru dari luar, jadi jangan dipetakan ulang.
    if (lastEmittedRef.current !== null && newSerials === lastEmittedRef.current) return;

    const hasUnweighted = parsed.some((it) => it.weight === undefined || it.weight === null || isNaN(it.weight) || it.weight <= 0);
    const target = targetWeight !== undefined && targetWeight !== null ? Number(targetWeight) : undefined;

    // Hanya daftar serial yang benar-benar berubah dari luar (mis. tarik PO) yang memicu
    // pemetaan ulang. Berat yang kosong saja tidak cukup — mengisinya adalah tugas tombol.
    if (parsed.length > 0 && newSerials !== currentSerials) {
      let nextItems = parsed;
      if (target && target > 0 && (hasUnweighted || newSerials !== currentSerials)) {
        const weights = splitBarWeights(target, parsed.length, activeUnit);
        nextItems = parsed.map((it, idx) => ({
          ...it,
          weight: (it.weight && it.weight > 0 && !hasUnweighted) ? it.weight : (weights[idx] ?? (activeUnit === 'TROY_OUNCE' ? 1 : 1000))
        }));
      }
      setItems(nextItems);
      notifyChange(nextItems, draftSerials, activeUnit);
    }
  }, [value, targetWeight, activeUnit]);

  const target = targetWeight !== undefined && targetWeight !== null ? Number(targetWeight) : undefined;
  const totalWeight = Math.round(items.reduce((acc, it) => acc + (Number(it.weight) || 0), 0) * 10000) / 10000;
  const remainingWeight = target === undefined ? 0 : Math.max(Math.round((target - totalWeight) * 10000) / 10000, 0);
  const difference = target === undefined ? undefined : Math.round((totalWeight - target) * 10000) / 10000;

  function notifyChange(newItems, newDraftSerials = draftSerials, unit = activeUnit) {
    if (!onChange) return;
    const allSerials = [
      ...newItems.map((it) => it.serialNumber.trim()).filter(Boolean),
      ...newDraftSerials.map((s) => s.trim()).filter(Boolean)
    ];
    const commaString = allSerials.join(', ');
    lastEmittedRef.current = allSerials.join(',');
    onChange(newItems, allSerials, commaString, unit);
  }

  function handleUnitSwitch(newUnit) {
    setActiveUnit(newUnit);
    if (onUnitChange) onUnitChange(newUnit);
    if (items.length > 0 && target && target > 0) {
      const convertedTarget = newUnit === 'TROY_OUNCE'
        ? Math.round((target / TROY_OUNCE_TO_GRAM) * 10000) / 10000
        : Math.round(target * TROY_OUNCE_TO_GRAM * 10000) / 10000;
      const weights = splitBarWeights(convertedTarget, items.length, newUnit);
      const next = items.map((it, idx) => ({
        ...it,
        weight: weights[idx] ?? (newUnit === 'TROY_OUNCE' ? 1 : 1000)
      }));
      setItems(next);
      notifyChange(next, draftSerials, newUnit);
    } else {
      notifyChange(items, draftSerials, newUnit);
    }
  }

  function patchItem(key, changes) {
    const next = items.map((it) => (it.key === key ? { ...it, ...changes } : it));
    setItems(next);
    notifyChange(next);
  }

  function removeItem(key) {
    const next = items.filter((it) => it.key !== key);
    setItems(next);
    notifyChange(next);
  }

  function addItem() {
    const next = [
      ...items,
      {
        key: nextKey('cert'),
        serialNumber: '',
        weight: remainingWeight > 0 ? largestBarWeightAtMost(remainingWeight, activeUnit) : undefined
      }
    ];
    setItems(next);
    notifyChange(next);
  }

  /**
   * Otomatis menghitung ulang seluruh keping batangan dengan algoritma splitBarWeights.
   */
  function handleRecalculateAll() {
    const allSerials = [...new Set([
      ...items.map((it) => it.serialNumber.trim()).filter(Boolean),
      ...draftSerials.map((s) => s.trim()).filter(Boolean)
    ])];
    if (allSerials.length === 0) return;

    const baseWeight = target && target > 0 ? target : (activeUnit === 'TROY_OUNCE' ? 32.1507 : 1000);
    const weights = splitBarWeights(baseWeight, allSerials.length, activeUnit);

    const next = allSerials.map((serialNumber, idx) => ({
      key: items[idx]?.key || nextKey('cert'),
      serialNumber,
      weight: weights[idx] ?? (activeUnit === 'TROY_OUNCE' ? 1 : 1000)
    }));

    setItems(next);
    setDraftSerials([]);
    notifyChange(next, [], activeUnit);
  }

  /**
   * Saat user mengetik atau menempel nomor sertifikat di TagInput.
   * Nomornya hanya ditampung sebagai chip draft — pemetaan ke berat keping baru
   * terjadi saat tombol "Hitung Ulang Otomatis" ditekan, supaya satu koma di
   * tengah pengetikan tidak langsung membagi ulang seluruh berat batangan.
   */
  function handleTagInputCommit(serials) {
    const nextDrafts = Array.isArray(serials) ? serials.map((s) => s.trim()).filter(Boolean) : [];
    setDraftSerials(nextDrafts);
    notifyChange(items, nextDrafts, activeUnit);
  }

  return (
    <div className={cn('space-y-3 rounded-sm border border-line bg-surface/40 p-3.5', className)}>
      {/* Header Label, Unit Toggle (Gram vs Ounce), & Badge Bar Terdeteksi */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 pb-2.5">
        <label className="text-xs font-bold text-sky-light flex items-center gap-1.5">
          <Layers size={15} />
          {label}
        </label>

        <div className="flex flex-wrap items-center gap-2">
          {allowUnitToggle && (
            <div className="flex items-center gap-1 bg-field rounded-sm p-0.5 border border-line text-xs">
              <button
                type="button"
                disabled={disabled}
                onClick={() => handleUnitSwitch('GRAM')}
                className={cn(
                  'px-2.5 py-1 rounded-xs font-semibold text-xs transition-colors flex items-center gap-1',
                  activeUnit === 'GRAM'
                    ? 'bg-gold/20 text-gold-light border border-gold/40 shadow-xs'
                    : 'text-fg-muted hover:text-fg'
                )}
              >
                <Scale size={12} /> Gram (g)
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => handleUnitSwitch('TROY_OUNCE')}
                className={cn(
                  'px-2.5 py-1 rounded-xs font-semibold text-xs transition-colors flex items-center gap-1',
                  activeUnit === 'TROY_OUNCE'
                    ? 'bg-gold/20 text-gold-light border border-gold/40 shadow-xs'
                    : 'text-fg-muted hover:text-fg'
                )}
              >
                <Scale size={12} /> Troy Ounce (oz)
              </button>
            </div>
          )}

          {(items.length > 0 || draftSerials.length > 0) && (
            <div className="flex items-center gap-1.5">
              <Badge variant="emerald" size="sm" dot>
                📦 {items.length + draftSerials.length} Batang Terdeteksi
              </Badge>
              <Badge variant="sky" size="sm">
                ⚡ Algoritma Aktif
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* Input TagInput untuk tempel / ketik banyak nomor seri sekaligus */}
      <div className="space-y-2 rounded-sm border border-dashed border-line/80 bg-field/30 p-2.5">
        <TagInput
          label="Ketik / Tempel Banyak Nomor Sertifikat (Pisahkan Koma / Enter)"
          value={draftSerials}
          onChange={handleTagInputCommit}
          disabled={disabled}
          placeholder="Contoh: CERT-PEG-001, CERT-PEG-002, CERT-PEG-003..."
          hint={`Ketik atau tempel nomor seri fisik. Berat keping (${unitSuffix}) baru dibagi setelah tombol "Hitung Ulang Otomatis" ditekan.`}
        />

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={disabled || (items.length === 0 && draftSerials.length === 0)}
            leftIcon={<Wand2 size={14} className="text-gold" />}
            onClick={handleRecalculateAll}
            className="border-gold/30 hover:border-gold text-gold-light font-bold"
          >
            ⚡ Hitung Ulang Otomatis Sesuai Algoritma ({unitSuffix})
          </Button>

          <span className="text-[11px] text-fg-muted">
            {target === undefined
              ? 'Isi total berat fisik di atas untuk pembagian keping otomatis.'
              : `Sisa berat yang belum dirinci: ${remainingWeight.toLocaleString('id-ID', { maximumFractionDigits: 4 })} ${unitSuffix}`}
          </span>
        </div>
      </div>

      {/* Daftar Rincian Keping Batangan */}
      {items.length > 0 && (
        <div className="space-y-2 pt-1">
          <div className="text-xs font-semibold text-fg-soft flex items-center justify-between">
            <span>Rincian Nomor Sertifikat & Berat per Keping:</span>
            <span className="text-fg-muted font-normal">
              {items.length} keping tercatat ({activeUnit === 'TROY_OUNCE' ? 'Troy Ounce' : 'Gram'})
            </span>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {items.map((cert, index) => (
              <div
                key={cert.key}
                className="grid grid-cols-[1fr_140px_auto] sm:grid-cols-[1fr_170px_auto] items-center gap-2 rounded-sm border border-line bg-field/60 p-2 text-xs"
              >
                <div>
                  <Input
                    value={cert.serialNumber}
                    disabled={disabled}
                    placeholder={`No. Seri Keping #${index + 1}`}
                    onChange={(e) => patchItem(cert.key, { serialNumber: e.target.value })}
                    className="h-8 text-xs font-mono text-fg"
                  />
                </div>

                <div>
                  <Combobox
                    value={cert.weight !== undefined && cert.weight !== null ? String(cert.weight) : ''}
                    options={barWeightOptions(activeUnit, cert.weight)}
                    onChange={(val) => patchItem(cert.key, { weight: val ? Number(val) : undefined })}
                    disabled={disabled}
                    placeholder={`Pilih berat (${unitSuffix})…`}
                    searchPlaceholder="Cari berat…"
                    className="h-8 text-xs"
                  />
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={disabled}
                  aria-label={`Hapus keping ${index + 1}`}
                  onClick={() => removeItem(cert.key)}
                  className="text-danger/80 hover:text-danger hover:bg-danger/10"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer Aksi Tambah Keping & Rekonsiliasi Berat */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-2.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          leftIcon={<Plus size={14} />}
          onClick={addItem}
          className="text-xs"
        >
          Tambah Keping Manual
        </Button>

        {items.length > 0 && (
          <div className="text-xs text-fg-soft tabular-nums flex items-center gap-2">
            <span>
              Total: <strong className="text-gold-light">{totalWeight.toLocaleString('id-ID', { maximumFractionDigits: 4 })} {unitSuffix}</strong> ({items.length} keping)
              {activeUnit === 'TROY_OUNCE' && (
                <span className="text-fg-muted ml-1">
                  (≈ {(totalWeight * TROY_OUNCE_TO_GRAM).toLocaleString('id-ID', { maximumFractionDigits: 2 })} g)
                </span>
              )}
            </span>
            {difference !== undefined && difference !== 0 && (
              <span className={cn(
                'inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-xs text-[11px]',
                difference > 0 ? 'bg-orange/15 text-orange-light' : 'bg-danger/15 text-danger-light'
              )}>
                <AlertCircle size={12} />
                {difference > 0 ? 'Lebih' : 'Kurang'} {Math.abs(difference).toLocaleString('id-ID', { maximumFractionDigits: 4 })} {unitSuffix} dari target
              </span>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-danger-light">{error}</p>}
    </div>
  );
}

CertificatesInput.displayName = 'CertificatesInput';
export default CertificatesInput;
