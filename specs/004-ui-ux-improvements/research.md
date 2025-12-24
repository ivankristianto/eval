# Research: UI/UX Improvements

**Feature**: UI/UX Improvements
**Date**: 2025-12-23

## Decisions

### 1. Database Filtering Logic

**Decision**: Implement dynamic SQL query construction in `getEvaluations` (renamed or extended) to support optional filters.

**Rationale**:
- `better-sqlite3` allows safe parameter binding.
- Filtering by "Date Range" is simple string comparison on `created_at`.
- Filtering by "Rubric Name" matches `accuracy_rubric` column.
- Filtering by "Accuracy Score" requires a LEFT JOIN on `Result` table to calculate average/max score per evaluation.
    - *Strategy*: `SELECT e.*, AVG(r.accuracy_score) as avg_score FROM Evaluation e LEFT JOIN Result r ON e.id = r.evaluation_id GROUP BY e.id HAVING ...`
    - *Correction*: `HAVING` works for aggregates. This effectively filters the list.

**Alternatives Considered**:
- In-memory filtering: Fetch all 1000 records and filter in JS. *Rejected*: Poor performance for large datasets (violates SC-001).

### 2. DaisyUI Themes in Tailwind v4

**Decision**: Configure themes via `astro.config.mjs` or CSS variables if possible, but standard v4 way is usually CSS configuration or a config file if the plugin supports it.
- *Correction*: `daisyui` v5 beta works with Tailwind v4. The `@plugin "daisyui"` directive in CSS is the way.
- Configuration for themes in v4 is often done by including the themes in the CSS or via a separate config if supported.
- *Fallback*: If v4 plugin config is tricky without a JS config file, we can revert to creating `tailwind.config.js` just for this, or check if `tailwindcss()` vite plugin accepts config.
- *Chosen Approach*: Create/Update `src/styles/global.css` to include specific themes if the plugin allows, or use the default "all themes" behavior (often default) and just switch `data-theme` on `<html>`.

### 3. Typography Scale

**Decision**: Use standard Tailwind utilities (`text-4xl`, `text-lg`, etc.) enforced by reusable UI components or global CSS utility classes for headings.
- Install `@tailwindcss/typography` for rich text content (e.g., `instruction_text`, `response_text`).
- For UI elements (tables, buttons), strict adherence to DaisyUI component styles ensures consistency.

**Rationale**: `prose` is excellent for user-generated/long-form content. UI components should rely on the component library (DaisyUI) which already has a typography system.

## Action Items

1.  Install `@tailwindcss/typography`.
2.  Update `src/lib/db.ts` to support complex filtering query.
3.  Refactor `getEvaluations` to accept a `filters` object.
4.  Implement `deleteEvaluations(ids: string[])`.
