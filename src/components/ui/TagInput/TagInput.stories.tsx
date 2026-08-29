import type { Meta, StoryObj } from '@storybook/nextjs';
import { useState } from 'react';
import { fn } from 'storybook/test';

import { TagInput } from './TagInput';

const meta = {
  title: 'UI/TagInput',
  component: TagInput,
  tags: ['autodocs'],
  args: { value: [], onChange: fn(), label: 'Seri batangan' },
  argTypes: {
    disabled: { control: 'boolean' },
    required: { control: 'boolean' },
  },
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="max-w-xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TagInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { hint: 'Pisahkan dengan koma — bisa juga tempel langsung dari invoice.' },
};

export const WithTags: Story = {
  args: { value: ['LM-2026-0001', 'LM-2026-0002', 'LM-2026-0003'] },
};

export const WithError: Story = {
  args: { value: [], error: 'Seri batangan wajib diisi', required: true },
};

export const Limited: Story = {
  args: { value: ['LM-0001', 'LM-0002'], maxTags: 3, hint: 'Maksimal 3 seri.' },
};

export const Disabled: Story = { args: { value: ['LM-0001'], disabled: true } };

export const Controlled: Story = {
  render: (args) => {
    function Demo() {
      const [value, setValue] = useState<string[]>(['LM-2026-0001']);
      return <TagInput {...args} value={value} onChange={setValue} />;
    }
    return <Demo />;
  },
};
