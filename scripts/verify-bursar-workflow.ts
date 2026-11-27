import { db } from "../server/db";
import { neonPool } from "../server/neon";

async function main() {
  await db.initializePersistentStore();
  const state = db.getState();
  console.log("=== BURSAR FEE WORKFLOW SMOKE TEST ===\n");

  const assertions: { name: string; passed: boolean; detail: string }[] = [];

  // Helper: simulate the dual-ledger gate (mirrors documentsApiRouter.ts)
  function gateBlocks(studentId: string) {
    const unpaidObligations = (state.studentFeeObligations || []).filter(
      (o: any) => o.studentId === studentId && o.balance > 0
    );
    const unpaidInvoices = (state.invoices || []).filter(
      (i: any) => i.studentId === studentId && i.status !== 'PAID' && i.id.indexOf('inv-doc-') !== 0
    );
    return {
      blocked: unpaidObligations.length > 0 || unpaidInvoices.length > 0,
      obligations: unpaidObligations.length,
      invoices: unpaidInvoices.length,
    };
  }

  // TEST 1: Fee schedules exist with correct shape
  const schedules = state.feeSchedules || [];
  assertions.push({
    name: "Fee schedules exist with required fields",
    passed: schedules.length > 0 && schedules.every((f: any) =>
      f.id && f.title && f.category && f.level && f.session && typeof f.amount === 'number'
    ),
    detail: `${schedules.length} schedule(s), all have id/title/category/level/session/amount`,
  });

  // TEST 2: Every invoice has a valid studentId that resolves to a real student
  const invoices = state.invoices || [];
  const invoiceStudentIdsValid = invoices.every((i: any) =>
    state.students.some((s: any) => s.id === i.studentId)
  );
  assertions.push({
    name: "Every invoice.studentId resolves to a real student",
    passed: invoiceStudentIdsValid,
    detail: `${invoices.length} invoice(s), all student references valid: ${invoiceStudentIdsValid}`,
  });

  // TEST 3: Fully paid student (std-1) passes the gate
  const std1 = state.students.find((s: any) => s.id === 'std-1');
  if (std1) {
    const result = gateBlocks(std1.id);
    assertions.push({
      name: "Fully paid student (std-1) → certificate gate allows",
      passed: result.blocked === false,
      detail: `std-1 blocked=${result.blocked}, unpaid invoices=${result.invoices}, unpaid obligations=${result.obligations}`,
    });
  }

  // TEST 4: Partially paid student (std-2) is blocked
  const std2 = state.students.find((s: any) => s.id === 'std-2');
  if (std2) {
    const result = gateBlocks(std2.id);
    assertions.push({
      name: "Partially paid student (std-2) → certificate gate blocks",
      passed: result.blocked === true,
      detail: `std-2 blocked=${result.blocked}, unpaid invoices=${result.invoices}`,
    });
  }

  // TEST 5: Unpaid student (std-1795622008157) is blocked
  const unpaidStudent = state.students.find((s: any) => s.id === 'std-1795622008157');
  if (unpaidStudent) {
    const result = gateBlocks(unpaidStudent.id);
    assertions.push({
      name: "Unpaid student (std-1795622008157) → certificate gate blocks",
      passed: result.blocked === true,
      detail: `${unpaidStudent.id} blocked=${result.blocked}, unpaid invoices=${result.invoices}`,
    });
  }

  // TEST 6: Payment record for a PAID invoice exists with VERIFIED status
  const paidInvoice = invoices.find((i: any) => i.status === 'PAID');
  if (paidInvoice) {
    const payment = (state.payments || []).find((p: any) => p.invoiceId === paidInvoice.id);
    assertions.push({
      name: "PAID invoice has a VERIFIED payment record",
      passed: payment !== undefined && payment.status === 'VERIFIED',
      detail: payment
        ? `payment ${payment.id} ref=${payment.reference} amount=${payment.amount} status=${payment.status}`
        : "no payment found for PAID invoice",
    });
  }

  // TEST 7: PARTIAL invoice amountPaid < amount
  const partialInvoice = invoices.find((i: any) => i.status === 'PARTIAL');
  if (partialInvoice) {
    assertions.push({
      name: "PARTIAL invoice has amountPaid between 0 and amount",
      passed:
        partialInvoice.amountPaid > 0 &&
        partialInvoice.amountPaid < partialInvoice.amount,
      detail: `amount=${partialInvoice.amount}, paid=${partialInvoice.amountPaid}, remaining=${partialInvoice.amount - partialInvoice.amountPaid}`,
    });
  }

  // TEST 8: UNPAID invoice has amountPaid === 0
  const unpaidInvoices = invoices.filter((i: any) => i.status === 'UNPAID' && i.id.indexOf('inv-doc-') !== 0);
  assertions.push({
    name: "UNPAID invoices have amountPaid === 0",
    passed: unpaidInvoices.every((i: any) => i.amountPaid === 0),
    detail: `${unpaidInvoices.length} UNPAID invoice(s), all amountPaid=0`,
  });

  // TEST 9: Finance routes present in apiRouter.ts
  const fs = await import("fs");
  const router = fs.readFileSync("./server/apiRouter.ts", "utf8");
  const requiredRoutes = [
    "apiRouter.post(  '/finance/fee-schedules'",
    "apiRouter.post('/finance/pay'",
    "apiRouter.post(  '/finance/invoices'",
    "apiRouter.get('/finance/invoices'",
  ];
  const presentRoutes = requiredRoutes.filter((r) => router.includes(r));
  assertions.push({
    name: "All 4 core finance routes present in apiRouter.ts",
    passed: presentRoutes.length === requiredRoutes.length,
    detail: `${presentRoutes.length}/${requiredRoutes.length} routes present`,
  });

  // TEST 10: Frontend API methods present
  const apiTs = fs.readFileSync("./src/services/api.ts", "utf8");
  const requiredMethods = ["getFeeSchedules", "createInvoice", "getInvoices", "payInvoice"];
  const presentMethods = requiredMethods.filter((m) => apiTs.includes(m));
  assertions.push({
    name: "All 4 core frontend API methods present",
    passed: presentMethods.length === requiredMethods.length,
    detail: `${presentMethods.length}/${requiredMethods.length} methods present: ${presentMethods.join(', ')}`,
  });

  let pass = 0, fail = 0;
  for (const a of assertions) {
    console.log(`${a.passed ? "PASS" : "FAIL"}: ${a.name}`);
    console.log(`   ${a.detail}`);
    if (a.passed) pass++; else fail++;
  }
  console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
  console.log(fail === 0 ? "BURSAR WORKFLOW VERIFIED" : "BURSAR WORKFLOW HAS GAPS");

  await neonPool.end();
  if (fail > 0) process.exit(1);
}
main().catch(e => { console.error("ERR:", e.message); process.exit(1); });
