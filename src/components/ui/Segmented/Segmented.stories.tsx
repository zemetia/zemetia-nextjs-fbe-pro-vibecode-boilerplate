import type { Meta, StoryObj } from '@storybook/nextjs';
import { useState } from 'react';
import { Globe, Recycle, Warehouse } from 'lucide-react';
import { fn } from 'storybook/test';

import { Badge } from '@/components/ui/Badge';
import { Segmented, type SegmentedOption } from './Segmented';

const PERIODS: SegmentedOption[] = [
  { value: '1d', label: '1 hari' },
  { value: '1w', label: '1 minggu' },
  { value: '1m', label: '1 bulan' },
  { value: '1y', label: '1 tahun' },
  { value: 'all', label: 'Semua' },
];

const meta = {
  title: 'UI/Segmented',
  component: Segmented,
  tags: ['autodocs'],
  args: { options: PERIODS, value: '1d', onValueChange: fn(), 'aria-label': 'Rentang waktu' },
  argTypes: {
    size: { control: 'inline-radio', options: ['sm', 'md'] },
    fullWidth: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Segmented>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Small: Story = { args: { size: 'sm' } };

export const Disabled: Story = { args: { disabled: true } };

export const WithIcons: Story = {
  args: {
    value: 'IMPORT',
    options: [
      { value: 'IMPORT', label: 'Import', icon: <Globe className="h-4 w-4" aria-hidden="true" /> },
      { value: 'LOCAL', label: 'Lokal', icon: <Warehouse className="h-4 w-4" aria-hidden="true" /> },
      { value: 'SCRAP', label: 'Scrap', icon: <Recycle className="h-4 w-4" aria-hidden="true" /> },
    ],
  },
};

export const WithBadges: Story = {
  args: {
    value: 'IMPORT',
    options: [
      {
        value: 'IMPORT',
        label: 'Import',
        badge: (
          <Badge variant="secondary" size="sm">
            12
          </Badge>
        ),
      },
      {
        value: 'LOCAL',
        label: 'Lokal',
        badge: (
          <Badge variant="secondary" size="sm">
            8
          </Badge>
        ),
      },
    ],
  },
};

export const FullWidth: Story = { args: { fullWidth: true } };

export const Controlled: Story = {
  render: (args) => {
    function Demo() {
      const [value, setValue] = useState('1w');
      return <Segmented {...args} value={value} onValueChange={setValue} />;
    }
    return <Demo />;
  },
};
