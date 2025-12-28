import type { Meta, StoryObj } from "@storybook/html-vite";

type JudgeDecisionReviewArgs = {
  judgeDecision: "agree" | "disagree";
  judgeConfidence: number;
  judgeReasoning: string;
  hasReview: boolean;
  humanDecision: "agree" | "disagree";
  humanConfidence: number;
  humanNotes: string;
};

const meta = {
  title: "Components/JudgeDecisionReview",
  tags: ["autodocs"],
  args: {
    judgeDecision: "agree",
    judgeConfidence: 0.82,
    judgeReasoning: "The output matches the expected structure and key points.",
    hasReview: false,
    humanDecision: "agree",
    humanConfidence: 0.75,
    humanNotes: "Good match with only minor phrasing differences.",
  },
  argTypes: {
    judgeDecision: {
      control: "radio",
      options: ["agree", "disagree"],
    },
    hasReview: {
      control: "boolean",
    },
  },
} satisfies Meta<JudgeDecisionReviewArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

const decisionBadge = (decision: "agree" | "disagree") =>
  decision === "agree" ? "badge-success" : "badge-error";

export const Default: Story = {
  render: (args) => {
    const reviewSection = args.hasReview
      ? `
        <div class="mt-6 pt-6 border-t border-base-content/10">
          <div class="flex items-center justify-between mb-4">
            <h4 class="text-sm font-semibold text-base-content/60 uppercase tracking-wide">Your Review</h4>
            <span class="badge badge-md ${decisionBadge(args.humanDecision)}">${args.humanDecision}</span>
          </div>

          <div class="grid grid-cols-2 gap-4 mb-4">
            <div>
              <div class="text-xs text-base-content/60 uppercase tracking-wide mb-1">Your Confidence</div>
              <div class="font-mono text-lg font-semibold">${Math.round(args.humanConfidence * 100)}%</div>
            </div>
            <div>
              <div class="text-xs text-base-content/60 uppercase tracking-wide mb-1">Reviewed</div>
              <div class="text-sm">Apr 10, 2025 3:45 PM</div>
            </div>
          </div>

          <div class="bg-base-300 rounded-lg p-3">
            <p class="text-sm whitespace-pre-wrap">${args.humanNotes}</p>
          </div>
        </div>
      `
      : `
        <div class="mt-6 pt-6 border-t border-base-content/10">
          <h4 class="text-sm font-semibold text-base-content/60 uppercase tracking-wide mb-4">Your Review</h4>

          <form class="space-y-4">
            <div class="flex gap-4">
              <label class="flex-1">
                <input type="radio" name="decision" value="agree" class="radio radio-success" checked />
                <span class="ml-2">Agree with Judge</span>
              </label>
              <label class="flex-1">
                <input type="radio" name="decision" value="disagree" class="radio radio-error" />
                <span class="ml-2">Disagree with Judge</span>
              </label>
            </div>

            <div>
              <label class="label">
                <span class="label-text">Confidence (Optional)</span>
              </label>
              <input type="range" min="0" max="100" value="50" class="range range-sm" />
              <div class="w-full flex justify-between text-xs px-2 mt-1">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>

            <div>
              <label class="label">
                <span class="label-text">Notes (Optional)</span>
              </label>
              <textarea
                class="textarea textarea-bordered w-full"
                rows="3"
                placeholder="Add any notes about your decision..."
              ></textarea>
            </div>

            <div class="card-actions justify-end">
              <button type="button" class="btn btn-primary">Submit Review</button>
            </div>
          </form>
        </div>
      `;

    return `
      <div class="card bg-base-200 shadow-lg">
        <div class="card-body">
          <div class="mb-4">
            <h4 class="text-sm font-semibold text-base-content/60 uppercase tracking-wide mb-2">Input</h4>
            <div class="bg-base-300 rounded-lg p-3">
              <p class="text-sm whitespace-pre-wrap">Summarize the incident and provide next steps.</p>
            </div>
          </div>

          <div class="mb-4">
            <h4 class="text-sm font-semibold text-base-content/60 uppercase tracking-wide mb-2">
              Expected Output (Ground Truth)
            </h4>
            <div class="bg-base-300 rounded-lg p-3">
              <p class="text-sm whitespace-pre-wrap">A concise summary with owner and action list.</p>
            </div>
            <div class="text-xs text-base-content/50 mt-1">
              The correct answer we're comparing against
            </div>
          </div>

          <div class="mb-4">
            <h4 class="text-sm font-semibold text-base-content/60 uppercase tracking-wide mb-2">
              Task Model Output
            </h4>
            <div class="bg-base-300 rounded-lg p-3">
              <p class="text-sm whitespace-pre-wrap">
                Summary: Config error caused latency. Next steps: rollback, notify users, add guardrails.
              </p>
            </div>
            <div class="text-xs text-base-content/50 mt-1">
              What the task model generated for the input above
            </div>
          </div>

          <div class="flex items-center gap-4 mb-4 pb-4 border-b border-base-content/10">
            <div>
              <div class="text-xs text-base-content/60 uppercase tracking-wide mb-1">Judge Decision</div>
              <span class="badge badge-lg ${decisionBadge(args.judgeDecision)}">${args.judgeDecision}</span>
            </div>

            <div>
              <div class="text-xs text-base-content/60 uppercase tracking-wide mb-1">Confidence</div>
              <div class="font-mono text-lg font-semibold">${Math.round(args.judgeConfidence * 100)}%</div>
            </div>
          </div>

          <div class="mb-4">
            <h4 class="text-sm font-semibold text-base-content/60 uppercase tracking-wide mb-2">
              Judge's Reasoning
            </h4>
            <div class="bg-base-300 rounded-lg p-3">
              <p class="text-sm whitespace-pre-wrap">${args.judgeReasoning}</p>
            </div>
            <div class="text-xs text-base-content/50 mt-1">
              Why the judge ${args.judgeDecision === "agree" ? "agrees" : "disagrees"} that the
              task output matches the expected output
            </div>
          </div>

          ${reviewSection}
        </div>
      </div>
    `;
  },
};

export const NeedsReview: Story = {
  args: {
    hasReview: false,
  },
  render: Default.render,
};

export const Reviewed: Story = {
  args: {
    hasReview: true,
    judgeDecision: "disagree",
    judgeConfidence: 0.61,
    judgeReasoning: "Missing the required owner and action list.",
    humanDecision: "agree",
    humanConfidence: 0.78,
    humanNotes: "Agree with judge: output is incomplete.",
  },
  render: Default.render,
};
