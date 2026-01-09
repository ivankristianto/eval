import type { Meta, StoryObj } from "@storybook/html-vite";

type ThemeShowcaseArgs = {
  title: string;
  description: string;
};

const meta = {
  title: "Foundation/ThemeShowcase",
  tags: ["autodocs"],
  args: {
    title: "Theme Showcase",
    description: "Use the toolbar to switch DaisyUI themes.",
  },
} satisfies Meta<ThemeShowcaseArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => {
    return `
      <div class="space-y-8 max-w-5xl">
        <header class="space-y-2">
          <h1 class="text-3xl font-display font-semibold">${args.title}</h1>
          <p class="text-base-content/70">${args.description}</p>
        </header>

        <section class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div class="card bg-base-200 shadow-md">
            <div class="card-body">
              <h2 class="card-title">Quick Actions</h2>
              <p class="text-sm text-base-content/60">Check button, badge, and toggle styling.</p>
              <div class="flex flex-wrap gap-2 mt-4">
                <button class="btn btn-luxe btn-luxe-primary">Run evaluation</button>
                <button class="btn btn-ghost">Cancel</button>
                <button class="btn btn-outline btn-secondary">Preview</button>
                <span class="badge badge-success">Active</span>
                <span class="badge badge-warning">Draft</span>
              </div>
              <div class="mt-4 flex items-center gap-3">
                <input type="checkbox" class="toggle toggle-primary" checked />
                <span class="text-sm">Alerts enabled</span>
              </div>
            </div>
          </div>

          <div class="card bg-base-200 shadow-md">
            <div class="card-body">
              <h2 class="card-title">Inputs</h2>
              <p class="text-sm text-base-content/60">Verify form controls and focus states.</p>
              <div class="space-y-3 mt-4">
                <input class="input input-bordered w-full" placeholder="Evaluation name" />
                <select class="select select-bordered w-full">
                  <option>Exact Match</option>
                  <option>Partial Credit</option>
                  <option>Semantic Similarity</option>
                </select>
                <textarea
                  class="textarea textarea-bordered w-full"
                  rows="3"
                  placeholder="Add notes..."
                ></textarea>
              </div>
            </div>
          </div>

          <div class="card bg-base-200 shadow-md">
            <div class="card-body">
              <h2 class="card-title">Status</h2>
              <p class="text-sm text-base-content/60">Alert and progress styling.</p>
              <div class="space-y-3 mt-4">
                <div class="alert alert-info">
                  <span>New model evaluation queued.</span>
                </div>
                <div class="alert alert-success">
                  <span>Training convergence achieved.</span>
                </div>
                <div class="alert alert-error">
                  <span>Model token limit exceeded.</span>
                </div>
                <progress class="progress progress-primary w-full" value="62" max="100"></progress>
              </div>
            </div>
          </div>
        </section>

        <section class="card bg-base-200 shadow-md">
          <div class="card-body space-y-4">
            <div class="flex items-center justify-between">
              <h2 class="card-title">Recent Evaluations</h2>
              <button class="btn btn-sm btn-primary">View all</button>
            </div>
            <div class="overflow-x-auto">
              <table class="table table-zebra">
                <thead>
                  <tr>
                    <th>Model</th>
                    <th>Rubric</th>
                    <th>Score</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>gpt-4.1</td>
                    <td>Partial Credit</td>
                    <td>92%</td>
                    <td><span class="badge badge-success">Done</span></td>
                  </tr>
                  <tr>
                    <td>claude-3.7</td>
                    <td>Exact Match</td>
                    <td>88%</td>
                    <td><span class="badge badge-warning">Review</span></td>
                  </tr>
                  <tr>
                    <td>gemini-2.5</td>
                    <td>Semantic</td>
                    <td>76%</td>
                    <td><span class="badge badge-info">Running</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    `;
  },
};
