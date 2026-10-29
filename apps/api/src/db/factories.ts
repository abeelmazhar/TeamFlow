import type { Db } from "./pool.js";

// Real Argon2 hashes come in Phase 4. Until then, seed users cannot log in.
export const PLACEHOLDER_HASH = "seed-placeholder-not-a-real-hash";

export async function insertId(db: Db, sql: string, params: unknown[]): Promise<string> {
  const { rows } = await db.query<{ id: string }>(sql, params);
  const row = rows[0];
  if (!row) throw new Error(`Insert returned no row: ${sql}`);
  return row.id;
}

export function createUser(db: Db, email: string, name: string) {
  return insertId(
    db,
    `INSERT INTO users (email, password_hash, name, email_verified_at)
     VALUES ($1, $2, $3, now()) RETURNING id`,
    [email, PLACEHOLDER_HASH, name],
  );
}

export function createOrg(db: Db, name: string) {
  return insertId(db, `INSERT INTO organizations (name) VALUES ($1) RETURNING id`, [name]);
}

export async function addMember(db: Db, orgId: string, userId: string, role: string) {
  await db.query(
    `INSERT INTO memberships (organization_id, user_id, role) VALUES ($1, $2, $3)`,
    [orgId, userId, role],
  );
}

export function createProject(db: Db, orgId: string, name: string, createdBy: string) {
  return insertId(
    db,
    `INSERT INTO projects (organization_id, name, created_by)
     VALUES ($1, $2, $3) RETURNING id`,
    [orgId, name, createdBy],
  );
}

export type NewTask = {
  orgId: string;
  projectId: string;
  title: string;
  status: "todo" | "in_progress" | "in_review" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  dueInDays: number | null; // negative = already overdue
  assigneeId: string | null;
  createdBy: string;
};

export function createTask(db: Db, t: NewTask) {
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

export function createComment(
  db: Db,
  c: { orgId: string; taskId: string; authorId: string; body: string },
) {
  return insertId(
    db,
    `INSERT INTO comments (organization_id, task_id, author_id, body)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [c.orgId, c.taskId, c.authorId, c.body],
  );
}
