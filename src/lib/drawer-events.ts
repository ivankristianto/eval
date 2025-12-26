/**
 * Drawer event utilities for consistent drawer control across the application
 *
 * This module provides type-safe event-based drawer control, replacing
 * global window function pollution with CustomEvent dispatching.
 */

export const DRAWER_EVENTS = {
  OPEN: 'drawer:open',
  CLOSE: 'drawer:close',
  TOGGLE: 'drawer:toggle',
} as const;

export interface DrawerEventDetail {
  id: string;
}

/**
 * Open a drawer by ID
 * @param id - The drawer's unique identifier
 */
export function openDrawer(id: string): void {
  document.dispatchEvent(
    new CustomEvent<DrawerEventDetail>(DRAWER_EVENTS.OPEN, {
      detail: { id },
    })
  );
}

/**
 * Close a drawer by ID
 * @param id - The drawer's unique identifier
 */
export function closeDrawer(id: string): void {
  document.dispatchEvent(
    new CustomEvent<DrawerEventDetail>(DRAWER_EVENTS.CLOSE, {
      detail: { id },
    })
  );
}

/**
 * Toggle a drawer's open/closed state by ID
 * @param id - The drawer's unique identifier
 */
export function toggleDrawer(id: string): void {
  document.dispatchEvent(
    new CustomEvent<DrawerEventDetail>(DRAWER_EVENTS.TOGGLE, {
      detail: { id },
    })
  );
}
