# Tables Documentation

This document covers table patterns, sticky column strategies, and z-index layering used throughout the application.

## Table of Contents

- [Overview](#overview)
- [Z-Index Layering Strategy](#z-index-layering-strategy)
- [Sticky Column Patterns](#sticky-column-patterns)
- [Component-Specific Implementations](#component-specific-implementations)
- [Adding New Sticky Columns](#adding-new-sticky-columns)
- [Common Pitfalls](#common-pitfalls)
- [Global Z-Index Reference](#global-z-index-reference)

---

## Overview

Tables in this application support horizontal scrolling with sticky columns that remain visible while users scroll through wide datasets. This requires careful z-index management to ensure proper visual layering.

### Key Requirements

1. **Horizontal Scrolling**: Sticky columns must overlay scrolling content
2. **Vertical Scrolling**: Table headers must remain visible above body rows
3. **Zebra Striping**: Sticky columns need alternating backgrounds matching row striping
4. **Hover States**: Sticky cells must highlight with their parent row
5. **Column Stacking**: When multiple sticky columns overlap, leftmost columns overlay rightmost

---

## Z-Index Layering Strategy

### Universal Layering Hierarchy

This table defines the z-index values used across all table components:

| Layer | Z-Index | Element Type | Purpose |
|-------|---------|--------------|---------|
| 1 | 0-4 | Base content | Non-sticky scrolling content |
| 2 | 5 | Body sticky columns | Base layer for sticky data columns in tbody |
| 3 | 10 | Header sticky columns | Header cells for data columns |
| 4 | 14 | Secondary control columns | Row numbers, secondary actions |
| 5 | 15 | Primary control columns | Checkboxes, primary actions |
| 6 | 20 | Table header (thead) | Sticky header overlays all scrolling content |
| 7 | 30 | Header control cells | Header cells for control columns |
| 8 | 50 | Dropdown menus | Dropdowns overlay all table elements |
| 9 | 60-70 | Drawer overlays | Drawer backdrops and panels |
| 10 | 100 | Modal overlays | Modal backdrops and panels |

### Visual Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│ LAYER 100: Modal (when open)                                        │
├─────────────────────────────────────────────────────────────────────┤
│ LAYER 70: Drawer Panel          │ LAYER 50: Dropdown Menus         │
│                                  │                                  │
│ ┌───────────────────────────────┐ │ ┌───┐                          │
│ │ LAYER 60: Drawer Overlay     │ │ │ ▼ │                          │
│ ├───────────────────────────────┤ │ └───┘                          │
│ │ LAYER 30: Header Controls    │ │                                 │
│ │ ┌─────────────────────────────┴─┴───────────────────────────┐   │
│ │ │ LAYER 20: Table Header (sticky top)                      │   │
│ │ ├──────────────────────────────────────────────────────────┤   │
│ │ │ LAYER 15: Primary Controls (checkbox column)            │   │
│ │ │ LAYER 14: Secondary Controls (row number column)        │   │
│ │ │                                                          │   │
│ │ │ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐            │   │
│ │ │ │  L15   │ │  L14   │ │  L10   │ │  L10   │  LAYER 10  │   │
│ │ │ │sticky  │ │sticky  │ │sticky  │ │sticky  │  (header)  │   │
│ │ │ │checkbox│ │row num │ │col 1   │ │col 2   │            │   │
│ │ │ ├────────┤ ├────────┤ ├────────┤ ├────────┤            │   │
│ │ │ │  L15   │ │  L14   │ │  L5    │ │  L5    │  LAYER 5   │   │
│ │ │ │sticky  │ │sticky  │ │sticky  │ │sticky  │  (body)    │   │
│ │ │ │checkbox│ │row num │ │col 1   │ │col 2   │            │   │
│ │ │ └────────┘ └────────┘ └────────┘ └────────┘            │   │
│ │ │                                                      │   │
│ │ │ LAYER 0-4: Scrolling content (non-sticky columns)   │   │
│ │ └──────────────────────────────────────────────────────┘   │
│ └────────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────────────┘
```

---

## Sticky Column Patterns

### Pattern 1: Simple Sticky Columns

Used when sticky columns don't overlap each other (different left offsets).

**Example**: TrainingPairsTable

```css
/* All sticky columns use the same z-index */
.sticky-col {
  position: sticky;
  left: <offset>;
  z-index: 10;
}
```

**When to use**:
- Sticky columns are at different horizontal positions
- No need for one sticky column to overlay another
- Simpler implementation

### Pattern 2: Hierarchical Sticky Columns

Used when sticky columns may overlap and need specific layering.

**Example**: ResultsTable

```css
/* Different z-indices for different column types */
.checkbox-col { z-index: 15; }      /* Highest - selection controls */
.row-number-col { z-index: 14; }    /* Second - row identification */
.data-col { z-index: 10; }          /* Base - data columns */
```

**When to use**:
- Multiple sticky columns that may overlap
- Control columns that need to be more visible
- Row selection or actions in sticky columns

---

## Component-Specific Implementations

### ResultsTable

**File**: `src/components/bulk/ResultsTable.astro`

**Z-Index Usage**:
- Checkbox column: `z-15` (tbody), `z-30` (thead)
- Row number column: `z-14` (tbody), `z-30` (thead)
- Data columns: `z-10` (thead), `z-5` (tbody)
- Table header: `z-20`
- Dropdown menus: `z-[50]`

**CSS Implementation**:
```css
/* Ensure proper z-index layering for sticky columns */
.table-luxe thead th.sticky-col {
  z-index: 10;
}

.table-luxe tbody td.sticky-col {
  z-index: 5;
}

/* Checkbox column should have highest z-index */
.table-luxe tbody td.sticky:first-child {
  z-index: 15;
}

.table-luxe tbody td.sticky:nth-child(2) {
  z-index: 14;
}
```

**Left Offset Calculation**:
```typescript
// Base: checkbox (3rem) + row number (3rem) = 6rem
// Each data column: 12rem
const getActionsLeftOffset = (headerCount: number) =>
  `calc(6rem + ${headerCount * 12}rem + 5rem)`;
```

### TrainingPairsTable

**File**: `src/components/training/TrainingPairsTable.astro`

**Z-Index Usage**:
- Sticky columns: `z-10` (uniform)
- Table header: `z-20`
- Dropdown menus: `z-[1]` (low, as dropdowns are within table context)

**Column Widths**:
- Input: `12rem` (sticky)
- Expected Output: `12rem` (sticky)
- Generated Output: `12rem` (sticky)
- Other columns: auto (non-sticky)

**CSS Implementation**:
```css
/* Zebra striping for sticky columns */
.table-luxe tbody tr:nth-child(even) .sticky-col {
  background-color: hsl(var(--b2));
}

.table-luxe tbody tr:nth-child(odd) .sticky-col {
  background-color: hsl(var(--b1));
}

.table-luxe tbody tr:hover .sticky-col {
  background-color: hsl(var(--bc) / 0.1);
}
```

### BulkRunsTable

**File**: `src/components/bulk/BulkRunsTable.astro`

**Z-Index Usage**:
- Table header: `z-20`
- Dropdown menus: `z-[1]`

**Pattern**: Uses simple sticky header pattern without sticky body columns.

---

## Adding New Sticky Columns

### Step-by-Step Guide

#### 1. Determine Column Type and Z-Index

| Column Type | Z-Index (thead) | Z-Index (tbody) | Use Case |
|-------------|-----------------|-----------------|----------|
| Data column | 10 | 5 | Regular data that needs to stay visible |
| Row number | 30 | 14 | Row identification |
| Checkbox/Select | 30 | 15 | Row selection controls |
| Actions | 10 | 14-15 | Per-row actions |

#### 2. Calculate Left Offset

```typescript
// Example: Adding a new "Status" column after Input and Expected Output
const firstStickyWidth = 12; // rem
const secondStickyWidth = 12; // rem
const newColumnWidth = 10; // rem
const leftOffset = `${firstStickyWidth + secondStickyWidth}rem`; // "24rem"
```

#### 3. Add the Column Markup

```astro
<th
  class="sticky-col z-10 bg-base-200/90 hover:bg-base-300"
  style={`left: ${leftOffset}`}
  scope="col"
>
  Status
</th>
```

#### 4. Add Body Cell Markup

```astro
<td
  class="sticky-col z-5 bg-base-100"
  style={`left: ${leftOffset}`}
>
  {row.status}
</td>
```

#### 5. Update Zebra Striping (if using Pattern 2)

```css
/* Add zebra striping for the new column */
.table-luxe tbody tr:nth-child(even) .sticky-col {
  background-color: hsl(var(--b2));
}

.table-luxe tbody tr:nth-child(odd) .sticky-col {
  background-color: hsl(var(--b1));
}

.table-luxe tbody tr:hover .sticky-col {
  background-color: hsl(var(--bc) / 0.1);
}
```

#### 6. Test Scenarios

- [ ] Horizontal scroll: sticky columns overlay passing content
- [ ] Vertical scroll: sticky header stays visible
- [ ] Zebra striping: sticky cells match row colors
- [ ] Hover state: sticky cells highlight with row
- [ ] Column overlap: left columns overlay right columns (if applicable)
- [ ] Dropdown menus: appear above all table content

---

## Common Pitfalls

### 1. Z-Index Conflicts with Modals/Drawers

**Problem**: Table dropdowns appear below modal/drawer overlays.

**Solution**: Use `z-[50]` for dropdowns to stay above modals (`z-40-50`) but below drawers (`z-60-70`).

### 2. Zebra Striping Breaking on Sticky Columns

**Problem**: Sticky columns don't match row background colors.

**Solution**: Apply zebra striping to `.sticky-col` class specifically:

```css
.table-luxe tbody tr:nth-child(even) .sticky-col {
  background-color: hsl(var(--b2));
}
```

### 3. Hover States Not Applying to Sticky Cells

**Problem**: Hovering on a row doesn't highlight sticky cells.

**Solution**: Add hover state for sticky cells:

```css
.table-luxe tbody tr:hover .sticky-col {
  background-color: hsl(var(--bc) / 0.1);
}
```

### 4. Column Left Offset Miscalculation

**Problem**: Sticky columns overlap or have gaps.

**Solution**: Use consistent units and account for all preceding sticky columns:

```typescript
// Wrong: approximate values
style="left: 200px"

// Correct: calculated based on column widths
style={`left: calc(12rem + 12rem)`}
```

### 5. Inline Z-Index vs CSS Class Inconsistency

**Problem**: Some elements use inline z-index, others use CSS classes.

**Solution**: Be consistent within a component. ResultsTable uses CSS classes; TrainingPairsTable uses inline classes.

---

## Global Z-Index Reference

### Application-Wide Z-Index Scale

| Range | Usage | Components |
|-------|-------|------------|
| 0-4 | Base content | Non-sticky content, scrolling areas |
| 5-19 | Sticky columns | Table columns, pinned panels |
| 20-29 | Sticky headers | Table headers, section headers |
| 30-39 | Header controls | Control column headers |
| 40-49 | Raised elements | Tooltips, popovers |
| 50-59 | Dropdowns | Dropdown menus, select options |
| 60-69 | Drawers | Drawer overlays and panels |
| 70-89 | Modals | Modal overlays and panels |
| 90-99 | Toasts/Notifications | Toast notifications |
| 100+ | Critical overlays | Loading screens, error modals |

### Component-Specific Z-Indices

| Component | Z-Index | Context |
|-----------|---------|---------|
| Modal.astro | 100 (backdrop), 110 (panel) | Full-screen modal |
| Drawer.astro | 60 (backdrop), 70 (panel) | Right-side drawer |
| PromptHistoryDrawer.astro | 60 (backdrop), 70 (panel) | Prompt history drawer |
| EditTemplateModal.astro | 50 (backdrop), 51 (panel) | Template editing modal |
| ResultsTable dropdowns | 50 | Row action dropdowns |
| TrainingPairsTable dropdowns | 1 | Row action dropdowns (low, table-local) |

---

## Related Documentation

- [Design System](/docs/constitution.md#ux-consistency) - Design tokens and component patterns
- [Components.css](/src/styles/components.css) - Shared table styling
- [Tailwind CSS Documentation](https://tailwindcss.com/docs/z-index) - Z-index utility reference
