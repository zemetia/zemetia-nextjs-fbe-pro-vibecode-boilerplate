// Formatter tampilan. Nilai disimpan sebagai Number mentah — diformat hanya saat dirender.

export const formatIDR = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;
