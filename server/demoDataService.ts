import { db, type DatabaseState } from './db';

const STAGING_SERVICE_ID = 'srv-dc2cgr142hec73feeqg0';
const MANIFEST_KEY = 'demoSeedManifest';

type Collection = 'schools' | 'departments' | 'programmes' | 'courses' | 'students' | 'registrations' | 'results' | 'users';
type Change = { collection: Collection; id: string; before: any | null; after: any };
type Manifest = { version: 1; createdAt: string; changes: Change[] };

function assertStagingOnly() {
  if (process.env.EDOCASTI_STAGING_DEMO_ONLY !== 'true' || process.env.RENDER_SERVICE_ID !== STAGING_SERVICE_ID) {
    throw new Error('Demo data controls are available only on the isolated EDOCASTI staging service.');
  }
}

function snapshot(value: unknown) {
  return JSON.stringify(value);
}

export function getDemoSeedStatus() {
  assertStagingOnly();
  const manifest = (db.getState() as DatabaseState & { [MANIFEST_KEY]?: Manifest })[MANIFEST_KEY];
  return { success: true, seeded: Boolean(manifest), createdAt: manifest?.createdAt ?? null, recordCount: manifest?.changes.length ?? 0 };
}

export function seedDemoAcademicData(actor: { id: string; email: string }) {
  assertStagingOnly();
  const state = db.getState() as DatabaseState & { [MANIFEST_KEY]?: Manifest };
  if (state[MANIFEST_KEY]) throw new Error('Demo data is already seeded. Unseed it before running Seed again.');

  const required = {
    hod: state.users.find((u) => u.id === 'usr-hod-agric' && u.role === 'HOD'),
    lecturer: state.users.find((u) => u.id === 'usr-lecturer-agric' && u.role === 'LECTURER'),
    student: state.users.find((u) => u.id === 'usr-student-1' && u.role === 'STUDENT'),
    examOfficer: state.users.find((u) => u.id === 'usr-examofficer' && u.role === 'EXAM_OFFICER'),
  };
  if (Object.values(required).some((user) => !user)) {
    throw new Error('Required staging demo accounts are missing. Restore the standard HOD, Lecturer, Student and Exam Officer demo accounts first.');
  }
  if (required.hod!.departmentId !== 'dept-agric' || required.lecturer!.departmentId !== 'dept-agric') {
    throw new Error('The HOD and Lecturer demo accounts are not linked to the expected Agriculture department. No records were changed.');
  }

  const ids = ['sch-agric', 'dept-agric', 'demo-e2e-programme-agric', 'demo-e2e-course-agric', 'demo-e2e-student-agric', 'demo-e2e-registration-agric', 'demo-e2e-result-agric'];
  const existingIds = [
    ...state.schools, ...state.departments, ...state.programmes, ...state.courses,
    ...state.students, ...state.registrations, ...state.results,
  ].map((record: any) => record.id);
  if (ids.some((id) => existingIds.includes(id))) throw new Error('A demo seed identifier already exists without a matching seed manifest. Refusing to overwrite existing data.');

  const changes: Change[] = [];
  const add = (collection: Collection, record: any) => {
    (state[collection] as any[]).push(record);
    changes.push({ collection, id: record.id, before: null, after: JSON.parse(JSON.stringify(record)) });
  };
  const now = new Date().toISOString();
  const school = { id: 'sch-agric', code: 'E2E-AGRIC', name: '[DEMO] School of Agriculture', description: 'Automated staging test data only.' };
  const department = { id: 'dept-agric', schoolId: school.id, code: 'E2E-AGRIC', name: '[DEMO] Agriculture Department', hodId: required.hod!.id };
  const programme = { id: 'demo-e2e-programme-agric', departmentId: department.id, code: 'E2E-NDAG', name: '[DEMO] National Diploma in Agriculture', qualification: 'ND' as const, durationYears: 2, description: 'Automated staging workflow test programme.', requirements: [] };
  const course = { id: 'demo-e2e-course-agric', departmentId: department.id, programmeId: programme.id, code: 'E2E-AGR101', title: '[DEMO] Introduction to Agriculture', creditUnits: 2, level: 'ND I', semester: 'First Semester' as const, lecturerId: required.lecturer!.id, lecturerName: required.lecturer!.fullName, isCompulsory: true };
  const student = { id: 'demo-e2e-student-agric', matricNumber: 'E2E/ND/2026/001', userId: required.student!.id, programmeId: programme.id, departmentId: department.id, schoolId: school.id, level: 'ND I', sessionAdmitted: state.settings.currentSession || '2026/2027', academicStatus: 'Good Standing' as const, gender: 'Not specified', dob: '2000-01-01', emergencyContact: 'Staging demo only', nextOfKin: 'Staging demo only', cgpa: 0, totalCreditsEarned: 0 };
  const registration = { id: 'demo-e2e-registration-agric', studentId: student.id, session: state.settings.currentSession || '2026/2027', semester: 'First Semester', level: 'ND I', courseIds: [course.id], totalCredits: 2, status: 'SUBMITTED' as const, createdAt: now };
  const result = { id: 'demo-e2e-result-agric', courseId: course.id, studentId: student.id, matricNumber: student.matricNumber, studentName: required.student!.fullName, session: registration.session, semester: registration.semester, caScore: 24, examScore: 56, totalScore: 80, grade: 'A', gradePoint: 5, status: 'SUBMITTED' as const, submittedBy: required.lecturer!.id };

  add('schools', school);
  add('departments', department);
  add('programmes', programme);
  add('courses', course);
  add('students', student);
  add('registrations', registration);
  add('results', result);

  const examOfficerBefore = JSON.parse(JSON.stringify(required.examOfficer));
  required.examOfficer.departmentId = department.id;
  required.examOfficer.schoolId = school.id;
  changes.push({ collection: 'users', id: required.examOfficer.id, before: examOfficerBefore, after: JSON.parse(JSON.stringify(required.examOfficer)) });

  state[MANIFEST_KEY] = { version: 1, createdAt: now, changes };
  db.saveState();
  db.logAudit({ userId: actor.id, userEmail: actor.email, action: 'STAGING_DEMO_DATA_SEEDED', resource: 'STAGING_DEMO_DATA', details: { recordCount: changes.length, ids: changes.map((change) => change.id) } });
  return { success: true, message: 'Staging demo academic workflow data created.', recordCount: changes.length };
}

export function unseedDemoAcademicData(actor: { id: string; email: string }) {
  assertStagingOnly();
  const state = db.getState() as DatabaseState & { [MANIFEST_KEY]?: Manifest };
  const manifest = state[MANIFEST_KEY];
  if (!manifest) throw new Error('No tracked demo data is currently seeded.');

  const conflicts = manifest.changes.filter((change) => {
    const current = (state[change.collection] as any[]).find((record) => record.id === change.id);
    return !current || snapshot(current) !== snapshot(change.after);
  });
  if (conflicts.length) {
    throw new Error('Unseed stopped safely: one or more seeded records have been edited or removed. No records were deleted. Review the demo records before trying again.');
  }

  // All records must still exactly match their seed-time snapshots before any removal.
  for (const change of [...manifest.changes].reverse()) {
    const records = state[change.collection] as any[];
    const index = records.findIndex((record) => record.id === change.id);
    if (change.before === null) records.splice(index, 1);
    else records[index] = change.before;
  }
  delete state[MANIFEST_KEY];
  db.saveState();
  db.logAudit({ userId: actor.id, userEmail: actor.email, action: 'STAGING_DEMO_DATA_UNSEEDED', resource: 'STAGING_DEMO_DATA', details: { recordCount: manifest.changes.length, ids: manifest.changes.map((change) => change.id) } });
  return { success: true, message: 'Tracked staging demo data removed; pre-existing account settings restored.', recordCount: manifest.changes.length };
}
