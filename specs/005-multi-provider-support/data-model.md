# Data Model: Multi-Provider AI Model Support

**Feature**: 005-multi-provider-support
**Date**: 2025-12-24
**Status**: Design Complete

## Overview

This document defines the data model for multi-provider AI model support. The key change is separating provider configuration from model configuration, enabling one provider to have multiple models with shared authentication and endpoint settings.

## Entity Definitions

### ProviderConfiguration

**Purpose**: Represents a configured AI provider with authentication details and connection settings.

**Attributes**:

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | UUID v4 identifier |
| `provider_type` | TEXT | NOT NULL, CHECK IN(...) | Provider type: 'openai', 'anthropic', 'google', 'vertexai', 'openrouter', 'lmstudio', 'ollama' |
| `name` | TEXT | NOT NULL | User-friendly provider name (e.g., "My Vertex AI", "Local Ollama") |
| `auth_method` | TEXT | NOT NULL, CHECK IN(...) | Authentication method: 'api_key', 'oauth', 'none' |
| `credentials_encrypted` | TEXT | NULL | Encrypted credentials (API key or OAuth tokens), NULL for 'none' auth |
| `oauth_token_expiry` | TEXT | NULL | ISO 8601 timestamp for OAuth token expiration (NULL if not OAuth) |
| `oauth_refresh_token_encrypted` | TEXT | NULL | Encrypted OAuth refresh token (NULL if not OAuth) |
| `endpoint_url` | TEXT | NULL | Custom endpoint URL for local providers (LM Studio, Ollama) or custom deployments |
| `config_json` | TEXT | NULL | Provider-specific configuration as JSON (e.g., GCP project ID, region) |
| `is_active` | INTEGER | NOT NULL, DEFAULT 1 | Soft delete flag: 1=active, 0=disabled |
| `created_at` | TEXT | NOT NULL, DEFAULT now | ISO 8601 timestamp |
| `updated_at` | TEXT | NOT NULL, DEFAULT now | ISO 8601 timestamp |
| `last_connection_test` | TEXT | NULL | ISO 8601 timestamp of last successful connection test |

**Relationships**:
- One-to-Many with `ModelConfiguration` (one provider, many models)

**Validation Rules**:
- `provider_type` IN ('openai', 'anthropic', 'google', 'vertexai', 'openrouter', 'lmstudio', 'ollama')
- `auth_method` IN ('api_key', 'oauth', 'none')
- If `auth_method='api_key'`, then `credentials_encrypted` MUST NOT be NULL
- If `auth_method='oauth'`, then `credentials_encrypted`, `oauth_token_expiry`, `oauth_refresh_token_encrypted` MUST NOT be NULL
- If `auth_method='none'`, then all credential fields MUST be NULL
- If `provider_type` IN ('lmstudio', 'ollama'), then `endpoint_url` MUST NOT be NULL
- `name` must be unique per user (future: add user_id when multi-user support added)

**Indexes**:
- `idx_provider_type_active` ON (provider_type, is_active)
- `idx_provider_name` ON (name) UNIQUE

**Encryption Details**:
- All `*_encrypted` fields use AES-256-GCM
- Format: `{iv}:{authTag}:{ciphertext}` (all hex-encoded)
- Encryption key stored in `ENCRYPTION_KEY` environment variable

**Example Row (Vertex AI)**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "provider_type": "vertexai",
  "name": "Production Vertex AI",
  "auth_method": "oauth",
  "credentials_encrypted": "abc123...:def456...:ghi789...",
  "oauth_token_expiry": "2025-12-24T18:30:00Z",
  "oauth_refresh_token_encrypted": "jkl012...:mno345...:pqr678...",
  "endpoint_url": null,
  "config_json": "{\"projectId\":\"my-gcp-project\",\"location\":\"us-central1\"}",
  "is_active": 1,
  "created_at": "2025-12-24T10:00:00Z",
  "updated_at": "2025-12-24T10:00:00Z",
  "last_connection_test": "2025-12-24T10:05:00Z"
}
```

**Example Row (Ollama)**:
```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "provider_type": "ollama",
  "name": "Local Ollama",
  "auth_method": "none",
  "credentials_encrypted": null,
  "oauth_token_expiry": null,
  "oauth_refresh_token_encrypted": null,
  "endpoint_url": "http://localhost:11434",
  "config_json": null,
  "is_active": 1,
  "created_at": "2025-12-24T11:00:00Z",
  "updated_at": "2025-12-24T11:00:00Z",
  "last_connection_test": "2025-12-24T11:02:00Z"
}
```

---

### ModelConfiguration (Modified)

**Purpose**: Represents a specific AI model available through a provider.

**Changes from Existing**:
- **REMOVED**: `provider` column (enum)
- **REMOVED**: `api_key_encrypted` column
- **ADDED**: `provider_id` column (foreign key to ProviderConfiguration)

**Attributes**:

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | UUID v4 identifier (EXISTING) |
| `provider_id` | TEXT | NOT NULL, FOREIGN KEY | Reference to ProviderConfiguration.id (NEW) |
| `model_name` | TEXT | NOT NULL | Model identifier (e.g., "gpt-4", "gemini-pro", "llama2") (EXISTING) |
| `display_name` | TEXT | NULL | User-friendly display name (NEW, optional) |
| `created_at` | TEXT | NOT NULL, DEFAULT now | ISO 8601 timestamp (EXISTING) |
| `updated_at` | TEXT | NOT NULL, DEFAULT now | ISO 8601 timestamp (EXISTING) |
| `is_active` | INTEGER | NOT NULL, DEFAULT 1 | Soft delete flag (EXISTING) |
| `notes` | TEXT | NULL | User notes (EXISTING) |

**Relationships**:
- Many-to-One with `ProviderConfiguration` (many models, one provider)
- One-to-Many with `Result` (unchanged from existing)

**Validation Rules**:
- `provider_id` must reference an active ProviderConfiguration (is_active=1)
- `(provider_id, model_name)` must be unique (prevent duplicate model names per provider)

**Indexes**:
- `idx_model_provider_active` ON (provider_id, is_active) [MODIFIED: provider → provider_id]
- `idx_model_provider_name` ON (provider_id, model_name) UNIQUE [MODIFIED: provider → provider_id]

**Example Row**:
```json
{
  "id": "770e8400-e29b-41d4-a716-446655440002",
  "provider_id": "550e8400-e29b-41d4-a716-446655440000",
  "model_name": "gemini-1.5-pro",
  "display_name": "Gemini 1.5 Pro (Vertex AI)",
  "created_at": "2025-12-24T10:10:00Z",
  "updated_at": "2025-12-24T10:10:00Z",
  "is_active": 1,
  "notes": "Primary production model"
}
```

---

### Evaluation (No Changes)

**Purpose**: Represents an evaluation run.

**Note**: No changes required. Existing schema remains intact.

---

### EvaluationTemplate (No Changes)

**Purpose**: Represents a saved evaluation template.

**Note**: No changes required. Existing schema remains intact.

---

### Result (No Changes)

**Purpose**: Stores individual model evaluation results.

**Note**: No changes required. Existing foreign key to `ModelConfiguration.id` continues to work. Historical results preserved.

---

## Relationships Diagram

```text
┌─────────────────────────┐
│  ProviderConfiguration  │
├─────────────────────────┤
│ id (PK)                 │
│ provider_type           │
│ name                    │
│ auth_method             │
│ credentials_encrypted   │
│ endpoint_url            │
│ ...                     │
└───────────┬─────────────┘
            │ 1
            │
            │ has many
            │
            │ N
┌───────────▼─────────────┐
│   ModelConfiguration    │
├─────────────────────────┤
│ id (PK)                 │
│ provider_id (FK)        │◄─────┐
│ model_name              │      │
│ display_name            │      │
│ ...                     │      │
└───────────┬─────────────┘      │
            │ 1                  │
            │                    │ FK relationship
            │ has many           │
            │                    │
            │ N                  │
┌───────────▼─────────────┐      │
│        Result           │      │
├─────────────────────────┤      │
│ id (PK)                 │      │
│ evaluation_id (FK)      │      │
│ model_id (FK)           ├──────┘
│ response_text           │
│ execution_time_ms       │
│ ...                     │
└─────────────────────────┘
```

---

## State Transitions

### ProviderConfiguration States

**State Field**: `is_active`

**States**:
1. **Active** (`is_active=1`): Provider available for use
2. **Inactive** (`is_active=0`): Provider disabled (soft delete)

**Transitions**:
- **Create** → Active
- **User Disable** → Active → Inactive
- **User Enable** → Inactive → Active
- **Cannot Delete** if provider has:
  - Active ModelConfiguration records
  - Historical Result records (via ModelConfiguration)

**Validation on Delete**:
```sql
-- Cannot delete if has associated models
SELECT COUNT(*) FROM ModelConfiguration WHERE provider_id = ?;
-- Cannot delete if has historical results (indirect via models)
SELECT COUNT(*) FROM Result
WHERE model_id IN (
  SELECT id FROM ModelConfiguration WHERE provider_id = ?
);
```

### OAuth Token Lifecycle

**Fields**: `oauth_token_expiry`, `oauth_refresh_token_encrypted`

**States**:
1. **Valid**: Current time < `oauth_token_expiry`
2. **Expired**: Current time >= `oauth_token_expiry`
3. **Refreshing**: Token refresh in progress
4. **Failed**: Refresh failed (user re-authentication required)

**Transitions**:
- **Initial OAuth**: NULL → Valid (after successful OAuth flow)
- **Auto Refresh**: Valid → Refreshing → Valid (before expiry, using refresh token)
- **Expired**: Valid → Expired (time passes)
- **Refresh Attempt**: Expired → Refreshing → Valid | Failed
- **User Re-auth**: Failed → Valid (user completes OAuth flow again)

**Auto-Refresh Trigger**:
- Triggered when `oauth_token_expiry - now() < 5 minutes`
- Performed during connection test or evaluation start
- Updates `credentials_encrypted` and `oauth_token_expiry` on success

---

## Data Volume Estimates

**Scale**: Based on FR requirements and success criteria

| Entity | Estimated Rows | Rationale |
|--------|---------------|-----------|
| ProviderConfiguration | 10-20 | SC-010: Support 10 concurrent configs. Typical user has 3-5 providers. |
| ModelConfiguration | 30-100 | Average 3-5 models per provider × 10 providers |
| Evaluation | 1,000-10,000 | Historical evaluations accumulate over time |
| Result | 30,000-300,000 | 30 models × 10,000 evaluations |

**Storage Impact**:
- Encryption overhead: ~50 bytes per encrypted field (IV + AuthTag + padding)
- Estimated provider record: ~500 bytes
- Total provider table: 10-20 KB (negligible)

---

## Migration Path

### Current Schema → New Schema

**Step 1**: Create ProviderConfiguration table
**Step 2**: Migrate existing data

```sql
-- Create provider records from existing distinct providers
INSERT INTO ProviderConfiguration (id, provider_type, name, auth_method, credentials_encrypted, is_active, created_at, updated_at)
SELECT
  lower(hex(randomblob(16))), -- Generate UUID
  provider, -- 'openai', 'anthropic', 'google'
  CASE provider
    WHEN 'openai' THEN 'OpenAI'
    WHEN 'anthropic' THEN 'Anthropic'
    WHEN 'google' THEN 'Google AI'
  END,
  'api_key', -- All existing providers use API keys
  api_key_encrypted,
  1, -- Active
  MIN(created_at),
  MAX(updated_at)
FROM ModelConfiguration
WHERE is_active = 1
GROUP BY provider, api_key_encrypted;
```

**Step 3**: Update ModelConfiguration

```sql
-- Add provider_id column
ALTER TABLE ModelConfiguration ADD COLUMN provider_id TEXT;

-- Populate provider_id from ProviderConfiguration
UPDATE ModelConfiguration
SET provider_id = (
  SELECT pc.id
  FROM ProviderConfiguration pc
  WHERE pc.provider_type = ModelConfiguration.provider
    AND pc.credentials_encrypted = ModelConfiguration.api_key_encrypted
  LIMIT 1
);

-- Add foreign key constraint
ALTER TABLE ModelConfiguration
ADD CONSTRAINT fk_model_provider
FOREIGN KEY (provider_id) REFERENCES ProviderConfiguration(id);
```

**Step 4**: Remove old columns

```sql
-- Drop old columns (SQLite limitation: create new table)
CREATE TABLE ModelConfiguration_new (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  model_name TEXT NOT NULL,
  display_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_active INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  FOREIGN KEY (provider_id) REFERENCES ProviderConfiguration(id)
);

-- Copy data
INSERT INTO ModelConfiguration_new
SELECT id, provider_id, model_name, NULL, created_at, updated_at, is_active, notes
FROM ModelConfiguration;

-- Swap tables
DROP TABLE ModelConfiguration;
ALTER TABLE ModelConfiguration_new RENAME TO ModelConfiguration;

-- Recreate indexes
CREATE INDEX idx_model_provider_active ON ModelConfiguration(provider_id, is_active);
CREATE UNIQUE INDEX idx_model_provider_name ON ModelConfiguration(provider_id, model_name);
```

**Rollback Plan**:
- Keep backup of original database before migration
- Migration script includes inverse operations
- Can reconstruct old schema from new schema (provider_id → provider enum lookup)

---

## Validation Examples

### Valid Provider Creation

```typescript
// Vertex AI with OAuth
{
  provider_type: 'vertexai',
  name: 'My Vertex AI',
  auth_method: 'oauth',
  credentials_encrypted: '<encrypted-token>',
  oauth_token_expiry: '2025-12-25T10:00:00Z',
  oauth_refresh_token_encrypted: '<encrypted-refresh>',
  endpoint_url: null,
  config_json: '{"projectId":"my-project","location":"us-central1"}'
}
// ✅ VALID: OAuth requires all token fields

// Local Ollama
{
  provider_type: 'ollama',
  name: 'Local Ollama',
  auth_method: 'none',
  credentials_encrypted: null,
  oauth_token_expiry: null,
  oauth_refresh_token_encrypted: null,
  endpoint_url: 'http://localhost:11434',
  config_json: null
}
// ✅ VALID: Local provider with no auth

// Open Router
{
  provider_type: 'openrouter',
  name: 'Open Router',
  auth_method: 'api_key',
  credentials_encrypted: '<encrypted-api-key>',
  oauth_token_expiry: null,
  oauth_refresh_token_encrypted: null,
  endpoint_url: null,
  config_json: null
}
// ✅ VALID: API key auth
```

### Invalid Provider Attempts

```typescript
// Missing credentials for API key auth
{
  provider_type: 'openrouter',
  auth_method: 'api_key',
  credentials_encrypted: null // ❌ INVALID: api_key requires credentials
}

// Missing endpoint for local provider
{
  provider_type: 'ollama',
  auth_method: 'none',
  endpoint_url: null // ❌ INVALID: ollama requires endpoint_url
}

// OAuth without expiry
{
  provider_type: 'vertexai',
  auth_method: 'oauth',
  credentials_encrypted: '<encrypted-token>',
  oauth_token_expiry: null // ❌ INVALID: oauth requires token_expiry
}
```

---

## Type Definitions (TypeScript)

```typescript
// Provider types
export type ProviderType =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'vertexai'
  | 'openrouter'
  | 'lmstudio'
  | 'ollama';

export type AuthMethod = 'api_key' | 'oauth' | 'none';

// Provider configuration interface
export interface ProviderConfiguration {
  id: string;
  provider_type: ProviderType;
  name: string;
  auth_method: AuthMethod;
  credentials_encrypted: string | null;
  oauth_token_expiry: string | null; // ISO 8601
  oauth_refresh_token_encrypted: string | null;
  endpoint_url: string | null;
  config_json: string | null; // JSON string
  is_active: boolean;
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
  last_connection_test: string | null; // ISO 8601
}

// Model configuration interface (updated)
export interface ModelConfiguration {
  id: string;
  provider_id: string; // NEW: FK to ProviderConfiguration
  model_name: string;
  display_name: string | null; // NEW
  created_at: string;
  updated_at: string;
  is_active: boolean;
  notes: string | null;
}

// Provider with models (joined view)
export interface ProviderWithModels {
  provider: ProviderConfiguration;
  models: ModelConfiguration[];
}
```

---

## Summary

**Key Changes**:
1. ✅ New `ProviderConfiguration` table with authentication and endpoint management
2. ✅ Modified `ModelConfiguration` table with provider_id foreign key
3. ✅ Encryption support for credentials and OAuth tokens (AES-256-GCM)
4. ✅ OAuth token lifecycle with auto-refresh
5. ✅ Support for 8 provider types with 3 authentication methods
6. ✅ Migration path from existing schema with rollback plan
7. ✅ Soft delete prevention for providers with historical data

**Backward Compatibility**:
- ✅ Existing `Evaluation` and `Result` tables unchanged
- ✅ Historical data preserved during migration
- ✅ API can support both old and new formats during transition

**Next Steps**:
→ Generate API contracts in `contracts/` directory
