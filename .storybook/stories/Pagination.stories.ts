import type { Meta, StoryObj } from "@storybook/html";

type PaginationArgs = {
  currentPage: number;
  totalPages: number;
  limit: number;
};

const meta = {
  title: "Components/Pagination",
  args: {
    currentPage: 3,
    totalPages: 12,
    limit: 20,
  },
} satisfies Meta<PaginationArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

const getVisiblePages = (currentPage: number, totalPages: number) => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages = [1];

  if (currentPage > 3) {
    pages.push(-1);
  }

  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  for (let i = start; i <= end; i += 1) {
    pages.push(i);
  }

  if (currentPage < totalPages - 2) {
    pages.push(-1);
  }

  if (totalPages > 1) {
    pages.push(totalPages);
  }

  return pages;
};

export const Default: Story = {
  render: (args) => {
    const limitOptions = [10, 20, 50, 100];
    const pages = getVisiblePages(args.currentPage, args.totalPages)
      .map((page) => {
        if (page === -1) {
          return '<button class="join-item btn btn-sm btn-disabled" type="button">...</button>';
        }
        const activeClass = page === args.currentPage ? "btn-active" : "";
        const ariaCurrent = page === args.currentPage ? 'aria-current="page"' : "";
        return `<button type="button" class="join-item btn btn-sm ${activeClass}" ${ariaCurrent}>${page}</button>`;
      })
      .join("");
    const limitOptionsMarkup = limitOptions
      .map((opt) => {
        const activeClass = opt === args.limit ? "active" : "";
        return `<li><button type="button" class="${activeClass}">${opt}</button></li>`;
      })
      .join("");

    return `
      <div class="flex flex-col sm:flex-row items-center justify-between gap-4 w-full">
        <div class="flex items-center gap-2">
          <span class="text-sm text-base-content/70">Rows per page:</span>
          <div class="dropdown dropdown-top">
            <div tabindex="0" role="button" class="btn btn-sm btn-outline m-1">${args.limit}</div>
            <ul tabindex="0" class="dropdown-content z-1 menu p-2 shadow bg-base-100 rounded-box w-20">
              ${limitOptionsMarkup}
            </ul>
          </div>
        </div>

        <div class="join ${args.totalPages > 1 ? "" : "hidden"}">
          <button
            type="button"
            class="join-item btn btn-sm ${args.currentPage === 1 ? "btn-disabled" : ""}"
            aria-label="Previous Page"
          >
            &laquo;
          </button>
          ${pages}
          <button
            type="button"
            class="join-item btn btn-sm ${args.currentPage === args.totalPages ? "btn-disabled" : ""}"
            aria-label="Next Page"
          >
            &raquo;
          </button>
        </div>
      </div>
    `;
  },
};

export const FirstPage: Story = {
  args: {
    currentPage: 1,
    totalPages: 8,
    limit: 10,
  },
  render: Default.render,
};

export const LastPage: Story = {
  args: {
    currentPage: 12,
    totalPages: 12,
    limit: 50,
  },
  render: Default.render,
};

export const SinglePage: Story = {
  args: {
    currentPage: 1,
    totalPages: 1,
    limit: 20,
  },
  render: Default.render,
};
