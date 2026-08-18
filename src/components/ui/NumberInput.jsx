import React, { useEffect, useRef, useState } from 'react';
import { cn } from '../../utils/cn';

function groupThousands(digits) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function formatFromValue(value, allowDecimal) {
  if (value === '' || value === null || value === undefined) return '';
  const num = Number(value);
  if (Number.isNaN(num)) return '';
  if (allowDecimal) {
    const [intPart, decPart] = String(num).split('.');
    const sign = intPart.startsWith('-') ? '-' : '';
    const groupedInt = sign + groupThousands(intPart.replace('-', ''));
    return decPart !== undefined ? `${groupedInt},${decPart}` : groupedInt;
  }
  const rounded = Math.trunc(num);
  const sign = rounded < 0 ? '-' : '';
  return sign + groupThousands(Math.abs(rounded).toString());
}

/**
 * Input angka dengan pemisah ribuan titik saat ditampilkan (10000 -> "10.000"),
 * pengganti <input type="number">. State yang disimpan tetap Number mentah;
 * `onChange` menerima Number langsung (bukan event) — pola lama
 * `onChange={e => setForm({ ...form, x: Number(e.target.value) })}` jadi
 * `onChange={x => setForm({ ...form, x })}`.
 *
 * `allowDecimal`: aktifkan untuk field yang butuh koma desimal (mis. kadar,
 * harga per gram) — pemisah ribuan tetap titik, desimal dipisah koma sesuai
 * konvensi angka Indonesia (10.000,5).
 */
export default function NumberInput({
  value,
  onChange,
  allowDecimal = false,
  className,
  placeholder,
  disabled = false,
  ...rest
}) {
  const [text, setText] = useState(() => formatFromValue(value, allowDecimal));
  const skipNextSync = useRef(false);

  useEffect(() => {
    if (skipNextSync.current) {
      skipNextSync.current = false;
      return;
    }
    setText(formatFromValue(value, allowDecimal));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, allowDecimal]);

  const handleChange = (e) => {
    const raw = e.target.value;
    let cleaned = raw.replace(/\./g, '');

    if (allowDecimal) {
      cleaned = cleaned.replace(/[^\d,-]/g, '');
      const firstComma = cleaned.indexOf(',');
      if (firstComma !== -1) {
        cleaned = cleaned.slice(0, firstComma + 1) + cleaned.slice(firstComma + 1).replace(/,/g, '');
      }
    } else {
      cleaned = cleaned.replace(/[^\d-]/g, '');
    }
    const negative = cleaned.startsWith('-');
    cleaned = (negative ? '-' : '') + cleaned.replace(/-/g, '');

    const [intPart, decPart] = cleaned.replace('-', '').split(',');
    const groupedInt = (negative ? '-' : '') + groupThousands(intPart || '');
    const display = allowDecimal && decPart !== undefined ? `${groupedInt},${decPart}` : groupedInt;
    setText(display);

    const parseable = cleaned.replace(',', '.');
    const numeric = parseable === '' || parseable === '-' ? 0 : Number(parseable);
    skipNextSync.current = true;
    if (typeof onChange === 'function') onChange(Number.isNaN(numeric) ? 0 : numeric);
  };

  const handleBlur = () => setText(formatFromValue(value, allowDecimal));

  return (
    <input
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
