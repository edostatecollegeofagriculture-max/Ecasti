import { randomUUID } from 'crypto';
import { neonPool } from './neon';
import { writeFeeAuditLog } from './feeAuditService';

export interface RecordFeePaymentInput {
  studentId: string;
  amount: number;
  method: string;
  recordedBy: string;
  idempotencyKey: string;
  notes?: string;
  session?: string;
  ipAddress?: string;
  allocationCategory?: 'COMPULSORY' | 'OPTIONAL';
  feeCatalogItemId?: string;
}

export interface FeePaymentAllocationResult {
  obligationId: string;
  feeCatalogItemId: string;
  feeName: string;
  category: 'COMPULSORY' | 'OPTIONAL';
  amountAllocated: number;
}

export interface FeePaymentResult {
  id: string;
  receiptNumber: string;
  studentId: string;
  amount: number;
  method: string;
  recordedBy: string;
  recordedAt: string;
  allocations: FeePaymentAllocationResult[];
}

function money(value: unknown): number {
  const result = Number(value);
  if (!Number.isFinite(result)) {
    throw new Error('Invalid monetary value returned by the database.');
  }
  return Math.round(result * 100) / 100;
}

function makeReceiptNumber(): string {
  const date = new Date();
  const day = date.toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();
  return `EDO-FEE-${day}-${suffix}`;
}

/**
 * Records a manual payment and allocates it atomically.
 *
 * Allocation order:
 * 1. COMPULSORY before OPTIONAL.
 * 2. Lower allocation priority first.
 * 3. Oldest due date, then oldest generated obligation.
 *
 * This service does not claim to verify online gateway payments.
 * It must only be called by an authenticated, authorized staff route.
 */
export async function recordFeePayment(
  input: RecordFeePaymentInput
): Promise<FeePaymentResult> {
  const studentId = String(input.studentId || '').trim();
  const recordedBy = String(input.recordedBy || '').trim();
  const method = String(input.method || '').trim();
  const idempotencyKey = String(input.idempotencyKey || '').trim();
  const rawAmount = Number(input.amount);

  if (
    !Number.isFinite(rawAmount) ||
    rawAmount <= 0 ||
    Math.abs(rawAmount * 100 - Math.round(rawAmount * 100)) > 0.0000001
  ) {
    throw new Error('Payment amount must be positive and have no more than two decimal places.');
  }

  const amount = money(rawAmount);

  if (!studentId || !recordedBy || !method || !idempotencyKey) {
    throw new Error('Student, payment method, recording user and idempotency key are required.');
  }

  if (amount <= 0) {
    throw new Error('Payment amount must be greater than zero.');
  }

  if (idempotencyKey.length > 200) {
    throw new Error('Idempotency key is too long.');
  }

  const allocationCategory = input.allocationCategory ?? null;
  const feeCatalogItemId =
    String(input.feeCatalogItemId || '').trim() || null;

  if (
    allocationCategory !== null &&
    allocationCategory !== 'COMPULSORY' &&
    allocationCategory !== 'OPTIONAL'
  ) {
    throw new Error('Payment category must be COMPULSORY or OPTIONAL.');
  }

  if (feeCatalogItemId && feeCatalogItemId.length > 256) {
    throw new Error('Fee item ID is too long.');
  }

  if (allocationCategory && feeCatalogItemId) {
    throw new Error('Select either a payment category or an individual fee item, not both.');
  }
  const client = await neonPool.connect();
  let transactionOpen = false;
  let destroyClient = false;

  try {
    await client.query('BEGIN');
    transactionOpen = true;

    // A repeated request returns the original receipt instead of
    // recording the same payment twice.
    const existing = await client.query(
      `SELECT id, receipt_number, student_id, amount, method,
              recorded_by, recorded_at, notes, session, allocation_category, fee_catalog_item_id
       FROM student_payments
       WHERE idempotency_key = $1`,
      [idempotencyKey]
    );

    if (existing.rows.length > 0) {
      const row = existing.rows[0];

      const sameRequest =
        row.student_id === studentId &&
        money(row.amount) === amount &&
        row.method === method &&
        row.recorded_by === recordedBy &&
        (row.notes || null) === (input.notes?.trim() || null) &&
        (row.session || null) === (input.session?.trim() || null) &&
        (row.allocation_category || null) === allocationCategory &&
        (row.fee_catalog_item_id || null) === feeCatalogItemId;

      if (!sameRequest) {
        throw new Error(
          'This idempotency key has already been used for a different payment request.'
        );
      }

      const allocations = await client.query(
        `SELECT obligation_id, fee_catalog_item_id, fee_name_snapshot,
                fee_category_snapshot, amount_allocated
         FROM student_payment_allocations
         WHERE payment_id = $1
         ORDER BY id`,
        [row.id]
      );

      await client.query('COMMIT');
      transactionOpen = false;

      return {
        id: row.id,
        receiptNumber: row.receipt_number,
        studentId: row.student_id,
        amount: money(row.amount),
        method: row.method,
        recordedBy: row.recorded_by,
        recordedAt: new Date(row.recorded_at).toISOString(),
        allocations: allocations.rows.map((item) => ({
          obligationId: item.obligation_id,
          feeCatalogItemId: item.fee_catalog_item_id,
          feeName: item.fee_name_snapshot,
          category: item.fee_category_snapshot,
          amountAllocated: money(item.amount_allocated),
        })),
      };
    }

    // Lock outstanding obligations so concurrent payments cannot
    // allocate against the same balance.
    const obligations = await client.query(
      `SELECT id, fee_catalog_item_id, fee_name_snapshot,
              fee_category_snapshot, allocation_priority_snapshot,
              amount_due, amount_paid, balance, due_date, generated_at
       FROM student_fee_obligations
       WHERE student_id = $1
         AND balance > 0
         AND ($2::text IS NULL OR fee_category_snapshot = $2)
         AND ($3::text IS NULL OR fee_catalog_item_id = $3)
       ORDER BY
         CASE fee_category_snapshot
           WHEN 'COMPULSORY' THEN 0
           ELSE 1
         END ASC,
         allocation_priority_snapshot ASC,
         due_date ASC NULLS LAST,
         generated_at ASC,
         id ASC
       FOR UPDATE`,
      [studentId, allocationCategory, feeCatalogItemId]
    );

    const totalOutstanding = obligations.rows.reduce(
      (sum, row) => sum + money(row.balance),
      0
    );

    if (amount > totalOutstanding) {
      throw new Error(
        `Payment exceeds the student's outstanding balance of ${totalOutstanding.toFixed(2)}.`
      );
    }

    if (totalOutstanding <= 0) {
      throw new Error('This student has no outstanding fee obligations.');
    }

    const paymentId = randomUUID();
    const receiptNumber = makeReceiptNumber();
    const recordedAt = new Date();

    const paymentInsert = await client.query(
      `INSERT INTO student_payments
         (id, receipt_number, idempotency_key, student_id,
          amount, method, recorded_by, recorded_at, notes, session, allocation_category, fee_catalog_item_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id`,
      [
        paymentId,
        receiptNumber,
        idempotencyKey,
        studentId,
        amount,
        method,
        recordedBy,
        recordedAt.toISOString(),
        input.notes?.trim() || null,
        input.session?.trim() || null,
        allocationCategory,
        feeCatalogItemId,
      ]
    );

    if (paymentInsert.rowCount !== 1) {
      throw new Error('Payment record could not be created.');
    }

    let remaining = amount;
    const allocations: FeePaymentAllocationResult[] = [];

    for (const obligation of obligations.rows) {
      if (remaining <= 0) break;

      const balance = money(obligation.balance);
      const allocated = Math.round(Math.min(balance, remaining) * 100) / 100;

      if (allocated <= 0) continue;

      const newPaid = Math.round(
        (money(obligation.amount_paid) + allocated) * 100
      ) / 100;
      const newBalance = Math.round((balance - allocated) * 100) / 100;

      const status =
        newBalance === 0
          ? 'PAID'
          : newPaid > 0
            ? 'PARTIALLY_PAID'
            : 'UNPAID';

      await client.query(
        `UPDATE student_fee_obligations
         SET amount_paid = $1,
             balance = $2,
             status = $3
         WHERE id = $4`,
        [newPaid, newBalance, status, obligation.id]
      );

      await client.query(
        `INSERT INTO student_payment_allocations
           (id, payment_id, obligation_id, fee_catalog_item_id,
            fee_name_snapshot, fee_category_snapshot, amount_allocated)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          randomUUID(),
          paymentId,
          obligation.id,
          obligation.fee_catalog_item_id,
          obligation.fee_name_snapshot,
          obligation.fee_category_snapshot,
          allocated,
        ]
      );

      allocations.push({
        obligationId: obligation.id,
        feeCatalogItemId: obligation.fee_catalog_item_id,
        feeName: obligation.fee_name_snapshot,
        category: obligation.fee_category_snapshot,
        amountAllocated: allocated,
      });

      remaining = Math.round((remaining - allocated) * 100) / 100;
    }

    if (remaining !== 0) {
      throw new Error('Payment allocation did not balance. Transaction cancelled.');
    }

    await writeFeeAuditLog(client, {
      actorUserId: recordedBy,
      action: 'PAYMENT_RECORDED',
      resourceType: 'STUDENT_PAYMENT',
      resourceId: paymentId,
      ipAddress: input.ipAddress,
      details: {
        receiptNumber,
        amount,
        method,
        allocationCategory,
        feeCatalogItemId,
        allocationCount: allocations.length,
        allocations: allocations.map((item) => ({
          obligationId: item.obligationId,
          feeCatalogItemId: item.feeCatalogItemId,
          amountAllocated: item.amountAllocated,
          category: item.category,
        })),
      },
    });

    await client.query('COMMIT');
    transactionOpen = false;

    return {
      id: paymentId,
      receiptNumber,
      studentId,
      amount,
      method,
      recordedBy,
      recordedAt: recordedAt.toISOString(),
      allocations,
    };
  } catch (error) {
    if (transactionOpen) {
      try {
        await client.query('ROLLBACK');
      } catch {
        destroyClient = true;
      }
    }

    // A concurrent duplicate may win the unique idempotency-key race.
    // Do not silently create another payment.
    const pgError = error as { code?: string };
    if (pgError.code === '23505') {
      throw new Error(
        'This payment request may already have been processed. Check its idempotency key before retrying.'
      );
    }

    throw error;
  } finally {
    client.release(destroyClient);
  }
}








