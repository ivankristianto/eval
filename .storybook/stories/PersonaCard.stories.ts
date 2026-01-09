import type { Meta, StoryObj } from "@storybook/html-vite";

type PersonaCardArgs = {
  id: string;
  name: string;
  description?: string;
  status: "draft" | "training" | "trained" | "incomplete";
  createdAt: string;
  currentIteration: number;
  maxIterations: number;
  bestF1Score: number | null;
  targetF1Score: number;
};

const meta = {
  title: "Components/PersonaCard",
  tags: ["autodocs"],
  args: {
    id: "persona-42",
    name: "Support Concierge",
    description: "Handles tier-1 troubleshooting with concise guidance.",
    status: "training",
    createdAt: "2025-02-15",
    currentIteration: 3,
    maxIterations: 8,
    bestF1Score: 0.67,
    targetF1Score: 0.8,
  },
  argTypes: {
    status: {
      control: "select",
      options: ["draft", "training", "trained", "incomplete"],
    },
  },
} satisfies Meta<PersonaCardArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

const getStatusVariant = (status: PersonaCardArgs["status"]) => {
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

export const Default: Story = {
  render: (args) => {
    const statusVariant = getStatusVariant(args.status);
    const descriptionMarkup = args.description
      ? `<p class="text-sm text-base-content/70 line-clamp-2 mb-4">${args.description}</p>`
      : "";
    const f1Markup =
      args.status === "trained" && args.bestF1Score !== null
        ? `
          <div>
            <div class="text-base-content/60 text-xs uppercase tracking-wide mb-1">F1 Score</div>
            <div class="font-mono font-semibold text-success">
              ${(args.bestF1Score * 100).toFixed(1)}%
            </div>
          </div>
        `
        : "";
    const iterationMarkup =
      args.status !== "draft"
        ? `
          <div>
            <div class="text-base-content/60 text-xs uppercase tracking-wide mb-1">Iterations</div>
            <div class="font-mono font-semibold">
              ${args.currentIteration} / ${args.maxIterations}
            </div>
          </div>
        `
        : "";
    const startTrainingButton =
      args.status === "draft"
        ? `
          <button class="btn btn-sm btn-success start-training-btn" data-persona-id="${args.id}">
            Start Training
          </button>
        `
        : "";

    return `
      <div class="card bg-base-200 shadow-xl hover:shadow-2xl transition-shadow max-w-xl">
        <div class="card-body">
          <div class="flex items-start justify-between">
            <a href="/personas/${args.id}" class="flex-1">
              <h3 class="card-title text-lg mb-2 hover:text-primary transition-colors">
                ${args.name}
              </h3>
            </a>
            <span class="badge badge-${statusVariant} badge-sm">${args.status}</span>
          </div>

          ${descriptionMarkup}

          <div class="grid grid-cols-2 gap-4 text-sm">
            ${f1Markup}
            ${iterationMarkup}
            <div>
              <div class="text-base-content/60 text-xs uppercase tracking-wide mb-1">Created</div>
              <div class="text-base-content/80">${args.createdAt}</div>
            </div>
            <div>
              <div class="text-base-content/60 text-xs uppercase tracking-wide mb-1">Target F1</div>
              <div class="font-mono font-semibold">${(args.targetF1Score * 100).toFixed(0)}%</div>
            </div>
          </div>

          <div class="card-actions justify-end mt-4">
            <a href="/personas/${args.id}" class="btn btn-sm btn-primary">View Details</a>
            ${startTrainingButton}
            <div class="dropdown dropdown-end">
              <label tabindex="0" class="btn btn-sm btn-ghost">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                  ></path>
                </svg>
              </label>
              <ul tabindex="0" class="dropdown-content z-1 menu p-2 shadow bg-base-100 rounded-box w-52">
                <li><a href="/personas/${args.id}">Edit</a></li>
                <li><button class="delete-persona-btn text-error">Delete</button></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    `;
  },
};

export const Draft: Story = {
  args: {
    status: "draft",
    bestF1Score: null,
    currentIteration: 0,
    maxIterations: 6,
  },
  render: Default.render,
};

export const Trained: Story = {
  args: {
    status: "trained",
    currentIteration: 8,
    maxIterations: 8,
    bestF1Score: 0.91,
    targetF1Score: 0.85,
  },
  render: Default.render,
};
