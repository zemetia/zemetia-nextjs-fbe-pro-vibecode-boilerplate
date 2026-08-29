import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { NumberInput } from './NumberInput';

function Controlled({
  onValue,
  ...props
}: { onValue?: (value: number | undefined) => void } & React.ComponentProps<typeof NumberInput>) {
  const [value, setValue] = useState<number | undefined>(undefined);

  return (
    <NumberInput
      {...props}
      value={value}
      onChange={(next) => {
        setValue(next);
        onValue?.(next);
      }}
    />
  );
}

describe('NumberInput', () => {
  it('groups thousands while typing', async () => {
    render(<Controlled label="Jumlah" />);
    const field = screen.getByLabelText('Jumlah');

    await userEvent.type(field, '100000');

    expect(field).toHaveValue('100.000');
  });

  it('reports the parsed number, not the formatted string', async () => {
    const onValue = vi.fn();
    render(<Controlled label="Jumlah" onValue={onValue} />);

    await userEvent.type(screen.getByLabelText('Jumlah'), '1500000');

    expect(onValue).toHaveBeenLastCalledWith(1500000);
  });

  it('formats an externally provided value', () => {
    render(<NumberInput label="Stok" value={1234567} onChange={vi.fn()} />);
    expect(screen.getByLabelText('Stok')).toHaveValue('1.234.567');
  });

  it('ignores non-numeric characters', async () => {
    render(<Controlled label="Jumlah" />);
    const field = screen.getByLabelText('Jumlah');

    await userEvent.type(field, '12ab34');

    expect(field).toHaveValue('1.234');
  });

  it('emits undefined when the field is cleared', async () => {
    const onValue = vi.fn();
    render(<Controlled label="Jumlah" onValue={onValue} />);
    const field = screen.getByLabelText('Jumlah');

    await userEvent.type(field, '250');
    await userEvent.clear(field);

    expect(field).toHaveValue('');
    expect(onValue).toHaveBeenLastCalledWith(undefined);
  });

  it('keeps decimals when decimalScale allows them', async () => {
    const onValue = vi.fn();
    render(<Controlled label="Berat" decimalScale={2} onValue={onValue} />);
    const field = screen.getByLabelText('Berat');

    await userEvent.type(field, '1234,56');

    expect(field).toHaveValue('1.234,56');
    expect(onValue).toHaveBeenLastCalledWith(1234.56);
  });

  it('drops the decimal separator when decimalScale is 0', async () => {
    render(<Controlled label="Jumlah" />);
    const field = screen.getByLabelText('Jumlah');

    await userEvent.type(field, '12,50');

    expect(field).toHaveValue('1.250');
  });

  it('rejects a negative sign unless allowNegative is set', async () => {
    render(<Controlled label="Selisih" />);
    const field = screen.getByLabelText('Selisih');

    await userEvent.type(field, '-500');

    expect(field).toHaveValue('500');
  });

  it('accepts a negative value when allowNegative is set', async () => {
    const onValue = vi.fn();
    render(<Controlled label="Selisih" allowNegative onValue={onValue} />);

    await userEvent.type(screen.getByLabelText('Selisih'), '-1500');

    expect(screen.getByLabelText('Selisih')).toHaveValue('-1.500');
    expect(onValue).toHaveBeenLastCalledWith(-1500);
  });

  it('normalises a half-typed decimal on blur', async () => {
    render(<Controlled label="Berat" decimalScale={2} />);
    const field = screen.getByLabelText('Berat');

    await userEvent.type(field, '1000,');
    await userEvent.tab();

    expect(field).toHaveValue('1.000');
  });

  it('shows an error message with role=alert', () => {
    render(<NumberInput label="Jumlah" value={0} error="Jumlah minimal 1" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Jumlah minimal 1');
  });
});
