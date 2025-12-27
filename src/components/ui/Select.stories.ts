import type { Meta, StoryObj } from "@storybook/html";

type SelectArgs = {
  label?: string;
  name: string;
  size: "lg" | "md" | "sm" | "xs";
  required: boolean;
  disabled: boolean;
  error?: string;
  options: string[];
};

const meta = {
  title: "UI/Select",
  argTypes: {
    size: {
      control: "select",
      options: ["lg", "md", "sm", "xs"],
    },
  },
  args: {
    label: "Provider",
    name: "provider",
    size: "md",
    required: false,
    disabled: false,
    error: "",
    options: ["OpenAI", "Anthropic", "Google"],
  },
} satisfies Meta<SelectArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => {
    const sizeClass = `select-${args.size}`;
    const errorClass = args.error ? "select-error" : "";
    const selectClasses = ["select", sizeClass, errorClass]
      .filter(Boolean)
      .join(" ");
    const labelMarkup = args.label
      ? `<label class="label" for="${args.name}"><span class="label-text">${args.label}</span></label>`
      : "";
    const errorMarkup = args.error
      ? `<label class="label"><span class="label-text-alt text-error">${args.error}</span></label>`
      : "";
    const optionsMarkup = [
      "<option disabled selected>Select a provider</option>",
      ...args.options.map((option) => `<option>${option}</option>`),
    ].join("");

    return `
      <div class="form-control w-full max-w-md">
        ${labelMarkup}
        <select
          id="${args.name}"
          name="${args.name}"
          ${args.required ? "required" : ""}
          ${args.disabled ? "disabled" : ""}
          class="${selectClasses}"
        >
          ${optionsMarkup}
        </select>
        ${errorMarkup}
      </div>
    `;
  },
};
