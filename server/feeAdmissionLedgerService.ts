import type { PoolClient } from 'pg';
import { neonPool } from './neon';
import { writeFeeAuditLog } from './feeAuditService';
import {
  generateStudentFeeObligations,
  type GenerateStudentObligationsResult,
} from './feeObligationService';

export interface AdmissionFeeActivationInput {
  applicationId: string;
  studentId: string;
  programmeId: string;
  session: string;
  level: string;
  activatedBy: string;
  ipAddress?: string;
}

export interface AdmissionFeeActivationResult {
  applicationId: string;
  studentId: string;
  status: 'COMPLETED';
  alreadyCompleted: boolean;
  obligations: GenerateStudentObligationsResult | null;
}

export interface RetryableAdmissionActivation {
  applicationId: string;
  studentId: string;
  programmeId: string;
  academicSession: string;
  level: string;
  status: 'PENDING' | 'FAILED';
  attempts: number;
  lastError: string | null;
  activatedAt: string;
}

function requiredText(value: string, label: string): string {
  const normalized = value?.trim();

  if (!normalized) {
    throw new Error(`${label} is required.`);
  }

  if (normalized.length > 200) {
    throw new Error(`${label} is too long.`);
  }

  return normalized;
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
        // A connection with uncertain transaction state must not be reused.
        destroyClient = true;
      }
    }

    throw error;
  } finally {
    client.release(destroyClient);
  }
}

/**
 * Activates itemized admission obligations.
 *
 * The application-specific advisory lock prevents concurrent activation
 * requests. The ledger and obligation generator use separate transactions,
 * so a failed completion can be retried safely.
 */
export async function activateAdmissionFeeObligations(
  input: AdmissionFeeActivationInput
): Promise<AdmissionFeeActivationResult> {
  const applicationId = requiredText(input.applicationId, 'Application ID');
  const studentId = requiredText(input.studentId, 'Student ID');
  const programmeId = requiredText(input.programmeId, 'Programme ID');
  const session = requiredText(input.session, 'Academic session');
  const level = requiredText(input.level, 'Student level');
  const activatedBy = requiredText(input.activatedBy, 'Activating user ID');
  const ipAddress = input.ipAddress?.trim() || null;

  const lockClient = await neonPool.connect();
  let lockAcquired = false;

  try {
    // Keep this session-level lock while the obligation generator runs.
    await lockClient.query(
      'SELECT pg_advisory_lock(hashtextextended($1, 0))',
      [applicationId]
    );
    lockAcquired = true;

    const existing = await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO admission_fee_activation_ledger (
           application_id,
           student_id,
           programme_id,
           academic_session,
           level,
           status,
           activated_by
         )
         VALUES ($1, $2, $3, $4, $5, 'PENDING', $6)
         ON CONFLICT (application_id) DO NOTHING`,
        [
          applicationId,
          studentId,
          programmeId,
          session,
          level,
          activatedBy,
        ]
      );

      const result = await client.query(
        `SELECT
           application_id,
           student_id,
           programme_id,
           academic_session,
           level,
           status
         FROM admission_fee_activation_ledger
         WHERE application_id = $1
         FOR UPDATE`,
        [applicationId]
      );

      const row = result.rows[0];

      if (!row) {
        throw new Error('Admission activation ledger record could not be loaded.');
      }

      // An application must never be reused for a different student,
      // programme, session, or level.
      if (
        row.student_id !== studentId ||
        row.programme_id !== programmeId ||
        row.academic_session !== session ||
        row.level !== level
      ) {
        throw new Error(
          'Admission activation details do not match the existing ledger record.'
        );
      }

      if (row.status === 'COMPLETED') {
        return { alreadyCompleted: true as const };
      }

      await client.query(
        `UPDATE admission_fee_activation_ledger
         SET status = 'PENDING',
             attempts = attempts + 1,
             last_error = NULL,
             updated_at = NOW()
         WHERE application_id = $1`,
        [applicationId]
      );

      await writeFeeAuditLog(client, {
        actorUserId: activatedBy,
        action: 'ADMISSION_FEE_ACTIVATION_STARTED',
        resourceType: 'ADMISSION_FEE_ACTIVATION',
        resourceId: applicationId,
        ipAddress,
        details: {
          studentId,
          programmeId,
          session,
          level,
        },
      });

      return { alreadyCompleted: false as const };
    });

    if (existing.alreadyCompleted) {
      return {
        applicationId,
        studentId,
        status: 'COMPLETED',
        alreadyCompleted: true,
        obligations: null,
      };
    }

    let obligations: GenerateStudentObligationsResult;

    try {
      obligations = await generateStudentFeeObligations(
        {
          studentId,
          programmeId,
          session,
          level,
          source: 'ADMISSION',
        },
        {
          userId: activatedBy,
          ipAddress: ipAddress || undefined,
        }
      );
    } catch {
      // Never store raw database errors or connection details in the ledger.
      await withTransaction(async (client) => {
        await client.query(
          `UPDATE admission_fee_activation_ledger
           SET status = 'FAILED',
               last_error = $2,
               completed_at = NULL,
               updated_at = NOW()
           WHERE application_id = $1`,
          [applicationId, 'FEE_OBLIGATION_GENERATION_FAILED']
        );

        await writeFeeAuditLog(client, {
          actorUserId: activatedBy,
          action: 'ADMISSION_FEE_ACTIVATION_FAILED',
          resourceType: 'ADMISSION_FEE_ACTIVATION',
          resourceId: applicationId,
          ipAddress,
          details: {
            studentId,
            errorCode: 'FEE_OBLIGATION_GENERATION_FAILED',
          },
        });
      });

      throw new Error(
        'Fee obligation generation failed. The admission activation is recorded for retry.'
      );
    }

    await withTransaction(async (client) => {
      const update = await client.query(
        `UPDATE admission_fee_activation_ledger
         SET status = 'COMPLETED',
             last_error = NULL,
             completed_at = NOW(),
             updated_at = NOW()
         WHERE application_id = $1
           AND status = 'PENDING'`,
        [applicationId]
      );

      if (update.rowCount !== 1) {
        throw new Error(
          'Admission activation could not be marked as completed.'
        );
      }

      await writeFeeAuditLog(client, {
        actorUserId: activatedBy,
        action: 'ADMISSION_FEE_ACTIVATION_COMPLETED',
        resourceType: 'ADMISSION_FEE_ACTIVATION',
        resourceId: applicationId,
        ipAddress,
        details: {
          studentId,
          programmeId,
          session,
          level,
          generatedCount: obligations.generatedCount,
          skippedCount: obligations.skippedCount,
          totalAmount: obligations.totalAmount,
        },
      });
    });

    return {
      applicationId,
      studentId,
      status: 'COMPLETED',
      alreadyCompleted: false,
      obligations,
    };
  } finally {
    let destroyLockConnection = false;

    if (lockAcquired) {
      try {
        const unlockResult = await lockClient.query(
          'SELECT pg_advisory_unlock(hashtextextended($1, 0)) AS unlocked',
          [applicationId]
        );

        if (unlockResult.rows[0]?.unlocked !== true) {
          destroyLockConnection = true;
        }
      } catch {
        destroyLockConnection = true;
      }
    }

    // Destroy the pooled connection if unlocking failed.
    lockClient.release(destroyLockConnection);
  }
}

/**
 * Lists pending and failed activations for a future protected admin retry
 * workflow. This function does not modify any ledger records.
 */
export async function listRetryableAdmissionFeeActivations(
  limit = 50
): Promise<RetryableAdmissionActivation[]> {
  const safeLimit = Number.isInteger(limit)
    ? Math.min(Math.max(limit, 1), 200)
    : 50;

  const result = await neonPool.query(
    `SELECT
       application_id AS "applicationId",
       student_id AS "studentId",
       programme_id AS "programmeId",
       academic_session AS "academicSession",
       level,
       status,
       attempts,
       last_error AS "lastError",
       activated_at AS "activatedAt"
     FROM admission_fee_activation_ledger
     WHERE status IN ('PENDING', 'FAILED')
     ORDER BY created_at ASC
     LIMIT $1`,
    [safeLimit]
  );

  return result.rows.map((row) => ({
    applicationId: String(row.applicationId),
    studentId: String(row.studentId),
    programmeId: String(row.programmeId),
    academicSession: String(row.academicSession),
    level: String(row.level),
    status: row.status as 'PENDING' | 'FAILED',
    attempts: Number(row.attempts),
    lastError: row.lastError ? String(row.lastError) : null,
    activatedAt: new Date(row.activatedAt).toISOString(),
  }));
}

