# Tasks: Bulk Evaluation Results Table Redesign

**Implementation Plan**: `specs/008-bulk-evaluation/implementation_plan.md`
**Component**: `src/components/bulk/ResultsTable.astro`

## Task Checklist

### Phase 1: Icon Setup ✅

- [x] **Task 1.1**: Add missing status icons to `src/lib/ui/icons.ts`
  - [x] Add `check-circle` icon path for completed status
  - [x] Add `clock` or `hourglass` icon path for pending status
  - [x] Verify `info` icon exists (reused for information button)

### Phase 2: Component Structure Updates ✅

- [x] **Task 2.1**: Create TypeScript interface for model output info
  - [x] Define `ModelOutputInfo` interface in ResultsTable.astro
  - [x] Include: id, name, provider, status, output_text, error_message

- [x] **Task 2.2**: Create helper function to group results by row
  - [x] Add `getModelOutputsForRow()` function
  - [x] Takes: `rowIndex`, `selectedModels`, `resultsMap`
  - [x] Returns: `ModelOutputInfo[]` array

### Phase 3: Table Header Changes ✅

- [x] **Task 3.1**: Update table header structure
  - [x] Remove per-model column loop in `<thead>`
  - [x] Add single "Generated Output" column header
  - [x] Add "Row Actions" column header (if not already present)

- [x] **Task 3.2**: Update sticky column offsets
  - [x] Recalculate `left` offset for Row Actions column
  - [x] Adjust offset to: `calc(6rem + (headerCount * 12)rem + 5rem)` for Generated Output
  - [x] Row Actions follows Generated Output

### Phase 4: Table Body Cell Rendering ✅

- [x] **Task 4.1**: Replace per-model `<td>` loop with single cell
  - [x] Remove `{selectedModels.map((model) => ...)}` loop that creates multiple cells
  - [x] Add single `<td>` for Generated Output
  - [x] Apply sticky positioning and z-index

- [x] **Task 4.2**: Implement model list display
  - [x] Display model names with status icons in vertical or compact list
  - [x] Use StatusBadge component or direct icons for status indication
  - [x] Truncate long model names if needed

- [x] **Task 4.3**: Implement PopOver/dropdown for output display
  - [x] Add info icon button for each model in the list
  - [x] Wrap in DaisyUI dropdown or popover component
  - [x] Display full output in dropdown content with scroll for long text
  - [x] Show error message for failed results

### Phase 5: Row Actions Column ✅

- [x] **Task 5.1**: Replace existing dropdown with direct action buttons
  - [x] Remove the existing `dropdown` component in Actions column
  - [x] Add three separate icon buttons: View (eye), Rerun (refresh), Delete (trash)
  - [x] Apply `btn btn-ghost btn-xs btn-circle` styling to each

- [x] **Task 5.2**: Add tooltips and accessibility
  - [x] Add `title` attribute to each button
  - [x] Add proper `aria-label` for screen readers
  - [x] Ensure keyboard navigation works

- [x] **Task 5.3**: Update event handlers
  - [x] Keep existing `bulk-row-view-details` for View button
  - [x] Keep existing `bulk-row-regenerate` for Rerun button
  - [x] Add new `bulk-row-delete` event handler for Delete button
  - [x] Update confirmation dialog for delete action

### Phase 6: Styling and CSS ✅

- [x] **Task 6.1**: Update zebra striping CSS
  - [x] Add selectors for new Generated Output cell
  - [x] Ensure background matches row stripe pattern

- [x] **Task 6.2**: Update z-index layering
  - [x] Verify Generated Output column at `z-10`
  - [x] Verify Row Actions column at `z-14`
  - [x] Test horizontal scroll layering

- [x] **Task 6.3**: Responsive adjustments
  - [x] Test on mobile breakpoint (< 640px)
  - [x] Adjust button sizes if needed for touch targets
  - [x] Verify popover/dropdown positioning on small screens

### Phase 7: Testing ✅

- [x] **Task 7.1**: Manual testing
  - [x] Test display with 1, 2, 3+ models
  - [x] Test all status states (pending, completed, failed)
  - [x] Test popover/dropdown open/close behavior
  - [x] Test row action buttons (view, rerun, delete)
  - [x] Test horizontal scrolling with sticky columns
  - [x] Test on mobile viewport

- [x] **Task 7.2**: Automated testing (optional but recommended)
  - [x] Add E2E test for verifying new table structure
  - [x] Add E2E test for popover/dropdown interaction
  - [x] Add E2E test for row action buttons

### Phase 8: Documentation ✅

- [x] **Task 8.1**: Update component documentation
  - [x] Update JSDoc in ResultsTable.astro to reflect new structure
  - [x] Document new custom events (if any added)
  - [x] Update z-index layering table in comments

- [x] **Task 8.2**: Create/delete cleanup
  - [x] Remove any unused code from old implementation
  - [x] Clean up commented-out code
  - [x] Verify no console errors or warnings

## Task Breakdown by File

### `src/lib/ui/icons.ts`

- Add `check-circle` icon path
- Add `clock` or `hourglass` icon path

### `src/components/bulk/ResultsTable.astro`

- Update `<thead>` structure
- Replace per-model `<td>` loop with single Generated Output cell
- Implement model list with status icons
- Add PopOver/dropdown for output display
- Replace dropdown menu with direct action buttons
- Update client-side script for new event handlers
- Update CSS for zebra striping and z-index

### Testing Files (optional)

- `tests/e2e/bulk-results-table.spec.ts` (new or updated)

## Implementation Order

**Recommended sequence:**

1. Icons setup (15 min)
2. Component structure - interfaces and helpers (30 min)
3. Table header changes (30 min)
4. Table body - model list display (1 hour)
5. PopOver/dropdown implementation (1 hour)
6. Row actions replacement (45 min)
7. Styling adjustments (30 min)
8. Testing and fixes (1-2 hours)
9. Documentation (30 min)

**Estimated Total**: 5-7 hours

## Notes

- No backend changes required - all data structure remains the same
- Can implement incrementally and test each phase
- Consider using existing dropdown component for better mobile support
- Keep existing DetailDrawer functionality intact
