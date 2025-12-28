import type { Meta, StoryObj } from "@storybook/html";
import { renderPageShell } from "./pageShell";

const meta = {
  title: "Pages/Evaluations/Detail",
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const summary = `
  <div class="grid gap-4 md:grid-cols-3 mb-8">
    <div class="card-luxe p-4">
      <div class="text-sm text-base-content/60">Status</div>
      <div class="mt-2 flex items-center gap-2">
        <span class="badge badge-success">Completed</span>
        <span class="text-sm text-base-content/60">ID: eval_72c1</span>
      </div>
    </div>
    <div class="card-luxe p-4">
      <div class="text-sm text-base-content/60">Average Accuracy</div>
      <div class="mt-2 text-3xl font-display">0.83</div>
    </div>
    <div class="card-luxe p-4">
      <div class="text-sm text-base-content/60">Runtime</div>
      <div class="mt-2 text-3xl font-display">2.6s</div>
    </div>
  </div>
`;

const resultsTable = `
  <div class="card-luxe overflow-hidden">
    <div class="overflow-x-auto">
      <table class="table-luxe">
        <thead>
          <tr>
            <th>Model</th>
            <th>Accuracy</th>
            <th>Avg. Time</th>
            <th>Tokens</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>gpt-4o</td>
            <td class="font-mono">0.89</td>
            <td class="font-mono">2.1s</td>
            <td class="font-mono">9,840</td>
            <td class="text-sm text-base-content/60">Strong reasoning depth.</td>
          </tr>
          <tr>
            <td>claude-3-opus</td>
            <td class="font-mono">0.85</td>
            <td class="font-mono">2.8s</td>
            <td class="font-mono">8,930</td>
            <td class="text-sm text-base-content/60">Best at safety edge cases.</td>
          </tr>
          <tr>
            <td>gemini-1.5-pro</td>
            <td class="font-mono">0.74</td>
            <td class="font-mono">3.2s</td>
            <td class="font-mono">10,120</td>
            <td class="text-sm text-base-content/60">Lower consistency on rubric.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
`;

export const Default: Story = {
  render: () =>
    renderPageShell({
      title: "Evaluation Results",
      subtitle: "Detailed model performance for a single run.",
      breadcrumbs: "<li><a href=\"/\">Home</a></li><li>Evaluation</li>",
      actions: "<button class=\"btn btn-ghost\">Export</button>",
      content: `${summary}${resultsTable}`,
    }),
};
