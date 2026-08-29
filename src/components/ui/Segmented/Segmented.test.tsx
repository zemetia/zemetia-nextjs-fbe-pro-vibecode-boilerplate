import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Segmented, type SegmentedOption } from './Segmented';

const OPTIONS: SegmentedOption[] = [
  { value: 'import', label: 'Import' },
  { value: 'local', label: 'Lokal' },
  { value: 'scrap', label: 'Scrap' },
];

function setup(overrides: Partial<React.ComponentProps<typeof Segmented>> = {}) {
  const onValueChange = vi.fn();
  render(
    <Segmented
      options={OPTIONS}
      value="import"
      onValueChange={onValueChange}
      aria-label="Jenis pembelian"
      {...overrides}
    />,
  );
  return { onValueChange };
}

describe('Segmented', () => {
  it('marks only the selected option as checked', () => {
    setup();

    expect(screen.getByRole('radio', { name: 'Import' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Lokal' })).not.toBeChecked();
  });

  it('reports the clicked value', async () => {
    const { onValueChange } = setup();

    await userEvent.click(screen.getByRole('radio', { name: 'Scrap' }));

    expect(onValueChange).toHaveBeenCalledWith('scrap');
  });

  it('moves the selection with the arrow keys', async () => {
    const { onValueChange } = setup();

    await userEvent.click(screen.getByRole('radio', { name: 'Import' }));
    await userEvent.keyboard('{ArrowRight}');

    expect(onValueChange).toHaveBeenLastCalledWith('local');
  });

  it('wraps around when arrowing past the first option', async () => {
    const { onValueChange } = setup();

    await userEvent.click(screen.getByRole('radio', { name: 'Import' }));
    await userEvent.keyboard('{ArrowLeft}');

    expect(onValueChange).toHaveBeenLastCalledWith('scrap');
  });

  it('skips a disabled option while arrowing', async () => {
    const { onValueChange } = setup({
      options: OPTIONS.map((option) =>
        option.value === 'local' ? { ...option, disabled: true } : option,
      ),
    });

    await userEvent.click(screen.getByRole('radio', { name: 'Import' }));
    await userEvent.keyboard('{ArrowRight}');

    expect(onValueChange).toHaveBeenLastCalledWith('scrap');
  });

  it('does not report a value while disabled', async () => {
    const { onValueChange } = setup({ disabled: true });

    await userEvent.click(screen.getByRole('radio', { name: 'Lokal' }));

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('exposes the group under its label', () => {
    setup();
    expect(screen.getByRole('radiogroup', { name: 'Jenis pembelian' })).toBeInTheDocument();
  });
});
