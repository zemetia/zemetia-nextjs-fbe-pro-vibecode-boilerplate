import Image from 'next/image';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { getSession } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { SignInForm } from './_components/SignInForm';

export const metadata: Metadata = {
  title: 'Masuk',
  robots: { index: false, follow: false },
};

export default async function SignInPage() {
  const session = await getSession();
  if (session?.user?.id) redirect('/admin');

  return (
    <main className="bg-app relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      {/* Cahaya emas lembut di bagian atas — identitas PT TAN */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 45% at 50% -5%, rgba(212,175,55,0.10), transparent 70%)',
        }}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Image
            src="/logo/logo-tan.png"
            alt="Logo PT TAN"
            width={80}
            height={80}
            className="h-20 w-20 shrink-0 select-none object-contain drop-shadow-[0_4px_16px_var(--color-gold-glow)]"
            priority
          />
          <div>
            <h1 className="font-heading text-xl font-bold text-fg">PT TAN ERP</h1>
            <p className="mt-0.5 text-xs text-fg-muted">Export &amp; Trading System</p>
          </div>
        </div>

        <Card accent className="w-full shadow-lg">
          <CardHeader>
            <CardTitle>Masuk</CardTitle>
            <CardDescription>Masuk untuk mengakses panel admin.</CardDescription>
          </CardHeader>
          <CardContent>
            <SignInForm />
          </CardContent>
        </Card>

        <p className="mt-5 text-center text-[11px] text-fg-muted">
          Akses terbatas untuk pengguna internal PT TAN.
        </p>
      </div>
    </main>
  );
}
