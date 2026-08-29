import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { TagInput } from './TagInput';

function Controlled({
  onValue,
  initial = [],
  ...props
}: {
  onValue?: (value: string[]) => void;
  initial?: string[];
} & Partial<React.ComponentProps<typeof TagInput>>) {
  const [value, setValue] = useState<string[]>(initial);

  return (
    <TagInput
      label="Seri batangan"
      {...props}
      value={value}
      onChange={(next) => {
        setValue(next);
        onValue?.(next);
      }}
    />
  );
}

describe('TagInput', () => {
  it('turns a comma into a chip', async () => {
    render(<Controlled />);

    await userEvent.type(screen.getByLabelText('Seri batangan'), 'LM-0001,');

    expect(screen.getByText('LM-0001')).toBeInTheDocument();
    expect(screen.getByLabelText('Seri batangan')).toHaveValue('');
  });

  it('commits on Enter without submitting the form', async () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Controlled />
      </form>,
    );

    await userEvent.type(screen.getByLabelText('Seri batangan'), 'LM-0001{Enter}');

    expect(screen.getByText('LM-0001')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('splits a pasted comma separated list into chips', async () => {
    const onValue = vi.fn();
    render(<Controlled onValue={onValue} />);

    const field = screen.getByLabelText('Seri batangan');
    await userEvent.click(field);
    await userEvent.paste('LM-0001, LM-0002 , LM-0003');

    expect(onValue).toHaveBeenLastCalledWith(['LM-0001', 'LM-0002', 'LM-0003']);
  });

  it('ignores a duplicate regardless of case', async () => {
    const onValue = vi.fn();
    render(<Controlled initial={['LM-0001']} onValue={onValue} />);

    await userEvent.type(screen.getByLabelText('Seri batangan'), 'lm-0001,');

    expect(screen.getAllByText(/LM-0001/i)).toHaveLength(1);
  });

  it('removes a chip with its x button', async () => {
    const onValue = vi.fn();
    render(<Controlled initial={['LM-0001', 'LM-0002']} onValue={onValue} />);

    await userEvent.click(screen.getByRole('button', { name: 'Hapus LM-0001' }));

    expect(onValue).toHaveBeenLastCalledWith(['LM-0002']);
  });

  it('removes the last chip on backspace in an empty field', async () => {
    const onValue = vi.fn();
    render(<Controlled initial={['LM-0001', 'LM-0002']} onValue={onValue} />);

    await userEvent.type(screen.getByLabelText('Seri batangan'), '{Backspace}');

    expect(onValue).toHaveBeenLastCalledWith(['LM-0001']);
  });

  it('commits a half-typed entry on blur', async () => {
    const onValue = vi.fn();
    render(<Controlled onValue={onValue} />);

    await userEvent.type(screen.getByLabelText('Seri batangan'), 'LM-0009');
    await userEvent.tab();

    expect(onValue).toHaveBeenLastCalledWith(['LM-0009']);
  });

  it('stops accepting entries once maxTags is reached', async () => {
    render(<Controlled initial={['LM-0001', 'LM-0002']} maxTags={2} />);
    expect(screen.getByLabelText('Seri batangan')).toBeDisabled();
  });

  it('shows an error message with role=alert', () => {
    render(<TagInput label="Seri batangan" value={[]} onChange={vi.fn()} error="Seri wajib diisi" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Seri wajib diisi');
  });
});
