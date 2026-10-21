import { runner } from "node-pg-migrate";

export default async function setup() {
  process.env.NODE_ENV = "test";
  const { env } = await import("../src/config/env.js");
  const { assertTestDatabase } = await import("./db.js");

  assertTestDatabase(env.DATABASE_URL); // stop BEFORE touching anything

  await runner({
    databaseUrl: env.DATABASE_URL,
    dir: "migrations",
    migrationsTable: "pgmigrations",
    direction: "up",
    count: Infinity,
    singleTransaction: true,
    log: () => {}, // keep test output clean
  });
}