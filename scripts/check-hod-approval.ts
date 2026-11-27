import { db } from "../server/db";
import { neonPool } from "../server/neon";

async function main() {
  await db.initializePersistentStore();
  const s = db.getState();
  console.log("=== HOD SCORE APPROVAL DATA STATE ===\n");

  const results = s.results || [];
  console.log(`Total results: ${results.length}`);

  const byStatus: Record<string, number> = {};
  results.forEach((r: any) => {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
  });
  console.log("\nResults by status:");
  Object.entries(byStatus).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });

  console.log("\n=== SAMPLE RESULTS ===");
  results.slice(0, 10).forEach((r: any) => {
    const course = s.courses.find((c: any) => c.id === r.courseId);
    const dept = course ? s.departments.find((d: any) => d.id === course.departmentId) : null;
    console.log(`  ${r.id}: student=${r.studentId} course=${course?.code || r.courseId} dept=${dept?.code || '?'} status=${r.status}`);
  });

  console.log("\n=== HOD USERS ===");
  const hods = s.users.filter((u: any) => u.role === 'HOD');
  hods.forEach((h: any) => {
    console.log(`  ${h.id}: ${h.fullName} | dept=${h.departmentId || '(none)'}`);
  });

  console.log("\n=== HOD-APPROVED RESULTS ===");
  const hodApproved = results.filter((r: any) => r.status === 'HOD_APPROVED');
  console.log(`  ${hodApproved.length} HOD_APPROVED result(s)`);

  await neonPool.end();
}
main().catch(e => { console.error("ERR:", e.message); process.exit(1); });
