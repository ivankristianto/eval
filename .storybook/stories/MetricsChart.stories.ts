import type { Meta, StoryObj } from "@storybook/html-vite";

type MetricsChartArgs = {
  iterations: Array<{
    iteration_num: number;
    f1_score: number;
    cohens_kappa: number;
  }>;
  targetF1: number;
};

const meta = {
  title: "Components/MetricsChart",
  tags: ["autodocs"],
  args: {
    iterations: [
      { iteration_num: 1, f1_score: 0.52, cohens_kappa: 0.41 },
      { iteration_num: 2, f1_score: 0.6, cohens_kappa: 0.48 },
      { iteration_num: 3, f1_score: 0.68, cohens_kappa: 0.56 },
      { iteration_num: 4, f1_score: 0.74, cohens_kappa: 0.63 },
      { iteration_num: 5, f1_score: 0.81, cohens_kappa: 0.7 },
    ],
    targetF1: 0.8,
  },
} satisfies Meta<MetricsChartArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

const width = 800;
const height = 400;
const padding = { top: 20, right: 120, bottom: 50, left: 60 };
const chartWidth = width - padding.left - padding.right;
const chartHeight = height - padding.top - padding.bottom;

const scaleX = (iteration: number, xMax: number) =>
  padding.left + ((iteration - 0) / (xMax - 0 || 1)) * chartWidth;

const scaleY = (value: number) =>
  padding.top + chartHeight - ((value - 0) / (1 - 0)) * chartHeight;

const generatePath = (data: Array<{ x: number; y: number }>, xMax: number) => {
  if (data.length === 0) return "";
  return data
    .map((point, index) => {
      const x = scaleX(point.x, xMax);
      const y = scaleY(point.y);
      return index === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
    })
    .join(" ");
};

export const Default: Story = {
  render: (args) => {
    const xMax = Math.max(...args.iterations.map((i) => i.iteration_num), 1);
    const f1Path = generatePath(
      args.iterations.map((iter) => ({ x: iter.iteration_num, y: iter.f1_score })),
      xMax
    );
    const kappaPath = generatePath(
      args.iterations.map((iter) => ({ x: iter.iteration_num, y: iter.cohens_kappa })),
      xMax
    );
    const targetY = scaleY(args.targetF1);

    const yTicks = [0, 0.2, 0.4, 0.6, 0.8, 1.0];
    const xTicks = args.iterations.map((i) => i.iteration_num);

    const gridLines = yTicks
      .map(
        (tick) => `
        <line
          x1="${padding.left}"
          y1="${scaleY(tick)}"
          x2="${width - padding.right}"
          y2="${scaleY(tick)}"
          stroke="currentColor"
          stroke-width="1"
          stroke-dasharray="4 4"
        />
      `
      )
      .join("");

    const points = args.iterations
      .map(
        (iter) => `
        <circle
          cx="${scaleX(iter.iteration_num, xMax)}"
          cy="${scaleY(iter.f1_score)}"
          r="4"
          fill="#3b82f6"
        ></circle>
        <circle
          cx="${scaleX(iter.iteration_num, xMax)}"
          cy="${scaleY(iter.cohens_kappa)}"
          r="4"
          fill="#8b5cf6"
        ></circle>
      `
      )
      .join("");

    const xTicksMarkup = xTicks
      .map(
        (tick) => `
        <line
          x1="${scaleX(tick, xMax)}"
          y1="${height - padding.bottom}"
          x2="${scaleX(tick, xMax)}"
          y2="${height - padding.bottom + 6}"
          stroke="currentColor"
          stroke-width="2"
        />
        <text
          x="${scaleX(tick, xMax)}"
          y="${height - padding.bottom + 20}"
          text-anchor="middle"
          class="text-xs fill-current"
          font-family="monospace"
        >
          ${tick}
        </text>
      `
      )
      .join("");

    const yTicksMarkup = yTicks
      .map(
        (tick) => `
        <line
          x1="${padding.left - 6}"
          y1="${scaleY(tick)}"
          x2="${padding.left}"
          y2="${scaleY(tick)}"
          stroke="currentColor"
          stroke-width="2"
        />
        <text
          x="${padding.left - 10}"
          y="${scaleY(tick) + 4}"
          text-anchor="end"
          class="text-xs fill-current"
          font-family="monospace"
        >
          ${(tick * 100).toFixed(0)}%
        </text>
      `
      )
      .join("");

    return `
      <div class="metrics-chart-container">
        <svg
          viewBox="0 0 ${width} ${height}"
          class="w-full h-auto"
          role="img"
          aria-label="Training metrics chart showing F1 score and Cohen's Kappa over iterations"
        >
          <g class="grid opacity-20">
            ${gridLines}
          </g>

          <line
            x1="${padding.left}"
            y1="${targetY}"
            x2="${width - padding.right}"
            y2="${targetY}"
            stroke="#10b981"
            stroke-width="2"
            stroke-dasharray="6 3"
            opacity="0.6"
          />
          <text
            x="${width - padding.right + 5}"
            y="${targetY + 4}"
            class="text-xs fill-success"
            font-family="monospace"
          >
            Target ${(args.targetF1 * 100).toFixed(0)}%
          </text>

          ${f1Path ? `<path d="${f1Path}" fill="none" stroke="#3b82f6" stroke-width="3" />` : ""}
          ${kappaPath ? `<path d="${kappaPath}" fill="none" stroke="#8b5cf6" stroke-width="3" />` : ""}

          ${points}

          <line
            x1="${padding.left}"
            y1="${height - padding.bottom}"
            x2="${width - padding.right}"
            y2="${height - padding.bottom}"
            stroke="currentColor"
            stroke-width="2"
          />

          ${xTicksMarkup}

          <text
            x="${padding.left + chartWidth / 2}"
            y="${height - 5}"
            text-anchor="middle"
            class="text-sm fill-current font-semibold"
          >
            Iteration
          </text>

          <line
            x1="${padding.left}"
            y1="${padding.top}"
            x2="${padding.left}"
            y2="${height - padding.bottom}"
            stroke="currentColor"
            stroke-width="2"
          />

          ${yTicksMarkup}

          <text
            x="15"
            y="${padding.top + chartHeight / 2}"
            text-anchor="middle"
            transform="rotate(-90, 15, ${padding.top + chartHeight / 2})"
            class="text-sm fill-current font-semibold"
          >
            Score
          </text>

          <g transform="translate(${width - padding.right + 10}, ${padding.top + 20})">
            <line x1="0" y1="0" x2="30" y2="0" stroke="#3b82f6" stroke-width="3" />
            <circle cx="15" cy="0" r="4" fill="#3b82f6" />
            <text x="35" y="4" class="text-xs fill-current">F1 Score</text>
            <line x1="0" y1="25" x2="30" y2="25" stroke="#8b5cf6" stroke-width="3" />
            <circle cx="15" cy="25" r="4" fill="#8b5cf6" />
            <text x="35" y="29" class="text-xs fill-current">Cohen's Kappa</text>
          </g>
        </svg>
      </div>
    `;
  },
};

export const EarlyIterations: Story = {
  args: {
    iterations: [
      { iteration_num: 1, f1_score: 0.35, cohens_kappa: 0.22 },
      { iteration_num: 2, f1_score: 0.44, cohens_kappa: 0.3 },
      { iteration_num: 3, f1_score: 0.5, cohens_kappa: 0.38 },
    ],
    targetF1: 0.75,
  },
  render: Default.render,
};
