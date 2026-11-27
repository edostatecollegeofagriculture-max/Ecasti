# EDOCASTI — Migration 010 Readiness Report

**Status:** BLOCKED — READ-ONLY AUDITS COMPLETE  
**Scope:** Local JSON source and Migration 010 schema  
**Migration:** `database/migrations/010_core_entities_and_legacy_finance.sql`  
**Source:** `data/edocasti_db.json`

## 1. Executive summary

The source has passed the audited numeric, date, enum, duplicate-ID, and populated relationship checks for the nine Migration 010 collections.

The import is not ready. Two required source values are empty, and the local PostgreSQL database does not yet contain the nine relational tables defined by Migration 010.

No migration or import has been executed.

## 2. Source inventory

| Collection | Records |
|---|---:|
| schools | 4 |
| users | 15 |
| departments | 10 |
| programmes | 12 |
| courses | 8 |
| applications | 1 |
| students | 4 |
| invoices | 4 |
| payments | 2 |
| **Total** | **60** |

The target table mapping is:

| Source collection | Migration 010 table |
|---|---|
| schools | schools |
| users | users |
| departments | departments |
| programmes | programmes |
| courses | courses |
| applications | admission_applications |
| students | students |
| invoices | legacy_invoices |
| payments | legacy_payment_transactions |

## 3. Audit results

### Passed checks

- Source stable IDs and audited uniqueness checks: no duplicates.
- Populated source relationships: 16 relationship checks, no missing references.
- Hierarchy consistency: no mismatches.
- Numeric checks: 8 fields checked, no violations.
- Date checks: 10 fields checked, no unparseable dates or missing required dates.
- Enumerated values: no violations in the audited fields.
- Programme requirements and application O-level results: valid arrays.
- Invoice/payment student and invoice relationships: matched.
- Timestamp formats: date-only and ISO date-time values identified consistently.

### Outstanding blockers

| Collection | Record ID | Field | Issue |
|---|---|---|---|
| applications | app-1795622937861 | phone | Empty required value |
| students | std-1795623290388 | emergencyContact | Empty required value |

These fields are `NOT NULL` in Migration 010.

Do not invent values, insert placeholders, or weaken the constraints to make the import pass. Obtain authoritative values or approve a separately reviewed schema/data policy.

### Separate reconciliation exception

Four legacy `feeSchedules` records lack `programmeId`.

These records are outside the nine Migration 010 target collections. They must be reconciled in the wider finance migration work; they should not be silently discarded or confused with the separate programme fee schedule tables.

## 4. Schema observations

- `users.email` has a non-unique case-insensitive index, not a database UNIQUE constraint.
- `courses.code` is not declared unique.
- `legacy_invoices.invoice_number` is not declared unique.
- `legacy_payment_transactions.reference` is not declared unique.
- The payment-to-invoice relationship uses a composite foreign key on `(invoice_id, student_id)`.
- Application `reviewedBy` is a display snapshot and maps to `reviewer_display_snapshot`, not `reviewer_user_id`.
- Payment `verifiedBy` maps to `verified_by_display`.
- Source data does not contain school dean or department HOD assignments. Keep those target columns NULL.
- Optional user department and school assignments must be preserved as nullable relationships.

## 5. Circular-reference strategy

The schema contains relationships between users, schools, and departments.

The proposed import order avoids disabling foreign keys:

1. Insert schools with `dean_user_id = NULL`.
2. Insert departments with `hod_user_id = NULL`.
3. Insert users with nullable department and school references temporarily NULL.
4. Update user department and school references after validating the referenced rows.
5. Insert programmes.
6. Insert courses.
7. Insert admission applications.
8. Insert students.
9. Insert legacy invoices.
10. Insert legacy payment transactions.

Do not infer leadership assignments from role names.

## 6. Local database status

The local PostgreSQL target previously inspected was:

- Database: `ecasti_local`
- Port: `5433`
- Schema: `public`

The inspected database contains `ecasti_application_state`, but none of the nine Migration 010 relational target tables.

The read-only Migration 010 validator therefore reported BLOCKED. The existing application-state row must be preserved.

The temporary Neon-specific schema script is not suitable for this local import and must not be repointed or run.

## 7. Source and migration fingerprints

Source JSON SHA256:

`2247f06ac2cc25a66efdb63e9e08ed815492c751c9b547e6d8a1f467ed36c705`

Migration 010 SHA256:

`a6b1c87a02ce191aff7cd335f441a27cea01655d754d5d32cff25a8ad2ae6077`

Recalculate both hashes before any future import. A changed fingerprint requires the source and schema audits to be repeated.

## 8. Approval gates

Before importing:

- Resolve or formally handle both missing required source fields.
- Reconcile the four legacy fee schedule exceptions separately.
- Review the complete source-to-target transformation mapping.
- Verify target schema and database identity.
- Verify target table emptiness and collision policy.
- Confirm backup and rollback procedures.
- Obtain explicit approval for the actual import.

## 9. Current decision

**DO NOT IMPORT.**

This report documents read-only findings. No relational schema migration, data import, deployment, remote database access, or source-data modification has been performed.
