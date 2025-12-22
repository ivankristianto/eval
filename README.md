# AI Model Evaluation Framework

Compare and evaluate multiple AI models (OpenAI, Anthropic, Google) against specific instructions and rubrics. Measure accuracy, execution time, and token usage to make data-driven decisions about which model to use for your tasks.

## Features

- **Multi-Model Comparison**: Run the same prompt across OpenAI (GPT-4), Anthropic (Claude), and Google (Gemini) simultaneously.
- **Real-Time Metrics**: View execution time, input/output tokens, and cost estimates as they happen.
- **Accuracy Scoring**:
  - **Exact Match**: For strict output requirements.
  - **Partial Credit**: For responses requiring specific key concepts.
  - **Semantic Similarity**: AI-based scoring for open-ended responses.
- **Evaluation History Dashboard**: Homepage shows history with status badges, empty states, and quick actions.
- **Dedicated Evaluation Details**: View results on `/evaluations/[id]` with semantic status styling.
- **Templates**: Save evaluation configurations to rerun benchmarks easily.
- **Modern UI**: DaisyUI components, breadcrumbs, responsive navbar, and theme switching.

## Tech Stack

- **Runtime**: Node.js (v22+)
- **Framework**: Astro (SSR)
- **Database**: SQLite (better-sqlite3)
- **Styling**: Tailwind CSS + DaisyUI
- **Testing**: Vitest, Playwright

## Quick Start

### Prerequisites

- Node.js v22+
- npm v9+
- API Keys for OpenAI, Anthropic, or Google Gemini

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd eval-ai-models
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env and add your API keys
   ```

4. **Initialize database**
   ```bash
   npm run db:init
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

   Visit `http://localhost:3000` to start evaluating models.
   The homepage shows evaluation history; details live at `/evaluations/[id]`.

## Usage Guide

### Running an Evaluation

1. Enter your **Instruction** (e.g., "Summarize this text...").
2. Choose a **Rubric** (Exact Match, Partial Credit, or Semantic Similarity).
3. Select the **Models** you want to compare.
4. Click **Run Evaluation**.
5. View results in the table below.

### Saving Templates

After running an evaluation, click **Save as Template** to store the configuration. You can rerun this template later from the **Templates** page to track performance changes or test new models.

## API Documentation

The application exposes a REST API for programmatic access:

- `POST /api/models`: Register a new model configuration.
- `POST /api/evaluate`: Submit an instruction for evaluation.
- `GET /api/evaluation-status`: Poll for real-time status updates.
- `GET /api/results`: Retrieve detailed evaluation metrics.
- `GET /api/templates`: List saved evaluation templates.

See `specs/001-eval-ai-models/contracts/` for detailed API specifications.

## Troubleshooting

- **Database Errors**: If you encounter database issues, try resetting it (warning: clears all data):
  ```bash
  npm run db:reset
  ```
- **Port Conflicts**: If port 3000 is in use, run:
  ```bash
  npm run dev -- --port 3001
  ```
- **API Key Issues**: Ensure your keys in `.env` are correct and have active quotas.

## Run Tests

Run the test suites to ensure everything is working:

```bash
npm test          # Unit and Integration tests
npm run test:e2e  # End-to-End tests
```

If Playwright browsers are missing, install them once:
```bash
npx playwright install
```

## License

MIT
