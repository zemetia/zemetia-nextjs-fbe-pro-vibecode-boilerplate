import type { Meta, StoryObj } from '@storybook/nextjs';
import { fn } from 'storybook/test';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from './ConfirmDialog';

const meta = {
  title: 'UI/ConfirmDialog',
  component: ConfirmDialog,
  tags: ['autodocs'],
  args: {
    open: true,
    onOpenChange: fn(),
    onConfirm: fn(),
    title: 'Hapus data?',
  },
  argTypes: {
    tone: { control: 'select', options: ['danger', 'warning', 'info'] },
    isConfirming: { control: 'boolean' },
  },
  parameters: { layout: 'centered' },
} satisfies Meta<typeof ConfirmDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Delete: Story = {
  args: {
    title: 'Hapus role Supervisor?',
    description: 'Role ini akan dihapus permanen dan tidak bisa dikembalikan.',
    confirmLabel: 'Hapus',
  },
};

export const Update: Story = {
  args: {
    tone: 'warning',
    title: 'Ubah role pengguna?',
    description: 'Izin pengguna berubah seketika setelah disimpan.',
    confirmLabel: 'Ubah role',
  },
};

export const Synchronize: Story = {
  args: {
    tone: 'info',
    title: 'Sinkronkan katalog produk?',
    description: 'Proses ini menarik seluruh data dari sistem pusat dan bisa memakan waktu.',
    confirmLabel: 'Sinkronkan',
  },
};

export const Confirming: Story = {
  args: { description: 'Sedang memproses…', isConfirming: true },
};

export const TypeToConfirm: Story = {
  args: {
    title: 'Hapus seluruh data stok?',
    description: '12.480 baris stok akan dihapus permanen dari semua gudang.',
    confirmLabel: 'Hapus permanen',
    confirmationText: 'HAPUS STOK',
  },
};

export const Triggered: Story = {
  render: (args) => {
    function Demo() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <Button variant="destructive" onClick={() => setOpen(true)}>
            Hapus
          </Button>
          <ConfirmDialog
            {...args}
            open={open}
            onOpenChange={setOpen}
            onConfirm={() => setOpen(false)}
          />
        </>
      );
    }
    return <Demo />;
  },
};
