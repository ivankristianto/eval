import type { Meta, StoryObj } from "@storybook/html";

type BulkActionsArgs = {
  count: number;
  visible: boolean;
};

const meta = {
  title: "Components/BulkActions",
  args: {
    count: 3,
    visible: true,
  },
  argTypes: {
    visible: {
      control: "boolean",
    },
  },
} satisfies Meta<BulkActionsArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => {
    const visibilityClasses = args.visible
      ? "translate-y-0 opacity-100 pointer-events-auto"
      : "translate-y-24 opacity-0 pointer-events-none";
    return `
      <div class="relative min-h-[180px] bg-base-200 rounded-box">
        <div
          class="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 ${visibilityClasses}"
        >
          <div
            class="bg-base-300 text-base-content px-6 py-3 rounded-full shadow-lg flex items-center gap-4 border border-base-content/10"
          >
            <span class="font-medium">${args.count} selected</span>
            <div class="h-4 w-px bg-base-content/20"></div>
            <button class="btn btn-ghost btn-sm text-error">Delete</button>
            <button class="btn btn-ghost btn-sm">Cancel</button>
          </div>
        </div>
      </div>
    `;
  },
};

export const Hidden: Story = {
  args: {
    visible: false,
  },
  render: Default.render,
};
