import type { Meta, StoryObj } from "@storybook/html-vite";

type TrainingProgressArgs = {
  status: "draft" | "training" | "trained" | "incomplete";
  currentIteration: number;
  maxIterations: number;
  bestF1Score: number | null;
  targetF1Score: number;
  showIterationCard: boolean;
  iterationNumber: number;
  iterationStatus: "in_progress" | "completed" | "paused" | "failed";
  pairsEvaluated: number;
  pairsReviewed: number;
};

const meta = {
  title: "Components/TrainingProgress",
  tags: ["autodocs"],
  args: {
    status: "training",
    currentIteration: 4,
    maxIterations: 10,
    bestF1Score: 0.61,
    targetF1Score: 0.8,
    showIterationCard: true,
    iterationNumber: 4,
    iterationStatus: "in_progress",
    pairsEvaluated: 80,
    pairsReviewed: 45,
  },
  argTypes: {
    status: {
      control: "select",
      options: ["draft", "training", "trained", "incomplete"],
    },
    iterationStatus: {
      control: "select",
      options: ["in_progress", "completed", "paused", "failed"],
    },
  },
} satisfies Meta<TrainingProgressArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

const getStatusVariant = (status: TrainingProgressArgs["status"]) => {
  switch (status) {
    case "draft":
      return "warning";
    case "training":
      return "info";
    case "trained":
      return "success";
    case "incomplete":
      return "error";
    default:
      return "info";
  }
};

const getIterationVariant = (status: TrainingProgressArgs["iterationStatus"]) => {
  switch (status) {
    case "in_progress":
      return "info";
    case "completed":
      return "success";
    case "paused":
      return "warning";
    case "failed":
      return "error";
    default:
      return "info";
  }
};

export const Default: Story = {
  render: (args) => {
    const progressPercentage =
      args.maxIterations > 0
        ? Math.round((args.currentIteration / args.maxIterations) * 100)
        : 0;
    const hasMetrics = args.bestF1Score !== null;
    const f1Progress = hasMetrics
      ? Math.round((args.bestF1Score / args.targetF1Score) * 100)
      : 0;
    const targetReached = hasMetrics && args.bestF1Score >= args.targetF1Score;
    const iterationPending = args.pairsEvaluated - args.pairsReviewed;

    return `
      <div class="card bg-base-200 shadow-lg max-w-2xl">
        <div class="card-body">
          <div class="flex items-start justify-between mb-4">
            <h3 class="card-title">Training Progress</h3>
            <span class="badge badge-${getStatusVariant(args.status)} badge-md">${args.status}</span>
          </div>

          <div class="mb-6">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-semibold text-base-content/60 uppercase tracking-wide">
                Iterations
              </span>
              <span class="font-mono font-bold">${args.currentIteration} / ${args.maxIterations}</span>
            </div>
            <progress
              class="progress progress-primary w-full"
              value="${args.currentIteration}"
              max="${args.maxIterations}"
            ></progress>
            <div class="text-xs text-base-content/60 text-right mt-1">${progressPercentage}% complete</div>
          </div>

          ${
            hasMetrics
              ? `
                <div class="mb-6">
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-sm font-semibold text-base-content/60 uppercase tracking-wide">
                      Best F1 Score
                    </span>
                    <span class="font-mono font-bold text-success">
                      ${(args.bestF1Score * 100).toFixed(1)}%
                    </span>
                  </div>
                  <progress
                    class="progress progress-success w-full"
                    value="${args.bestF1Score}"
                    max="${args.targetF1Score}"
                  ></progress>
                  <div class="flex items-center justify-between text-xs mt-1">
                    <span class="text-base-content/60">
                      Target: ${(args.targetF1Score * 100).toFixed(0)}%
                    </span>
                    ${
                      targetReached
                        ? '<span class="text-success font-semibold">Target reached</span>'
                        : `<span class="text-base-content/60">${f1Progress}% of target</span>`
                    }
                  </div>
                </div>
              `
              : `
                <div class="mb-6 p-4 bg-base-300 rounded-lg">
                  <div class="text-sm">
                    <div class="text-xs text-base-content/60 uppercase tracking-wide mb-1">Target</div>
                    <div>
                      Reach <span class="font-mono font-bold text-primary">${(
                        args.targetF1Score * 100
                      ).toFixed(0)}%</span> F1 score within
                      <span class="font-mono font-bold"> ${args.maxIterations}</span> iterations
                    </div>
                  </div>
                </div>
              `
          }

          ${
            args.showIterationCard
              ? `
                <div class="mb-6 p-4 bg-base-300 rounded-lg">
                  <div class="flex items-center justify-between mb-3">
                    <span class="text-sm font-semibold">Current Iteration #${args.iterationNumber}</span>
                    <span class="badge badge-${getIterationVariant(args.iterationStatus)} badge-sm">
                      ${args.iterationStatus}
                    </span>
                  </div>
                  <div class="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div class="text-xs text-base-content/60 uppercase tracking-wide mb-1">Pairs Evaluated</div>
                      <div class="font-mono font-semibold">${args.pairsEvaluated}</div>
                    </div>
                    <div>
                      <div class="text-xs text-base-content/60 uppercase tracking-wide mb-1">Human Reviews</div>
                      <div class="font-mono font-semibold">${args.pairsReviewed}</div>
                    </div>
                  </div>
                  ${
                    iterationPending > 0
                      ? `
                        <div class="mt-3">
                          <progress
                            class="progress progress-warning w-full"
                            value="${args.pairsReviewed}"
                            max="${args.pairsEvaluated}"
                          ></progress>
                          <div class="text-xs text-base-content/60 text-center mt-1">
                            ${iterationPending} reviews pending
                          </div>
                        </div>
                      `
                      : ""
                  }
                </div>
              `
              : ""
          }

          <div class="card-actions justify-end">
            <button class="btn btn-ghost btn-sm">View Logs</button>
            <button class="btn btn-primary btn-sm">Open Dashboard</button>
          </div>
        </div>
      </div>
    `;
  },
};

export const Draft: Story = {
  args: {
    status: "draft",
    currentIteration: 0,
    maxIterations: 6,
    bestF1Score: null,
    showIterationCard: false,
  },
  render: Default.render,
};

export const TargetReached: Story = {
  args: {
    status: "trained",
    currentIteration: 10,
    maxIterations: 10,
    bestF1Score: 0.84,
    targetF1Score: 0.8,
    showIterationCard: false,
  },
  render: Default.render,
};
