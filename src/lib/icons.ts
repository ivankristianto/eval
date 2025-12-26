/**
 * Unified icon system for consistent SVG rendering
 * Replaces duplicated icon paths across components
 */

export const ICON_PATHS = {
  success: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  error: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
  warning:
    'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  close: 'M6 18L18 6M6 6l12 12',
} as const;

export type IconName = keyof typeof ICON_PATHS;

export const ICON_SIZES = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
  xl: 'w-8 h-8',
} as const;

/**
 * Create SVG icon element (client-side utility)
 * Used in components with client-side rendering like Toast
 *
 * @param name - Icon name from ICON_PATHS
 * @param size - Icon size from ICON_SIZES
 * @returns SVGElement with proper attributes and classes
 */
export function createIconElement(
  name: IconName,
  size: keyof typeof ICON_SIZES = 'md',
): SVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.classList.add('stroke-current', 'shrink-0', ...ICON_SIZES[size].split(' '));

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  path.setAttribute('stroke-width', '2');
  path.setAttribute('d', ICON_PATHS[name]);

  svg.appendChild(path);
  return svg;
}
