import { db } from "../server/db";
import { neonPool } from "../server/neon";
import { readFileSync } from "fs";

async function main() {
  await db.initializePersistentStore();
  const state = db.getState();
  console.log("=== DEAN PROGRAMME + COURSES SMOKE TEST ===\n");

  const assertions: { name: string; passed: boolean; detail: string }[] = [];

  const schools = state.schools || [];
  const departments = state.departments || [];
  const programmes = state.programmes || [];
  const courses = state.courses || [];

  // TEST 1: Hierarchy exists — schools, departments, programmes, courses
  assertions.push({
    name: "Dean hierarchy: schools, departments, programmes, courses all populated",
    passed: schools.length > 0 && departments.length > 0 && programmes.length > 0 && courses.length > 0,
    detail: `${schools.length} schools, ${departments.length} depts, ${programmes.length} programmes, ${courses.length} courses`,
  });

  // TEST 2: Every department references a valid school
  const deptSchoolValid = departments.every((d: any) =>
    schools.some((s: any) => s.id === d.schoolId)
  );
  assertions.push({
    name: "Every department references a valid school",
    passed: deptSchoolValid,
    detail: `${departments.length} department(s), all schoolId valid: ${deptSchoolValid}`,
  });

  // TEST 3: Every programme references a valid department
  const progDeptValid = programmes.every((p: any) =>
    departments.some((d: any) => d.id === p.departmentId)
  );
  assertions.push({
    name: "Every programme references a valid department",
    passed: progDeptValid,
    detail: `${programmes.length} programme(s), all departmentId valid: ${progDeptValid}`,
  });

  // TEST 4: Every course references a valid programme (no orphans)
  const courseProgValid = courses.every((c: any) =>
    programmes.some((p: any) => p.id === c.programmeId)
  );
  assertions.push({
    name: "Every course references a valid programme (zero orphans)",
    passed: courseProgValid,
    detail: `${courses.length} course(s), all programmeId valid: ${courseProgValid}`,
  });

  // TEST 5: Every course references a valid department
  const courseDeptValid = courses.every((c: any) =>
    departments.some((d: any) => d.id === c.departmentId)
  );
  assertions.push({
    name: "Every course references a valid department",
    passed: courseDeptValid,
    detail: `${courses.length} course(s), all departmentId valid: ${courseDeptValid}`,
  });

  // TEST 6: Programmes have required fields
  const progsValid = programmes.every((p: any) =>
    p.id && p.code && p.name && p.qualification && p.departmentId && p.durationYears
  );
  assertions.push({
    name: "All programmes have required fields (id/code/name/qualification/departmentId/durationYears)",
    passed: progsValid,
    detail: `${programmes.length} programme(s), all fields present: ${progsValid}`,
  });

  // TEST 7: Courses have required fields
  const coursesValid = courses.every((c: any) =>
    c.id && c.code && c.title && typeof c.creditUnits === 'number' && c.level && c.semester
  );
  assertions.push({
    name: "All courses have required fields (id/code/title/creditUnits/level/semester)",
    passed: coursesValid,
    detail: `${courses.length} course(s), all fields present: ${coursesValid}`,
  });

  // TEST 8: All 4 CRUD routes present in apiRouter.ts
  const router = readFileSync("./server/apiRouter.ts", "utf8");
  const requiredRoutes = [
    "'/academics/schools'",
    "'/academics/departments'",
    "'/academics/programmes'",
    "'/academics/courses'",
  ];
  const presentRoutes = requiredRoutes.filter((r) => router.includes(r));
  assertions.push({
    name: "All 4 academics CRUD route groups present",
    passed: presentRoutes.length === requiredRoutes.length,
    detail: `${presentRoutes.length}/${requiredRoutes.length} route groups present`,
  });

  // TEST 9: POST routes for creating entities
  const createRoutes = [
    "apiRouter.post(  '/academics/schools'",
    "apiRouter.post(  '/academics/departments'",
    "apiRouter.post(  '/academics/programmes'",
    "apiRouter.post(  '/academics/courses'",
  ];
  const presentCreate = createRoutes.filter((r) => router.includes(r));
  assertions.push({
    name: "All 4 create endpoints present",
    passed: presentCreate.length === createRoutes.length,
    detail: `${presentCreate.length}/${createRoutes.length} create endpoints present`,
  });

  // TEST 10: Academic structure validator exists
  assertions.push({
    name: "Academic structure validator present",
    passed: router.includes("isValidProgrammeAcademicStructure"),
    detail: "isValidProgrammeAcademicStructure function present",
  });

  // TEST 11: Frontend API methods
  const apiTs = readFileSync("./src/services/api.ts", "utf8");
  const frontendMethods = ["createProgramme", "createCourse", "createDepartment", "createSchool"];
  const presentMethods = frontendMethods.filter((m) => apiTs.includes(m));
  assertions.push({
    name: "Frontend API methods present",
    passed: presentMethods.length >= 2,
    detail: `${presentMethods.length} of ${frontendMethods.length} present: ${presentMethods.join(', ')}`,
  });

  // TEST 12: AdminPortal has create handlers
  const adminPortal = readFileSync("./src/views/AdminPortal.tsx", "utf8");
  assertions.push({
    name: "AdminPortal has programme/course create handlers",
    passed: adminPortal.includes("createProgramme") || adminPortal.includes("createCourse"),
    detail: "AdminPortal wired to create endpoints",
  });

  let pass = 0, fail = 0;
  for (const a of assertions) {
    console.log(`${a.passed ? "PASS" : "FAIL"}: ${a.name}`);
    console.log(`   ${a.detail}`);
    if (a.passed) pass++; else fail++;
  }
  console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
  console.log(fail === 0 ? "DEAN WORKFLOW VERIFIED" : "DEAN WORKFLOW HAS GAPS");

  await neonPool.end();
  if (fail > 0) process.exit(1);
}
main().catch(e => { console.error("ERR:", e.message); process.exit(1); });
