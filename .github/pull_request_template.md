## Summary
<!-- Brief description of the changes (1-2 sentences) -->

---

## Type of Change
<!-- Mark one with an "x" -->

- [ ] Feature (new functionality)
- [ ] Bugfix (fixes existing issue)
- [ ] Refactor (restructuring existing code)
- [ ] Test (adding/updating tests)
- [ ] Documentation (docs only)
- [ ] Chore (build/config/dependencies)
- [ ] Performance improvement
- [ ] UI/UX improvement

---

## Related Issues
<!-- Link to related issues using "Closes #123" or "Relates to #123" -->

Closes #
Relates to #

---

## Detailed Description
<!-- Explain what changes were made and why. Include screenshots for UI changes. -->

### Changes Made
- <!-- List key changes -->

### Technical Details
- <!-- Any technical notes or implementation details -->

---

## Test Coverage
<!-- Describe testing performed -->

### Tests Added
- <!-- List new test files or test cases -->

### Tests Ran
- [ ] Unit tests (`npm test`)
- [ ] Integration tests (`npm test -- tests/integration/`)
- [ ] E2E tests (`npm run test:e2e`)
- [ ] Manual testing

### Test Results
<!-- Report test pass/fail status -->
- All tests pass: [ ] Yes / [ ] No
- Coverage impacted: [ ] Yes / [ ] No

---

## Breaking Changes
<!-- Mark if this change breaks existing functionality -->

- [ ] Yes - describe below
- [ ] No

### Migration Steps
<!-- If breaking changes, explain how users should migrate -->

---

## Pre-commit Quality Gates
<!-- ALL items must be checked before committing -->

- [ ] **Lint**: `bun run lint` passes
- [ ] **Typecheck**: `npm run typecheck` passes
- [ ] **Format**: `npm run format:check` passes (or run `npx prettier --write ...` to fix)
- [ ] **Tests**: `npm test` passes
- [ ] **Build**: `npm run build` succeeds

---

## Screenshots (if applicable)
<!-- Add screenshots for UI changes -->

| Before | After |
|--------|-------|
| <!-- Image --> | <!-- Image --> |

---

## Additional Context
<!-- Any other information reviewers should know -->

### Dependencies
- <!-- List any new dependencies added -->

### Configuration Changes
- <!-- List any config file changes (.env.example, etc.) -->

### Database Changes
- <!-- List any schema changes or migrations -->

### Performance Impact
- <!-- Note any performance implications -->

---

## Checklist
<!-- Mark all that apply -->

- [ ] My code follows the style guidelines in CLAUDE.md
- [ ] I have performed a self-review of my code
- [ ] I have commented my code where necessary (JSDoc for public APIs)
- [ ] I have updated the documentation (if applicable)
- [ ] My changes generate no new warnings
- [ ] I have tested locally with the dev server running
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing tests pass locally
- [ ] I have checked the build succeeds
- [ ] Any dependent changes have been merged and published
