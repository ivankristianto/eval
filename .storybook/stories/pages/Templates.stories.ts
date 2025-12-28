import type { Meta, StoryObj } from "@storybook/html-vite";
import { renderPageShell } from "./pageShell";

const meta = {
  title: "Pages/Templates",
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const table = `
  <div class="card-luxe overflow-hidden">
    <div class="overflow-x-auto">
      <table class="table-luxe table-templates">
        <thead>
          <tr>
            <th>Name</th>
            <th>Instruction Preview</th>
            <th>Models</th>
            <th>Rubric</th>
            <th>Runs</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <div class="font-medium">Customer Support Summary</div>
              <div class="text-xs text-base-content/50 mt-1">Weekly insight rollups</div>
            </td>
            <td class="text-sm text-base-content/70 line-clamp-2">
              Summarize the top five support themes and sentiment.
            </td>
            <td class="font-mono text-center">4</td>
            <td><span class="badge badge-ghost">Accuracy</span></td>
            <td class="font-mono text-center">12</td>
            <td class="text-sm text-base-content/70">2024-06-30</td>
            <td>
              <div class="flex gap-2">
                <button class="btn btn-xs btn-ghost text-primary">Run</button>
                <button class="btn btn-xs btn-ghost">History</button>
                <button class="btn btn-xs btn-ghost text-error">Delete</button>
              </div>
            </td>
          </tr>
          <tr>
            <td>
              <div class="font-medium">Safety Review</div>
              <div class="text-xs text-base-content/50 mt-1">Edge case checks</div>
            </td>
            <td class="text-sm text-base-content/70 line-clamp-2">
              Grade responses for policy compliance and completeness.
            </td>
            <td class="font-mono text-center">3</td>
            <td><span class="badge badge-ghost">Reasoning</span></td>
            <td class="font-mono text-center">7</td>
            <td class="text-sm text-base-content/70">2024-06-12</td>
            <td>
              <div class="flex gap-2">
                <button class="btn btn-xs btn-ghost text-primary">Run</button>
                <button class="btn btn-xs btn-ghost">History</button>
                <button class="btn btn-xs btn-ghost text-error">Delete</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
`;

export const Default: Story = {
  render: () =>
    renderPageShell({
      title: "Evaluation Templates",
      subtitle: "Saved evaluation configurations for quick reuse.",
      breadcrumbs: "<li><a href=\"/\">Home</a></li><li>Templates</li>",
      content: table,
    }),
};

export const EmptyState: Story = {
  render: () =>
    renderPageShell({
      title: "Evaluation Templates",
      subtitle: "Saved evaluation configurations for quick reuse.",
      breadcrumbs: "<li><a href=\"/\">Home</a></li><li>Templates</li>",
      content: `
        <div class="card-luxe p-16 text-center">
          <div class="text-2xl font-display mb-3">No templates saved</div>
          <p class="text-base-content/60 mb-6">
            Complete an evaluation and save it as a template.
          </p>
          <button class="btn btn-luxe btn-luxe-primary">Go to evaluations</button>
        </div>
      `,
    }),
};
