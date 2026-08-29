import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Combobox, type ComboboxOption } from './Combobox';

const OPTIONS: ComboboxOption[] = [
  { value: 'nextjs', label: 'Next.js' },
  { value: 'sveltekit', label: 'SvelteKit' },
  { value: 'nuxt', label: 'Nuxt', disabled: true },
];

describe('Combobox', () => {
  it('renders the placeholder when no value is selected', () => {
    render(<Combobox options={OPTIONS} placeholder="Pick a framework" />);
    expect(screen.getByRole('combobox', { name: 'Pick a framework' })).toHaveTextContent(
      'Pick a framework',
    );
  });

  it('renders the selected option label', () => {
    render(<Combobox options={OPTIONS} value="sveltekit" />);
    expect(screen.getByRole('combobox')).toHaveTextContent('SvelteKit');
  });

  it('opens the list and calls onValueChange when an option is selected', async () => {
    const onValueChange = vi.fn();
    render(<Combobox options={OPTIONS} onValueChange={onValueChange} />);

    await userEvent.click(screen.getByRole('combobox'));
    const option = await screen.findByText('Next.js');
    await userEvent.click(option);

    expect(onValueChange).toHaveBeenCalledWith('nextjs');
  });

  it('filters options via the search input', async () => {
    render(<Combobox options={OPTIONS} />);
    await userEvent.click(screen.getByRole('combobox'));

    const search = await screen.findByPlaceholderText('Search…');
    await userEvent.type(search, 'Svelte');

    expect(screen.getByText('SvelteKit')).toBeInTheDocument();
    expect(screen.queryByText('Next.js')).not.toBeInTheDocument();
  });

  it('shows the empty state when nothing matches', async () => {
    render(<Combobox options={OPTIONS} emptyText="Nothing here" />);
    await userEvent.click(screen.getByRole('combobox'));

    const search = await screen.findByPlaceholderText('Search…');
    await userEvent.type(search, 'zzz');

    expect(await screen.findByText('Nothing here')).toBeInTheDocument();
  });

  it('is disabled when disabled prop is true', () => {
    render(<Combobox options={OPTIONS} disabled />);
    expect(screen.getByRole('combobox')).toBeDisabled();
  });
});
