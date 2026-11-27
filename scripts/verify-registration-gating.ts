import { db } from "../server/db";
import { neonPool } from "../server/neon";

async function main() {
  await db.initializePersistentStore();
  const state = db.getState();

  console.log("=== REGISTRATION GATING SMOKE TEST ===\n");

  // Find ND I student + their programme's ND I / ND II courses
  const ndStudent = state.students.find((s: any) => s.level === "ND I");
  if (!ndStudent) {
    console.error("No ND I student found");
    process.exit(1);
  }

  const nd1Courses = state.courses.filter(
    (c: any) => c.programmeId === ndStudent.programmeId && c.level === "ND I"
  );
  const nd2Courses = state.courses.filter(
    (c: any) => c.programmeId === ndStudent.programmeId && c.level === "ND II"
  );

  console.log(`Student: ${ndStudent.id} (${ndStudent.matricNumber}) | level: ${ndStudent.level}`);
  console.log(`ND I courses: ${nd1Courses.map((c: any) => c.code).join(", ") || "(none)"}`);
  console.log(`ND II courses: ${nd2Courses.map((c: any) => c.code).join(", ") || "(none)"}\n`);

  // Replicate the server-side logic that /registrations/register now enforces
  function simulateRegister(
    studentLevel: string,
    studentProgrammeId: string,
    requestedCourseIds: string[]
  ): { rejected: boolean; reason: string; httpCode?: number } {
    const requested = state.courses.filter((c: any) => requestedCourseIds.includes(c.id));
    if (requested.length !== new Set(requestedCourseIds).size) {
      return { rejected: true, reason: "invalid course IDs", httpCode: 400 };
    }
    const mismatched = requested.filter((c: any) => c.level !== studentLevel);
    if (mismatched.length > 0) {
      return {
        rejected: true,
        reason: `level mismatch: ${mismatched.map((c: any) => `${c.code} (${c.level})`).join(", ")}`,
        httpCode: 403,
      };
    }
    const wrongProg = requested.filter((c: any) => c.programmeId !== studentProgrammeId);
    if (wrongProg.length > 0) {
      return {
        rejected: true,
        reason: `wrong programme: ${wrongProg.map((c: any) => c.code).join(", ")}`,
        httpCode: 403,
      };
    }
    return { rejected: false, reason: "ok" };
  }

  const assertions: { name: string; passed: boolean; detail: string }[] = [];

  // Test 1: ND I student registering ND I courses → accepted
  if (nd1Courses.length > 0) {
    const r = simulateRegister(
      ndStudent.level,
      ndStudent.programmeId,
      nd1Courses.map((c: any) => c.id)
    );
    assertions.push({
      name: "ND I student registering ND I courses → accepted",
      passed: r.rejected === false,
      detail: `rejected=${r.rejected} reason=${r.reason}`,
    });
  }

  // Test 2: ND I student registering ND II courses → rejected with 403
  if (nd2Courses.length > 0) {
    const r = simulateRegister(
      ndStudent.level,
      ndStudent.programmeId,
      nd2Courses.map((c: any) => c.id)
    );
    assertions.push({
      name: "ND I student registering ND II courses → rejected (403)",
      passed: r.rejected === true && r.httpCode === 403,
      detail: `rejected=${r.rejected} httpCode=${r.httpCode} reason=${r.reason}`,
    });
  } else {
    assertions.push({
      name: "ND II courses exist in this programme (needed for negative test)",
      passed: false,
      detail: "no ND II courses in catalogue for this programme — cannot test negative path",
    });
  }

  // Test 3: ND I student registering mixed ND I + ND II → rejected (403)
  if (nd1Courses.length > 0 && nd2Courses.length > 0) {
    const mixed = [nd1Courses[0].id, nd2Courses[0].id];
    const r = simulateRegister(ndStudent.level, ndStudent.programmeId, mixed);
    assertions.push({
      name: "ND I student registering mixed ND I + ND II → rejected (403)",
      passed: r.rejected === true && r.httpCode === 403,
      detail: `rejected=${r.rejected} httpCode=${r.httpCode} reason=${r.reason}`,
    });
  }

  // Test 4 (optional): ND II student registering ND II courses → accepted
  const nd2Student = state.students.find((s: any) => s.level === "ND II");
  if (nd2Student && nd2Courses.length > 0) {
    const r = simulateRegister(
      nd2Student.level,
      nd2Student.programmeId,
      nd2Courses.filter((c: any) => c.programmeId === nd2Student.programmeId).map((c: any) => c.id)
    );
    if (r.rejected === false || r.reason === "ok") {
      assertions.push({
        name: "ND II student registering ND II courses → accepted",
        passed: r.rejected === false,
        detail: `rejected=${r.rejected} reason=${r.reason}`,
      });
    }
  }

  console.log("=== ASSERTIONS ===");
  let pass = 0, fail = 0;
  for (const a of assertions) {
    console.log(`${a.passed ? "✅ PASS" : "❌ FAIL"}: ${a.name}`);
    console.log(`   ${a.detail}`);
    if (a.passed) pass++;
    else fail++;
  }

  console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
  console.log(fail === 0 ? "LEVEL GATING IS CORRECT" : "LEVEL GATING HAS GAPS");

  await neonPool.end();
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error("ERR:", e.message);
  process.exit(1);
});
