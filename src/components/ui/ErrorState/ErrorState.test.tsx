import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ErrorState } from './ErrorState';

describe('ErrorState', () => {
  it('renders the message inside an alert region', () => {
    render(<ErrorState message="Data pengguna gagal dimuat." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Data pengguna gagal dimuat.');
  });

  it('renders the title alongside the message', () => {
    render(<ErrorState title="Gagal memuat data" message="Coba lagi beberapa saat lagi." />);
    expect(screen.getByText('Gagal memuat data')).toBeInTheDocument();
    expect(screen.getByText('Coba lagi beberapa saat lagi.')).toBeInTheDocument();
  });

  it('hides the retry button when no handler is given', () => {
    render(<ErrorState message="Gagal memuat." />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('calls onRetry when the retry button is pressed', async () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Gagal memuat." onRetry={onRetry} />);

    await userEvent.click(screen.getByRole('button', { name: 'Coba lagi' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
