import type { Meta, StoryObj } from "@storybook/html-vite";
import { renderPageShell } from "./pageShell";

const meta = {
  title: "Pages/Personas/Training",
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const content = `
  <div class="grid gap-6 lg:grid-cols-2">
    <div class="card-luxe p-6">
      <h3 class="font-display text-xl mb-4">Training status</h3>
      <div class="space-y-4">
        <div>
          <div class="flex justify-between text-sm mb-2">
            <span class="text-base-content/60">Progress</span>
            <span>68%</span>
          </div>
          <progress class="progress progress-primary w-full" value="68" max="100"></progress>
        </div>
        <div class="flex items-center justify-between text-sm">
          <span class="text-base-content/60">Pairs processed</span>
          <span class="font-mono">68 / 100</span>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-ghost">Pause</button>
          <button class="btn btn-luxe btn-luxe-primary">Continue</button>
        </div>
      </div>
    </div>
    <div class="card-luxe p-6">
      <h3 class="font-display text-xl mb-4">Upload training data</h3>
      <div class="border border-dashed border-base-300 rounded-xl p-6 text-center">
        <div class="text-sm text-base-content/60">Drop CSV or click to upload</div>
        <button class="btn btn-ghost mt-4">Choose file</button>
      </div>
      <div class="mt-4 text-xs text-base-content/50">
        Accepted format: prompt, ideal response, rubric score.
      </div>
    </div>
  </div>
  <div class="card-luxe p-6 mt-6">
    <h3 class="font-display text-xl mb-4">Recent uploads</h3>
    <div class="overflow-x-auto">
      <table class="table-luxe">
        <thead>
          <tr>
            <th>File</th>
            <th>Rows</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>retail_pairs.csv</td>
            <td class="font-mono">120</td>
            <td><span class="badge badge-success">Processed</span></td>
            <td class="text-sm text-base-content/60">2024-07-19</td>
          </tr>
          <tr>
            <td>edge_cases.csv</td>
            <td class="font-mono">32</td>
            <td><span class="badge badge-warning">Queued</span></td>
            <td class="text-sm text-base-content/60">2024-07-18</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
`;

export const Default: Story = {
  render: () =>
    renderPageShell({
      title: "Training",
      subtitle: "Upload data and track persona training progress.",
      breadcrumbs: "<li><a href=\"/\">Home</a></li><li><a href=\"/personas\">Personas</a></li><li><a href=\"/personas/1\">Retail Analyst</a></li><li>Training</li>",
      content,
    }),
};
