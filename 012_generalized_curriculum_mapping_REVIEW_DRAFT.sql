BEGIN;

-- ============================================================
-- 012: GENERALIZED CURRICULUM MAPPING SNAPSHOTS
-- ============================================================
-- Extends curriculum mappings to use programme-defined stages,
-- periods and course classifications.
--
-- Existing ND values are retained in their legacy columns and
-- copied into generic snapshot columns using stable legacy codes.
--
-- The student exception table/workflow remains ND-specific in
-- this migration. No student, result, assignment or progression
-- rows are deleted or reassigned.
-- ============================================================

-- 1. Generic snapshots on programme curriculum mapping courses.

ALTER TABLE academic_curriculum_mapping_courses
    ADD COLUMN stage_code_snapshot TEXT,
    ADD COLUMN stage_label_snapshot TEXT,
    ADD COLUMN period_code_snapshot TEXT,
    ADD COLUMN period_label_snapshot TEXT,
    ADD COLUMN classification_snapshot TEXT;

UPDATE academic_curriculum_mapping_courses
   SET stage_code_snapshot = CASE course_level_snapshot
           WHEN 'ND I' THEN 'LEGACY-ND-I'
           WHEN 'ND II' THEN 'LEGACY-ND-II'
           ELSE 'LEGACY-' || UPPER(REPLACE(TRIM(course_level_snapshot), ' ', '-'))
       END,
       stage_label_snapshot = course_level_snapshot,
       period_code_snapshot = CASE semester_snapshot
           WHEN 'First Semester' THEN 'LEGACY-FIRST-SEMESTER'
           WHEN 'Second Semester' THEN 'LEGACY-SECOND-SEMESTER'
           ELSE 'LEGACY-' || UPPER(REPLACE(TRIM(semester_snapshot), ' ', '-'))
       END,
       period_label_snapshot = semester_snapshot,
       classification_snapshot = CASE
           WHEN is_compulsory_snapshot THEN 'COMPULSORY'
           ELSE 'ELECTIVE'
       END;

ALTER TABLE academic_curriculum_mapping_courses
    ALTER COLUMN stage_code_snapshot SET NOT NULL,
    ALTER COLUMN stage_label_snapshot SET NOT NULL,
    ALTER COLUMN period_code_snapshot SET NOT NULL,
    ALTER COLUMN period_label_snapshot SET NOT NULL,
    ALTER COLUMN classification_snapshot SET NOT NULL;

-- Drop only the two inline-generated legacy checks on this table.
-- The exception table's ND-specific checks are intentionally kept.
ALTER TABLE academic_curriculum_mapping_courses
    DROP CONSTRAINT IF EXISTS academic_curriculum_mapping_courses_course_level_snapshot_check,
    DROP CONSTRAINT IF EXISTS academic_curriculum_mapping_courses_semester_snapshot_check;

ALTER TABLE academic_curriculum_mapping_courses
    ALTER COLUMN course_level_snapshot DROP NOT NULL,
    ALTER COLUMN semester_snapshot DROP NOT NULL;

ALTER TABLE academic_curriculum_mapping_courses
    ADD CONSTRAINT chk_mapping_course_classification
        CHECK (classification_snapshot IN ('COMPULSORY', 'ELECTIVE', 'OPTIONAL')),
    ADD CONSTRAINT chk_mapping_course_compulsory_consistency
        CHECK (
            is_compulsory_snapshot =
            (classification_snapshot = 'COMPULSORY')
        ),
    ADD CONSTRAINT chk_mapping_course_generic_snapshot_values
        CHECK (
            LENGTH(TRIM(stage_code_snapshot)) > 0
            AND LENGTH(TRIM(stage_label_snapshot)) > 0
            AND LENGTH(TRIM(period_code_snapshot)) > 0
            AND LENGTH(TRIM(period_label_snapshot)) > 0
        );

CREATE INDEX idx_mapping_courses_stage_period
    ON academic_curriculum_mapping_courses (
        mapping_id,
        stage_code_snapshot,
        period_code_snapshot
    );

-- 2. Generic snapshots on effective student required-course rows.
-- These columns remain nullable so existing ND exception records
-- can continue through their unchanged legacy workflow.

ALTER TABLE student_academic_required_courses
    ADD COLUMN stage_code_snapshot TEXT,
    ADD COLUMN stage_label_snapshot TEXT,
    ADD COLUMN period_code_snapshot TEXT,
    ADD COLUMN period_label_snapshot TEXT,
    ADD COLUMN classification_snapshot TEXT;

UPDATE student_academic_required_courses
   SET stage_code_snapshot = CASE course_level_snapshot
           WHEN 'ND I' THEN 'LEGACY-ND-I'
           WHEN 'ND II' THEN 'LEGACY-ND-II'
           ELSE 'LEGACY-' || UPPER(REPLACE(TRIM(course_level_snapshot), ' ', '-'))
       END,
       stage_label_snapshot = course_level_snapshot,
       period_code_snapshot = CASE semester_snapshot
           WHEN 'First Semester' THEN 'LEGACY-FIRST-SEMESTER'
           WHEN 'Second Semester' THEN 'LEGACY-SECOND-SEMESTER'
           ELSE 'LEGACY-' || UPPER(REPLACE(TRIM(semester_snapshot), ' ', '-'))
       END,
       period_label_snapshot = semester_snapshot,
       classification_snapshot = 'COMPULSORY';

ALTER TABLE student_academic_required_courses
    DROP CONSTRAINT IF EXISTS student_academic_required_courses_course_level_snapshot_check,
    DROP CONSTRAINT IF EXISTS student_academic_required_courses_semester_snapshot_check;

ALTER TABLE student_academic_required_courses
    ALTER COLUMN course_level_snapshot DROP NOT NULL,
    ALTER COLUMN semester_snapshot DROP NOT NULL;

ALTER TABLE student_academic_required_courses
    ADD CONSTRAINT chk_student_required_classification
        CHECK (
            classification_snapshot IS NULL
            OR classification_snapshot = 'COMPULSORY'
        ),
    ADD CONSTRAINT chk_student_required_generic_snapshot_values
        CHECK (
            (
                stage_code_snapshot IS NULL
                AND stage_label_snapshot IS NULL
                AND period_code_snapshot IS NULL
                AND period_label_snapshot IS NULL
                AND classification_snapshot IS NULL
            )
            OR
            (
                stage_code_snapshot IS NOT NULL
                AND LENGTH(TRIM(stage_code_snapshot)) > 0
                AND stage_label_snapshot IS NOT NULL
                AND LENGTH(TRIM(stage_label_snapshot)) > 0
                AND period_code_snapshot IS NOT NULL
                AND LENGTH(TRIM(period_code_snapshot)) > 0
                AND period_label_snapshot IS NOT NULL
                AND LENGTH(TRIM(period_label_snapshot)) > 0
                AND classification_snapshot = 'COMPULSORY'
            )
        );

CREATE INDEX idx_student_required_courses_stage_period
    ON student_academic_required_courses (
        student_id,
        stage_code_snapshot,
        period_code_snapshot
    );

-- 3. Preserve the original required-course immutability boundary
-- and additionally protect every new generic snapshot.
-- is_required and exception_id remain mutable for the approved
-- exclusion workflow; mapping_course_id remains immutable.

CREATE OR REPLACE FUNCTION protect_student_required_course()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION
            'Student academic required-course records cannot be deleted';
    END IF;

    IF NEW.student_id IS DISTINCT FROM OLD.student_id
       OR NEW.programme_id IS DISTINCT FROM OLD.programme_id
       OR NEW.cohort_session IS DISTINCT FROM OLD.cohort_session
       OR NEW.course_id IS DISTINCT FROM OLD.course_id
       OR NEW.course_code_snapshot IS DISTINCT FROM OLD.course_code_snapshot
       OR NEW.course_title_snapshot IS DISTINCT FROM OLD.course_title_snapshot
       OR NEW.course_level_snapshot IS DISTINCT FROM OLD.course_level_snapshot
       OR NEW.semester_snapshot IS DISTINCT FROM OLD.semester_snapshot
       OR NEW.credit_units_snapshot IS DISTINCT FROM OLD.credit_units_snapshot
       OR NEW.mapping_course_id IS DISTINCT FROM OLD.mapping_course_id
       OR NEW.stage_code_snapshot IS DISTINCT FROM OLD.stage_code_snapshot
       OR NEW.stage_label_snapshot IS DISTINCT FROM OLD.stage_label_snapshot
       OR NEW.period_code_snapshot IS DISTINCT FROM OLD.period_code_snapshot
       OR NEW.period_label_snapshot IS DISTINCT FROM OLD.period_label_snapshot
       OR NEW.classification_snapshot IS DISTINCT FROM OLD.classification_snapshot
    THEN
        RAISE EXCEPTION
            'Student required-course identity and snapshots are immutable';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Extend mapped-course integrity to compare generic snapshots.
-- Keep exception validation bound to the original ND exception
-- columns; no exception schema or exception workflow is broadened.

CREATE OR REPLACE FUNCTION validate_student_required_course_integrity()
RETURNS TRIGGER AS $$
DECLARE
    assigned_mapping_id TEXT;
    exception_action TEXT;
    exception_status TEXT;
    exception_student_id TEXT;
    exception_course_id TEXT;
    exception_mapping_id TEXT;
    exception_is_compulsory BOOLEAN;
BEGIN
    IF NEW.mapping_course_id IS NULL
       AND NEW.exception_id IS NULL
    THEN
        RAISE EXCEPTION
            'A required-course record must reference a mapping course or an approved exception';
    END IF;

    -- A mapped course must match its student's current assigned
    -- curriculum, including all generic snapshots.
    IF NEW.mapping_course_id IS NOT NULL THEN
        SELECT mc.mapping_id
          INTO assigned_mapping_id
          FROM academic_curriculum_mapping_courses mc
          JOIN student_academic_curriculum_assignments a
            ON a.mapping_id = mc.mapping_id
         WHERE mc.id = NEW.mapping_course_id
           AND mc.course_id = NEW.course_id
           AND mc.course_code_snapshot = NEW.course_code_snapshot
           AND mc.course_title_snapshot = NEW.course_title_snapshot
           AND mc.course_level_snapshot IS NOT DISTINCT FROM NEW.course_level_snapshot
           AND mc.semester_snapshot IS NOT DISTINCT FROM NEW.semester_snapshot
           AND mc.credit_units_snapshot = NEW.credit_units_snapshot
           AND mc.stage_code_snapshot = NEW.stage_code_snapshot
           AND mc.stage_label_snapshot = NEW.stage_label_snapshot
           AND mc.period_code_snapshot = NEW.period_code_snapshot
           AND mc.period_label_snapshot = NEW.period_label_snapshot
           AND mc.classification_snapshot = NEW.classification_snapshot
           AND mc.classification_snapshot = 'COMPULSORY'
           AND mc.is_compulsory_snapshot = TRUE
           AND a.student_id = NEW.student_id
           AND a.programme_id = NEW.programme_id
           AND a.cohort_session = NEW.cohort_session
           AND a.is_current = TRUE
         LIMIT 1;

        IF assigned_mapping_id IS NULL THEN
            RAISE EXCEPTION
                'The mapping course and snapshots must match the student current assigned curriculum';
        END IF;
    END IF;

    -- Exceptions retain their original ND-specific snapshot checks.
    IF NEW.exception_id IS NOT NULL THEN
        SELECT e.action,
               e.status,
               e.student_id,
               e.course_id,
               e.mapping_id,
               e.is_compulsory_snapshot
          INTO exception_action,
               exception_status,
               exception_student_id,
               exception_course_id,
               exception_mapping_id,
               exception_is_compulsory
          FROM academic_student_curriculum_exceptions e
          JOIN student_academic_curriculum_assignments a
            ON a.student_id = e.student_id
           AND a.mapping_id = e.mapping_id
          WHERE e.id = NEW.exception_id
            AND e.course_code_snapshot = NEW.course_code_snapshot
            AND e.course_title_snapshot = NEW.course_title_snapshot
            AND e.course_level_snapshot IS NOT DISTINCT FROM NEW.course_level_snapshot
            AND e.semester_snapshot IS NOT DISTINCT FROM NEW.semester_snapshot
            AND e.credit_units_snapshot = NEW.credit_units_snapshot
            AND a.student_id = NEW.student_id
            AND a.programme_id = NEW.programme_id
            AND a.cohort_session = NEW.cohort_session
            AND a.is_current = TRUE
          LIMIT 1;

        IF exception_action IS NULL
           OR exception_status IS DISTINCT FROM 'APPROVED'
           OR exception_student_id IS DISTINCT FROM NEW.student_id
           OR exception_course_id IS DISTINCT FROM NEW.course_id
           OR exception_is_compulsory IS DISTINCT FROM TRUE
        THEN
            RAISE EXCEPTION
                'The exception must be approved and match the student, course and snapshots';
        END IF;
    END IF;

    -- Normal compulsory course from the approved mapping.
    IF NEW.mapping_course_id IS NOT NULL
       AND NEW.exception_id IS NULL
    THEN
        IF NOT NEW.is_required THEN
            RAISE EXCEPTION
                'A mapped course cannot be excluded without an approved exclusion exception';
        END IF;

        RETURN NEW;
    END IF;

    -- Approved additional compulsory course. This remains the
    -- legacy ND exception path and must carry compulsory status.
    IF NEW.mapping_course_id IS NULL
       AND NEW.exception_id IS NOT NULL
    THEN
        IF exception_action IS DISTINCT FROM 'ADD_COURSE'
           OR NOT NEW.is_required
           OR (
                NEW.classification_snapshot IS NOT NULL
                AND NEW.classification_snapshot <> 'COMPULSORY'
           )
        THEN
            RAISE EXCEPTION
                'An additional course requires an approved ADD_COURSE exception and must remain required';
        END IF;

        RETURN NEW;
    END IF;

    -- Approved exclusion: retain the mapped row and mark it
    -- not required for this student.
    IF NEW.mapping_course_id IS NOT NULL
       AND NEW.exception_id IS NOT NULL
    THEN
        IF exception_action IS DISTINCT FROM 'EXCLUDE_COURSE'
           OR NEW.is_required
           OR assigned_mapping_id IS DISTINCT FROM exception_mapping_id
        THEN
            RAISE EXCEPTION
                'An exclusion requires a matching approved EXCLUDE_COURSE exception for the assigned mapping';
        END IF;

        RETURN NEW;
    END IF;

    RAISE EXCEPTION
        'Invalid student required-course origin';
END;
$$ LANGUAGE plpgsql;

COMMIT;
