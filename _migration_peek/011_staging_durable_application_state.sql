-- EDOCASTI staging durable state envelope.
-- The entire DatabaseState is stored as JSONB to preserve every existing
-- collection, optional property, identifier, and nested record during the
-- first safe cutover. Relational decomposition can follow incrementally.
-- Runtime creation is guarded by the dedicated Render staging service ID
-- and verifies current_database() = 'ecasti_staging_db'.

CREATE TABLE IF NOT EXISTS ecasti_application_state (
  singleton_id SMALLINT PRIMARY KEY CHECK (singleton_id = 1),
  state JSONB NOT NULL,
  revision BIGINT NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
