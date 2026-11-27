BEGIN;

ALTER TABLE student_payments
    ADD COLUMN allocation_category TEXT,
    ADD COLUMN fee_catalog_item_id TEXT
        REFERENCES fee_catalog(id) ON DELETE RESTRICT;

ALTER TABLE student_payments
    ADD CONSTRAINT chk_payment_allocation_category
        CHECK (
            allocation_category IS NULL
            OR allocation_category IN ('COMPULSORY', 'OPTIONAL')
        ),
    ADD CONSTRAINT chk_payment_allocation_scope_exclusive
        CHECK (
            NOT (
                allocation_category IS NOT NULL
                AND fee_catalog_item_id IS NOT NULL
            )
        );

COMMIT;
