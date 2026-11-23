# Academic progression result evaluation

## Current source boundary

- Effective required courses are read from immutable student requirement snapshots in Neon.
- Examination result records and publication status are read from the existing application result store (db.getState().results).
- Missing and unpublished results do not count as passes.
- The metadata audit cannot establish that the local result store is synchronized with Neon. This remains an operational/source-of-truth dependency and must be reviewed before production rollout.

## Shared evaluation rule

The eligibility preview, progression advancement, and Extension Year 3 management-pass calculation now use server/academicResultEvaluation.ts.

A course is considered passed when at least one published attempt has a finite total score greater than or equal to the configured pass mark (currently 40). If no published attempt passes, the latest published attempt is reported as failed. If there are no published attempts, the course is distinguished as unpublished-only or missing entirely.

This preserves the pre-existing application behavior. It does not decide that a later failed attempt revokes an earlier pass. That is an academic policy decision and should be confirmed by the institution before changing the evaluator.

## Verification

Run the pure evaluator checks with:

```powershell
npm run test:academic-result-evaluation
```

These tests cover missing, unpublished, failed, exactly-at-pass-mark, invalid-score, earlier-pass/later-fail, and latest-failure cases. They do not replace API-level authorization tests or isolated Neon workflow tests.
