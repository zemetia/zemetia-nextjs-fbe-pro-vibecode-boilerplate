'use client';

import React, { useId, useState } from 'react';
import { Sparkles, CheckCircle2, SlidersHorizontal } from 'lucide-react';

import { cn } from '@/lib/cn';
import {
  BUILTIN_UNIT_CATEGORIES,
  findUnit,
  computeAnchorEquivalent,
  type UnitConversionParams,
  suggestCategoryForPR,
} from '@/lib/unit-conversion';

export interface UnitPickerProps {
  value?: string;
  onChange: (value: string, unit?: UnitConversionParams) => void;
  preferredCategory?: string; // 'WEIGHT' | 'UNIT' | 'VOLUME' | 'LENGTH'
  prCategory?: string; // e.g. 'GOLD_IMPORT', 'GOLD_LOCAL', 'LAB_CHEMICALS', 'GENERAL_SUPPLIES'
  quantity?: number;
  showAnchorBadge?: boolean;
  allowCustom?: boolean;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}

export function UnitPicker({
  value = '',
  onChange,
  preferredCategory,
  prCategory,
  quantity,
  showAnchorBadge = true,
  allowCustom = true,
  className,
  placeholder = 'Pilih satuan...',
  disabled = false,
  id,
}: UnitPickerProps) {
  const autoId = useId();
  const selectId = id || autoId;

  // Tentukan kategori prioritas
  const activeCategoryCode =
    preferredCategory || (prCategory ? suggestCategoryForPR(prCategory) : 'WEIGHT');

  // Cek apakah nilai saat ini dikenal di daftar satuan master
  const currentUnit = findUnit(value);
  const isUnrecognizedValue = Boolean(value && !currentUnit && allowCustom);
  const [forceCustom, setForceCustom] = useState(false);
  const isCustomMode = isUnrecognizedValue || forceCustom;

  // Urutkan kategori agar yang direkomendasikan berada paling atas
  const sortedCategories = [...BUILTIN_UNIT_CATEGORIES].sort((a, b) => {
    if (a.code === activeCategoryCode) return -1;
    if (b.code === activeCategoryCode) return 1;
    return 0;
  });

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedVal = e.target.value;
    if (selectedVal === '__CUSTOM__') {
      setForceCustom(true);
      return;
    }
    setForceCustom(false);
    const unit = findUnit(selectedVal);
    onChange(unit?.symbol || selectedVal, unit);
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    const resolved = findUnit(text);
    onChange(text, resolved);
  };

  // Kalkulasi ekuivalensi anchor
  const anchorEq =
    quantity && quantity > 0 && value ? computeAnchorEquivalent(quantity, value) : null;

  return (
    <div className={cn('flex flex-col gap-1 w-full', className)}>
      {!isCustomMode ? (
        <div className="relative">
          <select
            id={selectId}
            value={currentUnit ? currentUnit.symbol : value}
            onChange={handleSelectChange}
            disabled={disabled}
            className={cn(
              'flex h-10 w-full appearance-none rounded-sm border border-line bg-field px-3 py-2 pr-9 text-xs text-fg font-medium outline-none transition-all duration-150 cursor-pointer',
              'focus:border-gold focus:ring-1 focus:ring-gold/30',
              'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-field/40',
              '[&>optgroup]:font-bold [&>optgroup]:text-gold [&>optgroup]:bg-surface',
              '[&>optgroup>option]:font-normal [&>optgroup>option]:text-fg [&>optgroup>option]:bg-surface',
            )}
          >
            {!value && <option value="">{placeholder}</option>}

            {sortedCategories.map((cat) => (
              <optgroup
                key={cat.code}
                label={`${cat.icon} ${cat.name} ${cat.code === activeCategoryCode ? '⭐ (Rekomendasi)' : ''}`}
              >
                {cat.units.map((u) => (
                  <option key={u.code} value={u.symbol}>
                    {u.name} ({u.symbol}) {u.isAnchor ? '⭐ [Anchor]' : `[1 = ${u.conversionFactor} ${cat.units.find(x => x.isAnchor)?.symbol}]`}
                  </option>
                ))}
              </optgroup>
            ))}

            {allowCustom && (
              <optgroup label="✍️ Kustom">
                <option value="__CUSTOM__">Ketik Satuan Lainnya...</option>
              </optgroup>
            )}
          </select>

          <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-fg-muted">
            <span className="text-[10px] text-gold font-mono uppercase">
              {currentUnit?.isAnchor ? '⭐ Anchor' : currentUnit ? currentUnit.symbol : '▼'}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            id={selectId}
            value={value}
            onChange={handleCustomChange}
            placeholder="Ketik satuan kustom..."
            disabled={disabled}
            className="flex h-10 w-full rounded-sm border border-line bg-field px-3 py-2 text-xs text-fg outline-none focus:border-gold focus:ring-1 focus:ring-gold/30"
          />
          <button
            type="button"
            onClick={() => {
              setForceCustom(false);
              const defaultUnit = sortedCategories[0]?.units.find((u) => u.isAnchor);
              if (defaultUnit) onChange(defaultUnit.symbol, defaultUnit);
            }}
            title="Kembali ke pilihan satuan standar"
            className="h-10 px-2 rounded-sm border border-line hover:border-gold hover:text-gold text-fg-muted text-[11px] flex items-center gap-1 shrink-0 bg-surface"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Pilih</span>
          </button>
        </div>
      )}

      {/* Indikator Konversi Anchor Real-Time */}
      {showAnchorBadge && anchorEq && (
        <div className="mt-0.5">
          {anchorEq.isAnchor ? (
            <div className="flex items-center gap-1 text-[11px] text-emerald font-medium">
              <CheckCircle2 className="w-3 h-3 text-emerald shrink-0" />
              <span>
                Satuan Dasar / <strong>Anchor ({anchorEq.anchorUnit.name})</strong>
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[11px] text-gold font-medium bg-gold/10 px-2 py-0.5 rounded border border-gold/30">
              <Sparkles className="w-3 h-3 text-gold shrink-0 animate-pulse" />
              <span>
                ⭐ Konversi Anchor: <strong>{anchorEq.formatted}</strong>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
