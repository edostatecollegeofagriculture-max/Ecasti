import { neonPool } from "../server/neon";
const r = await neonPool.query(`
  SELECT elem->>'id' AS id, elem->>'email' AS email, elem->>'role' AS role
    FROM ecasti_application_state,
         jsonb_array_elements(state->'users') AS elem
   WHERE singleton_id = 1
     AND elem->>'role' IN ('SUPER_ADMIN','INSTITUTION_ADMIN','RECTOR','REGISTRAR')
   ORDER BY elem->>'role'
`);
console.table(r.rows);
await neonPool.end();
