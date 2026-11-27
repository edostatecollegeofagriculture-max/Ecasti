BEGIN;

CREATE TABLE fee_audit_logs (
    id TEXT PRIMARY KEY,
    actor_user_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK (length(trim(action)) > 0),
    resource_type TEXT NOT NULL CHECK (length(trim(resource_type)) > 0),
    resource_id TEXT,
    details JSONB NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(details) = 'object'),
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fee_audit_logs_created_at
    ON fee_audit_logs (created_at DESC);

CREATE INDEX idx_fee_audit_logs_actor
    ON fee_audit_logs (actor_user_id, created_at DESC);

CREATE INDEX idx_fee_audit_logs_resource
    ON fee_audit_logs (resource_type, resource_id, created_at DESC);

COMMENT ON TABLE fee_audit_logs IS
    'Append-only audit history for EDOCASTI fee management.';

COMMENT ON COLUMN fee_audit_logs.details IS
    'Structured event context. Avoid passwords, secrets, and unnecessary sensitive personal data.';

-- Prevent ordinary application operations from modifying or deleting history.
CREATE FUNCTION prevent_fee_audit_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
    RAISE EXCEPTION 'Fee audit records are immutable and cannot be changed or deleted.';
END;
$function$;

CREATE TRIGGER trg_fee_audit_logs_immutable
BEFORE UPDATE OR DELETE ON fee_audit_logs
FOR EACH ROW
EXECUTE FUNCTION prevent_fee_audit_log_mutation();

CREATE TRIGGER trg_fee_audit_logs_no_truncate
BEFORE TRUNCATE ON fee_audit_logs
FOR EACH STATEMENT
EXECUTE FUNCTION prevent_fee_audit_log_mutation();

COMMIT;

