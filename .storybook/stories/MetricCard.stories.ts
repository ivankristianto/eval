import type { Meta, StoryObj } from "@storybook/html-vite";

type MetricCardArgs = {
  label: string;
  value: number | null;
  format: "percentage" | "number" | "raw";
  description?: string;
  trend?: "up" | "down" | "stable";
  variant: "primary" | "success" | "warning" | "error" | "info";
};

const meta = {
  title: "Components/MetricCard",
  tags: ["autodocs"],
  args: {
    label: "F1 Score",
    value: 0.923,
    format: "percentage",
    description: "Overall F1 across all evaluation tasks.",
    trend: "up",
    variant: "success",
  },
  argTypes: {
    format: {
      control: "select",
      options: ["percentage", "number", "raw"],
    },
    trend: {
      control: "select",
      options: ["up", "down", "stable"],
    },
    variant: {
      control: "select",
      options: ["primary", "success", "warning", "error", "info"],
    },
  },
} satisfies Meta<MetricCardArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

const formatValue = (value: number | null, format: MetricCardArgs["format"]) => {
  if (value === null) return "N/A";

  switch (format) {
    case "percentage":
      return `${(value * 100).toFixed(1)}%`;
    case "number":
      return value.toFixed(2);
    case "raw":
      return value.toString();
  }
};

const getVariantClass = (variant: MetricCardArgs["variant"]) => {
  switch (variant) {
    case "success":
      return "text-success";
    case "warning":
      return "text-warning";
    case "error":
      return "text-error";
    case "info":
      return "text-info";
    default:
      return "text-primary";
  }
};

const getTrend = (trend?: MetricCardArgs["trend"]) => {
  if (!trend) return null;

  switch (trend) {
    case "up":
      return { icon: "M5 15l7-7 7 7", color: "text-success" };
    case "down":
      return { icon: "M19 9l-7 7-7-7", color: "text-error" };
    case "stable":
      return { icon: "M5 12h14", color: "text-base-content/60" };
  }
};

export const Default: Story = {
  render: (args) => {
    const trendInfo = getTrend(args.trend);
    const descriptionMarkup = args.description
      ? `
        <div class="tooltip tooltip-right" data-tip="${args.description}">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4 text-base-content/40"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
      `
      : "";

    return `
      <div class="card bg-base-200 shadow-md">
        <div class="card-body p-4">
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <h3 class="text-xs font-semibold text-base-content/60 uppercase tracking-wide">
                  ${args.label}
                </h3>
                ${descriptionMarkup}
              </div>
              <div class="text-3xl font-bold font-mono mt-2 ${getVariantClass(args.variant)}">
                ${formatValue(args.value, args.format)}
              </div>
            </div>
            ${
              trendInfo
                ? `
                <div class="flex items-center gap-1 ${trendInfo.color}">
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
                      d="${trendInfo.icon}"
                    />
                  </svg>
                </div>
              `
                : ""
            }
          </div>
        </div>
      </div>
    `;
  },
};

export const Downtrend: Story = {
  args: {
    label: "Latency (p95)",
    value: 1.82,
    format: "number",
    description: "Milliseconds at p95.",
    trend: "down",
    variant: "warning",
  },
  render: Default.render,
};

export const MissingValue: Story = {
  args: {
    label: "Token Delta",
    value: null,
    format: "raw",
    description: "Awaiting token report.",
    trend: "stable",
    variant: "info",
  },
  render: Default.render,
};
