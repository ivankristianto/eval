import type { Meta, StoryObj } from "@storybook/html-vite";
import { renderPageShell } from "./pageShell";

const meta = {
  title: "Pages/Personas/JudgePrompts",
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const content = `
  <div class="grid gap-6 lg:grid-cols-3">
    <div class="card-luxe p-6 lg:col-span-1">
      <h3 class="font-display text-xl mb-4">Prompt versions</h3>
      <div class="space-y-3">
        <button class="btn btn-ghost justify-between w-full">
          Iteration 5 <span class="text-xs text-base-content/50">Current</span>
        </button>
        <button class="btn btn-ghost justify-between w-full">Iteration 4</button>
        <button class="btn btn-ghost justify-between w-full">Iteration 3</button>
      </div>
    </div>
    <div class="card-luxe p-6 lg:col-span-2">
      <h3 class="font-display text-xl mb-4">Prompt diff</h3>
      <div class="bg-base-200/40 rounded-xl p-4 text-sm font-mono">
        <div class="text-success">+ Add sentiment weighting for negative reviews.</div>
        <div class="text-error">- Remove generic summary instructions.</div>
        <div class="text-base-content/70">Keep output under 200 words.</div>
      </div>
      <div class="mt-4 flex gap-2">
        <button class="btn btn-ghost">Reject</button>
        <button class="btn btn-luxe btn-luxe-primary">Accept prompt</button>
      </div>
    </div>
  </div>
`;

export const Default: Story = {
  render: () =>
    renderPageShell({
      title: "Judge Prompts",
      subtitle: "Review prompt iterations and approve improvements.",
      breadcrumbs: "<li><a href=\"/\">Home</a></li><li><a href=\"/personas\">Personas</a></li><li><a href=\"/personas/1\">Retail Analyst</a></li><li>Judge Prompts</li>",
      content,
    }),
};
