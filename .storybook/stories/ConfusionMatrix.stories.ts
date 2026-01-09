import type { Meta, StoryObj } from "@storybook/html-vite";

type ConfusionMatrixArgs = {
  matrix: {
    true_positives: number;
    true_negatives: number;
    false_positives: number;
    false_negatives: number;
  };
  showLabels: boolean;
};

const meta = {
  title: "Components/ConfusionMatrix",
  tags: ["autodocs"],
  args: {
    matrix: {
      true_positives: 72,
      true_negatives: 58,
      false_positives: 12,
      false_negatives: 8,
    },
    showLabels: true,
  },
  argTypes: {
    showLabels: {
      control: "boolean",
    },
  },
} satisfies Meta<ConfusionMatrixArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

const getPercentage = (value: number, total: number) => {
  if (total === 0) return "0.0";
  return ((value / total) * 100).toFixed(1);
};

const getCellColor = (value: number, total: number, isCorrect: boolean) => {
  if (total === 0) return "bg-base-300";

  const percentage = (value / total) * 100;

  if (isCorrect) {
    if (percentage >= 40) return "bg-success text-success-content";
    if (percentage >= 20) return "bg-success/70 text-success-content";
    if (percentage >= 10) return "bg-success/50";
    return "bg-success/30";
  }

  if (percentage >= 40) return "bg-error text-error-content";
  if (percentage >= 20) return "bg-error/70 text-error-content";
  if (percentage >= 10) return "bg-error/50";
  return "bg-error/30";
};

export const Default: Story = {
  render: (args) => {
    const total =
      args.matrix.true_positives +
      args.matrix.true_negatives +
      args.matrix.false_positives +
      args.matrix.false_negatives;

    const labelColumn = args.showLabels
      ? `
        <div class="text-center font-semibold text-sm pb-2 border-b-2 border-base-content/20">
          <div class="text-xs text-base-content/60 uppercase tracking-wide mb-1">
            Predicted
          </div>
          <div>Agree</div>
        </div>
        <div class="text-center font-semibold text-sm pb-2 border-b-2 border-base-content/20">
          <div class="text-xs text-base-content/60 uppercase tracking-wide mb-1">
            Predicted
          </div>
          <div>Disagree</div>
        </div>
      `
      : "";

    const labelRow = args.showLabels
      ? `
        <div class="flex items-center justify-end pr-4 font-semibold text-sm border-r-2 border-base-content/20">
          <div class="text-right">
            <div class="text-xs text-base-content/60 uppercase tracking-wide mb-1">Actual</div>
            <div>Agree</div>
          </div>
        </div>
      `
      : "";

    const labelRowTwo = args.showLabels
      ? `
        <div class="flex items-center justify-end pr-4 font-semibold text-sm border-r-2 border-base-content/20">
          <div class="text-right">
            <div class="text-xs text-base-content/60 uppercase tracking-wide mb-1">Actual</div>
            <div>Disagree</div>
          </div>
        </div>
      `
      : "";

    return `
      <div class="card bg-base-200 shadow-md">
        <div class="card-body">
          <h3 class="card-title text-lg mb-4">Confusion Matrix</h3>

          <div class="overflow-x-auto">
            <div class="inline-block min-w-full">
              <div class="grid grid-cols-[auto_1fr_1fr] gap-2">
                <div></div>
                ${labelColumn}
                ${labelRow}
                <div class="p-4 rounded-lg ${getCellColor(
                  args.matrix.true_positives,
                  total,
                  true
                )}">
                  <div class="text-center">
                    <div class="text-xs font-semibold uppercase tracking-wide mb-1 opacity-80">
                      True Positive
                    </div>
                    <div class="text-3xl font-bold font-mono">${args.matrix.true_positives}</div>
                    <div class="text-xs mt-1 opacity-70">
                      ${getPercentage(args.matrix.true_positives, total)}%
                    </div>
                  </div>
                </div>
                <div class="p-4 rounded-lg ${getCellColor(
                  args.matrix.false_negatives,
                  total,
                  false
                )}">
                  <div class="text-center">
                    <div class="text-xs font-semibold uppercase tracking-wide mb-1 opacity-80">
                      False Negative
                    </div>
                    <div class="text-3xl font-bold font-mono">${args.matrix.false_negatives}</div>
                    <div class="text-xs mt-1 opacity-70">
                      ${getPercentage(args.matrix.false_negatives, total)}%
                    </div>
                  </div>
                </div>
                ${labelRowTwo}
                <div class="p-4 rounded-lg ${getCellColor(
                  args.matrix.false_positives,
                  total,
                  false
                )}">
                  <div class="text-center">
                    <div class="text-xs font-semibold uppercase tracking-wide mb-1 opacity-80">
                      False Positive
                    </div>
                    <div class="text-3xl font-bold font-mono">${args.matrix.false_positives}</div>
                    <div class="text-xs mt-1 opacity-70">
                      ${getPercentage(args.matrix.false_positives, total)}%
                    </div>
                  </div>
                </div>
                <div class="p-4 rounded-lg ${getCellColor(
                  args.matrix.true_negatives,
                  total,
                  true
                )}">
                  <div class="text-center">
                    <div class="text-xs font-semibold uppercase tracking-wide mb-1 opacity-80">
                      True Negative
                    </div>
                    <div class="text-3xl font-bold font-mono">${args.matrix.true_negatives}</div>
                    <div class="text-xs mt-1 opacity-70">
                      ${getPercentage(args.matrix.true_negatives, total)}%
                    </div>
                  </div>
                </div>
              </div>

              <div class="mt-6 pt-4 border-t border-base-content/10">
                <div class="text-xs text-base-content/60 uppercase tracking-wide mb-2">
                  Understanding the Matrix
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <div class="flex items-start gap-2">
                    <div class="w-4 h-4 rounded bg-success mt-0.5"></div>
                    <div>
                      <span class="font-semibold">True Positive (TP):</span> Judge agreed, Human agreed
                    </div>
                  </div>
                  <div class="flex items-start gap-2">
                    <div class="w-4 h-4 rounded bg-success mt-0.5"></div>
                    <div>
                      <span class="font-semibold">True Negative (TN):</span> Judge disagreed, Human disagreed
                    </div>
                  </div>
                  <div class="flex items-start gap-2">
                    <div class="w-4 h-4 rounded bg-error mt-0.5"></div>
                    <div>
                      <span class="font-semibold">False Positive (FP):</span> Judge agreed, Human disagreed
                    </div>
                  </div>
                  <div class="flex items-start gap-2">
                    <div class="w-4 h-4 rounded bg-error mt-0.5"></div>
                    <div>
                      <span class="font-semibold">False Negative (FN):</span> Judge disagreed, Human agreed
                    </div>
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

export const WithoutLabels: Story = {
  args: {
    showLabels: false,
  },
  render: Default.render,
};

export const SkewedResults: Story = {
  args: {
    matrix: {
      true_positives: 20,
      true_negatives: 6,
      false_positives: 60,
      false_negatives: 14,
    },
  },
  render: Default.render,
};
