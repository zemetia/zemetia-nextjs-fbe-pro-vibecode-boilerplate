import { render, renderHook, screen } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, describe, expect, it } from 'vitest';

import { ApiError } from '@/services';
import { Toaster } from '@/components/ui/Sonner';
import { useToast } from './useToast';

afterEach(() => {
  toast.dismiss();
});

describe('useToast', () => {
  it('keeps a stable identity across renders', () => {
    const { result, rerender } = renderHook(() => useToast());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it('shows a success toast', async () => {
    render(<Toaster />);
    const { result } = renderHook(() => useToast());

    result.current.success('Role berhasil dibuat');

    expect(await screen.findByText('Role berhasil dibuat')).toBeInTheDocument();
  });

  describe('apiError', () => {
    it('shows the message returned by the route handler', async () => {
      render(<Toaster />);
      const { result } = renderHook(() => useToast());

      result.current.apiError(
        new ApiError(409, 'Request failed', {
          error: 'Super Admin terakhir tidak bisa dinonaktifkan',
        }),
        'Gagal mengubah status pengguna.',
      );

      expect(
        await screen.findByText('Super Admin terakhir tidak bisa dinonaktifkan'),
      ).toBeInTheDocument();
    });

    it('falls back when the error has no API message', async () => {
      render(<Toaster />);
      const { result } = renderHook(() => useToast());

      result.current.apiError(new Error('network down'), 'Gagal mengubah status pengguna.');

      expect(await screen.findByText('Gagal mengubah status pengguna.')).toBeInTheDocument();
    });
  });
});
