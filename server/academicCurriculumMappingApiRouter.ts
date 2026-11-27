import { Router, Response } from 'express';
import {
  AuthenticatedRequest,
  authenticateToken,
  requireRoles,
} from './authMiddleware';
import { db } from './db';
import {
  addCurriculumCourse,
  createCurriculumMapping,
  getCurriculumMapping,
  listCurriculumMappings,
  removeCurriculumCourse,
  reviewCurriculumMapping,
  submitCurriculumMapping,
} from './academicCurriculumMappingService';

export const academicCurriculumMappingApiRouter = Router();

const mappingReaders = [
  'SUPER_ADMIN',
  'INSTITUTION_ADMIN',
  'RECTOR',
  'REGISTRAR',
  'DEAN',
  'HOD',
  'EXAM_OFFICER',
];

const mappingPreparers = [
  'SUPER_ADMIN',
  'INSTITUTION_ADMIN',
  'DEAN',
  'HOD',
  'REGISTRAR',
];

function hasProgrammeScope(req: AuthenticatedRequest, programmeId: string): boolean {
  const user = req.user;
  if (!user) return false;
  if (['SUPER_ADMIN', 'INSTITUTION_ADMIN', 'REGISTRAR', 'RECTOR'].includes(user.role)) return true;

  const state = db.getState();
  const programme = state.programmes.find((item) => item.id === programmeId);
  if (!programme) return false;

  if (user.role === 'HOD' || user.role === 'EXAM_OFFICER') {
    return Boolean(user.departmentId && user.departmentId === programme.departmentId);
  }

  if (user.role === 'DEAN') {
    const department = state.departments.find((item) => item.id === programme.departmentId);
    return Boolean(user.schoolId && department?.schoolId === user.schoolId);
  }

  return false;
}

function readableProgrammeIds(req: AuthenticatedRequest): string[] | null {
  const user = req.user;
  if (!user) return [];
  if (['SUPER_ADMIN', 'INSTITUTION_ADMIN', 'REGISTRAR', 'RECTOR'].includes(user.role)) return null;
  const state = db.getState();
  if (user.role === 'HOD' || user.role === 'EXAM_OFFICER') {
    if (!user.departmentId) return [];
    return state.programmes.filter((programme) => programme.departmentId === user.departmentId).map((programme) => programme.id);
  }
  if (user.role === 'DEAN') {
    if (!user.schoolId) return [];
    const departmentIds = new Set(state.departments.filter((department) => department.schoolId === user.schoolId).map((department) => department.id));
    return state.programmes.filter((programme) => departmentIds.has(programme.departmentId)).map((programme) => programme.id);
  }
  return [];
}

function audit(
  req: AuthenticatedRequest,
  action: string,
  mappingId: string,
  details: Record<string, unknown> = {}
) {
  db.logAudit({
    userId: req.user!.id,
    userEmail: req.user!.email,
    action,
    resource: 'ACADEMIC_CURRICULUM_MAPPING',
    details: { mappingId, ...details },
    ipAddress: req.ip,
  });
}

function sendServiceError(res: Response, error: unknown) {
  const message = error instanceof Error ? error.message : 'The curriculum mapping request could not be completed.';
  const notFound = /not found|not part of/i.test(message);
  const conflict = /only a |only the |cannot |must be |already |current mapping|review their own|at least one|rejection reason/i.test(message);
  return res.status(notFound ? 404 : conflict ? 409 : 400).json({
    success: false,
    message,
  });
}

// Read mapping headers and course snapshots.
academicCurriculumMappingApiRouter.get(
  '/mappings',
  authenticateToken,
  requireRoles(...mappingReaders),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const programmeId = typeof req.query.programmeId === 'string' ? req.query.programmeId.trim() : undefined;
      const cohortSession = typeof req.query.cohortSession === 'string' ? req.query.cohortSession.trim() : undefined;
      const scopedIds = readableProgrammeIds(req);
      if (scopedIds !== null) {
        if (programmeId && !scopedIds.includes(programmeId)) return res.status(403).json({ success: false, message: 'You do not have read access to this programme.' });
        if (scopedIds.length === 0) return res.json({ success: true, mappings: [] });
        const mappings = await listCurriculumMappings({ programmeId, programmeIds: programmeId ? undefined : scopedIds, cohortSession });
        return res.json({ success: true, mappings });
      }
      const mappings = await listCurriculumMappings({ programmeId, cohortSession });
      return res.json({ success: true, mappings });
    } catch {
      return res.status(503).json({
        success: false,
        message: 'Curriculum mapping storage is unavailable. Confirm that migration 006 has been installed in the target environment.',
      });
    }
  }
);

academicCurriculumMappingApiRouter.get(
  '/mappings/:mappingId',
  authenticateToken,
  requireRoles(...mappingReaders),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const mapping = await getCurriculumMapping(req.params.mappingId);
      if (!mapping) return res.status(404).json({ success: false, message: 'Curriculum mapping not found.' });
      if (!hasProgrammeScope(req, mapping.programmeId)) return res.status(403).json({ success: false, message: 'You do not have read access to this programme.' });
      return res.json({ success: true, mapping });
    } catch {
      return res.status(503).json({
        success: false,
        message: 'Curriculum mapping storage is unavailable. Confirm that migration 006 has been installed in the target environment.',
      });
    }
  }
);

// A mapping draft is prepared by an authorized academic officer.
academicCurriculumMappingApiRouter.post(
  '/mappings',
  authenticateToken,
  requireRoles(...mappingPreparers),
  async (req: AuthenticatedRequest, res: Response) => {
    const programmeId = typeof req.body?.programmeId === 'string' ? req.body.programmeId.trim() : '';
    const cohortSession = typeof req.body?.cohortSession === 'string' ? req.body.cohortSession.trim() : '';
    if (!programmeId || !cohortSession) {
      return res.status(400).json({ success: false, message: 'Programme ID and cohort session are required.' });
    }

    const state = db.getState();
    const programme = state.programmes.find((item) => item.id === programmeId);
    if (!programme) return res.status(404).json({ success: false, message: 'Programme not found in the institutional catalogue.' });
    if (!hasProgrammeScope(req, programmeId)) return res.status(403).json({ success: false, message: 'You do not have academic authority over this programme.' });

    try {
      const mapping = await createCurriculumMapping({
        programmeId,
        cohortSession,
        preparedBy: req.user!.id,
      });
      audit(req, 'CURRICULUM_MAPPING_CREATED', mapping.id, {
        programmeId,
        cohortSession,
        version: mapping.version,
      });
      return res.status(201).json({ success: true, mapping });
    } catch (error) {
      return sendServiceError(res, error);
    }
  }
);

// Add a snapshot of an existing catalogue course to a draft mapping.
academicCurriculumMappingApiRouter.post(
  '/mappings/:mappingId/courses',
  authenticateToken,
  requireRoles(...mappingPreparers),
  async (req: AuthenticatedRequest, res: Response) => {
    const courseId = typeof req.body?.courseId === 'string' ? req.body.courseId.trim() : '';
    if (!courseId) return res.status(400).json({ success: false, message: 'Course ID is required.' });

    try {
      const mapping = await getCurriculumMapping(req.params.mappingId);
      if (!mapping) return res.status(404).json({ success: false, message: 'Curriculum mapping not found.' });
      if (!hasProgrammeScope(req, mapping.programmeId)) return res.status(403).json({ success: false, message: 'You do not have academic authority over this programme.' });
      if (mapping.status !== 'DRAFT') return res.status(409).json({ success: false, message: 'Courses can only be changed while a mapping is in DRAFT status.' });

      const state = db.getState();
      const programme = state.programmes.find((item) => item.id === mapping.programmeId);
      const course = state.courses.find((item) => item.id === courseId);
      if (!programme || !course) return res.status(404).json({ success: false, message: 'Programme or course was not found in the institutional catalogue.' });
      const structure = programme.academicStructure;
      if (!structure || !Array.isArray(structure.stages) || structure.stages.length === 0) {
        return res.status(422).json({ success: false, message: 'Configure the programme academic stages and periods before creating curriculum mappings.' });
      }

      const stageCode = typeof req.body?.stageCode === 'string' ? req.body.stageCode.trim() : '';
      const periodCode = typeof req.body?.periodCode === 'string' ? req.body.periodCode.trim() : '';
      const classification = typeof req.body?.classification === 'string' ? req.body.classification.trim().toUpperCase() : '';
      if (!stageCode || !periodCode) {
        return res.status(400).json({ success: false, message: 'Stage code and period code are required.' });
      }
      if (!['COMPULSORY', 'ELECTIVE', 'OPTIONAL'].includes(classification)) {
        return res.status(400).json({ success: false, message: 'Classification must be COMPULSORY, ELECTIVE or OPTIONAL.' });
      }

      const stage = structure.stages.find((item) => item.code === stageCode);
      if (!stage) return res.status(422).json({ success: false, message: 'The selected stage is not configured for this programme.' });
      const period = stage.periods.find((item) => item.code === periodCode);
      if (!period) return res.status(422).json({ success: false, message: 'The selected period is not configured within the selected stage.' });

      if (course.programmeId && course.programmeId !== programme.id) {
        return res.status(422).json({ success: false, message: 'The selected course belongs to a different programme.' });
      }
      if (!course.programmeId && course.departmentId !== programme.departmentId) {
        return res.status(422).json({ success: false, message: 'The selected course is not assigned to this programme or its department.' });
      }

      // Preserve legacy ND columns only when configured labels exactly match
      // the catalogue's legacy values; never infer ND from arbitrary stage codes.
      const legacyLevel = ['ND I', 'ND II'].includes(stage.label) && course.level === stage.label
        ? course.level
        : null;
      const legacySemester = ['First Semester', 'Second Semester'].includes(period.label) && course.semester === period.label
        ? course.semester
        : null;

      const result = await addCurriculumCourse(req.params.mappingId, {
        courseId: course.id,
        courseCode: course.code,
        courseTitle: course.title,
        stageCode: stage.code,
        stageLabel: stage.label,
        periodCode: period.code,
        periodLabel: period.label,
        classification: classification as 'COMPULSORY' | 'ELECTIVE' | 'OPTIONAL',
        legacyLevel,
        legacySemester,
        creditUnits: course.creditUnits,
      });
      audit(req, 'CURRICULUM_MAPPING_COURSE_ADDED', mapping.id, {
        courseId: course.id,
        courseCode: course.code,
      });
      return res.status(201).json({ success: true, course: result });
    } catch (error) {
      return sendServiceError(res, error);
    }
  }
);

academicCurriculumMappingApiRouter.delete(
  '/mappings/:mappingId/courses/:courseId',
  authenticateToken,
  requireRoles(...mappingPreparers),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const mapping = await getCurriculumMapping(req.params.mappingId);
      if (!mapping) return res.status(404).json({ success: false, message: 'Curriculum mapping not found.' });
      if (!hasProgrammeScope(req, mapping.programmeId)) return res.status(403).json({ success: false, message: 'You do not have academic authority over this programme.' });
      const result = await removeCurriculumCourse(req.params.mappingId, req.params.courseId);
      audit(req, 'CURRICULUM_MAPPING_COURSE_REMOVED', req.params.mappingId, {
        courseId: req.params.courseId,
      });
      return res.json({ success: true, result });
    } catch (error) {
      return sendServiceError(res, error);
    }
  }
);

academicCurriculumMappingApiRouter.post(
  '/mappings/:mappingId/submit',
  authenticateToken,
  requireRoles(...mappingPreparers),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const mapping = await getCurriculumMapping(req.params.mappingId);
      if (!mapping) return res.status(404).json({ success: false, message: 'Curriculum mapping not found.' });
      if (!hasProgrammeScope(req, mapping.programmeId)) return res.status(403).json({ success: false, message: 'You do not have academic authority over this programme.' });
      const result = await submitCurriculumMapping(req.params.mappingId, req.user!.id);
      audit(req, 'CURRICULUM_MAPPING_SUBMITTED', req.params.mappingId);
      return res.json({ success: true, result });
    } catch (error) {
      return sendServiceError(res, error);
    }
  }
);

// Only the Registrar role (or platform SUPER_ADMIN override) can decide a submitted mapping.
academicCurriculumMappingApiRouter.post(
  '/mappings/:mappingId/review',
  authenticateToken,
  requireRoles('REGISTRAR', 'SUPER_ADMIN'),
  async (req: AuthenticatedRequest, res: Response) => {
    const decision = req.body?.decision;
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : undefined;
    if (!['APPROVE', 'REJECT'].includes(decision)) {
      return res.status(400).json({ success: false, message: 'Decision must be APPROVE or REJECT.' });
    }
    if (decision === 'REJECT' && !reason) {
      return res.status(400).json({ success: false, message: 'A reason is required when rejecting a mapping.' });
    }

    try {
      const result = await reviewCurriculumMapping(
        req.params.mappingId,
        req.user!.id,
        decision,
        reason
      );
      audit(req, decision === 'APPROVE' ? 'CURRICULUM_MAPPING_APPROVED' : 'CURRICULUM_MAPPING_REJECTED', req.params.mappingId, {
        decision,
        reason: decision === 'REJECT' ? reason : undefined,
        isCurrent: 'isCurrent' in result ? result.isCurrent : undefined,
      });
      return res.json({ success: true, result });
    } catch (error) {
      return sendServiceError(res, error);
    }
  }
);
