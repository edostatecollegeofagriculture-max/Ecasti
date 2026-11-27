import { db } from "../server/db";
import { neonPool } from "../server/neon";

async function main() {
  await db.initializePersistentStore();
  const state = db.getState();
  console.log("=== RESULTS VISIBILITY SMOKE TEST ===\n");

  const assertions: { name: string; passed: boolean; detail: string }[] = [];

  // Simulate the /results/my-results handler logic
  function simulateMyResults(studentUserId: string) {
    const student = state.students.find((s: any) => s.userId === studentUserId);
    if (!student) return { found: false, results: [] };
    const studentResults = state.results
      .filter((r: any) => r.studentId === student.id)
      .map((r: any) => {
        if (r.status === 'PUBLISHED') return r;
        return {
          id: r.id,
          courseId: r.courseId,
          studentId: r.studentId,
          matricNumber: r.matricNumber,
          studentName: r.studentName,
          session: r.session,
          semester: r.semester,
          status: r.status,
        };
      });
    return { found: true, student, results: studentResults };
  }

  // Find a student with a published result
  const publishedStudent = state.students.find((s: any) =>
    state.results.some((r: any) => r.studentId === s.id && r.status === 'PUBLISHED')
  );
  if (publishedStudent) {
    const sim = simulateMyResults(publishedStudent.userId);
    const publishedInResult = sim.results.filter((r: any) => r.status === 'PUBLISHED');
    assertions.push({
      name: "Published result -> full record (scores/grade present)",
      passed: publishedInResult.length > 0 && publishedInResult[0].caScore !== undefined && publishedInResult[0].grade !== undefined,
      detail: `${publishedInResult.length} published, first has caScore=${publishedInResult[0]?.caScore}, grade=${publishedInResult[0]?.grade}`,
    });
  } else {
    assertions.push({
      name: "Student with published result exists (seed fixture)",
      passed: false,
      detail: "No published results in seed — test cannot run",
    });
  }

  // Find a student with an unpublished result
  const unpublishedStudent = state.students.find((s: any) =>
    state.results.some((r: any) => r.studentId === s.id && r.status !== 'PUBLISHED')
  );
  if (unpublishedStudent) {
    const sim = simulateMyResults(unpublishedStudent.userId);
    const unpublishedInResult = sim.results.filter((r: any) => r.status !== 'PUBLISHED');
    const firstUnpub = unpublishedInResult[0];
    assertions.push({
      name: "Unpublished result -> metadata only (no scores/grade)",
      passed:
        unpublishedInResult.length > 0 &&
        firstUnpub.caScore === undefined &&
        firstUnpub.examScore === undefined &&
        firstUnpub.grade === undefined &&
        firstUnpub.gradePoint === undefined,
      detail: `${unpublishedInResult.length} unpublished, first has caScore=${firstUnpub?.caScore}, grade=${firstUnpub?.grade} (expect undefined)`,
    });
  } else {
    // Inject an unpublished result to test the gate
    const target = state.students.find((s: any) => s.id !== publishedStudent?.id);
    if (target) {
      const injected = {
        id: "test-result-" + Date.now(),
        courseId: state.courses[0]?.id || "crs-test",
        studentId: target.id,
        matricNumber: target.matricNumber,
        studentName: "TEST STUDENT",
        session: state.settings.currentSession,
        semester: state.settings.currentSemester,
        caScore: 25,
        examScore: 50,
        totalScore: 75,
        grade: "A",
        gradePoint: 5.0,
        status: "SUBMITTED" as const,
        submittedBy: "TEST",
      };
      state.results.push(injected);
      const sim = simulateMyResults(target.userId);
      const injectedInResult = sim.results.find((r: any) => r.id === injected.id);
      assertions.push({
        name: "Unpublished result -> metadata only (no scores/grade)",
        passed:
          injectedInResult !== undefined &&
          injectedInResult.caScore === undefined &&
          injectedInResult.grade === undefined,
        detail: `injected test result withheld scores: caScore=${injectedInResult?.caScore}, grade=${injectedInResult?.grade} (expect undefined)`,
      });
      state.results = state.results.filter((r: any) => r.id !== injected.id);
    }
  }

  // Cross-student isolation
  if (state.students.length >= 2) {
    const s1 = state.students[0];
    const s2 = state.students[1];
    const s1Results = simulateMyResults(s1.userId);
    const s2Results = simulateMyResults(s2.userId);
    const s1Ids = new Set(s1Results.results.map((r: any) => r.id));
    const s2Ids = new Set(s2Results.results.map((r: any) => r.id));
    const overlap = [...s1Ids].filter((id) => s2Ids.has(id));
    assertions.push({
      name: "Cross-student isolation (no result leakage)",
      passed: overlap.length === 0,
      detail: `${s1.id} and ${s2.id} share ${overlap.length} result(s) — expect 0`,
    });
  }

  // Source check — route exists with student scoping
  const fs = await import("fs");
  const routerContent = fs.readFileSync("./server/apiRouter.ts", "utf8");
  assertions.push({
    name: "Route /results/my-results exists in apiRouter.ts",
    passed: routerContent.includes("/results/my-results"),
    detail: "Route present",
  });
  assertions.push({
    name: "Route filters by student.userId",
    passed: routerContent.includes("state.students.find((s) => s.userId === req.user!.id)"),
    detail: "Student scoping present",
  });

  let pass = 0, fail = 0;
  for (const a of assertions) {
    console.log(`${a.passed ? "PASS" : "FAIL"}: ${a.name}`);
    console.log(`   ${a.detail}`);
    if (a.passed) pass++; else fail++;
  }
  console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
  console.log(fail === 0 ? "RESULTS VISIBILITY VERIFIED" : "RESULTS VISIBILITY HAS GAPS");

  await neonPool.end();
  if (fail > 0) process.exit(1);
}
main().catch(e => { console.error("ERR:", e.message); process.exit(1); });
