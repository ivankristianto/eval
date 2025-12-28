import type { Meta, StoryObj } from "@storybook/html";
import { renderPageShell } from "./pageShell";

const meta = {
  title: "Pages/Personas/RefinePrompt",
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const content = `
  <div class="grid gap-6 lg:grid-cols-2">
    <div class="card-luxe p-6">
      <h3 class="font-display text-xl mb-4">Prompt draft</h3>
      <textarea class="textarea textarea-bordered w-full h-64">You are a retail analyst. Summarize feedback and extract themes. Provide three recommendations.</textarea>
      <div class="mt-4 flex gap-2">
        <button class="btn btn-ghost">Reset</button>
        <button class="btn btn-luxe btn-luxe-primary">Save draft</button>
      </div>
    </div>
    <div class="card-luxe p-6">
      <h3 class="font-display text-xl mb-4">Suggested improvements</h3>
      <ul class="space-y-3 text-sm text-base-content/70">
        <li>Clarify the expected output length for each section.</li>
        <li>Add guidance for prioritizing sentiment extremes.</li>
        <li>Include a requirement to surface recurring metrics.</li>
      </ul>
      <div class="mt-6">
        <button class="btn btn-ghost">Generate new suggestion</button>
      </div>
    </div>
  </div>
  <div class="card-luxe p-6 mt-6">
    <h3 class="font-display text-xl mb-4">Previous iterations</h3>
    <div class="flex items-center justify-between">
      <div>
        <div class="font-medium">Iteration 4</div>
        <div class="text-xs text-base-content/50">Score 0.81</div>
      </div>
      <button class="btn btn-xs btn-ghost">View diff</button>
    </div>
  </div>
`;

export const Default: Story = {
  render: () =>
    renderPageShell({
      title: "Refine Prompt",
      subtitle: "Edit and improve the persona instruction prompt.",
      breadcrumbs: "<li><a href=\"/\">Home</a></li><li><a href=\"/personas\">Personas</a></li><li><a href=\"/personas/1\">Retail Analyst</a></li><li>Refine Prompt</li>",
      content,
    }),
};
