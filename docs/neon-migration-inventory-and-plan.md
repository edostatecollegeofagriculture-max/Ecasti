# EDOCASTI Neon harmonization: persistence inventory and execution plan

## Scope and release status

Target runtime:
- Vercel: React/Vite frontend.
- Render: Node/Express TypeScript API.
- Neon: authoritative PostgreSQL persistence.

This document records the source-level persistence inventory for the current feature branch. It is not evidence that the application-wide migration is complete. Production traffic must not be switched to this branch yet.

## Confirmed current persistence boundaries

| Area | Current implementation | Migration state |
|---|---|---|
| Core portal data | `server/db.ts` loads and writes `data/edocasti_db.json` through `DatabaseEngine` | Not migrated |
| Core REST API | `server/apiRouter.ts` imports the JSON `db` singleton; source inspection found approximately 105 `db.getState()` reads and 70 `db.saveState()` writes | Not migrated |
| Fee catalog, schedules, obligations and payment allocation | Dedicated services use `neonPool` and PostgreSQL transactions | Partially migrated; some route-level student/programme lookups still use JSON |
| Academic curriculum/progression | Dedicated Neon-backed tables/services exist; API router still reads student/course/result state through the JSON singleton | Partially migrated |
| Examination results | Result routes and progression API currently depend on JSON-backed result state | Not migrated; authoritative result freshness remains a production blocker |
| Authentication and user directory | Core user lookup/profile/auth routes depend on JSON-backed state | Not migrated |
| Admissions and student records | Core API routes depend on JSON-backed state | Not migrated |
| Course registration, attendance, support tickets, news/content, documents and institution settings | Core API routes depend on JSON-backed state | Not migrated |
| Legacy Python backend | Not part of the current root TypeScript package build/deployment configuration; confirm whether it is still operational before decommissioning | Ownership/usage to be verified |

The route-level source counts are static references, not runtime traffic counts. They are useful for scoping but are not a substitute for endpoint-by-endpoint tests.

## Immediate academic-result safety gate

The current progression API has an explicit hard-disabled guard on all three result-dependent operations: read-only snapshot eligibility, progression advancement, and Extension Year 3 management-pass approval. These endpoints return HTTP 503 with `AUTHORITATIVE_RESULT_SOURCE_UNAVAILABLE` until the Neon result source is implemented and verified. This prevents stale JSON-backed results from being represented as authoritative or used to graduate/advance a student.

The gate is intentionally a source-code constant, not an environment toggle. Do not enable it by setting a Render variable. It may only be removed in a reviewed code change after the Neon result schema, append-only publication/invalidation workflow, freshness watermark, migration/reconciliation tooling, and endpoint integration tests are complete.

## Required migration sequence

### Phase 1 — Platform foundation
- Establish Vercel/Render/Neon environment separation.
- Keep secrets server-side on Render.
- Configure exact-origin CORS and health/readiness checks.
- Maintain independent development, temporary/test and production Neon databases.
- Add migration ledger, schema version checks and safe pool shutdown/readiness behavior.

### Phase 2 — Identity and institutional master data
- Migrate users, roles, schools, departments, programmes, courses and institution settings.
- Add relational constraints and indexes.
- Move authentication, profile, user administration and academic master-data routes to repositories.
- Preserve existing password hashes only through a secure, local, controlled migration process; never export credentials into source control or chat.
- Verify role/scope enforcement at API level.

### Phase 3 — Admissions and student lifecycle
- Migrate applications, student profiles, admission decisions and student creation.
- Use transactions for offer acceptance and student activation.
- Verify unique application/matriculation identifiers and audit events.

### Phase 4 — Academic operations
- Migrate course registrations, attendance, result entry, verification, approval and publication.
- Make published results and invalidation/cancellation events authoritative in Neon.
- Add result-source version/freshness metadata and fail-closed progression checks.
- Preserve the approved ND/extension progression rules and immutable history.

### Phase 5 — Finance and documents
- Complete fee/payment migration and connect all student/programme/user references with verified foreign keys.
- Reconcile invoices, transactions, obligations, allocations, receipts and balances.
- Migrate issued-document metadata and verify document generation/access controls.
- Confirm payment idempotency and audit trails under concurrent requests.

### Phase 6 — Remaining portal modules
- Migrate support tickets, news, page content, slider configuration, calendar/FAQ content and other institution settings.
- Verify audit log retention and administrative reporting.
- Remove every runtime dependency on the JSON singleton.

### Phase 7 — Cutover
- Run a local, user-controlled migration against a verified backup.
- Compare per-table counts, key relationships, monetary totals, published-result totals and checksums without exposing personal records.
- Run the full test suite against a temporary Neon branch.
- Freeze writes for the final copy, reconcile again, then switch Render to the production Neon connection.
- Verify Render readiness and Vercel-to-Render API behavior.
- Keep the original JSON backup untouched until an approved retention period and recovery plan have elapsed.

## Mandatory acceptance criteria

- No production API route imports or reads/writes the JSON database.
- No production startup path initializes or seeds the JSON database.
- All business data is stored in Neon with appropriate relational constraints and transaction boundaries.
- Every existing endpoint has an authorization and integration test.
- Results, admissions, registration, finance and payment workflows pass end-to-end tests.
- Data reconciliation reports zero unexplained differences.
- Production secrets exist only in Render/Neon secret configuration, never in Vercel client variables or Git.
- A rollback plan and verified backup exist before traffic is switched.

## Immediate deployment warning

The Render and Vercel configuration files added in this branch establish deployment wiring only. They do not migrate the JSON-backed core API. Do not deploy this version as the live production application or set the Render production database URL until all acceptance criteria above have passed.


## Migration 009 — authoritative academic result foundation

Migration `009_authoritative_academic_results.sql` adds a versioned Neon result-attempt store, append-only workflow events, a publication view, and a single source-freshness record. It is additive and deliberately imports no live or historical records. The initial freshness record is incomplete, so no application may treat the new source as authoritative until a controlled reconciliation establishes a complete source watermark and the integration layer verifies freshness.

Important semantics:

- Each result attempt is retained independently; a later failed attempt does not erase an earlier published pass.
- Published scores cannot be edited in place. Formal corrections require explicit invalidation/cancellation events with an actor and reason.
- Result events and attempts cannot be deleted or truncated.
- The published-results view includes attempts whose latest event remains `PUBLISHED`; consumers must also require a complete, sufficiently fresh `academic_result_source_sync` record.
- This schema is a foundation only. It does not migrate the JSON results, implement the event-writing API, prove reconciliation, or authorize enabling the progression endpoints. The hard fail-closed guard remains in place.
