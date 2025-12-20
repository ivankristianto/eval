# Quickstart Guide: AI Model Evaluation Framework

This guide covers getting started with the AI Model Evaluation Framework for developers and power users.

## Prerequisites

- **Node.js 22+** and **npm**
- **Astro 5.x** (web framework)
- **SQLite3** (database)
- API keys for at least one provider: OpenAI, Anthropic Claude, or Google Gemini

## Initial Setup

### 1. Install Dependencies

\`\`\`bash
npm install
\`\`\`

### 2. Initialize Database

\`\`\`bash
npm run db:init
\`\`\`

This creates `db/evaluation.db` with the schema:
- `ModelConfiguration` - Configured AI models
- `Evaluation` - Evaluation runs
- `Result` - Individual model results
- `EvaluationTemplate` - Saved templates

### 3. Configure Environment

Create a `.env.local` file:

\`\`\`env
# Encryption key for API keys (generate: openssl rand -hex 32)
ENCRYPTION_KEY=your-32-byte-hex-key

# Optional: Node.js environment
NODE_ENV=development
\`\`\`

Generate encryption key:

\`\`\`bash
openssl rand -hex 32
\`\`\`

### 4. Start Development Server

\`\`\`bash
npm run dev
\`\`\`

Visit \`http://localhost:3000\` in your browser.

---

## User Workflow: Running Your First Evaluation

### Step 1: Add Models

Navigate to **Settings** → **Models** (or use API):

\`\`\`bash
curl -X POST http://localhost:3000/api/models \\
  -H "Content-Type: application/json" \\
  -d '{
    "provider": "openai",
    "model_name": "gpt-4",
    "api_key": "sk-..."
  }'
\`\`\`

Add at least 2-3 models for meaningful comparison.

### Step 2: Submit Evaluation

1. Go to **Evaluate** page
2. Enter instruction: "Explain quantum entanglement in simple terms"
3. Select accuracy rubric: **Partial Credit**
4. Add key concepts: quantum, entanglement, particles
5. Select models: gpt-4, claude-3-opus, gemini-2.0
6. Click **Run Evaluation**

**Via API**:

\`\`\`bash
curl -X POST http://localhost:3000/api/evaluate \\
  -H "Content-Type: application/json" \\
  -d '{
    "instruction_text": "Explain quantum entanglement...",
    "expected_output": "Two particles affecting each other...",
    "accuracy_rubric": "partial_credit",
    "partial_credit_concepts": ["quantum", "entanglement", "particles"],
    "model_ids": ["uuid1", "uuid2", "uuid3"]
  }'
\`\`\`

Response:

\`\`\`json
{
  "evaluation_id": "a1b2c3d4-e5f6-4g7h-8i9j-0k1l2m3n4o5p",
  "status": "running"
}
\`\`\`

### Step 3: Poll Status

The UI automatically polls `/api/evaluation-status/{evaluation_id}`:

\`\`\`bash
curl http://localhost:3000/api/evaluation-status/a1b2c3d4-e5f6-4g7h-8i9j-0k1l2m3n4o5p
\`\`\`

Response (in progress):

\`\`\`json
{
  "evaluation_id": "a1b2c3d4-e5f6-4g7h-8i9j-0k1l2m3n4o5p",
  "status": "running",
  "results": [
    {
      "model_id": "uuid1",
      "model_name": "gpt-4",
      "status": "completed",
      "execution_time_ms": 2847,
      "input_tokens": 15,
      "output_tokens": 340,
      "accuracy_score": 85
    },
    {
      "model_id": "uuid2",
      "model_name": "claude-3-opus",
      "status": "completed",
      "execution_time_ms": 3120,
      "input_tokens": 15,
      "output_tokens": 298,
      "accuracy_score": 92
    },
    {
      "model_id": "uuid3",
      "model_name": "gemini-2.0",
      "status": "pending"
    }
  ],
  "created_at": "2025-12-20T10:05:00Z",
  "started_at": "2025-12-20T10:05:01Z"
}
\`\`\`

### Step 4: View Results

Once `status: "completed"`, get full results:

\`\`\`bash
curl http://localhost:3000/api/results?evaluation_id=a1b2c3d4-e5f6-4g7h-8i9j-0k1l2m3n4o5p
\`\`\`

UI displays comparison table:

| Model | Time (ms) | Input Tokens | Output Tokens | Accuracy | Reasoning |
|-------|-----------|--------------|---------------|----------|-----------|
| gpt-4 | 2,847 | 15 | 340 | 85% | Contains key concepts... |
| claude-3-opus | 3,120 | 15 | 298 | 92% | Excellent explanation... |
| gemini-2.0 | 3,890 | 15 | 402 | 78% | Misses entanglement definition |

---

## Advanced: Save and Reuse Templates

### Save Template

\`\`\`bash
curl -X POST http://localhost:3000/api/templates \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Quantum Physics Test",
    "description": "Evaluates model understanding of quantum concepts",
    "instruction_text": "Explain quantum entanglement...",
    "expected_output": "...",
    "accuracy_rubric": "partial_credit",
    "partial_credit_concepts": ["quantum", "entanglement", "particles"],
    "model_ids": ["uuid1", "uuid2", "uuid3"]
  }'
\`\`\`

### Run Template

\`\`\`bash
curl -X POST http://localhost:3000/api/templates/{template_id}/run
\`\`\`

Reuses same instruction, rubric, and models. Results appended to history.

---

## Architecture Overview

### Pages (User Interface)

- **index.astro** - Main evaluation interface
- **templates.astro** - Manage saved templates
- **history.astro** - View past evaluations

### API Routes (Backend)

- **POST /api/models** - Add model
- **GET /api/models** - List models
- **POST /api/evaluate** - Submit evaluation
- **GET /api/evaluation-status/{id}** - Poll progress
- **GET /api/results** - Get final results
- **POST /api/templates** - Save template
- **POST /api/templates/{id}/run** - Run template

### Business Logic (src/lib/)

- **evaluator.ts** - Orchestrates model evaluation
  - Parallelizes requests across models
  - 30-second per-model timeout
  - 5-minute total evaluation timeout
- **accuracy.ts** - Calculates scores using rubrics
  - Exact Match: Compares response to expected output
  - Partial Credit: Counts key concepts present
  - Semantic Similarity: Uses embedding cosine similarity
- **types.ts** - TypeScript interfaces
- **validators.ts** - Input validation
- **db.ts** - Database queries

### Database (better-sqlite3)

```
evaluation.db
├── ModelConfiguration (id, provider, model_name, api_key_encrypted, active)
├── Evaluation (id, instruction_text, expected_output, accuracy_rubric, status)
├── Result (id, evaluation_id, model_id, response_text, execution_time_ms, accuracy_score)
└── EvaluationTemplate (id, name, instruction_text, model_ids)
```

---

## Performance Tips

### Evaluation Timeouts

- **Per-model timeout**: 30 seconds (spec clarification)
- **Total evaluation timeout**: 5 minutes
- **Slow model?** Cancellation via POST /api/cancel-evaluation

### Accuracy Scoring Speed

- **Exact Match**: Instant
- **Partial Credit**: O(n) concepts
- **Semantic Similarity**: Requires embedding API call

For fastest results, use **Exact Match** rubric.

### Database Queries

Common queries use indexes:

\`\`\`sql
-- Fetch results for evaluation (indexed on evaluation_id)
SELECT * FROM Result WHERE evaluation_id = ?;

-- Filter active models (indexed on active)
SELECT * FROM ModelConfiguration WHERE active = true;

-- List templates by recency (indexed on created_at)
SELECT * FROM EvaluationTemplate ORDER BY created_at DESC;
\`\`\`

---

## Testing

### Unit Tests

\`\`\`bash
npm test
\`\`\`

Tests cover:
- Input validation
- Accuracy rubric calculation
- Database CRUD operations

### E2E Tests (Playwright)

\`\`\`bash
npm run test:e2e
\`\`\`

Tests cover:
- User workflow: Add model → Submit evaluation → View results
- Template save and rerun
- Error handling (invalid API key, timeout, etc.)

### Build & Type Check

\`\`\`bash
npm run build       # Build Astro site
npm run typecheck   # TypeScript static analysis
npm run lint        # ESLint
\`\`\`

---

## Troubleshooting

### "Evaluation timed out"

- Model response exceeded 30 seconds
- Check API rate limits
- Reduce instruction length (< 5,000 chars)

### "Invalid API key"

- Verify key format for provider (OpenAI: sk-..., Anthropic: sk-ant-..., etc.)
- Check key hasn't been revoked
- Ensure key has correct permissions

### "Token counts show N/A"

- Some models don't return token metadata
- This is expected per spec
- Use token count display as estimate only

### Database locked

\`\`\`bash
npm run db:reset    # Reinitialize database
\`\`\`

---

## Configuration

### Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| ENCRYPTION_KEY | Required | AES-256-GCM key for API key encryption |
| NODE_ENV | development | Node environment |
| PORT | 3000 | Server port |

### Performance Tuning

In \`src/lib/evaluator.ts\`:

\`\`\`typescript
const MODEL_TIMEOUT_MS = 30000;      // Per-model timeout (ms)
const EVALUATION_TIMEOUT_MS = 300000; // Total timeout (ms)
const PARALLEL_REQUESTS = 5;          // Max concurrent requests
\`\`\`

---

## Next Steps

1. **Add more models** for better comparison coverage
2. **Create templates** for recurring evaluation patterns
3. **Review accuracy rubrics** - choose one that matches your use case
4. **Set up scheduled evaluations** (future feature - watch spec)
5. **Export results** to CSV for analysis (future feature)

---

## API Documentation

Full OpenAPI spec available at `specs/001-eval-ai-models/contracts/openapi.yaml`

Common request/response examples above. For complete details on all endpoints, see OpenAPI spec.
