# Implementation Plan: Additional AI Providers Support

## 1. Summary

This feature expands the AI model evaluation framework to support three additional AI providers beyond the existing OpenAI, Anthropic, and Google AI offerings:

- **Open Router**: Unified API for accessing multiple AI models through a single interface
- **LM Studio**: Local LLM deployments via OpenAI-compatible API
- **Ollama**: Local LLM deployments via Ollama's REST API

The implementation maintains backward compatibility with existing providers while introducing a flexible abstraction layer that supports different authentication methods (API Key vs No Auth) and endpoint configurations (cloud vs local).

## 2. Technical Architecture

### 2.1 Current Architecture Analysis

The codebase currently implements a clean provider abstraction:

```
ModelClient (interface)
├── OpenAIClient
├── AnthropicClient
└── GoogleClient

ClientFactory.createClient(provider, apiKey, modelName) -> ModelClient
```

**Key files:**

- `src/lib/utils/api-clients.ts` - Provider client implementations
- `src/lib/utils/types.ts` - Type definitions (Provider type)
- `src/lib/validation/validators.ts` - Input validation
- `db/schema.sql` - Database schema with ModelConfiguration table
- `src/pages/api/models.ts` - Models API endpoints
- `src/pages/models.astro` - Models management UI

### 2.2 Provider Comparison

| Provider        | Auth Method  | Base URL                                  | SDK/Protocol            | Notes    |
| --------------- | ------------ | ----------------------------------------- | ----------------------- | -------- |
| OpenAI          | API Key      | https://api.openai.com                    | OpenAI SDK              | Existing |
| Anthropic       | API Key      | https://api.anthropic.com                 | Anthropic SDK           | Existing |
| Google          | API Key      | https://generativelanguage.googleapis.com | Google AI SDK           | Existing |
| **Open Router** | API Key      | https://openrouter.ai/api                 | OpenAI SDK (compatible) | **New**  |
| **LM Studio**   | None (local) | http://localhost:1234                     | OpenAI SDK (compatible) | **New**  |
| **Ollama**      | None (local) | http://localhost:11434                    | REST API                | **New**  |

### 2.3 Design Decisions

1. **Provider-Level Configuration**: API keys are configured per provider, not per model (as per spec requirement)
2. **Database Schema**: Add `base_url` column to ModelConfiguration table for local providers
3. **Authentication**: Support both API key and no-auth modes via optional `api_key_encrypted`
4. **Validation**: Provider-specific API key format validation; allow empty keys for local providers

## 3. Proposed Changes

### 3.1 New Files

```
src/lib/providers/
├── base.ts                      # Base provider interface and utilities
├── openrouter-provider.ts       # Open Router provider implementation
├── lmstudio-provider.ts         # LM Studio provider implementation
└── ollama-provider.ts           # Ollama provider implementation

tests/unit/providers/
├── openrouter-provider.test.ts
├── lmstudio-provider.test.ts
└── ollama-provider.test.ts
```

### 3.2 Modified Files

| File                                      | Changes                                                                       |
| ----------------------------------------- | ----------------------------------------------------------------------------- |
| `db/schema.sql`                           | Add `base_url` column to ModelConfiguration; update provider CHECK constraint |
| `src/lib/utils/types.ts`                  | Extend Provider type; add optional base_url to ModelConfiguration             |
| `src/lib/utils/api-clients.ts`            | Add new provider clients; update ClientFactory                                |
| `src/lib/validation/validators.ts`        | Update VALID_PROVIDERS; add new provider validations                          |
| `src/lib/db/model-db.ts`                  | Update CRUD operations for base_url                                           |
| `src/pages/api/models.ts`                 | Handle base_url in create/update                                              |
| `src/pages/api/models/[id].ts`            | Handle base_url in responses                                                  |
| `src/pages/models.astro`                  | Add new provider options; conditional API key field                           |
| `src/components/NewEvaluationModal.astro` | Already dynamic via `getModels()`                                             |

## 4. Verification Plan

### 4.1 Open Router Verification

1. Navigate to `/models`
2. Click "Add Model"
3. Select "Open Router" from provider dropdown
4. Enter model name (e.g., `anthropic/claude-3-opus`)
5. Enter Open Router API key (starts with `sk-or-`)
6. Click "Add Model"
7. Verify model appears in list
8. Click "Test" button
9. Verify connection success message
10. Use model in evaluation

### 4.2 LM Studio Verification

1. Start LM Studio server (default: `http://localhost:1234`)
2. Navigate to `/models`
3. Click "Add Model"
4. Select "LM Studio" from provider dropdown
5. Enter model name (e.g., `llama-3-8b`)
6. Leave API key blank (local provider)
7. (Optional) Configure custom base URL if not using default
8. Click "Add Model"
9. Verify model appears in list
10. Click "Test" button
11. Verify connection success message
12. Use model in evaluation

### 4.3 Ollama Verification

1. Start Ollama server (default: `http://localhost:11434`)
2. Pull a model: `ollama pull llama3`
3. Navigate to `/models`
4. Click "Add Model"
5. Select "Ollama" from provider dropdown
6. Enter model name (e.g., `llama3`)
7. Leave API key blank (local provider)
8. (Optional) Configure custom base URL if not using default
9. Click "Add Model"
10. Verify model appears in list
11. Click "Test" button
12. Verify connection success message
13. Use model in evaluation

### 4.4 Cross-Provider Evaluation

1. Create evaluation with models from multiple providers
2. Verify all models execute successfully
3. Compare results across providers

## 5. Actionable Tasks

### Phase 1: Database & Types

- [x] **DB-001**: Update `db/schema.sql`
  - [x] Add `base_url TEXT` column to ModelConfiguration table
  - [x] Update provider CHECK constraint to include 'openrouter', 'lmstudio', 'ollama'
  - [x] Add index on base_url for local providers

- [x] **TYPES-001**: Update `src/lib/utils/types.ts`
  - [x] Extend Provider type: `'openai' | 'anthropic' | 'google' | 'openrouter' | 'lmstudio' | 'ollama'`
  - [x] Add `base_url?: string` to ModelConfiguration interface
  - [x] Update CreateModelRequest to include optional base_url

- [x] **DB-002**: Update `src/lib/db/db.ts`
  - [x] Update insertModel() to accept base_url
  - [x] Update updateModel() to handle base_url
  - [x] Update getModelById() to return base_url
  - [x] Update getModels() to return base_url

### Phase 2: Provider Implementations

- [x] **PROVIDER-001**: Create OpenRouterClient in `src/lib/utils/api-clients.ts`
  - [x] Implement OpenRouterClient class (uses OpenAI SDK)
  - [x] Configure base URL: `https://openrouter.ai/api/v1`
  - [x] Handle OpenRouter-specific headers (HTTP-Referer, X-Title)
  - [x] Implement evaluate() method
  - [x] Implement testConnection() method

- [x] **PROVIDER-002**: Create LMStudioClient in `src/lib/utils/api-clients.ts`
  - [x] Implement LMStudioClient class (uses OpenAI SDK with custom base URL)
  - [x] Default base URL: `http://localhost:1234/v1`
  - [x] Handle empty API key (no authentication)
  - [x] Implement evaluate() method
  - [x] Implement testConnection() method

- [x] **PROVIDER-003**: Create OllamaClient in `src/lib/utils/api-clients.ts`
  - [x] Implement OllamaClient class (custom REST API client)
  - [x] Default base URL: `http://localhost:11434`
  - [x] Handle Ollama API format: `/api/chat`
  - [x] Implement evaluate() method
  - [x] Implement testConnection() method (use `/api/tags` endpoint)

- [x] **CLIENT-001**: Update `src/lib/utils/api-clients.ts`
  - [x] Import new provider clients
  - [x] Update ClientFactory.createClient() switch statement
  - [x] Update ClientFactory.testConnection() switch statement
  - [x] Handle optional API key for local providers
  - [x] Pass base_url to provider clients

### Phase 3: Validation & API

- [x] **VALIDATION-001**: Update `src/lib/validation/validators.ts`
  - [x] Add 'openrouter', 'lmstudio', 'ollama' to VALID_PROVIDERS array
  - [x] Add validateApiKeyFormat() cases:
    - [x] Open Router: starts with `sk-or-`
    - [x] LM Studio: allow empty string (no auth)
    - [x] Ollama: allow empty string (no auth)
  - [x] Add base_url validation (valid URL format)
  - [x] Update validateCreateModel() to handle optional api_key

- [x] **API-001**: Update `src/pages/api/models.ts`
  - [x] Handle base_url in POST /api/models
  - [x] Set default base URLs for local providers
  - [x] Validate base_url format

- [x] **API-002**: Update `src/pages/api/models/[id].ts`
  - [x] Return base_url in GET response
  - [x] Handle base_url in PATCH updates

- [x] **API-003**: Update `src/pages/api/models/[id]/test-connection.ts`
  - [x] Handle empty API key for local providers
  - [x] Pass base_url to ClientFactory

### Phase 4: Evaluator Updates

- [x] **EVALUATOR-001**: Update `src/lib/evaluation/evaluator.ts`
  - [x] Handle optional api_key_encrypted
  - [x] Pass base_url to ClientFactory

- [x] **BULK-EVALUATOR-001**: Update `src/lib/bulk-evaluation/bulk-evaluator.ts`
  - [x] Handle optional api_key_encrypted
  - [x] Pass base_url to ClientFactory

- [x] **RERUN-RESULT-001**: Update `src/pages/api/bulk/rerun-result.ts`
  - [x] Handle optional api_key_encrypted
  - [x] Pass base_url to ClientFactory

### Phase 4: UI Updates

- [x] **UI-001**: Update `src/pages/models.astro`
  - [x] Add Open Router, LM Studio, Ollama to provider dropdown
  - [x] Add conditional logic: show/hide API key field based on provider
  - [x] Add optional "Base URL" input field (shown for local providers)
  - [ ] Display provider icons/badges in model list
  - [x] Show default base URL hint for local providers

- [x] **UI-002**: Update `src/components/NewEvaluationModal.astro`
  - [x] No changes needed (dynamically loads via getModels())
  - [x] Verify: model cards show provider correctly

### Phase 5: Testing

- [ ] **TEST-001**: Create unit tests for OpenRouter provider
  - [ ] Test client initialization
  - [ ] Test evaluate() method with mock responses
  - [ ] Test testConnection() method
  - [ ] Test error handling

- [ ] **TEST-002**: Create unit tests for LM Studio provider
  - [ ] Test client initialization
  - [ ] Test evaluate() method with mock responses
  - [ ] Test testConnection() method
  - [ ] Test empty API key handling

- [ ] **TEST-003**: Create unit tests for Ollama provider
  - [ ] Test client initialization
  - [ ] Test evaluate() method with mock responses
  - [ ] Test testConnection() method
  - [ ] Test custom base URL handling

- [ ] **TEST-004**: Update validation tests
  - [ ] Add tests for new provider validation
  - [ ] Add tests for base_url validation
  - [ ] Add tests for optional API key validation

- [ ] **TEST-005**: Integration tests
  - [ ] Test full flow: add model → test connection → run evaluation
  - [ ] Test cross-provider evaluations
  - [ ] Test model updates with base_url changes

- [ ] **TEST-006**: E2E tests (Playwright)
  - [ ] Test adding each new provider via UI
  - [ ] Test connection testing
  - [ ] Test evaluation with each provider

### Phase 6: Documentation

- [ ] **DOCS-001**: Update README.md
  - [ ] Add new providers to supported providers list
  - [ ] Add setup instructions for Open Router
  - [ ] Add setup instructions for LM Studio
  - [ ] Add setup instructions for Ollama

- [ ] **DOCS-002**: Update openapi.yml
  - [ ] Add base_url to ModelConfiguration schema
  - [ ] Update provider enum values

- [ ] **DOCS-003**: Create provider setup guides
  - [ ] docs/providers/setup.md - Add all guides in 1 file.

### Phase 7: Quality Gates

- [ ] **QA-001**: Run typecheck (`npm run typecheck`)
- [ ] **QA-002**: Run linter (`npm run lint`)
- [ ] **QA-003**: Run formatter (`npm run format`)
- [ ] **QA-004**: Run unit tests (`npm test`)
- [ ] **QA-005**: Run E2E tests (`npm run test:e2e`)
- [ ] **QA-006**: Verify critical path coverage >80%

## 6. Implementation Notes

### 6.1 Open Router Implementation

```typescript
// Uses OpenAI SDK with custom base URL
const client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: apiKey,
  defaultHeaders: {
    'HTTP-Referer': 'https://eval-ai-models.com',
    'X-Title': 'Eval AI Models',
  },
});
```

### 6.2 LM Studio Implementation

```typescript
// Uses OpenAI SDK with local base URL
const client = new OpenAI({
  baseURL: base_url || 'http://localhost:1234/v1',
  apiKey: 'dummy-key', // Required by SDK but not used
});
```

### 6.3 Ollama Implementation

```typescript
// Custom REST API implementation
const response = await fetch(`${base_url || 'http://localhost:11434'}/api/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: modelName,
    messages: [{ role: 'user', content: instruction }],
    stream: false,
  }),
});
```

### 6.4 Database Migration

```sql
-- Migration script for existing databases
ALTER TABLE ModelConfiguration ADD COLUMN base_url TEXT;
UPDATE ModelConfiguration SET base_url = NULL WHERE provider IN ('openai', 'anthropic', 'google');
-- Drop and recreate constraints
DROP INDEX IF EXISTS idx_model_provider_name;
CREATE UNIQUE INDEX IF NOT EXISTS idx_model_provider_name ON ModelConfiguration(provider, model_name);
```

## 7. Risk Mitigation

| Risk                              | Mitigation                                                           |
| --------------------------------- | -------------------------------------------------------------------- |
| Local provider not running        | Clear error messages; graceful fallback; connection timeout handling |
| Different response formats        | Normalize to ModelResponse interface; comprehensive test coverage    |
| Breaking existing providers       | Extensive test coverage for existing providers before changes        |
| Security concerns (no auth local) | Document as localhost-only; add warning in UI for non-localhost URLs |

## 8. Success Criteria

- [ ] All three new providers can be configured via UI
- [ ] Connection testing works for all providers
- [ ] Evaluations can run with models from any provider
- [ ] Existing providers (OpenAI, Anthropic, Google) remain functional
- [ ] All tests pass (unit, integration, E2E)
- [ ] Code coverage >80% for critical paths
- [ ] Documentation is complete and accurate
