import type { Meta, StoryObj } from '@storybook/nextjs';
import { fn } from 'storybook/test';

import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { FORM_ACTION_BUTTON_CLASS, FormActionBar } from './FormActionBar';

const meta = {
  title: 'UI/FormActionBar',
  component: FormActionBar,
  tags: ['autodocs'],
  args: { onCancel: fn(), submitLabel: 'Simpan Draft' },
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-3xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Informasi Order</CardTitle>
          </CardHeader>
          <CardContent className="h-40 text-sm text-foreground-muted">
            Isi form duduk di kartu seperti ini — action bar memakai permukaan yang sama.
          </CardContent>
        </Card>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FormActionBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Submitting: Story = { args: { isSubmitting: true } };

export const WithStatus: Story = {
  args: { children: <span className="text-sm text-foreground-muted">Tersimpan 2 menit lalu</span> },
};

export const WizardStep: Story = {
  args: {
    submitLabel: 'Lanjut',
    onSubmit: fn(),
    actions: (
      <Button type="button" variant="secondary" size="lg" className={FORM_ACTION_BUTTON_CLASS}>
        Kembali
      </Button>
    ),
  },
};
