import type { Meta, StoryObj } from '@storybook/html-vite';

type InputArgs = {
  label?: string;
  name: string;
  type: 'text' | 'password' | 'email' | 'number' | 'search' | 'url' | 'date' | 'datetime-local';
  size: 'lg' | 'md' | 'sm' | 'xs';
  placeholder?: string;
  value?: string;
  required: boolean;
  disabled: boolean;
  error?: string;
};

const meta = {
  title: 'Components/UI/Input',
  tags: ["autodocs"],
  argTypes: {
    type: {
      control: 'select',
      options: ['text', 'password', 'email', 'number', 'search', 'url', 'date', 'datetime-local'],
    },
    size: {
      control: 'select',
      options: ['lg', 'md', 'sm', 'xs'],
    },
  },
  args: {
    label: 'Model name',
    name: 'model-name',
    type: 'text',
    size: 'md',
    placeholder: 'gpt-4.1',
    value: '',
    required: false,
    disabled: false,
    error: '',
  },
} satisfies Meta<InputArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => {
    const sizeClass = `input-${args.size}`;
    const errorClass = args.error ? 'input-error' : '';
    const inputClasses = ['input', sizeClass, errorClass].filter(Boolean).join(' ');
    const labelMarkup = args.label
      ? `<label class="label" for="${args.name}">
          <span class="label-text">${args.label}${args.required ? ' <span class="text-error">*</span>' : ''}</span>
        </label>`
      : '';
    const errorMarkup = args.error
      ? `<label class="label"><span class="label-text-alt text-error">${args.error}</span></label>`
      : '';

    return `
      <div class="form-control w-full max-w-md">
        ${labelMarkup}
        <input
          id="${args.name}"
          name="${args.name}"
          type="${args.type}"
          placeholder="${args.placeholder ?? ''}"
          value="${args.value ?? ''}"
          ${args.required ? 'required' : ''}
          ${args.disabled ? 'disabled' : ''}
          class="${inputClasses}"
        />
        ${errorMarkup}
      </div>
    `;
  },
};

export const Required: Story = {
  args: {
    label: 'Evaluation name',
    name: 'evaluation-name',
    type: 'text',
    placeholder: 'Weekly regression',
    required: true,
  },
  render: Default.render,
};

export const WithValue: Story = {
  args: {
    label: 'Baseline model',
    name: 'baseline',
    type: 'text',
    value: 'gpt-4.1',
  },
  render: Default.render,
};

export const ErrorState: Story = {
  args: {
    label: 'API key',
    name: 'api-key',
    type: 'password',
    placeholder: 'sk-...',
    error: 'API key is required.',
  },
  render: Default.render,
};

export const Disabled: Story = {
  args: {
    label: 'Organization',
    name: 'org',
    type: 'text',
    value: 'eval-core',
    disabled: true,
  },
  render: Default.render,
};
