-- EDOCASTI Fee Management
-- Migration: 001_fee_management_schema
--
-- IMPORTANT:
-- This migration is a reviewed schema proposal.
-- It is NOT executed by this file-creation script.
--
-- Core users, students and programmes currently live in the
-- JSON database. Their IDs are stored as TEXT here without
-- external foreign keys until those core entities are migrated.
--
-- Internal relationships between fee tables are enforced below.

BEGIN;

CREATE TABLE fee_catalog (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    fee_type TEXT NOT NULL
        CHECK (fee_type IN ('ONE_TIME', 'PER_SESSION')),
    category TEXT NOT NULL
        CHECK (category IN ('COMPULSORY', 'OPTIONAL')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    description TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE program_fee_schedule (
    id TEXT PRIMARY KEY,
    programme_id TEXT NOT NULL,
    session TEXT NOT NULL,
    level TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT', 'PUBLISHED')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL,
    published_at TIMESTAMPTZ,
    created_by TEXT NOT NULL
);

-- At most one active schedule for a programme/session/level.
CREATE UNIQUE INDEX uq_active_program_fee_schedule
    ON program_fee_schedule (programme_id, session, level)
    WHERE is_active = TRUE;

CREATE INDEX idx_program_fee_schedule_lookup
    ON program_fee_schedule (programme_id, session, level);

CREATE TABLE program_fee_schedule_items (
    id TEXT PRIMARY KEY,
    schedule_id TEXT NOT NULL
        REFERENCES program_fee_schedule(id) ON DELETE RESTRICT,
    fee_catalog_item_id TEXT NOT NULL
        REFERENCES fee_catalog(id) ON DELETE RESTRICT,
    amount_override NUMERIC(12,2)
        CHECK (amount_override IS NULL OR amount_override > 0),
    fee_name_snapshot TEXT NOT NULL,
    fee_category_snapshot TEXT NOT NULL
        CHECK (fee_category_snapshot IN ('COMPULSORY', 'OPTIONAL')),
    fee_type_snapshot TEXT NOT NULL
        CHECK (fee_type_snapshot IN ('ONE_TIME', 'PER_SESSION')),
    allocation_priority INTEGER NOT NULL DEFAULT 100 CHECK (allocation_priority >= 0),
    CONSTRAINT uq_schedule_fee_item
        UNIQUE (schedule_id, fee_catalog_item_id)
);

CREATE TABLE student_fee_obligations (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    programme_id TEXT NOT NULL,
    session TEXT NOT NULL,
    level TEXT NOT NULL,
    fee_catalog_item_id TEXT NOT NULL
        REFERENCES fee_catalog(id) ON DELETE RESTRICT,
    fee_name_snapshot TEXT NOT NULL,
    fee_category_snapshot TEXT NOT NULL
        CHECK (fee_category_snapshot IN ('COMPULSORY', 'OPTIONAL')),
    fee_type_snapshot TEXT NOT NULL
        CHECK (fee_type_snapshot IN ('ONE_TIME', 'PER_SESSION')),
    allocation_priority_snapshot INTEGER NOT NULL DEFAULT 100 CHECK (allocation_priority_snapshot >= 0),
    amount_due NUMERIC(12,2) NOT NULL CHECK (amount_due > 0),
    amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0
        CHECK (amount_paid >= 0),
    balance NUMERIC(12,2) NOT NULL CHECK (balance >= 0),
    status TEXT NOT NULL
        CHECK (status IN ('UNPAID', 'PARTIALLY_PAID', 'PAID')),
    due_date DATE,
    source TEXT NOT NULL
        CHECK (source IN ('ADMISSION', 'NEW_SESSION')),
    generated_at TIMESTAMPTZ NOT NULL,

    -- Prevent duplicate obligations for the same student,
    -- fee item and session.
    CONSTRAINT uq_student_fee_session
        UNIQUE (student_id, fee_catalog_item_id, session),

    CONSTRAINT uq_obligation_id_fee_catalog
        UNIQUE (id, fee_catalog_item_id),

    -- Keep the financial figures internally consistent.
    CONSTRAINT ck_obligation_amounts
        CHECK (amount_paid <= amount_due AND balance = amount_due - amount_paid),

    CONSTRAINT ck_obligation_status
        CHECK (
            (status = 'UNPAID' AND amount_paid = 0 AND balance = amount_due)
            OR
            (status = 'PARTIALLY_PAID' AND amount_paid > 0 AND balance > 0)
            OR
            (status = 'PAID' AND balance = 0 AND amount_paid = amount_due)
        )
);

-- A one-time fee can only be generated once per student
-- and fee catalog item, regardless of academic session.
CREATE UNIQUE INDEX uq_student_one_time_fee
    ON student_fee_obligations (student_id, fee_catalog_item_id)
    WHERE fee_type_snapshot = 'ONE_TIME';

CREATE INDEX idx_obligations_student
    ON student_fee_obligations (student_id);


CREATE INDEX idx_obligations_student_session
    ON student_fee_obligations (student_id, session);

CREATE INDEX idx_obligations_balance
    ON student_fee_obligations (student_id, balance)
    WHERE balance > 0;

CREATE TABLE student_payments (
    id TEXT PRIMARY KEY,
    receipt_number TEXT NOT NULL UNIQUE,
    idempotency_key TEXT NOT NULL UNIQUE,
    student_id TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    method TEXT NOT NULL,
    recorded_by TEXT NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    notes TEXT,
    session TEXT
);

CREATE INDEX idx_student_payments_student
    ON student_payments (student_id, recorded_at DESC);

CREATE TABLE student_payment_allocations (
    id TEXT PRIMARY KEY,
    payment_id TEXT NOT NULL
        REFERENCES student_payments(id) ON DELETE RESTRICT,
    obligation_id TEXT NOT NULL
        REFERENCES student_fee_obligations(id) ON DELETE RESTRICT,
    fee_catalog_item_id TEXT NOT NULL
        REFERENCES fee_catalog(id) ON DELETE RESTRICT,
    fee_name_snapshot TEXT NOT NULL,
    fee_category_snapshot TEXT NOT NULL
        CHECK (fee_category_snapshot IN ('COMPULSORY', 'OPTIONAL')),
    amount_allocated NUMERIC(12,2) NOT NULL
        CHECK (amount_allocated > 0),
    CONSTRAINT fk_payment_allocation_obligation_fee
        FOREIGN KEY (obligation_id, fee_catalog_item_id)
        REFERENCES student_fee_obligations (id, fee_catalog_item_id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_payment_obligation_allocation
        UNIQUE (payment_id, obligation_id)

);

CREATE INDEX idx_payment_allocations_payment
    ON student_payment_allocations (payment_id);

CREATE INDEX idx_payment_allocations_obligation
    ON student_payment_allocations (obligation_id);

COMMIT;