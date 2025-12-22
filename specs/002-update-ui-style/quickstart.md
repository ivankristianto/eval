# Quickstart: Update UI with DaisyUI

## Key Component Usage

### 1. Primary Action Button
On the homepage, use the standard DaisyUI primary button class with specific placement:
```html
<div class="flex justify-between items-center mb-6">
  <h1 class="text-3xl font-bold">History</h1>
  <button id="new-evaluation-btn" class="btn btn-primary">New Evaluation</button>
</div>
```

### 2. Status Badges
Use consistent semantic colors for evaluation statuses:
- **Completed**: `<span class="badge badge-success">Completed</span>`
- **Running**: `<span class="badge badge-info animate-pulse">Running</span>`
- **Pending**: `<span class="badge badge-warning">Pending</span>`
- **Failed**: `<span class="badge badge-error">Failed</span>`

### 3. Data Tables
Apply DaisyUI table utilities for all list views:
```html
<table class="table table-zebra w-full">
  <thead>
    <tr>
      <th>...</th>
    </tr>
  </thead>
  <tbody>
    ...
  </tbody>
</table>
```

## Routing Checklist
- [ ] Move `src/pages/history.astro` logic to `src/pages/index.astro`.
- [ ] Create `src/pages/evaluations/[id].astro` using the logic from the old `index.astro`.
- [ ] Update `Navbar.astro` to remove the "History" link and "New Evaluation" button.
- [ ] Ensure all internal links point to the new `/evaluations/[id]` route.