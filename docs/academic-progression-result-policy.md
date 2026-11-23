# Academic progression result evaluation

## Current source boundary

- Effective required courses are read from immutable student requirement snapshots in Neon.
- Examination result records and publication status are read from the existing application result store (db.getState().results).
- Missing and unpublished results do not count as passes.
- The metadata audit cannot establish that the local result store is synchronized with Neon. This remains an operational/source-of-truth dependency and must be reviewed before production rollout.
- Approved policy: progression and graduation decisions must use the latest authoritative published result state. If that source is unavailable or its freshness/synchronization cannot be confirmed, the system must fail closed and must not automatically approve progression or graduation. The current local JSON result-store integration does not yet prove this freshness guarantee; this is a production release blocker until an authoritative read/synchronization mechanism is implemented and tested.

## Shared evaluation rule

The eligibility preview, progression advancement, and Extension Year 3 management-pass calculation now use server/academicResultEvaluation.ts.

A course is considered passed when at least one published attempt has a finite total score greater than or equal to the configured pass mark (currently 40). If no published attempt passes, the latest published attempt is reported as failed. If there are no published attempts, the course is distinguished as unpublished-only or missing entirely.

Approved institutional policy: an earlier published passing attempt remains valid even if a later attempt is failed. A later result may replace that pass only when the earlier result has been formally invalidated or cancelled through an authorised academic process. The evaluator therefore preserves any valid published pass; the application must not infer invalidation from a later lower score.

## Verification

Run the pure evaluator checks with:

```powershell
npm run test:academic-result-evaluation
```

These tests cover missing, unpublished, failed, exactly-at-pass-mark, invalid-score, earlier-pass/later-fail, and latest-failure cases. They do not replace API-level authorization tests or isolated Neon workflow tests.
The completed full academic API integration suite exercised the shared
evaluator through eligibility, progression advancement, and Rector-or-
SUPER_ADMIN management-pass endpoints and reported **25 PASS, 0 FAIL** on
the disposable Neon branch. The dedicated evaluator suite reported
**7 PASS, 0 FAIL**. The current temporary curriculum/progression workflow suite
reported **17 PASS, 0 FAIL**. These results do not establish freshness of the
local result store; fail-closed authoritative result synchronization remains
a production release blocker.
