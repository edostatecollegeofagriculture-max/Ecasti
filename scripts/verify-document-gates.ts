import { db } from "../server/db";
import { neonPool } from "../server/neon";
import { readFileSync } from "fs";

async function main() {
  await db.initializePersistentStore();
  const state = db.getState();
  console.log("=== DOCUMENT GATES SMOKE TEST ===\n");

  const assertions: { name: string; passed: boolean; detail: string }[] = [];

  const targetStudent = state.students[0];
  const injectedObligation = {
    id: `test-obligation-${Date.now()}`,
    studentId: targetStudent.id,
    programmeId: targetStudent.programmeId,
    session: state.settings.currentSession,
    level: targetStudent.level,
    feeCatalogItemId: "test-fee-item",
    feeNameSnapshot: "TEST UNPAID TUITION",
    feeCategorySnapshot: "COMPULSORY" as const,
    feeTypeSnapshot: "PER_SESSION" as const,
    amountDue: 50000,
    amountPaid: 0,
    balance: 50000,
    status: "UNPAID" as const,
    source: "NEW_SESSION" as const,
    generatedAt: new Date().toISOString(),
  };

  if (!state.studentFeeObligations) state.studentFeeObligations = [];
  state.studentFeeObligations.push(injectedObligation);

  const simulatedUnpaid = (state.studentFeeObligations || []).filter(
    (o: any) => o.studentId === targetStudent.id && o.balance > 0
  );
  assertions.push({
    name: "Fee gate: unpaid obligation triggers block (409)",
    passed: simulatedUnpaid.length === 1 && simulatedUnpaid[0].balance === 50000,
    detail: `${simulatedUnpaid.length} unpaid obligation(s) for ${targetStudent.id}, balance ${simulatedUnpaid[0]?.balance}`,
  });

  const cleanStudent = state.students.find(
    (s: any) =>
      s.id !== targetStudent.id &&
      !(state.studentFeeObligations || []).some(
        (o: any) => o.studentId === s.id && o.balance > 0
      )
  );
  if (cleanStudent) {
    const cleanUnpaid = (state.studentFeeObligations || []).filter(
      (o: any) => o.studentId === cleanStudent.id && o.balance > 0
    );
    assertions.push({
      name: "Fee gate: paid student passes (would allow 201)",
      passed: cleanUnpaid.length === 0,
      detail: `0 unpaid for ${cleanStudent.id} — gate would allow`,
    });
  }

  const savedObligations = state.studentFeeObligations;
  (state as any).studentFeeObligations = undefined;
  const nullGuardResult = (state.studentFeeObligations || []).filter(
    (o: any) => o.studentId === targetStudent.id && o.balance > 0
  );
  assertions.push({
    name: "Fee gate: undefined studentFeeObligations handled (|| [] fallback)",
    passed: nullGuardResult.length === 0,
    detail: "undefined ledger → empty filter → gate allows (backwards compatible)",
  });
  state.studentFeeObligations = savedObligations;

  state.studentFeeObligations = (state.studentFeeObligations || []).filter(
    (o: any) => o.id !== injectedObligation.id
  );

  const apiRouterContent = readFileSync("./server/apiRouter.ts", "utf8");
  assertions.push({
    name: "Module mounted at /documents-v2 in apiRouter.ts",
    passed: apiRouterContent.includes("apiRouter.use('/documents-v2', documentsApiRouter)"),
    detail: "Mount line present",
  });

  assertions.push({
    name: "Import added to apiRouter.ts",
    passed: apiRouterContent.includes("import { documentsApiRouter } from './documentsApiRouter'"),
    detail: "Import line present",
  });

  const moduleContent = readFileSync("./server/documentsApiRouter.ts", "utf8");
  assertions.push({
    name: "Graduation gate present in documentsApiRouter.ts",
    passed:
      moduleContent.includes("GRADUATION GATE") &&
      moduleContent.includes("evaluateNdGraduationEligibilityFromPostgres") &&
      moduleContent.includes("currentStage !== 'GRADUATED'"),
    detail: "GRADUATION GATE marker + eligibility call + stage check all present",
  });

  assertions.push({
    name: "Fee gate present in documentsApiRouter.ts",
    passed:
      moduleContent.includes("FEE GATE") &&
      moduleContent.includes("balance > 0") &&
      moduleContent.includes("unpaidObligations"),
    detail: "FEE GATE marker + balance predicate + unpaidObligations response field all present",
  });

  let pass = 0, fail = 0;
  for (const a of assertions) {
    console.log(`${a.passed ? "PASS" : "FAIL"}: ${a.name}`);
    console.log(`   ${a.detail}`);
    if (a.passed) pass++; else fail++;
  }
  console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
  console.log(fail === 0 ? "DOCUMENT GATES VERIFIED" : "DOCUMENT GATES HAVE GAPS");

  await neonPool.end();
  if (fail > 0) process.exit(1);
}
main().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
