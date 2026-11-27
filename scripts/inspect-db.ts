import { neonPool } from "../server/neon";

async function main() {
  const result = await neonPool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
  );
  const names: string[] = result.rows.map((r: any) => r.table_name);
  console.log("=== TABLES IN ecasti_local ===");
  console.log(names.join("\n") || "(none)");

  const expected = [
    "academic_curriculum_mappings",
    "academic_curriculum_mapping_courses",
    "student_academic_curriculum_assignments",
    "student_academic_required_courses",
    "student_academic_progression",
    "academic_progression_history",
    "academic_management_pass_approvals",
  ];

  console.log("\n=== MIGRATION 006 STATUS ===");
  for (const t of expected) {
    console.log(`${names.includes(t) ? "PRESENT" : "MISSING"}: ${t}`);
  }

  await neonPool.end();
}

main().catch((e) => {
  console.error("ERR:", e.message);
  process.exit(1);
});
