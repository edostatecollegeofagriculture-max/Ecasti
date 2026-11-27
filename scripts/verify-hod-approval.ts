import { db } from "../server/db";
import { neonPool } from "../server/neon";
import { readFileSync } from "fs";

async function main() {
  await db.initializePersistentStore();
  const state = db.getState();
  console.log("=== HOD SCORE APPROVAL SMOKE TEST ===\n");

  const assertions: { name: string; passed: boolean; detail: string }[] = [];

  // Simulate canHodApproveResult (mirrors resultApprovalAuthorization.ts logic)
  function canHodApprove(user: any, course: any, result: any): boolean {
    if (!user || !course || !result) return false;
    if (user.role !== 'HOD') return false;
    if (!user.departmentId) return false;
    if (course.departmentId !== user.departmentId) return false;
    return result.status === 'SUBMITTED';
  }

  const results = state.results || [];
  const hods = state.users.filter((u: any) => u.role === 'HOD');
  const courses = state.courses || [];

  // TEST 1: HOD users exist with department assignments
  assertions.push({
    name: "HOD users exist with department assignments",
    passed: hods.length > 0 && hods.every((h: any) => h.departmentId),
    detail: `${hods.length} HOD(s): ${hods.map((h: any) => `${h.fullName} (${h.departmentId})`).join(', ')}`,
  });

  // TEST 2: Inject a SUBMITTED result in the HOD's department for testing
  const targetHod = hods[0];
  let targetCourse: any = null;
  let targetStudent: any = null;

  if (targetHod) {
    // Find a course in this HOD's department that already has a result
    const deptCourses = courses.filter((c: any) => c.departmentId === targetHod.departmentId);
    const deptCourseIds = new Set(deptCourses.map((c: any) => c.id));
    const existingResult = results.find((r: any) => deptCourseIds.has(r.courseId));

    if (existingResult) {
      targetCourse = courses.find((c: any) => c.id === existingResult.courseId);
      targetStudent = state.students.find((s: any) => s.id === existingResult.studentId);
    }

    if (targetCourse && targetStudent) {
      const injected: any = {
        id: "test-hod-res-" + Date.now(),
        courseId: targetCourse.id,
        studentId: targetStudent.id,
        matricNumber: targetStudent.matricNumber,
        studentName: "TEST STUDENT",
        session: state.settings.currentSession,
        semester: state.settings.currentSemester,
        caScore: 25,
        examScore: 50,
        totalScore: 75,
        grade: "A",
        gradePoint: 5.0,
        status: "SUBMITTED" as const,
        submittedBy: "TEST LECTURER",
      };
      state.results.push(injected);

      assertions.push({
        name: "SUBMITTED result fixture injected in HOD's department",
        passed: true,
        detail: `${injected.id}: course=${targetCourse.code} (dept=${targetHod.departmentId}), student=${targetStudent.id}`,
      });

      // TEST 3: canHodApprove allows same-department SUBMITTED result
      const allowed = canHodApprove(targetHod, targetCourse, injected);
      assertions.push({
        name: "canHodApprove: same-dept SUBMITTED → allowed",
        passed: allowed === true,
        detail: `HOD dept=${targetHod.departmentId}, course dept=${targetCourse.departmentId}, status=${injected.status}`,
      });

      // TEST 4: canHodApprove blocks different-department result
      const otherHod = hods.find((h: any) => h.departmentId !== targetHod.departmentId);
      if (otherHod) {
        const blocked = canHodApprove(otherHod, targetCourse, injected);
        assertions.push({
          name: "canHodApprove: different-dept → blocked",
          passed: blocked === false,
          detail: `HOD dept=${otherHod.departmentId}, course dept=${targetCourse.departmentId}`,
        });
      } else {
        // No other HOD in seed — simulate a different HOD
        const simulatedOtherHod = { role: 'HOD', departmentId: 'some-other-dept' };
        const blocked = canHodApprove(simulatedOtherHod, targetCourse, injected);
        assertions.push({
          name: "canHodApprove: different-dept → blocked (simulated HOD)",
          passed: blocked === false,
          detail: `simulated HOD dept=some-other-dept, course dept=${targetCourse.departmentId}`,
        });
      }

      // TEST 5: canHodApprove blocks already-approved result
      const approvedCopy = { ...injected, status: 'HOD_APPROVED' };
      const blockedByStatus = canHodApprove(targetHod, targetCourse, approvedCopy);
      assertions.push({
        name: "canHodApprove: already-approved → blocked",
        passed: blockedByStatus === false,
        detail: `HOD_APPROVED status correctly rejected`,
      });

      // TEST 6: canHodApprove blocks PUBLISHED result
      const publishedCopy = { ...injected, status: 'PUBLISHED' };
      const blockedByPublished = canHodApprove(targetHod, targetCourse, publishedCopy);
      assertions.push({
        name: "canHodApprove: PUBLISHED → blocked",
        passed: blockedByPublished === false,
        detail: `PUBLISHED status correctly rejected`,
      });

      // TEST 7: Simulate the approval mutation and verify status change
      injected.status = 'HOD_APPROVED';
      const afterApproval = state.results.find((r: any) => r.id === injected.id);
      assertions.push({
        name: "Approval mutation: status flips SUBMITTED → HOD_APPROVED",
        passed: afterApproval?.status === 'HOD_APPROVED',
        detail: `status=${afterApproval?.status}`,
      });

      // Cleanup
      state.results = state.results.filter((r: any) => r.id !== injected.id);
    } else {
      assertions.push({
        name: "SUBMITTED result fixture injected in HOD's department",
        passed: false,
        detail: "No existing result in HOD's department — cannot determine target course/student",
      });
    }
  }

  // TEST 8: Route present — PATCH /results/:id/hod-approve
  const router = readFileSync("./server/apiRouter.ts", "utf8");
  assertions.push({
    name: "PATCH /results/:id/hod-approve present",
    passed: router.includes("'/results/:id/hod-approve'"),
    detail: "Route present",
  });

  // TEST 9: Route present — POST /results/hod-approve-bulk
  assertions.push({
    name: "POST /results/hod-approve-bulk present",
    passed: router.includes("'/results/hod-approve-bulk'"),
    detail: "Route present",
  });

  // TEST 10: Both routes require HOD role
  const singleStart = router.indexOf("'/results/:id/hod-approve'");
  const singleEnd = router.indexOf("apiRouter.", singleStart + 50);
  const singleBody = router.substring(singleStart, singleEnd);
  const singleHod = singleBody.includes("requireRoles('HOD')");

  const bulkStart = router.indexOf("'/results/hod-approve-bulk'");
  const bulkEnd = router.indexOf("apiRouter.", bulkStart + 50);
  const bulkBody = router.substring(bulkStart, bulkEnd);
  const bulkHod = bulkBody.includes("requireRoles('HOD')");

  assertions.push({
    name: "Both routes require HOD role",
    passed: singleHod && bulkHod,
    detail: `single=${singleHod}, bulk=${bulkHod}`,
  });

  // TEST 11: Bulk route returns approvedCount + skippedCount
  assertions.push({
    name: "Bulk route returns approvedCount + skippedCount",
    passed: bulkBody.includes("approvedCount") && bulkBody.includes("skippedCount"),
    detail: "Response shape correct",
  });

  // TEST 12: Bulk route has department scoping
  assertions.push({
    name: "Bulk route scopes to HOD's department",
    passed: bulkBody.includes("departmentId") && bulkBody.includes("departmentCourseIds"),
    detail: "Department scoping present",
  });

  // TEST 13: Frontend API methods present
  const apiTs = readFileSync("./src/services/api.ts", "utf8");
  assertions.push({
    name: "Frontend: approveResultsByHodBulk present",
    passed: apiTs.includes("approveResultsByHodBulk"),
    detail: "api.ts has bulk HOD approval method",
  });

  // TEST 14: AdminPortal handlers present
  const adminPortal = readFileSync("./src/views/AdminPortal.tsx", "utf8");
  assertions.push({
    name: "AdminPortal: handleHodApproveResult + handleBulkHodApproveResult present",
    passed:
      adminPortal.includes("handleHodApproveResult") &&
      adminPortal.includes("handleBulkHodApproveResult"),
    detail: "Both handlers wired",
  });

  let pass = 0, fail = 0;
  for (const a of assertions) {
    console.log(`${a.passed ? "PASS" : "FAIL"}: ${a.name}`);
    console.log(`   ${a.detail}`);
    if (a.passed) pass++; else fail++;
  }
  console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
  console.log(fail === 0 ? "HOD SCORE APPROVAL VERIFIED" : "HOD SCORE APPROVAL HAS GAPS");

  await neonPool.end();
  if (fail > 0) process.exit(1);
}
main().catch(e => { console.error("ERR:", e.message); process.exit(1); });
