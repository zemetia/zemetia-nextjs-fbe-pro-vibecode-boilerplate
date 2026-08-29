import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ConfirmDialog } from './ConfirmDialog';

function renderDialog(props: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
  const onOpenChange = vi.fn();
  const onConfirm = vi.fn();

  const view = render(
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      title="Hapus role Supervisor?"
      description="Role ini akan dihapus permanen."
      {...props}
    />,
  );

  return { ...view, onOpenChange, onConfirm };
}

describe('ConfirmDialog', () => {
  it('renders title and description when open', () => {
    renderDialog();
    expect(screen.getByRole('dialog', { name: 'Hapus role Supervisor?' })).toBeInTheDocument();
    expect(screen.getByText('Role ini akan dihapus permanen.')).toBeInTheDocument();
  });

  it('calls onConfirm when the confirm button is clicked', async () => {
    const { onConfirm } = renderDialog({ confirmLabel: 'Hapus' });
    await userEvent.click(screen.getByRole('button', { name: 'Hapus' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('closes when cancel is clicked', async () => {
    const { onOpenChange } = renderDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Batal' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('disables both actions while confirming', () => {
    renderDialog({ isConfirming: true });
    expect(screen.getByRole('button', { name: 'Batal' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Konfirmasi' })).toBeDisabled();
  });

  it('renders no confirmation input by default', () => {
    renderDialog();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  describe('type-to-confirm', () => {
    it('keeps confirm disabled until the exact text is typed', async () => {
      const { onConfirm } = renderDialog({ confirmationText: 'HAPUS STOK' });

      const confirm = screen.getByRole('button', { name: 'Konfirmasi' });
      expect(confirm).toBeDisabled();

      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'hapus stok');
      expect(confirm).toBeDisabled();

      await userEvent.clear(input);
      await userEvent.type(input, 'HAPUS STOK');
      expect(confirm).toBeEnabled();

      await userEvent.click(confirm);
      expect(onConfirm).toHaveBeenCalledOnce();
    });

    it('ignores surrounding whitespace', async () => {
      renderDialog({ confirmationText: 'HAPUS' });
      await userEvent.type(screen.getByRole('textbox'), '  HAPUS  ');
      expect(screen.getByRole('button', { name: 'Konfirmasi' })).toBeEnabled();
    });

    it('resets the typed text when the dialog closes', async () => {
      const { rerender } = renderDialog({ confirmationText: 'HAPUS' });
      await userEvent.type(screen.getByRole('textbox'), 'HAPUS');

      rerender(
        <ConfirmDialog
          open={false}
          onOpenChange={vi.fn()}
          onConfirm={vi.fn()}
          title="Hapus role Supervisor?"
          confirmationText="HAPUS"
        />,
      );
      rerender(
        <ConfirmDialog
          open
          onOpenChange={vi.fn()}
          onConfirm={vi.fn()}
          title="Hapus role Supervisor?"
          confirmationText="HAPUS"
        />,
      );

      expect(screen.getByRole('textbox')).toHaveValue('');
      expect(screen.getByRole('button', { name: 'Konfirmasi' })).toBeDisabled();
    });
  });
});
