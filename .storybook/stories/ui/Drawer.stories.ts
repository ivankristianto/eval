import type { Meta, StoryObj } from '@storybook/html-vite';

type DrawerArgs = {
  title: string;
  description: string;
  footerLabel: string;
  showFooter: boolean;
};

const meta = {
  title: 'Components/UI/Drawer',
  tags: ["autodocs"],
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    showFooter: {
      control: 'boolean',
    },
  },
  args: {
    title: 'Evaluation Details',
    description: 'Review the evaluation summary, metrics, and notes in this panel.',
    footerLabel: 'Close',
    showFooter: true,
  },
} satisfies Meta<DrawerArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => `
    <div class="relative min-h-[420px] bg-base-200">
      <div class="absolute inset-0 bg-black/80 backdrop-blur-sm z-[60]"></div>
      <div class="absolute top-0 right-0 h-full w-full max-w-md bg-base-100 z-[70] flex flex-col shadow-xl">
        <div class="flex items-center justify-between p-6 border-b border-gold-light">
          <h2 class="font-display text-2xl font-semibold text-gradient-gold">${args.title}</h2>
          <button type="button" class="btn btn-ghost btn-sm btn-circle" aria-label="Close">
            <svg class="stroke-current shrink-0 w-5 h-5" fill="none" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        <div class="flex-1 overflow-y-auto p-6">
          <p class="text-sm text-base-content/80">
            ${args.description}
          </p>
        </div>
        ${args.showFooter ? `
        <div class="p-6 border-t border-gold-light flex justify-end">
          <button class="btn btn-ghost btn-sm">${args.footerLabel}</button>
        </div>
        ` : ''}
      </div>
    </div>
  `,
};

export const NoFooter: Story = {
  args: {
    title: 'Run configuration',
    description: 'This drawer focuses on inspection and does not render footer actions.',
    footerLabel: 'Done',
    showFooter: false,
  },
  render: Default.render,
};
