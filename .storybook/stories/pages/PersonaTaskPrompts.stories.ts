import type { Meta, StoryObj } from "@storybook/html-vite";
import { renderPageShell } from "./pageShell";

const meta = {
  title: "Pages/Personas/TaskPrompts",
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const currentPrompt = `
  <div class="card-luxe p-6 mb-6">
    <div class="flex items-center justify-between mb-4">
      <h3 class="font-display text-xl">Current active task prompt</h3>
      <span class="badge badge-primary badge-outline">Active</span>
    </div>
    <div class="bg-base-200/60 rounded-xl p-4 text-sm font-mono">
      Summarize customer feedback into three bullet points. Highlight recurring themes and note
      any urgent escalation flags.
    </div>
    <div class="text-xs text-base-content/60 mt-3">Last updated: Iteration 6 (Oct 2, 2025)</div>
  </div>
`;

const versionHistory = `
  <div class="card-luxe p-6">
    <div class="flex items-center justify-between mb-4">
      <h3 class="font-display text-xl">Version history</h3>
      <span class="text-xs text-base-content/60">6 total iterations</span>
    </div>
    <div class="space-y-4">
      <div class="border border-base-200/70 rounded-2xl p-4 bg-base-100/60">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="text-sm font-semibold">Iteration 6</div>
            <span class="badge badge-primary badge-outline badge-sm">Current</span>
            <span class="badge badge-info badge-outline badge-sm">AI-refined</span>
          </div>
          <div class="text-xs text-base-content/60">Oct 2, 2025 · 11:04 AM</div>
        </div>
        <div class="mt-3 text-sm text-base-content/70">
          Rationale: Added urgency tags and structured output to improve downstream routing.
        </div>
        <div class="mt-4 flex flex-wrap items-center gap-2">
          <button class="btn btn-sm btn-ghost">Compare with Iteration 5</button>
          <button class="btn btn-sm btn-outline">Copy prompt</button>
        </div>
      </div>

      <div class="border border-base-200/70 rounded-2xl p-4 bg-base-100/60">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="text-sm font-semibold">Iteration 5</div>
            <span class="badge badge-secondary badge-outline badge-sm">Human</span>
          </div>
          <div class="text-xs text-base-content/60">Sep 30, 2025 · 4:20 PM</div>
        </div>
        <div class="mt-4 flex flex-wrap items-center gap-2">
          <button class="btn btn-sm btn-ghost">Compare with Iteration 4</button>
          <button class="btn btn-sm btn-outline">Copy prompt</button>
        </div>
      </div>

      <div class="border border-base-200/70 rounded-2xl p-4 bg-base-100/60">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="text-sm font-semibold">Iteration 4</div>
            <span class="badge badge-secondary badge-outline badge-sm">Human</span>
          </div>
          <div class="text-xs text-base-content/60">Sep 28, 2025 · 9:12 AM</div>
        </div>
        <div class="mt-4 flex flex-wrap items-center gap-2">
          <button class="btn btn-sm btn-ghost">Compare with Iteration 3</button>
          <button class="btn btn-sm btn-outline">Copy prompt</button>
        </div>
      </div>
    </div>
  </div>
`;

const emptyState = `
  <div class="card-luxe p-6">
    <h3 class="font-display text-xl mb-4">Version history</h3>
    <div class="alert alert-info">
      <span>No task prompt versions yet. Start training to capture iterations.</span>
    </div>
  </div>
`;

export const Default: Story = {
  render: () =>
    renderPageShell({
      title: "Task Prompts",
      subtitle: "Track how task instructions evolve across training iterations.",
      breadcrumbs:
        "<li><a href=\"/\">Home</a></li><li><a href=\"/personas\">Personas</a></li><li><a href=\"/personas/1\">Retail Analyst</a></li><li>Task Prompts</li>",
      content: `${currentPrompt}${versionHistory}`,
    }),
};

export const Empty: Story = {
  render: () =>
    renderPageShell({
      title: "Task Prompts",
      subtitle: "Track how task instructions evolve across training iterations.",
      breadcrumbs:
        "<li><a href=\"/\">Home</a></li><li><a href=\"/personas\">Personas</a></li><li><a href=\"/personas/1\">Retail Analyst</a></li><li>Task Prompts</li>",
      content: `${currentPrompt}${emptyState}`,
    }),
};
