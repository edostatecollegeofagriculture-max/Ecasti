import { neonPool } from "../server/neon";
import { readFileSync, writeFileSync } from "fs";

async function main() {
  console.log("=== PROGRESSION BASELINE VERIFICATION ===\n");

  const progressions = await neonPool.query(`
    SELECT student_id, programme_id, current_stage, progression_status,
           current_session, extension_year
      FROM student_academic_progression
     ORDER BY student_id
  `);

  const history = await neonPool.query(`
    SELECT student_id, from_stage, to_stage, from_status, to_status,
           decision_type, academic_session, extension_year
      FROM academic_progression_history
     ORDER BY history_sequence
  `);

  const reqCourses = await neonPool.query(`
    SELECT student_id, COUNT(*)::int AS n
      FROM student_academic_required_courses
     GROUP BY student_id ORDER BY student_id
  `);

  const mappings = await neonPool.query(`
    SELECT id, programme_id, cohort_session, status, is_current, approved_by
      FROM academic_curriculum_mappings ORDER BY id
  `);

  const assignments = await neonPool.query(`
    SELECT student_id, mapping_id, is_current
      FROM student_academic_curriculum_assignments
     ORDER BY student_id
  `);

  // Read JSON via fs (ESM-safe)
  const json = JSON.parse(readFileSync("./data/edocasti_db.json", "utf8"));

  // ── Assertions ──
  const assertions: { name: string; passed: boolean; detail?: string }[] = [];

  assertions.push({
    name: "All JSON students have progression rows",
    passed: json.students.every((s: any) =>
      progressions.rows.some((p: any) => p.student_id === s.id)
    ),
  });

  assertions.push({
    name: "Every student has INITIAL_RECORD in history",
    passed: json.students.every((s: any) =>
      history.rows.some(
        (h: any) => h.student_id === s.id && h.decision_type === "INITIAL_RECORD"
      )
    ),
  });

  // Stage must be a legal descendant of the student's current JSON level.
  // A student recorded at "ND I" in JSON may have advanced in Postgres
  // (ND_I → ND_II → EXTENSION_*), so we assert reachability, not equality.
  const stageOrder: Record<string, number> = {
    ND_I: 0, ND_II: 1, EXTENSION_1: 2, EXTENSION_2: 3, EXTENSION_3: 4, GRADUATED: 5,
  };
  const levelToStage: Record<string, string> = { "ND I": "ND_I", "ND II": "ND_II" };

  const stageChecks = json.students.map((s: any) => {
    const pg = progressions.rows.find((r: any) => r.student_id === s.id);
    const start = levelToStage[s.level];
    if (!pg || !start) return { id: s.id, ok: false, reason: "missing" };
    const ok = stageOrder[pg.current_stage] >= stageOrder[start];
    return { id: s.id, ok, jsonLevel: s.level, pgStage: pg.current_stage };
  });

  assertions.push({
    name: "Every student's Postgres stage is at or beyond their JSON level",
    passed: stageChecks.every((c: any) => c.ok),
    detail: stageChecks.map((c: any) =>
      `${c.id}: ${c.jsonLevel ?? "?"} → ${c.pgStage ?? "?"} ${c.ok ? "✅" : "❌"}`
    ).join("; "),
  });

  assertions.push({
    name: "Every current mapping is APPROVED",
    passed: mappings.rows.filter((m: any) => m.is_current).every(
      (m: any) => m.status === "APPROVED"
    ),
  });

  assertions.push({
    name: "Every student has a current curriculum assignment",
    passed: json.students.every((s: any) =>
      assignments.rows.some(
        (a: any) => a.student_id === s.id && a.is_current === true
      )
    ),
  });

  assertions.push({
    name: "Every progression stage has a matching latest history to_stage",
    passed: progressions.rows.every((p: any) => {
      const studentHistory = history.rows.filter((h: any) => h.student_id === p.student_id);
      if (studentHistory.length === 0) return false;
      const latest = studentHistory[studentHistory.length - 1];
      return latest.to_stage === p.current_stage;
    }),
  });

  // ── Print ──
  let passed = 0, failed = 0;
  console.log("=== ASSERTIONS ===");
  for (const a of assertions) {
    console.log(`${a.passed ? "✅ PASS" : "❌ FAIL"}: ${a.name}`);
    if (a.detail) console.log("   " + a.detail);
    if (a.passed) passed++; else failed++;
  }

  console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===`);

  const report = {
    mode: "PROGRESSION_BASELINE_VERIFY",
    generatedAt: new Date().toISOString(),
    database: "ecasti_local",
    rowCounts: {
      progressions: progressions.rowCount,
      history: history.rowCount,
      requiredCourses: reqCourses.rows.reduce((s: number, r: any) => s + r.n, 0),
      mappings: mappings.rowCount,
      assignments: assignments.rowCount,
    },
    progressionState: progressions.rows,
    historyTimeline: history.rows,
    assertions,
    summary: {
      passed, failed,
      status: failed === 0 ? "BASELINE_VALID" : "BASELINE_INVALID",
    },
    safety: { sourceJsonModified: false, stagingTouched: false },
  };

  writeFileSync(
    "./EDOCASTI_Progression_Baseline_Report.json",
    JSON.stringify(report, null, 2)
  );
  console.log("\nReport: ./EDOCASTI_Progression_Baseline_Report.json");

  await neonPool.end();
  if (failed > 0) process.exit(1);
}

main().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
