import { db } from "../server/db";
import { neonPool } from "../server/neon";
import { readFileSync } from "fs";

async function main() {
  await db.initializePersistentStore();
  console.log("=== STATUS TRANSITIONS SMOKE TEST ===\n");

  const assertions: { name: string; passed: boolean; detail: string }[] = [];

  async function simulateHistory(studentId: string) {
    const currentResult = await neonPool.query(
      `SELECT current_stage, progression_status, current_session, extension_year, updated_at
       FROM student_academic_progression WHERE student_id = $1`,
      [studentId]
    );
    const historyResult = await neonPool.query(
      `SELECT id, history_sequence, from_stage, to_stage, from_status, to_status,
              academic_session, extension_year, decision_type, reason,
              decided_by, approved_by, created_at
       FROM academic_progression_history WHERE student_id = $1
       ORDER BY history_sequence ASC`,
      [studentId]
    );
    return { current: currentResult.rows[0], history: historyResult.rows };
  }

  const std1 = await simulateHistory("std-1");
  assertions.push({
    name: "std-1 history exists",
    passed: std1.history.length > 0,
    detail: `${std1.history.length} event(s), current=${std1.current?.current_stage}`,
  });
  assertions.push({
    name: "std-1 has INITIAL_RECORD (from_stage null)",
    passed: std1.history.some((h: any) => h.from_stage === null && h.to_stage === "ND_I"),
    detail: "INITIAL_RECORD present",
  });
  assertions.push({
    name: "std-1 current stage is EXTENSION_1",
    passed: std1.current?.current_stage === "EXTENSION_1",
    detail: `current_stage=${std1.current?.current_stage}`,
  });

  const std2 = await simulateHistory("std-2");
  assertions.push({
    name: "std-2 has promotion event (ND_I -> ND_II)",
    passed: std2.history.some((h: any) => h.from_stage === "ND_I" && h.to_stage === "ND_II"),
    detail: `${std2.history.length} event(s)`,
  });

  const graduated = await simulateHistory("std-1795623290388");
  assertions.push({
    name: "Graduated student has GRADUATED event",
    passed: graduated.history.some((h: any) => h.to_stage === "GRADUATED"),
    detail: `${graduated.history.length} event(s), current=${graduated.current?.current_stage}`,
  });

  const ordered = std1.history.every((h: any, i: number) =>
    i === 0 || Number(h.history_sequence) > Number(std1.history[i - 1].history_sequence)
  );
  assertions.push({
    name: "History ordered by history_sequence",
    passed: ordered,
    detail: `sequences: ${std1.history.map((h: any) => h.history_sequence).join(", ")}`,
  });

  const state = db.getState();
  let allHaveCurrent = true;
  for (const student of state.students) {
    const cur = await neonPool.query(
      `SELECT current_stage FROM student_academic_progression WHERE student_id = $1`,
      [student.id]
    );
    if (cur.rows.length === 0) allHaveCurrent = false;
  }
  assertions.push({
    name: "Every student has current_stage row",
    passed: allHaveCurrent,
    detail: `${state.students.length} students`,
  });

  const router = readFileSync("./server/academicProgressionApiRouter.ts", "utf8");
  assertions.push({
    name: "History endpoint in academicProgressionApiRouter.ts",
    passed: router.includes("/students/:studentId/history"),
    detail: "Route registered",
  });
  assertions.push({
    name: "Endpoint queries academic_progression_history",
    passed: router.includes("academic_progression_history"),
    detail: "Table reference",
  });
  assertions.push({
    name: "Endpoint queries student_academic_progression",
    passed: router.includes("student_academic_progression"),
    detail: "Current stage table reference",
  });

  const apiTs = readFileSync("./src/services/api.ts", "utf8");
  assertions.push({
    name: "Frontend getProgressionHistory present",
    passed: apiTs.includes("getProgressionHistory"),
    detail: "api.ts method",
  });

  let pass = 0, fail = 0;
  for (const a of assertions) {
    console.log(`${a.passed ? "PASS" : "FAIL"}: ${a.name}`);
    console.log(`   ${a.detail}`);
    if (a.passed) pass++; else fail++;
  }
  console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
  console.log(fail === 0 ? "STATUS TRANSITIONS VERIFIED" : "STATUS TRANSITIONS HAVE GAPS");

  await neonPool.end();
  if (fail > 0) process.exit(1);
}
main().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
