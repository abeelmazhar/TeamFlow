import type { Pool, PoolClient } from "pg";
import pg from "pg";
import { env } from "../config/env.js";

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
});

// If an idle connection breaks (e.g. the database restarts), log it
// instead of letting the error crash the whole process.
pool.on("error", (err) => {
  console.error("Unexpected PostgreSQL pool error:", err.message);
});

/** A repository can run on the pool OR inside a transaction client. */
export type Db = Pool | PoolClient;