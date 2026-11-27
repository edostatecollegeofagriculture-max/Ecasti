import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { neonPool } from './neon';
import { writeFeeAuditLog } from './feeAuditService';

export type FeeType = 'ONE_TIME' | 'PER_SESSION';
export type FeeCategory = 'COMPULSORY' | 'OPTIONAL';

export interface FeeCatalogItem {
  id: string;
  name: string;
  amount: number;
  feeType: FeeType;
  category: FeeCategory;
  isActive: boolean;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface FeeCatalogActor {
  actorUserId: string;
  ipAddress?: string;
}

export interface CreateFeeCatalogInput extends FeeCatalogActor {
  name: string;
  amount: number;
  feeType: FeeType;
  category: FeeCategory;
  description?: string;
}

export interface UpdateFeeCatalogInput extends FeeCatalogActor {
  id: string;
  name?: string;
  amount?: number;
  feeType?: FeeType;
  category?: FeeCategory;
  isActive?: boolean;
  description?: string;
}

interface FeeCatalogRow {
  id: string;
  name: string;
  amount: string | number;
  fee_type: FeeType;
  category: FeeCategory;
  is_active: boolean;
  description: string;
  created_at: Date | string;
  updated_at: Date | string;
}

function requiredText(
  value: string,
  field: string,
  maxLength = 150
): string {
  if (typeof value !== 'string') {
    throw new Error(`${field} must be text.`);
  }

  const result = value.trim();

  if (!result) throw new Error(`${field} is required.`);
  if (result.length > maxLength) {
    throw new Error(`${field} cannot exceed ${maxLength} characters.`);
  }

  return result;
}

function validateAmount(value: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error('Fee amount must be a positive number.');
  }

  const rounded = Math.round(value * 100) / 100;

  if (Math.abs(value - rounded) > 0.0000001) {
    throw new Error('Fee amount cannot have more than two decimal places.');
  }

  return rounded;
}

function validateFeeType(value: FeeType): FeeType {
  if (value !== 'ONE_TIME' && value !== 'PER_SESSION') {
    throw new Error('Invalid fee type.');
  }
  return value;
}

function validateCategory(value: FeeCategory): FeeCategory {
  if (value !== 'COMPULSORY' && value !== 'OPTIONAL') {
    throw new Error('Invalid fee category.');
  }
  return value;
}

function validateDescription(value: string | undefined): string {
  if (value === undefined) return '';
  if (typeof value !== 'string' || value.length > 5000) {
    throw new Error('Description cannot exceed 5000 characters.');
  }
  return value.trim();
}

function validateActor(value: string): string {
  return requiredText(value, 'Actor user ID', 256);
}

function mapRow(row: FeeCatalogRow): FeeCatalogItem {
  return {
    id: row.id,
    name: row.name,
    amount: Number(row.amount),
    feeType: row.fee_type,
    category: row.category,
    isActive: row.is_active,
    description: row.description,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
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
        // Do not return a connection with uncertain transaction state.
        destroyClient = true;
      }
    }

    throw error;
  } finally {
    client.release(destroyClient);
  }
}

export async function listFeeCatalogItems(
  includeInactive = false
): Promise<FeeCatalogItem[]> {
  const result = await neonPool.query<FeeCatalogRow>(
    `SELECT id, name, amount, fee_type, category, is_active,
            description, created_at, updated_at
     FROM fee_catalog
     WHERE ($1::boolean OR is_active = TRUE)
     ORDER BY created_at DESC, name ASC`,
    [includeInactive]
  );

  return result.rows.map(mapRow);
}

export async function createFeeCatalogItem(
  input: CreateFeeCatalogInput
): Promise<FeeCatalogItem> {
  const actorUserId = validateActor(input.actorUserId);
  const name = requiredText(input.name, 'Fee name');
  const amount = validateAmount(input.amount);
  const feeType = validateFeeType(input.feeType);
  const category = validateCategory(input.category);
  const description = validateDescription(input.description);
  const id = randomUUID();

  return withTransaction(async (client) => {
    const result = await client.query<FeeCatalogRow>(
      `INSERT INTO fee_catalog (
         id, name, amount, fee_type, category, is_active,
         description, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, TRUE, $6, NOW(), NOW())
       RETURNING id, name, amount, fee_type, category, is_active,
                 description, created_at, updated_at`,
      [id, name, amount, feeType, category, description]
    );

    const item = mapRow(result.rows[0]);

    await writeFeeAuditLog(client, {
      actorUserId,
      action: 'FEE_CATALOG_CREATED',
      resourceType: 'FEE_CATALOG_ITEM',
      resourceId: id,
      ipAddress: input.ipAddress,
      details: { name, amount, feeType, category },
    });

    return item;
  });
}

export async function updateFeeCatalogItem(
  input: UpdateFeeCatalogInput
): Promise<FeeCatalogItem> {
  const actorUserId = validateActor(input.actorUserId);
  const id = requiredText(input.id, 'Fee catalog ID', 256);

  return withTransaction(async (client) => {
    const existingResult = await client.query<FeeCatalogRow>(
      `SELECT id, name, amount, fee_type, category, is_active,
              description, created_at, updated_at
       FROM fee_catalog
       WHERE id = $1
       FOR UPDATE`,
      [id]
    );

    if (existingResult.rowCount === 0) {
      throw new Error('Fee catalog item was not found.');
    }

    const existing = mapRow(existingResult.rows[0]);

    const name = input.name === undefined
      ? existing.name
      : requiredText(input.name, 'Fee name');

    const amount = input.amount === undefined
      ? existing.amount
      : validateAmount(input.amount);

    const feeType = input.feeType === undefined
      ? existing.feeType
      : validateFeeType(input.feeType);

    const category = input.category === undefined
      ? existing.category
      : validateCategory(input.category);

    const isActive = input.isActive === undefined
      ? existing.isActive
      : input.isActive;

    if (typeof isActive !== 'boolean') {
      throw new Error('Active status must be true or false.');
    }

    const description = input.description === undefined
      ? existing.description
      : validateDescription(input.description);

    const result = await client.query<FeeCatalogRow>(
      `UPDATE fee_catalog
       SET name = $2, amount = $3, fee_type = $4,
           category = $5, is_active = $6,
           description = $7, updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, amount, fee_type, category, is_active,
                 description, created_at, updated_at`,
      [id, name, amount, feeType, category, isActive, description]
    );

    const item = mapRow(result.rows[0]);

    await writeFeeAuditLog(client, {
      actorUserId,
      action: 'FEE_CATALOG_UPDATED',
      resourceType: 'FEE_CATALOG_ITEM',
      resourceId: id,
      ipAddress: input.ipAddress,
      details: {
        changedFields: [
          ...(input.name !== undefined ? ['name'] : []),
          ...(input.amount !== undefined ? ['amount'] : []),
          ...(input.feeType !== undefined ? ['feeType'] : []),
          ...(input.category !== undefined ? ['category'] : []),
          ...(input.isActive !== undefined ? ['isActive'] : []),
          ...(input.description !== undefined ? ['description'] : []),
        ],
      },
    });

    return item;
  });
}

export interface DeleteFeeCatalogResult {
  id: string;
  deleted: boolean;
  deactivated: boolean;
}

export async function deleteFeeCatalogItem(
  idInput: string,
  actor: FeeCatalogActor
): Promise<DeleteFeeCatalogResult> {
  const id = requiredText(idInput, 'Fee catalog ID', 256);
  const actorUserId = validateActor(actor.actorUserId);

  return withTransaction(async (client) => {
    const existing = await client.query(
      `SELECT id FROM fee_catalog WHERE id = $1 FOR UPDATE`,
      [id]
    );

    if (existing.rowCount === 0) {
      throw new Error('Fee catalog item was not found.');
    }

    const references = await client.query<{ is_used: boolean }>(
      `SELECT (
         EXISTS (
           SELECT 1 FROM program_fee_schedule_items
           WHERE fee_catalog_item_id = $1
         )
         OR EXISTS (
           SELECT 1 FROM student_fee_obligations
           WHERE fee_catalog_item_id = $1
         )
       ) AS is_used`,
      [id]
    );

    const isUsed = references.rows[0]?.is_used === true;

    if (isUsed) {
      await client.query(
        `UPDATE fee_catalog
         SET is_active = FALSE, updated_at = NOW()
         WHERE id = $1`,
        [id]
      );

      await writeFeeAuditLog(client, {
        actorUserId,
        action: 'FEE_CATALOG_DEACTIVATED',
        resourceType: 'FEE_CATALOG_ITEM',
        resourceId: id,
        ipAddress: actor.ipAddress,
        details: {
          reason: 'Item is referenced by a schedule or student obligation.',
        },
      });

      return { id, deleted: false, deactivated: true };
    }

    await client.query(
      `DELETE FROM fee_catalog WHERE id = $1`,
      [id]
    );

    await writeFeeAuditLog(client, {
      actorUserId,
      action: 'FEE_CATALOG_DELETED',
      resourceType: 'FEE_CATALOG_ITEM',
      resourceId: id,
      ipAddress: actor.ipAddress,
      details: {
        reason: 'Item had no schedule or student obligation references.',
      },
    });

    return { id, deleted: true, deactivated: false };
  });
}

