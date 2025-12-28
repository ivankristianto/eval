import type { Meta, StoryObj } from "@storybook/html";
import { renderPageShell } from "./pageShell";

const meta = {
  title: "Pages/Personas/Index",
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const actions = `
  <button class="btn btn-luxe btn-luxe-primary">New Persona</button>
`;

const cards = `
  <div class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
    <div class="card-luxe p-5">
      <div class="flex items-center justify-between">
        <h3 class="font-display text-xl">Retail Analyst</h3>
        <span class="badge badge-success">Trained</span>
      </div>
      <p class="text-sm text-base-content/60 mt-2">
        Focused on extracting customer insights from feedback.
      </p>
      <div class="mt-4 text-xs text-base-content/50">Last updated 2 days ago</div>
    </div>
    <div class="card-luxe p-5">
      <div class="flex items-center justify-between">
        <h3 class="font-display text-xl">Compliance Reviewer</h3>
        <span class="badge badge-warning">Draft</span>
      </div>
      <p class="text-sm text-base-content/60 mt-2">
        Checks policy alignment for safety responses.
      </p>
      <div class="mt-4 text-xs text-base-content/50">Last updated 5 hours ago</div>
    </div>
    <div class="card-luxe p-5">
      <div class="flex items-center justify-between">
        <h3 class="font-display text-xl">Ops Summarizer</h3>
        <span class="badge badge-ghost">Paused</span>
      </div>
      <p class="text-sm text-base-content/60 mt-2">
        Summarizes internal reports for executives.
      </p>
      <div class="mt-4 text-xs text-base-content/50">Last updated 1 week ago</div>
    </div>
  </div>
`;

export const Default: Story = {
  render: () =>
    renderPageShell({
      title: "Personas",
      subtitle: "Manage personas used to evaluate and train models.",
      breadcrumbs: "<li><a href=\"/\">Home</a></li><li>Personas</li>",
      actions,
      content: cards,
    }),
};

export const EmptyState: Story = {
  render: () =>
    renderPageShell({
      title: "Personas",
      subtitle: "Manage personas used to evaluate and train models.",
      breadcrumbs: "<li><a href=\"/\">Home</a></li><li>Personas</li>",
      actions,
      content: `
        <div class="card-luxe p-16 text-center">
          <div class="text-2xl font-display mb-3">No personas yet</div>
          <p class="text-base-content/60 mb-6">
            Create a persona to start training and evaluating prompts.
          </p>
          <button class="btn btn-luxe btn-luxe-primary">Create persona</button>
        </div>
      `,
    }),
};
