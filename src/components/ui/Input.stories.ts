import type { Meta, StoryObj } from "@storybook/html";

type InputArgs = {
  label?: string;
  name: string;
  type: "text" | "password" | "email" | "number" | "search" | "url" | "date" | "datetime-local";
  size: "lg" | "md" | "sm" | "xs";
  placeholder?: string;
  value?: string;
  required: boolean;
  disabled: boolean;
  error?: string;
};

const meta = {
  title: "UI/Input",
  argTypes: {
    type: {
      control: "select",
      options: ["text", "password", "email", "number", "search", "url", "date", "datetime-local"],
    },
    size: {
      control: "select",
      options: ["lg", "md", "sm", "xs"],
    },
  },
  args: {
    label: "Model name",
    name: "model-name",
    type: "text",
    size: "md",
    placeholder: "gpt-4.1",
    value: "",
    required: false,
    disabled: false,
    error: "",
  },
} satisfies Meta<InputArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => {
    const sizeClass = `input-${args.size}`;
    const errorClass = args.error ? "input-error" : "";
    const inputClasses = ["input", sizeClass, errorClass]
      .filter(Boolean)
      .join(" ");
    const labelMarkup = args.label
      ? `<label class="label" for="${args.name}">
          <span class="label-text">${args.label}${args.required ? ' <span class="text-error">*</span>' : ""}</span>
        </label>`
      : "";
    const errorMarkup = args.error
      ? `<label class="label"><span class="label-text-alt text-error">${args.error}</span></label>`
      : "";

    return `
      <div class="form-control w-full max-w-md">
        ${labelMarkup}
        <input
          id="${args.name}"
          name="${args.name}"
          type="${args.type}"
          placeholder="${args.placeholder ?? ""}"
          value="${args.value ?? ""}"
          ${args.required ? "required" : ""}
          ${args.disabled ? "disabled" : ""}
          class="${inputClasses}"
        />
        ${errorMarkup}
      </div>
    `;
  },
};
