import type { Meta, StoryObj } from "@storybook/html-vite";

type TemplateManagerArgs = {
  open: boolean;
  summaryItems: string[];
  showError: boolean;
  showSuccess: boolean;
  errorText: string;
};

const meta = {
  title: "Components/TemplateManager",
  tags: ["autodocs"],
  args: {
    open: true,
    summaryItems: [
      "Instruction: \"Summarize the report and list next steps\"",
      "Models: 2 selected",
      "Rubric: Partial Credit",
    ],
    showError: false,
    showSuccess: false,
    errorText: "Template name is required",
  },
  argTypes: {
    open: { control: "boolean" },
    showError: { control: "boolean" },
    showSuccess: { control: "boolean" },
  },
} satisfies Meta<TemplateManagerArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => {
    const modalOpen = args.open ? "open" : "";
    const summaryMarkup = args.summaryItems
      .map((item) => `<li>${item}</li>`)
      .join("");
    const errorClass = args.showError ? "" : "hidden";
    const successClass = args.showSuccess ? "" : "hidden";

    return `
      <dialog class="modal" ${modalOpen}>
        <div class="modal-box">
          <form method="dialog">
            <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
          </form>

          <h3 class="font-display text-2xl font-semibold mb-2 text-gold-accessible">Save as Template</h3>
          <p class="text-base-content/70 mb-6">Save this evaluation configuration for reuse.</p>

          <form class="space-y-5">
            <div class="form-control w-full">
              <label class="label" for="template-name">
                <span class="label-text font-medium">Template Name <span class="text-error">*</span></span>
              </label>
              <input
                type="text"
                id="template-name"
                required
                maxlength="100"
                placeholder="e.g., Code Review Prompt Test"
                class="input input-bordered w-full"
              />
            </div>

            <div class="form-control w-full">
              <label class="label" for="template-description">
                <span class="label-text font-medium">
                  Description <span class="text-base-content/50">(optional)</span>
                </span>
              </label>
              <textarea
                id="template-description"
                rows="3"
                maxlength="500"
                placeholder="Brief description of what this template evaluates..."
                class="textarea textarea-bordered w-full"
              ></textarea>
            </div>

            <div class="bg-base-200 rounded-lg p-4 border border-base-content/10">
              <p class="text-xs font-semibold text-base-content/60 uppercase tracking-wider mb-3">
                Will save:
              </p>
              <ul class="space-y-2 text-sm text-base-content/80">
                ${summaryMarkup}
              </ul>
            </div>

            <div class="${errorClass} alert alert-error">
              <span>${args.errorText}</span>
            </div>

            <div class="${successClass} alert alert-success">
              <span>Template saved successfully!</span>
            </div>

            <div class="modal-action">
              <button type="button" class="btn btn-ghost min-w-28">Cancel</button>
              <button type="submit" class="btn btn-luxe btn-luxe-primary min-w-28">Save Template</button>
            </div>
          </form>
        </div>
        <form method="dialog" class="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    `;
  },
};

export const ErrorState: Story = {
  args: {
    showError: true,
  },
  render: Default.render,
};

export const SuccessState: Story = {
  args: {
    showSuccess: true,
  },
  render: Default.render,
};
