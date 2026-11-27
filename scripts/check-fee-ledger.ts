import { db } from "../server/db";
import { neonPool } from "../server/neon";

async function main() {
  await db.initializePersistentStore();
  const state = db.getState();

  console.log("=== FEE LEDGER STATE ===\n");
  console.log(`FEE_MANAGEMENT_ENABLED: ${process.env.FEE_MANAGEMENT_ENABLED || '(unset)'}`);

  const obligations = state.studentFeeObligations || [];
  const invoices = state.invoices || [];
  const payments = state.payments || [];
  const feeSchedules = state.feeSchedules || [];

  console.log(`studentFeeObligations: ${obligations.length} records`);
  console.log(`invoices:              ${invoices.length} records`);
  console.log(`payments:              ${payments.length} records`);
  console.log(`feeSchedules:          ${feeSchedules.length} records`);

  if (obligations.length > 0) {
    const unpaid = obligations.filter(o => o.balance > 0);
    console.log(`\nUnpaid obligations: ${unpaid.length}`);
    const byStudent = unpaid.reduce((acc: Record<string, number>, o: any) => {
      acc[o.studentId] = (acc[o.studentId] || 0) + o.balance;
      return acc;
    }, {});
    console.log("Unpaid by student:", byStudent);
  }

  if (invoices.length > 0) {
    const unpaidInv = invoices.filter(i => i.status === 'UNPAID');
    console.log(`\nUnpaid invoices: ${unpaidInv.length}`);
    const byStudent = unpaidInv.reduce((acc: Record<string, number>, i: any) => {
      acc[i.studentId] = (acc[i.studentId] || 0) + i.amount;
      return acc;
    }, {});
    console.log("Unpaid invoices by student:", byStudent);
  }

  // Sample student
  const sample = state.students[0];
  if (sample) {
    console.log(`\n=== SAMPLE STUDENT: ${sample.id} (${sample.matricNumber}) ===`);
    console.log(`Level: ${sample.level}`);
    const obs = obligations.filter(o => o.studentId === sample.id);
    console.log(`Obligations: ${obs.length}`);
    obs.forEach((o: any) => {
      console.log(`  - ${o.feeNameSnapshot}: due=${o.amountDue} paid=${o.amountPaid} balance=${o.balance} status=${o.status} source=${o.source}`);
    });
    const invs = invoices.filter(i => i.studentId === sample.id);
    console.log(`Invoices: ${invs.length}`);
    invs.forEach((i: any) => {
      console.log(`  - ${i.title}: amount=${i.amount} paid=${i.amountPaid} status=${i.status}`);
    });
  }

  await neonPool.end();
}
main().catch(e => { console.error("ERR:", e.message); process.exit(1); });
