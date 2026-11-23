import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';

export interface FeeAuditInput {
  actorUserId: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  details?: Record<string, unknown>;
  ipAddress?: string | null;
}

/**
 * Writes a fee audit entry using the caller's existing PostgreSQL
 * transaction. The caller is responsible for BEGIN, COMMIT and ROLLBACK.
 *
 * Always await this function. If it fails, the caller should roll back
 * the transaction containing the fee operation.
 */
export async function writeFeeAuditLog(
  client: PoolClient,
  input: FeeAuditInput
): Promise<void> {
  const actorUserId = input.actorUserId?.trim();
  const action = input.action?.trim();
  const resourceType = input.resourceType?.trim();

  if (!actorUserId || !action || !resourceType) {
    throw new Error(
      'Fee audit requires an actor user ID, action and resource type.'
    );
  }

  if (action.length > 100 || resourceType.length > 100) {
    throw new Error('Fee audit action or resource type is too long.');
  }

  const resourceId = input.resourceId?.trim() || null;
  const ipAddress = input.ipAddress?.trim() || null;
  const details = input.details ?? {};

  if (
    details === null ||
    typeof details !== 'object' ||
    Array.isArray(details)
  ) {
    throw new Error('Fee audit details must be a JSON object.');
  }

  const detailsJson = JSON.stringify(details);

  if (detailsJson === undefined) {
    throw new Error('Fee audit details could not be serialized.');
  }

  await client.query(
    `INSERT INTO fee_audit_logs (
       id,
       actor_user_id,
       action,
       resource_type,
       resource_id,
       details,
       ip_address
     )
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
    [
      randomUUID(),
      actorUserId,
      action,
      resourceType,
      resourceId,
      detailsJson,
      ipAddress,
    ]
  );
}
