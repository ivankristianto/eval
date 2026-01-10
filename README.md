# AI Model Evaluation Framework

A powerful, local-first framework designed to compare, evaluate, and train AI models (OpenAI, Anthropic, Google). Measure accuracy, latency, and token usage while refining model behavior through advanced judge personas and iterative training loops.

## 🚀 Features

- **Multi-Model Evaluation**: Run instructions against GPT-4, Claude 3, and Gemini 2.0 simultaneously.
- **LLM-as-a-Judge**: Specialized iterative training system for judge personas.
  - **Iterative Training**: Refine judge prompts based on human feedback until convergence (F1 ≥ 0.80).
  - **Metrics**: Automated calculation of F1 Score, Precision, Recall, and Cohen's Kappa.
  - **Human-in-the-Loop**: Mandatory human review for early iterations to ground AI judgment.
- **Advanced Configuration**: Full control over System Prompts and Temperature (0.0 - 2.0).
- **Accuracy Rubrics**:
  - **Exact Match**: String-level identity check.
  - **Partial Credit**: Keyword/concept detection.
  - **Semantic Similarity**: LLM-based meaning alignment.
- **Data Management**:
  - **Templates**: Save and rerun benchmarks easily.
  - **Bulk Actions**: Batch delete and advanced filtering (Date, Rubric, Score).
  - **CSV Support**: Upload training pairs for judge training.
- **Modern Developer Experience**:
  - **Astro 5 SSR**: High-performance server-side rendering.
  - **Tailwind CSS 4 & DaisyUI 5**: Beautiful, themeable interface (Silk, Luxury, Cupcake, Nord).
  - **SQLite (better-sqlite3)**: Fast, ACID-compliant local persistence with encrypted API keys.

## 📂 Project Structure

```text
├── .storybook/          # Component documentation and isolated testing
├── db/                  # Database management
│   ├── migrations/      # SQL schema versioning
│   ├── init.js          # DB initialization logic
│   └── schema.sql       # Core schema (9+ tables for evaluations & training)
├── public/              # Static assets
├── specs/               # Detailed feature specifications and design docs
├── src/                 # Application Source
│   ├── components/      # UI Components
│   │   ├── layout/      # Navbar, ThemeController, Breadcrumbs
│   │   ├── ui/          # Atom components (Button, Input, Badge, Card)
│   │   └── [Feature].astro # Specialized components (MetricCard, ConfusionMatrix)
│   ├── lib/             # Business Logic
│   │   ├── db/          # Database access layer (persona-db.ts, etc.)
│   │   ├── evaluation/  # Evaluator orchestration and API clients
│   │   ├── training/    # LLM-as-Judge training loop and prompt engineering
│   │   ├── validation/  # Zod/Manual validation schemas
│   │   └── utils/       # Encryption, formatting, and metrics helpers
│   ├── pages/           # Astro routes & API endpoints
│   │   ├── api/         # REST API implementation
│   │   ├── evaluations/ # Result details
│   │   └── personas/    # Judge training workflows
│   └── styles/          # Tailwind CSS 4 configuration and global styles
├── tests/               # Comprehensive Test Suite
│   ├── unit/            # Logic & Metrics testing (Vitest)
│   ├── integration/     # API & DB flow testing (Vitest)
│   └── e2e/             # Workflow testing (Playwright)
├── openapi.yml          # Full REST API Specification
└── astro.config.mjs     # Astro & Vite configuration
```

## 🛠️ Quick Start

### Prerequisites

- **Node.js**: v22.0.0 or higher
- **npm**: v10.0.0 or higher
- **API Keys**: OpenAI, Anthropic, or Google Gemini

### Installation

1. **Clone and Install**

   ```bash
   git clone <repository-url>
   cd eval-ai-models
   npm install
   ```

2. **Environment Configuration**

   ```bash
   cp .env.example .env
   # Generate a 32-byte hex key for API key encryption
   openssl rand -hex 32 # Add this to ENCRYPTION_KEY in .env
   ```

3. **Initialize Database**

   ```bash
   npm run db:init
   ```

4. **Run Development Server**
   ```bash
   npm run dev
   ```
   The application will be available at [http://localhost:3000](http://localhost:3000).

## 📖 API Documentation

The project uses a contract-first approach. The complete REST API documentation is maintained in:
👉 **[openapi.yml](./openapi.yml)**

**Key API Modules:**

- `/api/models`: Model configuration and encryption.
- `/api/evaluate`: Core evaluation execution.
- `/api/personas`: Judge persona management and training iterations.
- `/api/templates`: Reusable benchmark configurations.

## 🧪 Testing & Quality

Strict adherence to **Constitution Principle II**: Tests are written first for all critical paths.

```bash
npm test              # Run unit and integration tests
npm run test:coverage # Verify >80% coverage on critical paths
npm run test:e2e      # Run Playwright end-to-end tests
npm run typecheck     # Verify TypeScript strict mode
```

### Quality Gates

This project uses automated quality enforcement to maintain code standards:

**Local Development** (Pre-commit Hooks):

- **Pre-commit**: Runs ESLint and Prettier on staged files (_.ts, _.tsx, \*.astro)
- **Pre-push**: Runs full test suite (optional, can be skipped with `--no-verify`)
- Hooks are installed automatically via `npm install`

**Continuous Integration** (GitHub Actions):

- Runs on every pull request and push to main
- Parallel jobs: Lint, Type Check, Test, Format Check
- All checks must pass before merging (configure branch protection rules)

**Manual Verification**:

```bash
npm run lint         # ESLint check
npm run typecheck    # TypeScript strict mode + Astro component check
npm run format:fix   # Prettier auto-format
npm test             # Run full test suite
```

To reinstall git hooks manually:

```bash
npm run prepare  # Sets up git hooks via simple-git-hooks
```

## 🎨 Development

### UI Components (Storybook)

We use Storybook for component-driven development.

```bash
npm run storybook
```

### Database Reset

To wipe the local database and start fresh:

```bash
npm run db:reset
```

## 📄 License

MIT
