# Quick Start: Multi-Provider AI Model Support

**Feature**: 005-multi-provider-support
**Date**: 2025-12-24
**Audience**: Developers implementing this feature

## Overview

This guide provides a quick reference for implementing multi-provider AI model support. Follow the implementation order below to ensure dependencies are properly handled.

## Prerequisites

- ✅ Phase 0 research complete (see `research.md`)
- ✅ Data model designed (see `data-model.md`)
- ✅ API contracts defined (see `contracts/providers-api.yaml`)
- ✅ Constitution check passed

## Implementation Order

### Step 1: Database Migration

**Priority**: P0 (blocking all other work)
**Files**: `db/schema.sql`, `db/migrations/005-multi-provider.sql`

```sql
-- Create new ProviderConfiguration table
CREATE TABLE ProviderConfiguration (
  id TEXT PRIMARY KEY,
  provider_type TEXT NOT NULL CHECK (...),
  name TEXT NOT NULL,
  auth_method TEXT NOT NULL CHECK (...),
  credentials_encrypted TEXT,
  oauth_token_expiry TEXT,
  oauth_refresh_token_encrypted TEXT,
  endpoint_url TEXT,
  config_json TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_connection_test TEXT
);

-- Migrate existing data
-- Add provider_id to ModelConfiguration
-- Drop old columns
```

**Test**:
```bash
npm run db:reset  # Test migration on clean database
# Verify existing data preserved
```

**Reference**: See `data-model.md` section "Migration Path"

---

### Step 2: Encryption Utilities

**Priority**: P0 (required for database operations)
**Files**: `src/lib/auth/encryption.ts`

```typescript
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(ciphertext: string): string {
  const [ivHex, authTagHex, encryptedHex] = ciphertext.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]);

  return decrypted.toString('utf8');
}
```

**Test**:
```typescript
// tests/unit/auth/encryption.test.ts
describe('encryption', () => {
  it('encrypts and decrypts correctly', () => {
    const plaintext = 'sk-test-key-123';
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });
});
```

**Environment Setup**:
```bash
# .env
ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
```

---

### Step 3: Provider Base Interface

**Priority**: P0 (foundation for all providers)
**Files**: `src/lib/providers/base.ts`

```typescript
export interface ModelClient {
  evaluate(instruction: string): Promise<ModelResponse>;
  testConnection(): Promise<boolean>;
  listModels?(): Promise<string[]>;
}

export interface ProviderConfig {
  id: string;
  provider_type: ProviderType;
  auth_method: AuthMethod;
  credentials?: string; // Decrypted
  endpoint_url?: string;
  config?: Record<string, any>;
}

export abstract class BaseProviderClient implements ModelClient {
  protected config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  abstract evaluate(instruction: string): Promise<ModelResponse>;
  abstract testConnection(): Promise<boolean>;

  // Optional: default implementation
  async listModels(): Promise<string[]> {
    throw new Error('listModels not implemented');
  }
}
```

**Reference**: See existing `src/lib/api-clients.ts` for ModelClient interface

---

### Step 4: Provider Client Implementations

**Priority**: P1 (parallel implementation, order by user story priority)

#### 4a. Vertex AI Client (P1)

**Files**: `src/lib/providers/vertex-ai.ts`

```typescript
import { VertexAI } from '@google-cloud/vertexai';
import { GoogleAuth } from 'google-auth-library';
import { BaseProviderClient } from './base';

export class VertexAIClient extends BaseProviderClient {
  private client: VertexAI;

  constructor(config: ProviderConfig) {
    super(config);

    const auth = new GoogleAuth({
      credentials: JSON.parse(config.credentials!),
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });

    this.client = new VertexAI({
      project: config.config!.projectId,
      location: config.config!.location,
      googleAuth: auth
    });
  }

  async evaluate(instruction: string): Promise<ModelResponse> {
    // Implementation using Vertex AI SDK
  }

  async testConnection(): Promise<boolean> {
    try {
      // Test API connectivity
      return true;
    } catch {
      return false;
    }
  }
}
```

**Test**: Contract test verifying OpenAI SDK compatibility

#### 4b. Open Router Client (P1)

**Files**: `src/lib/providers/open-router.ts`

```typescript
import OpenAI from 'openai';
import { BaseProviderClient } from './base';

export class OpenRouterClient extends BaseProviderClient {
  private client: OpenAI;

  constructor(config: ProviderConfig) {
    super(config);

    this.client = new OpenAI({
      apiKey: config.credentials!,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://your-app.com',
        'X-Title': 'AI Model Evaluator'
      }
    });
  }

  async evaluate(instruction: string): Promise<ModelResponse> {
    // Reuse OpenAI SDK logic
  }
}
```

#### 4c. LM Studio Client (P2)

**Files**: `src/lib/providers/lm-studio.ts`

```typescript
import OpenAI from 'openai';
import { BaseProviderClient } from './base';

export class LMStudioClient extends BaseProviderClient {
  private client: OpenAI;

  constructor(config: ProviderConfig) {
    super(config);

    this.client = new OpenAI({
      apiKey: 'not-needed',
      baseURL: config.endpoint_url! // e.g., http://localhost:1234/v1
    });
  }

  async evaluate(instruction: string): Promise<ModelResponse> {
    // Reuse OpenAI SDK logic
  }
}
```

#### 4d. Ollama Client (P2)

**Files**: `src/lib/providers/ollama.ts`

```typescript
import { BaseProviderClient } from './base';

export class OllamaClient extends BaseProviderClient {
  async evaluate(instruction: string): Promise<ModelResponse> {
    const response = await fetch(`${this.config.endpoint_url}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model_name,
        prompt: instruction,
        stream: false
      })
    });

    const data = await response.json();
    return {
      response: data.response,
      executionTime: data.total_duration / 1000000, // ns to ms
      inputTokens: data.prompt_eval_count,
      outputTokens: data.eval_count
    };
  }

  async listModels(): Promise<string[]> {
    const response = await fetch(`${this.config.endpoint_url}/api/tags`);
    const data = await response.json();
    return data.models.map((m: any) => m.name);
  }
}
```

**Test Pattern** (repeat for each provider):
```typescript
// tests/unit/providers/ollama.test.ts
describe('OllamaClient', () => {
  it('evaluates instruction correctly', async () => {
    const client = new OllamaClient({
      id: 'test',
      provider_type: 'ollama',
      auth_method: 'none',
      endpoint_url: 'http://localhost:11434'
    });

    // Mock fetch
    const result = await client.evaluate('test instruction');
    expect(result.response).toBeDefined();
  });
});
```

---

### Step 5: Provider Factory & Abstraction Layer

**Priority**: P0 (integrates all providers)
**Files**: `src/lib/api-clients.ts` (modify existing), `src/lib/providers/factory.ts`

```typescript
// src/lib/providers/factory.ts
import type { ProviderConfiguration } from '../types';
import type { ModelClient } from './base';
import { OpenAIClient } from './openai'; // Existing
import { AnthropicClient } from './anthropic'; // Existing
import { GoogleClient } from './google'; // Existing
import { VertexAIClient } from './vertex-ai';
import { OpenRouterClient } from './open-router';
import { LMStudioClient } from './lm-studio';
import { OllamaClient } from './ollama';
import { decrypt } from '../auth/encryption';

export function createProviderClient(
  provider: ProviderConfiguration,
  modelName: string
): ModelClient {
  // Decrypt credentials if needed
  const credentials = provider.credentials_encrypted
    ? decrypt(provider.credentials_encrypted)
    : undefined;

  const config = {
    id: provider.id,
    provider_type: provider.provider_type,
    auth_method: provider.auth_method,
    credentials,
    endpoint_url: provider.endpoint_url,
    config: provider.config_json ? JSON.parse(provider.config_json) : undefined
  };

  switch (provider.provider_type) {
    case 'openai':
      return new OpenAIClient(credentials!, modelName);
    case 'anthropic':
      return new AnthropicClient(credentials!, modelName);
    case 'google':
      return new GoogleClient(credentials!, modelName);
    case 'vertexai':
      return new VertexAIClient(config);
    case 'openrouter':
      return new OpenRouterClient(config);
    case 'lmstudio':
      return new LMStudioClient(config);
    case 'ollama':
      return new OllamaClient(config);
    default:
      throw new Error(`Unknown provider type: ${provider.provider_type}`);
  }
}
```

**Modify Evaluator**:
```typescript
// src/lib/evaluator.ts
import { createProviderClient } from './providers/factory';

// In runEvaluation function:
const providerConfig = await db.getProviderByModelId(model.id);
const client = createProviderClient(providerConfig, model.model_name);
```

---

### Step 6: OAuth Flow Handler

**Priority**: P1 (required for Vertex AI)
**Files**: `src/lib/auth/oauth.ts`

```typescript
import { OAuth2Client } from 'google-auth-library';
import { encrypt } from './encryption';

export class VertexAIOAuthHandler {
  private client: OAuth2Client;

  constructor(clientId: string, clientSecret: string, redirectUri: string) {
    this.client = new OAuth2Client(clientId, clientSecret, redirectUri);
  }

  generateAuthUrl(state: string): string {
    return this.client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/cloud-platform'],
      state
    });
  }

  async exchangeCodeForTokens(code: string) {
    const { tokens } = await this.client.getToken(code);

    return {
      access_token_encrypted: encrypt(tokens.access_token!),
      refresh_token_encrypted: encrypt(tokens.refresh_token!),
      token_expiry: tokens.expiry_date
        ? new Date(tokens.expiry_date).toISOString()
        : null
    };
  }

  async refreshAccessToken(refreshToken: string) {
    this.client.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await this.client.refreshAccessToken();

    return {
      access_token_encrypted: encrypt(credentials.access_token!),
      token_expiry: credentials.expiry_date
        ? new Date(credentials.expiry_date).toISOString()
        : null
    };
  }
}
```

---

### Step 7: API Endpoints

**Priority**: P1
**Files**: `src/pages/api/providers/*.ts`

Implement endpoints per `contracts/providers-api.yaml`:

```typescript
// src/pages/api/providers/index.ts
import type { APIRoute } from 'astro';
import { db } from '../../../lib/db';

export const GET: APIRoute = async ({ url }) => {
  const activeOnly = url.searchParams.get('active_only') !== 'false';
  const providers = await db.listProviders(activeOnly);

  return new Response(JSON.stringify({
    providers,
    total: providers.length
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  // Validate request
  // Encrypt credentials
  // Create provider
  // Return response
};
```

**Test**:
```typescript
// tests/integration/providers/provider-api.test.ts
describe('Provider API', () => {
  it('creates provider successfully', async () => {
    const response = await fetch('/api/providers', {
      method: 'POST',
      body: JSON.stringify({
        provider_type: 'ollama',
        name: 'Test Ollama',
        auth_method: 'none',
        endpoint_url: 'http://localhost:11434'
      })
    });

    expect(response.status).toBe(201);
  });
});
```

---

### Step 8: UI Components (P3)

**Priority**: P3 (after API working)
**Files**: `src/components/providers/*.tsx`, `src/pages/providers/*.astro`

Follow existing UI patterns (Tailwind CSS + DaisyUI):

```tsx
// src/components/providers/ProviderForm.tsx
export function ProviderForm({ provider }: { provider?: ProviderConfiguration }) {
  return (
    <form className="form-control gap-4">
      <label className="label">
        <span className="label-text">Provider Type</span>
        <select className="select select-bordered">
          <option value="vertexai">Google Vertex AI</option>
          <option value="openrouter">Open Router</option>
          <option value="lmstudio">LM Studio</option>
          <option value="ollama">Ollama</option>
        </select>
      </label>

      {/* Conditional fields based on provider type */}
      {/* Authentication method selection */}
      {/* Credential inputs */}
    </form>
  );
}
```

---

## Testing Strategy

### Unit Tests

```bash
# Test individual provider clients
npm test -- tests/unit/providers/

# Test encryption utilities
npm test -- tests/unit/auth/encryption.test.ts

# Test database operations
npm test -- tests/unit/db.test.ts
```

### Integration Tests

```bash
# Test provider API endpoints
npm test -- tests/integration/providers/

# Test provider configuration flow
npm test -- tests/integration/provider-config.test.ts
```

### E2E Tests

```bash
# Test complete provider management workflow
npm run test:e2e -- tests/e2e/provider-management.spec.ts
```

### Manual Testing Checklist

- [ ] Create Vertex AI provider with OAuth
- [ ] Create Open Router provider with API key
- [ ] Create local Ollama provider
- [ ] Test provider connection before saving
- [ ] Update provider credentials
- [ ] Run evaluation with new provider
- [ ] Verify evaluation continues when one provider fails
- [ ] Test OAuth token refresh
- [ ] Delete provider (should fail if has models)
- [ ] Disable provider (soft delete)

---

## Performance Validation

Validate against success criteria:

```typescript
// Measure provider credential validation (SC-004: <5s)
console.time('validation');
await testProviderConnection(config);
console.timeEnd('validation'); // Should be < 5000ms

// Measure provider configuration (SC-002: <3min)
console.time('configuration');
await createProvider(config);
console.timeEnd('configuration'); // Should be < 180000ms
```

---

## Troubleshooting

### Encryption Key Issues

```bash
# Generate new encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Verify key length (must be 64 hex characters = 32 bytes)
echo $ENCRYPTION_KEY | wc -c  # Should be 65 (64 + newline)
```

### OAuth Flow Failures

```typescript
// Debug OAuth state mismatch
console.log('Expected state:', storedState);
console.log('Received state:', receivedState);

// Verify redirect URI matches
console.log('Configured redirect:', process.env.OAUTH_REDIRECT_URI);
console.log('Actual redirect:', request.url);
```

### Local Provider Connection

```bash
# Verify LM Studio running
curl http://localhost:1234/v1/models

# Verify Ollama running
curl http://localhost:11434/api/tags
```

---

## Next Steps

1. ✅ Complete Phase 1 (design)
2. → Generate tasks.md with `/speckit.tasks` command
3. → Begin implementation following tasks.md
4. → Test-first: Write failing tests before implementation
5. → Validate against constitution principles

---

## References

- **Research**: `research.md` - Technology decisions and library choices
- **Data Model**: `data-model.md` - Database schema and entity relationships
- **API Contract**: `contracts/providers-api.yaml` - OpenAPI specification
- **Constitution**: `.specify/memory/constitution.md` - Project principles
