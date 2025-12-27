import { atom } from 'nanostores';

/**
 * Supported toast notification levels.
 */
export type ToastType = 'info' | 'success' | 'warning' | 'error';

/**
 * Data structure for a single toast notification.
 */
export interface ToastMessage {
  /** Unique identifier for the toast */
  id: string;
  /** Message text to display */
  message: string;
  /** Notification level */
  type: ToastType;
  /** Optional auto-dismiss duration in ms */
  duration?: number;
}

/**
 * Store containing the active list of toast notifications.
 */
export const toasts = atom<ToastMessage[]>([]);

/**
 * Adds a new toast notification to the store.
 * @param message - Text to display
 * @param type - Notification level (default: 'info')
 * @param duration - Auto-dismiss time in ms (default: 3000, use 0 to keep until closed)
 */
export function addToast(message: string, type: ToastType = 'info', duration = 3000) {
  const id = Math.random().toString(36).substring(2, 9);
  const newToast = { id, message, type, duration };

  toasts.set([...toasts.get(), newToast]);

  if (duration > 0) {
    setTimeout(() => {
      removeToast(id);
    }, duration);
  }
}

/**
 * Removes a toast notification from the store by ID.
 * @param id - Unique identifier of the toast to remove
 */
export function removeToast(id: string) {
  toasts.set(toasts.get().filter((t) => t.id !== id));
}
