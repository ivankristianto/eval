# Tasks: Bulk Evaluation Results Table Redesign

**Implementation Plan**: `specs/008-bulk-evaluation/implementation_plan.md`
**Component**: `src/components/bulk/ResultsTable.astro`

## Task Checklist

### Phase 1: Icon Setup

- [ ] **Task 1.1**: Add missing status icons to `src/lib/ui/icons.ts`
  - [ ] Add `check-circle` icon path for completed status
  - [ ] Add `clock` or `hourglass` icon path for pending status
  - [ ] Verify `info` icon exists (reused for information button)

### Phase 2: Component Structure Updates

- [ ] **Task 2.1**: Create TypeScript interface for model output info
  - [ ] Define `ModelOutputInfo` interface in ResultsTable.astro
  - [ ] Include: id, name, provider, status, output_text, error_message

- [ ] **Task 2.2**: Create helper function to group results by row
  - [ ] Add `getModelOutputsForRow()` function
  - [ ] Takes: `rowIndex`, `selectedModels`, `resultsMap`
  - [ ] Returns: `ModelOutputInfo[]` array

### Phase 3: Table Header Changes

- [ ] **Task 3.1**: Update table header structure
  - [ ] Remove per-model column loop in `<thead>`
  - [ ] Add single "Generated Output" column header
  - [ ] Add "Row Actions" column header (if not already present)

- [ ] **Task 3.2**: Update sticky column offsets
  - [ ] Recalculate `left` offset for Row Actions column
  - [ ] Adjust offset to: `calc(6rem + (headerCount * 12)rem + 5rem)` for Generated Output
  - [ ] Row Actions follows Generated Output

### Phase 4: Table Body Cell Rendering

- [ ] **Task 4.1**: Replace per-model `<td>` loop with single cell
  - [ ] Remove `{selectedModels.map((model) => ...)}` loop that creates multiple cells
  - [ ] Add single `<td>` for Generated Output
  - [ ] Apply sticky positioning and z-index

- [ ] **Task 4.2**: Implement model list display
  - [ ] Display model names with status icons in vertical or compact list
  - [ ] Use StatusBadge component or direct icons for status indication
  - [ ] Truncate long model names if needed

- [ ] **Task 4.3**: Implement PopOver/dropdown for output display
  - [ ] Add info icon button for each model in the list
  - [ ] Wrap in DaisyUI dropdown or popover component
  - [ ] Display full output in dropdown content with scroll for long text
  - [ ] Show error message for failed results

### Phase 5: Row Actions Column

- [ ] **Task 5.1**: Replace existing dropdown with direct action buttons
  - [ ] Remove the existing `dropdown` component in Actions column
  - [ ] Add three separate icon buttons: View (eye), Rerun (refresh), Delete (trash)
  - [ ] Apply `btn btn-ghost btn-xs btn-circle` styling to each

- [ ] **Task 5.2**: Add tooltips and accessibility
  - [ ] Add `title` attribute to each button
  - [ ] Add proper `aria-label` for screen readers
  - [ ] Ensure keyboard navigation works

- [ ] **Task 5.3**: Update event handlers
  - [ ] Keep existing `bulk-row-view-details` for View button
  - [ ] Keep existing `bulk-row-regenerate` for Rerun button
  - [ ] Add new `bulk-row-delete` event handler for Delete button
  - [ ] Update confirmation dialog for delete action

### Phase 6: Styling and CSS

- [ ] **Task 6.1**: Update zebra striping CSS
  - [ ] Add selectors for new Generated Output cell
  - [ ] Ensure background matches row stripe pattern

- [ ] **Task 6.2**: Update z-index layering
  - [ ] Verify Generated Output column at `z-10`
  - [ ] Verify Row Actions column at `z-14`
  - [ ] Test horizontal scroll layering

- [ ] **Task 6.3**: Responsive adjustments
  - [ ] Test on mobile breakpoint (< 640px)
  - [ ] Adjust button sizes if needed for touch targets
  - [ ] Verify popover/dropdown positioning on small screens

### Phase 7: Testing

- [ ] **Task 7.1**: Manual testing
  - [ ] Test display with 1, 2, 3+ models
  - [ ] Test all status states (pending, completed, failed)
  - [ ] Test popover/dropdown open/close behavior
  - [ ] Test row action buttons (view, rerun, delete)
  - [ ] Test horizontal scrolling with sticky columns
  - [ ] Test on mobile viewport

- [ ] **Task 7.2**: Automated testing (optional but recommended)
  - [ ] Add E2E test for verifying new table structure
  - [ ] Add E2E test for popover/dropdown interaction
  - [ ] Add E2E test for row action buttons

### Phase 8: Documentation

- [ ] **Task 8.1**: Update component documentation
  - [ ] Update JSDoc in ResultsTable.astro to reflect new structure
  - [ ] Document new custom events (if any added)
  - [ ] Update z-index layering table in comments

- [ ] **Task 8.2**: Create/delete cleanup
  - [ ] Remove any unused code from old implementation
  - [ ] Clean up commented-out code
  - [ ] Verify no console errors or warnings

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
