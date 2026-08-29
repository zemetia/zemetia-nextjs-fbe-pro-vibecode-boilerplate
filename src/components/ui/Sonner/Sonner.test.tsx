import { render, screen } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, describe, expect, it } from 'vitest';

import { Toaster } from './Sonner';

afterEach(() => {
  toast.dismiss();
});

describe('Toaster', () => {
  it('renders a landmark region for notifications', () => {
    render(<Toaster />);
    expect(screen.getByRole('region')).toBeInTheDocument();
  });

  it('displays a toast that is triggered after mount', async () => {
    render(<Toaster />);
    toast.success('Perubahan izin disimpan');
    expect(await screen.findByText('Perubahan izin disimpan')).toBeInTheDocument();
  });

  it('forwards props to the underlying toaster', () => {
    render(<Toaster containerAriaLabel="Notifikasi" />);
    expect(screen.getByRole('region', { name: /Notifikasi/ })).toBeInTheDocument();
  });
});
