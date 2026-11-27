import { db } from "../server/db";
import { neonPool } from "../server/neon";
await db.initializePersistentStore();
const state = db.getState();
console.log("=== RESULTS ===");
console.log(`Total: ${state.results.length}`);
for (const r of state.results) {
  console.log(`${r.id} | ${r.studentId} | ${r.courseId} | ${r.session} | ${r.semester} | total=${r.totalScore} | grade=${r.grade} | gp=${r.gradePoint} | status=${r.status}`);
}
console.log("\n=== STUDENTS CGPA ===");
for (const s of state.students) {
  console.log(`${s.id} | ${s.matricNumber} | cgpa=${s.cgpa} | credits=${s.totalCreditsEarned}`);
}
await neonPool.end();
