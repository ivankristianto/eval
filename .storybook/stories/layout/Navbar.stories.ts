import type { Meta, StoryObj } from "@storybook/html-vite";

type NavbarArgs = {
  activePath: "/" | "/models" | "/templates" | "/personas";
  mobileMenuOpen: boolean;
};

const meta = {
  title: "Components/Layout/Navbar",
  tags: ["autodocs"],
  args: {
    activePath: "/",
    mobileMenuOpen: false,
  },
  argTypes: {
    activePath: {
      control: "select",
      options: ["/", "/models", "/templates", "/personas"],
    },
    mobileMenuOpen: {
      control: "boolean",
    },
  },
} satisfies Meta<NavbarArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

const navItems = [
  { href: "/", label: "Eval" },
  { href: "/models", label: "Models" },
  { href: "/templates", label: "Templates" },
  { href: "/personas", label: "Personas" },
];

export const Default: Story = {
  render: (args) => {
    const desktopLinks = navItems
      .map((item) => {
        const isActive = args.activePath === item.href;
        return `
          <a
            href="${item.href}"
            class="px-5 py-2.5 rounded-lg font-medium text-sm transition-all ${
              isActive
                ? "bg-gradient-gold text-on-gold shadow-gold"
                : "text-base-content/70 hover:text-base-content hover:bg-base-200/50"
            }"
          >
            ${item.label}
          </a>
        `;
      })
      .join("");

    const mobileLinks = navItems
      .map((item) => {
        const isActive = args.activePath === item.href;
        return `
          <li>
            <a
              href="${item.href}"
              class="${
                isActive ? "active font-semibold bg-gradient-gold text-on-gold" : "font-medium"
              }"
            >
              ${item.label}
            </a>
          </li>
        `;
      })
      .join("");

    const mobileDropdownClass = args.mobileMenuOpen ? "dropdown dropdown-end dropdown-open" : "dropdown dropdown-end";

    return `
      <nav class="bg-base-100/80 backdrop-blur-xl border-b border-gold-light sticky top-0 z-50 shadow-soft">
        <div class="container mx-auto px-4 max-w-7xl">
          <div class="flex items-center justify-between h-20">
            <a href="/" class="flex items-center gap-3 group transition-all hover:gap-4">
              <div class="relative">
                <div class="h-9 w-9 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600"></div>
                <div class="absolute inset-0 bg-gradient-gold opacity-20 blur-md group-hover:opacity-40 transition-opacity"></div>
              </div>
              <span class="hidden sm:inline font-display text-2xl font-semibold tracking-tight text-gradient-gold">
                Eval AI
              </span>
            </a>

            <div class="hidden lg:flex items-center gap-2">
              ${desktopLinks}
            </div>

            <div class="flex items-center gap-3 lg:hidden">
              <button class="btn btn-ghost btn-circle" type="button" aria-label="Theme">T</button>
              <div class="${mobileDropdownClass}">
                <div tabindex="0" role="button" class="btn btn-ghost btn-sm" aria-label="Menu">
                  <span class="inline-block w-5 h-0.5 bg-base-content"></span>
                  <span class="inline-block w-5 h-0.5 bg-base-content mt-1"></span>
                </div>
                <ul
                  tabindex="0"
                  class="menu menu-sm dropdown-content mt-3 p-3 shadow-elevated bg-base-100 rounded-xl w-52 border border-gold-light"
                >
                  ${mobileLinks}
                </ul>
              </div>
            </div>

            <div class="hidden lg:block">
              <button class="btn btn-ghost btn-circle" type="button" aria-label="Theme">
                T
              </button>
            </div>
          </div>
        </div>
      </nav>
    `;
  },
};

export const MobileMenuOpen: Story = {
  args: {
    mobileMenuOpen: true,
  },
  render: Default.render,
};
