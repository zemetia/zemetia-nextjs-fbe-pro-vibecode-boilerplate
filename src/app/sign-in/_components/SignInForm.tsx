'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Route } from 'next';
import { signIn } from 'next-auth/react';

import { loginSchema } from '@/lib/validations';
import { useFormErrors, useToast, zodFieldErrors } from '@/hooks';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { errors, validate } = useFormErrors(() =>
    zodFieldErrors(loginSchema, { email, password }),
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!validate()) return;
    setIsSubmitting(true);

    const response = await signIn('credentials', { email, password, redirect: false });
    setIsSubmitting(false);

    if (!response || response.error) {
      toast.error('Email atau password salah.');
      return;
    }

    // Only same-origin paths. `//host` is protocol-relative and would leave the
    // site, so a single leading slash is required.
    const callbackUrl = searchParams.get('callbackUrl');
    const isInternal = callbackUrl?.startsWith('/') && !callbackUrl.startsWith('//');
    router.push(isInternal ? (callbackUrl as Route) : '/admin');
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        type="email"
        label="Email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errors.email}
        autoComplete="email"
      />
      <Input
        type="password"
        label="Password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors.password}
        autoComplete="current-password"
      />
      <Button type="submit" fullWidth isLoading={isSubmitting}>
        Masuk
      </Button>
    </form>
  );
}

SignInForm.displayName = 'SignInForm';
