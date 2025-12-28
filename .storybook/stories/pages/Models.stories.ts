import type { Meta, StoryObj } from "@storybook/html";
import { renderPageShell } from "./pageShell";

const meta = {
  title: "Pages/Models",
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const actions = `
  <button class="btn btn-ghost">Import</button>
  <button class="btn btn-ghost">Export</button>
  <button class="btn btn-luxe btn-luxe-primary">Add Model</button>
`;

const table = `
  <div class="card-luxe overflow-hidden">
    <div class="overflow-x-auto">
      <table class="table-luxe">
        <thead>
          <tr>
            <th>Provider</th>
            <th>Model</th>
            <th>Usage</th>
            <th>Status</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><span class="badge badge-ghost">OpenAI</span></td>
            <td>gpt-4o</td>
            <td class="font-mono">24</td>
            <td><span class="badge badge-success">Active</span></td>
            <td class="text-sm text-base-content/60">2024-07-01</td>
            <td>
              <button class="btn btn-xs btn-ghost">Edit</button>
              <button class="btn btn-xs btn-ghost text-error">Deactivate</button>
            </td>
          </tr>
          <tr>
            <td><span class="badge badge-ghost">Anthropic</span></td>
            <td>claude-3-opus</td>
            <td class="font-mono">17</td>
            <td><span class="badge badge-warning">Paused</span></td>
            <td class="text-sm text-base-content/60">2024-06-20</td>
            <td>
              <button class="btn btn-xs btn-ghost">Edit</button>
              <button class="btn btn-xs btn-ghost text-success">Activate</button>
            </td>
          </tr>
          <tr>
            <td><span class="badge badge-ghost">Google</span></td>
            <td>gemini-1.5-pro</td>
            <td class="font-mono">9</td>
            <td><span class="badge badge-success">Active</span></td>
            <td class="text-sm text-base-content/60">2024-06-10</td>
            <td>
              <button class="btn btn-xs btn-ghost">Edit</button>
              <button class="btn btn-xs btn-ghost text-error">Deactivate</button>
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
      title: "Model Management",
      subtitle: "Configure AI models for evaluation.",
      breadcrumbs: "<li><a href=\"/\">Home</a></li><li>Models</li>",
      actions,
      content: table,
    }),
};

export const EmptyState: Story = {
  render: () =>
    renderPageShell({
      title: "Model Management",
      subtitle: "Configure AI models for evaluation.",
      breadcrumbs: "<li><a href=\"/\">Home</a></li><li>Models</li>",
      actions,
      content: `
        <div class="card-luxe p-16 text-center">
          <div class="text-2xl font-display mb-3">No models configured</div>
          <p class="text-base-content/60 mb-6">
            Add a model to start running evaluations.
          </p>
          <button class="btn btn-luxe btn-luxe-primary">Add Model</button>
        </div>
      `,
    }),
};
