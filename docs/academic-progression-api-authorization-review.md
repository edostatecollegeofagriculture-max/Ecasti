# Academic Progression API Authorization Review

## Scope

Review of the academic progression and curriculum routes mounted under
`/api/v1/academic-progression`. This review combines source-level inspection with an isolated HTTP middleware
integration harness. The harness uses synthetic in-memory identities and does
not mount the Neon-backed router or access institutional records.

## Authentication behavior

- Missing bearer token: `401`.
- Invalid or expired token: `401`.
- Deleted user: `401`.
- Deactivated or locked account: `403`.
- The middleware reloads the user from the current user store after token
  verification. Authorization therefore uses the current stored role, not the
  role claim embedded in the token.

## Route authorization matrix

| Route | Allowed roles | Additional scope / rule |
|---|---|---|
| `GET /students/:id/snapshot-eligibility` | SUPER_ADMIN, INSTITUTION_ADMIN, REGISTRAR, RECTOR | Institutional-level read; no student self-service |
| `POST /students/:id/curriculum-assignment` | INSTITUTION_ADMIN, REGISTRAR | ND student and admission cohort required |
| `GET /students/:id/curriculum-assignment` | Institutional roles, DEAN, HOD, EXAM_OFFICER, STUDENT | School/department scope; student may read own record only |
| `GET /students/:id/curriculum-exceptions` | Institutional roles, DEAN, HOD, EXAM_OFFICER, STUDENT | Same student academic-record scope |
| `POST /students/:id/curriculum-exceptions` | SUPER_ADMIN, INSTITUTION_ADMIN, REGISTRAR, STUDENT | Student may submit only for own record |
| `POST /curriculum-exceptions/:id/review` | REGISTRAR, SUPER_ADMIN | Independent Registry review |
| `POST /students/:id/progression/initialize` | INSTITUTION_ADMIN, REGISTRAR | ND student; current assignment/programme must match |
| `POST /students/:id/progression/advance` | INSTITUTION_ADMIN, REGISTRAR, RECTOR | ND student; progression programme must match required-course snapshots |
| `POST /students/:id/progression/management-pass` | RECTOR only | Explicit role equality check; SUPER_ADMIN is not accepted |

## SUPER_ADMIN behavior

The shared `requireRoles` middleware grants SUPER_ADMIN a global bypass for
routes that use it, even when SUPER_ADMIN is not repeated in that route's
allowed-role list. This currently permits SUPER_ADMIN to use assignment,
initialization, progression-advance, and Registry-review routes. This is
consistent with the application's existing global-administrator convention,
but it is a broad privilege and should be an explicit institutional policy
decision. The Rector management-pass endpoint deliberately does not use
`requireRoles`; it checks for the exact RECTOR role and denies SUPER_ADMIN.

Programme-scoped curriculum mapping endpoints additionally apply programme
scope checks. Student assignment and exception reads apply school,
department, or own-record checks.

## Corrections made in this review

- Progression advance now rejects a missing student and non-ND programme before
  attempting a decision.
- Rector management-pass now rejects a missing student and non-ND programme
  before attempting approval.
- Re-initialization now rejects an existing progression record if its
  programme differs from the supplied student programme.
- Advance and management-pass service transactions now verify that each
  effective required-course snapshot belongs to the same programme recorded
  on the progression row.
- Programme consistency failures are returned as conflict responses rather
  than generic service-unavailable responses.

## Remaining verification before production

The HTTP middleware harness now exercises missing, invalid, expired, and
deleted-user tokens (401); deactivated and locked accounts (403); role guards;
student own-record boundaries; Dean school scope; HOD and Exam Officer
department scope; Registry review role policy; the shared SUPER_ADMIN bypass;
and the exact Rector-only management-pass guard.

The following still require full integration testing against a disposable
application/database environment:

1. Mount the actual academic progression router and verify the assignment and
   exception endpoints return the expected responses for cross-student and
   out-of-scope requests.
2. Verify the actual exception-review route with each relevant role and its
   persisted review outcome.
3. Verify the actual management-pass endpoint only succeeds for an eligible
   Extension Year 3 student, and fails for all other progression stages.
4. Verify missing and unpublished results never count as passed in API
   decisions.
5. Verify a progression record whose programme differs from its effective
   snapshots cannot advance or receive a management pass.
6. Verify the result store and Neon snapshot store refer to the same student
   and programme at decision time.

No production data was read or changed during this source review. The review
does not authorize production migrations, database writes, deployment, or PR
merge.

## Automated authorization policy tests

The shared authorization predicates now live in
`server/academicProgressionAuthorization.ts`. The academic-record scope checks,
student exception ownership rule, exact Rector-only management-pass rule, and
global SUPER_ADMIN role bypass are exercised by:

```powershell
npm run test:academic-progression-authorization
```

The HTTP integration command is:

```powershell
npm run test:academic-progression-http-authorization
```

It starts a short-lived Express server on an ephemeral loopback port, creates
signed test tokens, and injects synthetic users through the same authentication
middleware factory used by the application. It does not import the JSON
database, load .env credentials, connect to Neon, or write persistent records.
The HTTP routes are a test harness around the production authentication and
authorization middleware/predicates; they are not the full Neon-backed
academic router. Full route/database integration remains a pre-production
requirement.


## Full academic API integration harness

The guarded temporary API integration test is available as:

```powershell
npm run test:academic-progression-api:temporary
```

This test imports and mounts the actual academic progression API router,
including the nested curriculum mapping router. It exercises the HTTP
endpoints for curriculum mapping preparation/review, student assignment and
read scope, student exception submission/review, snapshot eligibility,
progression initialization and advancement, normal graduation, and the
Rector-only Extension Year 3 management pass.

Isolation safeguards:

- It refuses to run unless `DATABASE_URL` points to the specifically
  confirmed disposable Neon branch `edocasti-migration006-test` and the
  operator types `TEMPORARY`.
- Student, programme, cohort, and course identifiers are uniquely tagged `TEST-API-`. Service-generated mapping, assignment, exception, and history IDs are linked only to those synthetic records on that branch.
- It points the application's JSON database at a newly created OS temporary
  fixture containing synthetic test users, students, programme, department,
  courses, and results. The normal `data/edocasti_db.json` is not opened,
  read, or modified.
- It sets a process-local test JWT secret, starts Express on an ephemeral
  loopback port, closes the server and Neon pool, and removes the temporary
  JSON fixture when finished.
- Neon test rows are intentionally retained on the disposable branch for
  review; discard the temporary branch after reviewing the test output.

The harness checks that the required migration tables exist before making
API requests. It does not run migrations, access production, merge the pull
request, or deploy the application. Full testing of production authentication
provider behavior, external integrations, and deployment configuration
remains outside this isolated harness.
