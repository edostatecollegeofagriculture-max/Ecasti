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
  const state = db.getState() as DatabaseState & { [MANIFEST_KEY]?: Manifest };
  const manifest = state[MANIFEST_KEY];
  const conflicts = (manifest?.changes ?? []).flatMap((change) => {
    const current = (state[change.collection] as any[]).find((record) => record.id === change.id);
    if (!current) return [{ collection: change.collection, id: change.id, issue: 'missing', changedFields: [] as string[] }];
    if (snapshot(current) === snapshot(change.after)) return [];
    const keys = new Set([...Object.keys(change.after ?? {}), ...Object.keys(current ?? {})]);
    const changedFields = [...keys].filter((key) => snapshot(current[key]) !== snapshot(change.after[key])).sort();
    return [{ collection: change.collection, id: change.id, issue: 'changed', changedFields }];
  });
  return {
    success: true,
    seeded: Boolean(manifest),
    createdAt: manifest?.createdAt ?? null,
    recordCount: manifest?.changes.length ?? 0,
    conflicts,
  };
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

  const courseIds = Array.from({ length: 8 }, (_, index) => index === 0 ? 'demo-e2e-course-agric' : `demo-e2e-course-agric-${String(index + 1).padStart(2, '0')}`);
  const ids = ['sch-agric', 'dept-agric', 'demo-e2e-programme-agric', ...courseIds, 'demo-e2e-student-agric', 'demo-e2e-registration-agric', 'demo-e2e-result-agric'];
  const preservedStudent = state.students.find((record) => record.id === 'demo-e2e-student-agric');
  if (preservedStudent && preservedStudent.userId !== required.student!.id) {
    throw new Error('The existing demo student record is linked to a different account. Refusing to overwrite it.');
  }
  const existingIds = [
    ...state.schools, ...state.departments, ...state.programmes, ...state.courses,
    ...state.students.filter((record) => record.id !== 'demo-e2e-student-agric'), ...state.registrations, ...state.results,
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
  const courseSpecs: Array<{ code: string; title: string; creditUnits: number }> = [
    { code: 'E2E-AGR101', title: '[DEMO] Introduction to Agriculture', creditUnits: 2 },
    { code: 'E2E-AGR103', title: '[DEMO] Principles of Crop Production', creditUnits: 2 },
    { code: 'E2E-AGR105', title: '[DEMO] Principles of Animal Production', creditUnits: 2 },
    { code: 'E2E-AGR107', title: '[DEMO] Soil Science Fundamentals', creditUnits: 2 },
    { code: 'E2E-AGR109', title: '[DEMO] Agricultural Economics', creditUnits: 2 },
    { code: 'E2E-AGR111', title: '[DEMO] Farm Power and Machinery', creditUnits: 2 },
    { code: 'E2E-AGR113', title: '[DEMO] Agricultural Extension', creditUnits: 2 },
    { code: 'E2E-AGR115', title: '[DEMO] Basic Farm Management', creditUnits: 2 },
  ];
  const courses = courseSpecs.map((spec, index) => ({
    id: courseIds[index], departmentId: department.id, programmeId: programme.id,
    code: spec.code, title: spec.title, creditUnits: spec.creditUnits,
    level: 'ND I', semester: 'First Semester' as const,
    lecturerId: required.lecturer!.id, lecturerName: required.lecturer!.fullName,
    isCompulsory: true,
  }));
  const course = courses[0];
  const student = preservedStudent ?? { id: 'demo-e2e-student-agric', matricNumber: 'E2E/ND/2026/001', userId: required.student!.id, programmeId: programme.id, departmentId: department.id, schoolId: school.id, level: 'ND I', sessionAdmitted: state.settings.currentSession || '2026/2027', academicStatus: 'Good Standing' as const, gender: 'Not specified', dob: '2000-01-01', emergencyContact: 'Staging demo only', nextOfKin: 'Staging demo only', cgpa: 0, totalCreditsEarned: 0 };
  const registration = { id: 'demo-e2e-registration-agric', studentId: student.id, session: state.settings.currentSession || '2026/2027', semester: 'First Semester', level: 'ND I', courseIds: courses.map((item) => item.id), totalCredits: courses.reduce((sum, item) => sum + item.creditUnits, 0), status: 'SUBMITTED' as const, createdAt: now };
  const result = { id: 'demo-e2e-result-agric', courseId: course.id, studentId: student.id, matricNumber: student.matricNumber, studentName: required.student!.fullName, session: registration.session, semester: registration.semester, caScore: 24, examScore: 56, totalScore: 80, grade: 'A', gradePoint: 5, status: 'SUBMITTED' as const, submittedBy: required.lecturer!.id };

  add('schools', school);
  add('departments', department);
  add('programmes', programme);
  courses.forEach((item) => add('courses', item));
  if (!preservedStudent) add('students', student);
  add('registrations', registration);
  add('results', result);

  const examOfficer = required.examOfficer!;
  const examOfficerBefore = JSON.parse(JSON.stringify(examOfficer));
  examOfficer.departmentId = department.id;
  examOfficer.schoolId = school.id;
  changes.push({ collection: 'users', id: examOfficer.id, before: examOfficerBefore, after: JSON.parse(JSON.stringify(examOfficer)) });

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

/**
 * Removes only unchanged demo records while retaining the one supported user edit:
 * photoUrl on the seeded demo student. Every other tracked record must still match
 * its original snapshot, and the student's remaining fields must be unchanged.
 */
export function preserveEditedDemoStudentAndClean(actor: { id: string; email: string }) {
  assertStagingOnly();
  const state = db.getState() as DatabaseState & { [MANIFEST_KEY]?: Manifest };
  const manifest = state[MANIFEST_KEY];
  if (!manifest) throw new Error('No tracked demo data is currently seeded.');

  const studentChange = manifest.changes.find((change) =>
    change.collection === 'students' && change.id === 'demo-e2e-student-agric'
  );
  if (!studentChange || studentChange.before !== null) {
    throw new Error('The tracked demo student is not in the expected seed-created state. No records were changed.');
  }

  const currentStudent = state.students.find((record) => record.id === studentChange.id);
  if (!currentStudent || currentStudent.userId !== 'usr-student-1') {
    throw new Error('The demo student record is missing or linked to an unexpected account. No records were changed.');
  }

  const originalStudent = studentChange.after;
  const currentWithoutPhoto = { ...currentStudent } as Record<string, unknown>;
  const originalWithoutPhoto = { ...originalStudent } as Record<string, unknown>;
  delete currentWithoutPhoto.photoUrl;
  delete originalWithoutPhoto.photoUrl;
  if (snapshot(currentWithoutPhoto) !== snapshot(originalWithoutPhoto)) {
    throw new Error('The demo student has changes beyond photoUrl. No records were changed.');
  }

  const otherConflicts = manifest.changes.filter((change) => change !== studentChange).filter((change) => {
    const current = (state[change.collection] as any[]).find((record) => record.id === change.id);
    return !current || snapshot(current) !== snapshot(change.after);
  });
  if (otherConflicts.length) {
    throw new Error('Other seeded records have also changed or are missing. No records were changed; review the conflict report first.');
  }

  // Validation is complete before the first mutation. Keep the student record
  // byte-for-byte intact, remove only unchanged demo-created records, and restore
  // the pre-seed Exam Officer account fields.
  for (const change of [...manifest.changes].reverse()) {
    if (change === studentChange) continue;
    const records = state[change.collection] as any[];
    const index = records.findIndex((record) => record.id === change.id);
    if (change.before === null) records.splice(index, 1);
    else records[index] = change.before;
  }
  delete state[MANIFEST_KEY];
  db.saveState();
  db.logAudit({
    userId: actor.id,
    userEmail: actor.email,
    action: 'STAGING_DEMO_DATA_CLEANED_PRESERVING_STUDENT',
    resource: 'STAGING_DEMO_DATA',
    details: { preservedStudentId: studentChange.id, preservedField: 'photoUrl', removedChangeCount: manifest.changes.length - 1 },
  });
  return {
    success: true,
    message: 'Unchanged demo records were removed. The edited student record and photo were preserved; Seed can now recreate the academic workflow around that student.',
    recordCount: manifest.changes.length - 1,
    preservedStudentId: studentChange.id,
  };
}
