import type { Meta, StoryObj } from '@storybook/html-vite';

type ToastArgs = {
  variant: 'success' | 'info' | 'warning' | 'error';
  message: string;
  position: 'top-end' | 'bottom-end';
  showClose: boolean;
};

const meta = {
  title: 'Components/UI/Toast',
  tags: ["autodocs"],
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['success', 'info', 'warning', 'error'],
    },
    position: {
      control: 'select',
      options: ['top-end', 'bottom-end'],
    },
    showClose: {
      control: 'boolean',
    },
  },
  args: {
    variant: 'success',
    message: 'Storybook toast',
    position: 'bottom-end',
    showClose: true,
  },
} satisfies Meta<ToastArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => {
    const positionClasses =
      args.position === 'top-end' ? 'toast-end toast-top' : 'toast-end toast-bottom';
    const iconPaths: Record<ToastArgs['variant'], string> = {
      success: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
      info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      warning:
        'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
      error: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
    };
    const closeMarkup = args.showClose
      ? '<button class="btn btn-xs btn-ghost" aria-label="Close notification">✕</button>'
      : '';

    return `
      <div class="toast ${positionClasses} z-50">
        <div class="alert alert-${args.variant} shadow-lg">
          <svg class="stroke-current shrink-0 w-6 h-6" fill="none" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${iconPaths[args.variant]}"></path>
          </svg>
          <span>${args.message}</span>
          ${closeMarkup}
        </div>
      </div>
    `;
  },
};

export const WarningTop: Story = {
  args: {
    variant: 'warning',
    message: 'Latency exceeded the target budget.',
    position: 'top-end',
    showClose: false,
  },
  render: Default.render,
};

export const ErrorToast: Story = {
  args: {
    variant: 'error',
    message: 'Provider credentials missing.',
    position: 'bottom-end',
    showClose: true,
  },
  render: Default.render,
};
