# Async Metrics Calculation UX

This document describes the async metrics calculation feature for the LLM-as-Judge training system.

## Overview

The async metrics calculation feature provides a non-blocking user experience when calculating training metrics. Instead of waiting synchronously for metrics to be computed (which can take several seconds for large datasets), users receive immediate feedback and are redirected to a metrics dashboard with live progress updates.

## User Flow

### 1. Review Completion
- User completes all human reviews for iteration 1
- System displays "All decisions reviewed" success message
- "Calculate Metrics" button becomes available

### 2. Initiate Calculation
- User clicks "Calculate Metrics" button
- System makes POST request to `/api/personas/{id}/iterations/{num}/calculate-metrics`
- Response: `202 Accepted` with immediate return
- Background job starts calculating metrics asynchronously

### 3. Redirect to Metrics Page
- User is redirected to `/personas/{id}/metrics?iteration={num}`
- Page displays "The training in progress" message
- Loading spinner indicates active calculation
- Progress bar shows estimated completion percentage

### 4. Polling for Status
- Client-side polling checks status every 1-2 seconds
- Uses exponential backoff (1s → 2s → 4s → ...)
- Status endpoint: `GET /api/personas/{id}/iterations/{num}/status`

### 5. Completion
- When status changes to "completed":
  - Page reloads to show metrics dashboard
  - F1 Score, Precision, Recall, Cohen's Kappa displayed
  - Confusion matrix visualization shown
- When status changes to "error":
  - Error message displayed
  - Retry button shown

## API Endpoints

### POST /api/personas/{id}/iterations/{num}/calculate-metrics

Initiates async metrics calculation.

**Request:**
```json
POST /api/personas/persona-123/iterations/1/calculate-metrics
Content-Type: application/json
```

**Response (202 Accepted):**
```json
{
  "status": "in_progress",
  "iteration": 1,
  "persona_id": "persona-123",
  "message": "Metrics calculation started. Poll /status endpoint for completion.",
  "started_at": "2025-12-29T10:00:00.000Z"
}
```

**Error Responses:**
- `400 Bad Request`: Invalid parameters or incomplete human review
- `404 Not Found`: Persona or iteration doesn't exist
- `409 Conflict`: Calculation already in progress

### GET /api/personas/{id}/iterations/{num}/status

Poll for calculation status.

**Response (200 OK):**

Calculating:
```json
{
  "status": "calculating",
  "iteration": 1,
  "persona_id": "persona-123",
  "message": "The training in progress",
  "progress_percent": 45
}
```

Completed:
```json
{
  "status": "completed",
  "iteration": 1,
  "persona_id": "persona-123",
  "message": "Metrics calculated successfully",
  "metrics": {
    "f1_score": 0.85,
    "precision": 0.88,
    "recall": 0.82,
    "cohens_kappa": 0.78,
    "accuracy": 0.87,
    "confusion_matrix": {
      "true_positives": 45,
      "true_negatives": 35,
      "false_positives": 8,
      "false_negatives": 7
    }
  },
  "duration_ms": 2500,
  "calculated_at": "2025-12-29T10:00:02.500Z"
}
```

Error:
```json
{
  "status": "error",
  "iteration": 1,
  "persona_id": "persona-123",
  "message": "Database connection failed during calculation"
}
```

## Frontend Components

### MetricsCalculationProgress.astro
Displays progress state during calculation.

**Props:**
```typescript
interface Props {
  status: 'calculating' | 'completed' | 'error';
  message?: string;
  progressPercent?: number;
  iteration: number;
  personaId: string;
}
```

### MetricsPollingHook (metrics-polling-hook.ts)
Client-side polling hook with retry logic.

**Usage:**
```typescript
import { useMetricsPolling } from '@lib/metrics-polling-hook';

const { status, metrics, isLoading, error, stopPolling } = useMetricsPolling(
  personaId,
  iteration,
  {
    initialInterval: 1000,
    maxInterval: 2000,
    onStatusChange: (status) => { /* ... */ },
    onComplete: (metrics) => { /* ... */ },
    onError: (error) => { /* ... */ },
  }
);
```

## Error Handling

### Frontend Errors
- Network failures trigger automatic retry with exponential backoff
- Max retries: 3 attempts before showing error state
- User can manually retry by clicking "Retry" button

### Backend Errors
- Database errors during calculation are logged
- Iteration status set to "failed" with error message
- Error persists and can be retried via UI

### Conflict Resolution
- 409 Conflict if calculation already in progress
- Existing calculation continues; new request rejected
- User redirected to existing calculation's status page

## Performance Considerations

### Backend
- Metrics calculation runs in background (fire-and-forget)
- Does not block API response
- Uses SQLite transactions for crash recovery
- Progress checkpoints saved for resume capability

### Frontend
- Polling starts with 1-second interval
- Exponential backoff reduces server load
- Automatic cleanup when component unmounts
- Manual stopPolling() for page navigation

## Testing

### Unit Tests
- `tests/unit/metrics-polling-hook.test.ts` - Hook logic
- Retry behavior, exponential backoff, listener notifications

### Integration Tests
- `tests/integration/calculate-metrics-async.test.ts` - API endpoints
- Status transitions, error handling, concurrent requests

### E2E Tests
- `tests/e2e/async-metrics-calculation.test.ts` - Complete flow
- `tests/e2e/metrics-redirect-flow.test.ts` - Redirect behavior
- `tests/e2e/async-metrics-suite.test.ts` - Comprehensive suite

## Future Enhancements

1. **WebSocket Support**: Real-time updates instead of polling
2. **Progress Events**: Server-sent events for granular progress
3. **Background Notification**: Desktop notification when complete
4. **Multiple Iterations**: Parallel calculation support
5. **Partial Results**: Show partial metrics before full calculation complete
