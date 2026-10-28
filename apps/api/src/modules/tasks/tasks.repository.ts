import type { Db } from "../../db/pool.js";
import type { TaskPriority, TaskStatus } from "./tasks.schemas.js";

export type Task = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null; // "YYYY-MM-DD"
  assigneeId: string | null;
  createdBy: string;
  completedAt: Date | null;
  isOverdue: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type TaskRow = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  assignee_id: string | null;
  created_by: string;
  completed_at: Date | null;
  is_overdue: boolean;
  created_at: Date;
  updated_at: Date;
};

const toTask = (r: TaskRow): Task => ({
  id: r.id,
  projectId: r.project_id,
  title: r.title,
  description: r.description,
  status: r.status,
  priority: r.priority,
  dueDate: r.due_date,
  assigneeId: r.assignee_id,
  createdBy: r.created_by,
  completedAt: r.completed_at,
  isOverdue: r.is_overdue,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

// is_overdue is calculated on every read, so it's never stale.
export const TASK_COLUMNS = `
  id, project_id, title, description, status, priority, due_date,
  assignee_id, created_by, completed_at, created_at, updated_at,
  COALESCE(due_date < current_date AND status <> 'done', false) AS is_overdue`;

// Each filter is "skip me if NULL", so the SQL text never changes,
// and no user input is ever glued into it.
const LIST_FILTERS = `
  organization_id = $1
  AND project_id = $2
  AND deleted_at IS NULL
  AND ($3::text IS NULL OR status = $3)
  AND ($4::uuid IS NULL OR assignee_id = $4)`;

type ListFilters = { status?: TaskStatus | undefined; assigneeId?: string | undefined };

export async function listTasks(
  db: Db,
  organizationId: string,
  projectId: string,
  filters: ListFilters,
  page: { limit: number; offset: number },
): Promise<Task[]> {
  const { rows } = await db.query<TaskRow>(
    `SELECT ${TASK_COLUMNS}
     FROM tasks
     WHERE ${LIST_FILTERS}
     ORDER BY created_at DESC, id DESC
     LIMIT $5 OFFSET $6`,
    [organizationId, projectId, filters.status ?? null, filters.assigneeId ?? null, page.limit, page.offset],
  );
  return rows.map(toTask);
}

export async function countTasks(
  db: Db,
  organizationId: string,
  projectId: string,
  filters: ListFilters,
): Promise<number> {
  const { rows } = await db.query<{ count: string }>(
    `SELECT count(*) FROM tasks WHERE ${LIST_FILTERS}`,
    [organizationId, projectId, filters.status ?? null, filters.assigneeId ?? null],
  );
  return Number(rows[0]?.count ?? 0);
}

export async function insertTask(
  db: Db,
  input: {
    organizationId: string;
    projectId: string;
    title: string;
    description: string | null;
    priority: TaskPriority;
    dueDate: string | null;
    assigneeId: string | null;
    createdBy: string;
  },
): Promise<Task> {
  const { rows } = await db.query<TaskRow>(
    `INSERT INTO tasks
       (organization_id, project_id, title, description,
        priority, due_date, assignee_id, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING ${TASK_COLUMNS}`,
    [
      input.organizationId,
      input.projectId,
      input.title,
      input.description,
      input.priority,
      input.dueDate,
      input.assigneeId,
      input.createdBy,
    ],
  );
  const row = rows[0];
  if (!row) throw new Error("Insert into tasks returned no row");
  return toTask(row);
}


export async function findTaskById(
  db: Db,
  organizationId: string,
  taskId: string,
  opts: { forUpdate?: boolean } = {},
): Promise<Task | null> {
  const { rows } = await db.query<TaskRow>(
    `SELECT ${TASK_COLUMNS}
     FROM tasks
     WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL
     ${opts.forUpdate ? "FOR UPDATE" : ""}`,
    [taskId, organizationId],
  );
  const row = rows[0];
  return row ? toTask(row) : null;
}

export type TaskPatch = {
  title?: string | undefined;
  description?: string | null | undefined;
  status?: TaskStatus | undefined;
  priority?: TaskPriority | undefined;
  dueDate?: string | null | undefined;
  assigneeId?: string | null | undefined;
};

export async function updateTask(
  db: Db,
  organizationId: string,
  taskId: string,
  patch: TaskPatch,
): Promise<Task> {
  const { rows } = await db.query<TaskRow>(
    `UPDATE tasks SET
       title        = COALESCE($3, title),
       description  = CASE WHEN $4::boolean THEN $5 ELSE description END,
       status       = COALESCE($6::text, status),
       completed_at = CASE
                        WHEN $6::text IS NULL   THEN completed_at                  -- status not changing
                        WHEN $6::text = 'done'  THEN COALESCE(completed_at, now()) -- keep first completion time
                        ELSE NULL                                                  -- reopened
                      END,
       priority     = COALESCE($7, priority),
       due_date     = CASE WHEN $8::boolean  THEN $9::date  ELSE due_date END,
       assignee_id  = CASE WHEN $10::boolean THEN $11::uuid ELSE assignee_id END,
       updated_at   = now()
     WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL
     RETURNING ${TASK_COLUMNS}`,
    [
      taskId,
      organizationId,
      patch.title ?? null,
      patch.description !== undefined,
      patch.description ?? null,
      patch.status ?? null,
      patch.priority ?? null,
      patch.dueDate !== undefined,
      patch.dueDate ?? null,
      patch.assigneeId !== undefined,
      patch.assigneeId ?? null,
    ],
  );
  const row = rows[0];
  if (!row) throw new Error("updateTask: task not found");
  return toTask(row);
}

export async function softDeleteTask(db: Db, organizationId: string, taskId: string): Promise<void> {
  await db.query(
    `UPDATE tasks SET deleted_at = now(), updated_at = now()
     WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
    [taskId, organizationId],
  );
}