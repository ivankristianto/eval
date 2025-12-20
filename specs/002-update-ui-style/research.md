# Research: Update UI with DaisyUI

**Date**: 2025-12-20
**Feature**: `002-update-ui-style`

## Key Decisions

### 1. DaisyUI Version

- **Decision**: Use `daisyui@latest` (v5) or the latest compatible version with Tailwind CSS 4.
- **Rationale**: The project uses Tailwind CSS v4 (from `package.json`), and DaisyUI v5 is explicitly designed for v4 compatibility. Older versions (v4) have compatibility issues.
- **Alternatives**: Downgrading Tailwind to v3 (rejected: regression).

### 2. Theme Switching

- **Decision**: Implement a custom, lightweight theme switcher using `localStorage` and `document.documentElement.setAttribute('data-theme', ...)` in a blocking script in `<head>`.
- **Rationale**:
  - `theme-change` library is good but might be overkill or have v5 compatibility nuances.
  - A simple inline script prevents FOUC (Flash of Unstyled Content) effectively in Astro's SSG/SSR environment.
  - We need to persist the choice in `localStorage`.
- **Alternatives**: `theme-change` library (kept as fallback if custom script is complex).

### 3. Visual Regression Testing

- **Decision**: Defer visual regression testing for now. Focus on component presence E2E tests with Playwright.
- **Rationale**: Setting up a robust visual regression pipeline (e.g., Percy, Chromatic, or Playwright screenshots) adds significant complexity for this initial UI overhaul. We will rely on manual verification against the "attached image" (implied design) and basic E2E checks.

## Implementation Details for DaisyUI v5

- Configuration moves to CSS variables in many cases.
- Verify `tailwind.config.mjs` (or `v4` CSS configuration) to ensure the plugin is registered correctly.
- Theme definitions might need to be in CSS:
  ```css
  @import "tailwindcss";
  @plugin "daisyui";
  ```

## Unknowns Resolved

- **DaisyUI Version**: v5 (beta/latest) for TW v4.
- **Theme Switcher**: Custom inline script > external lib for Astro.
- **Visual Testing**: Out of scope for this branch; manual + functional E2E only.
