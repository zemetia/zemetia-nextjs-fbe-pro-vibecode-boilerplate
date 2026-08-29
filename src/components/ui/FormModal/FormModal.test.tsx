import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Input } from '@/components/ui/Input';
import { FormModal } from './FormModal';

function renderModal(props: Partial<React.ComponentProps<typeof FormModal>> = {}) {
  const onOpenChange = vi.fn();
  const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault());

  render(
    <FormModal
      open
      onOpenChange={onOpenChange}
      onSubmit={onSubmit}
      title="Tambah Pengguna"
      description="Isi data pengguna baru."
      {...props}
    >
      <Input label="Nama" />
    </FormModal>,
  );

  return { onOpenChange, onSubmit };
}

describe('FormModal', () => {
  it('renders title, description and children when open', () => {
    renderModal();
    expect(screen.getByRole('dialog', { name: 'Tambah Pengguna' })).toBeInTheDocument();
    expect(screen.getByText('Isi data pengguna baru.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nama')).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    renderModal({ open: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('submits the form when the submit button is clicked', async () => {
    const { onSubmit } = renderModal({ submitLabel: 'Buat' });
    await userEvent.click(screen.getByRole('button', { name: 'Buat' }));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('closes when cancel is clicked', async () => {
    const { onOpenChange } = renderModal();
    await userEvent.click(screen.getByRole('button', { name: 'Batal' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('disables both actions while submitting', () => {
    renderModal({ isSubmitting: true });
    expect(screen.getByRole('button', { name: 'Batal' })).toBeDisabled();
    const submit = screen.getByRole('button', { name: 'Simpan' });
    expect(submit).toBeDisabled();
    expect(submit).toHaveAttribute('aria-busy', 'true');
  });

  it('does not close on escape while submitting', async () => {
    const { onOpenChange } = renderModal({ isSubmitting: true });
    await userEvent.keyboard('{Escape}');
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('disables submit when submitDisabled is set', () => {
    renderModal({ submitDisabled: true });
    expect(screen.getByRole('button', { name: 'Simpan' })).toBeDisabled();
  });

  it('shows a form-level error as an alert', () => {
    renderModal({ error: 'Email sudah terdaftar.' });
    expect(screen.getByRole('alert')).toHaveTextContent('Email sudah terdaftar.');
  });

  it('renders a custom footer instead of the default actions', () => {
    renderModal({ footer: <button type="button">Lanjut</button> });
    expect(screen.getByRole('button', { name: 'Lanjut' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Simpan' })).not.toBeInTheDocument();
  });
});
