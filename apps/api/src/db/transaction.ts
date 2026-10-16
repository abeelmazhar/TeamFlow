import type { PoolClient } from "pg";
import { pool } from "./pool.js";

/**
 * Runs `fn` inside BEGIN/COMMIT.
 * If anything throws, everything is rolled back.
 * All queries inside must use the given `client`, not `pool`,
 * otherwise they run OUTSIDE the transaction.
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Connection is broken; the original error is more important.
    }
    throw err;
  } finally {
    client.release(); // give the connection back to the pool
  }
}