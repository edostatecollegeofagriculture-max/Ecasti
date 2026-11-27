import { neonPool } from "../server/neon";
const r = await neonPool.query("SELECT singleton_id, revision, updated_at, length(state::text) AS bytes FROM ecasti_application_state");
console.log(r.rows);
await neonPool.end();
