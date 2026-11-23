BEGIN;

CREATE TABLE admission_fee_activation_ledger (
    application_id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    programme_id TEXT NOT NULL,
    academic_session TEXT NOT NULL,
    level TEXT NOT NULL,

    status TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),

    activated_by TEXT NOT NULL,

    attempts INTEGER NOT NULL DEFAULT 0
        CHECK (attempts >= 0),

    last_error TEXT,
    activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT admission_fee_ledger_completion_check
        CHECK (
            (status = 'COMPLETED' AND completed_at IS NOT NULL)
            OR
            (status <> 'COMPLETED' AND completed_at IS NULL)
        )
);

CREATE INDEX idx_admission_fee_ledger_status
    ON admission_fee_activation_ledger (status, created_at);

CREATE INDEX idx_admission_fee_ledger_student
    ON admission_fee_activation_ledger (student_id, academic_session);

COMMENT ON TABLE admission_fee_activation_ledger IS
    'Tracks admissions activated for the itemized fee system after go-live and supports safe obligation-generation retries.';

COMMENT ON COLUMN admission_fee_activation_ledger.application_id IS
    'Unique application identifier from the existing application store.';

COMMENT ON COLUMN admission_fee_activation_ledger.last_error IS
    'Operational error summary for retry support. Must not contain credentials or unnecessary personal data.';

COMMIT;
