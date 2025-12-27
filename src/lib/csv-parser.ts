/**
 * CSV Parser for Training Data
 *
 * Parses and validates CSV files containing input/expected_output pairs for judge training.
 * Supports flexible column naming and enforces 10-200 pair constraints.
 */

export interface TrainingPairRow {
  input: string;
  expected_output: string;
}

export interface CSVParseResult {
  rows: TrainingPairRow[];
  errors: string[];
}

/**
 * Parse CSV content and validate training data
 *
 * @param fileContent - Raw CSV file content as string
 * @returns Parsed rows and validation errors
 *
 * Accepted column names (case-insensitive):
 * - Standard: "input" and "expected_output"
 * - Alternative: "Input A" and "Correct Output"
 *
 * Validation rules:
 * - Must have 10-200 pairs (per spec FR-003, FR-004)
 * - Input and expected_output cannot be empty
 * - Duplicate pairs are reported as errors
 */
export function parseCSV(fileContent: string): CSVParseResult {
  const errors: string[] = [];
  const rows: TrainingPairRow[] = [];

  // Handle empty content
  if (!fileContent || fileContent.trim() === '') {
    errors.push('CSV file is empty');
    return { rows, errors };
  }

  // Parse CSV manually to handle multiline values
  const lines = parseCSVLines(fileContent);

  if (lines.length === 0) {
    errors.push('CSV file is empty');
    return { rows, errors };
  }

  // Extract and normalize headers
  const headers = lines[0].map(h => h.trim().toLowerCase());

  // Map column names to standard format
  const columnMap = normalizeColumnNames(headers);

  if (columnMap.input === null || columnMap.expected_output === null) {
    errors.push(
      'Missing required columns. Expected "input" and "expected_output" (or "Input A" and "Correct Output")'
    );
    return { rows, errors };
  }

  // Track duplicates
  const seen = new Set<string>();

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const rowData = lines[i];

    // Skip empty rows
    if (rowData.length === 0 || rowData.every(cell => !cell.trim())) {
      continue;
    }

    // Extract values
    const inputValue = (rowData[columnMap.input] || '').trim();
    const expectedOutputValue = (rowData[columnMap.expected_output] || '').trim();

    // Validate non-empty
    if (!inputValue) {
      errors.push(`Row ${i}: Input cannot be empty`);
      continue;
    }

    if (!expectedOutputValue) {
      errors.push(`Row ${i}: Expected output cannot be empty`);
      continue;
    }

    // Check for duplicates
    const pairKey = `${inputValue}|||${expectedOutputValue}`;
    if (seen.has(pairKey)) {
      errors.push(`Duplicate pair detected at row ${i}: "${inputValue}" → "${expectedOutputValue}"`);
      continue;
    }
    seen.add(pairKey);

    // Add valid row
    rows.push({
      input: inputValue,
      expected_output: expectedOutputValue,
    });
  }

  // Validate pair count constraints (10-200 per spec)
  if (rows.length < 10 || rows.length > 200) {
    errors.push(`Training data must have between 10 and 200 pairs. Found ${rows.length} pairs.`);
  }

  return { rows, errors };
}

/**
 * Normalize column names to standard format
 * Supports both "input/expected_output" and "Input A/Correct Output"
 */
function normalizeColumnNames(headers: string[]): {
  input: number | null;
  expected_output: number | null;
} {
  let inputIndex: number | null = null;
  let expectedOutputIndex: number | null = null;

  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];

    // Match "input" or "Input A" (case-insensitive)
    if (header === 'input' || header === 'input a') {
      inputIndex = i;
    }

    // Match "expected_output", "expected output", "Correct Output" (case-insensitive)
    if (
      header === 'expected_output' ||
      header === 'expected output' ||
      header === 'correct output'
    ) {
      expectedOutputIndex = i;
    }
  }

  return {
    input: inputIndex,
    expected_output: expectedOutputIndex,
  };
}

/**
 * Parse CSV lines with support for quoted multiline values
 * Handles RFC 4180 CSV format:
 * - Fields with commas must be quoted
 * - Fields with quotes must escape quotes with double quotes
 * - Fields with newlines must be quoted
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
