import type { Meta, StoryObj } from "@storybook/html";

type FilterBarArgs = {
  fromDate?: string;
  toDate?: string;
  rubric?: "exact_match" | "partial_credit" | "semantic_similarity" | "";
  minScore?: number;
};

const meta = {
  title: "Components/FilterBar",
  args: {
    fromDate: "",
    toDate: "",
    rubric: "",
    minScore: undefined,
  },
} satisfies Meta<FilterBarArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

const rubricOptions = [
  { value: "", label: "All Rubrics" },
  { value: "exact_match", label: "Exact Match" },
  { value: "partial_credit", label: "Partial Credit" },
  { value: "semantic_similarity", label: "Semantic Similarity" },
];

export const Default: Story = {
  render: (args) => {
    const rubricMarkup = rubricOptions
      .map((option) => {
        const selected = option.value === (args.rubric ?? "");
        return `<option value="${option.value}" ${selected ? "selected" : ""}>${option.label}</option>`;
      })
      .join("");

    return `
      <form class="card-luxe p-5 mb-8">
        <div class="flex flex-wrap items-end gap-4">
          <div class="w-40">
            <label class="label"><span class="label-text">From Date</span></label>
            <input
              type="date"
              name="fromDate"
              value="${args.fromDate ?? ""}"
              class="input input-sm input-bordered w-full border-gold-light focus:border-luxe-gold transition-colors"
            />
          </div>

          <div class="w-40">
            <label class="label"><span class="label-text">To Date</span></label>
            <input
              type="date"
              name="toDate"
              value="${args.toDate ?? ""}"
              class="input input-sm input-bordered w-full border-gold-light focus:border-luxe-gold transition-colors"
            />
          </div>

          <div class="w-48">
            <label class="label"><span class="label-text">Rubric</span></label>
            <select
              name="rubric"
              class="select select-sm select-bordered w-full border-gold-light focus:border-luxe-gold transition-colors"
            >
              ${rubricMarkup}
            </select>
          </div>

          <div class="w-28">
            <label class="label"><span class="label-text">Min Score</span></label>
            <input
              type="number"
              name="minScore"
              value="${args.minScore ?? ""}"
              min="0"
              max="100"
              placeholder="0-100"
              class="input input-sm input-bordered w-full font-mono border-gold-light focus:border-luxe-gold transition-colors"
            />
          </div>

          <div class="pb-1">
            <button type="submit" class="btn btn-sm btn-primary font-semibold">Filter</button>
          </div>

          <div class="pb-1">
            <button type="reset" class="btn btn-sm btn-ghost">Reset</button>
          </div>
        </div>
      </form>
    `;
  },
};

export const WithFilters: Story = {
  args: {
    fromDate: "2025-01-01",
    toDate: "2025-02-01",
    rubric: "partial_credit",
    minScore: 85,
  },
  render: Default.render,
};
