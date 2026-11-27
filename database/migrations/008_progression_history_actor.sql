-- Add authenticated decision-maker attribution to progression history.
-- Existing history rows remain intact; new inserts must identify their actor.
BEGIN;

ALTER TABLE academic_progression_history
    ADD COLUMN IF NOT EXISTS decided_by TEXT;

CREATE OR REPLACE FUNCTION require_academic_progression_history_actor()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.decided_by IS NULL OR LENGTH(TRIM(NEW.decided_by)) = 0 THEN
        RAISE EXCEPTION 'Academic progression history requires an authenticated decision actor';
    END IF;

    IF NEW.decision_type = 'MANAGEMENT_APPROVED_PASS'
       AND NEW.decided_by IS DISTINCT FROM NEW.approved_by
    THEN
        RAISE EXCEPTION 'Management-pass decision actor must match the recorded Rector approver';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_require_academic_progression_history_actor
    ON academic_progression_history;

CREATE TRIGGER trg_require_academic_progression_history_actor
BEFORE INSERT ON academic_progression_history
FOR EACH ROW
EXECUTE FUNCTION require_academic_progression_history_actor();

COMMIT;
