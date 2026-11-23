# JSON Migration Preflight Findings and Remediation Plan

**Status: BLOCKED — no data import is authorized by this report.**

## Verification results

The read-only preflight was run locally after the feature branch update. TypeScript lint and the Vite production build passed. The preflight counted 26 collections and 249 records and reported five relationship findings:

| Source collection | Field | Expected target | Aggregate finding |
|---|---|---|---:|
| departments | schoolId | schools.id | 10 unresolved references |
| applications | reviewedBy | users.id | 1 unresolved reference |
| students | schoolId | schools.id | 1 unresolved reference |
| payments | studentId | students.id | 4 unresolved references |
| payments | invoiceId | invoices.id | 4 unresolved references |

The preflight output did not include record values, and this document intentionally does not reproduce any source data or checksums.

## Confirmed model constraints

The current TypeScript interfaces in `server/db.ts` define:
- `Department.schoolId` as a required string.
- `Student.schoolId` as a required string.
- `AdmissionApplication.reviewedBy` as optional.
- `PaymentTransaction.studentId` and `PaymentTransaction.invoiceId` as required strings.

The same interfaces define `School.id`, `User.id`, `Student.id`, and `Invoice.id` as the local identity keys. Therefore the current preflight relationship expectations are consistent with the declared application model. The aggregate report alone cannot establish whether the stored values are stale IDs, IDs from another source, incorrectly mapped references, or actual orphaned records.

## Remediation required before import

### 1. Schools / departments / students
- The source contains zero school records, while the department and student interfaces require a school ID.
- Determine whether the school collection was accidentally emptied, renamed, or not populated in the current source dataset.
- Confirm whether school records exist in an approved authoritative source and whether their original stable IDs can be preserved.
- Do not fabricate schools or silently make required fields nullable.
- If the source has no authoritative school records, define an explicit, reviewed mapping decision before importing departments or students.

### 2. Admission reviewer
- The reviewer field is optional, but any non-empty reviewer ID must resolve to an existing user.
- Determine whether the reviewer account was deleted, the ID was changed, or the field uses a different identity namespace.
- Preserve the review history. Do not replace an unknown reviewer with an arbitrary administrator.

### 3. Payments
- Both student and invoice references are required by the declared model.
- Establish whether the payment records use the same stable IDs as the current students and invoices collections.
- Reconcile payment-to-invoice ownership and amounts using a controlled local report. Never infer ownership from names, emails, or other personal attributes.
- Do not import payments, alter invoice balances, or mark any payment as settled until every reference and financial invariant has been reconciled.

## Safe next diagnostic

If further investigation is needed, extend the local preflight to emit only:
- reference field type counts (string, null, missing, other);
- counts of empty and non-empty references;
- count of references matching the target collection;
- count of unresolved references;
- whether the target collection is empty.

It must not emit raw IDs or any record values. A human operator should compare the findings with the institution's approved source-of-truth records locally.

## Import gate

The first importer must not be implemented against the current dataset until the five findings have documented resolutions. The next migration design review should also inspect the actual Neon DDL and service-layer identity semantics before mapping source IDs to target keys.

No JSON records were changed, no Neon data was written, and no production deployment or cutover was performed during this review.


## Additional schema review: Neon target is not yet a complete mirror

The migration directory was inspected on this branch. The existing DDL does **not** define core relational tables for `schools`, `departments`, `users`, `programmes`, `courses`, `students`, `applications`, legacy `invoices`, or legacy `payments`.

The existing fee schema (`001_fee_management_schema.sql`) defines a separate itemized fee subsystem:
- `fee_catalog`
- `program_fee_schedule`
- `program_fee_schedule_items`
- `student_fee_obligations`
- `student_payments`
- `student_payment_allocations`

Its comments explicitly state that user, student, and programme IDs are stored as TEXT without external foreign keys while those core entities remain in JSON. Internal fee-table relationships are constrained. This means the current Neon schema cannot be used to validate the missing core school/user/student references.

The legacy JSON `PaymentTransaction` model contains an invoice ID, student ID, payment reference, provider reference, channel, payment status, paid timestamp, and optional verifier. The Neon `student_payments` table instead models a manual fee payment with a receipt number, idempotency key, student ID, amount, method, recording user, recorded timestamp, notes, and session; allocations are linked to fee obligations. The legacy `invoices` collection has no corresponding invoice table in the inspected fee DDL.

**Therefore, legacy `payments` must not be bulk-copied into `student_payments`, and legacy `invoices` must not be treated as fee obligations.** They represent different workflows and their fields and lifecycle semantics do not match.

## Improved local diagnostic

The read-only preflight now includes a `referenceDiagnostics` section. For each configured relationship it reports only:
- source and target collection names and aggregate record counts;
- whether the target collection is empty;
- field value type counts (string, null, missing, other);
- empty-string count;
- matched and unresolved reference counts.

It emits no IDs or row values and still opens no Neon connection. Re-run it locally after pulling the latest feature branch. Use the aggregate results to determine whether the empty school collection and payment references reflect incomplete source data, different identity namespaces, or an incorrect relationship assumption. Do not use the report to guess or rewrite identifiers.

## Schema readiness conclusion

The current Neon migrations provide fee-management and academic-progression ledgers, not an app-wide relational replacement for the JSON store. The next schema-design step must specify core identity and academic catalogue tables, plus a deliberate legacy-invoice/payment-history model, before an importer can be safely designed. This is a schema gap in addition to the unresolved source references above.

## Follow-up code inspection: school seed repair gap

The `DatabaseEngine.loadDatabase()` implementation in `server/db.ts` was inspected without constructing the database engine or opening the JSON store. Its existing-file repair path can append missing seeded departments, programmes, and users under specific conditions, but it does not restore missing school rows. The seed generator defines school records, but that generator is not used to backfill `parsed.schools` in the existing-file path.

This is a plausible code-level explanation for how an existing JSON file could retain departments whose parent school collection is empty. It is not proof of how this particular file became incomplete. Do not invoke the database engine as a diagnostic: its constructor may write to the JSON file. Any future repair should be a separately reviewed, explicit migration with an approved school catalogue and stable IDs, not an incidental startup side effect.

## Alternate-key diagnostic

The local preflight has been extended to compare unresolved values in memory against a limited set of plausible alternate target fields:
- application reviewer reference against user email and full name;
- payment student reference against student matriculation number and linked user ID;
- payment invoice reference against invoice number.

The report emits only aggregate match counts and candidate field names. It does not emit source values, IDs, names, emails, payment data, or checksums beyond the existing collection summary. A match is a diagnostic lead, not permission to remap: each candidate must be validated against the approved identity and financial rules before any import.

## Follow-up workflow inspection: reviewer identity semantics

The admissions decision route in `server/apiRouter.ts` assigns `reviewedBy` as a display string composed from the authenticated user's full name and role, rather than the user's stable `User.id`. The earlier exact comparisons against user ID, email, and full name therefore do not test the actual stored format. This explains why those candidate checks returned no matches without establishing that the reviewer is an unknown person. The stable reviewer identity is separately available in the authenticated request and audit log (`userId`), but the application record itself currently stores only the display string. For historical migration, preserve the display string as historical attribution; do not parse it into a user foreign key unless an unambiguous, reviewed mapping is available. A future schema should store a nullable reviewer user ID alongside the historical display snapshot.

## Follow-up workflow inspection: legacy payment semantics

The legacy `/finance/pay` route in `server/apiRouter.ts` looks up an invoice by its ID, then creates a payment using that invoice's own ID and student ID. In that code path, the two references are assigned directly from the selected invoice, so a newly created transaction should have internally consistent invoice/student references. The route then marks the transaction `VERIFIED`, sets the invoice to fully paid, and creates a provider-style reference without an evident call to an external payment gateway in this handler. Treat this as legacy application behavior, not evidence of independently verified gateway settlement. Before migration, payment history must retain its original status and be reviewed against authoritative gateway/bank reconciliation records; never upgrade status merely because the JSON row says `VERIFIED`.

The separate Neon `recordFeePayment` service is a manual staff-recorded payment workflow: it requires an existing student ID, an idempotency key, and outstanding fee obligations, then records the payment and allocations in one database transaction. It does not represent the same legacy invoice/gateway workflow. These two payment models must remain distinct in the target design unless an approved finance-domain mapping explicitly reconciles them.

## Consequences for current findings

- The reviewer finding is a **display-attribution versus foreign-key mismatch**, not a confirmed missing reviewer account. The existing report's exact alternate-key checks are insufficient for this field's documented format.
- The payment findings remain unresolved. The legacy payment route's normal creation path ties both references to an invoice, so the observed mismatch suggests missing/replaced invoice or student records, data created by another path/version, or source inconsistency. Aggregate diagnostics cannot distinguish these cases.
- Do not import legacy `VERIFIED` payment rows as verified Neon fee payments without independent reconciliation. Preserve legacy payment history separately from the itemized fee-payment ledger.
