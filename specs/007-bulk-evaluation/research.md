# Research: Bulk Evaluation

**Feature**: Bulk Evaluation (007-bulk-evaluation)
**Date**: 2025-12-28

## Decisions

### 1. CSV Parsing Library
- **Decision**: Use `papaparse` (with `@types/papaparse`).
- **Rationale**: 
  - Robust, handles edge cases (quotes, newlines) well.
  - Works in both browser and Node.js (versatile if we move parsing to client later).
  - Strong TypeScript support.
- **Alternatives Considered**: 
  - `csv-parse`: Good, strictly Node.js, stream-based. `papaparse` is simpler for our "load entire file" requirement (<1000 rows).

### 2. Templating Library
- **Decision**: Use `mustache` (with `@types/mustache`).
- **Rationale**:
  - Logic-less, safe, and standard.
  - Matches the "Mustache Templating" requirement in spec explicitly.
  - Lightweight.
- **Alternatives Considered**:
  - `handlebars`: More powerful but heavier. Overkill for simple string interpolation.
  - Template literals: Security risk (eval) or requires custom parser.

### 3. Real-Time Updates Strategy
- **Decision**: Short Polling (interval: 1-2 seconds).
- **Rationale**:
  - **Simplicity**: Stateless, easy to implement in Astro SSR endpoints.
  - **Reliability**: No issues with dropped connections or firewall/proxy timeouts common with SSE/WebSockets.
  - **Scale**: For V1 single-user/low-concurrency usage, server load is negligible.
- **Alternatives Considered**:
  - **Server-Sent Events (SSE)**: Better for latency, but requires connection management and can be tricky with some serverless/proxy setups (though less concern here on Node adapter, polling is still safer MVP).
  - **WebSockets**: Overkill complexity.

## Unknowns Resolved

- **CSV Library**: `papaparse` selected.
- **Templating**: `mustache` selected.
- **Real-time**: Polling selected.
