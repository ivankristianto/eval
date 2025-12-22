# API Contracts: Update UI with DaisyUI

**Feature**: `002-update-ui-style`

## New Endpoints

No new backend API endpoints are required.

## Client-Side State

The UI will manage the following state on the client:

### Theme Selection
- **Scope**: Global
- **Persistence**: `localStorage.getItem('theme')`
- **Default**: System preference (`window.matchMedia('(prefers-color-scheme: dark)')`)

### Notifications
- **Type**: Ephemeral (Toast)
- **Mechanism**: Global store (e.g., Nano Stores) or Context API to trigger toasts from anywhere.
