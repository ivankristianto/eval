import type { Meta, StoryObj } from "@storybook/html";

type CardArgs = {
  title?: string;
  content: string;
  noPadding: boolean;
};

const meta = {
  title: "UI/Card",
  args: {
    title: "Evaluation summary",
    content: "Accuracy: 92%. Tokens: 18,420. Runtime: 42s.",
    noPadding: false,
  },
  argTypes: {
    noPadding: {
      control: "boolean",
    },
  },
} satisfies Meta<CardArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => {
    const paddingClass = args.noPadding ? "" : "p-6";
    const titleMarkup = args.title
      ? `<h2 class="font-display text-2xl font-semibold mb-4 text-gradient-gold">${args.title}</h2>`
      : "";
    return `
      <div class="card-luxe">
        <div class="${paddingClass}">
          ${titleMarkup}
          <p class="text-sm text-base-content/70">${args.content}</p>
        </div>
      </div>
    `;
  },
};
