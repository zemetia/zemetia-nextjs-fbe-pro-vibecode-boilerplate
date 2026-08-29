import type { Meta, StoryObj } from '@storybook/nextjs';
import { toast } from 'sonner';

import { Button } from '@/components/ui/Button';
import { Toaster } from './Sonner';

const meta = {
  title: 'UI/Toaster',
  component: Toaster,
  tags: ['autodocs'],
  argTypes: {
    position: {
      control: 'select',
      options: ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'],
    },
    closeButton: { control: 'boolean' },
  },
} satisfies Meta<typeof Toaster>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <>
      <Toaster {...args} />
      <Button onClick={() => toast('Role berhasil diperbarui')}>Tampilkan toast</Button>
    </>
  ),
};

export const AllVariants: Story = {
  render: (args) => (
    <>
      <Toaster {...args} />
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={() => toast.success('Perubahan izin disimpan')}>
          Success
        </Button>
        <Button variant="outline" onClick={() => toast.error('Gagal menyimpan perubahan')}>
          Error
        </Button>
        <Button variant="outline" onClick={() => toast.warning('Role ini masih dipakai pengguna')}>
          Warning
        </Button>
        <Button variant="outline" onClick={() => toast.info('Izin hanya berlaku setelah login ulang')}>
          Info
        </Button>
        <Button variant="outline" onClick={() => toast.loading('Menyimpan…')}>
          Loading
        </Button>
      </div>
    </>
  ),
};

export const WithCloseButton: Story = {
  args: { closeButton: true },
  render: (args) => (
    <>
      <Toaster {...args} />
      <Button onClick={() => toast('Bisa ditutup manual')}>Tampilkan toast</Button>
    </>
  ),
};
