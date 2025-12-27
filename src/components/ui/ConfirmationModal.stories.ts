import type { Meta, StoryObj } from '@storybook/html';

const meta = {
  title: 'UI/ConfirmationModal',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => `
    <dialog open class="modal">
      <div class="modal-box">
        <h3 class="font-display text-2xl font-semibold mb-4 text-gold-accessible">Delete evaluation?</h3>
        <p class="py-4 text-base-content/80 leading-relaxed">
          This action cannot be undone. This will remove all results for this evaluation.
        </p>
        <div class="modal-action">
          <form method="dialog" class="flex gap-3 w-full justify-end">
            <button class="btn btn-ghost min-w-24">Cancel</button>
            <button class="btn btn-error min-w-24">Delete</button>
          </form>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  `,
};
