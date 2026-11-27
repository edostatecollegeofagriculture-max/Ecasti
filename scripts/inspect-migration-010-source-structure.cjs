const fs = require("fs");

const file = "./data/edocasti_db.json";
const data = JSON.parse(fs.readFileSync(file, "utf8"));

console.log("=== SOURCE STRUCTURE ===");

for (const [key, value] of Object.entries(data)) {
  if (Array.isArray(value)) {
    const fieldSet = new Set();
    for (const row of value) {
      if (row && typeof row === "object") {
        Object.keys(row).forEach(k => fieldSet.add(k));
      }
    }

    console.log({
      collection: key,
      count: value.length,
      fields: [...fieldSet].sort()
    });
  }
}

console.log("\nFile-only inspection.");
console.log("Database connected: NO");
console.log("SQL executed: NO");
console.log("Import performed: NO");
console.log("Source modified: NO");
