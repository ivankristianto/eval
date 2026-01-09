import type { Meta, StoryObj } from "@storybook/html-vite";
import { renderPageShell } from "./pageShell";

const meta = {
  title: "Pages/Personas/Create",
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const form = `
  <div class="card-luxe p-8 max-w-3xl">
    <div class="grid gap-5">
      <div>
        <label class="label">Persona name</label>
        <input class="input input-bordered w-full" placeholder="Retail Analyst" />
      </div>
      <div>
        <label class="label">Description</label>
        <textarea class="textarea textarea-bordered w-full" rows="4" placeholder="Describe the persona focus..."></textarea>
      </div>
      <div>
        <label class="label">Primary goal</label>
        <input class="input input-bordered w-full" placeholder="Summarize feedback themes" />
      </div>
      <div>
        <label class="label">Target rubric</label>
        <select class="select select-bordered w-full">
          <option>Accuracy</option>
          <option>Reasoning</option>
          <option>Safety</option>
        </select>
      </div>
      <div class="flex gap-3">
        <button class="btn btn-luxe btn-luxe-primary">Create persona</button>
        <button class="btn btn-ghost">Cancel</button>
      </div>
    </div>
  </div>
`;

export const Default: Story = {
  render: () =>
    renderPageShell({
      title: "Create Persona",
      subtitle: "Define a new evaluator persona for prompt training.",
      breadcrumbs: "<li><a href=\"/\">Home</a></li><li><a href=\"/personas\">Personas</a></li><li>Create</li>",
      content: form,
    }),
};
