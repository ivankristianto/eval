import type { Meta, StoryObj } from "@storybook/html";

type ButtonArgs = {
  label: string;
  variant:
    | "primary"
    | "secondary"
    | "accent"
    | "ghost"
    | "link"
    | "info"
    | "success"
    | "warning"
    | "error"
    | "neutral";
  size: "lg" | "md" | "sm" | "xs";
  outline: boolean;
  href?: string;
  disabled: boolean;
};

const meta = {
  title: "UI/Button",
  argTypes: {
    variant: {
      control: "select",
      options: [
        "primary",
        "secondary",
        "accent",
        "ghost",
        "link",
        "info",
        "success",
        "warning",
        "error",
        "neutral",
      ],
    },
    size: {
      control: "select",
      options: ["lg", "md", "sm", "xs"],
    },
    outline: {
      control: "boolean",
    },
    disabled: {
      control: "boolean",
    },
  },
  args: {
    label: "Run evaluation",
    variant: "primary",
    size: "md",
    outline: false,
    disabled: false,
  },
} satisfies Meta<ButtonArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  render: (args) => {
    const classes = [
      "btn",
      args.variant === "primary" ? "btn-luxe btn-luxe-primary" : `btn-${args.variant}`,
      `btn-${args.size}`,
      args.outline ? "btn-outline" : "",
      args.disabled ? "btn-disabled" : "",
    ]
      .filter(Boolean)
      .join(" ");

    if (args.href) {
      return `<a class="${classes}" href="${args.href}">${args.label}</a>`;
    }

    return `<button class="${classes}" type="button" ${args.disabled ? "disabled" : ""}>${args.label}</button>`;
  },
};
