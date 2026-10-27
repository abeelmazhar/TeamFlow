import type { Db } from "../../db/pool.js";

export type Project = {
  id: string;
  name: string;
  description: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  archived_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

const toProject = (r: ProjectRow): Project => ({
  id: r.id,
  name: r.name,
  description: r.description,
  archivedAt: r.archived_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export type ProjectStatusFilter = "active" | "archived" | "all";

// A fixed SQL piece written by us (never user input), so it's safe to reuse.
// $2 is the status filter value.
const STATUS_FILTER = `(
  $2::text = 'all'
  OR ($2::text = 'active'   AND archived_at IS NULL)
  OR ($2::text = 'archived' AND archived_at IS NOT NULL)
)`;

export async function listProjects(
  db: Db,
  organizationId: string,
  opts: { status: ProjectStatusFilter; limit: number; offset: number },
): Promise<Project[]> {
  const { rows } = await db.query<ProjectRow>(
    `SELECT id, name, description, archived_at, created_at, updated_at
     FROM projects
     WHERE organization_id = $1 AND ${STATUS_FILTER}
     ORDER BY created_at DESC, id DESC
     LIMIT $3 OFFSET $4`,
    [organizationId, opts.status, opts.limit, opts.offset],
  );
  return rows.map(toProject);
}

export async function countProjects(
  db: Db,
  organizationId: string,
  status: ProjectStatusFilter,
): Promise<number> {
  const { rows } = await db.query<{ count: string }>(
    `SELECT count(*) FROM projects WHERE organization_id = $1 AND ${STATUS_FILTER}`,
    [organizationId, status],
  );
  return Number(rows[0]?.count ?? 0); // Postgres returns count as a string
}

export async function insertProject(
  db: Db,
  input: { organizationId: string; name: string; description: string | null; createdBy: string },
): Promise<Project> {
  const { rows } = await db.query<ProjectRow>(
    `INSERT INTO projects (organization_id, name, description, created_by)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, description, archived_at, created_at, updated_at`,
    [input.organizationId, input.name, input.description, input.createdBy],
  );
  const row = rows[0];
  if (!row) throw new Error("Insert into projects returned no row");
  return toProject(row);
}



const PROJECT_COLUMNS = "id, name, description, archived_at, created_at, updated_at";

export async function findProjectById(
  db: Db,
  organizationId: string,
  projectId: string,
  opts: { forUpdate?: boolean; forShare?: boolean } = {},
): Promise<Project | null> {
  const lock = opts.forUpdate ? "FOR UPDATE" : opts.forShare ? "FOR SHARE" : "";
  const { rows } = await db.query<ProjectRow>(
    `SELECT ${PROJECT_COLUMNS}
     FROM projects
     WHERE id = $1 AND organization_id = $2
     ${lock}`,
    [projectId, organizationId],
  );
  const row = rows[0];
  return row ? toProject(row) : null;
}

export async function updateProject(
  db: Db,
  organizationId: string,
  projectId: string,
  patch: { name?: string; description?: string | null },
): Promise<Project> {
  const { rows } = await db.query<ProjectRow>(
    `UPDATE projects SET
       name        = COALESCE($3, name),
       description = CASE WHEN $4::boolean THEN $5 ELSE description END,
       updated_at  = now()
     WHERE id = $1 AND organization_id = $2
     RETURNING ${PROJECT_COLUMNS}`,
    [
      projectId,
      organizationId,
      patch.name ?? null,                 // null → COALESCE keeps the old name
      patch.description !== undefined,    // true only if the caller wants to change it
      patch.description ?? null,
    ],
  );
  const row = rows[0];
  if (!row) throw new Error("updateProject: project not found");
  return toProject(row);
}

export async function setProjectArchived(
  db: Db,
  organizationId: string,
  projectId: string,
  archived: boolean,
): Promise<Project> {
  const { rows } = await db.query<ProjectRow>(
    `UPDATE projects SET
       archived_at = CASE WHEN $3::boolean THEN now() ELSE NULL END,
       updated_at  = now()
     WHERE id = $1 AND organization_id = $2
     RETURNING ${PROJECT_COLUMNS}`,
    [projectId, organizationId, archived],
  );
  const row = rows[0];
  if (!row) throw new Error("setProjectArchived: project not found");
  return toProject(row);
}