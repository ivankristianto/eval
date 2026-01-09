import type { Meta, StoryObj } from "@storybook/html-vite";

type ThemeIconsArgs = {
  size: "xs" | "sm" | "md" | "lg" | "xl";
  colorClass: string;
};

const meta = {
  title: "Components/Icons/Theme",
  tags: ["autodocs"],
  args: {
    size: "lg",
    colorClass: "text-base-content",
  },
  argTypes: {
    size: {
      control: "select",
      options: ["xs", "sm", "md", "lg", "xl"],
    },
    colorClass: {
      control: "select",
      options: [
        "text-base-content",
        "text-primary",
        "text-secondary",
        "text-warning",
        "text-info",
      ],
    },
  },
} satisfies Meta<ThemeIconsArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

const sizeClasses: Record<ThemeIconsArgs["size"], string> = {
  xs: "w-3 h-3",
  sm: "w-4 h-4",
  md: "w-5 h-5",
  lg: "w-6 h-6",
  xl: "w-8 h-8",
};

const renderIcons = (sizeClass: string, colorClass: string) => `
  <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
    <div class="flex flex-col items-center gap-2 rounded-xl bg-base-200 p-4">
      <svg xmlns="http://www.w3.org/2000/svg" class="${sizeClass} ${colorClass}" fill="none" viewBox="0 0 24 24" stroke="url(#goldGradient-theme)">
        <defs>
          <linearGradient id="goldGradient-theme" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#d4af37;stop-opacity:1"></stop>
            <stop offset="100%" style="stop-color:#f0d678;stop-opacity:1"></stop>
          </linearGradient>
        </defs>
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
      </svg>
      <span class="text-xs text-base-content/60">Lightbulb</span>
    </div>
    <div class="flex flex-col items-center gap-2 rounded-xl bg-base-200 p-4">
      <svg xmlns="http://www.w3.org/2000/svg" class="${sizeClass} ${colorClass}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="5"></circle>
        <path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"></path>
      </svg>
      <span class="text-xs text-base-content/60">Sun</span>
    </div>
    <div class="flex flex-col items-center gap-2 rounded-xl bg-base-200 p-4">
      <svg xmlns="http://www.w3.org/2000/svg" class="${sizeClass} ${colorClass}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
      </svg>
      <span class="text-xs text-base-content/60">Moon</span>
    </div>
    <div class="flex flex-col items-center gap-2 rounded-xl bg-base-200 p-4">
      <svg xmlns="http://www.w3.org/2000/svg" class="${sizeClass} ${colorClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h8m-8 6h16"></path>
      </svg>
      <span class="text-xs text-base-content/60">Menu</span>
    </div>
  </div>
`;

export const Default: Story = {
  render: (args) => renderIcons(sizeClasses[args.size], args.colorClass),
};

export const Accent: Story = {
  args: {
    colorClass: "text-primary",
  },
  render: Default.render,
};
