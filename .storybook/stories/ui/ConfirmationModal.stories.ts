import type { Meta, StoryObj } from '@storybook/html-vite';

type ConfirmationModalArgs = {
  title: string;
  description: string;
  confirmLabel: string;
  confirmVariant: 'error' | 'primary';
};

const meta = {
  title: 'Components/UI/ConfirmationModal',
  tags: ["autodocs"],
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    confirmVariant: {
      control: 'select',
      options: ['error', 'primary'],
    },
  },
  args: {
    title: 'Delete evaluation?',
    description: 'This action cannot be undone. This will remove all results for this evaluation.',
    confirmLabel: 'Delete',
    confirmVariant: 'error',
  },
} satisfies Meta<ConfirmationModalArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => `
    <dialog open class="modal">
      <div class="modal-box">
        <h3 class="font-display text-2xl font-semibold mb-4 text-gold-accessible">${args.title}</h3>
        <p class="py-4 text-base-content/80 leading-relaxed">
          ${args.description}
        </p>
        <div class="modal-action">
          <form method="dialog" class="flex gap-3 w-full justify-end">
            <button class="btn btn-ghost min-w-24">Cancel</button>
            <button class="btn btn-${args.confirmVariant} min-w-24">${args.confirmLabel}</button>
          </form>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  `,
};

export const Confirm: Story = {
  args: {
    title: 'Approve evaluation?',
    description: 'Confirm to lock the rubric and notify stakeholders.',
    confirmLabel: 'Confirm',
    confirmVariant: 'primary',
  },
  render: Default.render,
};
