# JSON-to-Neon Migration Inventory and Cutover Plan

**Scope:** feature branch only. This document records the architecture observed during the migration review and defines the safe order for subsequent work. It does not move, inspect, export, or delete application records.

## Current verified architecture

- The runtime JSON store is implemented by `server/db.ts`. Its default path is `data/edocasti_db.json`; tests may override it with `EDOCASTI_DATA_FILE`.
- `DatabaseEngine` loads the JSON file into an in-memory `DatabaseState`. `getState()` returns that in-memory state and `saveState()` rewrites the complete JSON document. The loader can also add seed data and default values to an existing file.
- The JSON state contains these domains: settings; users; schools; departments; programmes; courses; admission applications; students; course registrations; assessment results; fee schedules; invoices; payment transactions; attendance; support tickets; audit logs; news articles; hero slides; page content; issued documents; and fee catalog, schedule, obligation, payment, and allocation collections.
- `server/authMiddleware.ts` resolves authenticated users from `db.getState().users`. Login, applicant registration, profile updates, failed-login counters, and last-login timestamps in `server/apiRouter.ts` also read or mutate JSON state.
- `server/apiRouter.ts` still uses JSON state for general search and many operational routes. The ordinary result workflow is not yet wholly Neon-authoritative.
- `server/feeApiRouter.ts` uses Neon-backed fee services, but still resolves a student's identity through the JSON students collection. Fee management is guarded by `FEE_MANAGEMENT_ENABLED`.
- `server/academicProgressionApiRouter.ts` uses Neon for curriculum snapshots, exceptions, and result-ledger operations, but still reads students, programmes, and courses from JSON for identity and authorization context.
- Academic result attempt/event ledger work exists in Neon. The authoritative result-source readiness guard remains deliberately disabled; progression decisions must remain unavailable until result synchronization and freshness are proven.
- `server/neon.ts` requires `DATABASE_URL` at runtime and creates the PostgreSQL pool. Production environment configuration has not been verified in this review.

## Domain inventory and migration order

| Priority | Domain | Current JSON dependency / observed Neon status | Required exit condition |
|---|---|---|---|
| 0 | Migration controls | JSON file is still the runtime store; Neon connection is configured by environment | Reproducible schema inventory, backup/restore procedure, dry-run report, idempotent importer, row-count and deterministic checksum comparison |
| 1 | Identity and authorization | Users and authentication lookup remain JSON-backed | Neon user/role/department/school records; secure password-hash preservation; lockout and profile behavior; authorization parity tests; no credentials in logs |
| 2 | Organization and academic catalogue | Schools, departments, programmes, and courses are JSON-backed and are dependencies for many other domains | Stable IDs and foreign keys; catalogue parity; uniqueness and relationship validation; no seed-on-read side effects |
| 3 | Students and admissions | Student and application records remain JSON-backed; progression and fee routes still depend on student lookups | Student-to-user and student-to-programme relationships verified; admission lifecycle and student identity tests; privacy-safe dry-run counts |
| 4 | Course registration and academic results | Registration remains JSON-backed; ordinary result workflows remain JSON-backed; separate Neon academic result attempt/event ledger exists | Full result lifecycle and legacy-history reconciliation; authoritative source watermark/freshness; event audit and idempotency; progression rules verified before readiness flag changes |
| 5 | Fees and payments | Fee catalog/schedules/obligations/payments have Neon service paths; legacy fee state and student identity lookups remain | Reconcile invoices, transactions, obligations, allocations, references, and balances; provider idempotency; no double posting; finance sign-off |
| 6 | Attendance and support | Attendance and support tickets are represented in JSON state | Neon schemas and APIs; ownership/role access tests; message and attendance-history parity |
| 7 | Audit and institutional content | Audit logs, settings, news, slides, page content, and issued documents remain in JSON state | Durable append-only audit policy; content versioning/publication behavior; settings validation; issued-document numbering and retrieval tests |
| 8 | Cutover and retirement | JSON store is still active | All production routes use Neon; parity and recovery drills pass; read-only observation period; explicit operator approval; only then disable JSON writes and plan archival/removal separately |

## Mandatory migration safeguards

1. **No production data operation during development.** Use a disposable Neon branch and synthetic fixtures for integration tests.
2. **Do not upload real JSON data or database credentials.** The importer must run locally or in a controlled environment with secrets supplied through environment variables.
3. **Inventory before import.** Report collection names, record counts, null/duplicate key counts, orphan relationship counts, and schema-version information. Do not print row contents, names, emails, phone numbers, payment references, password hashes, or other personal data.
4. **Dry-run by default.** The default command must perform read-only validation and produce aggregate counts and deterministic per-collection checksums. A separate explicit flag should be required to write to a disposable target.
5. **Idempotency.** Use stable source IDs and unique constraints. Re-running an import must not create duplicates or overwrite a conflicting Neon record silently.
6. **Transactional batches.** Each logical batch must commit atomically and record a migration-run identifier, source checksum, destination count, and completion state.
7. **Conflict handling.** Any duplicate identifier, orphan foreign key, invalid enum, malformed timestamp, or conflicting existing target row must stop that collection and appear in the report; do not silently coerce or discard.
8. **Verification.** Compare source and target counts and deterministic checksums, plus relationship and domain-specific invariants. Counts alone are insufficient.
9. **Rollback.** Prefer abandoning/recreating a disposable target branch during testing. For a production migration, require a verified backup and a documented restore rehearsal before any write.
10. **Cutover gate.** Do not dual-write blindly. Define one authoritative writer per domain, an outbox/reconciliation strategy where needed, and a tested freeze/cutover sequence before changing runtime reads or writes.
11. **Retirement gate.** Keep the original JSON file archived and access-controlled until production parity, backup, restore, audit, and operator acceptance are complete. Deletion is a separate explicitly approved action.

## Next implementation slice

The next code change should be a **read-only migration preflight tool** that:
- loads the configured JSON file without calling `saveState()` or changing it;
- validates the top-level collection shape and stable IDs;
- computes aggregate counts, duplicate-ID counts, orphan-reference counts, and deterministic checksums without printing record values;
- optionally compares those aggregates with an explicitly selected disposable Neon target;
- emits a machine-readable report with a clear PASS / REVIEW / BLOCKED status;
- refuses to write to Neon.

Before implementing target comparisons, inspect the actual migration DDL and service schemas to establish the exact target table/column mapping. Do not infer a target schema from TypeScript interface names.

## Out of scope for this stage

- Importing real records.
- Changing production database state or environment variables.
- Switching application reads or writes to Neon.
- Enabling authoritative academic progression.
- Deploying, merging the pull request, or deleting/renaming the JSON database.
