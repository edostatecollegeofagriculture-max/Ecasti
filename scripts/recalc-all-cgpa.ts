import { db } from "../server/db";
import { neonPool } from "../server/neon";

function recalc(state: any, studentId: string) {
  const published = state.results.filter((r: any) => r.studentId === studentId && r.status === 'PUBLISHED');
  const student = state.students.find((s: any) => s.id === studentId);
  if (!student) return;
  if (published.length === 0) { student.cgpa = 0; student.totalCreditsEarned = 0; return; }
  let wp = 0, tu = 0, ec = 0;
  const orphans: string[] = [];
  for (const r of published) {
    const crs = state.courses.find((c: any) => c.id === r.courseId);
    if (!crs) { orphans.push(r.courseId); continue; }
    wp += r.gradePoint * crs.creditUnits;
    tu += crs.creditUnits;
    if (r.gradePoint > 0) ec += crs.creditUnits;
  }
  if (orphans.length > 0) {
    db.logAudit({
      action: 'CGPA_RECALC_ORPHANED_COURSES',
      resource: 'STUDENT',
      details: { studentId, orphanedCourseIds: orphans, publishedResultCount: published.length },
    });
  }
  if (tu > 0) {
    student.cgpa = Number((wp / tu).toFixed(2));
    student.totalCreditsEarned = ec;
  } else {
    student.cgpa = 0;
    student.totalCreditsEarned = 0;
  }
}

async function main() {
  console.log("=== CGPA RECALC SMOKE TEST ===\n");
  await db.initializePersistentStore();
  const state = db.getState();

  console.log("BEFORE:");
  for (const s of state.students) {
    console.log(`  ${s.id} | cgpa=${s.cgpa} | credits=${s.totalCreditsEarned}`);
  }

  for (const s of state.students) recalc(state, s.id);
  db.saveState();
  await db.flushPersistentWrites();

  await db.initializePersistentStore();
  const updated = db.getState();
  console.log("\nAFTER:");
  for (const s of updated.students) {
    console.log(`  ${s.id} | cgpa=${s.cgpa} | credits=${s.totalCreditsEarned}`);
  }

  await neonPool.end();
}
main().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
