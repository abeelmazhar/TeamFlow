import type { PoolClient } from "pg";
import { env } from "../config/env.js";
import { pool } from "./pool.js";
import { withTransaction } from "./transaction.js";

if (env.NODE_ENV === "production") {
  console.error("❌ Refusing to seed a production database.");
  process.exit(1);
}

// Real Argon2 hashes come in Phase 4. Until then, seed users cannot log in.
const PLACEHOLDER_HASH = "seed-placeholder-not-a-real-hash";

async function insertId(db: PoolClient, sql: string, params: unknown[]): Promise<string> {
  const { rows } = await db.query<{ id: string }>(sql, params);
  const row = rows[0];
  if (!row) throw new Error(`Insert returned no row: ${sql}`);
  return row.id;
}

function createUser(db: PoolClient, email: string, name: string) {
  return insertId(
    db,
    `INSERT INTO users (email, password_hash, name, email_verified_at)
     VALUES ($1, $2, $3, now()) RETURNING id`,
    [email, PLACEHOLDER_HASH, name],
  );
}

function createOrg(db: PoolClient, name: string) {
  return insertId(db, `INSERT INTO organizations (name) VALUES ($1) RETURNING id`, [name]);
}

async function addMember(db: PoolClient, orgId: string, userId: string, role: string) {
  await db.query(
    `INSERT INTO memberships (organization_id, user_id, role) VALUES ($1, $2, $3)`,
    [orgId, userId, role],
  );
}

function createProject(db: PoolClient, orgId: string, name: string, createdBy: string) {
  return insertId(
    db,
    `INSERT INTO projects (organization_id, name, created_by)
     VALUES ($1, $2, $3) RETURNING id`,
    [orgId, name, createdBy],
  );
}

type NewTask = {
  orgId: string;
  projectId: string;
  title: string;
  status: "todo" | "in_progress" | "in_review" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  dueInDays: number | null; // negative = already overdue
  assigneeId: string | null;
  createdBy: string;
};

function createTask(db: PoolClient, t: NewTask) {
  return insertId(
    db,
    `INSERT INTO tasks
       (organization_id, project_id, title, status, priority, due_date,
        assignee_id, created_by, completed_at)
     VALUES ($1, $2, $3, $4, $5, current_date + $6::int, $7, $8,
             CASE WHEN $4::text = 'done' THEN now() END)
     RETURNING id`,
    [t.orgId, t.projectId, t.title, t.status, t.priority, t.dueInDays,
     t.assigneeId, t.createdBy],
  );
}

try {
  await withTransaction(async (db) => {
    // Wipe everything. CASCADE also clears every table that depends on these two.
    await db.query("TRUNCATE users, organizations CASCADE");

    // Users (.test is a reserved domain, so it can never be a real address)
    const ali = await createUser(db, "ali@acme.test", "Ali Khan");
    const sara = await createUser(db, "sara@acme.test", "Sara Ahmed");
    const bilal = await createUser(db, "bilal@acme.test", "Bilal Raza");
    const hina = await createUser(db, "hina@acme.test", "Hina Malik");
    const omar = await createUser(db, "omar@globex.test", "Omar Farooq");

    // Two companies, to test isolation
    const acme = await createOrg(db, "Acme");
    const globex = await createOrg(db, "Globex");

    await addMember(db, acme, ali, "owner");
    await addMember(db, acme, sara, "admin");
    await addMember(db, acme, bilal, "manager");
    await addMember(db, acme, hina, "member");
    await addMember(db, globex, omar, "owner");

    const website = await createProject(db, acme, "Website Redesign", bilal);
    const rocket = await createProject(db, globex, "Rocket Launch", omar);

    const homepage = await createTask(db, {
      orgId: acme, projectId: website, title: "Design new homepage",
      status: "in_progress", priority: "high", dueInDays: 3,
      assigneeId: hina, createdBy: bilal,
    });
    await createTask(db, {
      orgId: acme, projectId: website, title: "Fix broken contact form",
      status: "todo", priority: "urgent", dueInDays: -2, // overdue
      assigneeId: hina, createdBy: bilal,
    });
    await createTask(db, {
      orgId: acme, projectId: website, title: "Choose color palette",
      status: "done", priority: "medium", dueInDays: -5,
      assigneeId: bilal, createdBy: bilal,
    });
    await createTask(db, {
      orgId: globex, projectId: rocket, title: "Secret Globex task",
      status: "todo", priority: "low", dueInDays: null,
      assigneeId: omar, createdBy: omar,
    });

    await db.query(
      `INSERT INTO comments (organization_id, task_id, author_id, body)
       VALUES ($1, $2, $3, $4)`,
      [acme, homepage, bilal, "Please use the new brand colors."],
    );

    // YOUR TURN: see the exercise below
  });

  console.log("✅ Seed complete");
} catch (err) {
  console.error("❌ Seed failed:", err);
  process.exitCode = 1;
} finally {
  await pool.end(); // close connections so the script can exit
}