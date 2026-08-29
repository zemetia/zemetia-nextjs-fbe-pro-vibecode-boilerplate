import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FormActionBar } from './FormActionBar';

describe('FormActionBar', () => {
  it('submits the surrounding form when no onSubmit is given', async () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <FormActionBar onCancel={vi.fn()} submitLabel="Simpan Draft" />
      </form>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Simpan Draft' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('calls onSubmit instead of submitting when it is given', async () => {
    const onFormSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const onSubmit = vi.fn();
    render(
      <form onSubmit={onFormSubmit}>
        <FormActionBar onCancel={vi.fn()} onSubmit={onSubmit} />
      </form>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Simpan' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onFormSubmit).not.toHaveBeenCalled();
  });

  it('reports a cancel', async () => {
    const onCancel = vi.fn();
    render(<FormActionBar onCancel={onCancel} />);

    await userEvent.click(screen.getByRole('button', { name: 'Batal' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('locks both buttons while submitting', () => {
    render(<FormActionBar onCancel={vi.fn()} isSubmitting />);

    expect(screen.getByRole('button', { name: 'Batal' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Simpan' })).toBeDisabled();
  });

  it('disables only the submit button when submitDisabled', () => {
    render(<FormActionBar onCancel={vi.fn()} submitDisabled />);

    expect(screen.getByRole('button', { name: 'Batal' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Simpan' })).toBeDisabled();
  });

  it('renders the left slot and the extra actions', () => {
    render(
      <FormActionBar
        onCancel={vi.fn()}
        actions={<button type="button">Kembali</button>}
      >
        <span>Tersimpan 2 menit lalu</span>
      </FormActionBar>,
    );

    expect(screen.getByText('Tersimpan 2 menit lalu')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kembali' })).toBeInTheDocument();
  });
});
