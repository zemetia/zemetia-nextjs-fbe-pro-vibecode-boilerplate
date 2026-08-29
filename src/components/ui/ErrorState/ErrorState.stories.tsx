import type { Meta, StoryObj } from '@storybook/nextjs';
import { fn } from 'storybook/test';

import { ErrorState } from './ErrorState';

const meta = {
  title: 'UI/ErrorState',
  component: ErrorState,
  tags: ['autodocs'],
  args: {
    message: 'Data pengguna gagal dimuat. Coba lagi beberapa saat lagi.',
  },
  argTypes: {
    variant: { control: 'inline-radio', options: ['panel', 'inline'] },
  },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof ErrorState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Panel: Story = {};

export const WithTitle: Story = {
  args: {
    title: 'Gagal memuat data',
    message: 'Tidak bisa terhubung ke server. Periksa koneksi Anda lalu coba lagi.',
  },
};

export const WithRetry: Story = {
  args: {
    title: 'Gagal memuat data',
    message: 'Tidak bisa terhubung ke server. Periksa koneksi Anda lalu coba lagi.',
    onRetry: fn(),
  },
};

export const Inline: Story = {
  args: {
    variant: 'inline',
    message: 'Daftar role gagal dimuat.',
    onRetry: fn(),
  },
};
