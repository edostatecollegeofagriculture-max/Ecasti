# Neon core entities and legacy finance schema design

Status: **design proposal only**. This document does not create or alter database objects, import records, change application runtime behavior, or authorize production cutover.

## 1. Design objectives

1. Establish Neon as the future relational source for core institutional entities while preserving existing application identifiers.
2. Preserve historical admissions attribution and legacy finance records without inventing relationships or changing historical statuses.
3. Keep the existing itemized fee workflow separate from the legacy invoice/payment workflow.
4. Make unresolved source relationships explicit and reviewable; never manufacture placeholder schools, students, invoices, or users.
5. Support a staged migration with dry-run, reconciliation, rollback, and an explicit institution-approved cutover.

## 2. Proposed core relational model

Create these tables in a future, separately reviewed migration, using the existing JSON entity IDs as TEXT primary keys during transition:

- `schools(id, code, name, dean_user_id, description, image_url, created_at, updated_at)`
  - Unique school code.
  - `dean_user_id` nullable until the dean identity is verified.
- `departments(id, school_id, code, name, description, ...)`
  - `school_id` references `schools(id)` with `ON DELETE RESTRICT`.
  - Unique department code within its school, subject to confirmation of current code semantics.
- `users(id, email, full_name, role, ...)`
  - Preserve the existing user ID. Normalize email only after confirming current uniqueness/case rules.
  - Authentication credential hashes require a separate security review; never log or export them in diagnostics.
- `programmes(id, department_id, code, name, award, duration, ...)`
  - `department_id` references `departments(id)` with `ON DELETE RESTRICT`.
- `courses(id, department_id, programme_id, code, title, credit_units, level, semester, ...)`
  - Department and programme references should be enforced only after the source relationships and nullable semantics are verified.
- `students(id, user_id, school_id, department_id, programme_id, matric_number, ...)`
  - Preserve existing student and user IDs.
  - `user_id`, school, department and programme references should use `ON DELETE RESTRICT`; enforce uniqueness for matriculation number only after confirming historical uniqueness rules.
- `admission_applications(id, user_id, programme_id, status, reviewer_user_id, reviewer_display_snapshot, decision_at, ...)`
  - `reviewer_user_id` nullable and references `users(id)`.
  - `reviewer_display_snapshot` preserves the current `reviewedBy` string exactly as historical attribution.
  - Do not parse the current display label into a user ID. New decisions should write both the authenticated actor ID and a display snapshot.

All core foreign keys should be added only after a read-only validation confirms that the source data satisfies the proposed constraints. Use `ON DELETE RESTRICT` for institutional and academic records; prefer explicit archival/deactivation over cascading deletion.

## 3. Reviewer attribution finding and treatment

The admissions decision handler currently sets `reviewedBy` to a display string built from the authenticated user's full name and role. The authenticated user's stable ID is separately available to the audit log. Therefore, exact comparisons of `reviewedBy` to user ID, email, or full name are not valid foreign-key resolution tests.

Migration treatment:
- Copy the old `reviewedBy` value into `reviewer_display_snapshot` without rewriting it.
- Leave `reviewer_user_id` NULL for historical rows unless a separately approved, unambiguous mapping is established.
- For new decisions, persist the authenticated actor's user ID in `reviewer_user_id` and retain a display snapshot.
- Keep the audit log as an independent record of the action and actor.

## 4. Legacy invoices and payments: separate historical ledger

The current legacy finance model has two entities:

### `legacy_invoices`

Suggested fields:
- `id TEXT PRIMARY KEY` — preserve existing invoice ID.
- `invoice_number TEXT NOT NULL` — preserve the displayed invoice number.
- `student_id TEXT NOT NULL` — reference the migrated student after reconciliation.
- `session TEXT NOT NULL`, `title TEXT NOT NULL`.
- `amount NUMERIC(12,2) NOT NULL`, `amount_paid NUMERIC(12,2) NOT NULL`.
- `status TEXT NOT NULL` — preserve the original status; do not silently recalculate it during import.
- `due_date`, `created_at` — preserve source timestamps and date semantics.

### `legacy_payment_transactions`

Suggested fields:
- `id TEXT PRIMARY KEY` — preserve existing payment ID.
- `reference TEXT NOT NULL` — preserve the transaction reference.
- `invoice_id TEXT NOT NULL`, `student_id TEXT NOT NULL`.
- `amount NUMERIC(12,2) NOT NULL`.
- `channel TEXT NOT NULL`, `status TEXT NOT NULL`.
- `provider_reference TEXT`, `paid_at TIMESTAMPTZ`, `verified_by_display TEXT`.

Constraints and safeguards:
- After validation, `invoice_id` references `legacy_invoices(id)` and `student_id` references `students(id)`, both with `ON DELETE RESTRICT`.
- Add a composite consistency constraint or validation trigger so a payment's student must equal the invoice's student; a simple independent FK on each column is insufficient to guarantee that pairing.
- Do not assume `reference` is globally unique until its generation and historical uniqueness are validated.
- Preserve the source payment status and verification display exactly. Do not promote `VERIFIED` to a trusted settlement state based only on the JSON status.
- Reconcile payment status and provider references against authoritative gateway/bank records through a finance-approved process before treating them as settled.

The current `/finance/pay` handler selects an invoice and copies that invoice's ID and student ID into the new transaction. It marks the payment `VERIFIED` and the invoice `PAID`, but the handler inspected does not itself demonstrate an external gateway verification call. Treat this as legacy application behavior, not independent settlement evidence.

## 5. Keep the itemized fee ledger separate

The existing Neon tables `student_fee_obligations`, `student_payments`, and `student_payment_allocations` represent itemized fee obligations, staff-recorded payments, and allocation against obligations. The `recordFeePayment` service requires an outstanding obligation and writes the payment and allocations transactionally.

These are not equivalent to the legacy `Invoice` and `PaymentTransaction` entities. In particular:
- Do not copy legacy invoices into `student_fee_obligations`.
- Do not copy legacy payments into `student_payments`.
- Do not generate new fee allocations from historical invoice balances without a finance-approved conversion and reconciliation plan.
- If a later institution-approved process creates opening balances, record them as a separately auditable conversion with explicit source lineage; never rewrite the historical payment ledger.

## 6. Current source blockers and migration disposition

| Source relationship | Current finding | Safe disposition |
|---|---|---|
| `departments.schoolId` → schools | Source schools collection was empty; department references unresolved | Block import of departments until the authoritative school master is restored from an approved source and reconciled. |
| `students.schoolId` → schools | Student school reference unresolved while schools collection is empty | Block student import until the school mapping is resolved. |
| `applications.reviewedBy` → users | Field is a display label, not a stable user key | Preserve as display snapshot; nullable user FK unless separately mapped. |
| `payments.studentId` → students | Unresolved source references | Quarantine affected payment rows from relational import pending reconciliation. |
| `payments.invoiceId` → invoices | Unresolved source references | Quarantine affected payment rows from relational import pending reconciliation. |

The observed payment-reference mismatches are inconsistent with the normal route's invoice-derived assignment, but aggregate diagnostics cannot establish whether invoices/students were deleted, records originated from another code path/version, or the source is inconsistent. Do not infer a repair.

## 7. Recommended migration sequence

1. Approve the entity definitions and canonical business keys with the institution's Registrar, Admissions, ICT, and Finance owners.
2. Confirm the authoritative school master source and resolve school relationships outside the migration script.
3. Add core tables additively on a temporary Neon branch. Do not add restrictive FKs until source validation passes.
4. Build a dry-run importer that emits aggregate counts, field-type counts, duplicate counts, matched/unmatched reference counts, and checksums only. It must not print row values, personal data, password hashes, payment references, or credentials.
5. Route unresolved source rows into a restricted migration-exception report using non-identifying row ordinals or opaque migration tokens; keep source values local and access-controlled.
6. Import parent entities before dependent entities in bounded transactions, preserving original IDs and timestamps.
7. Reconcile counts and checksums, verify relational constraints, and run application integration tests against the temporary Neon branch.
8. Have authorized institutional owners review exceptions and finance reconciliation evidence.
9. Only after separate explicit approval, plan production backup, deployment, cutover, rollback, and JSON retirement. This design document grants none of those approvals.

## 8. Explicit non-goals

This proposal does not:
- Read, modify, repair, or delete JSON database records.
- Create placeholder school, student, invoice, payment, or user rows.
- Convert historical invoices/payments into itemized fee obligations/payments.
- Change historical payment verification statuses.
- Enable the authoritative academic result source.
- Execute SQL, import data, deploy services, merge the pull request, or retire the JSON store.

## Implementation status: additive migration 010 drafted

The proposal is now represented by `database/migrations/010_core_entities_and_legacy_finance.sql` on the feature branch. It creates empty tables for schools, users, departments, programmes, courses, admission applications, students, legacy invoices, and legacy payment transactions. It preserves the existing text IDs and source timestamp strings, uses restrictive foreign keys, stores reviewer display attribution separately from the nullable reviewer user ID, and enforces invoice/student pairing for legacy payments with a composite foreign key.

**Not executed or validated against Neon yet.** This is an additive DDL file only; it does not seed schools, import JSON rows, update existing records, or alter the existing fee-management tables. Before applying it to the temporary Neon branch, run a SQL syntax/schema review and verify PostgreSQL compatibility, then apply only to the temporary branch and inspect the resulting empty-table schema. Do not run against production. The current source-data blockers remain import blockers even after the tables exist.
