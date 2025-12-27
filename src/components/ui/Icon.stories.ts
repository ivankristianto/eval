import type { Meta, StoryObj } from "@storybook/html";

type IconArgs = {
  name: "success" | "error" | "warning" | "info" | "close";
  size: "xs" | "sm" | "md" | "lg" | "xl";
};

const meta = {
  title: "UI/Icon",
  argTypes: {
    name: {
      control: "select",
      options: ["success", "error", "warning", "info", "close"],
    },
    size: {
      control: "select",
      options: ["xs", "sm", "md", "lg", "xl"],
    },
  },
  args: {
    name: "success",
    size: "lg",
  },
} satisfies Meta<IconArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => {
    const sizeClasses: Record<IconArgs["size"], string> = {
      xs: "w-3 h-3",
      sm: "w-4 h-4",
      md: "w-5 h-5",
      lg: "w-6 h-6",
      xl: "w-8 h-8",
    };
    const iconPaths: Record<IconArgs["name"], string> = {
      success: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
      error: "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z",
      warning:
        "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
      info: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
      close: "M6 18L18 6M6 6l12 12",
    };

    return `
      <svg class="stroke-current shrink-0 ${sizeClasses[args.size]}" fill="none" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${iconPaths[args.name]}"></path>
      </svg>
    `;
  },
};
