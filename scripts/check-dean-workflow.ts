import { db } from "../server/db";
import { neonPool } from "../server/neon";

async function main() {
  await db.initializePersistentStore();
  const s = db.getState();
  console.log("=== DEAN WORKFLOW DATA STATE ===\n");

  const schools = s.schools || [];
  const departments = s.departments || [];
  const programmes = s.programmes || [];
  const courses = s.courses || [];

  console.log(`Schools:     ${schools.length}`);
  console.log(`Departments: ${departments.length}`);
  console.log(`Programmes:  ${programmes.length}`);
  console.log(`Courses:     ${courses.length}`);

  console.log("\n=== SCHOOLS ===");
  schools.forEach((sc: any) => console.log(`  ${sc.id}: ${sc.code} - ${sc.name}`));

  console.log("\n=== DEPARTMENTS ===");
  departments.forEach((d: any) => console.log(`  ${d.id}: ${d.code} - ${d.name} (school=${d.schoolId})`));

  console.log("\n=== PROGRAMMES ===");
  programmes.forEach((p: any) => {
    console.log(`  ${p.id}: ${p.code} - ${p.name} | qual=${p.qualification} | dept=${p.departmentId} | duration=${p.durationYears}y`);
  });

  // Programme -> course relationship check
  console.log("\n=== COURSE-PROGRAMME LINKAGE ===");
  const coursesWithProgramme = courses.filter((c: any) => c.programmeId);
  const coursesWithoutProgramme = courses.filter((c: any) => !c.programmeId);
  console.log(`  Courses with programmeId: ${coursesWithProgramme.length}`);
  console.log(`  Courses without programmeId: ${coursesWithoutProgramme.length}`);

  await neonPool.end();
}
main().catch(e => { console.error("ERR:", e.message); process.exit(1); });
