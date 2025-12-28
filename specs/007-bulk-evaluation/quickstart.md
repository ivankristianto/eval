# Quickstart: Bulk Evaluation

## Prerequisites

- API Keys for OpenAI/Anthropic/Google configured in `.env`.
- `papaparse` and `mustache` installed (see Setup).

## Setup

1. **Install Dependencies**:
   ```bash
   npm install papaparse mustache
   npm install -D @types/papaparse @types/mustache
   ```

2. **Database Migration**:
   - The tables `bulk_datasets`, `evaluation_runs`, and `row_results` will be created automatically by `db/init.js` (update schema first).
   - Run `npm run db:init` (WARNING: Check if this resets data, use migration if needed. For V1 dev, reset is common).

## Usage Guide

1. **Navigate to Bulk Evaluation**:
   - Open browser to `http://localhost:4321/bulk-eval`.

2. **Upload Dataset**:
   - Click "Upload CSV".
   - Select a CSV file (must have headers).
   - Verify table preview appears.

3. **Configure Run**:
   - Select rows (checkboxes).
   - Click "Configure".
   - Enter System Prompt using `{{header}}` syntax (e.g., `Classify this: {{text}}`).
   - Select models (e.g., `gpt-4o`, `claude-3-sonnet`).

4. **Run**:
   - Click "Run Evaluation".
   - Watch status bar and row updates.
   - **Do not refresh** (unless persistence allows resuming UI state, but polling should handle it).

5. **View Results**:
   - New columns appear for each model.
   - Click a row to open the Drawer for full details.
