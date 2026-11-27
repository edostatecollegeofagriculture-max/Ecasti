import { db } from "../server/db";
import { neonPool } from "../server/neon";

async function main() {
  await db.initializePersistentStore();
  const s = db.getState();
  console.log("=== LECTURER ALLOCATION DATA STATE ===\n");

  const lecturers = s.users.filter((u: any) => u.role === 'LECTURER');
  console.log(`Lecturers: ${lecturers.length}`);
  lecturers.forEach((l: any) => {
    console.log(`  ${l.id}: ${l.fullName} | dept=${l.departmentId || '(none)'} | active=${l.isActive}`);
  });

  const courses = s.courses || [];
  const assigned = courses.filter((c: any) => c.lecturerId);
  const unassigned = courses.filter((c: any) => !c.lecturerId);
  console.log(`\nCourses: ${courses.length}`);
  console.log(`  Assigned: ${assigned.length}`);
  console.log(`  Unassigned: ${unassigned.length}`);

  console.log("\n=== ASSIGNED COURSES (sample) ===");
  assigned.slice(0, 10).forEach((c: any) => {
    const lect = lecturers.find((l: any) => l.id === c.lecturerId);
    console.log(`  ${c.code} (${c.level}): ${c.title} -> ${lect?.fullName || c.lecturerName || '(unknown)'}`);
  });

  console.log("\n=== RESULTS LINKED TO COURSES ===");
  const results = s.results || [];
  const resultsWithLecturer = results.filter((r: any) => {
    const course = courses.find((c: any) => c.id === r.courseId);
    return course && course.lecturerId;
  });
  console.log(`  ${resultsWithLecturer.length} of ${results.length} results have a course with assigned lecturer`);

  await neonPool.end();
}
main().catch(e => { console.error("ERR:", e.message); process.exit(1); });
