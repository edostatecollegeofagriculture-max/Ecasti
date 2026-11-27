# JSON-to-Neon Reconciliation Gates (Read-Only)

**Status:** Planning / blocked from import  
**Scope:** Reconciliation design based on the aggregate output of `preflight:json-migration:readonly`. This document does not contain source record values, identifiers, personal data, or checksums.

## Verified technical baseline

- The local TypeScript lint command completed successfully.
- The Vite production build completed successfully.
- The temporary Neon verifier passed:
  - temporary database and schema identity;
  - all 9 migration 010 tables;
  - all 18 expected named constraints;
  - all 14 expected indexes;
  - column metadata for all 9 tables.
- The Neon verifier queried PostgreSQL catalog metadata only. It did not read or modify application rows.
- The preflight examined 26 collections and counted 249 records. It reported no missing IDs, no duplicate IDs, 5 blocked findings, and 0 review findings.

These checks establish a schema/build baseline only. They do not establish that source data is reconciled or safe to import.

## Reconciliation register

| Area | Aggregate evidence | Classification | Required resolution |
|---|---|---|---|
| Department school references | 10 department records have a string `schoolId`; the source `schools` collection and target school table are empty. | BLOCKED — master data | Obtain the institution-approved school master list and stable school IDs. Confirm every department-to-school assignment against an authoritative source before any import mapping is approved. |
| Student school reference | 1 student record has a string `schoolId`; the source `schools` collection and target school table are empty. | BLOCKED — master data | Resolve against the same approved school master list. Confirm the student's school assignment independently; do not infer it from department or programme names. |
| Application reviewer attribution | 1 `reviewedBy` value does not match a user ID, email, or full name in the preflight comparison. Workflow inspection found this field is a display attribution (name/role snapshot), not a stable user foreign key. | SCHEMA MAPPING — not a proven orphan user | Preserve the historical display value in the snapshot field. Leave the nullable reviewer user ID unset for historical rows unless a separate, authoritative audit identity mapping is available. Do not parse display text or guess an account. |
| Legacy payment student references | 4 payment records have student references that do not match the available student ID, matriculation number, or user ID candidate fields. | BLOCKED — financial identity | Reconcile each payment to an authoritative student record using approved finance source documentation and an independently verified mapping. No fuzzy matching or inferred identity. |
| Legacy payment invoice references | 4 payment records have invoice references that do not match the available invoice ID or invoice-number candidate. | BLOCKED — financial identity | Reconcile each payment to an authoritative legacy invoice. Preserve unresolved references for review; do not synthesize invoice IDs or attach payments to the only available invoice by default. |

The two payment findings concern the same payment collection and may concern overlapping payment records. Do not add the counts together and interpret them as eight distinct payments.

## Required evidence before approving mappings

### A. School master data

The institution's authorized data owner should provide or approve:
- the canonical school list and stable IDs;
- effective dates or historical naming context where applicable;
- the approved mapping for each referenced department and student;
- confirmation that no source school has been omitted from the source extract.

A school row must not be created from a department name, student label, or guessed institution structure.

### B. Legacy finance references

The authorized finance owner should approve a reconciliation ledger maintained outside this report. For each unresolved payment, that ledger should record:
- a source-side reference held in the controlled source environment;
- the verified target student and invoice identities;
- the authoritative evidence used;
- reviewer/approver and decision date;
- an explicit unresolved state where evidence is insufficient.

Do not put student names, matriculation numbers, payment references, invoice numbers, bank details, or raw IDs in this repository document or chat. Do not treat a legacy application's `VERIFIED` status as proof of external gateway settlement without independent settlement evidence.

### C. Reviewer attribution

Keep historical reviewer display attribution separate from a user foreign key. Populate the nullable reviewer user ID only where a trusted audit trail establishes the exact actor account. Preserve the display snapshot even when no actor account can be established.

## Import gate

A future import may be considered only after all of the following are true:

1. The school master data and all required department/student school mappings are approved.
2. Every legacy payment student and invoice reference is reconciled, or an explicitly approved exception policy defines how unresolved historical payments are retained without violating referential integrity or misrepresenting financial history.
3. Historical reviewer attribution is mapped according to the snapshot/nullable-actor design above.
4. A revised read-only preflight confirms that no unapproved blocking references remain.
5. A separate migration plan is reviewed for deterministic ID preservation, idempotency, row counts, checksums, transaction boundaries, retry behavior, and rollback/recovery.
6. The target is independently confirmed as a disposable test branch before any test import is authorized.
7. The authorized owner explicitly approves the specific import operation after reviewing the exact plan and its target.

Until then, do not run an importer or perform application-data writes.

## Explicit non-goals and safeguards

This reconciliation stage is read-only. It does not:
- inspect, export, or print raw student, user, invoice, or payment records;
- change JSON source data or Neon application rows;
- create school master records or repair foreign keys;
- import JSON data;
- alter production configuration or deploy services;
- merge the draft pull request;
- delete or retire the JSON database;
- enable authoritative academic results or change `AUTHORITATIVE_RESULT_SOURCE_READY`.

## Next operator action

Obtain the institution-approved school master list and finance-approved payment reconciliation evidence through the institution's controlled process. Return only aggregate outcomes (for example, number of school mappings approved, number of payment student references reconciled, number of payment invoice references reconciled, and number still unresolved). Do not send raw records or identifiers in chat.
