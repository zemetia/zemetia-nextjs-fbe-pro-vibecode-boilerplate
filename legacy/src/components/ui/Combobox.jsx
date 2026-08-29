import React, { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './Popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './Command';
import { cn } from '../../utils/cn';

// cmdk memakai string kosong sebagai "tidak ada nilai", jadi opsi ber-value ''
// (mis. "-- Tanpa PO --") disimpan pakai penanda ini dan dikembalikan saat dipilih.
const EMPTY_TOKEN = '__combobox_empty__';

/**
 * Dropdown + search, pengganti <select className="form-select"> untuk daftar
 * panjang. Pola Combobox shadcn/ui: Popover + Command (cmdk).
 *
 *   <Combobox
 *     value={form.accountCode}
 *     onChange={code => setForm({ ...form, accountCode: code })}
 *     options={coaAccounts.map(a => ({ value: a.code, label: `${a.code} - ${a.name}` }))}
 *     placeholder="-- Pilih Akun Beban --"
 *     searchPlaceholder="Cari kode atau nama akun…"
 *   />
 *
 * `options`: [{ value, label, keywords?, disabled? }]. Nilai yang keluar lewat
 * `onChange` adalah `value` mentah — sama persis dengan `e.target.value` pada
 * <select> yang digantikan, jadi handler lama tidak perlu diubah bentuknya.
 */
export default function Combobox({
  value,
  onChange,
  options = [],
  placeholder = '-- Pilih --',
  searchPlaceholder = 'Cari…',
  emptyText = 'Tidak ada hasil.',
  disabled = false,
  className,
  style,
  contentClassName
}) {
  const [open, setOpen] = useState(false);

  const selected = options.find((o) => String(o.value) === String(value ?? ''));

  const handleSelect = (picked) => {
    const raw = picked === EMPTY_TOKEN ? '' : picked;
    setOpen(false);
    if (typeof onChange === 'function') onChange(raw);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'form-select flex w-full cursor-pointer items-center justify-between gap-2 text-left',
            'disabled:cursor-not-allowed disabled:opacity-60',
            className
          )}
          style={style}
        >
          <span
            className={cn(
              'overflow-hidden text-ellipsis whitespace-nowrap',
              !selected && 'text-fg-muted'
            )}
          >
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown size={15} className="shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>

      <PopoverContent className={cn('w-[var(--radix-popover-trigger-width)] p-0', contentClassName)}>
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((opt, idx) => {
                const itemValue = String(opt.value ?? '');
                const isSelected = itemValue === String(value ?? '');
                const searchFilterKey = `${itemValue} ${opt.label} ${(opt.keywords || []).join(' ')}`;
                return (
                  <CommandItem
                    key={opt.value ? `${opt.value}-${idx}` : `empty-${idx}`}
                    value={searchFilterKey}
                    disabled={opt.disabled}
                    onSelect={() => handleSelect(opt.value)}
                  >
                    <Check
                      size={15}
                      className={cn('shrink-0 text-gold-light', isSelected ? 'opacity-100' : 'opacity-0')}
                    />
                    <span className="flex-1">{opt.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
