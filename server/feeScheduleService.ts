import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { neonPool } from './neon';
import { writeFeeAuditLog } from './feeAuditService';

export type ScheduleStatus = 'DRAFT' | 'PUBLISHED';

export interface FeeScheduleActor {
  userId: string;
  ipAddress?: string;
}

export interface CreateFeeScheduleInput {
  programmeId: string;
  session: string;
  level: string;
}

export interface AddScheduleItemInput {
  scheduleId: string;
  feeCatalogItemId: string;
  amountOverride?: number | null;
  allocationPriority?: number;
}

export interface UpdateScheduleItemInput {
  scheduleId: string;
  itemId: string;
  amountOverride?: number | null;
  allocationPriority?: number;
}

export interface CloneFeeScheduleInput {
  sourceScheduleId: string;
  programmeId?: string;
  session?: string;
  level?: string;
}

export interface FeeScheduleSummary {
  id: string;
  programmeId: string;
  session: string;
  level: string;
  status: ScheduleStatus;
  isActive: boolean;
  createdAt: string;
  publishedAt: string | null;
  createdBy: string;
  itemCount: number;
  totalAmount: number;
}

export interface FeeScheduleItem {
  id: string;
  scheduleId: string;
  feeCatalogItemId: string;
  baseAmountSnapshot: number;
  amountOverride: number | null;
  effectiveAmount: number;
  feeNameSnapshot: string;
  feeCategorySnapshot: 'COMPULSORY' | 'OPTIONAL';
  feeTypeSnapshot: 'ONE_TIME' | 'PER_SESSION';
  allocationPriority: number;
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

function validateActor(actor: FeeScheduleActor): string {
  return requiredText(actor?.userId, 'Actor user ID');
}

function validateAmount(
  value: number | null | undefined,
  field: string
): number | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value <= 0 ||
    Math.round(value * 100) !== value * 100
  ) {
    throw new Error(`${field} must be a positive amount with no more than two decimal places.`);
  }

  return value;
}

function validatePriority(value: number | undefined): number {
  const priority = value ?? 100;

  if (
    !Number.isInteger(priority) ||
    priority < 0 ||
    priority > 2147483647
  ) {
    throw new Error('Allocation priority must be a non-negative whole number.');
  }

  return priority;
}

function mapScheduleItem(row: Record<string, unknown>): FeeScheduleItem {
  const baseAmount = Number(row.base_amount_snapshot);
  const override = row.amount_override === null
    ? null
    : Number(row.amount_override);

  return {
    id: String(row.id),
    scheduleId: String(row.schedule_id),
    feeCatalogItemId: String(row.fee_catalog_item_id),
    baseAmountSnapshot: baseAmount,
    amountOverride: override,
    effectiveAmount: override ?? baseAmount,
    feeNameSnapshot: String(row.fee_name_snapshot),
    feeCategorySnapshot: row.fee_category_snapshot as FeeScheduleItem['feeCategorySnapshot'],
    feeTypeSnapshot: row.fee_type_snapshot as FeeScheduleItem['feeTypeSnapshot'],
    allocationPriority: Number(row.allocation_priority),
  };
}

function mapScheduleSummary(row: Record<string, unknown>): FeeScheduleSummary {
  return {
    id: String(row.id),
    programmeId: String(row.programme_id),
    session: String(row.session),
    level: String(row.level),
    status: row.status as ScheduleStatus,
    isActive: Boolean(row.is_active),
    createdAt: new Date(row.created_at as string | number | Date).toISOString(),
    publishedAt: row.published_at
      ? new Date(row.published_at as string | number | Date).toISOString()
      : null,
    createdBy: String(row.created_by),
    itemCount: Number(row.item_count),
    totalAmount: Number(row.total_amount),
  };
}

async function lockDraftSchedule(
  client: PoolClient,
  scheduleId: string
): Promise<Record<string, unknown>> {
  const result = await client.query(
    `SELECT id, status, is_active
     FROM program_fee_schedule
     WHERE id = $1
     FOR UPDATE`,
    [requiredText(scheduleId, 'Schedule ID')]
  );

  const schedule = result.rows[0] as Record<string, unknown> | undefined;

  if (!schedule) {
    throw new Error('Fee schedule was not found.');
  }

  if (schedule.status !== 'DRAFT') {
    throw new Error('Published schedules cannot be edited. Unpublish the schedule first.');
  }

  return schedule;
}

export async function listProgramFeeSchedules(
  includeInactive = false
): Promise<FeeScheduleSummary[]> {
  const result = await neonPool.query(
    `SELECT
       s.id,
       s.programme_id,
       s.session,
       s.level,
       s.status,
       s.is_active,
       s.created_at,
       s.published_at,
       s.created_by,
       COUNT(si.id)::integer AS item_count,
       COALESCE(
         SUM(COALESCE(si.amount_override, si.base_amount_snapshot)),
         0
       )::numeric(12,2) AS total_amount
     FROM program_fee_schedule s
     LEFT JOIN program_fee_schedule_items si
       ON si.schedule_id = s.id
     WHERE ($1::boolean = TRUE OR s.is_active = TRUE)
     GROUP BY s.id
     ORDER BY s.created_at DESC`,
    [includeInactive]
  );

  return result.rows.map((row) =>
    mapScheduleSummary(row as Record<string, unknown>)
  );
}

export async function getProgramFeeSchedule(
  scheduleId: string
): Promise<{
  schedule: FeeScheduleSummary;
  items: FeeScheduleItem[];
}> {
  const id = requiredText(scheduleId, 'Schedule ID');

  const scheduleResult = await neonPool.query(
    `SELECT
       s.id,
       s.programme_id,
       s.session,
       s.level,
       s.status,
       s.is_active,
       s.created_at,
       s.published_at,
       s.created_by,
       COUNT(si.id)::integer AS item_count,
       COALESCE(
         SUM(COALESCE(si.amount_override, si.base_amount_snapshot)),
         0
       )::numeric(12,2) AS total_amount
     FROM program_fee_schedule s
     LEFT JOIN program_fee_schedule_items si
       ON si.schedule_id = s.id
     WHERE s.id = $1
     GROUP BY s.id`,
    [id]
  );

  if (!scheduleResult.rows[0]) {
    throw new Error('Fee schedule was not found.');
  }

  const itemsResult = await neonPool.query(
    `SELECT *
     FROM program_fee_schedule_items
     WHERE schedule_id = $1
     ORDER BY
       CASE fee_category_snapshot
         WHEN 'COMPULSORY' THEN 0
         ELSE 1
       END,
       allocation_priority ASC,
       fee_name_snapshot ASC`,
    [id]
  );

  return {
    schedule: mapScheduleSummary(
      scheduleResult.rows[0] as Record<string, unknown>
    ),
    items: itemsResult.rows.map((row) =>
      mapScheduleItem(row as Record<string, unknown>)
    ),
  };
}

export async function createProgramFeeSchedule(
  input: CreateFeeScheduleInput,
  actor: FeeScheduleActor
): Promise<{ id: string }> {
  const actorUserId = validateActor(actor);
  const programmeId = requiredText(input.programmeId, 'Programme ID');
  const session = requiredText(input.session, 'Academic session');
  const level = requiredText(input.level, 'Level');
  const id = randomUUID();

  return withTransaction(async (client) => {
    try {
      await client.query(
        `INSERT INTO program_fee_schedule (
           id, programme_id, session, level,
           status, is_active, created_at, created_by
         )
         VALUES ($1, $2, $3, $4, 'DRAFT', TRUE, NOW(), $5)`,
        [id, programmeId, session, level, actorUserId]
      );
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new Error(
          'An active schedule already exists for this programme, session and level. Deactivate it before creating another.'
        );
      }
      throw error;
    }

    await writeFeeAuditLog(client, {
      actorUserId,
      action: 'FEE_SCHEDULE_CREATED',
      resourceType: 'PROGRAM_FEE_SCHEDULE',
      resourceId: id,
      ipAddress: actor.ipAddress,
      details: { programmeId, session, level },
    });

    return { id };
  });
}

export async function addFeeScheduleItem(
  input: AddScheduleItemInput,
  actor: FeeScheduleActor
): Promise<{ id: string; effectiveAmount: number }> {
  const actorUserId = validateActor(actor);
  const scheduleId = requiredText(input.scheduleId, 'Schedule ID');
  const catalogItemId = requiredText(
    input.feeCatalogItemId,
    'Fee catalog item ID'
  );
  const amountOverride = validateAmount(
    input.amountOverride,
    'Amount override'
  );
  const allocationPriority = validatePriority(input.allocationPriority);
  const id = randomUUID();

  return withTransaction(async (client) => {
    await lockDraftSchedule(client, scheduleId);

    const catalogResult = await client.query(
      `SELECT id, name, amount, fee_type, category
       FROM fee_catalog
       WHERE id = $1 AND is_active = TRUE
       FOR SHARE`,
      [catalogItemId]
    );

    const catalog = catalogResult.rows[0] as Record<string, unknown> | undefined;

    if (!catalog) {
      throw new Error('Active fee catalog item was not found.');
    }

    const baseAmount = Number(catalog.amount);
    const effectiveAmount = amountOverride ?? baseAmount;

    await client.query(
      `INSERT INTO program_fee_schedule_items (
         id,
         schedule_id,
         fee_catalog_item_id,
         amount_override,
         base_amount_snapshot,
         fee_name_snapshot,
         fee_category_snapshot,
         fee_type_snapshot,
         allocation_priority
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id,
        scheduleId,
        catalogItemId,
        amountOverride,
        baseAmount,
        catalog.name,
        catalog.category,
        catalog.fee_type,
        allocationPriority,
      ]
    );

    await writeFeeAuditLog(client, {
      actorUserId,
      action: 'FEE_SCHEDULE_ITEM_ADDED',
      resourceType: 'PROGRAM_FEE_SCHEDULE',
      resourceId: scheduleId,
      ipAddress: actor.ipAddress,
      details: {
        scheduleItemId: id,
        feeCatalogItemId: catalogItemId,
        baseAmountSnapshot: baseAmount,
        amountOverride,
        effectiveAmount,
        allocationPriority,
      },
    });

    return { id, effectiveAmount };
  });
}

export async function updateFeeScheduleItem(
  input: UpdateScheduleItemInput,
  actor: FeeScheduleActor
): Promise<{ id: string; effectiveAmount: number }> {
  const actorUserId = validateActor(actor);
  const scheduleId = requiredText(input.scheduleId, 'Schedule ID');
  const itemId = requiredText(input.itemId, 'Schedule item ID');

  const hasAmountOverride = Object.prototype.hasOwnProperty.call(
    input,
    'amountOverride'
  );

  const hasAllocationPriority = input.allocationPriority !== undefined;

  const requestedOverride = hasAmountOverride
    ? validateAmount(input.amountOverride, 'Amount override')
    : undefined;

  const requestedPriority = hasAllocationPriority
    ? validatePriority(input.allocationPriority)
    : undefined;

  return withTransaction(async (client) => {
    await lockDraftSchedule(client, scheduleId);

    const existingResult = await client.query(
      `SELECT
         id,
         base_amount_snapshot,
         amount_override,
         allocation_priority
       FROM program_fee_schedule_items
       WHERE id = $1 AND schedule_id = $2
       FOR UPDATE`,
      [itemId, scheduleId]
    );

    const existing = existingResult.rows[0] as Record<string, unknown> | undefined;

    if (!existing) {
      throw new Error('Schedule item was not found.');
    }

    const amountOverride = hasAmountOverride
      ? requestedOverride!
      : existing.amount_override === null
        ? null
        : Number(existing.amount_override);

    const allocationPriority = hasAllocationPriority
      ? requestedPriority!
      : Number(existing.allocation_priority);

    await client.query(
      `UPDATE program_fee_schedule_items
       SET amount_override = $1,
           allocation_priority = $2
       WHERE id = $3 AND schedule_id = $4`,
      [amountOverride, allocationPriority, itemId, scheduleId]
    );

    const effectiveAmount =
      amountOverride ?? Number(existing.base_amount_snapshot);

    await writeFeeAuditLog(client, {
      actorUserId,
      action: 'FEE_SCHEDULE_ITEM_UPDATED',
      resourceType: 'PROGRAM_FEE_SCHEDULE',
      resourceId: scheduleId,
      ipAddress: actor.ipAddress,
      details: {
        scheduleItemId: itemId,
        amountOverride,
        allocationPriority,
        effectiveAmount,
        changedAmountOverride: hasAmountOverride,
        changedAllocationPriority: hasAllocationPriority,
      },
    });

    return { id: itemId, effectiveAmount };
  });
}
export async function removeFeeScheduleItem(
  scheduleIdInput: string,
  itemIdInput: string,
  actor: FeeScheduleActor
): Promise<{ id: string; removed: boolean }> {
  const actorUserId = validateActor(actor);
  const scheduleId = requiredText(scheduleIdInput, 'Schedule ID');
  const itemId = requiredText(itemIdInput, 'Schedule item ID');

  return withTransaction(async (client) => {
    await lockDraftSchedule(client, scheduleId);

    const result = await client.query(
      `DELETE FROM program_fee_schedule_items
       WHERE id = $1 AND schedule_id = $2
       RETURNING id, fee_catalog_item_id`,
      [itemId, scheduleId]
    );

    if (!result.rows[0]) {
      throw new Error('Schedule item was not found.');
    }

    await writeFeeAuditLog(client, {
      actorUserId,
      action: 'FEE_SCHEDULE_ITEM_REMOVED',
      resourceType: 'PROGRAM_FEE_SCHEDULE',
      resourceId: scheduleId,
      ipAddress: actor.ipAddress,
      details: {
        scheduleItemId: itemId,
        feeCatalogItemId: result.rows[0].fee_catalog_item_id,
      },
    });

    return { id: itemId, removed: true };
  });
}

export async function cloneProgramFeeSchedule(
  input: CloneFeeScheduleInput,
  actor: FeeScheduleActor
): Promise<{ id: string; isActive: false }> {
  const actorUserId = validateActor(actor);
  const sourceId = requiredText(input.sourceScheduleId, 'Source schedule ID');
  const newId = randomUUID();

  return withTransaction(async (client) => {
    const sourceResult = await client.query(
      `SELECT id, programme_id, session, level
       FROM program_fee_schedule
       WHERE id = $1
       FOR SHARE`,
      [sourceId]
    );

    const source = sourceResult.rows[0] as Record<string, unknown> | undefined;

    if (!source) {
      throw new Error('Source fee schedule was not found.');
    }

    const programmeId = input.programmeId
      ? requiredText(input.programmeId, 'Programme ID')
      : String(source.programme_id);

    const session = input.session
      ? requiredText(input.session, 'Academic session')
      : String(source.session);

    const level = input.level
      ? requiredText(input.level, 'Level')
      : String(source.level);

    await client.query(
      `INSERT INTO program_fee_schedule (
         id, programme_id, session, level,
         status, is_active, created_at, created_by
       )
       VALUES ($1, $2, $3, $4, 'DRAFT', FALSE, NOW(), $5)`,
      [newId, programmeId, session, level, actorUserId]
    );

    await client.query(
      `INSERT INTO program_fee_schedule_items (
         id,
         schedule_id,
         fee_catalog_item_id,
         amount_override,
         base_amount_snapshot,
         fee_name_snapshot,
         fee_category_snapshot,
         fee_type_snapshot,
         allocation_priority
       )
       SELECT
         gen_random_uuid()::text,
         $1,
         fee_catalog_item_id,
         amount_override,
         base_amount_snapshot,
         fee_name_snapshot,
         fee_category_snapshot,
         fee_type_snapshot,
         allocation_priority
       FROM program_fee_schedule_items
       WHERE schedule_id = $2`,
      [newId, sourceId]
    );

    await writeFeeAuditLog(client, {
      actorUserId,
      action: 'FEE_SCHEDULE_CLONED',
      resourceType: 'PROGRAM_FEE_SCHEDULE',
      resourceId: newId,
      ipAddress: actor.ipAddress,
      details: {
        sourceScheduleId: sourceId,
        programmeId,
        session,
        level,
        isActive: false,
      },
    });

    return { id: newId, isActive: false };
  });
}

export async function publishProgramFeeSchedule(
  scheduleIdInput: string,
  actor: FeeScheduleActor
): Promise<{ id: string; status: 'PUBLISHED' }> {
  const actorUserId = validateActor(actor);
  const scheduleId = requiredText(scheduleIdInput, 'Schedule ID');

  return withTransaction(async (client) => {
    const schedule = await client.query(
      `SELECT id, status, is_active
       FROM program_fee_schedule
       WHERE id = $1
       FOR UPDATE`,
      [scheduleId]
    );

    const row = schedule.rows[0] as Record<string, unknown> | undefined;

    if (!row) {
      throw new Error('Fee schedule was not found.');
    }

    if (!row.is_active) {
      throw new Error('Activate the schedule before publishing it.');
    }

    if (row.status === 'PUBLISHED') {
      throw new Error('This fee schedule is already published.');
    }

    const countResult = await client.query(
      `SELECT COUNT(*)::integer AS item_count
       FROM program_fee_schedule_items
       WHERE schedule_id = $1`,
      [scheduleId]
    );

    if (Number(countResult.rows[0].item_count) < 1) {
      throw new Error('Add at least one fee item before publishing the schedule.');
    }

    await client.query(
      `UPDATE program_fee_schedule
       SET status = 'PUBLISHED',
           published_at = NOW()
       WHERE id = $1`,
      [scheduleId]
    );

    await writeFeeAuditLog(client, {
      actorUserId,
      action: 'FEE_SCHEDULE_PUBLISHED',
      resourceType: 'PROGRAM_FEE_SCHEDULE',
      resourceId: scheduleId,
      ipAddress: actor.ipAddress,
      details: { status: 'PUBLISHED' },
    });

    return { id: scheduleId, status: 'PUBLISHED' };
  });
}

export async function unpublishProgramFeeSchedule(
  scheduleIdInput: string,
  actor: FeeScheduleActor
): Promise<{ id: string; status: 'DRAFT' }> {
  const actorUserId = validateActor(actor);
  const scheduleId = requiredText(scheduleIdInput, 'Schedule ID');

  return withTransaction(async (client) => {
    const result = await client.query(
      `SELECT id, status
       FROM program_fee_schedule
       WHERE id = $1
       FOR UPDATE`,
      [scheduleId]
    );

    const schedule = result.rows[0] as Record<string, unknown> | undefined;

    if (!schedule) {
      throw new Error('Fee schedule was not found.');
    }

    if (schedule.status !== 'PUBLISHED') {
      throw new Error('Only published schedules can be unpublished.');
    }

    await client.query(
      `UPDATE program_fee_schedule
       SET status = 'DRAFT',
           published_at = NULL
       WHERE id = $1`,
      [scheduleId]
    );

    await writeFeeAuditLog(client, {
      actorUserId,
      action: 'FEE_SCHEDULE_UNPUBLISHED',
      resourceType: 'PROGRAM_FEE_SCHEDULE',
      resourceId: scheduleId,
      ipAddress: actor.ipAddress,
      details: { status: 'DRAFT' },
    });

    return { id: scheduleId, status: 'DRAFT' };
  });
}

export async function setFeeScheduleActive(
  scheduleIdInput: string,
  active: boolean,
  actor: FeeScheduleActor
): Promise<{ id: string; isActive: boolean }> {
  const actorUserId = validateActor(actor);
  const scheduleId = requiredText(scheduleIdInput, 'Schedule ID');

  return withTransaction(async (client) => {
    const result = await client.query(
      `SELECT id, status, is_active
       FROM program_fee_schedule
       WHERE id = $1
       FOR UPDATE`,
      [scheduleId]
    );

    const schedule = result.rows[0] as Record<string, unknown> | undefined;

    if (!schedule) {
      throw new Error('Fee schedule was not found.');
    }

    if (Boolean(schedule.is_active) === active) {
      throw new Error(
        active ? 'This schedule is already active.' : 'This schedule is already inactive.'
      );
    }

    if (active && schedule.status !== 'DRAFT') {
      throw new Error('An inactive schedule must be a draft before it can be activated.');
    }

    if (!active) {
      await client.query(
        `UPDATE program_fee_schedule
         SET is_active = FALSE,
             status = 'DRAFT',
             published_at = NULL
         WHERE id = $1`,
        [scheduleId]
      );
    } else {
      try {
        await client.query(
          `UPDATE program_fee_schedule
           SET is_active = TRUE
           WHERE id = $1`,
          [scheduleId]
        );
      } catch (error) {
        if ((error as { code?: string }).code === '23505') {
          throw new Error(
            'Another active schedule already exists for this programme, session and level. Deactivate it first.'
          );
        }
        throw error;
      }
    }

    await writeFeeAuditLog(client, {
      actorUserId,
      action: active ? 'FEE_SCHEDULE_ACTIVATED' : 'FEE_SCHEDULE_DEACTIVATED',
      resourceType: 'PROGRAM_FEE_SCHEDULE',
      resourceId: scheduleId,
      ipAddress: actor.ipAddress,
      details: {
        isActive: active,
        status: active ? 'DRAFT' : 'DRAFT',
      },
    });

    return { id: scheduleId, isActive: active };
  });
}


