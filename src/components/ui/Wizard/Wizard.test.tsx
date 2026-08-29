import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Wizard, type WizardStep } from './Wizard';

const STEPS: WizardStep[] = [
  { id: 'identity', title: 'Identitas' },
  { id: 'contact', title: 'Kontak' },
  { id: 'review', title: 'Tinjau' },
];

function renderWizard(props: Partial<React.ComponentProps<typeof Wizard>> = {}) {
  const handlers = {
    onBack: vi.fn(),
    onNext: vi.fn(),
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    onStepSelect: vi.fn(),
  };

  const view = render(
    <Wizard steps={STEPS} activeStep={0} {...handlers} {...props}>
      <p>Isi langkah</p>
    </Wizard>,
  );

  return { ...view, ...handlers };
}

describe('Wizard', () => {
  it('hides Back on the first step and shows Next', () => {
    renderWizard();
    expect(screen.queryByRole('button', { name: 'Kembali' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lanjut' })).toBeInTheDocument();
  });

  it('swaps Next for Submit on the last step', () => {
    renderWizard({ activeStep: 2, reachedStep: 2, submitLabel: 'Simpan Supplier' });
    expect(screen.queryByRole('button', { name: 'Lanjut' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Simpan Supplier' })).toBeInTheDocument();
  });

  it('calls onNext and onBack from the action bar', async () => {
    const { onNext, onBack } = renderWizard({ activeStep: 1, reachedStep: 1 });

    await userEvent.click(screen.getByRole('button', { name: 'Lanjut' }));
    expect(onNext).toHaveBeenCalledOnce();

    await userEvent.click(screen.getByRole('button', { name: 'Kembali' }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('marks the visible step with aria-current', () => {
    renderWizard({ activeStep: 1, reachedStep: 1 });
    expect(screen.getByRole('button', { name: /Kontak/ })).toHaveAttribute('aria-current', 'step');
  });

  it('lets the user jump back to a reached step but not ahead of it', async () => {
    const { onStepSelect } = renderWizard({ activeStep: 1, reachedStep: 1 });

    await userEvent.click(screen.getByRole('button', { name: /Identitas/ }));
    expect(onStepSelect).toHaveBeenCalledWith(0);

    expect(screen.getByRole('button', { name: /Tinjau/ })).toBeDisabled();
  });

  it('locks navigation while submitting', () => {
    renderWizard({ activeStep: 2, reachedStep: 2, isSubmitting: true });
    expect(screen.getByRole('button', { name: 'Batal' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Kembali' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Identitas/ })).toBeDisabled();
  });

  it('blocks Next while nextDisabled is set', () => {
    renderWizard({ nextDisabled: true });
    expect(screen.getByRole('button', { name: 'Lanjut' })).toBeDisabled();
  });

  it('renders a form-level error as an alert', () => {
    renderWizard({ error: 'Nama supplier wajib diisi.' });
    expect(screen.getByRole('alert')).toHaveTextContent('Nama supplier wajib diisi.');
  });
});
