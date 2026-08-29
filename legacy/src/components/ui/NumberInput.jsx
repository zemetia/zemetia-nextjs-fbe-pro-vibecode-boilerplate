import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '../../utils/cn';

function groupThousands(digits) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function formatFromValue(value, allowDecimal) {
  if (value === '' || value === null || value === undefined) return '';
  const num = Number(value);
  if (Number.isNaN(num)) return '';
  if (allowDecimal) {
    const str = String(value).replace(',', '.');
    const parts = str.split('.');
    const intPart = parts[0] || '0';
    const decPart = parts[1];
    const sign = intPart.startsWith('-') ? '-' : '';
    const groupedInt = sign + groupThousands(intPart.replace('-', ''));
    return decPart !== undefined ? `${groupedInt},${decPart}` : groupedInt;
  }
  const rounded = Math.trunc(num);
  const sign = rounded < 0 ? '-' : '';
  return sign + groupThousands(Math.abs(rounded).toString());
}

/**
 * Enhanced NumberInput dengan:
 * 1. Pemisah ribuan otomatis (titik) & desimal (koma).
 * 2. Smart cursor preservation (kursor tidak loncat ke ujung saat mengetik di tengah).
 * 3. Dukungan titik numpad (mengetik '.' pada numpad otomatis jadi koma desimal bila allowDecimal).
 * 4. Paste sanitization (membersihkan "Rp", spasi, pemisah bank).
 * 5. Dukungan visual prefix (mis. "Rp") dan suffix (mis. "g", "%").
 */
export default function NumberInput({
  value,
  onChange,
  allowDecimal = false,
  className,
  placeholder = '0',
  disabled = false,
  prefix,
  suffix,
  ...rest
}) {
  const [text, setText] = useState(() => formatFromValue(value, allowDecimal));
  const inputRef = useRef(null);
  const cursorInfo = useRef(null);
  const isInternalChange = useRef(false);

  // Sinkronisasi bila value berubah dari luar (props)
  useEffect(() => {
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    setText(formatFromValue(value, allowDecimal));
  }, [value, allowDecimal]);

  // Kembalikan posisi kursor setelah re-render formatting
  useLayoutEffect(() => {
    if (cursorInfo.current && inputRef.current) {
      const { digitsBeforeCursor } = cursorInfo.current;
      cursorInfo.current = null;
      let digitsCount = 0;
      let targetPos = text.length;

      for (let i = 0; i < text.length; i++) {
        if (/[\d,-]/.test(text[i])) {
          digitsCount++;
        }
        if (digitsCount >= digitsBeforeCursor) {
          targetPos = i + 1;
          break;
        }
      }
      inputRef.current.setSelectionRange(targetPos, targetPos);
    }
  }, [text]);

  const handleChange = (e) => {
    const raw = e.target.value;
    const cursorPos = e.target.selectionStart || 0;

    // Hitung berapa banyak karakter esensial sebelum kursor sebelum reformatting
    const textBeforeCursor = raw.slice(0, cursorPos);
    const digitsBeforeCursor = (textBeforeCursor.match(/[\d,-]/g) || []).length;

    let cleaned = raw;

    // Handle numpad '.' saat allowDecimal aktif
    if (allowDecimal) {
      // Jika pengguna menekan '.' dan belum ada koma, ubah titik terakhir jadi koma
      if (cleaned.includes('.') && !cleaned.includes(',')) {
        // Cek apakah ada titik yang diketik
        cleaned = cleaned.replace(/\./g, ',');
      } else {
        cleaned = cleaned.replace(/\./g, '');
      }

      cleaned = cleaned.replace(/[^\d,-]/g, '');
      const firstComma = cleaned.indexOf(',');
      if (firstComma !== -1) {
        cleaned = cleaned.slice(0, firstComma + 1) + cleaned.slice(firstComma + 1).replace(/,/g, '');
      }
    } else {
      cleaned = cleaned.replace(/\./g, '').replace(/[^\d-]/g, '');
    }

    const negative = cleaned.startsWith('-');
    cleaned = (negative ? '-' : '') + cleaned.replace(/-/g, '');

    const [intPart, decPart] = cleaned.replace('-', '').split(',');
    const groupedInt = (negative ? '-' : '') + groupThousands(intPart || '');
    const display = allowDecimal && decPart !== undefined ? `${groupedInt},${decPart}` : groupedInt;

    cursorInfo.current = { digitsBeforeCursor };
    isInternalChange.current = true;
    setText(display);

    const parseable = cleaned.replace(',', '.');
    if (parseable === '' || parseable === '-') {
      if (typeof onChange === 'function') onChange('');
    } else {
      const numeric = Number(parseable);
      if (typeof onChange === 'function') onChange(Number.isNaN(numeric) ? 0 : numeric);
    }
  };

  const handleBlur = () => {
    setText(formatFromValue(value, allowDecimal));
  };

  // Render dengan atau tanpa wrapper prefix/suffix
  if (prefix || suffix) {
    return (
      <div className="relative flex items-center w-full">
        {prefix && (
          <span className="absolute left-3 text-xs font-semibold text-fg-muted pointer-events-none select-none">
            {prefix}
          </span>
        )}
        <input
          ref={inputRef}
          type="text"
          inputMode={allowDecimal ? 'decimal' : 'numeric'}
          className={cn(
            'form-input w-full',
            prefix && 'pl-9',
            suffix && 'pr-10',
            className
          )}
          value={text}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          {...rest}
        />
        {suffix && (
          <span className="absolute right-3 text-xs font-medium text-fg-muted pointer-events-none select-none">
            {suffix}
          </span>
        )}
      </div>
    );
  }

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      className={cn('form-input', className)}
      value={text}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      disabled={disabled}
      {...rest}
    />
  );
}
