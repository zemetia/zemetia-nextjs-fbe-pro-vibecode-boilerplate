import Link from 'next/link';
import type { Metadata } from 'next';

import { Typography } from '@/components/ui/Typography';

export const metadata: Metadata = {
  title: 'Halaman tidak ditemukan',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-start justify-center gap-4 px-6">
      <Typography variant="h2">Halaman tidak ditemukan</Typography>
      <Typography variant="muted">
        Alamat yang Anda buka sudah dipindahkan atau tidak pernah ada.
      </Typography>
      <Link
        href="/"
        className="inline-flex h-9 items-center rounded-md border border-border px-4 text-sm font-medium text-foreground transition-colors hover:border-border-strong hover:bg-surface"
      >
        Kembali ke beranda
      </Link>
    </main>
  );
}

NotFound.displayName = 'NotFound';
