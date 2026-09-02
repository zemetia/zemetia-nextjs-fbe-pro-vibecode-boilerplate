// Formatter tampilan. Nilai disimpan sebagai Number mentah — diformat hanya saat dirender.

export const formatIDR = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

export const formatGram = (value, decimals = 2) =>
  `${Number(value || 0).toLocaleString('id-ID', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })} g`;

export const formatUSD = (value, decimals = 2) =>
  `$ ${Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })}`;

