import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Helper standar shadcn/ui (aslinya di lib/utils) — ditaruh di src/utils/
// mengikuti struktur yang sudah ada. Menggabung class kondisional; class
// Tailwind yang bentrok dimenangkan yang terakhir.
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
