# Quickstart: UI Development with DaisyUI

**Feature**: `002-update-ui-style`

## Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```
   *Ensures DaisyUI and Tailwind CSS are installed.*

2. **Start Development Server**:
   ```bash
   npm run dev
   ```

## Key Components

### Global Layout
- Located in `src/layouts/Layout.astro`.
- Wraps all pages.
- Includes `Navbar`, `Footer` (if any), and `ThemeController`.

### UI Components
- **Buttons**: Use `btn` class (e.g., `btn btn-primary`).
- **Inputs**: Use `input input-bordered`.
- **Cards**: Use `card card-bordered bg-base-100 shadow-xl`.
- **Tables**: Use `table`.

### Adding a New Page
1. Create `.astro` file in `src/pages/`.
2. Wrap content in `<Layout title="Page Title">`.
3. Use `Breadcrumbs` component below the title.

### Theme Switching
- The theme is applied to the `<html>` tag via `data-theme` attribute.
- Toggle it using the theme switcher in the Navbar.
