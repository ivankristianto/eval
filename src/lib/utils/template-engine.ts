/**
 * Template Engine for Bulk Evaluation
 *
 * Provides simple template interpolation using {{key}} placeholder syntax.
 * Supports nested object access (e.g., {{user.name}}) and handles missing keys gracefully.
 * Designed for bulk evaluation scenarios where CSV column values replace template placeholders.
 */

/**
 * Options for template interpolation
 */
export interface InterpolateOptions {
  /** If true, leave {{key}} placeholders intact when key is missing. Default: false (replace with empty string) */
  leavePlaceholder?: boolean;
  /** Custom placeholder pattern. Default: {{key}} */
  pattern?: RegExp;
}

/**
 * Interpolate template string with data from provided object
 *
 * @param template - Template string containing {{key}} placeholders
 * @param data - Object containing key-value pairs for interpolation. Supports nested access via dot notation.
 * @param options - Optional configuration for interpolation behavior
 * @returns Interpolated string with {{key}} placeholders replaced by data values
 *
 * @example
 * ```ts
 * // Simple interpolation
 * interpolateTemplate('Hello {{name}}', { name: 'World' })
 * // Returns: 'Hello World'
 *
 * // Nested object access
 * interpolateTemplate('User: {{user.name}}, Email: {{user.email}}', {
 *   user: { name: 'Alice', email: 'alice@example.com' }
 * })
 * // Returns: 'User: Alice, Email: alice@example.com'
 *
 * // Missing key handling
 * interpolateTemplate('Hello {{name}}', {}, { leavePlaceholder: true })
 * // Returns: 'Hello {{name}}'
 *
 * // Missing key with empty string (default)
 * interpolateTemplate('Hello {{name}}', {})
 * // Returns: 'Hello '
 *
 * // Unicode/emoji support
 * interpolateTemplate('Emoji: {{emoji}}', { emoji: '🎉' })
 * // Returns: 'Emoji: 🎉'
 * ```
 */
export function interpolateTemplate(
  template: string,
  data: Record<string, unknown>,
  options: InterpolateOptions = {}
): string {
  const { leavePlaceholder = false, pattern } = options;

  // Default pattern matches {{key}} where key is alphanumeric, underscore, or dot (for nested access)
  const placeholderPattern = pattern || /\{\{([a-zA-Z0-9_.]+)\}\}/g;

  return template.replace(placeholderPattern, (match, keyPath) => {
    const value = getNestedValue(data, keyPath);

    if (value === undefined) {
      // Handle missing key based on options
      return leavePlaceholder ? match : '';
    }

    // Convert value to string (handles numbers, booleans, etc.)
    return String(value);
  });
}

/**
 * Get value from nested object using dot notation key path
 *
 * @param obj - Object to traverse
 * @param keyPath - Dot-separated path (e.g., 'user.name' or 'user.profile.age')
 * @returns Value at path, or undefined if path doesn't exist
 *
 * @example
 * ```ts
 * getNestedValue({ user: { name: 'Alice' } }, 'user.name')
 * // Returns: 'Alice'
 *
 * getNestedValue({ user: { name: 'Alice' } }, 'user.email')
 * // Returns: undefined
 *
 * getNestedValue({ 'user.name': 'direct' }, 'user.name')
 * // Returns: 'direct' (checks for direct key match first)
 * ```
 */
function getNestedValue(obj: Record<string, unknown>, keyPath: string): unknown {
  // First check if the key exists as a direct property (handles keys with dots)
  if (keyPath in obj) {
    return obj[keyPath];
  }

  // Split by dot and traverse nested structure
  const keys = keyPath.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    // Ensure current is an object before accessing property
    if (typeof current !== 'object' || current === null || !(key in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

/**
 * Extract all placeholder keys from a template string
 *
 * @param template - Template string containing {{key}} placeholders
 * @param pattern - Optional custom placeholder pattern. Default matches {{key}}
 * @returns Array of unique placeholder keys found in template
 *
 * @example
 * ```ts
 * extractTemplateKeys('Hello {{name}}, your role is {{role}}')
 * // Returns: ['name', 'role']
 *
 * extractTemplateKeys('User: {{user.name}}, Email: {{user.email}}')
 * // Returns: ['user.name', 'user.email']
 * ```
 */
export function extractTemplateKeys(template: string, pattern?: RegExp): string[] {
  const placeholderPattern = pattern || /\{\{([a-zA-Z0-9_.]+)\}\}/g;
  const keys = new Set<string>();
  let match: RegExpExecArray | null;

  // Reset regex state for reuse
  placeholderPattern.lastIndex = 0;

  while ((match = placeholderPattern.exec(template)) !== null) {
    keys.add(match[1]);
  }

  return Array.from(keys);
}

/**
 * Validate that all template placeholders have corresponding values in data
 *
 * @param template - Template string containing {{key}} placeholders
 * @param data - Object containing key-value pairs for interpolation
 * @param pattern - Optional custom placeholder pattern. Default matches {{key}}
 * @returns Object with validation result and missing keys
 *
 * @example
 * ```ts
 * validateTemplate('Hello {{name}}, your role is {{role}}', { name: 'Alice' })
 * // Returns: { valid: false, missingKeys: ['role'] }
 *
 * validateTemplate('Hello {{name}}', { name: 'Alice' })
 * // Returns: { valid: true, missingKeys: [] }
 * ```
 */
export function validateTemplate(
  template: string,
  data: Record<string, unknown>,
  pattern?: RegExp
): { valid: boolean; missingKeys: string[] } {
  const requiredKeys = extractTemplateKeys(template, pattern);
  const missingKeys: string[] = [];

  for (const keyPath of requiredKeys) {
    const value = getNestedValue(data, keyPath);
    if (value === undefined) {
      missingKeys.push(keyPath);
    }
  }

  return {
    valid: missingKeys.length === 0,
    missingKeys,
  };
}
