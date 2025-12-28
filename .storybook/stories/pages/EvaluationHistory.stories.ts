import type { Meta, StoryObj } from "@storybook/html-vite";
import { renderPageShell } from "./pageShell";

const meta = {
  title: "Pages/Evaluations/History",
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const actions = `
  <button class="btn btn-luxe btn-luxe-primary px-6">New Evaluation</button>
`;

const filterBar = `
  <div class="card-luxe p-4 mb-6">
    <div class="grid gap-4 md:grid-cols-4">
      <input class="input input-bordered" placeholder="From date" />
      <input class="input input-bordered" placeholder="To date" />
      <select class="select select-bordered">
        <option>All rubrics</option>
        <option>Accuracy</option>
        <option>Reasoning</option>
      </select>
      <input class="input input-bordered" placeholder="Min score" />
    </div>
  </div>
`;

const historyTable = `
  <div class="card-luxe overflow-hidden">
    <div class="overflow-x-auto">
      <table class="table-luxe table-evaluation">
        <thead>
          <tr>
            <th><input type="checkbox" class="checkbox checkbox-sm" /></th>
            <th>Instruction</th>
            <th>Rubric</th>
            <th>Models</th>
            <th>Avg. Accuracy</th>
            <th>Avg. Time</th>
            <th>Status</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th><input type="checkbox" class="checkbox checkbox-sm" /></th>
            <td class="max-w-xs">Summarize customer feedback and extract key themes.</td>
            <td><span class="badge badge-ghost">Accuracy</span></td>
            <td class="font-mono">5</td>
            <td class="font-mono">0.86</td>
            <td class="font-mono">2.4s</td>
            <td><span class="badge badge-success">Completed</span></td>
            <td class="text-sm text-base-content/70">2024-07-19</td>
            <td><button class="btn btn-xs btn-ghost">View</button></td>
          </tr>
          <tr>
            <th><input type="checkbox" class="checkbox checkbox-sm" /></th>
            <td class="max-w-xs">Evaluate safety responses for edge cases.</td>
            <td><span class="badge badge-ghost">Reasoning</span></td>
            <td class="font-mono">3</td>
            <td class="font-mono">0.72</td>
            <td class="font-mono">3.1s</td>
            <td><span class="badge badge-warning">Running</span></td>
            <td class="text-sm text-base-content/70">2024-07-18</td>
            <td><button class="btn btn-xs btn-ghost">View</button></td>
          </tr>
          <tr>
            <th><input type="checkbox" class="checkbox checkbox-sm" /></th>
            <td class="max-w-xs">Extract compliance risks from contracts.</td>
            <td><span class="badge badge-ghost">Accuracy</span></td>
            <td class="font-mono">2</td>
            <td class="font-mono">0.64</td>
            <td class="font-mono">1.9s</td>
            <td><span class="badge badge-error">Failed</span></td>
            <td class="text-sm text-base-content/70">2024-07-17</td>
            <td><button class="btn btn-xs btn-ghost">View</button></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="flex items-center justify-between px-6 py-4 border-t border-base-200">
      <div class="text-sm text-base-content/60">Showing 1-3 of 12 evaluations</div>
      <div class="join">
        <button class="btn btn-sm join-item">Prev</button>
        <button class="btn btn-sm join-item btn-active">1</button>
        <button class="btn btn-sm join-item">2</button>
        <button class="btn btn-sm join-item">Next</button>
      </div>
    </div>
  </div>
`;

export const Default: Story = {
  render: () =>
    renderPageShell({
      title: "Evaluation History",
      subtitle: "All past evaluation runs and their results.",
      actions,
      content: `${filterBar}${historyTable}`,
    }),
};

export const EmptyState: Story = {
  render: () =>
    renderPageShell({
      title: "Evaluation History",
      subtitle: "All past evaluation runs and their results.",
      actions,
      content: `
        ${filterBar}
        <div class="card-luxe p-16 text-center">
          <div class="text-2xl font-display mb-3">No evaluations yet</div>
          <p class="text-base-content/60 mb-6">
            Run your first evaluation to see results here.
          </p>
          <button class="btn btn-luxe btn-luxe-primary">Start evaluation</button>
        </div>
      `,
    }),
};
