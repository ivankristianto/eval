# Feature Specification: Multi-Provider AI Model Support

**Feature Branch**: `005-multi-provider-support`
**Created**: 2025-12-24
**Status**: Draft
**Input**: User description: "Support additional AI providers: Vertex AI, Open Router, and local LLMs"

## Clarifications

### Session 2025-12-24

- Q: For provider credentials (API keys, OAuth tokens) stored in the database, what level of encryption security is required? → A: Database encryption with application-managed keys (encrypted at rest, keys managed by application configuration)
- Q: When a provider's API fails or is unreachable during a multi-provider evaluation run, what should happen? → A: Mark as failed, continue with remaining providers (collect partial results, report failures clearly)
- Q: When a user initiates the OAuth authentication flow for Vertex AI but cancels or closes the browser before completing it, what should happen to the provider configuration? → A: Discard partial data, return to configuration screen (user must restart OAuth flow from beginning)
- Q: When a provider returns a rate limit error during evaluation, how should the system respond? → A: Fail immediately, mark evaluation as failed (no retry, user sees rate limit error)
- Q: When OAuth tokens expire during a long-running multi-provider evaluation batch, what should happen? → A: Fail that provider immediately, continue with others (treat like API failure, lose that provider's results)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Enterprise Evaluation with Google Vertex AI (Priority: P1)

As an enterprise user with existing Google Cloud infrastructure, I need to evaluate AI models hosted on Google Vertex AI alongside other providers so that I can make informed decisions about model selection without changing my existing security and compliance setup.

**Why this priority**: Enables enterprise adoption by supporting existing cloud infrastructure investments. Many organizations have compliance requirements that restrict them to specific cloud providers, making Vertex AI support essential for their participation.

**Independent Test**: Can be fully tested by configuring a Vertex AI provider with OAuth credentials, creating a model configuration for a Vertex AI model (e.g., Gemini), running an evaluation, and verifying results are recorded with proper authentication.

**Acceptance Scenarios**:

1. **Given** I have valid Google Cloud credentials, **When** I configure Vertex AI as a provider with OAuth authentication, **Then** the system authenticates successfully and displays available Vertex AI models
2. **Given** Vertex AI is configured, **When** I run an evaluation using a Gemini model from Vertex AI, **Then** the evaluation completes successfully and results are recorded with accurate timing and token usage
3. **Given** my OAuth token expires, **When** I attempt to run an evaluation, **Then** the system prompts me to re-authenticate without losing my configuration
4. **Given** I start the OAuth authentication flow for Vertex AI, **When** I cancel or close the browser before completing authentication, **Then** the system discards any partial configuration data and returns me to the provider configuration screen to restart
5. **Given** I run a multi-provider evaluation including Vertex AI and the OAuth token expires mid-evaluation, **When** the system detects the token expiry, **Then** the Vertex AI evaluation fails immediately, other providers continue evaluating, and I receive partial results with Vertex AI marked as failed due to token expiry

---

### User Story 2 - Access Multiple Models via Open Router (Priority: P1)

As a researcher comparing many different AI models, I need to access multiple model providers through Open Router's unified API so that I can evaluate models from various sources without managing separate API keys for each provider.

**Why this priority**: Open Router provides access to dozens of models through a single API key, significantly reducing configuration complexity and enabling broader model comparison. This directly supports the core value proposition of the evaluation framework.

**Independent Test**: Can be fully tested by configuring Open Router as a provider with an API key, selecting any Open Router-available model (e.g., GPT-4, Claude, Llama), running an evaluation, and verifying that model routing and response handling work correctly.

**Acceptance Scenarios**:

1. **Given** I have an Open Router API key, **When** I configure Open Router as a provider, **Then** the system displays all available models from Open Router's catalog
2. **Given** Open Router is configured, **When** I run an evaluation using any Open Router model, **Then** the evaluation completes successfully with proper cost tracking and Open Router-specific metadata
3. **Given** I select a model that becomes unavailable on Open Router, **When** I run an evaluation, **Then** the system provides a clear error message indicating the model is unavailable and suggests alternatives
4. **Given** I run a multi-provider evaluation and one provider's API fails, **When** the evaluation completes, **Then** I receive partial results showing successful provider outcomes and clear failure indicators for the unavailable provider
5. **Given** I run an evaluation and a provider returns a rate limit error, **When** the system encounters the rate limit, **Then** the evaluation for that provider fails immediately with a clear rate limit error message without retry attempts

---

### User Story 3 - Privacy-Focused Local Evaluation with LM Studio (Priority: P2)

As a user with privacy concerns or proprietary data, I need to evaluate locally-hosted AI models via LM Studio so that my evaluation data never leaves my local environment.

**Why this priority**: Critical for users with strict data privacy requirements, but lower priority than cloud providers since it serves a smaller, specialized audience. However, it's essential for demonstrating comprehensive provider support.

**Independent Test**: Can be fully tested by starting LM Studio locally, configuring the local endpoint (e.g., http://localhost:1234), selecting a locally-available model, running an evaluation, and verifying results without any external network calls.

**Acceptance Scenarios**:

1. **Given** LM Studio is running locally with a model loaded, **When** I configure LM Studio as a provider with the local endpoint URL, **Then** the system connects successfully and displays the available local model
2. **Given** LM Studio is configured, **When** I run an evaluation using the local model, **Then** the evaluation completes using only local communication with no external API calls
3. **Given** LM Studio is not running, **When** I attempt to configure or use it, **Then** the system provides a clear error message about the connection failure and suggests troubleshooting steps

---

### User Story 4 - Local Model Evaluation with Ollama (Priority: P2)

As a developer experimenting with open-source models, I need to evaluate models running on Ollama so that I can compare local open-source models with commercial offerings in a consistent framework.

**Why this priority**: Supports the growing ecosystem of open-source models and local deployment, appealing to developers and researchers. Similar to LM Studio but serves a different tooling preference.

**Independent Test**: Can be fully tested by running Ollama with any model (e.g., llama2, mistral), configuring the Ollama endpoint, running an evaluation, and comparing results with other providers.

**Acceptance Scenarios**:

1. **Given** Ollama is running with at least one model installed, **When** I configure Ollama as a provider with the endpoint URL, **Then** the system lists all available Ollama models
2. **Given** Ollama is configured, **When** I run an evaluation using an Ollama model, **Then** the evaluation completes successfully with accurate response capture and timing
3. **Given** I have multiple Ollama models available, **When** I run comparative evaluations, **Then** the results clearly distinguish between different local models alongside cloud provider results

---

### User Story 5 - Seamless Provider Management (Priority: P3)

As any user of the evaluation framework, I need to manage provider configurations and credentials from a central interface so that I can easily switch between providers and update credentials without modifying database records directly.

**Why this priority**: Enhances user experience but depends on the core provider functionality being implemented first. This is a quality-of-life improvement that makes the system more accessible.

**Independent Test**: Can be fully tested by navigating to the provider configuration interface, adding a new provider, editing credentials, testing the connection, and removing a provider.

**Acceptance Scenarios**:

1. **Given** I am on the provider management page, **When** I add a new provider with credentials, **Then** the system validates the credentials and saves the configuration
2. **Given** I have multiple providers configured, **When** I update the API key for one provider, **Then** only that provider's configuration changes and existing evaluations remain unaffected
3. **Given** I delete a provider configuration, **When** I view existing evaluations that used that provider, **Then** historical results remain visible but future evaluations cannot use the deleted provider

---

### Edge Cases

- When a provider's API is down or unreachable during an evaluation, the system marks that provider's result as failed with error details, continues evaluating with remaining providers, and returns partial results showing both successful and failed provider outcomes
- When a provider returns a rate limit or quota restriction error during evaluation, the system fails immediately without retry, marks that provider's evaluation as failed, and displays the rate limit error message to the user
- When a user configures multiple providers with the same models (e.g., GPT-4 via OpenAI and via Open Router), the system allows this configuration and treats them as distinct model entries since each model is uniquely identified by the combination of provider_id and model_name, enabling users to compare the same model across different provider implementations
- When local endpoints (LM Studio/Ollama) change ports or become unavailable mid-evaluation, the system treats this as a provider API failure (per FR-012), marks that provider's results as failed with a connection error message, continues evaluating with remaining providers, and returns partial results
- When OAuth tokens expire during a long-running evaluation batch, the system fails that provider immediately (treating it as an API failure), continues evaluating with remaining providers, and returns partial results with the OAuth provider marked as failed due to token expiry
- When users cancel or close the OAuth authentication flow before completion, the system discards all partial configuration data and returns them to the configuration screen to restart the flow from the beginning
- When providers return different response formats or metadata structures, the system uses provider-specific adapters (per FR-013) to normalize responses into consistent evaluation metrics (execution time, token counts, response text) while preserving provider-specific metadata in structured fields for debugging
- When a user tries to run an evaluation with a model that requires a provider they haven't configured, the system prevents evaluation from starting and displays a clear error message instructing the user to configure the required provider first, with a direct link to the provider configuration interface

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support provider-level configuration where one provider can have multiple associated models
- **FR-002**: System MUST support multiple authentication methods: API key authentication, OAuth 2.0 authentication, and no authentication for local providers
- **FR-003**: System MUST allow users to configure Google Vertex AI with OAuth 2.0 credentials and access Vertex AI models including Gemini
- **FR-004**: System MUST allow users to configure Open Router with API key authentication and access any model available through Open Router's API
- **FR-005**: System MUST allow users to configure LM Studio with a local endpoint URL (e.g., http://localhost:1234) and no authentication
- **FR-006**: System MUST allow users to configure Ollama with a local endpoint URL (e.g., http://localhost:11434) and no authentication
- **FR-007**: System MUST maintain compatibility with existing OpenAI, Anthropic, and Google AI provider integrations
- **FR-008**: System MUST validate provider credentials during configuration and provide clear error messages for invalid credentials
- **FR-009**: System MUST allow users to test provider connectivity before saving configuration
- **FR-010**: System MUST store provider configurations separately from model configurations in the database
- **FR-010a**: System MUST encrypt all provider credentials (API keys, OAuth tokens) at rest in the database using application-managed encryption keys
- **FR-011**: System MUST handle provider-specific authentication token refresh for OAuth providers
- **FR-011a**: System MUST discard partial configuration data and return users to the configuration screen when OAuth authentication flow is cancelled or interrupted before completion
- **FR-011b**: System MUST fail the OAuth provider immediately and continue with remaining providers when OAuth tokens expire during a long-running evaluation batch, treating token expiry as an API failure
- **FR-012**: System MUST gracefully handle provider API failures during evaluation by marking the failed provider's results as failed, continuing evaluation with remaining providers, and reporting failures clearly in results with error details
- **FR-012a**: System MUST fail immediately without retry when a provider returns a rate limit error, marking the evaluation as failed and displaying the rate limit error to the user
- **FR-013**: System MUST support provider-specific request/response formats while maintaining consistent evaluation metrics
- **FR-014**: System MUST allow users to view and manage all configured providers from a central interface
- **FR-015**: System MUST prevent deletion of providers that have associated model configurations or historical evaluation results
- **FR-016**: System MUST display which models are available for each configured provider
- **FR-017**: System MUST maintain accurate timing and token usage metrics across all provider types
- **FR-018**: System MUST handle different streaming capabilities across providers while maintaining evaluation consistency

### Key Entities

- **Provider Configuration**: Represents a configured AI provider with authentication details, endpoint information, and metadata. Has a one-to-many relationship with Model Configurations. Includes provider type (OpenAI, Anthropic, Google AI, Vertex AI, Open Router, LM Studio, Ollama), authentication method (API key, OAuth, none), credentials/tokens, and endpoint URLs for local providers.

- **Authentication Profile**: Represents the authentication method and credentials for a provider. Includes authentication type, credentials encrypted at rest using application-managed encryption keys, OAuth tokens with expiration timestamps, and refresh token handling for OAuth providers.

- **Model Configuration**: Represents a specific model available through a provider. Each model belongs to exactly one provider. Updated to include a reference to its parent Provider Configuration rather than storing authentication directly.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can configure and run evaluations using any of the five new providers (Vertex AI, Open Router, LM Studio, Ollama) in addition to the existing three providers
- **SC-002**: Users can complete provider configuration including authentication in under 3 minutes
- **SC-003**: System successfully executes evaluations across all provider types with consistent result formatting and accuracy scoring
- **SC-004**: Provider credential validation provides feedback within 5 seconds
- **SC-005**: Historical evaluation results remain accessible and accurate after adding multi-provider support
- **SC-006**: Users can switch between different providers for the same evaluation template without data loss
- **SC-007**: Local provider evaluations (LM Studio, Ollama) complete without any external network requests
- **SC-008**: OAuth token refresh for Vertex AI occurs automatically without user intervention when tokens expire during normal usage
- **SC-009**: 95% of provider configuration errors provide actionable error messages that help users resolve the issue
- **SC-010**: System handles at least 10 concurrent provider configurations without performance degradation
