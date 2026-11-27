# EDOCASTI migration 012 review notes

## Scope
This draft generalizes curriculum mapping course snapshots. It does not execute SQL, connect to Neon/Render, deploy, commit, or modify local project files.

## Included
- Adds stage code/label, period code/label, and classification snapshots to mapping courses.
- Backfills existing ND rows with stable legacy codes while retaining their original labels.
- Derives COMPULSORY/ELECTIVE from the existing compulsory boolean; OPTIONAL is supported for future mapping rows.
- Makes the legacy mapping level/semester columns nullable and removes only the inline-generated checks on those two columns.
- Adds generic snapshot columns to student required-course rows. They remain nullable to preserve the existing ND exception workflow.
- Replaces `protect_student_required_course()` while preserving its original protections and explicitly adding protection for every new snapshot. It continues to permit only `is_required` and `exception_id` changes; `mapping_course_id` remains immutable.
- Replaces `validate_student_required_course_integrity()` to validate generic snapshots for mapped compulsory courses while retaining the original ND exception checks.

## Important pre-execution review
1. This draft assumes PostgreSQL generated the inline check constraint names exactly as:
   - `academic_curriculum_mapping_courses_course_level_snapshot_check`
   - `academic_curriculum_mapping_courses_semester_snapshot_check`
   - `student_academic_required_courses_course_level_snapshot_check`
   - `student_academic_required_courses_semester_snapshot_check`
   Verify those names against the actual database before applying.
2. The generic course classification is `COMPULSORY`, `ELECTIVE`, or `OPTIONAL`. Confirm the application patch uses exactly these values.
3. The assignment service must insert stage/period/classification snapshots and must select only `classification_snapshot = 'COMPULSORY'` when creating required-course records.
4. The mapping API must validate stage and period codes against the selected programme's `academicStructure`, and must not accept client-supplied course title/code/credit values in place of catalogue values.
5. The student exception schema and service remain ND-only. Do not route HND/certificate exceptions through the old schema until a separate generalized exception design is approved.
6. Test against a disposable local database restored from a backup, not staging or production. Run the migration inside a transaction and inspect the resulting schema and existing row counts before committing it.
7. This draft does not generalize progression stages or graduation eligibility. Do not enable `AUTHORITATIVE_RESULT_SOURCE_READY`; do not change the progression evaluator or graduation document gates as part of this migration.

## Deployment boundary
No remote database, Render service, Vercel deployment, Git operation, or production/staging action is authorized by this draft.
