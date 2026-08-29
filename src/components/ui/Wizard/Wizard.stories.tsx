import type { Meta, StoryObj } from '@storybook/nextjs';
import { fn } from 'storybook/test';
import { useState } from 'react';

import { Input } from '@/components/ui/Input';
import { Wizard, type WizardStep } from './Wizard';

const STEPS: WizardStep[] = [
  { id: 'identity', title: 'Identitas', description: 'Data dasar supplier.' },
  { id: 'contact', title: 'Kontak & Alamat', description: 'Boleh dilengkapi nanti.' },
  { id: 'finance', title: 'Termin & Bank', description: 'Boleh dilengkapi nanti.' },
  { id: 'review', title: 'Tinjau', description: 'Periksa sebelum disimpan.' },
];

const meta = {
  title: 'UI/Wizard',
  component: Wizard,
  tags: ['autodocs'],
  args: {
    steps: STEPS,
    activeStep: 0,
    onBack: fn(),
    onNext: fn(),
    onSubmit: fn(),
    onCancel: fn(),
    onStepSelect: fn(),
    children: <Input label="Nama supplier" placeholder="PT Emas Nusantara" required />,
  },
  argTypes: {
    activeStep: { control: { type: 'number', min: 0, max: 3 } },
    isSubmitting: { control: 'boolean' },
  },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Wizard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FirstStep: Story = {};

export const MiddleStep: Story = {
  args: { activeStep: 1, reachedStep: 2 },
};

export const LastStep: Story = {
  args: { activeStep: 3, reachedStep: 3, submitLabel: 'Simpan Supplier' },
};

export const WithError: Story = {
  args: { error: 'Nama supplier wajib diisi.' },
};

export const Submitting: Story = {
  args: { activeStep: 3, reachedStep: 3, isSubmitting: true },
};

export const Interactive: Story = {
  render: (args) => {
    function Demo() {
      const [step, setStep] = useState(0);
      const [reached, setReached] = useState(0);

      const goTo = (next: number) => {
        setStep(next);
        setReached((highest) => Math.max(highest, next));
      };

      return (
        <Wizard
          {...args}
          activeStep={step}
          reachedStep={reached}
          onStepSelect={goTo}
          onBack={() => goTo(step - 1)}
          onNext={() => goTo(step + 1)}
        >
          <Input label={STEPS[step]?.title} placeholder="…" />
        </Wizard>
      );
    }
    return <Demo />;
  },
};
