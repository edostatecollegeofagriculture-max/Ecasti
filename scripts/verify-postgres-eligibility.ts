import { neonPool } from "../server/neon";
import { db } from "../server/db";
import {
  evaluateNdGraduationEligibility,
  evaluateNdGraduationEligibilityFromPostgres,
} from "../server/academicProgressionService";
import { writeFileSync } from "fs";

async function main() {
  console.log("=== POSTGRES ELIGIBILITY VERIFICATION ===\n");

  // Load persistent state if not already initialized
  try {
    await (db as any).initializePersistentStore?.();
  } catch (e: any) {
    console.log(`initializePersistentStore skipped: ${e.message}`);
  }
  const state = db.getState();
  console.log(`Loaded state: ${state.students.length} students, ${state.results.length} results\n`);

  const results: any[] = [];

  for (const student of state.students) {
    console.log(`--- ${student.id} (${student.programmeId}) ---`);

    let preview: any = null;
    let snapshot: any = null;

    try {
      preview = evaluateNdGraduationEligibility(state, student.id);
      console.log(`  Preview:  basis=${preview.eligibilityBasis} eligible=${preview.eligible} preliminary=${preview.preliminaryEligible} passed=${preview.passedCourseCount}/${preview.requiredCourseCount}`);
    } catch (e: any) {
      console.log(`  Preview:  ERROR ${e.message}`);
    }

    try {
      snapshot = await evaluateNdGraduationEligibilityFromPostgres(state, student.id);
      console.log(`  Snapshot: basis=${snapshot.eligibilityBasis} eligible=${snapshot.eligible} passed=${snapshot.passedCourseCount}/${snapshot.requiredCourseCount} stage=${snapshot.currentStage} status=${snapshot.progressionStatus}`);
    } catch (e: any) {
      console.log(`  Snapshot: ERROR ${e.message}`);
    }

    const agreedOnCounts = preview && snapshot &&
      preview.passedCourseCount === snapshot.passedCourseCount &&
      preview.outstandingCourseCount === snapshot.outstandingCourseCount;

    results.push({
      studentId: student.id,
      preview: preview ? { basis: preview.eligibilityBasis, passed: preview.passedCourseCount, required: preview.requiredCourseCount, eligible: preview.eligible } : null,
      snapshot: snapshot ? { basis: snapshot.eligibilityBasis, passed: snapshot.passedCourseCount, required: snapshot.requiredCourseCount, eligible: snapshot.eligible, stage: snapshot.currentStage } : null,
      agreedOnCounts,
    });
  }

  const report = {
    mode: "POSTGRES_ELIGIBILITY_VERIFY",
    generatedAt: new Date().toISOString(),
    database: "ecasti_local",
    students: results,
    summary: {
      total: results.length,
      agreed: results.filter((r) => r.agreedOnCounts).length,
      disagreed: results.filter((r) => !r.agreedOnCounts).length,
      allSnapshotVerified: results.every((r) => r.snapshot?.basis === "SNAPSHOT_VERIFIED"),
    },
    safety: { sourceJsonModified: false, stagingTouched: false },
  };

  writeFileSync("./EDOCASTI_Postgres_Eligibility_Report.json", JSON.stringify(report, null, 2));
  console.log(`\nReport: ./EDOCASTI_Postgres_Eligibility_Report.json`);
  console.log(`Agreed: ${report.summary.agreed}/${report.summary.total}, All snapshot-verified: ${report.summary.allSnapshotVerified}`);

  await neonPool.end();
}
main().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
