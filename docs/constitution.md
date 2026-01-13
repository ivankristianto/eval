# Development Constitution v2.1.0

## I. Code Quality

Clarity over cleverness.

- **SRP**: One function = one responsibility
- **Naming**: Variables describe their purpose explicitly
- **Commits**: Document _what_ and _why_ in commit messages
- **Tech debt**: Track explicitly in backlog, don't hide it

## II. User-First Development

Build what users see and touch first.

**Implementation Order**:

1. UI with mock data (see it, play with it)
2. Service controller (consumed by API, controller, CLI)
3. API endpoint
4. CLI interface
5. Data seeder

**Why**: Working UI validates assumptions early. Mock data unblocks frontend. Services stay framework-agnostic.

## III. Fences (Quality Gates)

Automated checks run on every change. No exceptions.

| Gate   | Tool                 | Blocking |
| ------ | -------------------- | -------- |
| Types  | `npm run typecheck`  | Yes      |
| Lint   | `npm run lint`       | Yes      |
| Format | `npm run format:fix` | Yes      |
| Test   | `npm run test`       | No\*     |

\*Failed tests → create ticket, fix in separate PR. Don't block current work.

**Baseline 2025**: Use modern stable APIs only.

- ❌ `alert()` → ✅ `<dialog>`
- ❌ Legacy patterns → ✅ Platform features

**Testing Strategy**:

- Unit tests: Write first, fail first
- Integration tests: Required for user-facing features
- Coverage: >80% on critical paths
- E2E tests: Last priority (high cost, low frequency)

## IV. UX Consistency

Users build mental models. Don't break them.

- **Patterns**: Similar actions behave the same way
- **Error messages**: User-friendly, actionable, no jargon
- **Design**: Follow established visual/interactive patterns

## Design System

This project uses **Tailwind CSS v4** with **DaisyUI 5** components. All design tokens are defined in `src/styles/theme.css` using the `@theme` directive.

### Architecture

```
src/styles/
├── global.css       # Imports Tailwind, DaisyUI, and style modules
├── theme.css        # @theme directive for design tokens (colors, fonts, shadows)
├── typography.css   # Typography scale and text utilities
├── animations.css   # Reusable keyframe animations
└── components.css   # Custom component styles (cards, tables, buttons, inputs)
```

### Theme Configuration

**Tailwind v4 + DaisyUI Setup** (src/styles/global.css):

```css
@import 'tailwindcss';
@plugin "daisyui" {
  themes:
    light --default,
    dark --prefersdark,
    cupcake,
    nord,
    luxury,
    silk;
}
@import './theme.css';
```

**Note**: Tailwind v4 uses CSS-first configuration. Most theme customization is done via `@theme` in `theme.css`, not in `tailwind.config.ts`.

### Design Tokens

#### Luxe Color Palette

All color tokens are available as Tailwind utilities (e.g., `bg-luxe-midnight`, `text-luxe-gold`):

| Token | Value | Usage |
|-------|-------|-------|
| `luxe-midnight` | `#0a1628` | Deepest background, primary text (dark theme) |
| `luxe-navy` | `#1a2942` | Card backgrounds (dark theme) |
| `luxe-slate` | `#2d3f5f` | Secondary text, borders |
| `luxe-gold` | `#d4af37` | Primary accent, CTAs, highlights |
| `luxe-gold-light` | `#f0d678` | Gold hover states, lighter accents |
| `luxe-emerald` | `#00ff87` | Success states, completion indicators |
| `luxe-emerald-glow` | `rgba(0, 255, 135, 0.2)` | Success glow effects |
| `luxe-ruby` | `#ff4757` | Error states, destructive actions |
| `luxe-amber` | `#ffa502` | Warning states, pending indicators |
| `luxe-ice` | `#e8f4f8` | Light backgrounds (inverted in dark theme) |

#### Gradients

Legacy CSS variables for complex gradients (used in custom CSS):

| Token | Value |
|-------|-------|
| `--gradient-gold` | `linear-gradient(135deg, #d4af37 0%, #f0d678 100%)` |
| `--gradient-emerald` | `linear-gradient(135deg, #00ff87 0%, #00d9ff 100%)` |
| `--gradient-midnight` | `linear-gradient(135deg, #0a1628 0%, #1a2942 100%)` |
| `--gradient-mesh` | Multi-stop radial gradient for backgrounds |

#### Typography

| Token | Value | Usage |
|-------|-------|-------|
| `font-display` | `'Manrope', sans-serif` | Headings, display text |
| `font-body` | `'Manrope', sans-serif` | Body text, UI elements |
| `font-mono` | `'JetBrains Mono', monospace` | Code, metrics, tabular numbers |

**Typography Utilities** (typography.css):
- `.font-display` - Display font with weight 600, -0.02em letter-spacing
- `.font-mono` - Monospace with tabular numbers
- `.text-gradient-gold` - Animated gold gradient text
- `.text-gradient-emerald` - Animated emerald gradient text
- `.text-gold-accessible` - WCAG AA compliant gold text
- `.text-on-gold` - Dark text for use on gold backgrounds

#### Shadows

| Token | Usage |
|-------|-------|
| `shadow-soft` | Subtle elevation (cards, inputs) |
| `shadow-medium` | Medium elevation (hover states) |
| `shadow-elevated` | High elevation (modals, drawers) |
| `shadow-gold` | Gold-tinted shadow for primary elements |
| `shadow-emerald` | Emerald glow for success states |

#### Spacing Grid

Use Tailwind's default spacing scale (4px base unit):
- `p-4` = 16px, `p-6` = 24px, `p-8` = 32px
- `gap-3` = 12px, `gap-4` = 16px, `gap-6` = 24px

### Component Patterns

#### Cards

**Luxe Card** (components.css):

```css
.card-luxe
```

Features: rounded-2xl, gold border accent, elevated shadow, hover lift, gold top border on hover.

#### Tables

**Luxe Table** (components.css):

```css
.table-luxe
```

Features: Sticky header, hover states, gold bottom borders, responsive adjustments.

**Table Variants** (for specific layouts):
- `.table-evaluation` - Homepage evaluation table
- `.table-templates` - Templates table
- `.table-models` - Models table
- `.table-results` - Results table

#### Buttons

DaisyUI button classes with luxe enhancements:

```astro
<!-- Primary button with luxe styling -->
<button class="btn btn-luxe btn-luxe-primary">Click me</button>

<!-- Secondary button -->
<button class="btn btn-secondary">Cancel</button>

<!-- Outline button -->
<button class="btn btn-outline btn-primary">Outline</button>
```

**Button Component** (src/components/ui/Button.astro):

```astro
<Button variant="primary" size="md">Click me</Button>
<Button href="/path" variant="accent">Link button</Button>
```

Variants: `primary`, `secondary`, `accent`, `ghost`, `link`, `info`, `success`, `warning`, `error`, `neutral`
Sizes: `lg`, `md`, `sm`, `xs`

#### Inputs

Consistent input styling (components.css):

```css
.input, .textarea, .select
```

Features: rounded-lg, gold border on focus, soft shadow, transition-all.

**Input Component** (src/components/ui/Input.astro):

```astro
<Input type="text" placeholder="Enter text" />
<Input type="email" placeholder="Email" required />
```

#### Modals & Drawers

**Modal** (daisyui + luxe styling):

```html
<dialog class="modal">
  <div class="modal-box">
    <h3 class="font-bold text-lg">Title</h3>
    <p class="py-4">Content</p>
    <div class="modal-action">
      <button class="btn">Close</button>
    </div>
  </div>
</dialog>
```

**Drawer** (right-side slide-out):

```html
<div data-drawer class="drawer-side">
  <!-- Drawer content -->
</div>
```

#### Status Indicators

```css
.status-pending    /* Amber background */
.status-running    /* Emerald gradient with pulse */
.status-completed  /* Emerald with shadow */
.status-failed     /* Ruby background */
```

#### Badges

```astro
<!-- DaisyUI badge -->
<div class="badge badge-primary">Primary</div>
<div class="badge badge-secondary">Secondary</div>
```

### Animations

**Keyframe Animations** (animations.css):

| Class | Effect |
|-------|--------|
| `.animate-reveal` | Fade in from bottom (0.6s) |
| `.delay-100` through `.delay-500` | Staggered animation delays |
| `.metric-glow` | Pulsing glow for metrics |
| `.gradientShift` | Animated gradient position |

**Tailwind Transitions**:
- `transition-all duration-200` - Fast (buttons, inputs)
- `transition-all duration-400` - Medium (cards)

### Accessibility

**Focus States** (components.css):
```css
*:focus-visible {
  outline: 2px solid var(--color-luxe-gold);
  outline-offset: 2px;
}
```

**Theme-Aware Contrast**:
- Gold text uses accessible variant on light backgrounds
- Dark themes use inverted colors for contrast
- Nord theme has specific overrides for better visibility

### Usage Guidelines

1. **Always use Tailwind utilities first** - Only use custom CSS when Tailwind can't achieve the effect
2. **Use semantic color tokens** - `bg-luxe-gold` instead of `bg-[#d4af37]`
3. **Leverage DaisyUI components** - Don't reinvent buttons, modals, inputs
4. **Follow existing component patterns** - Check `src/components/ui/` for examples
5. **Test across themes** - Verify in light, dark, luxury, nord themes
6. **Maintain WCAG AA contrast** - Use `.text-gold-accessible` for gold text on light backgrounds
7. **Consistent spacing** - Use the 4px base unit (Tailwind default)
8. **Responsive design** - Mobile-first with Tailwind breakpoints (`sm:`, `md:`, `lg:`, `xl:`)

### Adding New Styles

**When to add to theme.css**:
- New design tokens (colors, fonts, shadows)
- Theme-specific overrides

**When to add to components.css**:
- New component patterns
- Consistent styling for reusable elements

**When to add to typography.css**:
- New text utilities
- Font variants

**When to add to animations.css**:
- New keyframe animations

**When to use inline Tailwind**:
- One-off styles
- Component-specific variants
- Responsive utilities

## V. Performance

Performance is a feature, not an afterthought.

- **Targets upfront**: Define before implementation (e.g., <200ms p95)
- **Profile hot paths**: Measure, don't guess
- **Justify tradeoffs**: Document if trading perf for convenience

## VI. Continuous Refactoring

Refactor each loop, not at the end.

**Refactor Checklist** (priority order):

1. **Maintainability** - Can another dev understand this?
2. **Security** - Inputs validated? Auth checked?
3. **Performance** - Hot paths profiled?
4. **Consistency** - Follows existing patterns?
5. **Abstraction** - Right level? Not premature?

**PR Requirements**:

- Follow PR template
- Reference which principles this PR satisfies
- Run code-review-specialist agent
- Agent comments only (no direct changes)

## Governance

**Amendments**: Propose → Document impact → Version bump → Update templates

**Version Scheme**:

- MAJOR: Breaking changes to principles
- MINOR: New principles/guidance
- PATCH: Clarifications

**Conflicts**: Constitution wins. Justify exceptions in PR.

---

v2.1.0 | Ratified: 2025-01-13
