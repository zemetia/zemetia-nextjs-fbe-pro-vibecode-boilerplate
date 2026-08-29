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
    <main className="bg-app flex min-h-screen items-center justify-center p-4">
      <Card accent className="w-full max-w-sm shadow-lg">
        <CardHeader>
          <CardTitle>Masuk</CardTitle>
          <CardDescription>Masuk untuk mengakses panel admin.</CardDescription>
        </CardHeader>
        <CardContent>
          <SignInForm />
        </CardContent>
      </Card>
    </main>
  );
}
