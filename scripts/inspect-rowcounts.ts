import { neonPool } from "../server/neon";

async function main() {
  const tables = [
    "academic_curriculum_mappings",
    "academic_curriculum_mapping_courses",
    "academic_curriculum_mapping_reviews",
    "student_academic_curriculum_assignments",
    "student_academic_required_courses",
    "student_academic_progression",
    "academic_progression_history",
  ];
  console.log("=== ROW COUNTS ===");
  for (const t of tables) {
    const r = await neonPool.query(`SELECT COUNT(*)::int AS n FROM ${t}`);
    console.log(`${t}: ${r.rows[0].n}`);
  }
  await neonPool.end();
}
main().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
