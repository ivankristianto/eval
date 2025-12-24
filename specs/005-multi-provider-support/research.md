# Research & Technology Decisions

**Feature**: Multi-Provider AI Model Support
**Date**: 2025-12-24
**Status**: Complete

## Overview

This document captures research findings and technology decisions for implementing multi-provider AI model support. Two primary unknowns from Technical Context required investigation:

1. Google Cloud Auth library for Vertex AI OAuth integration
2. Encryption library for credential storage

## Research Questions & Decisions

### 1. Google Cloud Auth Library for Vertex AI

**Question**: Which library should be used for Google Cloud OAuth 2.0 authentication in a Node.js environment?

**Decision**: `@google-cloud/vertexai` with `google-auth-library`

**Rationale**:
- **Official Support**: Both are official Google Cloud packages maintained by Google
- **Vertex AI Integration**: `@google-cloud/vertexai` v1.x provides native support for Vertex AI Generative AI models (Gemini, etc.)
- **Authentication**: `google-auth-library` handles OAuth 2.0 flows, service account authentication, and automatic token refresh
- **TypeScript Support**: Full TypeScript definitions included
- **Existing Patterns**: Aligns with existing `@google/generative-ai` usage for Google AI Studio
- **Node.js Compatibility**: Fully compatible with Node.js 22+ (project requirement)

**Alternatives Considered**:
1. **`googleapis` package**: More general-purpose but heavier weight, includes unnecessary APIs
   - Rejected: Too broad, larger bundle size, overkill for Vertex AI-only use case
2. **Manual OAuth implementation**: Custom OAuth 2.0 flow with fetch/axios
   - Rejected: Reinventing the wheel, missing token refresh logic, error-prone
3. **`gcp-metadata` + manual token management**: Low-level metadata service access
   - Rejected: Too low-level, manual token refresh required, no OAuth flow support

**Implementation Notes**:
- Use Application Default Credentials (ADC) for service accounts
- Support OAuth 2.0 web application flow for user authentication
- Token refresh handled automatically by `google-auth-library`
- Configuration requires project ID, location (region), and credentials

**Dependencies**:
```json
{
  "@google-cloud/vertexai": "^1.0.0",
  "google-auth-library": "^9.0.0"
}
```

**References**:
- [Vertex AI Node.js Client Library](https://cloud.google.com/nodejs/docs/reference/vertexai/latest)
- [Google Auth Library for Node.js](https://github.com/googleapis/google-auth-library-nodejs)
- [Vertex AI Authentication Guide](https://cloud.google.com/vertex-ai/docs/authentication)

---

### 2. Encryption Library for Credential Storage

**Question**: Which encryption library should be used for database credential encryption with application-managed keys?

**Decision**: Node.js built-in `crypto` module with AES-256-GCM

**Rationale**:
- **Zero Dependencies**: Built into Node.js, no external package required
- **Battle-Tested**: Part of Node.js core, based on OpenSSL
- **AES-256-GCM**: Modern authenticated encryption (confidentiality + integrity)
- **Performance**: Native C++ implementation, highly optimized
- **Key Management**: Simple environment variable storage for encryption key
- **Deterministic**: Same plaintext + key = different ciphertext (due to random IV)
- **Node.js 22+ Support**: Stable API, no breaking changes expected

**Alternatives Considered**:
1. **`bcrypt` or `argon2`**: Password hashing algorithms
   - Rejected: Designed for one-way hashing, not reversible encryption (we need to decrypt API keys for use)
2. **`crypto-js`**: JavaScript crypto library
   - Rejected: Pure JS implementation slower than native crypto, additional dependency
3. **`sodium-native` / `libsodium`**: Modern crypto library
   - Rejected: Additional native dependency, compilation required, overkill for simple AES encryption
4. **AWS KMS / HashiCorp Vault**: External secret management
   - Rejected: Adds operational complexity, external service dependency (violates "application-managed keys" requirement)

**Implementation Pattern**:
```typescript
// Encryption
import crypto from 'crypto';

const algorithm = 'aes-256-gcm';
const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex'); // 32 bytes

function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ]);

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:ciphertext (all hex-encoded)
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decrypt(ciphertext: string): string {
  const parts = ciphertext.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = Buffer.from(parts[2], 'hex');

  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]);

  return decrypted.toString('utf8');
}
```

**Security Considerations**:
- **Key Storage**: `ENCRYPTION_KEY` environment variable (32-byte hex string)
- **Key Generation**: `crypto.randomBytes(32).toString('hex')`
- **Key Rotation**: Requires re-encryption of all credentials (future enhancement)
- **IV Uniqueness**: Random IV generated per encryption ensures same plaintext produces different ciphertext
- **Authentication**: GCM mode provides built-in authentication (prevents tampering)

**References**:
- [Node.js Crypto Documentation](https://nodejs.org/api/crypto.html)
- [NIST AES-GCM Recommendation](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf)

---

### 3. Open Router API Integration

**Question**: What are the best practices for integrating with Open Router's unified API?

**Decision**: Use OpenAI SDK with custom base URL pointing to Open Router

**Rationale**:
- **OpenAI-Compatible**: Open Router implements OpenAI API compatibility
- **Existing Dependency**: OpenAI SDK already in project dependencies
- **Model Routing**: Open Router handles model routing transparently
- **Cost Tracking**: Responses include Open Router-specific metadata via headers
- **Minimal Changes**: Reuse existing OpenAI client logic with different base URL

**Implementation Notes**:
```typescript
import OpenAI from 'openai';

const openRouterClient = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': 'https://your-app.com', // Optional, for rankings
    'X-Title': 'AI Model Evaluator' // Optional, for rankings
  }
});
```

**Open Router Specific Features**:
- Model selection: Use any model from their catalog (e.g., `openai/gpt-4`, `anthropic/claude-3-opus`)
- Rate limits: Return rate limit info in response headers
- Cost tracking: Include generation cost in response metadata
- Fallbacks: Automatic fallback to alternative providers (configurable)

**References**:
- [Open Router Documentation](https://openrouter.ai/docs)
- [Open Router API Reference](https://openrouter.ai/docs#api-reference)

---

### 4. Local LLM Provider Integration (LM Studio & Ollama)

**Question**: What are the API patterns for LM Studio and Ollama integration?

**Decision**:
- **LM Studio**: OpenAI-compatible API (use OpenAI SDK with custom base URL)
- **Ollama**: Native REST API (custom HTTP client implementation)

**Rationale**:

**LM Studio**:
- Implements OpenAI API compatibility on local endpoint (default: `http://localhost:1234/v1`)
- Reuse OpenAI SDK client (same pattern as Open Router)
- Zero additional dependencies

**Ollama**:
- Custom REST API (`http://localhost:11434`)
- Different request/response format than OpenAI
- Simple enough for native `fetch` implementation
- No additional dependencies needed

**Implementation Notes**:

*LM Studio*:
```typescript
import OpenAI from 'openai';

const lmStudioClient = new OpenAI({
  apiKey: 'not-needed', // LM Studio doesn't require auth
  baseURL: 'http://localhost:1234/v1'
});
```

*Ollama*:
```typescript
// Native fetch implementation
async function ollamaGenerate(model: string, prompt: string): Promise<Response> {
  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false
    })
  });

  return response.json();
}
```

**References**:
- [LM Studio Documentation](https://lmstudio.ai/docs)
- [Ollama API Documentation](https://github.com/ollama/ollama/blob/main/docs/api.md)

---

### 5. Database Schema Migration Strategy

**Question**: How should we migrate the existing schema to support provider-level configuration?

**Decision**: Create migration script with backward compatibility approach

**Rationale**:
- **Existing Data**: Preserve existing model configurations during migration
- **Zero Downtime**: Migration script handles data transformation atomically
- **Rollback**: Include rollback script for safety
- **Testing**: Migration tested on copy of production database before deployment

**Migration Approach**:
1. Create new `ProviderConfiguration` table
2. Migrate existing `ModelConfiguration` rows to create provider records
3. Add `provider_id` foreign key to `ModelConfiguration`
4. Update existing rows to reference new providers
5. Remove old `provider` enum column and `api_key_encrypted` column
6. Update constraints and indexes

**Migration Script Structure**:
```sql
-- Phase 1: Add new tables
CREATE TABLE ProviderConfiguration (...);

-- Phase 2: Migrate existing data
INSERT INTO ProviderConfiguration (...)
SELECT DISTINCT provider, ... FROM ModelConfiguration;

-- Phase 3: Update existing ModelConfiguration
ALTER TABLE ModelConfiguration ADD COLUMN provider_id TEXT;
UPDATE ModelConfiguration SET provider_id = (...);

-- Phase 4: Remove old columns
ALTER TABLE ModelConfiguration DROP COLUMN provider;
ALTER TABLE ModelConfiguration DROP COLUMN api_key_encrypted;

-- Phase 5: Add constraints
ALTER TABLE ModelConfiguration
  ADD FOREIGN KEY (provider_id) REFERENCES ProviderConfiguration(id);
```

**Backward Compatibility**:
- Existing evaluations remain functional (foreign key to ModelConfiguration unchanged)
- API endpoints versioned if needed
- UI gracefully handles both old and new data formats during transition

**References**:
- [SQLite ALTER TABLE](https://www.sqlite.org/lang_altertable.html)
- [better-sqlite3 Migration Patterns](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md)

---

## Summary of Dependencies

**New Production Dependencies**:
```json
{
  "@google-cloud/vertexai": "^1.0.0",
  "google-auth-library": "^9.0.0"
}
```

**No Additional Dependencies Needed**:
- Encryption: Node.js built-in `crypto` module
- Open Router: Existing `openai` package
- LM Studio: Existing `openai` package
- Ollama: Node.js built-in `fetch` API

**Total New Dependencies**: 2 packages

---

## Risk Assessment

### Low Risk
- ✅ Using official Google Cloud libraries (well-maintained, stable APIs)
- ✅ Node.js crypto module (battle-tested, core functionality)
- ✅ OpenAI SDK for OpenAI-compatible APIs (proven pattern)

### Medium Risk
- ⚠️ Database migration complexity (mitigated by: backward compatibility, rollback script, testing)
- ⚠️ OAuth flow UX (mitigated by: clear error messages, cancel handling)

### High Risk
- None identified

---

## Next Steps

1. ✅ Research complete
2. → Proceed to Phase 1: Data Model design
3. → Create API contracts for provider management
4. → Design database schema with migration path
