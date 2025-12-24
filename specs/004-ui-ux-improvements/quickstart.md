# Quickstart: UI/UX Improvements

## Prerequisites
- Node.js >= 22.0.0
- Dependencies installed (`npm install`)
- Database initialized (`npm run db:init`)

## Running the Application
1. Start the dev server:
   ```bash
   npm run dev
   ```
2. Navigate to `http://localhost:3000`

## Testing New Features

### Pagination & Filtering
1. Generate test data (optional manual SQL insert or use app to create multiple evals).
2. On the homepage, use the "Items per page" dropdown to change page size.
3. Use the Filter bar to set a Date Range or Rubric filter.
4. Verify list updates immediately.

### Bulk Delete
1. Check the "Select All" checkbox in the table header.
2. Click the trash icon (Bulk Delete) in the toolbar.
3. Confirm the dialog.
4. Verify selected items are removed.

### Themes
1. Click the Theme Switcher in the top right.
2. Select "Luxury" (Dark) or "Nord".
3. Refresh the page to verify persistence.
