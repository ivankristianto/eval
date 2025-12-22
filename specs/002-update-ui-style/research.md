# Research: Update UI with DaisyUI

## Decision: DaisyUI v5 with Tailwind CSS v4

### Rationale
Tailwind CSS v4 introduces a CSS-first approach where plugins are imported via `@plugin` in the CSS file. DaisyUI v5 is fully compatible with this model and provides a modern design system with minimal JavaScript overhead.

### Integration Details
- **Installation**: `npm install daisyui@latest` (v5 is the latest stable/near-stable major version).
- **Configuration**: Standard `@import "tailwindcss"; @plugin "daisyui";` in `global.css`.
- **Astro Compatibility**: No special adapter needed; Astro's Vite-based build handles Tailwind v4 plugins natively.

---

## Decision: Theme Management Strategy

### Rationale
To prevent "Flash of Unstyled Content" (FOUC), the theme must be applied before the initial render. 

### Implementation
- **Script**: An inline `<script>` in the `<head>` of `Layout.astro`.
- **Logic**: Check `localStorage`, fallback to `prefers-color-scheme`.
- **Component**: A dedicated `ThemeController.astro` with a toggle that updates both the `data-theme` attribute and `localStorage`.

---

## Decision: Routing Migration & Information Architecture

### Rationale
The current structure splits history and evaluation results in an inconsistent way. Merging history into the homepage and creating dedicated evaluation pages follows common SaaS patterns and improves usability.

### Changes
1. **Homepage (`/`)**: Display a list of all evaluations (formerly `/history`).
2. **Evaluation Detail (`/evaluations/[id]`)**: Dedicated page for viewing results (formerly handled by query params on `/`).
3. **Primary Action**: Move "New Evaluation" from the sticky navbar to the page header of the homepage to emphasize it as the primary dashboard action.

---

## Alternatives Considered

### 1. Retention of Sidebar
- **Evaluated**: Using a sidebar for primary navigation instead of a top navbar.
- **Rejected**: User explicitly requested a layout matching a screenshot that uses a top navbar. Top navbar provides more horizontal space for complex evaluation results tables.

### 2. Immediate Redirect vs. Modal
- **Evaluated**: Redirecting to `/evaluations/new` instead of using a modal.
- **Rejected**: A modal allows users to quickly trigger an evaluation without losing context of their previous results or history.

### 3. Server-Side Theme Persistence
- **Evaluated**: Using cookies and server-side logic to set the `data-theme` attribute.
- **Rejected**: `localStorage` is simpler for a client-heavy UI and works well with standard Astro SSR patterns without requiring session management or complex cookie handling.