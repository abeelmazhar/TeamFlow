import type { Db } from "../../db/pool.js";

export type Comment = {
  id: string;
  taskId: string;
  body: string;
  author: { id: string; name: string };
  isEdited: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type CommentRow = {
  id: string;
  task_id: string;
  body: string;
  author_id: string;
  author_name: string;
  is_edited: boolean;
  created_at: Date;
  updated_at: Date;
};

const toComment = (r: CommentRow): Comment => ({
  id: r.id,
  taskId: r.task_id,
  body: r.body,
  author: { id: r.author_id, name: r.author_name },
  isEdited: r.is_edited,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

// Shared SELECT list. "c" = the comment rows, "u" = the author.
const COMMENT_FIELDS = `
  c.id, c.task_id, c.body, c.created_at, c.updated_at,
  c.updated_at > c.created_at AS is_edited,
  u.id AS author_id, u.name AS author_name`;

export async function listComments(
  db: Db,
  organizationId: string,
  taskId: string,
  page: { limit: number; offset: number },
): Promise<Comment[]> {
  const { rows } = await db.query<CommentRow>(
    `SELECT ${COMMENT_FIELDS}
     FROM comments c
     JOIN users u ON u.id = c.author_id
     WHERE c.organization_id = $1 AND c.task_id = $2
     ORDER BY c.created_at ASC, c.id ASC
     LIMIT $3 OFFSET $4`,
    [organizationId, taskId, page.limit, page.offset],
  );
  return rows.map(toComment);
}

export async function countComments(db: Db, organizationId: string, taskId: string): Promise<number> {
  const { rows } = await db.query<{ count: string }>(
    `SELECT count(*) FROM comments WHERE organization_id = $1 AND task_id = $2`,
    [organizationId, taskId],
  );
  return Number(rows[0]?.count ?? 0);
}

export async function insertComment(
  db: Db,
  input: { organizationId: string; taskId: string; authorId: string; body: string },
): Promise<Comment> {
  // A CTE ("WITH ...") lets us INSERT and then JOIN the author's name in ONE query.
  const { rows } = await db.query<CommentRow>(
    `WITH c AS (
       INSERT INTO comments (organization_id, task_id, author_id, body)
       VALUES ($1, $2, $3, $4)
       RETURNING *
     )
     SELECT ${COMMENT_FIELDS}
     FROM c JOIN users u ON u.id = c.author_id`,
    [input.organizationId, input.taskId, input.authorId, input.body],
  );
  const row = rows[0];
  if (!row) throw new Error("insertComment returned no row");
  return toComment(row);
}

export async function updateCommentBody(
  db: Db,
  organizationId: string,
  commentId: string,
  body: string,
): Promise<Comment> {
  const { rows } = await db.query<CommentRow>(
    `WITH c AS (
       UPDATE comments SET body = $3, updated_at = now()
       WHERE id = $1 AND organization_id = $2
       RETURNING *
     )
     SELECT ${COMMENT_FIELDS}
     FROM c JOIN users u ON u.id = c.author_id`,
    [commentId, organizationId, body],
  );
  const row = rows[0];
  if (!row) throw new Error("updateCommentBody: comment not found");
  return toComment(row);
}

export async function deleteComment(db: Db, organizationId: string, commentId: string): Promise<void> {
  await db.query(`DELETE FROM comments WHERE id = $1 AND organization_id = $2`, [commentId, organizationId]);
}

/** What the service needs to decide permissions. Hidden if the task is deleted. */
export type CommentContext = { id: string; authorId: string; taskId: string; projectId: string };

export async function findCommentContext(
  db: Db,
  organizationId: string,
  commentId: string,
  opts: { forUpdate?: boolean } = {},
): Promise<CommentContext | null> {
  const { rows } = await db.query<{ id: string; author_id: string; task_id: string; project_id: string }>(
    `SELECT c.id, c.author_id, c.task_id, t.project_id
     FROM comments c
     JOIN tasks t ON t.id = c.task_id AND t.organization_id = c.organization_id
     WHERE c.id = $1 AND c.organization_id = $2 AND t.deleted_at IS NULL
     ${opts.forUpdate ? "FOR UPDATE OF c" : ""}`,
    [commentId, organizationId],
  );
  const row = rows[0];
  return row
    ? { id: row.id, authorId: row.author_id, taskId: row.task_id, projectId: row.project_id }
    : null;
}