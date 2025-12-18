# API Contract: Model Configuration Endpoints

**Version**: 1.0.0
**Last Updated**: 2025-12-18
**Feature**: AI Model Evaluation Framework

---

## POST /api/models

Add a new model configuration.

### Request

**Content-Type**: `application/json`

```typescript
{
  provider: string,      // Required, one of: 'openai' | 'anthropic' | 'google'
  model_name: string,    // Required, e.g., 'gpt-4', 'claude-3-opus', 'gemini-pro'
  api_key: string,       // Required, non-empty (stored encrypted)
  notes?: string         // Optional, user description
}
```

### Response (201 Created)

```typescript
{
  id: string,            // UUID of created model
  provider: string,
  model_name: string,
  is_active: true,
  created_at: string,    // ISO8601
  validation_status: 'valid' | 'invalid',
  error_message?: string  // If validation_status='invalid'
}
```

### Error Responses

**400 Bad Request**
```json
{
  "error": "INVALID_PROVIDER",
  "message": "provider must be one of: openai, anthropic, google",
  "field": "provider"
}
```

**400 Bad Request**
```json
{
  "error": "INVALID_API_KEY",
  "message": "API key validation failed: invalid format",
  "field": "api_key",
  "details": {
    "provider": "openai",
    "reason": "key does not match expected format"
  }
}
```

**401 Unauthorized**
```json
{
  "error": "API_KEY_AUTHENTICATION_FAILED",
  "message": "API key rejected by provider",
  "details": {
    "provider": "openai",
    "provider_message": "Invalid API key provided"
  }
}
```

### Behavior

1. Validates input against schema
2. Encrypts API key before storage (never stored as plaintext)
3. Tests API key by making small API call to provider (e.g., list models)
4. If test succeeds: stores model with validation_status='valid'
5. If test fails: returns error but does NOT store model
6. Returns model_id for use in evaluations

### Notes

- **Encryption**: API keys encrypted at rest using Node.js crypto module
- **Validation**: Each API key tested immediately to catch errors early
- **Privacy**: API keys never logged or transmitted in response body
- **Testing**: Validation API call should be minimal (list models, not inference)

---

## GET /api/models

List all configured models.

### Request

**Query Parameters** (optional):
```
active_only: boolean   // Default: false, if true returns only is_active=true models
provider?: string      // Filter by provider (openai | anthropic | google)
```

### Response (200 OK)

```typescript
{
  models: Array<{
    id: string,
    provider: string,
    model_name: string,
    is_active: boolean,
    created_at: string,
    notes?: string,
    usage_count: number  // How many evaluations used this model
  }>
}
```

### Behavior

1. Returns all models (or filtered subset)
2. Includes is_active status so UI can show disabled models
3. usage_count helps user understand popularity of each model

### Notes

- **Filtering**: If active_only=true, returns only is_active=true models (default for evaluation form)
- **Ordering**: Results sorted by created_at DESC (newest first)

---

## GET /api/models/:id

Get details for a specific model.

### Request

**Path Parameter**:
```
id: string  // UUID of model
```

### Response (200 OK)

```typescript
{
  id: string,
  provider: string,
  model_name: string,
  is_active: boolean,
  created_at: string,
  updated_at: string,
  notes?: string,
  usage_count: number,
  last_used_at?: string  // ISO8601, if ever used
}
```

### Error Responses

**404 Not Found**
```json
{
  "error": "MODEL_NOT_FOUND",
  "message": "Model does not exist",
  "model_id": "xxx-yyy-zzz"
}
```

### Behavior

1. Returns full model details (without API key, which is never exposed)
2. Includes usage statistics

---

## PATCH /api/models/:id

Update a model configuration.

### Request

**Path Parameter**:
```
id: string  // UUID of model
```

**Content-Type**: `application/json`

```typescript
{
  is_active?: boolean,   // Enable/disable model
  notes?: string,        // Update description
  api_key?: string       // Replace API key (if provided, validation runs)
}
```

### Response (200 OK)

```typescript
{
  id: string,
  provider: string,
  model_name: string,
  is_active: boolean,
  updated_at: string,
  validation_status: 'valid' | 'invalid',
  error_message?: string  // If api_key provided and validation fails
}
```

### Error Responses

**404 Not Found**
```json
{
  "error": "MODEL_NOT_FOUND",
  "message": "Model does not exist"
}
```

**409 Conflict** (if model is in use)
```json
{
  "error": "CANNOT_UPDATE",
  "message": "Cannot disable model with active evaluations",
  "model_id": "xxx-yyy-zzz",
  "active_evaluation_count": 2
}
```

### Behavior

1. Updates only provided fields (partial update)
2. If is_active=false and model has running evaluations, returns 409
3. If api_key provided: validates it and updates if valid
4. Returns updated model details

### Notes

- **Soft Delete**: Set is_active=false instead of deleting (preserves evaluation history)
- **Evaluation Conflict**: Cannot disable model if it's part of running evaluation
- **API Key Update**: Validation runs immediately; update fails if key invalid

---

## DELETE /api/models/:id

Delete a model configuration.

### Request

**Path Parameter**:
```
id: string  // UUID of model
```

### Response (200 OK)

```typescript
{
  id: string,
  message: "Model deleted successfully"
}
```

### Error Responses

**404 Not Found**
```json
{
  "error": "MODEL_NOT_FOUND",
  "message": "Model does not exist"
}
```

**409 Conflict** (if model has evaluation results)
```json
{
  "error": "CANNOT_DELETE",
  "message": "Cannot delete model with existing evaluation results (9 evaluations)",
  "model_id": "xxx-yyy-zzz",
  "result_count": 9
}
```

### Behavior

1. Deletes model configuration if no results reference it
2. If results exist: returns 409 and does NOT delete
3. Recommendation: Use PATCH with is_active=false for soft delete instead

### Notes

- **Data Integrity**: Foreign key constraint prevents deletion if results exist
- **Recommendation**: Prefer `PATCH is_active=false` over DELETE to preserve history
- **Hard Delete**: Only possible if model has never been used in evaluation

---

## POST /api/models/:id/test-connection

Test API key validity without creating/updating model.

### Request

**Path Parameter**:
```
id: string  // UUID of model
```

**Content-Type**: `application/json` (optional)

```typescript
{
  api_key?: string  // Optional: test with new API key (doesn't update stored key)
}
```

### Response (200 OK)

```typescript
{
  model_id: string,
  provider: string,
  model_name: string,
  status: 'valid',
  message: "API key is valid"
}
```

### Error Responses

**401 Unauthorized**
```json
{
  "error": "API_KEY_INVALID",
  "message": "API key is invalid or expired",
  "details": {
    "provider": "openai",
    "provider_message": "Invalid authentication credentials"
  }
}
```

**404 Not Found**
```json
{
  "error": "MODEL_NOT_FOUND",
  "message": "Model does not exist"
}
```

### Behavior

1. Tests stored API key (if api_key not provided)
2. If api_key provided: tests that key without updating stored value
3. Returns detailed error message from provider if authentication fails
4. Does not modify any model data

### Notes

- **Dry Run**: Safe to call without making changes
- **Troubleshooting**: Useful for diagnosing API key issues
- **No Side Effects**: Testing doesn't update model or create evaluation

---

## Rate Limiting

- **No explicit rate limiting** for MVP (single user)
- **Model API overhead**: Each model creation tests API connection (~1-2 seconds per model)

---

## Security Considerations

### API Key Storage

- Keys encrypted at rest using Node.js `crypto` module
- Encryption key stored in environment variable (`.env`)
- Never logged or displayed in API responses
- Only decrypted when making provider API calls

### Validation

- Minimal test API call to provider (e.g., list models endpoint)
- No inference/billing impact from validation
- Provider error messages sanitized before returning to client

---

## Data Consistency

### Relationship to Evaluations

- Models can be disabled (is_active=false) but not deleted if results exist
- Disabled models cannot be selected for new evaluations
- Existing evaluation results retain model information for historical accuracy

### Concurrency

- Model updates (PATCH) don't affect running evaluations
- is_active flag checked at evaluation creation time, not during execution
