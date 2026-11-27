import { db } from "../server/db";
import { neonPool } from "../server/neon";

async function main() {
  await db.initializePersistentStore();
  const state = db.getState();

  console.log("=== BULK-APPROVE LEVEL GATE SMOKE TEST ===\n");

  const ndStudent = state.students.find((s: any) => s.level === "ND I");
  if (!ndStudent) { console.error("No ND I student found"); process.exit(1); }

  const nd1Course = state.courses.find((c: any) => c.programmeId === ndStudent.programmeId && c.level === "ND I");
  const nd2Course = state.courses.find((c: any) => c.programmeId === ndStudent.programmeId && c.level === "ND II");
  if (!nd1Course || !nd2Course) { console.error("Missing ND I or ND II course for programme"); process.exit(1); }

  console.log(`Student: ${ndStudent.id} (${ndStudent.matricNumber}) level: ${ndStudent.level}`);
  console.log(`ND I course: ${nd1Course.code} | ND II course: ${nd2Course.code}\n`);

  const ts = Date.now();
  const cleanRegId = `test-clean-${ts}`;
  const crossRegId = `test-cross-${ts}`;

  const cleanReg = {
    id: cleanRegId, studentId: ndStudent.id, session: state.settings.currentSession,
    semester: state.settings.currentSemester, level: ndStudent.level,
    courseIds: [nd1Course.id], totalCredits: nd1Course.creditUnits,
    status: "SUBMITTED" as const, createdAt: new Date().toISOString(),
  };
  const crossReg = {
    id: crossRegId, studentId: ndStudent.id, session: state.settings.currentSession,
    semester: state.settings.currentSemester, level: ndStudent.level,
    courseIds: [nd1Course.id, nd2Course.id], totalCredits: nd1Course.creditUnits + nd2Course.creditUnits,
    status: "SUBMITTED" as const, createdAt: new Date().toISOString(),
  };

  state.registrations.push(cleanReg, crossReg);
  db.saveState();

  // Simulate the patched bulk-approve logic
  const approved: string[] = [];
  const skipped: string[] = [];
  const skippedReasons: Array<{ registrationId: string; studentId: string; courses: string[] }> = [];

  for (const rid of [cleanRegId, crossRegId]) {
    const reg = state.registrations.find((r: any) => r.id === rid);
    if (!reg) continue;
    const student = state.students.find((st: any) => st.id === reg.studentId);
    const mismatched = student
      ? reg.courseIds.filter((cid: string) => {
          const course = state.courses.find((c: any) => c.id === cid);
          return course && course.level !== student.level;
        })
      : [];
    if (mismatched.length > 0) {
      skipped.push(rid);
      skippedReasons.push({ registrationId: reg.id, studentId: reg.studentId, courses: mismatched });
    } else {
      approved.push(rid);
    }
  }

  const assertions = [
    { name: "Clean ND I registration approved", passed: approved.includes(cleanRegId) },
    { name: "Cross-level registration skipped", passed: skipped.includes(crossRegId) },
    { name: "Exactly 1 approved", passed: approved.length === 1 },
    { name: "Exactly 1 skipped", passed: skipped.length === 1 },
    { name: "Skipped reasons recorded", passed: skippedReasons.length === 1 && skippedReasons[0].courses.includes(nd2Course.id) },
  ];

  console.log("=== ASSERTIONS ===");
  let pass = 0, fail = 0;
  for (const a of assertions) {
    console.log(`${a.passed ? "✅ PASS" : "❌ FAIL"}: ${a.name}`);
    if (a.passed) pass++; else fail++;
  }
  console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);

  // Cleanup
  state.registrations = state.registrations.filter((r: any) => r.id !== cleanRegId && r.id !== crossRegId);
  db.saveState();

  await neonPool.end();
  if (fail > 0) process.exit(1);
}
main().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
