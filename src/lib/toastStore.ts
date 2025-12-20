import { atom } from 'nanostores';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

export const toasts = atom<Toast[]>([]);

export function addToast(message: string, type: ToastType = 'info', duration = 3000) {
  const id = Math.random().toString(36).substring(2, 9);
  const toast: Toast = { id, message, type, duration };
  
  toasts.set([...toasts.get(), toast]);

  if (duration > 0) {
    setTimeout(() => {
      removeToast(id);
    }, duration);
  }
}

export function removeToast(id: string) {
  toasts.set(toasts.get().filter((t) => t.id !== id));
}
