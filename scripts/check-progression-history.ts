import { db } from "../server/db";
import { neonPool } from "../server/neon";

async function main() {
  await db.initializePersistentStore();
  const s = db.getState();
  console.log("=== PROGRESSION DATA STATE ===\n");

  console.log("=== STUDENTS ===");
  s.students.forEach((st: any) => {
    console.log(`  ${st.id}: ${st.matricNumber} | level=${st.level}`);
  });

  // Try to query the progression tables directly
  try {
    const stageRows = await neonPool.query(
      "SELECT student_id, current_stage FROM student_academic_progression ORDER BY student_id"
    );
    console.log("\n=== student_academic_progression ===");
    stageRows.rows.forEach((r: any) => {
      console.log(`  ${r.student_id}: current_stage=${r.current_stage}`);
    });
  } catch (e: any) {
    console.log("\nstudent_academic_progression query failed:", e.message);
  }

  try {
    const historyRows = await neonPool.query(
      "SELECT student_id, from_stage, to_stage, event_type, effective_date FROM student_academic_progression_history ORDER BY student_id, effective_date"
    );
    console.log("\n=== student_academic_progression_history ===");
    historyRows.rows.forEach((r: any) => {
      console.log(`  ${r.student_id}: ${r.from_stage || '(null)'} -> ${r.to_stage} | event=${r.event_type} | date=${r.effective_date}`);
    });
  } catch (e: any) {
    console.log("\nhistory query failed:", e.message);
  }

  await neonPool.end();
}
main().catch(e => { console.error("ERR:", e.message); process.exit(1); });
