import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { DatePicker } from './DatePicker';

function Controlled({ onValue }: { onValue?: (value: Date | undefined) => void }) {
  const [value, setValue] = useState<Date | undefined>(new Date(2026, 7, 10));

  return (
    <DatePicker
      label="Tanggal pembelian"
      value={value}
      onChange={(next) => {
        setValue(next);
        onValue?.(next);
      }}
    />
  );
}

describe('DatePicker', () => {
  it('shows the placeholder while nothing is selected', () => {
    render(<DatePicker label="Tanggal pembelian" />);
    expect(screen.getByLabelText('Tanggal pembelian')).toHaveTextContent('Pilih tanggal');
  });

  it('shows the selected day in Indonesian', () => {
    render(<DatePicker label="Tanggal pembelian" value={new Date(2026, 7, 10)} />);
    expect(screen.getByLabelText('Tanggal pembelian')).toHaveTextContent('10 Agustus 2026');
  });

  it('reports the day the user picks and closes the popover', async () => {
    const onValue = vi.fn();
    render(<Controlled onValue={onValue} />);

    await userEvent.click(screen.getByLabelText('Tanggal pembelian'));
    const grid = await screen.findByRole('grid');
    await userEvent.click(within(grid).getByText('15'));

    const picked = onValue.mock.calls.at(-1)?.[0] as Date;
    expect(picked.getDate()).toBe(15);
    expect(picked.getMonth()).toBe(7);
    expect(screen.getByLabelText('Tanggal pembelian')).toHaveTextContent('15 Agustus 2026');
  });

  it('shows an error message with role=alert', () => {
    render(<DatePicker label="Tanggal pembelian" error="Tanggal pembelian wajib diisi" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Tanggal pembelian wajib diisi');
  });

  it('jumps months through the month panel instead of clicking the arrow twelve times', async () => {
    render(<Controlled />);

    await userEvent.click(screen.getByLabelText('Tanggal pembelian'));
    await userEvent.click(await screen.findByRole('button', { name: 'Agustus' }));
    await userEvent.click(screen.getByRole('button', { name: 'Jan' }));

    expect(screen.getByRole('button', { name: 'Januari' })).toBeInTheDocument();
  });

  it('clears an optional value from the footer', async () => {
    const onValue = vi.fn();
    render(<Controlled onValue={onValue} />);

    await userEvent.click(screen.getByLabelText('Tanggal pembelian'));
    await userEvent.click(await screen.findByRole('button', { name: 'Hapus' }));

    expect(onValue).toHaveBeenLastCalledWith(undefined);
    expect(screen.getByLabelText('Tanggal pembelian')).toHaveTextContent('Pilih tanggal');
  });

  it('keeps a required field free of the clear affordance', () => {
    render(<DatePicker label="Tanggal pembelian" required value={new Date(2026, 7, 10)} />);
    expect(screen.queryByLabelText('Hapus tanggal')).not.toBeInTheDocument();
  });

  it('does not open while disabled', async () => {
    render(<DatePicker label="Tanggal pembelian" disabled />);

    await userEvent.click(screen.getByLabelText('Tanggal pembelian'));

    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
  });
});
