# Implementation Plan: Bulk Evaluation Results Table Redesign

**Feature**: Compact Results Table with PopOver Outputs
**Date**: 2026-01-18
**Component**: `src/components/bulk/ResultsTable.astro`

## Summary

Redesign the bulk evaluation results table to display model outputs in a compact single column instead of multiple side-by-side columns. Each row will show model names as a list with status indicators, and outputs will be viewable via a PopOver information icon. Row actions (view, rerun, delete) will be consolidated into a dedicated actions column.

## Proposed Changes

### UI Changes

#### 1. New "Generated Output" Column

- **Before**: Multiple columns (one per model) showing output text directly
- **After**: Single compact column displaying:
  - Model names as a vertical or horizontal list
  - Status icon for each model:
    - ✅ Checkmark icon for completed
    - ⏳ Pending/spinner icon for pending
    - ❌ Error icon for failed
  - Information icon (info-circle) that triggers PopOver

#### 2. PopOver for Output Display

- Use DaisyUI's `popover` component for lightweight inline display
- On click of the info icon, show:
  - Model name and provider
  - Status badge
  - Full output text (truncated with scroll for long content)
  - For failed results: error message
- Multiple popovers can be open simultaneously (one per model)

#### 3. Row Actions Column

- Replace the existing dropdown menu with direct action icons
- Icons displayed:
  - 👁️ **View** - Opens DetailDrawer (existing `eye` icon)
  - 🔄 **Rerun All** - Regenerates all models for this row (existing `refresh` icon)
  - 🗑️ **Delete** - Deletes results for this row (existing `trash` icon)
- Icons use `btn btn-ghost btn-xs btn-circle` styling
- Show tooltips on hover for accessibility

#### 4. Table Column Layout

| Column               | Type    | Sticky            |
| -------------------- | ------- | ----------------- |
| Checkbox             | Control | Yes (left-0)      |
| Row #                | Control | Yes (left-[3rem]) |
| CSV Data Columns     | Data    | Yes (z-10)        |
| **Generated Output** | Data    | Yes (z-10)        |
| **Row Actions**      | Control | Yes (z-14)        |

### Component Changes

#### 1. ResultsTable.astro Modifications

**Template Changes:**

- Remove the loop that generates per-model columns in `<thead>`
- Add single "Generated Output" column header
- Replace per-model `<td>` cells with single cell containing model list + popover

**Data Structure:**

- Create a helper function to group results by row index
- Map results to model info with status for display

**New Sub-Component (inline or separate):**

```astro
---
interface ModelOutputInfo {
  id: string;
  name: string;
  provider: string;
  status: 'pending' | 'completed' | 'failed';
  output_text?: string;
  error_message?: string;
}
---
```

#### 2. PopOver Implementation

Using DaisyUI popover classes:

```html
<div class="popover popover-hover">
  <button class="btn btn-ghost btn-xs btn-circle">
    <Icon name="info" size="sm" />
  </button>
  <div class="popover-content">
    <!-- Model output content -->
  </div>
</div>
```

**Alternative**: Use click-based popover for better mobile experience:

```html
<div class="dropdown dropdown-end">
  <label tabindex="0" class="btn btn-ghost btn-xs btn-circle">
    <Icon name="info" size="sm" />
  </label>
  <div tabindex="0" class="dropdown-content z-[50] card card-compact w-96 p-2 shadow bg-base-100">
    <!-- Content -->
  </div>
</div>
```

#### 3. Icon Additions

Add new icons to `src/lib/ui/icons.ts`:

- `info-circle`: `'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'` (already exists as `info`)
- `check-circle` for completed status
- `clock` or `loader` for pending status

### Logic Changes

#### 1. Client-Side Script Updates

**New Event Handlers:**

- Keep existing `bulk-row-view-details` for View button
- Keep existing `bulk-row-regenerate` for Rerun button
- Add new `bulk-row-delete` event for Delete button

**PopOver State Management:**

- No state needed if using DaisyUI native classes
- For dropdown-based approach, DaisyUI handles toggle automatically

#### 2. Styling Adjustments

**Z-Index Updates:**

- Row Actions column: `z-14` (same as existing Actions dropdown column)
- Generated Output column: `z-10` (same as other sticky columns)

**Zebra Striping:**

- Update CSS selectors to include the new Generated Output cell

**Width Calculations:**

- Adjust `left` offset calculation for Row Actions column
- Generated Output column width: ~200-250px (expandable)

### Backend Changes

**No backend changes required** - this is purely a UI redesign. The existing API endpoints return the same data structure.

## Verification Plan

### Manual Testing Checklist

1. **Display Verification:**
   - [ ] Table shows single "Generated Output" column
   - [ ] Model names display with correct status icons
   - [ ] Row action icons are visible and properly aligned

2. **PopOver Functionality:**
   - [ ] Click info icon opens popover/dropdown with model output
   - [ ] Popover shows model name, provider, and full output
   - [ ] Long outputs have scroll in popover
   - [ ] Failed results show error message
   - [ ] Multiple popovers can be open simultaneously

3. **Row Actions:**
   - [ ] View button opens DetailDrawer
   - [ ] Rerun button triggers regeneration
   - [ ] Delete button shows confirmation and deletes row

4. **Responsive Behavior:**
   - [ ] Table scrolls horizontally on small screens
   - [ ] Sticky columns remain visible during scroll
   - [ ] Z-index layering is correct

5. **Accessibility:**
   - [ ] All buttons have proper aria-labels
   - [ ] Tooltips display on hover
   - [ ] Keyboard navigation works (tab through actions)

### Automated Tests

**Unit Tests (if applicable):**

- Model result grouping function
- Status icon mapping logic

**E2E Tests:**

- Navigate to bulk evaluation results page
- Verify Generated Output column displays
- Click info icon and verify popover content
- Click View action and verify drawer opens
- Click Delete action and confirm deletion

## Risk Assessment

| Risk                         | Likelihood | Mitigation                                         |
| ---------------------------- | ---------- | -------------------------------------------------- |
| PopOver z-index conflicts    | Low        | Use high z-index (50+) matching existing dropdowns |
| Mobile usability             | Medium     | Test on small screens, consider touch targets      |
| Performance with many models | Low        | Rendering list is lighter than multiple columns    |
| State management complexity  | Low        | DaisyUI handles most toggle state natively         |

## Implementation Notes

1. **PopOver vs Dropdown**: Consider using dropdown instead of popover for better control over positioning and mobile support
2. **Icon Availability**: Check if `check-circle` and `clock` icons exist in `ICON_PATHS`, add if needed
3. **Backward Compatibility**: No data changes, so existing results will display correctly
4. **Testing Priority**: Focus on E2E tests for the new interaction patterns

## Dependencies

- DaisyUI popover/dropdown components (already available)
- Existing Icon component
- Existing StatusBadge component (can reuse for consistency)
