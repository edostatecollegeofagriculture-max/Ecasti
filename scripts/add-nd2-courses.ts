import { db } from "../server/db";
import { neonPool } from "../server/neon";

async function main() {
  await db.initializePersistentStore();
  const state = db.getState();

  const ndProgrammes = state.programmes.filter((p: any) => p.qualification === "ND");
  const added: string[] = [];

  for (const prog of ndProgrammes) {
    const existing = state.courses.filter(
      (c: any) => c.programmeId === prog.id && c.level === "ND II"
    );
    if (existing.length > 0) continue;

    const dept = state.departments.find((d: any) => d.id === prog.departmentId);
    const codePrefix = (dept?.code || prog.code.substring(0, 3)).toUpperCase();

    const newCourse = {
      id: `crs-${prog.id.replace("prog-nd-", "")}-nd2-200`,
      departmentId: prog.departmentId,
      programmeId: prog.id,
      code: `${codePrefix} 200`,
      title: `${prog.name} — Level 200 Core Course`,
      creditUnits: 3,
      level: "ND II",
      semester: "First Semester" as const,
      isCompulsory: true,
    };
    state.courses.push(newCourse);
    added.push(`${prog.id} → ${newCourse.code} (${newCourse.title})`);
  }

  if (added.length > 0) {
    db.saveState();
    console.log(`Added ${added.length} ND II courses:`);
    for (const a of added) console.log("  " + a);
    console.log(`Total courses now: ${state.courses.length}`);
  } else {
    console.log("All ND programmes already have ND II courses.");
  }

  await neonPool.end();
}

main().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
