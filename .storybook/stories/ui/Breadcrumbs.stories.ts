import type { Meta, StoryObj } from '@storybook/html-vite';

type BreadcrumbArgs = {
  items: Array<{ label: string; href?: string }>;
};

const meta = {
  title: 'Components/UI/Breadcrumbs',
  tags: ["autodocs"],
  args: {
    items: [
      { label: 'Home', href: '/' },
      { label: 'Evaluations', href: '/evaluations' },
      { label: 'Results' },
    ],
  },
} satisfies Meta<BreadcrumbArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Trail: Story = {
  render: (args) => {
    const items = args.items
      .map((item, index) => {
        const isLast = index === args.items.length - 1;
        if (item.href && !isLast) {
          return `<li><a href="${item.href}" class="hover:text-primary transition-colors">${item.label}</a></li>`;
        }
        return `<li><span class="font-medium text-base-content">${item.label}</span></li>`;
      })
      .join('');

    return `<div class="text-sm breadcrumbs mb-4 text-base-content/70"><ul>${items}</ul></div>`;
  },
};

export const ShortTrail: Story = {
  args: {
    items: [{ label: 'Dashboard', href: '/' }, { label: 'Evaluations' }],
  },
  render: Trail.render,
};

export const LongTrail: Story = {
  args: {
    items: [
      { label: 'Home', href: '/' },
      { label: 'Projects', href: '/projects' },
      { label: 'Q4 Benchmarks', href: '/projects/q4' },
      { label: 'Runs', href: '/projects/q4/runs' },
      { label: 'Run #4021' },
    ],
  },
  render: Trail.render,
};
