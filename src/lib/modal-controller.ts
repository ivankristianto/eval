/**
 * Universal modal controller for managing modal dialogs
 * Provides a consistent interface for modal state management
 */

export interface ModalController {
  /**
   * Open the modal
   */
  open(): void;

  /**
   * Close the modal
   */
  close(): void;

  /**
   * Reset the modal form (if it has one)
   */
  reset(): void;

  /**
   * Check if the modal is currently open
   */
  isOpen(): boolean;
}

/**
 * Create a modal controller for a specific modal element
 *
 * @param modalId - The ID of the modal dialog element
 * @returns ModalController instance with methods to control the modal
 *
 * @example
 * ```typescript
 * const controller = createModalController('my-modal');
 * controller.open();
 * controller.close();
 * controller.reset();
 * ```
 */
export function createModalController(modalId: string): ModalController {
  const modal = document.getElementById(modalId) as HTMLDialogElement;

  if (!modal) {
    console.warn(`Modal with ID "${modalId}" not found`);
  }

  return {
    open() {
      modal?.showModal();
    },

    close() {
      modal?.close();
    },

    reset() {
      const form = modal?.querySelector('form');
      form?.reset();

      // Hide error messages
      const errorContainers = modal?.querySelectorAll('[id$="-error"]');
      errorContainers?.forEach((container) => {
        container.classList.add('hidden');
      });
    },

    isOpen() {
      return modal?.open ?? false;
    },
  };
}
