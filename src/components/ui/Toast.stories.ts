import type { Meta, StoryObj } from '@storybook/html';

const meta = {
  title: 'UI/Toast',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => `
    <div class="toast toast-end toast-bottom z-50">
      <div class="alert alert-success shadow-lg">
        <svg class="stroke-current shrink-0 w-6 h-6" fill="none" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <span>Storybook toast</span>
        <button class="btn btn-xs btn-ghost" aria-label="Close notification">✕</button>
      </div>
    </div>
  `,
};
