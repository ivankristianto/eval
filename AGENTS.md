# eval-ai-models Agent Guide

Auto-generated from CLAUDE.md and GEMINI.md. Last updated: 2025-12-27.

## Agent Initialization

**Before any task, read the constitution.**

```
1. Read `docs/constitution.md` — understand principles and fences
2. Read task context (spec, plan, or issue)
3. Then execute
```

Agents must internalize:

- **Implementation order**: UI → Service → API → CLI → Seeder
- **Quality gates**: Which block, which don't
- **Refactor checklist**: Apply each loop, not at the end

**If constitution conflicts with task instructions, constitution wins.**

## Project Overview

`eval-ai-models` is an AI Model Evaluation Framework designed to compare and
evaluate multiple AI models (OpenAI, Anthropic, Google) against specific
instructions and rubrics. It provides metrics for accuracy scoring, execution
time, and token usage.

## Tech Stack

- Runtime: Node.js >= 22.0.0
- Language: TypeScript 5.6+
- Framework: Astro 5.x (SSR with Node adapter)
- Styling: Tailwind CSS 4.x, daisyui (v5 beta/latest compatible with TW v4)
- Database: SQLite via better-sqlite3
- SDKs: OpenAI SDK, Anthropic SDK, Google Generative AI SDK
- Testing: Vitest (unit/integration), Playwright (E2E)

## Architecture

- Astro project with server-side API endpoints and a database-driven backend.
- Database schema in `db/schema.sql` with tables:
  - `ModelConfiguration`, `EvaluationTemplate`, `Evaluation`, `Result`
- Core logic in `src/lib/`:
  - `evaluator.ts`: orchestration, concurrency, timeouts, aggregation
  - `api-clients.ts`: provider abstraction
  - `accuracy.ts`: rubric scoring
  - `db.ts`: database access layer
- API routes in `src/pages/api/`
- Theme persistence uses localStorage; application data stored in SQLite.

## Project Structure

```text
openapi.yml
src/
tests/
db/
```

## Commands

```bash
npm run dev
npm run build
npm run preview
npm run db:init
npm run db:reset
npm test
npm run test:e2e
npm run lint
npm run lint:fix
npm run format
npm run format:check
npm run typecheck
```

## Pre-Commit Quality Gates

### Automated Hooks (Local)

This project uses **simple-git-hooks** and **lint-staged** to enforce quality gates automatically:

- **Pre-commit**: Runs lint-staged on staged files (*.ts, *.tsx, *.astro, *.js, *.jsx)
  - ESLint with auto-fix
  - Prettier formatting
  - Note: Typecheck is intentionally excluded from pre-commit for faster incremental development
- **Pre-push**: Runs full test suite (optional, can be skipped with `--no-verify`)

### Manual Quality Gate Runs

For manual verification before commits:

```bash
npm run lint         # ESLint check
npm run typecheck    # TypeScript strict mode check + Astro component check (run before PR)
npm run format       # Prettier auto-format
npm test             # Run full test suite
```

### Hook Setup

Hooks are installed automatically via `npm install` (runs `simple-git-hooks` in postinstall).

To reinstall hooks manually:

```bash
npm run prepare  # Sets up git hooks via simple-git-hooks
```

Or use the direct command:

```bash
npx simple-git-hooks  # Install git hooks from package.json config
```

### CI Quality Gates

GitHub Actions runs the following checks on every PR and push to main:

- **Lint**: Full ESLint check on src/ and tests/
- **Type Check**: TypeScript strict mode + Astro component check
- **Test**: Full test suite with test database
- **Format**: Prettier format check

All CI checks must pass before merging. Configure branch protection rules to require these status checks.

## Testing Status

Latest coverage (vitest `npm test -- --coverage`):

- Overall line coverage: 9.24% (all files), 37.99% (evaluation module)
- Critical path coverage (verified 2026-01-10 per eval-z5f):
  - validators.ts: 86.01% lines (84.17% stmts, 82.42% branch, 95% funcs) ✅ >80%
  - accuracy.ts: 92.85% lines (91.11% stmts, 80.76% branch, 100% funcs) ✅ >80%
  - evaluator.ts: 93.05% lines (91.02% stmts, 70.58% branch, 93.75% funcs) ✅ >80%
- Other coverage: api-clients.ts 64.38%, db.ts 62.62%
- Constitution Principle III (line 48) SATISFIED: All critical paths >80% coverage
- Coverage verification ticket: eval-z5f

## Development Conventions

- Type safety: strict TypeScript usage is enforced.
- Database: use better-sqlite3 with helpers in `src/lib/db.ts`.
- Environment: configuration via `.env` (see `.env.example`).
- Tests: unit/integration in `tests/unit` or `tests/integration`; E2E in
  `tests/e2e`.
- Structure:
  - `src/pages`: Astro pages and API routes.
  - `src/lib`: core business logic and utilities.
  - `src/components`: UI components.
  - `db`: database initialization and schema.

## Code Style

- Linter: ESLint 9 with flat config (`eslint.config.js`)
- Formatter: Prettier with Astro plugin (`.prettierrc`)
- Plugins: eslint-plugin-astro, @typescript-eslint, eslint-plugin-jsdoc

### Style Rules

- Semicolons: required
- Quotes: double quotes
- Indentation: 2 spaces
- Trailing commas: ES5 style
- Line width: 100 characters
- Unused variables: warn (prefix with `_` to ignore)
- Explicit `any`: warn
- JSDoc: required (warn) for public functions, methods, classes, and arrow functions

## Styling Conventions

**TOP PRIORITY**: Always use Tailwind CSS v4 utility classes for styling.

- Use Tailwind v4 syntax and features (e.g., `@theme` directive, CSS variables)
- Leverage daisyUI component classes when appropriate
- Only fall back to custom CSS when Tailwind utilities cannot achieve the desired result
- When custom CSS is necessary, document why Tailwind was insufficient

## Development Workflow

**ALWAYS FOLLOW THIS IMPLEMENTATION WORKFLOW**

1. **Find work:** Run `bd ready` to find unblocked tasks
2. **Claim:** Run `bd update <id> --status in_progress` for each task
3. **Branch:** `git checkout -b feature/<descriptive-name>`
4. **Implement:** For each task:
   - Write code following component guidelines and design tokens
   - Run `npm run typecheck && npm run lint && npm run format:fix`
   - Commit with clear message: `git commit -m "feat: descriptive message"`
   - Push: `git push`
5. **PR:** Create Pull Request following the GitHub PR template
6. **Review:** Invoke **code-review-specialist** agent to review (comments only, no code changes)
7. **Complete:** After merge:
   - Run `bd close <id>` for each completed task
   - Run `bd sync`
8. **Report:** Provide summary with PR link, tasks completed, review status, and any recommendations

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**

- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds

<!-- bv-agent-instructions-v1 -->

---

## Beads Workflow Integration

This project uses [beads_viewer](https://github.com/Dicklesworthstone/beads_viewer) for issue tracking. Issues are stored in `.beads/` and tracked in git.

### Essential Commands

```bash
# View issues (launches TUI - avoid in automated sessions)
bv

# CLI commands for agents (use these instead)
bd ready              # Show issues ready to work (no blockers)
bd list --status=open # All open issues
bd show <id>          # Full issue details with dependencies
bd create --title="..." --type=task --priority=2
bd update <id> --status=in_progress
bd close <id> --reason="Completed"
bd close <id1> <id2>  # Close multiple issues at once
bd sync               # Commit and push changes
```

### Key Concepts

- **Dependencies**: Issues can block other issues. `bd ready` shows only unblocked work.
- **Priority**: P0=critical, P1=high, P2=medium, P3=low, P4=backlog (use numbers, not words)
- **Types**: task, bug, feature, epic, question, docs
- **Blocking**: `bd dep add <issue> <depends-on>` to add dependencies

### Session Protocol

**Before ending any session, run this checklist:**

```bash
git status              # Check what changed
git add <files>         # Stage code changes
bd sync                 # Commit beads changes
git commit -m "..."     # Commit code
bd sync                 # Commit any new beads changes
git push                # Push to remote
```

### Best Practices

- Check `bd ready` at session start to find available work
- Update status as you work (in_progress → closed)
- Create new issues with `bd create` when you discover tasks
- Use descriptive titles and set appropriate priority/type
- Always `bd sync` before ending session

<!-- end-bv-agent-instructions -->
