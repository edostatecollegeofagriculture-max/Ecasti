import { Router, Response } from 'express';
import {
  AuthenticatedRequest,
  authenticateToken,
  requireRoles,
} from './authMiddleware';
import { db } from './db';
import { neonPool } from './neon';

import {
  listFeeCatalogItems,
  createFeeCatalogItem,
  updateFeeCatalogItem,
  deleteFeeCatalogItem,
} from './feeCatalogService';

import {
  listProgramFeeSchedules,
  getProgramFeeSchedule,
  createProgramFeeSchedule,
  addFeeScheduleItem,
  updateFeeScheduleItem,
  removeFeeScheduleItem,
  cloneProgramFeeSchedule,
  publishProgramFeeSchedule,
  unpublishProgramFeeSchedule,
  setFeeScheduleActive,
} from './feeScheduleService';

import { recordFeePayment } from './feePaymentService';

export const feeApiRouter = Router();

const MANAGERS = ['BURSAR'];
const VIEW_ROLES = [
  'SUPER_ADMIN',
  'BURSAR',
  'INSTITUTION_ADMIN',
  'RECTOR',
  'REGISTRAR',
  'ADMISSIONS_OFFICER',
  'DEAN',
  'HOD',
  'LECTURER',
  'EXAM_OFFICER',
];

type Handler = (
  req: AuthenticatedRequest,
  res: Response
) => Promise<unknown>;

function asyncRoute(handler: Handler) {
  return (req: AuthenticatedRequest, res: Response) => {
    void handler(req, res).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : '';

      if (message.includes('Authentication required')) {
        return res.status(401).json({
          success: false,
          message: 'Authentication is required.',
        });
      }

      if (
        message.includes('not permitted') ||
        message.includes('only access your own')
      ) {
        return res.status(403).json({
          success: false,
          message: 'You are not permitted to access this fee record.',
        });
      }
      if (
        message.includes('required') ||
        message.includes('must be') ||
        message.includes('too long') ||
        message.includes('cannot') ||
        message.startsWith('Invalid ')
      ) {
        return res.status(400).json({
          success: false,
          message,
        });
      }

      if (
        message.includes('not found') ||
        message.includes('was not found')
      ) {
        return res.status(404).json({
          success: false,
          message,
        });
      }

      if (
        message.includes('already') ||
        message.includes('published') ||
        message.includes('active schedule')
      ) {
        return res.status(409).json({
          success: false,
          message,
        });
      }

      console.error('[Fee API] Request failed:', error);

      return res.status(500).json({
        success: false,
        message: 'The fee operation could not be completed.',
      });
    });
  };
}

function actor(req: AuthenticatedRequest) {
  if (!req.user) {
    throw new Error('Authentication required.');
  }

  return {
    userId: req.user.id,
    ipAddress: req.ip,
  };
}

function catalogActor(req: AuthenticatedRequest) {
  if (!req.user) {
    throw new Error('Authentication required.');
  }

  return {
    actorUserId: req.user.id,
    ipAddress: req.ip,
  };
}

function bodyObject(req: AuthenticatedRequest): Record<string, unknown> {
  if (
    !req.body ||
    typeof req.body !== 'object' ||
    Array.isArray(req.body)
  ) {
    throw new Error('A valid request body is required.');
  }

  return req.body as Record<string, unknown>;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} is required.`);
  }

  if (value.trim().length > 256) {
    throw new Error(`${field} is too long.`);
  }

  return value.trim();
}

function requiredAmount(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value <= 0 ||
    Math.round(value * 100) !== value * 100
  ) {
    throw new Error(
      'Amount must be positive and have no more than two decimal places.'
    );
  }

  return value;
}

function optionalBoolean(value: unknown, defaultValue = false): boolean {
  if (value === undefined) return defaultValue;

  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;

  throw new Error('Expected a true or false value.');
}

function currentUser(req: AuthenticatedRequest) {
  if (!req.user) {
    throw new Error('Authentication required.');
  }

  return req.user;
}

function resolveStudentId(
  req: AuthenticatedRequest,
  requestedStudentId?: string
): string {
  const user = currentUser(req);

  if (user.role === 'STUDENT') {
    const student = db.getState().students.find(
      (item) => item.userId === user.id
    );

    if (!student) {
      throw new Error('Student record was not found.');
    }

    if (
      requestedStudentId &&
      requestedStudentId !== student.id
    ) {
      throw new Error('You can only access your own fee records.');
    }

    return student.id;
  }

  if (!VIEW_ROLES.includes(user.role)) {
    throw new Error('You are not permitted to view fee records.');
  }

  return requiredString(requestedStudentId, 'Student ID');
}

feeApiRouter.use(authenticateToken);
feeApiRouter.use((_req, res, next) => {
  if (process.env.FEE_MANAGEMENT_ENABLED !== 'true') {
    return res.status(503).json({
      success: false,
      code: 'FEE_MANAGEMENT_DISABLED',
      message: 'The fee management system is not currently available.',
    });
  }

  return next();
});

// ------------------------------------------------------
// FEE CATALOG
// ------------------------------------------------------

feeApiRouter.get(
  '/catalog',
  requireRoles(...VIEW_ROLES),
  asyncRoute(async (req, res) => {
    const includeInactive = optionalBoolean(
      req.query.includeInactive
    );

    if (
      includeInactive &&
      !VIEW_ROLES.includes(currentUser(req).role)
    ) {
      return res.status(403).json({
        success: false,
        message: 'You cannot view inactive fee items.',
      });
    }

    const items = await listFeeCatalogItems(includeInactive);

    return res.json({ success: true, items });
  })
);

feeApiRouter.post(
  '/catalog',
  requireRoles(...MANAGERS),
  asyncRoute(async (req, res) => {
    const body = bodyObject(req);

    const item = await createFeeCatalogItem({
      ...catalogActor(req),
      name: requiredString(body.name, 'Fee name'),
      amount: requiredAmount(body.amount),
      feeType: requiredString(body.feeType, 'Fee type') as
        | 'ONE_TIME'
        | 'PER_SESSION',
      category: requiredString(body.category, 'Fee category') as
        | 'COMPULSORY'
        | 'OPTIONAL',
      description:
        typeof body.description === 'string'
          ? body.description
          : undefined,
    });

    return res.status(201).json({ success: true, item });
  })
);

feeApiRouter.patch(
  '/catalog/:id',
  requireRoles(...MANAGERS),
  asyncRoute(async (req, res) => {
    const body = bodyObject(req);

    const input: Record<string, unknown> = {
      ...catalogActor(req),
      id: requiredString(req.params.id, 'Fee catalog ID'),
    };

    for (const field of [
      'name',
      'amount',
      'feeType',
      'category',
      'isActive',
      'description',
    ]) {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        input[field] = body[field];
      }
    }

    if (input.amount !== undefined) {
      input.amount = requiredAmount(input.amount);
    }

    const item = await updateFeeCatalogItem(input as unknown as Parameters<typeof updateFeeCatalogItem>[0]);

    return res.json({ success: true, item });
  })
);

feeApiRouter.delete(
  '/catalog/:id',
  requireRoles(...MANAGERS),
  asyncRoute(async (req, res) => {
    const result = await deleteFeeCatalogItem(
      requiredString(req.params.id, 'Fee catalog ID'),
      catalogActor(req)
    );

    return res.json({ success: true, result });
  })
);

// ------------------------------------------------------
// PROGRAMME FEE SCHEDULES
// ------------------------------------------------------

feeApiRouter.get(
  '/schedules',
  requireRoles(...VIEW_ROLES),
  asyncRoute(async (req, res) => {
    const includeInactive = optionalBoolean(
      req.query.includeInactive
    );

    const schedules = await listProgramFeeSchedules(includeInactive);

    return res.json({ success: true, schedules });
  })
);

feeApiRouter.get(
  '/schedules/:id',
  requireRoles(...VIEW_ROLES),
  asyncRoute(async (req, res) => {
    const result = await getProgramFeeSchedule(
      requiredString(req.params.id, 'Schedule ID')
    );

    return res.json({ success: true, ...result });
  })
);


function validateProgrammeExists(programmeId: unknown): string {
  const id = requiredString(programmeId, 'Programme ID');
  const exists = db.getState().programmes.some(
    (programme) => programme.id === id
  );

  if (!exists) {
    throw new Error('Selected programme was not found.');
  }

  return id;
}
feeApiRouter.post(
  '/schedules',
  requireRoles(...MANAGERS),
  asyncRoute(async (req, res) => {
    const body = bodyObject(req);

    const result = await createProgramFeeSchedule(
      {
        programmeId: validateProgrammeExists(body.programmeId),
        session: requiredString(body.session, 'Academic session'),
        level: requiredString(body.level, 'Level'),
      },
      actor(req)
    );

    return res.status(201).json({ success: true, ...result });
  })
);

feeApiRouter.post(
  '/schedules/:id/items',
  requireRoles(...MANAGERS),
  asyncRoute(async (req, res) => {
    const body = bodyObject(req);

    const result = await addFeeScheduleItem(
      {
        scheduleId: requiredString(req.params.id, 'Schedule ID'),
        feeCatalogItemId: requiredString(
          body.feeCatalogItemId,
          'Fee catalog item ID'
        ),
        amountOverride:
          body.amountOverride === null
            ? null
            : body.amountOverride === undefined
              ? undefined
              : requiredAmount(body.amountOverride),
        allocationPriority:
          body.allocationPriority === undefined
            ? undefined
            : Number(body.allocationPriority),
      },
      actor(req)
    );

    return res.status(201).json({ success: true, ...result });
  })
);

feeApiRouter.patch(
  '/schedules/:id/items/:itemId',
  requireRoles(...MANAGERS),
  asyncRoute(async (req, res) => {
    const body = bodyObject(req);

    const input: {
      scheduleId: string;
      itemId: string;
      amountOverride?: number | null;
      allocationPriority?: number;
    } = {
      scheduleId: requiredString(req.params.id, 'Schedule ID'),
      itemId: requiredString(req.params.itemId, 'Schedule item ID'),
    };

    if (Object.prototype.hasOwnProperty.call(body, 'amountOverride')) {
      input.amountOverride =
        body.amountOverride === null
          ? null
          : requiredAmount(body.amountOverride);
    }

    if (body.allocationPriority !== undefined) {
      input.allocationPriority = Number(body.allocationPriority);
    }

    const result = await updateFeeScheduleItem(input, actor(req));

    return res.json({ success: true, ...result });
  })
);

feeApiRouter.delete(
  '/schedules/:id/items/:itemId',
  requireRoles(...MANAGERS),
  asyncRoute(async (req, res) => {
    const result = await removeFeeScheduleItem(
      requiredString(req.params.id, 'Schedule ID'),
      requiredString(req.params.itemId, 'Schedule item ID'),
      actor(req)
    );

    return res.json({ success: true, ...result });
  })
);

feeApiRouter.post(
  '/schedules/:id/clone',
  requireRoles(...MANAGERS),
  asyncRoute(async (req, res) => {
    const body = bodyObject(req);

    const result = await cloneProgramFeeSchedule(
      {
        sourceScheduleId: requiredString(
          req.params.id,
          'Source schedule ID'
        ),
        programmeId:
          body.programmeId === undefined
            ? undefined
            : validateProgrammeExists(body.programmeId),
        session:
          body.session === undefined
            ? undefined
            : requiredString(body.session, 'Academic session'),
        level:
          body.level === undefined
            ? undefined
            : requiredString(body.level, 'Level'),
      },
      actor(req)
    );

    return res.status(201).json({ success: true, ...result });
  })
);

feeApiRouter.post(
  '/schedules/:id/publish',
  requireRoles(...MANAGERS),
  asyncRoute(async (req, res) => {
    const result = await publishProgramFeeSchedule(
      requiredString(req.params.id, 'Schedule ID'),
      actor(req)
    );

    return res.json({ success: true, ...result });
  })
);

feeApiRouter.post(
  '/schedules/:id/unpublish',
  requireRoles(...MANAGERS),
  asyncRoute(async (req, res) => {
    const result = await unpublishProgramFeeSchedule(
      requiredString(req.params.id, 'Schedule ID'),
      actor(req)
    );

    return res.json({ success: true, ...result });
  })
);

feeApiRouter.patch(
  '/schedules/:id/active',
  requireRoles(...MANAGERS),
  asyncRoute(async (req, res) => {
    const body = bodyObject(req);

    if (typeof body.active !== 'boolean') {
      throw new Error('Active must be true or false.');
    }

    const result = await setFeeScheduleActive(
      requiredString(req.params.id, 'Schedule ID'),
      body.active,
      actor(req)
    );

    return res.json({ success: true, ...result });
  })
);

// ------------------------------------------------------
// STUDENT OBLIGATIONS
// ------------------------------------------------------

async function getStudentFees(studentId: string) {
  const obligations = await neonPool.query(
    `SELECT
       id,
       student_id,
       programme_id,
       session,
       level,
       fee_catalog_item_id,
       fee_name_snapshot,
       fee_type_snapshot,
       fee_category_snapshot,
       allocation_priority_snapshot,
       amount_due,
       amount_paid,
       balance,
       status,
       due_date,
       source,
       generated_at
     FROM student_fee_obligations
     WHERE student_id = $1
     ORDER BY session DESC, allocation_priority_snapshot ASC,
              generated_at ASC, id ASC`,
    [studentId]
  );

  return obligations.rows;
}

feeApiRouter.get(
  '/students/me/fees',
  asyncRoute(async (req, res) => {
    const studentId = resolveStudentId(req);

    const obligations = await getStudentFees(studentId);

    return res.json({
      success: true,
      studentId,
      obligations,
    });
  })
);

feeApiRouter.get(
  '/students/:studentId/fees',
  asyncRoute(async (req, res) => {
    const studentId = resolveStudentId(
      req,
      requiredString(req.params.studentId, 'Student ID')
    );

    const obligations = await getStudentFees(studentId);

    return res.json({
      success: true,
      studentId,
      obligations,
    });
  })
);

// ------------------------------------------------------
// PAYMENTS
// ------------------------------------------------------

feeApiRouter.post(
  '/payments',
  requireRoles(...MANAGERS),
  asyncRoute(async (req, res) => {
    const body = bodyObject(req);
    const user = currentUser(req);

    const idempotencyKey = requiredString(
      req.headers['idempotency-key'] ?? body.idempotencyKey,
      'Idempotency key'
    );

    const studentId = requiredString(body.studentId, 'Student ID');

    const studentExists = db.getState().students.some(
      (student) => student.id === studentId
    );

    if (!studentExists) {
      throw new Error('Student record was not found.');
    }

    const hasAllocationCategory =
      Object.prototype.hasOwnProperty.call(body, 'allocationCategory');

    const hasFeeCatalogItemId =
      Object.prototype.hasOwnProperty.call(body, 'feeCatalogItemId');

    let allocationCategory: 'COMPULSORY' | 'OPTIONAL' | undefined;

    if (hasAllocationCategory) {
      if (
        body.allocationCategory !== 'COMPULSORY' &&
        body.allocationCategory !== 'OPTIONAL'
      ) {
        throw new Error('Allocation category must be COMPULSORY or OPTIONAL.');
      }

      allocationCategory = body.allocationCategory as 'COMPULSORY' | 'OPTIONAL';
    }

    const feeCatalogItemId = hasFeeCatalogItemId
      ? requiredString(body.feeCatalogItemId, 'Fee catalog item ID')
      : undefined;

    if (allocationCategory && feeCatalogItemId) {
      throw new Error('Payment cannot specify both an allocation category and a fee item.');
    }
    const payment = await recordFeePayment({
      studentId,
      amount: requiredAmount(body.amount),
      method: requiredString(body.method, 'Payment method'),
      recordedBy: user.id,
      idempotencyKey,
      notes:
        typeof body.notes === 'string'
          ? body.notes
          : undefined,
      session:
        typeof body.session === 'string'
          ? body.session
          : undefined,
      ipAddress: req.ip,
      allocationCategory,
      feeCatalogItemId,
    });

    return res.status(201).json({
      success: true,
      payment,
    });
  })
);

async function getStudentPaymentHistory(studentId: string) {
  const payments = await neonPool.query(
    `SELECT
       p.id,
       p.receipt_number,
       p.student_id,
       p.amount,
       p.method,
       p.recorded_by,
       p.recorded_at,
       p.notes,
       p.session,
       p.allocation_category,
       p.fee_catalog_item_id
     FROM student_payments p
     WHERE p.student_id = $1
     ORDER BY p.recorded_at DESC, p.id DESC`,
    [studentId]
  );

  const allocations = await neonPool.query(
    `SELECT
       a.id,
       a.payment_id,
       a.obligation_id,
       a.fee_catalog_item_id,
       a.fee_name_snapshot,
       a.fee_category_snapshot,
       a.amount_allocated
     FROM student_payment_allocations a
     INNER JOIN student_payments p ON p.id = a.payment_id
     WHERE p.student_id = $1
     ORDER BY p.recorded_at DESC, a.id ASC`,
    [studentId]
  );

  return {
    payments: payments.rows,
    allocations: allocations.rows,
  };
}

feeApiRouter.get(
  '/students/me/payments',
  asyncRoute(async (req, res) => {
    const studentId = resolveStudentId(req);
    const history = await getStudentPaymentHistory(studentId);

    return res.json({
      success: true,
      studentId,
      ...history,
    });
  })
);

feeApiRouter.get(
  '/students/:studentId/payments',
  asyncRoute(async (req, res) => {
    const studentId = resolveStudentId(
      req,
      requiredString(req.params.studentId, 'Student ID')
    );

    const history = await getStudentPaymentHistory(studentId);

    return res.json({
      success: true,
      studentId,
      ...history,
    });
  })
);









