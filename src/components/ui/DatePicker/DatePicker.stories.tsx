import type { Meta, StoryObj } from '@storybook/nextjs';
import { useState } from 'react';
import { fn } from 'storybook/test';

import { today } from '@/lib/date';
import { DatePicker } from './DatePicker';

const meta = {
  title: 'UI/DatePicker',
  component: DatePicker,
  tags: ['autodocs'],
  args: { label: 'Tanggal pembelian', onChange: fn() },
  argTypes: {
    disabled: { control: 'boolean' },
    required: { control: 'boolean' },
  },
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DatePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { required: true } };

export const WithValue: Story = { args: { value: new Date(2026, 7, 10) } };

export const WithHint: Story = {
  args: { hint: 'Tanggal invoice supplier, bukan tanggal barang tiba.' },
};

export const WithError: Story = { args: { error: 'Tanggal pembelian wajib diisi' } };

export const NoFutureDates: Story = {
  args: { maxDate: today(), hint: 'Tanggal di masa depan tidak bisa dipilih.' },
};

export const Disabled: Story = { args: { disabled: true, value: new Date(2026, 7, 10) } };

export const Controlled: Story = {
  render: (args) => {
    function Demo() {
      const [value, setValue] = useState<Date | undefined>(today());
      return <DatePicker {...args} value={value} onChange={setValue} />;
    }
    return <Demo />;
  },
};
