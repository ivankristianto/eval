import type { Meta, StoryObj } from "@storybook/html-vite";

type CsvUploaderArgs = {
  personaId: string;
  state: "idle" | "fileReady" | "uploading" | "error" | "success";
  fileName: string;
  fileSize: string;
  errorTitle: string;
  errorItems: string[];
  successMessage: string;
};

const meta = {
  title: "Components/CSVUploader",
  tags: ["autodocs"],
  args: {
    personaId: "persona-42",
    state: "idle",
    fileName: "training-data.csv",
    fileSize: "42 KB",
    errorTitle: "Upload Failed",
    errorItems: ["Missing required columns", "Found duplicate pairs"],
    successMessage: "200 pairs uploaded.",
  },
  argTypes: {
    state: {
      control: "select",
      options: ["idle", "fileReady", "uploading", "error", "success"],
    },
  },
} satisfies Meta<CsvUploaderArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => {
    const showFileInfo = args.state === "fileReady" || args.state === "uploading";
    const showUpload = args.state === "uploading";
    const showError = args.state === "error";
    const showSuccess = args.state === "success";
    const fileInfoClass = showFileInfo ? "" : "hidden";
    const uploadClass = showUpload ? "" : "hidden";
    const errorClass = showError ? "" : "hidden";
    const successClass = showSuccess ? "" : "hidden";
    const errorList = args.errorItems.map((item) => `<li>${item}</li>`).join("");

    return `
      <div class="csv-uploader card bg-base-200 shadow-xl max-w-3xl" data-persona-id="${args.personaId}">
        <div class="card-body">
          <h3 class="card-title text-2xl mb-4">Upload Training Data</h3>

          <div class="alert alert-info mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              class="stroke-current shrink-0 w-6 h-6"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              ></path>
            </svg>
            <div>
              <p class="font-semibold">CSV Format Requirements:</p>
              <ul class="list-disc list-inside mt-2 text-sm">
                <li>Columns: <code>input, expected_output</code></li>
                <li>Must contain 10-200 pairs</li>
                <li>No duplicate pairs allowed</li>
                <li>All fields must be non-empty</li>
              </ul>
            </div>
          </div>

          <div
            class="border-2 border-dashed border-base-content/30 rounded-lg p-8 text-center cursor-pointer hover:border-primary hover:bg-base-300 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-16 w-16 mx-auto mb-4 text-base-content/50"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              ></path>
            </svg>
            <p class="text-lg font-semibold mb-2">Drag and drop your CSV file here</p>
            <p class="text-sm text-base-content/60 mb-4">or click to browse</p>
            <button type="button" class="btn btn-primary">Browse Files</button>
          </div>

          <div class="${fileInfoClass} mt-4">
            <div class="flex items-center justify-between bg-base-300 p-4 rounded-lg">
              <div class="flex items-center gap-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-8 w-8 text-success"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  ></path>
                </svg>
                <div>
                  <p class="font-semibold">${args.fileName}</p>
                  <p class="text-sm text-base-content/60">${args.fileSize}</p>
                </div>
              </div>
              <button type="button" class="btn btn-ghost btn-sm">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M6 18L18 6M6 6l12 12"
                  ></path>
                </svg>
              </button>
            </div>
          </div>

          <div class="${uploadClass} mt-4">
            <div class="flex items-center gap-3 mb-2">
              <span class="loading loading-spinner loading-sm"></span>
              <span class="text-sm font-semibold">Uploading and validating...</span>
            </div>
            <progress class="progress progress-primary w-full" value="48" max="100"></progress>
          </div>

          <div class="${errorClass} mt-4">
            <div class="alert alert-error">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="stroke-current shrink-0 h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                ></path>
              </svg>
              <div>
                <p class="font-semibold">${args.errorTitle}</p>
                <ul class="list-disc list-inside mt-2 text-sm">${errorList}</ul>
              </div>
            </div>
          </div>

          <div class="${successClass} mt-4">
            <div class="alert alert-success">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="stroke-current shrink-0 h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                ></path>
              </svg>
              <div>
                <p class="font-semibold">Upload Successful!</p>
                <p class="text-sm">${args.successMessage}</p>
              </div>
            </div>
          </div>

          <div class="card-actions justify-end mt-4">
            <button type="button" class="btn btn-primary" ${args.state === "idle" ? "disabled" : ""}>
              Upload Training Data
            </button>
          </div>
        </div>
      </div>
    `;
  },
};

export const FileReady: Story = {
  args: {
    state: "fileReady",
  },
  render: Default.render,
};

export const Uploading: Story = {
  args: {
    state: "uploading",
  },
  render: Default.render,
};

export const ErrorState: Story = {
  args: {
    state: "error",
  },
  render: Default.render,
};

export const SuccessState: Story = {
  args: {
    state: "success",
  },
  render: Default.render,
};
