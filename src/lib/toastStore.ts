import { atom } from 'nanostores';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

export const toasts = atom<ToastMessage[]>([]);

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

export function removeToast(id: string) {
  toasts.set(toasts.get().filter((t) => t.id !== id));
}
