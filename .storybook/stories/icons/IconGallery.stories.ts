import type { Meta, StoryObj } from "@storybook/html-vite";

type IconGalleryArgs = {
  size: "xs" | "sm" | "md" | "lg" | "xl";
  colorClass: string;
  showLabels: boolean;
};

const meta = {
  title: "Components/Icons/Gallery",
  tags: ["autodocs"],
  args: {
    size: "md",
    colorClass: "text-base-content",
    showLabels: true,
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
        "text-success",
        "text-warning",
        "text-error",
        "text-info",
      ],
    },
    showLabels: {
      control: "boolean",
    },
  },
} satisfies Meta<IconGalleryArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

const sizeClasses: Record<IconGalleryArgs["size"], string> = {
  xs: "w-3 h-3",
  sm: "w-4 h-4",
  md: "w-5 h-5",
  lg: "w-6 h-6",
  xl: "w-8 h-8",
};

const iconPaths = [
  {
    name: "Close",
    svg: (className: string) => `
      <svg xmlns="http://www.w3.org/2000/svg" class="${className}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
      </svg>
    `,
  },
  {
    name: "Error",
    svg: (className: string) => `
      <svg xmlns="http://www.w3.org/2000/svg" class="${className}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
      </svg>
    `,
  },
  {
    name: "Info",
    svg: (className: string) => `
      <svg xmlns="http://www.w3.org/2000/svg" class="${className}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
      </svg>
    `,
  },
  {
    name: "Lightbulb",
    svg: (className: string, idSuffix: string) => `
      <svg xmlns="http://www.w3.org/2000/svg" class="${className}" fill="none" viewBox="0 0 24 24" stroke="url(#goldGradient-${idSuffix})" stroke-width="2">
        <defs>
          <linearGradient id="goldGradient-${idSuffix}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#d4af37;stop-opacity:1"></stop>
            <stop offset="100%" style="stop-color:#f0d678;stop-opacity:1"></stop>
          </linearGradient>
        </defs>
        <path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
      </svg>
    `,
  },
  {
    name: "Menu",
    svg: (className: string) => `
      <svg xmlns="http://www.w3.org/2000/svg" class="${className}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h8m-8 6h16"></path>
      </svg>
    `,
  },
  {
    name: "Moon",
    svg: (className: string) => `
      <svg xmlns="http://www.w3.org/2000/svg" class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
      </svg>
    `,
  },
  {
    name: "Success",
    svg: (className: string) => `
      <svg xmlns="http://www.w3.org/2000/svg" class="${className}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
      </svg>
    `,
  },
  {
    name: "Sun",
    svg: (className: string) => `
      <svg xmlns="http://www.w3.org/2000/svg" class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="5"></circle>
        <path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"></path>
      </svg>
    `,
  },
  {
    name: "Warning",
    svg: (className: string) => `
      <svg xmlns="http://www.w3.org/2000/svg" class="${className}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
      </svg>
    `,
  },
];

const renderIcon = (
  icon: (typeof iconPaths)[number],
  className: string,
  idSuffix: string
) => (icon.name === "Lightbulb" ? icon.svg(className, idSuffix) : icon.svg(className));

const renderTile = (iconMarkup: string, label?: string) => `
  <div class="flex flex-col items-center gap-3 p-4 bg-base-200 rounded-xl">
    ${iconMarkup}
    ${label ? `<span class="text-xs text-base-content/60">${label}</span>` : ""}
  </div>
`;

const renderGallery = (size: IconGalleryArgs["size"], colorClass: string, showLabels: boolean) => {
  const sizeClass = sizeClasses[size];
  return iconPaths
    .map((icon, idx) => {
      const iconClass = `${sizeClass} ${colorClass}`;
      const svgMarkup = renderIcon(icon, iconClass, `${size}-${idx}`);
      return renderTile(svgMarkup, showLabels ? icon.name : undefined);
    })
    .join("");
};

export const Gallery: Story = {
  render: (args) => {
    return `
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        ${renderGallery(args.size, args.colorClass, args.showLabels)}
      </div>
    `;
  },
};

export const NoLabels: Story = {
  args: {
    showLabels: false,
  },
  render: Gallery.render,
};

export const AccentColor: Story = {
  args: {
    colorClass: "text-primary",
  },
  render: Gallery.render,
};

export const SizeScale: Story = {
  render: () => {
    const rows = (["xs", "sm", "md", "lg", "xl"] as IconGalleryArgs["size"][])
      .map(
        (size) => `
          <div class="space-y-3">
            <div class="text-xs uppercase tracking-wide text-base-content/60">${size}</div>
            <div class="flex flex-wrap gap-3">
              ${iconPaths
                .map((icon, idx) => {
                  const svgMarkup = renderIcon(icon, `${sizeClasses[size]} text-base-content`, `${size}-row-${idx}`);
                  return `<div class="p-3 bg-base-200 rounded-xl">${svgMarkup}</div>`;
                })
                .join("")}
            </div>
          </div>
        `
      )
      .join("");

    return `
      <div class="space-y-6">
        ${rows}
      </div>
    `;
  },
};

export const StatusColors: Story = {
  render: () => {
    const swatches = [
      { label: "Success", className: "text-success" },
      { label: "Warning", className: "text-warning" },
      { label: "Error", className: "text-error" },
      { label: "Info", className: "text-info" },
    ];

    const blocks = swatches
      .map(
        (swatch, swatchIdx) => `
          <div class="space-y-3">
            <div class="text-xs uppercase tracking-wide text-base-content/60">${swatch.label}</div>
            <div class="flex flex-wrap gap-3">
              ${iconPaths
                .map((icon, idx) => {
                  const svgMarkup = renderIcon(icon, `${sizeClasses.md} ${swatch.className}`, `status-${swatchIdx}-${idx}`);
                  return `<div class="p-3 bg-base-200 rounded-xl">${svgMarkup}</div>`;
                })
                .join("")}
            </div>
          </div>
        `
      )
      .join("");

    return `
      <div class="space-y-6">
        ${blocks}
      </div>
    `;
  },
};

export const OnDarkSurface: Story = {
  render: () => {
    const iconMarkup = iconPaths
      .map((icon, idx) => {
        const svgMarkup = renderIcon(icon, `${sizeClasses.lg} text-base-100`, `dark-${idx}`);
        return `<div class="p-4 bg-black/40 rounded-xl">${svgMarkup}</div>`;
      })
      .join("");

    return `
      <div class="rounded-2xl p-6 bg-neutral text-neutral-content">
        <div class="text-sm font-semibold mb-4">Icons on dark surface</div>
        <div class="flex flex-wrap gap-4">${iconMarkup}</div>
      </div>
    `;
  },
};
