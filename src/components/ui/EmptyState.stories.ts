import type { Meta, StoryObj } from "@storybook/html";

type EmptyStateArgs = {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
};

const meta = {
  title: "UI/EmptyState",
  args: {
    title: "No evaluations yet",
    description: "Create your first evaluation to compare model performance.",
    actionLabel: "Create evaluation",
    actionHref: "/evaluations/new",
  },
} satisfies Meta<EmptyStateArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => {
    const actionMarkup = args.actionLabel
      ? `<a class="btn btn-luxe btn-luxe-primary" href="${args.actionHref ?? "#"}">${args.actionLabel}</a>`
      : "";
    return `
      <div class="hero bg-base-200 rounded-box p-8 md:p-12 text-center">
        <div class="hero-content flex-col">
          <div class="mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-10 h-10 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 3a.75.75 0 00-.75.75v1.5h6V3.75a.75.75 0 00-.75-.75h-4.5zm-2.25 3h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9A2.25 2.25 0 015.25 17.25v-9A2.25 2.25 0 017.5 6zm2.25 4.5a.75.75 0 00-.75.75v3a.75.75 0 001.5 0v-3a.75.75 0 00-.75-.75zm4.5 0a.75.75 0 00-.75.75v3a.75.75 0 001.5 0v-3a.75.75 0 00-.75-.75z" />
            </svg>
          </div>
          <div class="max-w-md">
            <h1 class="text-2xl font-bold mb-2">${args.title}</h1>
            <p class="py-4 text-base-content/70">${args.description}</p>
            ${actionMarkup}
          </div>
        </div>
      </div>
    `;
  },
};
