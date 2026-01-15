/**
 * Generic CSV Parser
 *
 * Parses CSV files with ANY column structure for bulk evaluation.
 * Reuses RFC 4180 parsing logic from csv-parser.ts to handle:
 * - Quoted fields with commas
 * - Multiline values
 * - Escaped quotes
 *
 * This is a generic parser that doesn't enforce specific column names,
 * making it suitable for bulk evaluation with dynamic CSV structures.
 */

export type GenericCSVRow = Record<string, string>;

export interface GenericCSVParseResult {
  headers: string[];
  rows: GenericCSVRow[];
  errors: string[];
}

/**
 * Maximum number of rows allowed for bulk evaluation (V1 limit per spec SC-001)
 */
export const MAX_ROWS = 1000;

/**
 * Parse CSV content with any header structure.
 *
 * @param fileContent - Raw CSV file content as string
 * @param maxRows - Maximum rows to parse (defaults to MAX_ROWS)
 * @returns Parsed headers, rows, and validation errors
 *
 * Features:
 * - Parses CSV with ANY column headers (no specific column requirements)
 * - Handles RFC 4180 format: quoted fields, commas in quotes, multiline values
 * - Returns array of objects with keys as headers
 * - Validates: non-empty, has headers, has data rows
 * - Enforces max row limit (default 1000 for V1)
 *
 * @example
 * ```ts
 * const csv = `name,age,city
 * "John Doe",30,"New York"
 * "Jane Smith",25,"Los Angeles"`;
 *
 * const result = parseGenericCSV(csv);
 * // result.headers = ['name', 'age', 'city']
 * // result.rows = [
 * //   { name: 'John Doe', age: '30', city: 'New York' },
 * //   { name: 'Jane Smith', age: '25', city: 'Los Angeles' }
 * // ]
 * ```
 */
export function parseGenericCSV(
  fileContent: string,
  maxRows: number = MAX_ROWS
): GenericCSVParseResult {
  const errors: string[] = [];
  const rows: GenericCSVRow[] = [];

  // Handle empty content
  if (!fileContent || fileContent.trim() === '') {
    errors.push('CSV file is empty');
    return { headers: [], rows, errors };
  }

  // Parse CSV manually to handle multiline values (RFC 4180)
  const lines = parseCSVLines(fileContent);

  if (lines.length === 0) {
    errors.push('CSV file is empty');
    return { headers: [], rows, errors };
  }

  // Extract headers (first row)
  const headers = lines[0];

  if (headers.length === 0 || headers.every((h) => !h.trim())) {
    errors.push('CSV file is missing headers');
    return { headers: [], rows, errors };
  }

  // Validate max rows limit
  const dataLines = lines.slice(1);
  if (dataLines.length > maxRows) {
    errors.push(
      `CSV file exceeds maximum row limit of ${maxRows}. Found ${dataLines.length} data rows.`
    );
    // Only process up to the limit
    dataLines.length = maxRows;
  }

  // Parse data rows
  for (let i = 0; i < dataLines.length; i++) {
    const rowData = dataLines[i];

    // Skip empty rows
    if (rowData.length === 0 || rowData.every((cell) => !cell.trim())) {
      continue;
    }

    // Create row object with headers as keys
    const rowObj: GenericCSVRow = {};

    for (let j = 0; j < headers.length; j++) {
      const header = headers[j].trim();
      const value = rowData[j] !== undefined ? rowData[j].trim() : '';
      rowObj[header] = value;
    }

    rows.push(rowObj);
  }

  // Validate that we have at least one data row
  if (rows.length === 0) {
    errors.push('CSV file must contain at least one data row');
  }

  return { headers, rows, errors };
}

/**
 * Parse CSV lines with support for quoted multiline values.
 * Handles RFC 4180 CSV format:
 * - Fields with commas must be quoted
 * - Fields with quotes must escape quotes with double quotes
 * - Fields with newlines must be quoted
 *
 * Copied from csv-parser.ts to maintain consistency.
 *
 * @param content - Raw CSV string content
 * @returns 2D array of strings representing rows and cells
 */
function parseCSVLines(content: string): string[][] {
  const lines: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;

  while (i < content.length) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote
          currentField += '"';
          i += 2;
          continue;
        } else {
          // End of quoted field
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        // Regular character inside quotes
        currentField += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        // Start of quoted field
        inQuotes = true;
        i++;
        continue;
      } else if (char === ',') {
        // Field separator
        currentRow.push(currentField);
        currentField = '';
        i++;
        continue;
      } else if (char === '\n') {
        // Row separator
        currentRow.push(currentField);
        if (currentRow.length > 0) {
          lines.push(currentRow);
        }
        currentRow = [];
        currentField = '';
        i++;
        continue;
      } else if (char === '\r' && nextChar === '\n') {
        // Windows-style line ending
        currentRow.push(currentField);
        if (currentRow.length > 0) {
          lines.push(currentRow);
        }
        currentRow = [];
        currentField = '';
        i += 2;
        continue;
      } else if (char === '\r') {
        // Mac-style line ending
        currentRow.push(currentField);
        if (currentRow.length > 0) {
          lines.push(currentRow);
        }
        currentRow = [];
        currentField = '';
        i++;
        continue;
      } else {
        // Regular character
        currentField += char;
        i++;
        continue;
      }
    }
  }

  // Add last field and row if not empty
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.length > 0) {
      lines.push(currentRow);
    }
  }

  return lines;
}
