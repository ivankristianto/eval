# UX Patterns: Error Display and Validation

This document defines standard patterns for displaying validation errors and user feedback across the LLM-as-a-Judge system.

## Error Display Patterns

### 1. Form Validation Errors (Inline)

**Location**: Directly below the form field with validation error

**Visual Pattern**:
```html
<div class="form-control">
  <label class="label">
    <span class="label-text">Field Name</span>
  </label>
  <input type="text" class="input input-error" />
  <label class="label">
    <span class="label-text-alt text-error flex items-center gap-1">
      <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
      </svg>
      Error message here
    </span>
  </label>
</div>
```

**Usage**:
- Client-side validation failures (required fields, format validation)
- Server-side validation errors returned during form submission
- Real-time validation feedback as user types

**Examples**:
- Persona name required
- CSV file format invalid
- Model selection incomplete (task, judge, prompt engineer all required)

### 2. API Submission Errors (Toast Notification)

**Location**: Top-right corner of the screen

**Visual Pattern**:
```typescript
// Using Toast component
showToast({
  type: 'error',
  title: 'Submission Failed',
  message: 'Could not save persona. Please try again.',
  duration: 5000,
});
```

**Usage**:
- Network errors during API calls
- Server-side errors after form submission
- Authentication/authorization failures
- Rate limiting errors

**Toast Types**:
- `error`: Red styling for errors
- `success`: Green styling for successful operations
- `warning`: Yellow styling for warnings
- `info`: Blue styling for informational messages

**Duration**:
- Errors: 5000ms (5 seconds) or until dismissed
- Success: 3000ms (3 seconds) or until dismissed
- Warnings: 4000ms (4 seconds) or until dismissed

### 3. CSV Upload Errors (Inline in Component)

**Location**: Within the CSV uploader component, below the file drop zone

**Visual Pattern**:
```html
<div class="csv-uploader">
  <div class="drop-zone">
    <!-- Upload UI -->
  </div>
  {error && (
    <div class="alert alert-error mt-4">
      <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>{error}</span>
    </div>
  )}
  {warnings.length > 0 && (
    <div class="alert alert-warning mt-2">
      <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <ul>{warnings.map(w => <li>{w}</li>)}</ul>
    </div>
  )}
</div>
```

**Usage**:
- CSV parsing errors (missing columns, invalid format)
- Row count validation (too few or too many rows)
- Duplicate row detection
- File size or type validation

**Error Messages**:
- Specific: "Column 'expected_output' is missing. Required columns: input, expected_output"
- Contextual: "Row 15: Invalid CSV format - expected 2 columns, found 3"

### 4. Critical Errors (Modal Dialog)

**Location**: Centered modal overlay

**Visual Pattern**:
```html
<dialog id="critical-error-modal" class="modal">
  <div class="modal-box">
    <h3 class="font-bold text-lg text-error">Critical Error</h3>
    <p class="py-4">{errorMessage}</p>
    <div class="modal-action">
      <button class="btn btn-primary" onclick="retry()">Retry</button>
      <button class="btn" onclick="closeModal()">Cancel</button>
    </div>
  </div>
</dialog>
```

**Usage**:
- 500 Internal Server errors
- Database connection failures
- Critical API failures that block core functionality
- Unhandled exceptions that prevent the page from functioning

**Behavior**:
- Blocks interaction with the page until dismissed
- Provides Retry button for transient failures
- Log error details for debugging (console or server logging)

## Error Message Guidelines

### Writing Error Messages

**Good Error Messages**:
1. **Specific**: "CSV must contain between 10 and 200 rows, but has 5 rows." (not "Invalid file")
2. **Actionable**: "Upload a CSV file with input and expected_output columns." (not "File format error")
3. **User-Friendly**: "We couldn't save your changes. Please try again." (not "Error 500: Internal Server Error")

**Structure**:
```
[What happened] + [Why it happened] + [How to fix it]
```

**Examples**:
- ✅ "Persona name already exists. Please choose a different name."
- ✅ "At least 10 training pairs required, but only 5 found. Upload more data to start training."
- ❌ "Validation failed."
- ❌ "An error occurred."

### Error Codes Reference

See `src/lib/error-codes.ts` for the complete list of error codes. Standardized error responses should include:

```typescript
{
  error: "Human-readable error message",
  code: "CSV_SIZE_INVALID",  // ErrorCode enum
  details: {
    min: 10,
    max: 200,
    actual: 5,
    requirement: "CSV must contain between 10 and 200 rows, but has 5 rows."
  },
  timestamp: "2025-12-29T14:30:00.000Z"
}
```

## Component Reference

### Toast Component

Import: `import { showToast } from '@lib/toast'` (if exists, or create)

Usage:
```typescript
showToast({
  type: 'error',
  title: 'Upload Failed',
  message: 'File size exceeds 10MB limit.',
});
```

### Alert Component (daisyUI)

```html
<div class="alert alert-error">
  <svg><!-- warning icon --></svg>
  <div>
    <h3 class="font-bold">Error!</h3>
    <div class="text-xs">Error message here.</div>
  </div>
</div>

<div class="alert alert-warning">
  <svg><!-- info icon --></svg>
  <span>Warning message here.</span>
</div>
```

### Modal Component (daisyUI)

```html
<dialog class="modal">
  <div class="modal-box">
    <h3 class="font-bold text-lg">Title</h3>
    <p class="py-4">Message</p>
    <div class="modal-action">
      <button class="btn">Action</button>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button>close</button>
  </form>
</dialog>
```

## Testing

### Verifying Error Display Patterns

Test file: `tests/integration/validation-error-patterns.test.ts`

Tests should verify:
1. Form validation errors appear inline below fields
2. API errors trigger toast notifications
3. CSV upload errors appear inline in the uploader component
4. Critical errors (500) display modal dialogs
5. All error messages are specific and actionable

## Related Documentation

- `src/lib/error-codes.ts`: Error code definitions and factory functions
- `specs/007-llm-as-judge/spec.md`: Functional requirements for error handling
- `specs/007-llm-as-judge/data-model.md`: Data model and validation constraints
