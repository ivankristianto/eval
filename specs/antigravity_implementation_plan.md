# AI Evaluation App Implementation Plan

## Goal
Build a web application to evaluate AI generative models by submitting identical instructions and comparing metrics (latency, token usage, accuracy).

## User Review Required
> [!IMPORTANT]
> - **LLM Integration**: I will implement a flexible interface for LLM providers. For the MVP, do you have specific providers (OpenAI, Anthropic, Local) you want enabled immediately, or should I create a mock provider for testing?
> - **Accuracy Metric**: How do you want "Accuracy" to be measured? (Manual 1-5 rating, boolean thumb up/down, or automated check against expected output?)
> - **Database**: Using `better-sqlite3` for local SQLite storage as requested.

## Proposed Tech Stack
- **Framework**: Astro (SSR mode)
- **Styling**: Tailwind CSS
- **Database**: SQLite (via `better-sqlite3` + `drizzle-orm` for type safety/migrations, or raw SQL if strictly "minimal dependencies" is preferred. *Recommendation: Drizzle is very lightweight and improves DX significantly, but I can stick to raw `better-sqlite3` if you prefer absolute minimalism.*)
- **Runtime**: Node.js

## Proposed Architecture

### Database Schema
- **Templates**: `id`, `name`, `prompt_text`, `created_at`
- **Evaluations**: `id`, `template_id`, `created_at`, `status`
- **Results**: `id`, `evaluation_id`, `model_name`, `response_text`, `duration_ms`, `input_tokens`, `output_tokens`, `accuracy_score`

### Application Structure
- `/` (Home): Dashboard showing recent evaluation runs and trends.
- `/new`: Form to create a new evaluation run.
    - Select models.
    - Enter system/user prompt.
    - Save as template option.
- `/eval/[id]`: Detailed view of a run.
   - Table comparisons.
   - Re-run option.

### Component Design
- **MetricCard**: For displaying stats like "Avg Latency".
- **ComparisonTable**: Main view for results.
- **ModelSelector**: Multi-select for AI models.

## Verification Plan

### Automated Tests
- Unit tests for the metric calculation logic.
- Integration test for the database read/writes.

### Manual Verification
- Create a template "Summarize this text".
- Run against 2 mock models.
- Verify metrics appear in the table.
- Check persistence by restarting the server.
