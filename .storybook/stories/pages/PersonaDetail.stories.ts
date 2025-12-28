import type { Meta, StoryObj } from "@storybook/html";
import { renderPageShell } from "./pageShell";

const meta = {
  title: "Pages/Personas/Detail",
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
      <div class="mt-2"><span class="badge badge-success">Trained</span></div>
    </div>
    <div class="card-luxe p-4">
      <div class="text-sm text-base-content/60">Training pairs</div>
      <div class="mt-2 text-3xl font-display">124</div>
    </div>
    <div class="card-luxe p-4">
      <div class="text-sm text-base-content/60">Last updated</div>
      <div class="mt-2 text-3xl font-display">2d</div>
    </div>
  </div>
`;

const tabs = `
  <div class="tabs tabs-boxed mb-8">
    <a class="tab tab-active">Overview</a>
    <a class="tab">Metrics</a>
    <a class="tab">Training</a>
    <a class="tab">Refine Prompt</a>
  </div>
`;

const content = `
  ${summary}
  ${tabs}
  <div class="card-luxe p-6">
    <h3 class="font-display text-xl mb-3">Persona brief</h3>
    <p class="text-base-content/70">
      This persona evaluates clarity, sentiment extraction, and actionable recommendations.
    </p>
    <div class="mt-4 flex gap-3">
      <button class="btn btn-ghost">Edit details</button>
      <button class="btn btn-ghost">View prompt</button>
    </div>
  </div>
`;

export const Default: Story = {
  render: () =>
    renderPageShell({
      title: "Retail Analyst",
      subtitle: "Persona overview and training status.",
      breadcrumbs: "<li><a href=\"/\">Home</a></li><li><a href=\"/personas\">Personas</a></li><li>Retail Analyst</li>",
      actions: "<button class=\"btn btn-ghost\">Duplicate</button>",
      content,
    }),
};
