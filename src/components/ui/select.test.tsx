import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  Select,
  NativeSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';

describe('Select Component', () => {
  it('renders a native select dropdown when given option children', () => {
    const handleChange = vi.fn();
    render(
      <Select
        aria-label="Department"
        value="Refinery"
        onChange={handleChange}
      >
        <option value="Refinery">Refinery</option>
        <option value="Produksi">Produksi</option>
      </Select>
    );

    const select = screen.getByRole('combobox', { name: 'Department' });
    expect(select).toBeInTheDocument();
    expect(select).toHaveValue('Refinery');
  });

  it('triggers onChange when selecting a new option in native mode', async () => {
    const handleChange = vi.fn();
    render(
      <Select
        aria-label="Priority"
        defaultValue="Normal"
        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleChange(e.target.value)}
      >
        <option value="Normal">Normal</option>
        <option value="Urgent">Urgent</option>
      </Select>
    );

    const select = screen.getByRole('combobox', { name: 'Priority' });
    await userEvent.selectOptions(select, 'Urgent');
    expect(handleChange).toHaveBeenCalledWith('Urgent');
  });

  it('renders NativeSelect directly with helper text and error state', () => {
    render(
      <NativeSelect
        aria-label="Test Select"
        error="Field ini wajib diisi"
        helperText="Pilih salah satu opsi"
      >
        <option value="1">Option 1</option>
      </NativeSelect>
    );

    expect(screen.getByText('Field ini wajib diisi')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Test Select' })).toHaveClass('border-danger');
  });

  it('renders Radix Select mode when used with SelectTrigger', () => {
    render(
      <Select>
        <SelectTrigger aria-label="Radix Role">
          <SelectValue placeholder="Choose a role" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="admin">Admin</SelectItem>
        </SelectContent>
      </Select>
    );

    expect(screen.getByRole('combobox', { name: 'Radix Role' })).toBeInTheDocument();
  });
});
