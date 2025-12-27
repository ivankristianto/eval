# Contract: Templates CSV Format

**File Path**: `db/templates.csv`
**Format**: RFC 4180 compliant CSV
**Header Row**: Required

## Columns

| Column Name | Type | Required | Description | Example |
|-------------|------|----------|-------------|---------|
| `name` | String | Yes | Unique name | `Recipe Generator` |
| `description` | String | No | Description | `Tests ability to generate recipes` |
| `instruction_text` | String | Yes | The prompt | `Write a recipe for chocolate cake.` |
| `accuracy_rubric` | String | Yes | One of: `exact_match`, `partial_credit`, `semantic_similarity` | `partial_credit` |
| `expected_output` | String | No | Reference output | `Ingredients: Flour, Sugar...` |
| `partial_credit_concepts` | JSON | No | JSON array of concepts | `["flour", "sugar", "bake"]` |

## Example Content

```csv
name,description,instruction_text,accuracy_rubric,expected_output,partial_credit_concepts
"Basic Math","Tests simple addition","What is 2 + 2?","exact_match","4",
"Haiku","Creative writing","Write a haiku about code.","semantic_similarity","Code flows like a stream
Bugs vanish in the clear water
Deploy Friday night",
"Recipe","Structured output","Make a cookie recipe","partial_credit",,"["flour", "sugar", "butter"]"
```

## Validation Rules

1. **`accuracy_rubric`**: Must match the enum values in the database schema.
2. **`partial_credit_concepts`**: Must be a valid JSON array string if provided.
3. **`name`**: Must be unique within the CSV (and DB).
