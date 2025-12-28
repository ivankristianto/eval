import type { Meta, StoryObj } from "@storybook/html-vite";
import { renderPageShell } from "./pageShell";

const meta = {
  title: "Pages/Personas/Review",
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const content = `
  <div class="card-luxe p-6">
    <h3 class="font-display text-xl mb-4">Iteration 5 review</h3>
    <div class="space-y-4">
      <div class="border border-base-200 rounded-xl p-4">
        <div class="text-sm text-base-content/60">Prompt</div>
        <p class="mt-2 text-base-content/80">
          Summarize feedback, highlight top two drivers, and provide three actions.
        </p>
        <div class="mt-4 flex gap-2">
          <button class="btn btn-sm btn-ghost">Request changes</button>
          <button class="btn btn-sm btn-luxe btn-luxe-primary">Approve</button>
        </div>
      </div>
      <div class="border border-base-200 rounded-xl p-4">
        <div class="text-sm text-base-content/60">Sample response</div>
        <p class="mt-2 text-base-content/80">
          Customers praised delivery speed but highlighted packaging issues. Prioritize
          quality control and proactive updates.
        </p>
      </div>
    </div>
  </div>
`;

export const Default: Story = {
  render: () =>
    renderPageShell({
      title: "Review Iteration",
      subtitle: "Approve or reject the latest prompt update.",
      breadcrumbs: "<li><a href=\"/\">Home</a></li><li><a href=\"/personas\">Personas</a></li><li><a href=\"/personas/1\">Retail Analyst</a></li><li>Review</li>",
      content,
    }),
};
