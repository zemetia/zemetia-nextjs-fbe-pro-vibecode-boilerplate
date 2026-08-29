import type { Meta, StoryObj } from '@storybook/nextjs';
import { fn } from 'storybook/test';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormModal } from './FormModal';

const meta = {
  title: 'UI/FormModal',
  component: FormModal,
  tags: ['autodocs'],
  args: {
    open: true,
    onOpenChange: fn(),
    onSubmit: fn(),
    title: 'Tambah Pengguna',
    description: 'Isi data pengguna baru. Password awal dikirim lewat jalur aman.',
    children: null,
  },
  argTypes: {
    size: { control: 'select', options: ['sm', 'md', 'lg', 'xl'] },
    isSubmitting: { control: 'boolean' },
  },
  parameters: { layout: 'centered' },
} satisfies Meta<typeof FormModal>;

export default meta;
type Story = StoryObj<typeof meta>;

const fields = (
  <>
    <Input label="Nama" required placeholder="mis. Rina Wijaya" />
    <Input type="email" label="Email" required placeholder="rina@tan.co.id" />
  </>
);

export const Default: Story = { args: { children: fields } };

export const Submitting: Story = { args: { children: fields, isSubmitting: true } };

export const WithError: Story = {
  args: { children: fields, error: 'Email sudah terdaftar pada pengguna lain.' },
};

export const Large: Story = { args: { children: fields, size: 'lg' } };

export const Triggered: Story = {
  args: { children: fields },
  render: (args) => {
    function Demo() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <Button onClick={() => setOpen(true)}>Tambah Pengguna</Button>
          <FormModal
            {...args}
            open={open}
            onOpenChange={setOpen}
            onSubmit={(event) => {
              event.preventDefault();
              setOpen(false);
            }}
          />
        </>
      );
    }
    return <Demo />;
  },
};
