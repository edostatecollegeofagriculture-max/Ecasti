BEGIN;

-- ============================================================
-- 006: ACADEMIC PROGRESSION AND CURRICULUM MAPPING
-- ============================================================
-- Student, programme, course and user IDs remain TEXT because
-- those records are currently managed by the existing JSON store.
--
-- No existing student/course/payment records are modified here.
-- ============================================================


-- ============================================================
-- 1. PROGRAMME AND ADMISSION-COHORT CURRICULUM MAPPINGS
-- ============================================================

CREATE TABLE academic_curriculum_mappings (
    id TEXT PRIMARY KEY,
    programme_id TEXT NOT NULL,
    cohort_session TEXT NOT NULL,
    version INTEGER NOT NULL CHECK (version > 0),

    status TEXT NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN (
            'DRAFT',
            'SUBMITTED',
            'APPROVED',
            'REJECTED',
            'RETIRED'
        )),

    prepared_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    submitted_at TIMESTAMPTZ,
    approved_by TEXT,
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    is_current BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT uq_curriculum_mapping_version
        UNIQUE (programme_id, cohort_session, version),

    CONSTRAINT uq_curriculum_mapping_identity
        UNIQUE (id, programme_id, cohort_session),

    CONSTRAINT chk_curriculum_mapping_submission
        CHECK (
            status NOT IN ('SUBMITTED', 'APPROVED', 'RETIRED')
            OR submitted_at IS NOT NULL
        ),

    CONSTRAINT chk_curriculum_mapping_approval
        CHECK (
            (
                status IN ('APPROVED', 'RETIRED')
                AND approved_by IS NOT NULL
                AND LENGTH(TRIM(approved_by)) > 0
                AND approved_at IS NOT NULL
            )
            OR
            (
                status NOT IN ('APPROVED', 'RETIRED')
                AND approved_by IS NULL
                AND approved_at IS NULL
            )
        ),

    CONSTRAINT chk_curriculum_mapping_rejection
        CHECK (
            status <> 'REJECTED'
            OR (
                rejection_reason IS NOT NULL
                AND LENGTH(TRIM(rejection_reason)) > 0
            )
        ),

    CONSTRAINT chk_current_mapping_must_be_approved
        CHECK (NOT is_current OR status = 'APPROVED')
);

CREATE UNIQUE INDEX uq_approved_curriculum_mapping
    ON academic_curriculum_mappings (programme_id, cohort_session)
    WHERE is_current = TRUE;

CREATE INDEX idx_curriculum_mapping_lookup
    ON academic_curriculum_mappings (
        programme_id,
        cohort_session,
        status
    );


-- ============================================================
-- 2. IMMUTABLE COURSE SNAPSHOTS FOR EACH MAPPING VERSION
-- ============================================================

CREATE TABLE academic_curriculum_mapping_courses (
    id TEXT PRIMARY KEY,

    mapping_id TEXT NOT NULL
        REFERENCES academic_curriculum_mappings(id)
        ON DELETE RESTRICT,

    course_id TEXT NOT NULL,
    course_code_snapshot TEXT NOT NULL,
    course_title_snapshot TEXT NOT NULL,

    course_level_snapshot TEXT NOT NULL
        CHECK (course_level_snapshot IN ('ND I', 'ND II')),

    semester_snapshot TEXT NOT NULL
        CHECK (semester_snapshot IN (
            'First Semester',
            'Second Semester'
        )),

    credit_units_snapshot INTEGER NOT NULL
        CHECK (credit_units_snapshot > 0),
    is_compulsory_snapshot BOOLEAN NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_mapping_course
        UNIQUE (mapping_id, course_id),

    CONSTRAINT uq_mapping_course_identity
        UNIQUE (id, mapping_id)
);

CREATE INDEX idx_mapping_courses_mapping
    ON academic_curriculum_mapping_courses (mapping_id);


-- ============================================================
-- 3. CURRICULUM MAPPING REVIEW HISTORY
-- ============================================================

CREATE TABLE academic_curriculum_mapping_reviews (
    id TEXT PRIMARY KEY,

    mapping_id TEXT NOT NULL
        REFERENCES academic_curriculum_mappings(id)
        ON DELETE RESTRICT,

    action TEXT NOT NULL
        CHECK (action IN (
            'SUBMITTED',
            'APPROVED',
            'REJECTED',
            'RETIRED'
        )),

    actor_user_id TEXT NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_curriculum_reviews_mapping
    ON academic_curriculum_mapping_reviews (
        mapping_id,
        created_at DESC
    );


-- ============================================================
-- 4. STUDENT ASSIGNMENTS TO APPROVED CURRICULUM MAPPINGS
-- ============================================================

CREATE TABLE student_academic_curriculum_assignments (
    id TEXT PRIMARY KEY,

    student_id TEXT NOT NULL,
    programme_id TEXT NOT NULL,
    cohort_session TEXT NOT NULL,

    mapping_id TEXT NOT NULL,
    is_current BOOLEAN NOT NULL DEFAULT TRUE,

    assigned_by TEXT NOT NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_assignment_mapping_identity
        FOREIGN KEY (
            mapping_id,
            programme_id,
            cohort_session
        )
        REFERENCES academic_curriculum_mappings (
            id,
            programme_id,
            cohort_session
        )
        ON DELETE RESTRICT,

    CONSTRAINT uq_assignment_student_mapping
        UNIQUE (student_id, mapping_id)
);

CREATE UNIQUE INDEX uq_current_curriculum_assignment
    ON student_academic_curriculum_assignments (student_id)
    WHERE is_current = TRUE;

CREATE INDEX idx_curriculum_assignment_mapping
    ON student_academic_curriculum_assignments (mapping_id);




-- ============================================================
-- 4A. ADMISSION-TIME CURRICULUM ASSIGNMENT PROCESSING LEDGER
-- ============================================================
-- This ledger makes curriculum assignment retryable and auditable.
-- It does not prevent admission from completing when no approved
-- mapping exists; such cases are routed for Registrar review.

CREATE TABLE academic_curriculum_assignment_ledger (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    programme_id TEXT NOT NULL,
    cohort_session TEXT NOT NULL,
    idempotency_key TEXT NOT NULL UNIQUE,

    CONSTRAINT uq_curriculum_assignment_ledger_enrolment
        UNIQUE (student_id, programme_id, cohort_session),

    status TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (status IN (
            'PENDING',
            'ASSIGNED',
            'REVIEW_REQUIRED',
            'FAILED'
        )),

    mapping_id TEXT
        REFERENCES academic_curriculum_mappings(id)
        ON DELETE RESTRICT,

    attempt_count INTEGER NOT NULL DEFAULT 0
        CHECK (attempt_count >= 0),
    last_attempt_at TIMESTAMPTZ,
    assigned_at TIMESTAMPTZ,
    review_reason TEXT,
    error_code TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_curriculum_assignment_ledger_state
        CHECK (
            (
                status = 'PENDING'
                AND assigned_at IS NULL
                AND review_reason IS NULL
                AND error_code IS NULL
            )
            OR
            (
                status = 'ASSIGNED'
                AND mapping_id IS NOT NULL
                AND assigned_at IS NOT NULL
                AND review_reason IS NULL
                AND error_code IS NULL
            )
            OR
            (
                status = 'REVIEW_REQUIRED'
                AND assigned_at IS NULL
                AND review_reason IS NOT NULL
                AND LENGTH(TRIM(review_reason)) > 0
                AND error_code IS NULL
            )
            OR
            (
                status = 'FAILED'
                AND assigned_at IS NULL
                AND error_code IS NOT NULL
                AND LENGTH(TRIM(error_code)) > 0
                AND review_reason IS NULL
            )
        )
);

CREATE INDEX idx_curriculum_assignment_ledger_retry
    ON academic_curriculum_assignment_ledger (status, updated_at);

CREATE INDEX idx_curriculum_assignment_ledger_cohort
    ON academic_curriculum_assignment_ledger (
        programme_id,
        cohort_session,
        status
    );

-- ============================================================
-- 5. STUDENT-SPECIFIC CURRICULUM EXCEPTIONS
-- ============================================================
-- ADD_COURSE adds an individually required course.
-- EXCLUDE_COURSE exempts a student from a mapped requirement.
-- Neither action changes the original programme curriculum.

CREATE TABLE academic_student_curriculum_exceptions (
    id TEXT PRIMARY KEY,

    student_id TEXT NOT NULL,
    mapping_id TEXT NOT NULL,

    action TEXT NOT NULL
        CHECK (action IN ('ADD_COURSE', 'EXCLUDE_COURSE')),

    course_id TEXT NOT NULL,
    course_code_snapshot TEXT NOT NULL,
    course_title_snapshot TEXT NOT NULL,

    course_level_snapshot TEXT NOT NULL
        CHECK (course_level_snapshot IN ('ND I', 'ND II')),
    semester_snapshot TEXT NOT NULL CHECK (semester_snapshot IN ('First Semester', 'Second Semester')),
    credit_units_snapshot INTEGER NOT NULL CHECK (credit_units_snapshot > 0),
    is_compulsory_snapshot BOOLEAN NOT NULL CHECK (is_compulsory_snapshot = TRUE),
    reason TEXT NOT NULL
        CHECK (LENGTH(TRIM(reason)) > 0),

    status TEXT NOT NULL DEFAULT 'SUBMITTED'
        CHECK (status IN (
            'SUBMITTED',
            'APPROVED',
            'REJECTED'
        )),

    submitted_by TEXT NOT NULL,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    review_reason TEXT,

    CONSTRAINT fk_exception_student_assignment
        FOREIGN KEY (student_id, mapping_id)
        REFERENCES student_academic_curriculum_assignments (
            student_id,
            mapping_id
        )
        ON DELETE RESTRICT,

    CONSTRAINT chk_student_exception_review
        CHECK (
            (
                status = 'SUBMITTED'
                AND reviewed_by IS NULL
                AND reviewed_at IS NULL
            )
            OR
            (
                status IN ('APPROVED', 'REJECTED')
                AND reviewed_by IS NOT NULL
                AND LENGTH(TRIM(reviewed_by)) > 0
                AND reviewed_at IS NOT NULL
            )
        ),

    CONSTRAINT chk_student_exception_reviewer
        CHECK (
            reviewed_by IS NULL
            OR reviewed_by <> submitted_by
        ),

    CONSTRAINT chk_student_exception_review_reason
        CHECK (
            (
                status = 'SUBMITTED'
                AND review_reason IS NULL
            )
            OR
            (
                status = 'APPROVED'
                AND (
                    review_reason IS NULL
                    OR LENGTH(TRIM(review_reason)) > 0
                )
            )
            OR
            (
                status = 'REJECTED'
                AND review_reason IS NOT NULL
                AND LENGTH(TRIM(review_reason)) > 0
            )
        )
);

CREATE INDEX idx_student_curriculum_exceptions
    ON academic_student_curriculum_exceptions (
        student_id,
        status
    );

-- A student may have only one submitted or approved exception
-- for a particular course. Rejected requests may be resubmitted.
CREATE UNIQUE INDEX uq_active_student_curriculum_exception_course
    ON academic_student_curriculum_exceptions (
        student_id,
        course_id
    )
    WHERE status IN ('SUBMITTED', 'APPROVED');


-- ============================================================
-- 6. STUDENT EXCEPTION REVIEW HISTORY
-- ============================================================

CREATE TABLE academic_student_curriculum_exception_reviews (
    id TEXT PRIMARY KEY,

    exception_id TEXT NOT NULL
        REFERENCES academic_student_curriculum_exceptions(id)
        ON DELETE RESTRICT,

    action TEXT NOT NULL
        CHECK (action IN ('SUBMITTED', 'APPROVED', 'REJECTED')),

    actor_user_id TEXT NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_exception_review_history_reason
        CHECK (
            (
                action = 'SUBMITTED'
                AND reason IS NOT NULL
                AND LENGTH(TRIM(reason)) > 0
            )
            OR
            (
                action = 'APPROVED'
                AND (
                    reason IS NULL
                    OR LENGTH(TRIM(reason)) > 0
                )
            )
            OR
            (
                action = 'REJECTED'
                AND reason IS NOT NULL
                AND LENGTH(TRIM(reason)) > 0
            )
        )
);

CREATE INDEX idx_exception_reviews
    ON academic_student_curriculum_exception_reviews (
        exception_id,
        created_at DESC
    );


-- ============================================================
-- 7. EFFECTIVE STUDENT COMPULSORY COURSE REQUIREMENTS
-- ============================================================
-- Eligibility must use these snapshots, not the live catalogue.
--
-- Normal mapped requirement:
--   mapping_course_id is populated.
--
-- Approved ADD_COURSE exception:
--   exception_id is populated; mapping_course_id is NULL.
--
-- Approved EXCLUDE_COURSE exception:
--   both IDs are populated; the mapped row is retained with
--   is_required = FALSE and the approved exception is attached.

CREATE TABLE student_academic_required_courses (
    id TEXT PRIMARY KEY,

    student_id TEXT NOT NULL,
    programme_id TEXT NOT NULL,
    cohort_session TEXT NOT NULL,

    course_id TEXT NOT NULL,
    course_code_snapshot TEXT NOT NULL,
    course_title_snapshot TEXT NOT NULL,

    course_level_snapshot TEXT NOT NULL
        CHECK (course_level_snapshot IN ('ND I', 'ND II')),

    semester_snapshot TEXT NOT NULL
        CHECK (semester_snapshot IN (
            'First Semester',
            'Second Semester'
        )),

    credit_units_snapshot INTEGER NOT NULL
        CHECK (credit_units_snapshot > 0),

    is_required BOOLEAN NOT NULL DEFAULT TRUE,

    mapping_course_id TEXT
        REFERENCES academic_curriculum_mapping_courses(id)
        ON DELETE RESTRICT,

    exception_id TEXT
        REFERENCES academic_student_curriculum_exceptions(id)
        ON DELETE RESTRICT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_student_required_course
        UNIQUE (student_id, course_id),

    CONSTRAINT chk_required_course_origin
        CHECK (
            mapping_course_id IS NOT NULL
            OR exception_id IS NOT NULL
        )
);

CREATE INDEX idx_student_required_courses_student
    ON student_academic_required_courses (student_id);

CREATE INDEX idx_student_required_courses_cohort
    ON student_academic_required_courses (
        programme_id,
        cohort_session
    );


-- ============================================================
-- 8. STUDENT ACADEMIC PROGRESSION STATE
-- ============================================================

CREATE TABLE student_academic_progression (
    id TEXT PRIMARY KEY,

    student_id TEXT NOT NULL UNIQUE,
    programme_id TEXT NOT NULL,

    current_stage TEXT NOT NULL
        CHECK (current_stage IN (
            'ND_I',
            'ND_II',
            'EXTENSION_1',
            'EXTENSION_2',
            'EXTENSION_3',
            'GRADUATED'
        )),

    progression_status TEXT NOT NULL DEFAULT 'ACTIVE'
        CHECK (progression_status IN (
            'ACTIVE',
            'EXTENSION',
            'GRADUATION_PENDING',
            'GRADUATED',
            'WITHDRAWN'
        )),

    current_session TEXT NOT NULL,

    extension_year SMALLINT NOT NULL DEFAULT 0
        CHECK (extension_year BETWEEN 0 AND 3),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_progression_stage_year
        CHECK (
            (
                current_stage IN ('ND_I', 'ND_II')
                AND extension_year = 0
            )
            OR (
                current_stage = 'EXTENSION_1'
                AND extension_year = 1
            )
            OR (
                current_stage = 'EXTENSION_2'
                AND extension_year = 2
            )
            OR (
                current_stage = 'EXTENSION_3'
                AND extension_year = 3
            )
            OR (
                current_stage = 'GRADUATED'
                AND extension_year BETWEEN 0 AND 3
            )
        ),

    CONSTRAINT chk_progression_stage_status
        CHECK (
            (
                current_stage = 'GRADUATED'
                AND progression_status = 'GRADUATED'
            )
            OR (
                current_stage <> 'GRADUATED'
                AND progression_status <> 'GRADUATED'
            )
        ),

    CONSTRAINT chk_progression_extension_status
        CHECK (
            current_stage NOT IN (
                'EXTENSION_1',
                'EXTENSION_2',
                'EXTENSION_3'
            )
            OR progression_status IN (
                'EXTENSION',
                'GRADUATION_PENDING',
                'WITHDRAWN'
            )
        )
);

CREATE INDEX idx_academic_progression_status
    ON student_academic_progression (progression_status);

CREATE INDEX idx_academic_progression_programme
    ON student_academic_progression (programme_id, current_stage);


-- ============================================================
-- 9. APPEND-ONLY ACADEMIC PROGRESSION HISTORY
-- ============================================================

CREATE TABLE academic_progression_history (
    id TEXT PRIMARY KEY,

    student_id TEXT NOT NULL,
    programme_id TEXT NOT NULL,

    from_stage TEXT,
    to_stage TEXT NOT NULL,

    from_status TEXT,
    to_status TEXT NOT NULL,

    academic_session TEXT NOT NULL,

    extension_year SMALLINT NOT NULL DEFAULT 0
        CHECK (extension_year BETWEEN 0 AND 3),

    decision_type TEXT NOT NULL
        CHECK (decision_type IN (
            'INITIAL_RECORD',
            'SESSION_ROLLOVER',
            'NORMAL_CLEARANCE',
            'MANAGEMENT_APPROVED_PASS',
            'MANUAL_CORRECTION'
        )),

    outstanding_course_ids JSONB NOT NULL DEFAULT '[]'::jsonb
        CHECK (jsonb_typeof(outstanding_course_ids) = 'array'),

    missing_result_course_ids JSONB NOT NULL DEFAULT '[]'::jsonb
        CHECK (jsonb_typeof(missing_result_course_ids) = 'array'),

    reason TEXT,
    approved_by TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    idempotency_key TEXT NOT NULL UNIQUE,

    CONSTRAINT uq_progression_history_student
        UNIQUE (id, student_id),

    CONSTRAINT chk_management_pass_history
        CHECK (
            decision_type <> 'MANAGEMENT_APPROVED_PASS'
            OR (
                from_stage = 'EXTENSION_3'
                AND to_stage = 'GRADUATED'
                AND to_status = 'GRADUATED'
                AND extension_year = 3
                AND approved_by IS NOT NULL
                AND LENGTH(TRIM(approved_by)) > 0
                AND reason IS NOT NULL
                AND LENGTH(TRIM(reason)) > 0
            )
        )
);

CREATE INDEX idx_progression_history_student
    ON academic_progression_history (student_id, created_at DESC);

CREATE INDEX idx_progression_history_session
    ON academic_progression_history (academic_session);


-- ============================================================
-- 10. R E C T O R - A P P R O V E D MANAGEMENT PASS
-- ============================================================
-- The backend must permit this action only to the Rector.
-- This record is separate from ordinary examination clearance.

CREATE TABLE academic_management_pass_approvals (
    id TEXT PRIMARY KEY,

    student_id TEXT NOT NULL UNIQUE
        REFERENCES student_academic_progression(student_id)
        ON DELETE RESTRICT,

    extension_year SMALLINT NOT NULL
        CHECK (extension_year = 3),

    approved_by TEXT NOT NULL
        CHECK (LENGTH(TRIM(approved_by)) > 0),

    approval_reason TEXT NOT NULL
        CHECK (LENGTH(TRIM(approval_reason)) > 0),

    approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    history_id TEXT NOT NULL UNIQUE,

    CONSTRAINT fk_management_pass_history
        FOREIGN KEY (history_id, student_id)
        REFERENCES academic_progression_history (id, student_id)
        ON DELETE RESTRICT
);


-- ============================================================
-- 11. IMMUTABILITY AND APPEND-ONLY PROTECTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION prevent_academic_append_only_changes()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;


-- Review histories cannot be changed or deleted.

CREATE TRIGGER trg_curriculum_reviews_no_update_delete
BEFORE UPDATE OR DELETE ON academic_curriculum_mapping_reviews
FOR EACH ROW
EXECUTE FUNCTION prevent_academic_append_only_changes();

CREATE TRIGGER trg_curriculum_reviews_no_truncate
BEFORE TRUNCATE ON academic_curriculum_mapping_reviews
FOR EACH STATEMENT
EXECUTE FUNCTION prevent_academic_append_only_changes();

CREATE TRIGGER trg_exception_reviews_no_update_delete
BEFORE UPDATE OR DELETE ON academic_student_curriculum_exception_reviews
FOR EACH ROW
EXECUTE FUNCTION prevent_academic_append_only_changes();

CREATE TRIGGER trg_exception_reviews_no_truncate
BEFORE TRUNCATE ON academic_student_curriculum_exception_reviews
FOR EACH STATEMENT
EXECUTE FUNCTION prevent_academic_append_only_changes();

CREATE TRIGGER trg_progression_history_no_update_delete
BEFORE UPDATE OR DELETE ON academic_progression_history
FOR EACH ROW
EXECUTE FUNCTION prevent_academic_append_only_changes();

CREATE TRIGGER trg_progression_history_no_truncate
BEFORE TRUNCATE ON academic_progression_history
FOR EACH STATEMENT
EXECUTE FUNCTION prevent_academic_append_only_changes();

CREATE TRIGGER trg_management_pass_no_update_delete
BEFORE UPDATE OR DELETE ON academic_management_pass_approvals
FOR EACH ROW
EXECUTE FUNCTION prevent_academic_append_only_changes();

CREATE TRIGGER trg_management_pass_no_truncate
BEFORE TRUNCATE ON academic_management_pass_approvals
FOR EACH STATEMENT
EXECUTE FUNCTION prevent_academic_append_only_changes();


-- ============================================================
-- 12. CURRICULUM MAPPING HEADER PROTECTION
-- ============================================================
-- Once submitted, programme/cohort/version/preparer identity
-- cannot be changed. New content requires a new version.

CREATE OR REPLACE FUNCTION protect_academic_curriculum_mapping()
RETURNS TRIGGER AS $$
BEGIN
    -- Enforce the permitted status lifecycle.
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        IF NOT (
            (OLD.status = 'DRAFT' AND NEW.status = 'SUBMITTED')
            OR
            (OLD.status = 'SUBMITTED' AND NEW.status IN ('APPROVED', 'REJECTED'))
            OR
            (OLD.status = 'APPROVED' AND NEW.status = 'RETIRED')
        ) THEN
            RAISE EXCEPTION
                'Invalid curriculum mapping status transition: % to %',
                OLD.status, NEW.status;
        END IF;
    END IF;

    -- Once submitted, mapping identity cannot be changed.
    IF OLD.status <> 'DRAFT' THEN
        IF NEW.programme_id IS DISTINCT FROM OLD.programme_id
           OR NEW.cohort_session IS DISTINCT FROM OLD.cohort_session
           OR NEW.version IS DISTINCT FROM OLD.version
           OR NEW.prepared_by IS DISTINCT FROM OLD.prepared_by
           OR NEW.created_at IS DISTINCT FROM OLD.created_at
           OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
        THEN
            RAISE EXCEPTION
                'Submitted curriculum mapping identity and submission metadata are immutable';
        END IF;
    END IF;

    -- Approval metadata can only be introduced during approval.
    IF OLD.status <> 'SUBMITTED' THEN
        IF NEW.approved_by IS DISTINCT FROM OLD.approved_by
           OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
        THEN
            RAISE EXCEPTION
                'Curriculum mapping approval metadata is immutable';
        END IF;
    END IF;

    -- The Registrar must be independent of the preparing HOD.
    IF OLD.status = 'SUBMITTED' AND NEW.status = 'APPROVED' THEN
        IF NEW.approved_by IS NULL
           OR LENGTH(TRIM(NEW.approved_by)) = 0
           OR NEW.approved_by = NEW.prepared_by
           OR NEW.approved_at IS NULL
        THEN
            RAISE EXCEPTION
                'Approval requires a distinct authorized reviewer and timestamp';
        END IF;
    END IF;

    -- A rejection reason can only be introduced on rejection.
    IF OLD.status <> 'SUBMITTED' THEN
        IF NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason THEN
            RAISE EXCEPTION
                'Curriculum mapping rejection metadata is immutable';
        END IF;
    ELSIF NEW.status = 'REJECTED' THEN
        IF NEW.rejection_reason IS NULL
           OR LENGTH(TRIM(NEW.rejection_reason)) = 0
        THEN
            RAISE EXCEPTION
                'A rejection reason is required';
        END IF;
    ELSIF NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason THEN
        RAISE EXCEPTION
            'Rejection metadata can only be set when rejecting a mapping';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_protect_curriculum_mapping
BEFORE UPDATE ON academic_curriculum_mappings
FOR EACH ROW
EXECUTE FUNCTION protect_academic_curriculum_mapping();


-- ============================================================
-- 13. CURRICULUM COURSE SNAPSHOT PROTECTION
-- ============================================================
-- Course rows can only be inserted, updated or deleted while
-- their parent mapping is still a DRAFT.






-- ============================================================
-- 14. STUDENT ASSIGNMENT VALIDATION
-- ============================================================
-- The referenced mapping must be approved and must match the
-- student's assigned programme and admission cohort.

CREATE OR REPLACE FUNCTION validate_student_curriculum_assignment()
RETURNS TRIGGER AS $$
DECLARE
    mapping_status TEXT;
    mapping_is_current BOOLEAN;
BEGIN
    IF TG_OP = 'INSERT' AND NOT NEW.is_current THEN
        RAISE EXCEPTION
            'New curriculum assignments must be current';
    END IF;

    -- Historical assignments remain valid even when their
    -- mapping is no longer the current programme version.
    IF NOT NEW.is_current THEN
        RETURN NEW;
    END IF;

    SELECT status, is_current
      INTO mapping_status, mapping_is_current
      FROM academic_curriculum_mappings
     WHERE id = NEW.mapping_id
       AND programme_id = NEW.programme_id
       AND cohort_session = NEW.cohort_session
     FOR SHARE;

    IF mapping_status IS DISTINCT FROM 'APPROVED'
       OR mapping_is_current IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION
            'Current student assignments require the current approved mapping for the same programme and cohort';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_student_curriculum_assignment
BEFORE INSERT OR UPDATE
ON student_academic_curriculum_assignments
FOR EACH ROW
EXECUTE FUNCTION validate_student_curriculum_assignment();


-- ============================================================
-- 15. STUDENT EXCEPTION CONTENT PROTECTION
-- ============================================================
-- The trigger is created immediately after its function definition below.

-- ============================================================
-- 16. ADDITIONAL CURRICULUM INTEGRITY PROTECTIONS
-- ============================================================

-- The person preparing a mapping cannot approve that mapping.
ALTER TABLE academic_curriculum_mappings
ADD CONSTRAINT chk_curriculum_mapping_reviewer
CHECK (
    approved_by IS NULL
    OR approved_by <> prepared_by
);


-- Prevent moving a course snapshot out of a submitted mapping.
CREATE OR REPLACE FUNCTION protect_academic_curriculum_mapping_courses()
RETURNS TRIGGER AS $$
DECLARE
    old_status TEXT;
    new_status TEXT;
BEGIN
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
        SELECT status
          INTO old_status
          FROM academic_curriculum_mappings
         WHERE id = OLD.mapping_id
         FOR UPDATE;

        IF old_status IS DISTINCT FROM 'DRAFT' THEN
            RAISE EXCEPTION
                'Existing course snapshots can only change while their mapping is DRAFT';
        END IF;
    END IF;

    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        SELECT status
          INTO new_status
          FROM academic_curriculum_mappings
         WHERE id = NEW.mapping_id
         FOR UPDATE;

        IF new_status IS DISTINCT FROM 'DRAFT' THEN
            RAISE EXCEPTION
                'Course snapshots can only be added to a DRAFT mapping';
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_protect_curriculum_mapping_courses
BEFORE INSERT OR UPDATE OR DELETE
ON academic_curriculum_mapping_courses
FOR EACH ROW
EXECUTE FUNCTION protect_academic_curriculum_mapping_courses();


-- Student exception records must never be physically deleted.
CREATE TRIGGER trg_student_exception_no_delete
BEFORE DELETE ON academic_student_curriculum_exceptions
FOR EACH ROW
EXECUTE FUNCTION prevent_academic_append_only_changes();


-- Effective course identity and snapshots cannot be rewritten.
-- The service may update is_required and exception_id when
-- applying an approved exclusion, but cannot delete the row.

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
    THEN
        RAISE EXCEPTION
            'Student required-course identity and snapshots are immutable';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_protect_student_required_course
BEFORE UPDATE OR DELETE
ON student_academic_required_courses
FOR EACH ROW
EXECUTE FUNCTION protect_student_required_course();

-- ============================================================
-- 16. CURRENT MAPPING AND ASSIGNMENT HISTORY PROTECTION
-- ============================================================

CREATE OR REPLACE FUNCTION protect_current_curriculum_mapping()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_current AND NEW.status <> 'APPROVED' THEN
        RAISE EXCEPTION
            'Only an approved mapping can be current';
    END IF;

    IF OLD.is_current AND NOT NEW.is_current
       AND EXISTS (
           SELECT 1
             FROM student_academic_curriculum_assignments
            WHERE mapping_id = OLD.id
              AND is_current = TRUE
       )
    THEN
        RAISE EXCEPTION
            'Move student assignments to historical status before replacing the current mapping';
    END IF;

    IF NEW.status = 'RETIRED'
       AND EXISTS (
           SELECT 1
             FROM student_academic_curriculum_assignments
            WHERE mapping_id = OLD.id
              AND is_current = TRUE
       )
    THEN
        RAISE EXCEPTION
            'A mapping with current student assignments cannot be retired';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_protect_current_curriculum_mapping
BEFORE UPDATE ON academic_curriculum_mappings
FOR EACH ROW
EXECUTE FUNCTION protect_current_curriculum_mapping();


CREATE OR REPLACE FUNCTION protect_student_curriculum_assignment()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION
            'Student curriculum assignment history cannot be deleted';
    END IF;

    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.student_id IS DISTINCT FROM OLD.student_id
       OR NEW.programme_id IS DISTINCT FROM OLD.programme_id
       OR NEW.cohort_session IS DISTINCT FROM OLD.cohort_session
       OR NEW.mapping_id IS DISTINCT FROM OLD.mapping_id
       OR NEW.assigned_by IS DISTINCT FROM OLD.assigned_by
       OR NEW.assigned_at IS DISTINCT FROM OLD.assigned_at
    THEN
        RAISE EXCEPTION
            'Student curriculum assignment identity is immutable';
    END IF;

    IF NOT OLD.is_current OR NEW.is_current THEN
        RAISE EXCEPTION
            'Only a current assignment may be moved to historical status';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_protect_student_curriculum_assignment
BEFORE UPDATE OR DELETE
ON student_academic_curriculum_assignments
FOR EACH ROW
EXECUTE FUNCTION protect_student_curriculum_assignment();

-- ============================================================
-- 17. CONSOLIDATED ACADEMIC INTEGRITY CORRECTIONS
-- ============================================================


-- Rejected and retired mapping reviews require a reason.
ALTER TABLE academic_curriculum_mapping_reviews
    ADD CONSTRAINT chk_curriculum_review_reason
    CHECK (
        action NOT IN ('REJECTED', 'RETIRED')
        OR (
            reason IS NOT NULL
            AND LENGTH(TRIM(reason)) > 0
        )
    );


-- Manual progression corrections must be explained.
ALTER TABLE academic_progression_history
    ADD CONSTRAINT chk_manual_progression_correction_reason
    CHECK (
        decision_type <> 'MANUAL_CORRECTION'
        OR (
            reason IS NOT NULL
            AND LENGTH(TRIM(reason)) > 0
        )
    );


-- Exception decisions are one-way:
-- SUBMITTED -> APPROVED or SUBMITTED -> REJECTED.
CREATE OR REPLACE FUNCTION protect_student_curriculum_exception()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status <> 'SUBMITTED' THEN
        RAISE EXCEPTION
            'Reviewed student curriculum exceptions cannot be modified';
    END IF;

    IF NEW.status NOT IN ('APPROVED', 'REJECTED') THEN
        RAISE EXCEPTION
            'A submitted exception must transition to APPROVED or REJECTED';
    END IF;

    IF NEW.student_id IS DISTINCT FROM OLD.student_id
       OR NEW.mapping_id IS DISTINCT FROM OLD.mapping_id
       OR NEW.action IS DISTINCT FROM OLD.action
       OR NEW.course_id IS DISTINCT FROM OLD.course_id
       OR NEW.course_code_snapshot IS DISTINCT FROM OLD.course_code_snapshot
       OR NEW.course_title_snapshot IS DISTINCT FROM OLD.course_title_snapshot
       OR NEW.course_level_snapshot IS DISTINCT FROM OLD.course_level_snapshot
       OR NEW.semester_snapshot IS DISTINCT FROM OLD.semester_snapshot
       OR NEW.credit_units_snapshot IS DISTINCT FROM OLD.credit_units_snapshot
       OR NEW.is_compulsory_snapshot IS DISTINCT FROM OLD.is_compulsory_snapshot
       OR NEW.reason IS DISTINCT FROM OLD.reason
       OR NEW.submitted_by IS DISTINCT FROM OLD.submitted_by
       OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
    THEN
        RAISE EXCEPTION
            'Submitted exception details are immutable';
    END IF;

    IF NEW.reviewed_by IS NULL
       OR LENGTH(TRIM(NEW.reviewed_by)) = 0
       OR NEW.reviewed_by = OLD.submitted_by
       OR NEW.reviewed_at IS NULL
       OR (
           NEW.status = 'REJECTED'
           AND (
               NEW.review_reason IS NULL
               OR LENGTH(TRIM(NEW.review_reason)) = 0
           )
       )
       OR (
           NEW.status = 'APPROVED'
           AND NEW.review_reason IS NOT NULL
           AND LENGTH(TRIM(NEW.review_reason)) = 0
       )
    THEN
        RAISE EXCEPTION
            'Exception review requires an independent reviewer and timestamp; rejection requires a reason';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_protect_student_curriculum_exception
BEFORE UPDATE ON academic_student_curriculum_exceptions
FOR EACH ROW
EXECUTE FUNCTION protect_student_curriculum_exception();


-- Required-course records must originate from the student's
-- assigned mapping or a matching approved exception.
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

    -- A mapped course must match the exact course and snapshots
    -- in the student's current assigned curriculum.
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
           AND mc.course_level_snapshot = NEW.course_level_snapshot
           AND mc.semester_snapshot = NEW.semester_snapshot
           AND mc.credit_units_snapshot = NEW.credit_units_snapshot
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

    -- Any attached exception must be approved and match the
    -- same student, course, snapshots and assigned cohort.
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
           AND e.course_level_snapshot = NEW.course_level_snapshot
           AND e.semester_snapshot = NEW.semester_snapshot
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

    -- Approved additional compulsory course.
    IF NEW.mapping_course_id IS NULL
       AND NEW.exception_id IS NOT NULL
    THEN
        IF exception_action IS DISTINCT FROM 'ADD_COURSE'
           OR NOT NEW.is_required
        THEN
            RAISE EXCEPTION
                'An additional course requires an approved ADD_COURSE exception and must remain required';
        END IF;

        RETURN NEW;
    END IF;

    -- Approved exclusion: retain the mapped row but mark it
    -- as not required for this particular student.
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

CREATE TRIGGER trg_validate_student_required_course_integrity
BEFORE INSERT OR UPDATE
ON student_academic_required_courses
FOR EACH ROW
EXECUTE FUNCTION validate_student_required_course_integrity();


-- Exception records must not be truncated.
CREATE TRIGGER trg_student_exceptions_no_truncate
BEFORE TRUNCATE ON academic_student_curriculum_exceptions
FOR EACH STATEMENT
EXECUTE FUNCTION prevent_academic_append_only_changes();

-- ============================================================
-- END CONSOLIDATED ACADEMIC INTEGRITY CORRECTIONS
-- ============================================================

-- ============================================================
-- PROGRESSION RECORD RETENTION AND MANAGEMENT PASS INTEGRITY
-- ============================================================

-- Every progression history entry must belong to an existing
-- student progression record.
ALTER TABLE academic_progression_history
    ADD CONSTRAINT fk_progression_history_student
    FOREIGN KEY (student_id)
    REFERENCES student_academic_progression (student_id)
    ON DELETE RESTRICT;


-- Progression records may be updated through controlled
-- transactions, but must never be physically deleted.
CREATE TRIGGER trg_student_progression_no_delete
BEFORE DELETE ON student_academic_progression
FOR EACH ROW
EXECUTE FUNCTION prevent_academic_append_only_changes();

CREATE TRIGGER trg_student_progression_no_truncate
BEFORE TRUNCATE ON student_academic_progression
FOR EACH STATEMENT
EXECUTE FUNCTION prevent_academic_append_only_changes();


CREATE TRIGGER trg_management_pass_approvals_no_truncate
BEFORE TRUNCATE ON academic_management_pass_approvals
FOR EACH STATEMENT
EXECUTE FUNCTION prevent_academic_append_only_changes();


-- A management-pass approval must match its immutable history
-- entry and the student's already-recorded graduated state.
CREATE OR REPLACE FUNCTION validate_management_pass_approval()
RETURNS TRIGGER AS $$
DECLARE
    progression_stage TEXT;
    progression_status TEXT;
    history_matches BOOLEAN;
BEGIN
    SELECT current_stage, progression_status
      INTO progression_stage, progression_status
      FROM student_academic_progression
     WHERE student_id = NEW.student_id
     FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Management approval requires an existing progression record';
    END IF;

    IF progression_stage IS DISTINCT FROM 'GRADUATED'
       OR progression_status IS DISTINCT FROM 'GRADUATED'
    THEN
        RAISE EXCEPTION
            'Management approval requires the student progression record to be GRADUATED';
    END IF;

    SELECT EXISTS (
        SELECT 1
          FROM academic_progression_history h
         WHERE h.id = NEW.history_id
           AND h.student_id = NEW.student_id
           AND h.decision_type = 'MANAGEMENT_APPROVED_PASS'
           AND h.from_stage = 'EXTENSION_3'
           AND h.to_stage = 'GRADUATED'
           AND h.to_status = 'GRADUATED'
           AND h.extension_year = 3
           AND h.approved_by = NEW.approved_by
           AND h.reason = NEW.approval_reason
           AND NEW.extension_year = 3
    )
    INTO history_matches;

    IF history_matches IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION
            'Management approval does not match a valid Extension Year 3 Rector decision in progression history';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_management_pass_approval
BEFORE INSERT ON academic_management_pass_approvals
FOR EACH ROW
EXECUTE FUNCTION validate_management_pass_approval();

-- ============================================================
-- END PROGRESSION INTEGRITY PATCH
-- ============================================================



-- ============================================================
-- 18. CURRICULUM ASSIGNMENT LEDGER AND ADDITIONAL RETENTION GUARDS
-- ============================================================

CREATE OR REPLACE FUNCTION protect_academic_curriculum_assignment_ledger()
RETURNS TRIGGER AS $$
DECLARE
    assignment_exists BOOLEAN;
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION
            'Curriculum assignment ledger records cannot be deleted';
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF NEW.id IS DISTINCT FROM OLD.id
           OR NEW.student_id IS DISTINCT FROM OLD.student_id
           OR NEW.programme_id IS DISTINCT FROM OLD.programme_id
           OR NEW.cohort_session IS DISTINCT FROM OLD.cohort_session
           OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
           OR NEW.created_at IS DISTINCT FROM OLD.created_at
        THEN
            RAISE EXCEPTION
                'Curriculum assignment ledger identity is immutable';
        END IF;

        IF NEW.attempt_count < OLD.attempt_count THEN
            RAISE EXCEPTION
                'Curriculum assignment attempt count cannot decrease';
        END IF;

        IF NEW.status IS DISTINCT FROM OLD.status
           AND NOT (
                (OLD.status = 'PENDING'
                    AND NEW.status IN ('ASSIGNED', 'REVIEW_REQUIRED', 'FAILED'))
                OR
                (OLD.status IN ('FAILED', 'REVIEW_REQUIRED')
                    AND NEW.status = 'PENDING')
           )
        THEN
            RAISE EXCEPTION
                'Invalid curriculum assignment ledger transition: % to %',
                OLD.status, NEW.status;
        END IF;
    END IF;

    IF NEW.status = 'ASSIGNED' THEN
        SELECT EXISTS (
            SELECT 1
              FROM student_academic_curriculum_assignments a
             WHERE a.student_id = NEW.student_id
               AND a.programme_id = NEW.programme_id
               AND a.cohort_session = NEW.cohort_session
               AND a.mapping_id = NEW.mapping_id
               AND a.is_current = TRUE
        )
        INTO assignment_exists;

        IF assignment_exists IS DISTINCT FROM TRUE THEN
            RAISE EXCEPTION
                'ASSIGNED ledger status requires a matching current student curriculum assignment';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_protect_academic_curriculum_assignment_ledger
BEFORE INSERT OR UPDATE OR DELETE
ON academic_curriculum_assignment_ledger
FOR EACH ROW
EXECUTE FUNCTION protect_academic_curriculum_assignment_ledger();

CREATE TRIGGER trg_curriculum_assignment_ledger_no_truncate
BEFORE TRUNCATE ON academic_curriculum_assignment_ledger
FOR EACH STATEMENT
EXECUTE FUNCTION prevent_academic_append_only_changes();


-- A submitted or reviewed mapping cannot be physically deleted.
CREATE OR REPLACE FUNCTION protect_academic_curriculum_mapping_delete()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status <> 'DRAFT' THEN
        RAISE EXCEPTION
            'Only an unused DRAFT curriculum mapping may be deleted';
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_protect_academic_curriculum_mapping_delete
BEFORE DELETE ON academic_curriculum_mappings
FOR EACH ROW
EXECUTE FUNCTION protect_academic_curriculum_mapping_delete();


-- Protect retained academic structures from TRUNCATE as well as
-- ordinary row deletion.
CREATE TRIGGER trg_curriculum_mappings_no_truncate
BEFORE TRUNCATE ON academic_curriculum_mappings
FOR EACH STATEMENT
EXECUTE FUNCTION prevent_academic_append_only_changes();

CREATE TRIGGER trg_mapping_courses_no_truncate
BEFORE TRUNCATE ON academic_curriculum_mapping_courses
FOR EACH STATEMENT
EXECUTE FUNCTION prevent_academic_append_only_changes();

CREATE TRIGGER trg_student_assignments_no_truncate
BEFORE TRUNCATE ON student_academic_curriculum_assignments
FOR EACH STATEMENT
EXECUTE FUNCTION prevent_academic_append_only_changes();

CREATE TRIGGER trg_student_required_courses_no_truncate
BEFORE TRUNCATE ON student_academic_required_courses
FOR EACH STATEMENT
EXECUTE FUNCTION prevent_academic_append_only_changes();

CREATE TRIGGER trg_student_progression_history_no_truncate
BEFORE TRUNCATE ON student_academic_progression
FOR EACH STATEMENT
EXECUTE FUNCTION prevent_academic_append_only_changes();


-- ============================================================
-- 19. CONTROLLED PROGRESSION TRANSITIONS
-- ============================================================
-- Database safeguards enforce the permitted stage sequence.
-- Academic eligibility itself must still be evaluated by the
-- backend against published results and required-course snapshots.

CREATE OR REPLACE FUNCTION protect_student_academic_progression_update()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.student_id IS DISTINCT FROM OLD.student_id
       OR NEW.programme_id IS DISTINCT FROM OLD.programme_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
        RAISE EXCEPTION
            'Student progression identity is immutable';
    END IF;

    IF OLD.progression_status = 'WITHDRAWN'
       AND (
            NEW.current_stage IS DISTINCT FROM OLD.current_stage
            OR NEW.progression_status IS DISTINCT FROM OLD.progression_status
       )
    THEN
        RAISE EXCEPTION
            'A withdrawn progression record cannot advance without an authorized correction workflow';
    END IF;

    IF NEW.current_stage IS DISTINCT FROM OLD.current_stage THEN
        IF NOT (
            (OLD.current_stage = 'ND_I'
                AND NEW.current_stage = 'ND_II')
            OR
            (OLD.current_stage = 'ND_II'
                AND NEW.current_stage IN ('EXTENSION_1', 'GRADUATED'))
            OR
            (OLD.current_stage = 'EXTENSION_1'
                AND NEW.current_stage IN ('EXTENSION_2', 'GRADUATED'))
            OR
            (OLD.current_stage = 'EXTENSION_2'
                AND NEW.current_stage IN ('EXTENSION_3', 'GRADUATED'))
            OR
            (OLD.current_stage = 'EXTENSION_3'
                AND NEW.current_stage = 'GRADUATED')
        )
        THEN
            RAISE EXCEPTION
                'Invalid academic progression stage transition: % to %',
                OLD.current_stage, NEW.current_stage;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_protect_student_academic_progression_update
BEFORE UPDATE ON student_academic_progression
FOR EACH ROW
EXECUTE FUNCTION protect_student_academic_progression_update();


-- Every change to stage, status, session or extension year must
-- have a matching immutable history row in the same transaction.
CREATE OR REPLACE FUNCTION require_academic_progression_history()
RETURNS TRIGGER AS $$
DECLARE
    matching_history BOOLEAN;
BEGIN
    IF NEW.current_stage IS NOT DISTINCT FROM OLD.current_stage
       AND NEW.progression_status IS NOT DISTINCT FROM OLD.progression_status
       AND NEW.current_session IS NOT DISTINCT FROM OLD.current_session
       AND NEW.extension_year IS NOT DISTINCT FROM OLD.extension_year
    THEN
        RETURN NEW;
    END IF;

    SELECT EXISTS (
        SELECT 1
          FROM academic_progression_history h
         WHERE h.student_id = NEW.student_id
           AND h.from_stage IS NOT DISTINCT FROM OLD.current_stage
           AND h.to_stage = NEW.current_stage
           AND h.from_status IS NOT DISTINCT FROM OLD.progression_status
           AND h.to_status = NEW.progression_status
           AND h.academic_session = NEW.current_session
           AND h.extension_year = NEW.extension_year
           AND (
                h.decision_type IN ('SESSION_ROLLOVER', 'NORMAL_CLEARANCE')
                OR
                (
                    h.decision_type = 'MANUAL_CORRECTION'
                    AND h.reason IS NOT NULL
                    AND LENGTH(TRIM(h.reason)) > 0
                )
                OR
                (
                    h.decision_type = 'MANAGEMENT_APPROVED_PASS'
                    AND OLD.current_stage = 'EXTENSION_3'
                    AND NEW.current_stage = 'GRADUATED'
                    AND NEW.progression_status = 'GRADUATED'
                    AND h.approved_by IS NOT NULL
                    AND LENGTH(TRIM(h.approved_by)) > 0
                    AND h.reason IS NOT NULL
                    AND LENGTH(TRIM(h.reason)) > 0
                )
           )
    )
    INTO matching_history;

    IF matching_history IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION
            'Academic progression changes require a matching history record in the same transaction';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER trg_require_academic_progression_history
AFTER UPDATE ON student_academic_progression
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION require_academic_progression_history();


CREATE OR REPLACE FUNCTION validate_academic_progression_history_target()
RETURNS TRIGGER AS $$
DECLARE
    progression_matches BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
          FROM student_academic_progression p
         WHERE p.student_id = NEW.student_id
           AND p.current_stage = NEW.to_stage
           AND p.progression_status = NEW.to_status
           AND p.current_session = NEW.academic_session
           AND p.extension_year = NEW.extension_year
    )
    INTO progression_matches;

    IF progression_matches IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION
            'Progression history must match the final progression state in the same transaction';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER trg_validate_academic_progression_history_target
AFTER INSERT ON academic_progression_history
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION validate_academic_progression_history_target();


-- A newly created progression record must be accompanied by one
-- INITIAL_RECORD history entry in the same transaction.
CREATE OR REPLACE FUNCTION require_initial_academic_progression_history()
RETURNS TRIGGER AS $
DECLARE
    initial_history_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
          FROM academic_progression_history h
         WHERE h.student_id = NEW.student_id
           AND h.from_stage IS NULL
           AND h.to_stage = NEW.current_stage
           AND h.from_status IS NULL
           AND h.to_status = NEW.progression_status
           AND h.academic_session = NEW.current_session
           AND h.extension_year = NEW.extension_year
           AND h.decision_type = 'INITIAL_RECORD'
    )
    INTO initial_history_exists;

    IF initial_history_exists IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION
            'A new academic progression record requires a matching INITIAL_RECORD history entry in the same transaction';
    END IF;

    RETURN NEW;
END;
$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER trg_require_initial_academic_progression_history
AFTER INSERT ON student_academic_progression
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION require_initial_academic_progression_history();


-- ============================================================
-- 20. MANAGEMENT PASS AUTHORIZATION BOUNDARY
-- ============================================================
-- The database verifies the Extension Year 3 decision and its
-- matching history. The backend MUST independently verify that
-- the authenticated actor has the Rector role. Do not trust a
-- client-supplied approved_by value as proof of authorization.

COMMIT;
