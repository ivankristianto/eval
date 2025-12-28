import type { Meta, StoryObj } from '@storybook/html-vite';

type BadgeArgs = {
  label: string;
  variant:
    | 'primary'
    | 'secondary'
    | 'accent'
    | 'ghost'
    | 'soft'
    | 'info'
    | 'success'
    | 'warning'
    | 'error'
    | 'neutral';
  size: 'lg' | 'md' | 'sm' | 'xs';
  outline: boolean;
};

const meta = {
  title: 'Components/UI/Badge',
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'primary',
        'secondary',
        'accent',
        'ghost',
        'soft',
        'info',
        'success',
        'warning',
        'error',
        'neutral',
      ],
    },
    size: {
      control: 'select',
      options: ['lg', 'md', 'sm', 'xs'],
    },
    outline: {
      control: 'boolean',
    },
  },
  args: {
    label: 'Completed',
    variant: 'success',
    size: 'sm',
    outline: false,
  },
} satisfies Meta<BadgeArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Status: Story = {
  render: (args) => {
    const statusVariants = ['success', 'warning', 'error', 'info'];
    const isStatus = statusVariants.includes(args.variant);
    const classes = [
      'badge',
      `badge-${args.variant}`,
      `badge-${args.size}`,
      args.outline ? 'badge-outline' : '',
      isStatus ? 'font-mono font-semibold uppercase tracking-wide' : '',
    ]
      .filter(Boolean)
      .join(' ');

    return `<span class="${classes}">${args.label}</span>`;
  },
};

export const Outline: Story = {
  args: {
    label: 'Pending',
    variant: 'warning',
    size: 'md',
    outline: true,
  },
  render: Status.render,
};

export const NeutralSmall: Story = {
  args: {
    label: 'Queued',
    variant: 'neutral',
    size: 'xs',
    outline: false,
  },
  render: Status.render,
};
