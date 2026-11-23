BEGIN;

-- 009: Authoritative, versioned academic result source.
-- This migration is additive: it does not import, alter, or delete JSON data.
-- Student/course identifiers remain TEXT until their master records are migrated.

CREATE TABLE academic_result_attempts (
    id TEXT PRIMARY KEY,
    legacy_result_id TEXT,
    student_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    academic_session TEXT NOT NULL,
    semester TEXT NOT NULL CHECK (semester IN ('First Semester', 'Second Semester')),
    attempt_number INTEGER NOT NULL CHECK (attempt_number > 0),
    ca_score NUMERIC(7,2) NOT NULL CHECK (ca_score >= 0),
    exam_score NUMERIC(7,2) NOT NULL CHECK (exam_score >= 0),
    total_score NUMERIC(7,2) NOT NULL CHECK (total_score >= 0),
    grade TEXT NOT NULL,
    grade_point NUMERIC(5,2) NOT NULL CHECK (grade_point >= 0),
    entered_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_academic_result_attempt
        UNIQUE (student_id, course_id, academic_session, semester, attempt_number),
    CONSTRAINT uq_academic_result_legacy_id UNIQUE (legacy_result_id)
);

CREATE INDEX idx_academic_result_attempt_lookup
    ON academic_result_attempts (student_id, course_id, academic_session, semester);

CREATE TABLE academic_result_events (
    id TEXT PRIMARY KEY,
    result_attempt_id TEXT NOT NULL
        REFERENCES academic_result_attempts(id) ON DELETE RESTRICT,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'SUBMITTED', 'VERIFIED', 'APPROVED', 'PUBLISHED',
        'INVALIDATED', 'CANCELLED'
    )),
    actor_user_id TEXT NOT NULL,
    reason TEXT,
    idempotency_key TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_academic_result_event_reason
        CHECK (
            event_type NOT IN ('INVALIDATED', 'CANCELLED')
            OR (reason IS NOT NULL AND LENGTH(TRIM(reason)) > 0)
        )
);

CREATE INDEX idx_academic_result_events_attempt
    ON academic_result_events (result_attempt_id, created_at DESC, id);

-- Event history is append-only. Corrections are represented by new events,
-- never by rewriting or deleting a publication/invalidation record.
CREATE OR REPLACE FUNCTION prevent_academic_result_event_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Academic result events are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_academic_result_events_no_update_delete
BEFORE UPDATE OR DELETE ON academic_result_events
FOR EACH ROW EXECUTE FUNCTION prevent_academic_result_event_mutation();

CREATE TRIGGER trg_academic_result_events_no_truncate
BEFORE TRUNCATE ON academic_result_events
FOR EACH STATEMENT EXECUTE FUNCTION prevent_academic_append_only_changes();

-- Published score snapshots cannot be edited in place. A correction requires
-- a new attempt/revision and an explicit invalidation event where appropriate.
CREATE OR REPLACE FUNCTION protect_published_academic_result_attempt()
RETURNS TRIGGER AS $$
DECLARE
    has_published_event BOOLEAN;
BEGIN
    IF OLD.id IS DISTINCT FROM NEW.id
       OR OLD.student_id IS DISTINCT FROM NEW.student_id
       OR OLD.course_id IS DISTINCT FROM NEW.course_id
       OR OLD.academic_session IS DISTINCT FROM NEW.academic_session
       OR OLD.semester IS DISTINCT FROM NEW.semester
       OR OLD.attempt_number IS DISTINCT FROM NEW.attempt_number
       OR OLD.legacy_result_id IS DISTINCT FROM NEW.legacy_result_id
       OR OLD.created_at IS DISTINCT FROM NEW.created_at
       OR OLD.entered_by IS DISTINCT FROM NEW.entered_by
    THEN
        RAISE EXCEPTION 'Academic result attempt identity is immutable';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM academic_result_events e
         WHERE e.result_attempt_id = OLD.id
           AND e.event_type = 'PUBLISHED'
    ) INTO has_published_event;

    IF has_published_event AND (
        OLD.ca_score IS DISTINCT FROM NEW.ca_score
        OR OLD.exam_score IS DISTINCT FROM NEW.exam_score
        OR OLD.total_score IS DISTINCT FROM NEW.total_score
        OR OLD.grade IS DISTINCT FROM NEW.grade
        OR OLD.grade_point IS DISTINCT FROM NEW.grade_point
    ) THEN
        RAISE EXCEPTION 'Published academic result scores cannot be edited in place';
    END IF;

    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_protect_published_academic_result_attempt
BEFORE UPDATE ON academic_result_attempts
FOR EACH ROW EXECUTE FUNCTION protect_published_academic_result_attempt();

CREATE TRIGGER trg_academic_result_attempts_no_delete
BEFORE DELETE ON academic_result_attempts
FOR EACH ROW EXECUTE FUNCTION prevent_academic_append_only_changes();

CREATE TRIGGER trg_academic_result_attempts_no_truncate
BEFORE TRUNCATE ON academic_result_attempts
FOR EACH STATEMENT EXECUTE FUNCTION prevent_academic_append_only_changes();

-- A single freshness record describes whether the Neon result source has
-- completed a full, verified synchronization from the institutional source.
CREATE TABLE academic_result_source_sync (
    id TEXT PRIMARY KEY CHECK (id = 'primary'),
    source_name TEXT NOT NULL,
    last_successful_sync_at TIMESTAMPTZ,
    source_watermark TEXT,
    is_complete BOOLEAN NOT NULL DEFAULT FALSE,
    failure_reason TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_academic_result_sync_complete
        CHECK (
            is_complete = FALSE
            OR (
                last_successful_sync_at IS NOT NULL
                AND source_watermark IS NOT NULL
                AND LENGTH(TRIM(source_watermark)) > 0
                AND failure_reason IS NULL
            )
        )
);

INSERT INTO academic_result_source_sync (
    id, source_name, is_complete
) VALUES (
    'primary', 'EDOCASTI authoritative published results', FALSE
);

-- Consumers must treat this view as authoritative only when the sync row is
-- complete and sufficiently fresh. A published attempt remains valid until
-- an explicit INVALIDATED or CANCELLED event supersedes its publication.
CREATE VIEW academic_authoritative_published_results AS
WITH latest_attempt_event AS (
    SELECT DISTINCT ON (e.result_attempt_id)
        e.result_attempt_id,
        e.event_type,
        e.created_at AS event_at
    FROM academic_result_events e
    ORDER BY e.result_attempt_id, e.created_at DESC, e.id DESC
)
SELECT
    a.id AS result_attempt_id,
    a.legacy_result_id,
    a.student_id,
    a.course_id,
    a.academic_session,
    a.semester,
    a.attempt_number,
    a.ca_score,
    a.exam_score,
    a.total_score,
    a.grade,
    a.grade_point,
    e.event_at AS published_at
FROM academic_result_attempts a
JOIN latest_attempt_event e
  ON e.result_attempt_id = a.id
 AND e.event_type = 'PUBLISHED';

COMMIT;
