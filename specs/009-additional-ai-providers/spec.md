## Summary

Expand the AI model evaluation framework to support additional AI providers beyond the current OpenAI, Anthropic, and Google AI offerings. This will enable users to evaluate models from Open Router, and local LLM deployments via LM Studio and Ollama.

## Motivation

Currently, the application is limited to three specific AI providers. To provide comprehensive model evaluation capabilities, we need to support:

- Access to multiple models through Open Router's unified API
- Privacy-focused local deployments via LM Studio and Ollama

## Requirements

### 1. Provider Abstraction Layer

- Create a flexible backend abstraction that can connect to different AI provider APIs
- Ensure the abstraction supports varying authentication methods, request/response formats, and capabilities
- Maintain compatibility with existing evaluator logic in `src/lib/evaluation/evaluator.ts`

### 2. Provider-Level Configuration

- **API keys should be configured per provider, not per model**
- Update database schema to support provider configurations with multiple models
- One provider can have multiple model options available

### 3. New Provider Support

#### Open Router

- Integrate with Open Router's unified API (https://openrouter.ai)
- Support their model routing capabilities
- Handle Open Router-specific metadata and pricing

#### Local LLM Support

- **LM Studio**: Support local models served via LM Studio's OpenAI-compatible API
- **Ollama**: Support local models via Ollama's REST API
- Allow configuration of local endpoints (e.g., http://localhost:1234, http://localhost:11434)

### 4. Authentication Methods

Support multiple authentication strategies:

- **API Key**: For OpenAI, Anthropic, Google AI, Open Router
- **No Auth**: For local deployments (LM Studio, Ollama)

### 5. Database Schema Updates

Update `db/schema.sql` to support:

- Provider-level configuration (separate from models)
- Multiple authentication types per provider
- Provider-to-model relationships (one-to-many)

## Acceptance Criteria

- [ ] Backend abstraction layer supports pluggable provider implementations
- [ ] Database schema updated to support provider-level API key configuration
- [ ] Open Router integration with API key authentication
- [ ] LM Studio integration with local endpoint configuration
- [ ] Ollama integration with local endpoint configuration
- [ ] UI updated to manage provider configurations and credentials
- [ ] Existing OpenAI, Anthropic, and Google AI integrations remain functional
- [ ] Documentation updated with setup instructions for each provider
- [ ] Tests cover new provider integrations

## Technical Considerations

- Update `src/lib/utils/api-clients.ts` to support provider abstraction
- Consider a factory pattern or strategy pattern for provider implementations
- Handle different response formats and streaming capabilities per provider
- Ensure timeout and concurrency logic works across all providers
- Update `ModelConfiguration` table to reference provider configurations
