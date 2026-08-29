import type { Meta, StoryObj } from '@storybook/nextjs';
import { fn } from 'storybook/test';
import { useState } from 'react';

import { Combobox, type ComboboxOption } from './Combobox';

const FRAMEWORKS: ComboboxOption[] = [
  { value: 'nextjs', label: 'Next.js' },
  { value: 'sveltekit', label: 'SvelteKit' },
  { value: 'nuxt', label: 'Nuxt' },
  { value: 'remix', label: 'Remix' },
  { value: 'astro', label: 'Astro' },
  { value: 'vue', label: 'Vue' },
  { value: 'angular', label: 'Angular', disabled: true },
];

const meta = {
  title: 'UI/Combobox',
  component: Combobox,
  tags: ['autodocs'],
  args: { options: FRAMEWORKS, onValueChange: fn() },
  argTypes: {
    disabled: { control: 'boolean' },
    loading: { control: 'boolean' },
  },
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof Combobox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { placeholder: 'Select a framework…' },
  render: (args) => (
    <div className="w-72">
      <Combobox {...args} />
    </div>
  ),
};

export const WithSelection: Story = {
  args: { value: 'nextjs' },
  render: (args) => (
    <div className="w-72">
      <Combobox {...args} />
    </div>
  ),
};

export const Loading: Story = {
  args: { loading: true },
  render: (args) => (
    <div className="w-72">
      <Combobox {...args} />
    </div>
  ),
};

export const Disabled: Story = {
  args: { disabled: true, value: 'nextjs' },
  render: (args) => (
    <div className="w-72">
      <Combobox {...args} />
    </div>
  ),
};

export const Controlled: Story = {
  render: (args) => {
    function Demo() {
      const [value, setValue] = useState<string | null>(null);
      return (
        <div className="w-72">
          <Combobox {...args} value={value} onValueChange={setValue} />
        </div>
      );
    }
    return <Demo />;
  },
};
