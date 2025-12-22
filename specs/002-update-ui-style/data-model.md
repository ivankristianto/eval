# Data Model: Update UI with DaisyUI

## Frontend Data Structures

### Evaluation Summary (for Homepage History List)
Used to populate the history table on the homepage.

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | String (UUID) | Unique identifier for the evaluation. |
| `instruction_text` | String | Truncated preview of the prompt. |
| `status` | Enum | `pending`, `running`, `completed`, `failed`. |
| `created_at` | DateTime | Timestamp of creation. |
| `model_count` | Number | Number of models involved in the evaluation. |
| `best_accuracy` | Number (%) | Highest score achieved among all models. |
| `fastest_time` | Number (ms) | Minimum execution time among successful runs. |

### Evaluation Detail (for `/evaluations/[id]`)
Comprehensive data for the results page.

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | String (UUID) | Unique identifier. |
| `instruction_text` | String | Full prompt text. |
| `accuracy_rubric` | String | Rubric description or template name. |
| `expected_output` | String | (Optional) Ground truth for comparison. |
| `status` | Enum | Overall status of the evaluation run. |
| `results` | Array<Result> | List of individual model results. |

### Model Result
| Field | Type | Description |
| :--- | :--- | :--- |
| `model_name` | String | Name of the AI model. |
| `provider` | String | OpenAI, Anthropic, Google. |
| `response_text` | String | Raw output from the model. |
| `accuracy_score` | Number (%) | Evaluated accuracy. |
| `accuracy_reasoning` | String | Explanation for the score. |
| `execution_time_ms` | Number | Latency. |
| `total_tokens` | Number | Usage metric. |

---

## State Transitions

### Evaluation Lifecycle
1. **Pending**: Initial state when models are being called.
2. **Running**: At least one model has started but not all finished.
3. **Completed**: All models have returned results or reached a timeout/error.
4. **Failed**: The evaluation process itself encountered a fatal error.