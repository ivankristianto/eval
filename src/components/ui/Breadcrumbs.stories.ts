import type { Meta, StoryObj } from "@storybook/html";

type BreadcrumbArgs = {
  items: Array<{ label: string; href?: string }>;
};

const meta = {
  title: "UI/Breadcrumbs",
  args: {
    items: [
      { label: "Home", href: "/" },
      { label: "Evaluations", href: "/evaluations" },
      { label: "Results" },
    ],
  },
} satisfies Meta<BreadcrumbArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Trail: Story = {
  render: (args) => {
    const items = args.items
      .map((item, index) => {
        const isLast = index === args.items.length - 1;
        if (item.href && !isLast) {
          return `<li><a href="${item.href}" class="hover:text-primary transition-colors">${item.label}</a></li>`;
        }
        return `<li><span class="font-medium text-base-content">${item.label}</span></li>`;
      })
      .join("");

    return `<div class="text-sm breadcrumbs mb-4 text-base-content/70"><ul>${items}</ul></div>`;
  },
};
