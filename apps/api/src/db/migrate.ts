import { runner } from "node-pg-migrate";
import { env } from "../config/env.js";

// "npm run migrate:up" applies all new migrations.
// "npm run migrate:down" undoes only the LAST migration (safer).
const direction = process.argv[2] === "down" ? "down" : "up";

try {
  await runner({
    databaseUrl: env.DATABASE_URL,
    dir: "migrations",
    migrationsTable: "pgmigrations",
    direction,
    count: direction === "down" ? 1 : Infinity,
    singleTransaction: true,
  });
  console.log(`✅ Migrations ${direction} complete`);
} catch (err) {
  console.error(`❌ Migration ${direction} failed:`, err);
  process.exit(1);
}