import type { Meta, StoryObj } from "@storybook/html";

type PromptDiffArgs = {
  beforePrompt: string;
  afterPrompt: string;
  beforeLabel: string;
  afterLabel: string;
  showLineNumbers: boolean;
};

const meta = {
  title: "Components/PromptDiffViewer",
  args: {
    beforePrompt: "Summarize the incident report.\nInclude next steps.\nKeep it brief.",
    afterPrompt:
      "Summarize the incident report.\nInclude next steps and owner.\nKeep it brief and actionable.",
    beforeLabel: "Before",
    afterLabel: "After",
    showLineNumbers: false,
  },
  argTypes: {
    showLineNumbers: {
      control: "boolean",
    },
  },
} satisfies Meta<PromptDiffArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

const getDiffSummary = (beforePrompt: string, afterPrompt: string) => {
  const beforeLines = beforePrompt.split("\n");
  const afterLines = afterPrompt.split("\n");
  const maxLines = Math.max(beforeLines.length, afterLines.length);
  let linesAdded = 0;
  let linesRemoved = 0;
  let linesModified = 0;

  for (let i = 0; i < maxLines; i += 1) {
    const beforeLine = beforeLines[i];
    const afterLine = afterLines[i];
    if (beforeLine === undefined && afterLine !== undefined) {
      linesAdded += 1;
    } else if (beforeLine !== undefined && afterLine === undefined) {
      linesRemoved += 1;
    } else if (beforeLine !== afterLine) {
      linesModified += 1;
    }
  }

  return { linesAdded, linesRemoved, linesModified, beforeLines, afterLines };
};

const formatLines = (lines: string[], showLineNumbers: boolean) =>
  lines
    .map((line, idx) => {
      const lineNum = showLineNumbers ? `${(idx + 1).toString().padStart(3, " ")} | ` : "";
      return `${lineNum}${line}`;
    })
    .join("\n");

export const Default: Story = {
  render: (args) => {
    const { linesAdded, linesRemoved, linesModified, beforeLines, afterLines } = getDiffSummary(
      args.beforePrompt,
      args.afterPrompt
    );
    const noChanges = linesAdded === 0 && linesRemoved === 0 && linesModified === 0;
    const summaryMarkup = noChanges
      ? `
        <div class="alert">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            class="stroke-info shrink-0 w-6 h-6"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>No changes detected between versions</span>
        </div>
      `
      : `
        <div class="stats shadow">
          ${
            linesAdded > 0
              ? `<div class="stat"><div class="stat-title">Lines Added</div><div class="stat-value text-success">${linesAdded}</div></div>`
              : ""
          }
          ${
            linesRemoved > 0
              ? `<div class="stat"><div class="stat-title">Lines Removed</div><div class="stat-value text-error">${linesRemoved}</div></div>`
              : ""
          }
          ${
            linesModified > 0
              ? `<div class="stat"><div class="stat-title">Lines Modified</div><div class="stat-value text-warning">${linesModified}</div></div>`
              : ""
          }
        </div>
      `;

    return `
      <div class="prompt-diff-viewer">
        <div class="mb-4">${summaryMarkup}</div>

        <div class="grid grid-cols-2 gap-4">
          <div class="diff-column">
            <div class="bg-base-300 rounded-t-lg p-2">
              <div class="font-semibold text-sm">${args.beforeLabel}</div>
            </div>
            <div class="bg-base-200 rounded-b-lg p-3 overflow-x-auto">
              <pre class="text-xs font-mono whitespace-pre-wrap">${formatLines(
                beforeLines,
                args.showLineNumbers
              )}</pre>
            </div>
          </div>
          <div class="diff-column">
            <div class="bg-base-300 rounded-t-lg p-2">
              <div class="font-semibold text-sm">${args.afterLabel}</div>
            </div>
            <div class="bg-base-200 rounded-b-lg p-3 overflow-x-auto">
              <pre class="text-xs font-mono whitespace-pre-wrap">${formatLines(
                afterLines,
                args.showLineNumbers
              )}</pre>
            </div>
          </div>
        </div>

        <div class="mt-4 text-xs text-base-content/60">
          <div class="flex justify-between">
            <span>${args.beforeLabel}: ${args.beforePrompt.length} characters</span>
            <span>${args.afterLabel}: ${args.afterPrompt.length} characters</span>
          </div>
        </div>
      </div>
    `;
  },
};

export const NoChanges: Story = {
  args: {
    beforePrompt: "Return a JSON object with title and summary.",
    afterPrompt: "Return a JSON object with title and summary.",
  },
  render: Default.render,
};

export const WithLineNumbers: Story = {
  args: {
    showLineNumbers: true,
  },
  render: Default.render,
};
