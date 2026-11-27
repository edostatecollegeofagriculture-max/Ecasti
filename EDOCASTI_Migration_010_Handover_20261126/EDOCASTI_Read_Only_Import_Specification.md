# EDOCASTI — Migration 010 Read-Only Import Specification

**Document type:** Implementation design; not an executable importer  
**Target migration:** `database/migrations/010_core_entities_and_legacy_finance.sql`  
**Source:** `data/edocasti_db.json`  
**Target environment:** Local PostgreSQL only, after separate approval

## 1. Purpose

Define a repeat-safe, auditable import from the existing JSON collections into the nine relational tables in Migration 010.

This document does not apply the migration or perform any database writes.

## 2. Source-to-target field mapping

### Schools

| Source | Target |
|---|---|
| id | id |
| code | code |
| name | name |
| description | description |
| — | image_url = NULL (no source field) |
| — | dean_user_id = NULL |

### Users

| Source | Target |
|---|---|
| id | id |
| email | email |
| passwordHash | password_hash |
| fullName | full_name |
| role | role |
| phone | phone |
| photoUrl | photo_url |
| isActive | is_active |
| isLocked | is_locked |
| failedLoginAttempts | failed_login_attempts |
| departmentId | department_id |
| schoolId | school_id |
| createdAt | created_at |
| lastLogin | last_login |

For the initial insertion phase, department_id and school_id may be NULL. Apply validated source references in a later update phase.

### Departments

| Source | Target |
|---|---|
| id | id |
| schoolId | school_id |
| code | code |
| name | name |
| — | hod_user_id = NULL |

### Programmes

| Source | Target |
|---|---|
| id | id |
| departmentId | department_id |
| code | code |
| name | name |
| qualification | qualification |
| durationYears | duration_years |
| description | description |
| requirements | requirements (JSONB) |

### Courses

| Source | Target |
|---|---|
| id | id |
| departmentId | department_id |
| programmeId | programme_id |
| code | code |
| title | title |
| creditUnits | credit_units |
| level | level |
| semester | semester |
| lecturerId | lecturer_user_id |
| lecturerName | lecturer_name |
| isCompulsory | is_compulsory |

### Applications

| Source | Target |
|---|---|
| id | id |
| applicationNumber | application_number |
| userId | user_id |
| programmeId | programme_id |
| session | session |
| firstName | first_name |
| lastName | last_name |
| otherNames | other_names |
| gender | gender |
| dob | date_of_birth |
| phone | phone |
| email | email |
| photoUrl | photo_url |
| stateOfOrigin | state_of_origin |
| lga | lga |
| residentialAddress | residential_address |
| oLevelResults | o_level_results (JSONB) |
| status | status |
| screeningNotes | screening_notes |
| reviewedBy | reviewer_display_snapshot |
| submittedAt | submitted_at |
| decisionAt | decision_at |

Do not derive reviewer_user_id from the display snapshot.

### Students

| Source | Target |
|---|---|
| id | id |
| matricNumber | matric_number |
| userId | user_id |
| photoUrl | photo_url |
| programmeId | programme_id |
| departmentId | department_id |
| schoolId | school_id |
| level | level |
| sessionAdmitted | session_admitted |
| academicStatus | academic_status |
| gender | gender |
| dob | date_of_birth |
| emergencyContact | emergency_contact |
| nextOfKin | next_of_kin |
| cgpa | cgpa |
| totalCreditsEarned | total_credits_earned |

### Invoices

| Source | Target |
|---|---|
| id | id |
| invoiceNumber | invoice_number |
| studentId | student_id |
| session | session |
| title | title |
| amount | amount |
| amountPaid | amount_paid |
| status | status |
| dueDate | due_date |
| createdAt | created_at |

### Payments

| Source | Target |
|---|---|
| id | id |
| reference | reference |
| invoiceId | invoice_id |
| studentId | student_id |
| amount | amount |
| channel | channel |
| status | status |
| providerReference | provider_reference |
| paidAt | paid_at |
| verifiedBy | verified_by_display |

Do not derive a user ID from verifiedBy.

## 3. Transformation rules

- Preserve all source IDs exactly.
- Preserve original strings unless an explicitly reviewed transformation is approved.
- Preserve date-only values as date-only text and ISO date-time values as their original text representation.
- Serialize requirements and oLevelResults as JSON arrays for JSONB columns.
- Preserve nullable fields as NULL, not fabricated values.
- Do not hash passwords again; passwordHash already represents the stored hash.
- Preserve decimal values without rounding beyond the target column's supported precision.
- Never infer leadership relationships from role names.
- Do not silently drop source records.

## 4. Import ordering and foreign keys

Use a single transaction for the eventual import.

1. Verify and insert schools with dean_user_id NULL.
2. Verify and insert departments with hod_user_id NULL.
3. Insert users with department_id and school_id initially NULL.
4. Update user department_id and school_id from validated source relationships.
5. Insert programmes.
6. Insert courses.
7. Insert admission applications.
8. Insert students.
9. Insert legacy invoices.
10. Insert legacy payment transactions.

Foreign-key enforcement remains enabled. Do not disable triggers or constraints.

Leadership references remain NULL because the source does not contain authoritative assignments.

## 5. Required pre-import safeguards

### Environment allowlist

The eventual importer must verify all of the following before it can write:

- Database host is an explicitly approved local address.
- Port is exactly 5433.
- Database name is exactly `ecasti_local`.
- Schema is exactly `public`.
- Connection is not a Neon or Render connection.
- No staging service identity is present.
- No remote host or fallback connection is permitted.

Reject the operation if any identity check fails.

### Source integrity

- Calculate a fresh SHA256 of the JSON file.
- Compare it with the reviewed source fingerprint.
- Re-run the read-only audits if the source changed.
- Validate required fields and foreign-key references again immediately before import.

### Target integrity

- Verify all nine target tables exist.
- Inspect their columns, constraints, indexes and foreign keys.
- Detect existing primary-key and alternate-key collisions.
- Do not overwrite or delete existing records.
- Preserve the existing ecasti_application_state row.
- Require an explicit policy for any non-empty target table.

## 6. Repeat-safety

A future importer must not treat ON CONFLICT DO UPDATE as an automatic solution.

It must distinguish:

- Exact existing match: report as already present.
- Existing ID with different content: stop and report a collision.
- Existing alternate key with another ID: stop and report a collision.
- Missing record: eligible for insertion after all validation gates pass.

Do not update existing records automatically.

## 7. Transaction and rollback design

The eventual importer should:

1. Acquire a transaction-level advisory lock.
2. Recheck database identity inside the transaction.
3. Recheck schema and target table state.
4. Recheck source fingerprint and required fields.
5. Validate all source relationships.
6. Insert records in dependency order.
7. Update deferred nullable relationships.
8. Verify inserted counts and foreign-key integrity.
9. Verify the composite invoice/student payment relationship.
10. Commit only after all checks pass.

Any failure must cause a complete rollback.

A separate verified backup is required before the first approved write.

## 8. Post-import reconciliation

Compare source and target counts for all nine collections.

Verify:

- Every source ID has exactly one target record.
- No unexpected target records were introduced.
- Every populated foreign-key reference resolves.
- User department and school assignments match.
- Course lecturer and programme assignments match.
- Application and student relationships match.
- Invoice/student relationships match.
- Payment invoice/student composite relationships match.
- Numeric values and date strings are preserved.
- JSONB arrays match their source arrays.
- Password hashes are unchanged.
- Existing application-state data remains unchanged.

Produce a report containing counts, checksums, exception totals and the final transaction outcome. Do not include passwords, contact details or other personal data in the report.

## 9. Explicit exclusions

This specification does not:

- Apply Migration 010.
- Import any records.
- Modify the JSON source.
- Connect to Render, Neon or any remote database.
- Run the temporary Neon-specific core schema script.
- Resolve missing phone or emergency contact values by guessing.
- Import the four unresolved legacy fee schedule records.
- Modify academic progression or curriculum migration tables.
- Deploy or commit code.

## 10. Approval required

The implementation and execution of an importer are separate steps.

A future import requires explicit approval after the two required-field exceptions and target-schema readiness have been addressed.

