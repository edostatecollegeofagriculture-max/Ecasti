import { db } from "../server/db";
import { neonPool } from "../server/neon";
import { advanceStudentById } from "../server/academicProgressionAdvanceService";

async function main() {
  console.log("=== ADVANCE SMOKE TEST ===\n");
  await db.initializePersistentStore();

  const targetId = "std-1795622008157";
  const session = "2026/2027";

  const before = await neonPool.query(
    `SELECT current_stage, progression_status FROM student_academic_progression WHERE student_id = $1`,
    [targetId]
  );
  console.log("BEFORE:", before.rows[0]);

  const result = await advanceStudentById({
    studentId: targetId,
    academicSession: session,
    decidedBy: "usr-superadmin",
  });
  console.log("\nDECISION:", JSON.stringify(result.decision, null, 2));
  console.log("CLASSIFICATION:", JSON.stringify(result.classification, null, 2));

  const after = await neonPool.query(
    `SELECT current_stage, progression_status FROM student_academic_progression WHERE student_id = $1`,
    [targetId]
  );
  console.log("\nAFTER:", after.rows[0]);

  const history = await neonPool.query(
    `SELECT from_stage, to_stage, decision_type FROM academic_progression_history
      WHERE student_id = $1 ORDER BY history_sequence DESC LIMIT 2`,
    [targetId]
  );
  console.log("HISTORY (latest 2):", history.rows);

  const passed = after.rows[0]?.current_stage === "ND_II"
    && history.rows[0]?.decision_type === "SESSION_ROLLOVER";
  console.log(`\n${passed ? "PASS" : "FAIL"}: ${targetId} advanced ND_I -> ND_II with SESSION_ROLLOVER`);

  await neonPool.end();
  if (!passed) process.exit(1);
}
main().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
