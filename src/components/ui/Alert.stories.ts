import type { Meta, StoryObj } from '@storybook/html';

type AlertArgs = {
  variant: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  message: string;
};

const meta = {
  title: 'UI/Alert',
  argTypes: {
    variant: {
      control: 'select',
      options: ['info', 'success', 'warning', 'error'],
    },
  },
  args: {
    variant: 'info',
    title: 'Evaluation queued',
    message: 'Your evaluation is waiting for an available worker.',
  },
} satisfies Meta<AlertArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Informational: Story = {
  render: (args) => {
    const iconPaths: Record<AlertArgs['variant'], string> = {
      info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      success: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
      warning:
        'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
      error: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
    };

    const titleMarkup = args.title ? `<h3 class="font-bold">${args.title}</h3>` : '';

    return `
      <div role="alert" class="alert alert-${args.variant}">
        <svg class="stroke-current shrink-0 w-6 h-6" fill="none" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${iconPaths[args.variant]}"></path>
        </svg>
        <div>
          ${titleMarkup}
          <div class="text-xs">${args.message}</div>
        </div>
      </div>
    `;
  },
};
