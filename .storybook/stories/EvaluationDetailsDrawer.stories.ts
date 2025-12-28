import type { Meta, StoryObj } from "@storybook/html-vite";

type EvaluationDetailsArgs = {
  open: boolean;
  modelName: string;
  prompt: string;
  expectedOutput: string;
  response: string;
  reasoning: string;
  executionTime?: number;
  accuracyScore?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  temperature?: number;
};

const meta = {
  title: "Components/EvaluationDetailsDrawer",
  tags: ["autodocs"],
  args: {
    open: true,
    modelName: "gpt-4.1",
    prompt: "Summarize the incident report and identify next steps.",
    expectedOutput: "A short summary with owner and next steps.",
    response:
      "Summary: The incident stemmed from a config error. Next steps: roll back, notify users, add checks.",
    reasoning: "Matches the expected structure and includes the critical steps.",
    executionTime: 842,
    accuracyScore: 92,
    inputTokens: 482,
    outputTokens: 128,
    totalTokens: 610,
    temperature: 0.4,
  },
  argTypes: {
    open: {
      control: "boolean",
    },
  },
} satisfies Meta<EvaluationDetailsArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => {
    const backdropClasses = args.open
      ? "fixed inset-0 bg-black/80 backdrop-blur-sm z-[60]"
      : "fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] hidden opacity-0";
    const drawerClasses = args.open
      ? "fixed top-0 right-0 h-full w-full max-w-md bg-base-100 z-[70] transform transition-transform duration-300 ease-in-out overflow-hidden flex flex-col"
      : "fixed top-0 right-0 h-full w-full max-w-md bg-base-100 z-[70] transform translate-x-full transition-transform duration-300 ease-in-out overflow-hidden flex flex-col";

    const formatValue = (value?: number, suffix?: string) =>
      value === undefined ? "-" : `${value}${suffix ?? ""}`;

    const temperatureValue = args.temperature ?? 0.3;
    const temperatureLabel = `${temperatureValue.toFixed(1)}${
      args.temperature === undefined ? " (default)" : ""
    }`;

    return `
      <div>
        <div class="${backdropClasses}"></div>
        <div class="${drawerClasses}" id="details-drawer">
          <div class="flex items-center justify-between p-6 border-b border-gold-light">
            <h2 class="font-display text-2xl font-semibold text-gradient-gold" id="details-drawer-title">
              Evaluation Details: ${args.modelName}
            </h2>
            <button type="button" class="btn btn-ghost btn-sm btn-circle" aria-label="Close">
              <span aria-hidden="true">✕</span>
            </button>
          </div>

          <div class="flex-1 overflow-y-auto p-6">
            <div class="space-y-6">
              <div>
                <h3 class="text-sm font-semibold text-base-content/70 mb-2">Full Prompt:</h3>
                <div class="bg-base-200 p-3 rounded-lg text-sm whitespace-pre-wrap">${args.prompt}</div>
              </div>

              <div>
                <h3 class="text-sm font-semibold text-base-content/70 mb-2">Expected Output:</h3>
                <div class="bg-base-200 p-3 rounded-lg text-sm font-mono">${args.expectedOutput}</div>
              </div>

              <div>
                <h3 class="text-sm font-semibold text-base-content/70 mb-2">Response:</h3>
                <div class="bg-base-200 p-3 rounded-lg text-sm font-mono whitespace-pre-wrap">${args.response}</div>
              </div>

              <div>
                <h3 class="text-sm font-semibold text-base-content/70 mb-2">Reasoning:</h3>
                <div class="bg-base-200 p-3 rounded-lg text-sm">${args.reasoning}</div>
              </div>

              <div>
                <h3 class="text-sm font-semibold text-base-content/70 mb-2">Metrics:</h3>
                <div class="grid grid-cols-2 gap-3">
                  <div class="bg-base-200 p-3 rounded-lg">
                    <div class="text-xs text-base-content/50">Execution Time</div>
                    <div class="font-semibold">${formatValue(args.executionTime, "ms")}</div>
                  </div>
                  <div class="bg-base-200 p-3 rounded-lg">
                    <div class="text-xs text-base-content/50">Accuracy Score</div>
                    <div class="font-semibold">${formatValue(args.accuracyScore, "%")}</div>
                  </div>
                  <div class="bg-base-200 p-3 rounded-lg">
                    <div class="text-xs text-base-content/50">Temperature</div>
                    <div class="font-semibold font-mono">${temperatureLabel}</div>
                  </div>
                  <div class="bg-base-200 p-3 rounded-lg">
                    <div class="text-xs text-base-content/50">Total Tokens</div>
                    <div class="font-semibold">${formatValue(args.totalTokens)}</div>
                  </div>
                  <div class="bg-base-200 p-3 rounded-lg">
                    <div class="text-xs text-base-content/50">Input Tokens</div>
                    <div class="font-semibold">${formatValue(args.inputTokens)}</div>
                  </div>
                  <div class="bg-base-200 p-3 rounded-lg">
                    <div class="text-xs text-base-content/50">Output Tokens</div>
                    <div class="font-semibold">${formatValue(args.outputTokens)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },
};

export const Closed: Story = {
  args: {
    open: false,
  },
  render: Default.render,
};

export const MinimalMetrics: Story = {
  args: {
    executionTime: undefined,
    accuracyScore: undefined,
    inputTokens: undefined,
    outputTokens: undefined,
    totalTokens: undefined,
    temperature: undefined,
  },
  render: Default.render,
};
