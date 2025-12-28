import type { Meta, StoryObj } from "@storybook/html-vite";

type NewEvaluationModalArgs = {
  open: boolean;
  rubricType: "exact_match" | "partial_credit" | "semantic_similarity";
  models: Array<{ name: string; provider: string }>;
  systemPromptEnabled: boolean;
};

const meta = {
  title: "Components/NewEvaluationModal",
  tags: ["autodocs"],
  args: {
    open: true,
    rubricType: "partial_credit",
    models: [
      { name: "gpt-4.1", provider: "OpenAI" },
      { name: "claude-3.7", provider: "Anthropic" },
      { name: "gemini-2.5", provider: "Google" },
    ],
    systemPromptEnabled: false,
  },
  argTypes: {
    open: { control: "boolean" },
    rubricType: {
      control: "select",
      options: ["exact_match", "partial_credit", "semantic_similarity"],
    },
    systemPromptEnabled: { control: "boolean" },
  },
} satisfies Meta<NewEvaluationModalArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => {
    const modalOpen = args.open ? "open" : "";
    const hasModels = args.models.length > 0;
    const conceptsVisible = args.rubricType === "partial_credit" ? "" : "hidden";
    const systemPromptVisible = args.systemPromptEnabled ? "" : "hidden";
    const warningState = hasModels
      ? ""
      : `
        <div class="alert alert-warning mt-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            class="stroke-current shrink-0 w-6 h-6"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13 16h-1v-4h-1m1-4h.01M12 3l9 16H3l9-16z"
            />
          </svg>
          <span>No models configured. Add models first.</span>
        </div>
      `;

    const modelMarkup = args.models
      .map(
        (model) => `
          <label class="flex items-center gap-2 cursor-pointer p-2 hover:bg-base-300 rounded">
            <input type="checkbox" class="checkbox checkbox-luxe checkbox-sm" />
            <span class="label-text">
              ${model.name}
              <span class="text-base-content/50 text-xs ml-1">(${model.provider})</span>
            </span>
          </label>
        `
      )
      .join("");

    return `
      <dialog class="modal" ${modalOpen}>
        <div class="modal-box">
          <form method="dialog">
            <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
          </form>
          <h3 class="font-display text-2xl font-semibold mb-6 text-gold-accessible">New Evaluation</h3>

          <form class="space-y-4">
            <div class="form-control w-full">
              <label class="label" for="instruction">
                <span class="label-text font-medium">Instruction</span>
              </label>
              <textarea
                id="instruction"
                rows="4"
                class="textarea textarea-bordered w-full"
                placeholder="Enter the instruction to evaluate..."
              ></textarea>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="form-control w-full">
                <label class="label" for="rubric_type">
                  <span class="label-text font-medium">Accuracy Rubric</span>
                </label>
                <select id="rubric_type" class="select select-bordered w-full">
                  <option value="exact_match" ${
                    args.rubricType === "exact_match" ? "selected" : ""
                  }>Exact Match</option>
                  <option value="partial_credit" ${
                    args.rubricType === "partial_credit" ? "selected" : ""
                  }>Partial Credit</option>
                  <option value="semantic_similarity" ${
                    args.rubricType === "semantic_similarity" ? "selected" : ""
                  }>Semantic Similarity</option>
                </select>
              </div>

              <div class="form-control w-full">
                <label class="label" for="expected_output">
                  <span class="label-text font-medium">Expected Output</span>
                </label>
                <input
                  type="text"
                  id="expected_output"
                  class="input input-bordered w-full"
                  placeholder="Expected output..."
                />
              </div>
            </div>

            <div class="${conceptsVisible} form-control w-full">
              <label class="label" for="partial_credit_concepts">
                <span class="label-text font-medium">Key Concepts (comma-separated)</span>
              </label>
              <textarea
                id="partial_credit_concepts"
                rows="2"
                class="textarea textarea-bordered w-full"
                placeholder="concept1, concept2, concept3..."
              ></textarea>
            </div>

            <div class="form-control w-full">
              <label class="cursor-pointer label justify-start gap-3">
                <input type="checkbox" class="checkbox checkbox-luxe" ${
                  args.systemPromptEnabled ? "checked" : ""
                } />
                <span class="label-text font-medium">Use System Prompt</span>
              </label>
            </div>

            <div class="${systemPromptVisible} form-control w-full">
              <label class="label" for="system_prompt">
                <span class="label-text font-medium">System Prompt</span>
                <span class="label-text-alt text-base-content/50">Max 4,000 characters</span>
              </label>
              <textarea
                id="system_prompt"
                rows="3"
                maxlength="4000"
                class="textarea textarea-bordered w-full"
                placeholder="You are a helpful assistant that..."
              ></textarea>
              <label class="label">
                <span class="label-text-alt text-base-content/50">
                  Provide custom instructions to shape model behavior
                </span>
              </label>
            </div>

            <div class="form-control w-full">
              <label class="label" for="temperature">
                <span class="label-text font-medium">Temperature</span>
                <span class="label-text-alt font-mono text-base-content/70">0.3</span>
              </label>
              <input
                type="range"
                id="temperature"
                min="0"
                max="2"
                step="0.1"
                value="0.3"
                class="range range-luxe"
              />
              <div class="flex justify-between text-xs text-base-content/50 px-1 mt-1">
                <span>0.0 (Deterministic)</span>
                <span>2.0 (Creative)</span>
              </div>
            </div>

            <div class="form-control w-full">
              <label class="label">
                <span class="label-text font-medium">Select Models</span>
              </label>
              ${
                hasModels
                  ? `<div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 p-3 bg-base-200 rounded-lg">${modelMarkup}</div>`
                  : warningState
              }
            </div>

            <div class="modal-action">
              <button type="button" class="btn btn-ghost min-w-28">Cancel</button>
              <button type="submit" class="btn btn-luxe btn-luxe-primary min-w-28" ${
                hasModels ? "" : "disabled"
              }>
                Run Evaluation
              </button>
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

export const NoModelsConfigured: Story = {
  args: {
    models: [],
  },
  render: Default.render,
};

export const SystemPromptEnabled: Story = {
  args: {
    systemPromptEnabled: true,
    rubricType: "semantic_similarity",
  },
  render: Default.render,
};
