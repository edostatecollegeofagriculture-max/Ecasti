BEGIN;

-- Preserve the catalog amount when a fee item is added to a schedule.
ALTER TABLE program_fee_schedule_items
    ADD COLUMN base_amount_snapshot NUMERIC(12,2);

-- Backfill existing schedule items from their linked catalog entries.
UPDATE program_fee_schedule_items AS schedule_item
SET base_amount_snapshot = catalog_item.amount
FROM fee_catalog AS catalog_item
WHERE catalog_item.id = schedule_item.fee_catalog_item_id
  AND schedule_item.base_amount_snapshot IS NULL;

-- Refuse to continue if any schedule item could not be backfilled.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM program_fee_schedule_items
        WHERE base_amount_snapshot IS NULL
    ) THEN
        RAISE EXCEPTION
            'Cannot complete migration: one or more schedule items have no base amount snapshot.';
    END IF;
END;
$$;

-- Require a valid, positive snapshot amount.
ALTER TABLE program_fee_schedule_items
    ALTER COLUMN base_amount_snapshot SET NOT NULL;

ALTER TABLE program_fee_schedule_items
    ADD CONSTRAINT chk_schedule_item_base_amount_snapshot_positive
    CHECK (base_amount_snapshot > 0);

COMMENT ON COLUMN program_fee_schedule_items.base_amount_snapshot IS
    'Catalog amount captured when the fee item is added to the schedule. Later catalog edits must not change this snapshot.';

COMMIT;
