import type { Meta, StoryObj } from "@storybook/html-vite";

type PersonaTabsArgs = {
  personaId: string;
  activeTab:
    | "overview"
    | "training-data"
    | "training-progress"
    | "metrics"
    | "judge-prompts"
    | "settings";
};

const meta = {
  title: "Components/PersonaTabs",
  tags: ["autodocs"],
  args: {
    personaId: "persona-42",
    activeTab: "overview",
  },
  argTypes: {
    activeTab: {
      control: "select",
      options: [
        "overview",
        "training-data",
        "training-progress",
        "metrics",
        "judge-prompts",
        "settings",
      ],
    },
  },
} satisfies Meta<PersonaTabsArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

const tabs = [
  { id: "overview", label: "Overview", href: "?tab=overview" },
  { id: "training-data", label: "Training Data", href: "/training" },
  { id: "training-progress", label: "Training Progress", href: "?tab=training-progress" },
  { id: "metrics", label: "Metrics", href: "/metrics" },
  { id: "judge-prompts", label: "Judge Prompts", href: "/judge-prompts" },
  { id: "settings", label: "Settings", href: "?tab=settings" },
];

export const Default: Story = {
  render: (args) => {
    const tabMarkup = tabs
      .map(
        (tab) => `
          <a
            href="/personas/${args.personaId}${tab.href}"
            class="tab tab-lg ${args.activeTab === tab.id ? "tab-active" : ""}"
          >
            ${tab.label}
          </a>
        `
      )
      .join("");

    return `
      <div class="tabs tabs-boxed bg-base-200 mb-8 animate-reveal delay-100">
        ${tabMarkup}
      </div>
    `;
  },
};

export const MetricsActive: Story = {
  args: {
    activeTab: "metrics",
  },
  render: Default.render,
};

export const JudgePromptsActive: Story = {
  args: {
    activeTab: "judge-prompts",
  },
  render: Default.render,
};
