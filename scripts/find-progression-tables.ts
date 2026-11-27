import { db } from "../server/db";
import { neonPool } from "../server/neon";

async function main() {
  await db.initializePersistentStore();

  // List all tables
  const tables = await neonPool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `);
  console.log("=== ALL TABLES ===");
  tables.rows.forEach((r: any) => console.log(`  ${r.table_name}`));

  // Find tables containing "progression" or "history"
  const relevant = tables.rows
    .map((r: any) => r.table_name)
    .filter((t: string) => t.includes('progres') || t.includes('history') || t.includes('event') || t.includes('stage'));

  console.log("\n=== PROGRESSION/HISTORY/EVENT TABLES ===");
  relevant.forEach((t: string) => console.log(`  ${t}`));

  // For each relevant table, show columns
  for (const table of relevant) {
    const cols = await neonPool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position
    `, [table]);
    console.log(`\n=== COLUMNS: ${table} ===`);
    cols.rows.forEach((c: any) => console.log(`  ${c.column_name}: ${c.data_type}`));

    // Sample rows
    try {
      const sample = await neonPool.query(`SELECT * FROM ${table} LIMIT 5`);
      console.log(`  Sample rows: ${sample.rows.length}`);
      sample.rows.forEach((r: any) => console.log(`    ${JSON.stringify(r).slice(0, 200)}`));
    } catch (e: any) {
      console.log(`  Sample query failed: ${e.message}`);
    }
  }

  await neonPool.end();
}
main().catch(e => { console.error("ERR:", e.message); process.exit(1); });
