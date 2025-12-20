# API Contract: Evaluation Endpoints

**Version**: 1.0.0
**Last Updated**: 2025-12-18
**Feature**: AI Model Evaluation Framework

---

## POST /api/evaluate

Submit an instruction for evaluation across selected models.

### Request

**Content-Type**: `application/json`

```typescript
{
  instruction: string,           // Required, max 10,000 chars, non-empty
  model_ids: string[],           // Required, array of UUIDs, at least 1 model
  rubric_type: string,           // Required, one of: 'exact_match' | 'partial_credit' | 'semantic_similarity'
  expected_output?: string,      // Required for all rubrics (for accuracy comparison)
  partial_credit_concepts?: string[]  // Required if rubric_type='partial_credit'
}
```

### Response (201 Created)

```typescript
{
  evaluation_id: string,  // UUID of created evaluation
  status: 'pending',      // Always 'pending' on creation
  models: Array<{
    model_id: string,
    model_name: string,
    provider: string,
    status: 'pending'     // Model query status
  }>
}
```

### Error Responses

**400 Bad Request**
```json
{
  "error": "INVALID_INPUT",
  "message": "instruction must be non-empty and max 10,000 characters",
  "field": "instruction"
}
```

**400 Bad Request**
```json
{
  "error": "INVALID_RUBRIC",
  "message": "rubric_type must be one of: exact_match, partial_credit, semantic_similarity",
  "field": "rubric_type"
}
```

**400 Bad Request**
```json
{
  "error": "INVALID_MODEL_SELECTION",
  "message": "At least one model must be selected",
  "field": "model_ids"
}
```

**400 Bad Request**
```json
{
  "error": "MODEL_INACTIVE",
  "message": "Model is not active or does not exist",
  "details": {
    "model_id": "xxx-yyy-zzz",
    "reason": "not_found_or_inactive"
  }
}
```

**422 Unprocessable Entity**
```json
{
  "error": "MISSING_RUBRIC_CONFIG",
  "message": "partial_credit_concepts required when rubric_type is 'partial_credit'",
  "field": "partial_credit_concepts"
}
```

### Behavior

1. Validates all inputs against schema above
2. Creates Evaluation record with status='pending'
3. Creates Result records for each selected model with status='pending'
4. Returns evaluation_id immediately (evaluation runs asynchronously in background)
5. Evaluation processing begins server-side via async task

### Notes

- **Asynchronous**: Endpoint returns immediately; client polls status separately
- **Atomicity**: All models for evaluation succeed or fail together
- **Model Selection**: Only active models (is_active=true) are permitted
- **Validation**: Rubric-specific fields validated before evaluation creation

---

## GET /api/evaluation-status

Poll for current status of evaluation.

### Request

**Query Parameters**:
```
evaluation_id: string  // Required, UUID of evaluation
```

### Response (200 OK)

```typescript
{
  evaluation_id: string,
  overall_status: 'pending' | 'running' | 'completed' | 'failed',
  created_at: string,    // ISO8601
  completed_at?: string, // ISO8601, only if completed
  results: Array<{
    model_id: string,
    model_name: string,
    provider: string,
    status: 'pending' | 'completed' | 'failed',
    execution_time_ms?: number,
    input_tokens?: number,
    output_tokens?: number,
    total_tokens?: number,
    accuracy_score?: number,  // 0-100
    error_message?: string
  }>
}
```

### Error Responses

**404 Not Found**
```json
{
  "error": "EVALUATION_NOT_FOUND",
  "message": "Evaluation does not exist",
  "evaluation_id": "xxx-yyy-zzz"
}
```

### Behavior

1. Returns current status without modifying evaluation
2. Polls can happen frequently (every 200-500ms) with minimal performance impact
3. Completed results include all metrics; pending/failed results are partial

### Notes

- **Polling**: Client should poll every 500ms until overall_status is 'completed' or 'failed'
- **Timeout**: If evaluation doesn't complete within 5 minutes, overall_status='failed' with error
- **Partial Data**: Per-model status may complete before others; results populate as they arrive

---

## GET /api/results

Fetch complete results for a completed evaluation.

### Request

**Query Parameters**:
```
evaluation_id: string  // Required, UUID of evaluation
```

### Response (200 OK)

```typescript
{
  evaluation_id: string,
  instruction_text: string,
  accuracy_rubric: string,
  expected_output: string,
  created_at: string,
  completed_at: string,
  results: Array<{
    model_id: string,
    model_name: string,
    provider: string,
    execution_time_ms: number,
    input_tokens: number,
    output_tokens: number,
    total_tokens: number,
    accuracy_score: number,      // 0-100
    accuracy_reasoning: string,
    response_text: string        // Full response from model
  }>
}
```

### Error Responses

**404 Not Found**
```json
{
  "error": "EVALUATION_NOT_FOUND",
  "message": "Evaluation does not exist",
  "evaluation_id": "xxx-yyy-zzz"
}
```

**409 Conflict**
```json
{
  "error": "EVALUATION_INCOMPLETE",
  "message": "Evaluation is still running or failed",
  "status": "running"
}
```

### Behavior

1. Returns full results only if evaluation completed successfully
2. Results are sorted by best accuracy (descending)
3. Includes full response text for review

### Notes

- **Caching**: Results do not change after evaluation completes; safe to cache in browser
- **Sorting**: Results ordered by accuracy_score descending for easy comparison
- **Full Data**: Includes complete response text (may be large); UI should truncate for display

---

## POST /api/cancel-evaluation

Cancel a running evaluation.

### Request

**Content-Type**: `application/json`

```typescript
{
  evaluation_id: string  // Required, UUID of evaluation
}
```

### Response (200 OK)

```typescript
{
  evaluation_id: string,
  status: 'cancelled',
  message: "Evaluation cancelled successfully"
}
```

### Error Responses

**404 Not Found**
```json
{
  "error": "EVALUATION_NOT_FOUND",
  "message": "Evaluation does not exist",
  "evaluation_id": "xxx-yyy-zzz"
}
```

**409 Conflict**
```json
{
  "error": "CANNOT_CANCEL",
  "message": "Evaluation already completed",
  "status": "completed"
}
```

### Behavior

1. Sets evaluation status to 'failed' with error_message="Cancelled by user"
2. Stops any pending model queries (if possible)
3. Returns success immediately
4. Partial results are retained in database

### Notes

- **Timing**: May take a few seconds to cancel if model query is in-flight
- **Partial Results**: Any completed model results are preserved; incomplete ones are marked as failed
- **Idempotent**: Cancelling an already-cancelled evaluation returns 409 (expected)

---

## Request/Response Headers

### Common Request Headers
```
Content-Type: application/json
```

### Common Response Headers
```
Content-Type: application/json
X-Request-ID: string    // Unique request identifier for debugging
```

### Timeouts
- Evaluation processing: 5 minute hard limit per evaluation
- Per-model API call: 30 second timeout per model query
- Status polling: Client should retry on network error

---

## Error Handling

### Error Response Format

All error responses follow this structure:

```typescript
{
  error: string,              // Machine-readable error code
  message: string,            // Human-readable error message
  field?: string,             // Field name if applicable
  details?: Record<string, any>  // Additional context
}
```

### HTTP Status Codes

| Code | Meaning | When |
|------|---------|------|
| 200 | Success | Successful read operations |
| 201 | Created | Evaluation created successfully |
| 400 | Bad Request | Invalid input (validation error) |
| 409 | Conflict | State mismatch (e.g., model inactive, evaluation incomplete) |
| 422 | Unprocessable | Missing required conditional fields |
| 500 | Server Error | Internal error during evaluation |

---

## Rate Limiting

- **No explicit rate limiting** for MVP (single user)
- **Backend considerations**: Each evaluation is a single transaction; concurrent evaluations queued
- **Model API rate limits**: Handled per-provider by their SDK (user responsible for API quotas)

---

## Metrics & Observability

All endpoints log:
- Request timestamp
- evaluation_id (if applicable)
- Response status code
- Processing time (milliseconds)
- Error details (if applicable)

Example log entry:
```
2025-12-18T14:32:15.123Z POST /api/evaluate 201 145ms evaluation_id=uuid-xxx
```
