# Phase 0: Research & Technology Decisions

**Status**: Complete
**Date**: 2025-12-18
**Feature**: AI Model Evaluation Framework

## Research Findings

### 1. Astro Patterns for Real-Time Data Updates

**Question**: How should we handle live status updates during the evaluation process when multiple models are being queried concurrently?

**Research Summary**:
- Astro supports Server-Sent Events (SSE) natively via streaming responses
- Alternative: Client-side polling with fetch() to check status every 500ms-1s
- SSE is more efficient but requires maintaining server connection
- Polling is simpler to implement and debug with vanilla JS

**Decision**: Hybrid approach
- Use fetch polling for status updates (simpler, no persistent connection)
- Poll /api/evaluation-status?evaluation_id=xxx every 500ms during run
- Status endpoint returns current model statuses (Pending/Running/Completed/Failed)
- UI updates in real-time without external dependencies

**Rationale**:
- Polling fits minimalist architecture (no libraries needed)
- Sufficient latency for UI feedback (<500ms to see status change)
- Simpler error handling than persistent SSE connection
- Browser handles polling natively with fetch API

**Alternatives Considered**:
- WebSockets: Overkill for this use case, requires library
- SSE streaming: More efficient but harder to cancel/cleanup
- Job queue (Bull, etc.): Too complex for single-user app

---

### 2. SQLite Best Practices for Concurrent Reads/Writes

**Question**: How should we handle concurrent evaluations writing to SQLite? Can multiple models be queried in parallel safely?

**Research Summary**:
- SQLite uses file-level locking; only one writer at a time
- WAL (Write-Ahead Logging) mode allows concurrent reads while writes happen
- better-sqlite3 is synchronous but much faster than sqlite3 async library
- For single-user evaluations: each evaluation is a transaction, results batch-inserted

**Decision**: better-sqlite3 with WAL mode
- Enable WAL mode: `PRAGMA journal_mode = WAL`
- Keep connection pool size = 1 (single Astro process, no multiple workers)
- Each evaluation transaction: create evaluation record, insert all results atomically
- Parallel model queries run client-side (in Promise.all), results saved as batch

**Rationale**:
- WAL mode is production-proven for SQLite concurrency
- Single writer per evaluation (no write conflicts between separate evaluations)
- Synchronous API simplifies error handling vs async callbacks
- Sufficient for target scale (50 templates, 1000s of evaluations)

**Alternatives Considered**:
- PostgreSQL: Overkill for local single-user app; adds deployment complexity
- MongoDB: Schema-less but loses ACID guarantees needed for accuracy data
- In-memory (IndexedDB): Can't reliably sync, browser storage limits

---

### 3. Model Provider API Integration Patterns

**Question**: How do we consistently extract timing and token metrics from different AI model providers?

**Research Summary**:
- **OpenAI API**: Returns usage.prompt_tokens, usage.completion_tokens, has rate limits
- **Anthropic Claude API**: Returns usage.input_tokens, usage.output_tokens via SDK
- **Google Gemini API**: Returns usageMetadata.prompt_token_count, completion_token_count
- All return tokens in response; no need for separate token counting
- Timing: Measure wall-clock time from request start to response received

**Decision**: Provider-specific SDK clients with normalized output
- Create api-clients.ts with ClientFactory pattern
- Each provider (OpenAI, Anthropic, Google) implements same interface:
  ```typescript
  evaluate(instruction: string): Promise<{
    response: string,
    inputTokens: number,
    outputTokens: number,
    totalTokens: number,
    executionTime: number
  }>
  ```
- Measure time using `performance.now()` or `Date.now()` for server-side API calls
- Normalize across providers before storing in DB

**Rationale**:
- Each provider SDK handles authentication and rate-limiting correctly
- Centralized interface makes testing and mocking easier
- Token normalization ensures table displays consistently
- Timing measurement is framework-agnostic

**Alternatives Considered**:
- Direct HTTP calls to each API: More control but more error-prone, lose auth handling
- Proxy service: Too complex, adds latency
- Local LLM (llama.cpp): Doesn't meet requirement to test multiple cloud models

---

### 4. Accuracy Rubric Implementation Strategies

**Question**: How do we implement the three accuracy rubrics (Exact Match, Partial Credit, Semantic Similarity)?

**Research Summary**:
- **Exact Match**: Direct string comparison, trivial to implement
- **Partial Credit**: Requires defining key concepts to match; could use regex or keyword search
- **Semantic Similarity**: Need embeddings or LLM-based comparison
  - Option A: Call embedding model API (costs tokens, adds latency)
  - Option B: Use LLM to score ("Is this response semantically similar to expected? Yes/No")
  - Option C: Simple NLP library (natural.js): small, no external APIs

**Decision**: Hybrid approach, rubric-specific
1. **Exact Match**: Case-insensitive string comparison (user enters expected output)
2. **Partial Credit**: User provides list of key phrases/concepts to search for in response
   - Each concept found = 50 points (max 100)
   - Simple regex matching, no ML required
3. **Semantic Similarity**: Call Claude or GPT API to score
   - Send expected + actual response
   - Ask model to rate similarity 0-100
   - Cache scoring requests to reduce cost

**Rationale**:
- Exact/Partial don't require additional API calls
- Semantic similarity uses existing model APIs; user doesn't need separate embeddings service
- All three are implementable with minimal dependencies
- User can choose rubric based on their evaluation needs

**Alternatives Considered**:
- Universal embeddings model: Would add library (transformers, etc.) - violates minimalism
- No semantic similarity at all: Limits power-user functionality in P3
- Always call LLM for all rubrics: Too expensive, unnecessary for exact match

---

## Technology Stack Summary

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| **Web Framework** | Astro | SSR, minimal JS shipped, native API routes |
| **Styling** | Tailwind CSS | Utility-first, low overhead, minimal custom CSS |
| **Runtime** | Node.js 18+ | Native TypeScript support (tsx), async/await |
| **Language** | TypeScript | Type safety, IDE support, easier refactoring |
| **Database** | SQLite (better-sqlite3) | File-based, ACID, no server dependency, WAL mode for concurrency |
| **Testing** | Vitest + Playwright | Fast unit tests, browser automation for E2E |
| **API Clients** | Official SDKs (openai, @anthropic-ai/sdk, @google-ai/generativelanguage) | Battle-tested, auth built-in, rate limiting |
| **Accuracy Scoring** | Custom logic + model APIs | Lightweight for exact/partial, leverage existing APIs for semantic |

---

## Design Decisions Locked In

✅ **No ORM**: Direct SQL queries via better-sqlite3 (too simple for ORM overhead)
✅ **No build step for CSS**: Tailwind as-is, no CSS-in-JS library
✅ **No real-time framework**: Polling via fetch + vanilla JS (no Socket.io, Pusher, etc.)
✅ **No job queue**: Evaluations run synchronously in API request (simple & sufficient)
✅ **No authentication**: Single-user local app (no auth framework needed for MVP)
✅ **No caching layer**: SQLite queries fast enough; add Redis only if profiling shows need

---

## Outstanding Clarifications

None. All research tasks resolved; ready for Phase 1 design.
