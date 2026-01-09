import type { Meta, StoryObj } from "@storybook/html-vite";
import { renderPageShell } from "./pageShell";

const meta = {
  title: "Pages/Personas/Metrics",
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const metrics = `
  <div class="grid gap-4 md:grid-cols-3 mb-8">
    <div class="card-luxe p-4">
      <div class="text-sm text-base-content/60">Precision</div>
      <div class="mt-2 text-3xl font-display">0.82</div>
    </div>
    <div class="card-luxe p-4">
      <div class="text-sm text-base-content/60">Recall</div>
      <div class="mt-2 text-3xl font-display">0.77</div>
    </div>
    <div class="card-luxe p-4">
      <div class="text-sm text-base-content/60">F1 score</div>
      <div class="mt-2 text-3xl font-display">0.79</div>
    </div>
  </div>
`;

const confusion = `
  <div class="card-luxe p-6">
    <h3 class="font-display text-xl mb-4">Confusion matrix</h3>
    <div class="grid grid-cols-3 gap-2 text-center text-sm">
      <div class="p-4 bg-base-200/60">45</div>
      <div class="p-4 bg-base-200/60">8</div>
      <div class="p-4 bg-base-200/60">3</div>
      <div class="p-4 bg-base-200/60">6</div>
      <div class="p-4 bg-base-200/60">29</div>
      <div class="p-4 bg-base-200/60">5</div>
      <div class="p-4 bg-base-200/60">2</div>
      <div class="p-4 bg-base-200/60">4</div>
      <div class="p-4 bg-base-200/60">31</div>
    </div>
  </div>
`;

export const Default: Story = {
  render: () =>
    renderPageShell({
      title: "Metrics",
      subtitle: "Performance breakdown for the selected persona.",
      breadcrumbs: "<li><a href=\"/\">Home</a></li><li><a href=\"/personas\">Personas</a></li><li><a href=\"/personas/1\">Retail Analyst</a></li><li>Metrics</li>",
      content: `${metrics}${confusion}`,
    }),
};
