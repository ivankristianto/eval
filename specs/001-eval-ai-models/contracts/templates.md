# API Contract: Evaluation Template Endpoints

**Version**: 1.0.0
**Last Updated**: 2025-12-18
**Feature**: AI Model Evaluation Framework (User Story 2)

---

## POST /api/templates

Save an evaluation configuration as a reusable template.

### Request

**Content-Type**: `application/json`

```typescript
{
  name: string,                        // Required, max 100 chars
  description?: string,                // Optional, max 500 chars
  instruction_text: string,            // Required, max 10,000 chars
  model_ids: string[],                 // Required, array of UUIDs, at least 1
  accuracy_rubric: string,             // Required, one of: exact_match | partial_credit | semantic_similarity
  expected_output?: string,            // Required for all rubrics
  partial_credit_concepts?: string[]   // Required if accuracy_rubric='partial_credit'
}
```

### Response (201 Created)

```typescript
{
  id: string,                    // UUID of template
  name: string,
  instruction_text: string,
  model_count: number,
  accuracy_rubric: string,
  created_at: string,            // ISO8601
  run_count: 0                   // Always 0 for new template
}
```

### Error Responses

**400 Bad Request**
```json
{
  "error": "INVALID_INPUT",
  "message": "name must be non-empty and max 100 characters",
  "field": "name"
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

**422 Unprocessable Entity**
```json
{
  "error": "MISSING_RUBRIC_CONFIG",
  "message": "partial_credit_concepts required when rubric_type is 'partial_credit'",
  "field": "partial_credit_concepts"
}
```

### Behavior

1. Validates all inputs (same as evaluation creation)
2. Creates EvaluationTemplate record with run_count=0
3. Does NOT run evaluation (template is saved config only)
4. Returns template_id for later use

### Notes

- **Reusable**: Template can be used to run multiple evaluations
- **Immutable**: Once saved, template data doesn't change (see PATCH for updates)
- **Independent**: Saving template doesn't affect existing evaluations

---

## GET /api/templates

List all saved evaluation templates.

### Request

**Query Parameters** (optional):
```
sort_by?: 'created' | 'name' | 'run_count'  // Default: 'created'
order?: 'asc' | 'desc'                       // Default: 'desc'
```

### Response (200 OK)

```typescript
{
  templates: Array<{
    id: string,
    name: string,
    description?: string,
    instruction_text: string,   // First 200 chars for preview
    model_count: number,
    accuracy_rubric: string,
    created_at: string,
    run_count: number,
    last_run_at?: string         // ISO8601, if ever used
  }>
}
```

### Behavior

1. Returns all templates sorted by preference
2. Truncates instruction text to first 200 chars for UI display
3. Includes run statistics for sorting/filtering

### Notes

- **Sorting**: Default 'created DESC' shows newest first
- **Preview**: Instruction text truncated; full text available via GET /:id
- **Run Stats**: run_count incremented each time template used for evaluation

---

## GET /api/templates/:id

Get full details of a template.

### Request

**Path Parameter**:
```
id: string  // UUID of template
```

### Response (200 OK)

```typescript
{
  id: string,
  name: string,
  description?: string,
  instruction_text: string,           // Full text
  model_ids: string[],
  models: Array<{
    id: string,
    model_name: string,
    provider: string,
    is_active: boolean
  }>,
  accuracy_rubric: string,
  expected_output?: string,
  partial_credit_concepts?: string[],
  created_at: string,
  updated_at: string,
  run_count: number,
  last_run_at?: string
}
```

### Error Responses

**404 Not Found**
```json
{
  "error": "TEMPLATE_NOT_FOUND",
  "message": "Template does not exist",
  "template_id": "xxx-yyy-zzz"
}
```

### Behavior

1. Returns full template configuration
2. Includes model details (name, provider, active status)
3. Ready to use directly in evaluation form

### Notes

- **Complete Data**: Full instruction_text and all rubric configuration
- **Model Status**: Includes is_active to warn if models have been disabled
- **Caching**: Safe to cache; template data immutable after creation

---

## PATCH /api/templates/:id

Update a template (name, description, configuration).

### Request

**Path Parameter**:
```
id: string  // UUID of template
```

**Content-Type**: `application/json`

```typescript
{
  name?: string,
  description?: string,
  instruction_text?: string,
  model_ids?: string[],
  accuracy_rubric?: string,
  expected_output?: string,
  partial_credit_concepts?: string[]
}
```

### Response (200 OK)

```typescript
{
  id: string,
  name: string,
  updated_at: string,
  run_count: number        // Unchanged by update
}
```

### Error Responses

**404 Not Found**
```json
{
  "error": "TEMPLATE_NOT_FOUND",
  "message": "Template does not exist"
}
```

**400 Bad Request**
```json
{
  "error": "INVALID_INPUT",
  "message": "name must be non-empty and max 100 characters",
  "field": "name"
}
```

### Behavior

1. Updates only provided fields (partial update)
2. Validates all fields that are provided
3. Does NOT reset run_count (preserves statistics)
4. Updates updated_at timestamp
5. Does NOT affect existing evaluations that used this template

### Notes

- **Partial Update**: Can update just name, or configuration, or both
- **Validation**: Same rules as template creation
- **Non-Breaking**: Changes only affect future evaluations; history unchanged
- **Immutable History**: run_count preserved to track template usage over time

---

## DELETE /api/templates/:id

Delete a template.

### Request

**Path Parameter**:
```
id: string  // UUID of template
```

### Response (200 OK)

```typescript
{
  id: string,
  message: "Template deleted successfully"
}
```

### Error Responses

**404 Not Found**
```json
{
  "error": "TEMPLATE_NOT_FOUND",
  "message": "Template does not exist"
}
```

### Behavior

1. Deletes template configuration
2. Does NOT delete evaluations that used this template (referential integrity via ON DELETE SET NULL)
3. Existing evaluation records retain their instruction/rubric/models (denormalized)
4. Returns success immediately

### Notes

- **Non-Destructive**: Only deletes template; evaluation history preserved
- **Orphaned Evaluations**: Evaluations lose template_id but retain all data
- **Safe**: Can safely delete templates without breaking history

---

## POST /api/templates/:id/run

Run an evaluation using saved template configuration.

### Request

**Path Parameter**:
```
id: string  // UUID of template
```

**Content-Type**: `application/json` (optional)

```typescript
{
  model_ids?: string[]  // Optional: override models in template (default: use template's models)
}
```

### Response (201 Created)

```typescript
{
  evaluation_id: string,
  template_id: string,
  status: 'pending',
  models: Array<{
    model_id: string,
    model_name: string,
    provider: string,
    status: 'pending'
  }>
}
```

### Error Responses

**404 Not Found**
```json
{
  "error": "TEMPLATE_NOT_FOUND",
  "message": "Template does not exist"
}
```

**400 Bad Request**
```json
{
  "error": "INVALID_MODEL_OVERRIDE",
  "message": "At least one model must be selected",
  "field": "model_ids"
}
```

### Behavior

1. Loads template configuration
2. Uses template's models OR override models (if provided)
3. Creates Evaluation record with template_id reference
4. Increments template.run_count
5. Creates Result records for each model
6. Returns evaluation_id (evaluation runs asynchronously)
7. Same as POST /api/evaluate but uses template config

### Notes

- **Template Reuse**: Increments run_count for tracking popularity
- **Model Override**: Can use different models while keeping instruction/rubric
- **Asynchronous**: Returns immediately; client polls status separately
- **Independence**: New evaluation independent of previous runs (no state sharing)

---

## GET /api/templates/:id/history

Get evaluation history for a template.

### Request

**Path Parameter**:
```
id: string  // UUID of template
```

**Query Parameters** (optional):
```
limit?: number   // Default: 20, max: 100
offset?: number  // Default: 0, for pagination
```

### Response (200 OK)

```typescript
{
  template_id: string,
  template_name: string,
  total_runs: number,
  runs: Array<{
    evaluation_id: string,
    created_at: string,
    status: 'completed' | 'failed',
    completed_at: string,
    best_accuracy: number,           // Highest accuracy score across models
    fastest_model: {
      model_name: string,
      execution_time_ms: number
    },
    result_count: number             // Number of models evaluated
  }>
}
```

### Error Responses

**404 Not Found**
```json
{
  "error": "TEMPLATE_NOT_FOUND",
  "message": "Template does not exist"
}
```

### Behavior

1. Returns evaluations linked to this template (template_id = provided id)
2. Sorted by created_at DESC (newest first)
3. Includes summary metrics for each run
4. Supports pagination for large histories

### Notes

- **Trend Analysis**: Shows how model performance changes over time
- **Pagination**: Default 20 results; use limit/offset for more
- **Summary Metrics**: best_accuracy and fastest_model for quick scanning
- **Comparison**: Can compare runs to detect model regressions

---

## Data Consistency

### Template Lifecycle

1. Create: POST /api/templates → run_count=0, created_at=now
2. Use: POST /api/templates/:id/run → run_count++ (incremented)
3. Update: PATCH /api/templates/:id → run_count preserved
4. Delete: DELETE /api/templates/:id → run_count lost, but evaluations preserved

### Referential Integrity

- EvaluationTemplate → Evaluation: 1:N (one template, many evaluations)
- Template.model_ids must reference valid models (but not enforced at DB level)
- Deleting template sets Evaluation.template_id = NULL (preserves data)
- Template fields cached in Evaluation for historical accuracy

---

## Performance Considerations

### Indexing

- Templates indexed by created_at for quick sorting
- Template name indexed for search functionality (future)
- Evaluations linked via template_id for history queries

### Pagination

- GET /api/templates: Returns all (max ~50 templates in MVP)
- GET /api/templates/:id/history: Paginated (may have hundreds of runs)
- Default limit 20, allow override up to 100 per page
