import { pool } from "../src/db/pool.js";

/** Refuse to run destructive tests against anything that isn't a *_test database. */
export function assertTestDatabase(databaseUrl: string) {
  const dbName = new URL(databaseUrl).pathname.slice(1);
  if (!dbName.endsWith("_test")) {
    throw new Error(
      `Refusing to run tests against database "${dbName}". Test database names must end with "_test".`,
    );
  }
}

/** Empty every table. CASCADE clears all tables that depend on these two. */
export async function resetDb() {
  await pool.query("TRUNCATE users, organizations CASCADE");
}