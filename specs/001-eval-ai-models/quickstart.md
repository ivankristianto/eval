# Quick Start Guide

**Feature**: AI Model Evaluation Framework
**Version**: 1.0.0
**Last Updated**: 2025-12-18

## Prerequisites

- **Node.js**: v22 or higher (check with `node --version`)
- **npm**: v9 or higher (check with `npm --version`)
- **API Keys**: At least one AI model provider (OpenAI, Anthropic, or Google Gemini)

## Installation

### 1. Clone and Install Dependencies

```bash
# Clone the repository (or navigate to existing directory)
cd eval

# Install dependencies
npm install
```

Expected output:

```
added XXX packages in X.XXs
```

### 2. Set Up Environment Variables

```bash
# Copy example environment file
cp .env.example .env

# Edit .env and add your API keys
# Use your preferred editor (vim, nano, code, etc.)
nano .env
```

**Example .env content**:

```
# OpenAI Configuration
OPENAI_API_KEY=sk-...your-key-here...

# Anthropic Configuration
ANTHROPIC_API_KEY=sk-ant-...your-key-here...

# Google Gemini Configuration
GOOGLE_API_KEY=...your-key-here...

# App Configuration
NODE_ENV=development
LOG_LEVEL=info
```

### 3. Initialize Database

```bash
# Create SQLite database and schema
npm run db:init

# Verify database created
ls -lh db/evaluation.db
```

Expected output:

```
-rw-r--r--  1 user  staff  12K db/evaluation.db
```

### 4. Start Development Server

```bash
# Start Astro dev server with hot reload
npm run dev
```

Expected output:

```
  🚀  astro  v4.x.x started in 123ms

  ┌─────────────────────────────────────────┐
  │  Local    http://localhost:3000/        │
  │  Network  use --host to expose          │
  └─────────────────────────────────────────┘
```

Open browser to `http://localhost:3000`

## First Evaluation - Step by Step

### Step 1: Configure Models

1. Go to **Models** page (if available in sidebar)
2. Click **Add Model**
3. Select provider (e.g., "OpenAI")
4. Enter model name (e.g., "gpt-4")
5. Paste API key
6. Click **Save**
7. API key will be validated; you'll see ✓ if valid

Repeat for additional providers (e.g., Claude, Gemini)

### Step 2: Create Evaluation

1. Go to **Evaluate** page (home page)
2. Enter **Instruction** (e.g., "What is the capital of France?")
3. Select **Rubric** (e.g., "Exact Match")
4. Enter **Expected Output** (e.g., "Paris")
5. Select **Models** to compare (check GPT-4, Claude, Gemini)
6. Click **Run Evaluation**

### Step 3: Monitor Progress

- You'll see **Status** column showing: Pending → Running → Completed
- Execution **Time (ms)** updates as each model responds
- **Token counts** display showing API consumption

### Step 4: Review Results

- **Results Table** shows all metrics per model
- Models ranked by **Accuracy** (green = best)
- Click any result to see full response and reasoning

### Step 5: Save for Later

1. After results load, click **Save as Template**
2. Enter name (e.g., "Capital Cities Challenge")
3. Click **Save**

Next time, go to **Templates** page and click **Rerun** to evaluate with new/updated models.

## Project Structure

```
src/
├── pages/                    # Astro pages and API routes
│   ├── index.astro          # Main evaluation interface
│   ├── templates.astro      # Saved templates list
│   ├── history.astro        # Evaluation history
│   └── api/                 # API endpoints
│       ├── evaluate.ts
│       ├── models.ts
│       └── templates.ts
│
├── components/              # Astro components
│   ├── EvaluationForm.astro
│   ├── ResultsTable.astro
│   └── ...
│
└── lib/                     # Business logic
    ├── db.ts               # Database queries
    ├── evaluator.ts        # Evaluation orchestration
    ├── api-clients.ts      # Model provider clients
    └── accuracy.ts         # Scoring logic

db/
├── schema.sql              # SQLite schema
└── evaluation.db           # SQLite database (created by npm run db:init)

tests/
├── contract/               # API contract tests
├── integration/            # End-to-end workflows
└── unit/                   # Individual component tests
```

## Common Commands

### Development

```bash
# Start dev server with hot reload
npm run dev

# Build for production
npm run build

# Run development build locally
npm run preview
```

### Database

```bash
# Initialize database (create tables, seed data)
npm run db:init

# Reset database (DELETE ALL DATA - use carefully!)
npm run db:reset

# Backup database
cp db/evaluation.db db/evaluation.db.backup

# Restore from backup
cp db/evaluation.db.backup db/evaluation.db
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode (rerun on file changes)
npm test -- --watch

# Run specific test file
npm test -- contract/evaluate.test.ts

# Run with coverage
npm test -- --coverage
```

## Troubleshooting

### "API key validation failed"

**Problem**: Can't add model because API key is invalid

**Solution**:

1. Copy API key again from provider dashboard
2. Verify there are no extra spaces before/after
3. Ensure key format matches provider (e.g., `sk-...` for OpenAI)
4. Check API key hasn't expired in provider account

### "Evaluation times out after 5 minutes"

**Problem**: Evaluation didn't complete; status shows "failed"

**Solution**:

1. Check that all API keys have sufficient quota
2. Try with fewer models first
3. Try with shorter instruction (< 1000 chars)
4. Check network connectivity
5. View browser console (F12) for detailed error

### Database errors

**Problem**: "Cannot read db/evaluation.db" or similar

**Solution**:

```bash
# Reinitialize database
npm run db:reset
npm run db:init

# Verify database exists
file db/evaluation.db
```

### Port 3000 already in use

**Problem**: "Error: Port 3000 already in use"

**Solution**:

```bash
# Use different port
npm run dev -- --port 3001

# Or kill process using port 3000
# On macOS/Linux:
lsof -i :3000 | grep LISTEN | awk '{print $2}' | xargs kill -9
```

## API Examples

### Using curl

```bash
# Add a model
curl -X POST http://localhost:3000/api/models \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "model_name": "gpt-4",
    "api_key": "sk-..."
  }'

# Start evaluation
curl -X POST http://localhost:3000/api/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "instruction": "What is 2+2?",
    "model_ids": ["model-uuid-1", "model-uuid-2"],
    "rubric_type": "exact_match",
    "expected_output": "4"
  }'

# Check evaluation status
curl http://localhost:3000/api/evaluation-status?evaluation_id=eval-uuid

# Get results
curl http://localhost:3000/api/results?evaluation_id=eval-uuid
```

### Using JavaScript/fetch

```javascript
// Add model
const addModel = async () => {
  const response = await fetch("/api/models", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: "openai",
      model_name: "gpt-4",
      api_key: "sk-...",
    }),
  });
  return response.json();
};

// Start evaluation
const startEvaluation = async (instruction, modelIds) => {
  const response = await fetch("/api/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      instruction,
      model_ids: modelIds,
      rubric_type: "exact_match",
      expected_output: "...",
    }),
  });
  return response.json();
};

// Poll status
const pollStatus = async (evaluationId) => {
  const response = await fetch(
    `/api/evaluation-status?evaluation_id=${evaluationId}`
  );
  return response.json();
};
```

## Performance Tips

### For Faster Evaluations

1. **Use fewer models**: Start with 2-3, not 10
2. **Use shorter instructions**: Long prompts take longer to process
3. **Choose faster models**: Smaller models respond faster (but may be less accurate)
4. **Use exact match rubric**: Faster than semantic similarity

### For Better Results

1. **Use larger models**: GPT-4 > GPT-3.5, Claude 3 Opus > Sonnet
2. **Provide clear instructions**: Ambiguous prompts get inconsistent responses
3. **Use semantic similarity for open-ended questions**: Exact match too strict
4. **Save templates**: Reuse configurations instead of recreating

## Next Steps

### After First Evaluation

- Explore **History** page to see past evaluations
- Create **Templates** for frequently-used instructions
- Configure **Additional Models** for comparison
- Experiment with different **Rubric Types**

### Advanced Usage

- **Trend Analysis**: Use history to compare model performance over time
- **Batch Testing**: Save templates and re-run periodically
- **Custom Rubrics**: Use partial credit with specific concepts to grade

### Development

- Review test files to understand expected behavior
- Modify components in `src/components/` to customize UI
- Add new rubric types by editing `src/lib/accuracy.ts`
- Create additional model providers in `src/lib/api-clients.ts`

## Support & Debugging

### View Logs

Development logs printed to console:

```
2025-12-18T14:32:15.123Z POST /api/evaluate 201 145ms evaluation_id=xxx
2025-12-18T14:32:18.456Z Evaluation xxx status: running (2/3 models)
2025-12-18T14:32:22.789Z Evaluation xxx completed in 7.666s
```

### Browser Developer Tools

Press **F12** to open DevTools:

- **Console**: JavaScript errors and logs
- **Network**: API request/response details
- **Application**: LocalStorage (not used in MVP) and session data

### Check Environment

```bash
# Verify Node.js version
node --version  # Should be v18+

# Verify npm version
npm --version   # Should be v9+

# Verify dependencies installed
npm list        # Should show no errors

# Verify database
ls -la db/evaluation.db  # Should exist and be > 8KB
```

## Getting Help

1. **Check troubleshooting section above**
2. **Review error message** - note exact error text
3. **Check console** - F12 → Console tab for JavaScript errors
4. **Try with test data** - confirm setup works with simple examples
5. **Review tests** - look at `tests/` directory for examples

---

**Ready to evaluate?** Start the dev server with `npm run dev` and navigate to http://localhost:3000!
