import { neonPool } from "../server/neon";
import bcrypt from "bcryptjs";

const TARGET_EMAIL = "superadmin@edocasti.edu.ng";
const NEW_PASSWORD = "Password123!";

const read = await neonPool.query(
  `SELECT state FROM ecasti_application_state WHERE singleton_id = 1`
);
const state = read.rows[0].state as any;

const user = state.users.find(
  (u: any) => String(u.email).toLowerCase() === TARGET_EMAIL
);
if (!user) {
  console.error(`User ${TARGET_EMAIL} not found`);
  process.exit(1);
}

user.passwordHash = bcrypt.hashSync(NEW_PASSWORD, 10);
user.failedLoginAttempts = 0;
user.isLocked = false;

const result = await neonPool.query(
  `UPDATE ecasti_application_state
      SET state = $1::jsonb, revision = revision + 1, updated_at = NOW()
    WHERE singleton_id = 1
    RETURNING revision`,
  [JSON.stringify(state)]
);

console.log(`Password reset for ${TARGET_EMAIL} → ${NEW_PASSWORD}`);
console.log(`New revision: ${result.rows[0].revision}`);
console.log(`isLocked: ${user.isLocked}, failedLoginAttempts: ${user.failedLoginAttempts}`);

await neonPool.end();
