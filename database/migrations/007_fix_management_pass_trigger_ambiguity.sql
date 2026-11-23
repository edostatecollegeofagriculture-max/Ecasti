-- Corrective patch for databases where Migration 006 has already been applied.
-- Safe to run more than once; replaces only the trigger function.
CREATE OR REPLACE FUNCTION validate_management_pass_approval()
RETURNS TRIGGER AS $$
DECLARE
    v_progression_stage TEXT;
    v_progression_status TEXT;
    history_matches BOOLEAN;
BEGIN
    SELECT p.current_stage, p.progression_status
      INTO v_progression_stage, v_progression_status
      FROM student_academic_progression AS p
     WHERE p.student_id = NEW.student_id
     FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Management approval requires an existing progression record';
    END IF;

    IF v_progression_stage IS DISTINCT FROM 'GRADUATED'
       OR v_progression_status IS DISTINCT FROM 'GRADUATED'
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
