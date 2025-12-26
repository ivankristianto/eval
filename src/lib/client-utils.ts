/**
 * Client-side utility functions for consistent component behavior
 * Extracted from inline scripts to reduce duplication and improve maintainability
 */

/**
 * Modal utilities for consistent modal control across components
 */
export const ModalUtils = {
  /**
   * Open a modal dialog by ID
   */
  open(id: string): void {
    const modal = document.getElementById(id) as HTMLDialogElement;
    modal?.showModal();
  },

  /**
   * Close a modal dialog by ID
   */
  close(id: string): void {
    const modal = document.getElementById(id) as HTMLDialogElement;
    modal?.close();
  },

  /**
   * Setup auto-close when clicking backdrop
   */
  setupBackdropClose(id: string): void {
    const modal = document.getElementById(id) as HTMLDialogElement;
    if (!modal) return;

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.close();
      }
    });
  },
};

/**
 * Form utilities for validation and submission
 */
export const FormUtils = {
  /**
   * Validate form and return FormData or null if invalid
   */
  validateAndGetData(formId: string): FormData | null {
    const form = document.getElementById(formId) as HTMLFormElement;
    if (!form?.checkValidity()) {
      form?.reportValidity();
      return null;
    }
    return new FormData(form);
  },

  /**
   * Reset form and hide error messages
   */
  reset(formId: string): void {
    const form = document.getElementById(formId) as HTMLFormElement;
    form?.reset();
  },

  /**
   * Show error message in a container
   */
  showError(containerId: string, message: string): void {
    const container = document.getElementById(containerId);
    if (container) {
      container.classList.remove('hidden');
      const textElement = container.querySelector('[id$="-text"]');
      if (textElement) textElement.textContent = message;
    }
  },

  /**
   * Hide error message container
   */
  hideError(containerId: string): void {
    const container = document.getElementById(containerId);
    container?.classList.add('hidden');
  },
};

/**
 * Initialize handlers that should run once per page
 * Prevents duplicate event listener registration during Astro page transitions
 *
 * @param key - Unique identifier for this initialization
 * @param fn - Function to run once
 *
 * @example
 * ```typescript
 * initializeOnce('myFeature', () => {
 *   // This only runs once per page, even with Astro transitions
 *   setupEventListeners();
 * });
 * ```
 */
export function initializeOnce(key: string, fn: () => void): void {
  const dataKey = `init${key.charAt(0).toUpperCase()}${key.slice(1)}`;
  if (!document.documentElement.dataset[dataKey]) {
    fn();
    document.documentElement.dataset[dataKey] = 'true';
  }
}

/**
 * Reset all initialization flags (useful for testing or manual resets)
 */
export function resetInitFlags(): void {
  Object.keys(document.documentElement.dataset).forEach((key) => {
    if (key.startsWith('init')) {
      delete document.documentElement.dataset[key];
    }
  });
}
