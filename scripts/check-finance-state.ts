import { db } from "../server/db";
import { neonPool } from "../server/neon";

async function main() {
  await db.initializePersistentStore();
  const s = db.getState();
  console.log("=== FINANCE DATA STATE ===\n");
  console.log(`feeSchedules:  ${s.feeSchedules?.length || 0}`);
  console.log(`invoices:      ${s.invoices?.length || 0}`);
  console.log(`payments:      ${s.payments?.length || 0}`);

  console.log("\n=== FEE SCHEDULES ===");
  (s.feeSchedules || []).forEach((f: any) => {
    console.log(`  ${f.id}: ${f.title} | ${f.category} | ${f.level} | ${f.session} | amount=${f.amount}`);
  });

  console.log("\n=== INVOICES (sample) ===");
  (s.invoices || []).slice(0, 10).forEach((i: any) => {
    console.log(`  ${i.id}: ${i.title} | student=${i.studentId} | amount=${i.amount} paid=${i.amountPaid} status=${i.status}`);
  });

  console.log("\n=== PAYMENTS (sample) ===");
  (s.payments || []).slice(0, 10).forEach((p: any) => {
    console.log(`  ${p.id}: ref=${p.reference} | invoice=${p.invoiceId} | amount=${p.amount} status=${p.status}`);
  });

  await neonPool.end();
}
main().catch(e => { console.error("ERR:", e.message); process.exit(1); });
