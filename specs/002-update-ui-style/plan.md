# Implementation Plan - Update UI with DaisyUI

**Feature**: Update UI with DaisyUI
**Status**: Draft
**Phase**: 0
**Branch**: `002-update-ui-style`

## Technical Context

| Component | Technology | Current Status | Notes |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | Astro (SSR) | Active | Using Node.js adapter for server-side rendering. |
| **Styling Engine** | Tailwind CSS v4.0.0 | Active | Needs configuration for DaisyUI v5 (beta) compatibility. |
| **UI Library** | DaisyUI v5 (Beta) | Missing | NEEDS CLARIFICATION: Best integration method for Tailwind v4 + Astro. |
| **Routing** | Astro Pages | Active | Needs restructuring (move `index.astro` logic to new `history` logic, `models.astro`, etc.). |
| **State Management** | LocalStorage | Partial | Used for theme persistence; need robust implementation. |
| **Icons** | SVG / Heroicons | Active | Maintain consistency or switch to a unified icon set. |
| **Build Tool** | Vite (via Astro) | Active | Ensure DaisyUI plugin plays well with Vite build. |

## Constitution Check

| Principle | Compliant? | Justification |
| :--- | :--- | :--- |
| **I. Code Quality** | YES | Will use component-based architecture (Astro components) to ensure SRP and maintainability. |
| **II. Testing Discipline** | YES | E2E tests (Playwright) will be updated/created FIRST to fail against new UI structure before implementation. |
| **III. UX Consistency** | YES | DaisyUI provides a consistent design system; Layout component ensures global consistency. |
| **IV. Performance** | YES | DaisyUI is CSS-only (mostly), minimizing JS bundle size; Astro SSR keeps initial load fast. |

## Complexity Tracking

| Complexity Area | Risk Level | Mitigation Strategy |
| :--- | :--- | :--- |
| **Tailwind v4 + DaisyUI v5** | Medium | Research compatibility and exact configuration steps for this beta combination. |
| **Routing Restructure** | Medium | Careful migration of `index.astro` to History view; preserving data loading logic. |
| **Theme Persistence** | Low | Simple JS script in `<head>` to prevent FOUC (Flash of Unstyled Content). |

## Phase 0: Discovery & Research

### 1. Unknowns & Clarifications

- **DaisyUI v5 + Tailwind v4**: Need to verify the correct installation and configuration process since both are relatively new/beta.
- **Theme Switching**: Best practice for Astro SSR + DaisyUI theme switching to avoid FOUC.
- **Routing Migration**: Strategy for moving `/history` to `/` and handling the dedicated `/evaluations/[id]` route.

### 2. Research Plan

- **Task**: Research DaisyUI v5 installation with Tailwind v4 in an Astro project.
- **Task**: Research "theme change" best practices for Astro SSR (handling `localStorage` vs cookie for FOUC prevention).
- **Task**: Prototype the new routing structure (file moves) and ensure `getStaticPaths` or SSR modes are correctly set.

## Phase 1: Detailed Design

### 1. Data Model Changes

- **No schema changes** anticipated for SQLite.
- **Frontend State**:
  - `theme`: String (persisted in localStorage).
  - `evaluationData`: Passed to client via `define:vars` (existing pattern).

### 2. API Contracts

- **Existing Endpoints**:
  - `/api/models` (GET, POST, PATCH, DELETE) - Keep, update return types if needed for UI.
  - `/api/templates` (GET, POST, DELETE) - Keep.
  - `/api/evaluate` (POST) - Keep.
  - `/api/evaluation-status` (GET) - Keep.
  - `/api/results` (GET) - Keep.
- **New/Modified**:
  - `GET /evaluations/[id]`: New page route (SSR) fetching specific evaluation details.

### 3. Component Architecture

- **Layout.astro**: Update with DaisyUI Navbar, Sidebar (if needed for mobile), Footer.
- **ThemeController.astro**: New component for theme switching.
- **Card.astro**: Refactor to use DaisyUI `card` classes.
- **Button.astro**: Refactor to use DaisyUI `btn` classes.
- **Table.astro**: Create/Refactor for consistent list views.
- **StatusBadge.astro**: Component for consistent status coloring.
- **NewEvaluationModal.astro**: Update to use `<dialog>` with DaisyUI styles.

## Phase 2: Implementation Steps (Draft)

1.  **Setup & Config**: Install DaisyUI, configure Tailwind.
2.  **Theme Infrastructure**: Implement `ThemeController` and no-FOUC script.
3.  **Layout Migration**: Update `Layout.astro` and `Navbar.astro`.
4.  **Route Restructure**: Move `index.astro` -> `history.astro` (archive/ref), create new `index.astro` (History view), create `/evaluations/[id].astro`.
5.  **Component Refactor**: Update core UI components (Button, Card, Input) to DaisyUI.
6.  **Page Polish**: Apply new components to Models, Templates, and new Evaluation pages.
7.  **Testing**: Fix E2E tests to match new selectors and flows.

---