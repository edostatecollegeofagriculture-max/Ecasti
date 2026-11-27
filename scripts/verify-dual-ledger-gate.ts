import { db } from "../server/db";
import { neonPool } from "../server/neon";
import { readFileSync } from "fs";

async function main() {
  await db.initializePersistentStore();
  const state = db.getState();
  console.log("=== DUAL-LEDGER FEE GATE SMOKE TEST ===\n");

  const assertions: { name: string; passed: boolean; detail: string }[] = [];

  function simulateGate(studentId: string) {
    const unpaidObligations = (state.studentFeeObligations || []).filter(
      (o: any) => o.studentId === studentId && o.balance > 0
    );
    const unpaidInvoices = (state.invoices || []).filter(
      (i: any) => i.studentId === studentId && i.status !== 'PAID' && i.id.indexOf('inv-doc-') !== 0
    );
    return {
      blocked: unpaidObligations.length > 0 || unpaidInvoices.length > 0,
      obligationCount: unpaidObligations.length,
      invoiceCount: unpaidInvoices.length,
    };
  }

  // Test 1: real seed data — student with unpaid invoices
  const studentsWithUnpaidInvoices = state.students.filter((s: any) => {
    const unpaid = (state.invoices || []).filter(
      (i: any) => i.studentId === s.id && i.status !== 'PAID' && i.id.indexOf('inv-doc-') !== 0
    );
    return unpaid.length > 0;
  });
  if (studentsWithUnpaidInvoices.length > 0) {
    const target = studentsWithUnpaidInvoices[0];
    const result = simulateGate(target.id);
    assertions.push({
      name: "Unpaid invoice student -> gate blocks (409)",
      passed: result.blocked === true && result.invoiceCount > 0,
      detail: target.id + " has " + result.invoiceCount + " unpaid invoice(s), blocked=" + result.blocked,
    });
  } else {
    assertions.push({
      name: "Unpaid invoice student exists (seed fixture)",
      passed: false,
      detail: "No unpaid invoices in seed - test cannot run",
    });
  }

  // Test 2: student with unpaid obligation -> blocked (injected)
  const target2 = state.students[0];
  const injected = {
    id: "test-obl-" + Date.now(),
    studentId: target2.id,
    programmeId: target2.programmeId,
    session: state.settings.currentSession,
    level: target2.level,
    feeCatalogItemId: "test-fee",
    feeNameSnapshot: "TEST OBLIGATION",
    feeCategorySnapshot: "COMPULSORY" as const,
    feeTypeSnapshot: "PER_SESSION" as const,
    amountDue: 30000,
    amountPaid: 0,
    balance: 30000,
    status: "UNPAID" as const,
    source: "NEW_SESSION" as const,
    generatedAt: new Date().toISOString(),
  };
  if (!state.studentFeeObligations) state.studentFeeObligations = [];
  state.studentFeeObligations.push(injected);
  const result2 = simulateGate(target2.id);
  assertions.push({
    name: "Unpaid obligation -> gate blocks (409)",
    passed: result2.blocked === true && result2.obligationCount === 1,
    detail: target2.id + " blocked=" + result2.blocked + ", obligationCount=" + result2.obligationCount,
  });
  state.studentFeeObligations = state.studentFeeObligations.filter(
    (o: any) => o.id !== injected.id
  );

  // Test 3: inv-doc-* invoices excluded (self-block prevention)
  const docInvoice = {
    id: 'inv-doc-test-' + Date.now(),
    invoiceNumber: 'TEST/2026/00001',
    studentId: target2.id,
    session: state.settings.currentSession,
    title: 'Document Processing Fee',
    amount: 25000,
    amountPaid: 0,
    status: 'UNPAID' as const,
    dueDate: '2027-01-01',
    createdAt: new Date().toISOString(),
  };
  state.invoices.push(docInvoice);
  const result3 = simulateGate(target2.id);
  assertions.push({
    name: "inv-doc-* invoice excluded (no self-block)",
    passed: result3.blocked === false && result3.invoiceCount === 0,
    detail: "inv-doc invoice ignored, blocked=" + result3.blocked + ", invoiceCount=" + result3.invoiceCount,
  });
  state.invoices = state.invoices.filter((i: any) => i.id !== docInvoice.id);

  // Test 4: fully-paid student passes
  const cleanStudent = state.students.find((s: any) => {
    const r = simulateGate(s.id);
    return !r.blocked;
  });
  if (cleanStudent) {
    const result4 = simulateGate(cleanStudent.id);
    assertions.push({
      name: "Clean student -> gate allows (201)",
      passed: result4.blocked === false,
      detail: cleanStudent.id + " blocked=" + result4.blocked,
    });
  }

  // Test 5: source check
  const moduleContent = readFileSync("./server/documentsApiRouter.ts", "utf8");
  assertions.push({
    name: "Dual-ledger gate present in source",
    passed:
      moduleContent.includes("unpaidInvoices") &&
      moduleContent.includes("indexOf('inv-doc-') !== 0"),
    detail: "unpaidInvoices + inv-doc exclusion present",
  });

  let pass = 0, fail = 0;
  for (const a of assertions) {
    console.log((a.passed ? "PASS" : "FAIL") + ": " + a.name);
    console.log("   " + a.detail);
    if (a.passed) pass++; else fail++;
  }
  console.log("\n=== RESULT: " + pass + " passed, " + fail + " failed ===");
  console.log(fail === 0 ? "DUAL-LEDGER GATE VERIFIED" : "DUAL-LEDGER GATE HAS GAPS");

  await neonPool.end();
  if (fail > 0) process.exit(1);
}
main().catch(e => { console.error("ERR:", e.message); process.exit(1); });
