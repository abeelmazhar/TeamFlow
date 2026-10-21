import { afterAll, beforeEach } from "vitest";
import { pool } from "../src/db/pool.js";
import { resetDb } from "./db.js";

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await pool.end();
});