# Data Model: UI/UX Improvements

**Feature**: UI/UX Improvements
**Status**: Stable

## Database Schema (SQLite)

*No changes to existing table structure required.*

### Entity: Evaluation (Existing)
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | PK |
| instruction_text | TEXT | |
| accuracy_rubric | TEXT | Filterable |
| created_at | DATETIME | Filterable |
| status | TEXT | |

### Entity: Result (Existing)
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | PK |
| evaluation_id | UUID | FK -> Evaluation.id |
| accuracy_score | REAL | Aggregate used for filtering |

## Client-Side State (localStorage)

### UserPreferences
Stored key: `eval_user_prefs`

```typescript
interface UserPreferences {
  theme: 'silk' | 'luxury' | 'cupcake' | 'nord';
  pagination: {
    itemsPerPage: 10 | 20 | 50 | 100;
    currentPage: number;
  };
}
```
