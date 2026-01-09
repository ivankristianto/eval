import type { Meta, StoryObj } from "@storybook/html-vite";

type ThemeControllerArgs = {
  open: boolean;
};

const meta = {
  title: "Components/Layout/ThemeController",
  tags: ["autodocs"],
  args: {
    open: true,
  },
  argTypes: {
    open: {
      control: "boolean",
    },
  },
} satisfies Meta<ThemeControllerArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => {
    const dropdownClass = args.open ? "dropdown dropdown-end dropdown-open" : "dropdown dropdown-end";

    return `
      <div class="${dropdownClass}">
        <div tabindex="0" role="button" class="btn btn-ghost btn-circle" id="theme-toggle-btn">
          <div class="h-6 w-6 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600"></div>
        </div>
        <ul tabindex="0" class="dropdown-content z-1 p-3 shadow-2xl bg-base-300 rounded-box w-56">
          <li class="menu-title px-3 py-2">
            <span class="text-xs font-semibold uppercase tracking-wider opacity-60">Light Themes</span>
          </li>
          <li>
            <input type="radio" class="btn btn-sm btn-block btn-ghost justify-start" value="light" checked />
          </li>
          <li>
            <input type="radio" class="btn btn-sm btn-block btn-ghost justify-start" value="cupcake" />
          </li>
          <li>
            <input type="radio" class="btn btn-sm btn-block btn-ghost justify-start" value="silk" />
          </li>
          <li>
            <input type="radio" class="btn btn-sm btn-block btn-ghost justify-start" value="nord" />
          </li>
          <li class="my-2"><hr class="border-base-content/10" /></li>
          <li class="menu-title px-3 py-2">
            <span class="text-xs font-semibold uppercase tracking-wider opacity-60">Dark Themes</span>
          </li>
          <li>
            <input type="radio" class="btn btn-sm btn-block btn-ghost justify-start" value="dark" />
          </li>
          <li>
            <input type="radio" class="btn btn-sm btn-block btn-ghost justify-start" value="luxury" />
          </li>
        </ul>
      </div>
    `;
  },
};

export const Closed: Story = {
  args: {
    open: false,
  },
  render: Default.render,
};
