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
