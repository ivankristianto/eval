import type { Meta, StoryObj } from "@storybook/html-vite";

type TrainingDashboardArgs = {
  state: "ready" | "converged" | "inProgress" | "empty" | "error";
};

const meta = {
  title: "Components/TrainingDashboard",
  tags: ["autodocs"],
  args: {
    state: "ready",
  },
  argTypes: {
    state: {
      control: "select",
      options: ["ready", "converged", "inProgress", "empty", "error"],
    },
  },
} satisfies Meta<TrainingDashboardArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => {
    const errorMarkup =
      args.state === "error"
        ? `
          <div class="alert alert-error">
            <span>Failed to load dashboard data: Network error</span>
          </div>
        `
        : "";

    const convergedMarkup =
      args.state === "converged"
        ? `
          <div class="alert alert-success">
            <div>
              <h3 class="font-bold">Training Converged!</h3>
              <div class="text-sm">F1 score >= 80% target achieved in 5 iterations</div>
            </div>
          </div>
        `
        : "";

    const inProgressMarkup =
      args.state === "inProgress"
        ? `
          <div class="alert alert-info">
            <div>
              <h3 class="font-bold">Iteration 6 In Progress</h3>
              <div class="text-sm">124 pairs evaluated, 34 reviewed by human</div>
            </div>
          </div>
        `
        : "";

    const emptyMarkup =
      args.state === "empty"
        ? `
          <div class="card bg-base-200 shadow-md">
            <div class="card-body text-center py-12">
              <h3 class="text-lg font-semibold text-base-content/60">No Training Data Yet</h3>
              <p class="text-base-content/40 mt-2">
                Complete at least one iteration to see metrics and progress visualization
              </p>
            </div>
          </div>
        `
        : "";

    const cardsMarkup =
      args.state === "empty" || args.state === "error"
        ? ""
        : `
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="card bg-base-200 shadow-md">
              <div class="card-body">
                <div class="text-xs text-base-content/50 uppercase">F1 Score</div>
                <div class="text-2xl font-semibold">${
                  args.state === "ready" ? "74%" : "82%"
                }</div>
                <div class="text-sm text-base-content/60">Primary convergence metric</div>
              </div>
            </div>
            <div class="card bg-base-200 shadow-md">
              <div class="card-body">
                <div class="text-xs text-base-content/50 uppercase">Precision</div>
                <div class="text-2xl font-semibold">81%</div>
                <div class="text-sm text-base-content/60">Correct positive predictions</div>
              </div>
            </div>
            <div class="card bg-base-200 shadow-md">
              <div class="card-body">
                <div class="text-xs text-base-content/50 uppercase">Recall</div>
                <div class="text-2xl font-semibold">77%</div>
                <div class="text-sm text-base-content/60">Actual positives found</div>
              </div>
            </div>
            <div class="card bg-base-200 shadow-md">
              <div class="card-body">
                <div class="text-xs text-base-content/50 uppercase">Cohen's Kappa</div>
                <div class="text-2xl font-semibold">69%</div>
                <div class="text-sm text-base-content/60">Inter-rater reliability</div>
              </div>
            </div>
          </div>
        `;

    const chartMarkup =
      args.state === "empty" || args.state === "error"
        ? ""
        : `
          <div class="card bg-base-200 shadow-md">
            <div class="card-body">
              <h2 class="card-title">Metrics Trend</h2>
              <div class="h-48 w-full bg-base-300 rounded-lg flex items-center justify-center text-base-content/60">
                Chart preview
              </div>
            </div>
          </div>
        `;

    return `
      <div class="training-dashboard space-y-6">
        ${errorMarkup}
        ${convergedMarkup}
        ${inProgressMarkup}
        ${cardsMarkup}
        ${chartMarkup}
        ${emptyMarkup}
      </div>
    `;
  },
};

export const Converged: Story = {
  args: {
    state: "converged",
  },
  render: Default.render,
};

export const InProgress: Story = {
  args: {
    state: "inProgress",
  },
  render: Default.render,
};

export const Empty: Story = {
  args: {
    state: "empty",
  },
  render: Default.render,
};

export const ErrorState: Story = {
  args: {
    state: "error",
  },
  render: Default.render,
};
