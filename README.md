# AI Model Evaluation Framework

A powerful, local-first framework designed to compare, evaluate, and train AI models (OpenAI, Anthropic, Google, Open Router, LM Studio, Ollama). Measure accuracy, latency, and token usage while refining model behavior through advanced judge personas and iterative training loops.

## 🚀 Features

- **Multi-Model Evaluation**: Run instructions against GPT-4, Claude 3, Gemini 2.0, Open Router, LM Studio, and Ollama simultaneously.
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
- **API Keys**: OpenAI, Anthropic, Google Gemini, or Open Router (for cloud providers)
- **Local LLM**: LM Studio or Ollama (for local evaluation, optional)

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

## 🤖 Supported AI Providers

The framework supports multiple AI providers through a unified evaluation interface:

### Cloud Providers

| Provider        | Models                     | API Key Format | Notes                        |
| --------------- | -------------------------- | -------------- | ---------------------------- |
| **OpenAI**      | GPT-4, GPT-4o, o1, o3      | `sk-...`       | Requires API key             |
| **Anthropic**   | Claude 3 Opus/Sonnet/Haiku | `sk-ant-...`   | Requires API key             |
| **Google**      | Gemini 1.5/2.0 Pro         | `AIza...`      | Requires API key (39+ chars) |
| **Open Router** | Multi-provider access      | `sk-or-...`    | Requires API key             |

### Local Providers

| Provider      | Models                            | Auth | Default Endpoint           | Notes               |
| ------------- | --------------------------------- | ---- | -------------------------- | ------------------- |
| **LM Studio** | Local LLMs (Llama, Mistral, etc.) | None | `http://localhost:1234/v1` | No API key required |
| **Ollama**    | Local LLMs (Llama, Mistral, etc.) | None | `http://localhost:11434`   | No API key required |

### Adding a Model

1. Navigate to **Models** page
2. Click **Add Model**
3. Select **Provider** from dropdown
4. Enter **Model Name** (must match provider's model identifier)
5. For cloud providers: Enter **API Key**
6. For local providers: Optionally configure **Base URL** (uses default if omitted)
7. Click **Test** to verify connection
8. Click **Add Model** to save

### Provider-Specific Notes

**Open Router**: Access multiple AI models through a single API. Visit [openrouter.ai](https://openrouter.ai) to get your API key and browse available models.

**LM Studio**: Download from [lmstudio.ai](https://lmstudio.ai), start the server, and load your preferred model.

**Ollama**: Install from [ollama.com](https://ollama.com), start the server with `ollama serve`, and pull models with `ollama pull <model-name>`.

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

- **Pre-commit**: Runs ESLint and Prettier on staged files (_.ts, _.tsx, _.astro, _.js, \*.jsx)
  - Typecheck is intentionally excluded from pre-commit for faster incremental development
  - Run typecheck manually before creating PRs
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
npm run format       # Prettier auto-format
npm test             # Run full test suite
```

To reinstall git hooks manually:

```bash
npm run prepare  # Sets up git hooks via simple-git-hooks
```

Or use the direct command:

```bash
npx simple-git-hooks  # Install git hooks from package.json config
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
