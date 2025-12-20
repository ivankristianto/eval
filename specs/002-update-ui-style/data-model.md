# Data Model: Update UI with DaisyUI

**Feature**: `002-update-ui-style`

## Schema Changes

No database schema changes are required for this feature. The updates are strictly visual (CSS/HTML) and client-side state (localStorage for theme).

## Local Storage Model

| Key | Value | Description |
|-----|-------|-------------|
| `theme` | `string` (e.g., "light", "dark", "cupcake") | Persists the user's selected UI theme. |
