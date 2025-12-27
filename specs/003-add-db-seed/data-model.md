# Data Model: Database Seeding

## Entities

### EvaluationTemplate
Represents a reusable test case for evaluating AI models.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Unique name of the template (e.g., "Basic Summarization"). Used for idempotency check. |
| `description` | string | No | Brief description of what this template tests. |
| `instruction_text` | string | Yes | The actual prompt/instruction sent to the model. |
| `model_ids` | string[] | Yes | Array of model IDs (references `ModelConfiguration`) allowed for this template. Seeder may set this to empty or default. |
| `accuracy_rubric` | enum | Yes | Scoring method: `exact_match`, `partial_credit`, or `semantic_similarity`. |
| `expected_output` | string | No | The ideal response (ground truth). |
| `partial_credit_concepts` | string[] | No | Key concepts required for partial credit scoring. |

### ModelConfiguration
Represents an AI model provider configuration.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `provider` | enum | Yes | `openai`, `anthropic`, or `google`. |
| `model_name` | string | Yes | The provider-specific model ID (e.g., `gpt-4o`, `claude-3-opus`). |
| `api_key_encrypted` | string | Yes | The API key, encrypted using AES-256-GCM. |
| `is_active` | boolean | Yes | Whether the model is available for selection. Defaults to `true`. |

## Seed Data Sources

### `db/templates.csv`
Source for `EvaluationTemplate` records.

**Columns**:
- `name`
- `description`
- `instruction_text`
- `accuracy_rubric`
- `expected_output`
- `partial_credit_concepts` (JSON string or semicolon-separated)

### `db/default-models.json` (Optional)
Source for default `ModelConfiguration` metadata (provider, model_name), while API keys are sourced from `.env`.

**Structure**:
```json
[
  {
    "provider": "openai",
    "model_name": "gpt-4o"
  },
  {
    "provider": "anthropic",
    "model_name": "claude-3-5-sonnet-20240620"
  }
]
```
