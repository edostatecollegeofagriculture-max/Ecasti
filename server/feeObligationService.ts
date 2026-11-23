import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { neonPool } from './neon';
import { writeFeeAuditLog } from './feeAuditService';

export type ObligationGenerationSource = 'ADMISSION' | 'NEW_SESSION';

export interface GenerateStudentObligationsInput {
  studentId: string;
  programmeId: string;
  session: string;
  level: string;
  source: ObligationGenerationSource;
}

export interface FeeObligationActor {
  userId: string;
  ipAddress?: string;
}

export interface GenerateStudentObligationsResult {
  studentId: string;
  scheduleId: string;
  session: string;
  source: ObligationGenerationSource;
  generatedCount: number;
  skippedCount: number;
  totalAmount: number;
  obligationIds: string[];
}

async function withTransaction<T>(
  operation: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await neonPool.connect();
  let transactionOpen = false;
  let destroyClient = false;

  try {
    await client.query('BEGIN');
    transactionOpen = true;

    const result = await operation(client);

    await client.query('COMMIT');
    transactionOpen = false;

    return result;
  } catch (error) {
    if (transactionOpen) {
      try {
        await client.query('ROLLBACK');
      } catch {
        destroyClient = true;
      }
    }
    throw error;
  } finally {
    client.release(destroyClient);
  }
}

function requiredText(value: string, field: string): string {
  const result = value?.trim();

  if (!result) {
    throw new Error(`${field} is required.`);
  }

  if (result.length > 150) {
    throw new Error(`${field} is too long.`);
  }

  return result;
}

function validateActor(actor: FeeObligationActor): string {
  return requiredText(actor?.userId, 'Actor user ID');
}

function validateSource(
  source: ObligationGenerationSource
): ObligationGenerationSource {
  if (source !== 'ADMISSION' && source !== 'NEW_SESSION') {
    throw new Error('Invalid obligation generation source.');
  }

  return source;
}

/**
 * Generates obligations using a caller-owned PostgreSQL transaction.
 *
 * This function NEVER begins, commits or rolls back a transaction.
 * The caller owns the transaction and must roll it back if this
 * function or any subsequent operation fails.
 *
 * Use this when fee generation must be atomic with another operation,
 * such as an academic progression rollover.
 */
export async function generateStudentFeeObligationsWithClient(
  client: PoolClient,
  input: GenerateStudentObligationsInput,
  actor: FeeObligationActor
): Promise<GenerateStudentObligationsResult> {
  if (!client) {
    throw new Error('An existing PostgreSQL transaction client is required.');
  }

  const actorUserId = validateActor(actor);

  const studentId = requiredText(input.studentId, 'Student ID');
  const programmeId = requiredText(input.programmeId, 'Programme ID');
  const session = requiredText(input.session, 'Academic session');
  const level = requiredText(input.level, 'Student level');
  const source = validateSource(input.source);

  // Lock the published schedule against concurrent changes.
  const scheduleResult = await client.query(
    `SELECT id
     FROM program_fee_schedule
     WHERE programme_id = $1
       AND session = $2
       AND level = $3
       AND status = 'PUBLISHED'
       AND is_active = TRUE
     FOR SHARE`,
    [programmeId, session, level]
  );

  const schedule = scheduleResult.rows[0] as
    | { id: string }
    | undefined;

  if (!schedule) {
    throw new Error(
      'No active published fee schedule exists for this programme, session and level.'
    );
  }

  // Admission includes one-time and per-session fees.
  // Returning students receive per-session fees only.
  const feeTypeCondition =
    source === 'ADMISSION'
      ? ''
      : "AND item.fee_type_snapshot = 'PER_SESSION'";

  const candidateResult = await client.query(
    `SELECT COUNT(*)::integer AS candidate_count
     FROM program_fee_schedule_items AS item
     WHERE item.schedule_id = $1
     ${feeTypeCondition}`,
    [schedule.id]
  );

  const candidateCount = Number(
    candidateResult.rows[0]?.candidate_count ?? 0
  );

  if (candidateCount < 1) {
    throw new Error(
      source === 'ADMISSION'
        ? 'The published schedule has no fee items.'
        : 'The published schedule has no per-session fee items for this session.'
    );
  }

  // Duplicate protection:
  // - student + fee item + session unique constraint
  // - student + one-time fee item partial unique index
  //
  // Existing obligations and payment balances are never updated.
  const insertResult = await client.query(
    `INSERT INTO student_fee_obligations (
       id,
       student_id,
       programme_id,
       session,
       level,
       fee_catalog_item_id,
       fee_name_snapshot,
       fee_category_snapshot,
       fee_type_snapshot,
       allocation_priority_snapshot,
       amount_due,
       amount_paid,
       balance,
       status,
       due_date,
       source,
       generated_at
     )
     SELECT
       gen_random_uuid()::text,
       $2,
       $3,
       $4,
       $5,
       item.fee_catalog_item_id,
       item.fee_name_snapshot,
       item.fee_category_snapshot,
       item.fee_type_snapshot,
       item.allocation_priority,
       COALESCE(
         item.amount_override,
         item.base_amount_snapshot
       ),
       0,
       COALESCE(
         item.amount_override,
         item.base_amount_snapshot
       ),
       'UNPAID',
       NULL,
       $6,
       NOW()
     FROM program_fee_schedule_items AS item
     WHERE item.schedule_id = $1
     ${feeTypeCondition}
     ON CONFLICT DO NOTHING
     RETURNING id, amount_due`,
    [
      schedule.id,
      studentId,
      programmeId,
      session,
      level,
      source,
    ]
  );

  const insertedRows = insertResult.rows as Array<{
    id: string;
    amount_due: string | number;
  }>;

  const obligationIds = insertedRows.map((row) => row.id);

  const totalAmount = Number(
    insertedRows
      .reduce(
        (sum, row) => sum + Number(row.amount_due),
        0
      )
      .toFixed(2)
  );

  const generatedCount = insertedRows.length;
  const skippedCount = candidateCount - generatedCount;

  // Only record a generation audit event when new obligations
  // were actually created.
  if (generatedCount > 0) {
    await writeFeeAuditLog(client, {
      actorUserId,
      action: 'STUDENT_FEE_OBLIGATIONS_GENERATED',
      resourceType: 'STUDENT',
      resourceId: studentId,
      ipAddress: actor.ipAddress,
      details: {
        scheduleId: schedule.id,
        programmeId,
        session,
        level,
        source,
        generatedCount,
        skippedCount,
        totalAmount,
      },
    });
  }

  return {
    studentId,
    scheduleId: schedule.id,
    session,
    source,
    generatedCount,
    skippedCount,
    totalAmount,
    obligationIds,
  };
}

/**
 * Existing standalone API.
 *
 * Preserves the original behaviour for admission and other callers:
 * this function owns its transaction and commits or rolls it back.
 */
export async function generateStudentFeeObligations(
  input: GenerateStudentObligationsInput,
  actor: FeeObligationActor
): Promise<GenerateStudentObligationsResult> {
  return withTransaction((client) =>
    generateStudentFeeObligationsWithClient(client, input, actor)
  );
}
