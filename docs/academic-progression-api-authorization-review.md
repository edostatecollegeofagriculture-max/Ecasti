# Academic Progression API Authorization Review

## Scope

Review of the academic progression and curriculum routes mounted under
`/api/v1/academic-progression`. This is a source-level review; it is not a
substitute for HTTP integration tests against a disposable test environment.

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

HTTP-level tests still need to exercise:

1. Missing/invalid token returns 401; inactive/locked account returns 403.
2. Student A cannot read Student B's assignment or exception list.
3. DEAN/HOD/EXAM_OFFICER cannot read outside their school/department.
4. Non-Registrar cannot review an exception.
5. SUPER_ADMIN behavior matches the institution's approved global-bypass
   policy on each route.
6. SUPER_ADMIN and all non-RECTOR roles receive 403 for management-pass;
   a Rector may proceed only for an Extension Year 3 student.
7. Missing and unpublished results never count as passed.
8. A progression record whose programme differs from its effective snapshots
   cannot advance or receive a management pass.
9. The result store and Neon snapshot store refer to the same student and
   programme at decision time.

No production data was read or changed during this source review. The review
does not authorize production migrations, database writes, deployment, or PR
merge.
