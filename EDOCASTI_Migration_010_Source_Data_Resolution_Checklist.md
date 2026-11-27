# EDOCASTI Migration 010 — Source Data Resolution Checklist

Status: REVIEW REQUIRED
Purpose: Resolve two missing required source fields before migration.
Mode: Documentation only; no source or database changes.

## 1. Application — Required phone number

- [ ] Locate the application using its application ID:
      app-1795622937861
- [ ] Consult an authoritative application form or admissions record.
- [ ] Confirm the applicant's phone number from that source.
- [ ] Record the source document/reference securely.
- [ ] Record the verifier and verification date.
- [ ] Obtain independent second-person review.
- [ ] Approve any proposed correction before changing source JSON.
- [ ] Keep this record quarantined until all checks pass.

Do not infer, generate, or substitute a phone number.

## 2. Student — Required emergency contact

- [ ] Locate the student using the student ID:
      std-1795623290388
- [ ] Consult an authoritative student registration or emergency-contact form.
- [ ] Confirm the emergency contact from that source.
- [ ] Record the source document/reference securely.
- [ ] Record the verifier and verification date.
- [ ] Obtain independent second-person review.
- [ ] Approve any proposed correction before changing source JSON.
- [ ] Keep this record quarantined until all checks pass.

Do not invent or substitute emergency-contact information.

## 3. Review and audit requirements

- [ ] Both required fields verified against authoritative records.
- [ ] Both corrections independently reviewed.
- [ ] Original source file backed up before any approved correction.
- [ ] Proposed changes documented without exposing personal values in reports.
- [ ] Read-only validation rerun after any approved correction.
- [ ] Quarantine simulation rerun.
- [ ] Updated migration readiness report generated.

## 4. Migration safeguards

- Destination inspection: NOT AUTHORIZED
- Database connection: NOT AUTHORIZED
- SQL execution: NOT AUTHORIZED
- Import: NOT AUTHORIZED
- Source JSON modification: NOT AUTHORIZED

These actions require separate explicit authorization.

## 5. Current disposition

The two affected records remain quarantined.
The remaining simulated eligible records are not automatically approved for import.
Migration 010 remains REVIEW_REQUIRED.

Prepared as a documentation-only checklist.
