/**
 * Component class utilities for consistent Tailwind CSS and daisyUI styling
 *
 * This module provides type-safe helpers for generating component class names
 * following the project's design system and Tailwind v4 conventions.
 */

/**
 * Button style constants
 */
export const BUTTON_STYLES = {
  base: 'btn',
  variants: {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    accent: 'btn-accent',
    ghost: 'btn-ghost',
    link: 'btn-link',
    info: 'btn-info',
    success: 'btn-success',
    warning: 'btn-warning',
    error: 'btn-error',
    neutral: 'btn-neutral',
  },
  sizes: {
    lg: 'btn-lg',
    md: 'btn-md',
    sm: 'btn-sm',
    xs: 'btn-xs',
  },
  states: {
    disabled: 'btn-disabled',
    loading: 'loading',
    outline: 'btn-outline',
  },
} as const;

/**
 * Badge style constants
 */
export const BADGE_STYLES = {
  base: 'badge',
  variants: {
    primary: 'badge-primary',
    secondary: 'badge-secondary',
    accent: 'badge-accent',
    ghost: 'badge-ghost',
    soft: 'badge-soft',
    info: 'badge-info',
    success: 'badge-success',
    warning: 'badge-warning',
    error: 'badge-error',
    neutral: 'badge-neutral',
  },
  sizes: {
    lg: 'badge-lg',
    md: 'badge-md',
    sm: 'badge-sm',
    xs: 'badge-xs',
  },
  states: {
    outline: 'badge-outline',
  },
} as const;

/**
 * Alert style constants
 */
export const ALERT_STYLES = {
  base: 'alert',
  variants: {
    info: 'alert-info',
    success: 'alert-success',
    warning: 'alert-warning',
    error: 'alert-error',
  },
  shadow: 'shadow-lg',
} as const;

/**
 * Input style constants
 */
export const INPUT_STYLES = {
  base: 'input input-bordered w-full',
  states: {
    error: 'input-error',
    disabled: 'input-disabled',
  },
  sizes: {
    lg: 'input-lg',
    md: 'input-md',
    sm: 'input-sm',
    xs: 'input-xs',
  },
  wrapper: 'form-control w-full',
  label: 'label',
  labelText: 'label-text',
  errorText: 'label-text-alt text-error',
} as const;

/**
 * Select style constants
 */
export const SELECT_STYLES = {
  base: 'select select-bordered w-full',
  states: {
    error: 'select-error',
    disabled: 'select-disabled',
  },
  sizes: {
    lg: 'select-lg',
    md: 'select-md',
    sm: 'select-sm',
    xs: 'select-xs',
  },
} as const;

/**
 * Modal style constants
 */
export const MODAL_STYLES = {
  base: 'modal',
  box: 'modal-box',
  action: 'modal-action',
  backdrop: 'modal-backdrop',
} as const;

/**
 * Card style constants
 */
export const CARD_STYLES = {
  base: 'card-luxe',
  body: 'p-6',
  title: 'font-display text-2xl font-semibold mb-4 text-gradient-gold',
} as const;

/**
 * Drawer style constants
 */
export const DRAWER_STYLES = {
  backdrop: 'fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] hidden opacity-0 transition-opacity duration-300',
  panel: 'fixed top-0 right-0 h-full bg-base-100 z-[70] transform translate-x-full transition-transform duration-300 ease-in-out overflow-hidden flex flex-col',
  header: 'flex items-center justify-between p-6 border-b border-gold-light',
  content: 'flex-1 overflow-y-auto p-6',
  footer: 'p-6 border-t border-gold-light',
  widths: {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  },
} as const;

/**
 * Toast/Alert positioning constants
 */
export const TOAST_STYLES = {
  container: 'toast toast-end toast-bottom z-50',
  alert: 'alert shadow-lg',
} as const;

/**
 * Table style constants
 */
export const TABLE_STYLES = {
  base: 'table-luxe',
  variants: {
    evaluation: 'table-evaluation',
    templates: 'table-templates',
    models: 'table-models',
    results: 'table-results',
  },
} as const;

/**
 * Z-index layer constants for consistent stacking
 */
export const Z_INDEX = {
  toast: 'z-50',
  drawerBackdrop: 'z-[60]',
  drawerPanel: 'z-[70]',
} as const;

/**
 * Utility function to join class names, filtering out falsy values
 */
export function joinClasses(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Universal class name utility (alias for joinClasses)
 * Recommended for all new component development for consistency
 *
 * @example
 * ```typescript
 * cn('base-class', condition && 'conditional-class', className)
 * ```
 */
export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Generate button class names based on variant and size
 */
export function getButtonClasses(
  variant: keyof typeof BUTTON_STYLES.variants = 'neutral',
  size: keyof typeof BUTTON_STYLES.sizes = 'md',
  outline = false
): string {
  return joinClasses(
    BUTTON_STYLES.base,
    BUTTON_STYLES.variants[variant],
    BUTTON_STYLES.sizes[size],
    outline && BUTTON_STYLES.states.outline
  );
}

/**
 * Generate badge class names based on variant and size
 */
export function getBadgeClasses(
  variant: keyof typeof BADGE_STYLES.variants = 'neutral',
  size: keyof typeof BADGE_STYLES.sizes = 'md',
  outline = false
): string {
  return joinClasses(
    BADGE_STYLES.base,
    BADGE_STYLES.variants[variant],
    BADGE_STYLES.sizes[size],
    outline && BADGE_STYLES.states.outline
  );
}

/**
 * Generate alert class names based on variant
 */
export function getAlertClasses(variant: keyof typeof ALERT_STYLES.variants = 'info'): string {
  return joinClasses(ALERT_STYLES.base, ALERT_STYLES.variants[variant], ALERT_STYLES.shadow);
}

/**
 * Generate input class names based on state and size
 */
export function getInputClasses(
  hasError = false,
  size: keyof typeof INPUT_STYLES.sizes = 'md',
  className = ''
): string {
  return cn(
    INPUT_STYLES.base,
    INPUT_STYLES.sizes[size],
    hasError && INPUT_STYLES.states.error,
    className
  );
}

/**
 * Generate select class names based on state and size
 */
export function getSelectClasses(
  hasError = false,
  size: keyof typeof SELECT_STYLES.sizes = 'md',
  className = ''
): string {
  return cn(
    SELECT_STYLES.base,
    SELECT_STYLES.sizes[size],
    hasError && SELECT_STYLES.states.error,
    className
  );
}

/**
 * Generate drawer panel class names based on width
 */
export function getDrawerPanelClasses(width: keyof typeof DRAWER_STYLES.widths = 'md'): string {
  return joinClasses(DRAWER_STYLES.panel, 'w-full', DRAWER_STYLES.widths[width]);
}

/**
 * Generate card class names
 */
export function getCardClasses(className = ''): string {
  return cn(CARD_STYLES.base, className);
}

/**
 * Generate table class names with optional variant
 */
export function getTableClasses(
  variant?: keyof typeof TABLE_STYLES.variants,
  className = '',
): string {
  return cn(TABLE_STYLES.base, variant && TABLE_STYLES.variants[variant], className);
}
