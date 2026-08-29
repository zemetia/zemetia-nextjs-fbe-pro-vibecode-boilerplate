import type { Meta, StoryObj } from '@storybook/nextjs';
import { useState } from 'react';

import { NumberInput } from './NumberInput';

const meta = {
  title: 'UI/NumberInput',
  component: NumberInput,
  tags: ['autodocs'],
  argTypes: {
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    decimalScale: { control: { type: 'number', min: 0, max: 4 } },
    allowNegative: { control: 'boolean' },
    disabled: { control: 'boolean' },
    required: { control: 'boolean' },
  },
} satisfies Meta<typeof NumberInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: 'Jumlah',
    placeholder: '0',
  },
};

export const WithValue: Story = {
  args: {
    label: 'Stok awal',
    value: 100000,
  },
};

export const Currency: Story = {
  args: {
    label: 'Harga jual',
    leftAddon: <span className="text-sm">Rp</span>,
    value: 1250000,
  },
};

export const WithDecimals: Story = {
  args: {
    label: 'Berat',
    decimalScale: 2,
    rightAddon: <span className="text-sm">gram</span>,
    value: 12.75,
  },
};

export const WithError: Story = {
  args: {
    label: 'Kuantitas',
    value: 0,
    error: 'Kuantitas minimal 1',
  },
};

export const Interactive: Story = {
  args: { label: 'Harga beli' },
  render: function Render(args) {
    const [value, setValue] = useState<number | undefined>(undefined);

    return (
      <div className="flex w-80 flex-col gap-2">
        <NumberInput {...args} value={value} onChange={setValue} placeholder="0" />
        <p className="text-xs text-foreground-subtle">
          Nilai yang dikirim ke form: {value === undefined ? '—' : String(value)}
        </p>
      </div>
    );
  },
};
