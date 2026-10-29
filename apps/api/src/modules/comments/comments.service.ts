import { pool, type Db } from "../../db/pool.js";
import { withTransaction } from "../../db/transaction.js";
import { conflict, forbidden, notFound } from "../../lib/errors.js";
import type { TenantContext } from "../../lib/tenant-context.js";
import { insertActivity } from "../activity/activity.repository.js";
import * as projectsRepo from "../projects/projects.repository.js";
import * as tasksRepo from "../tasks/tasks.repository.js";
import * as tasksService from "../tasks/tasks.service.js";
import { canDeleteComment, canEditComment } from "./comments.policy.js";
import * as commentsRepo from "./comments.repository.js";
import type { Comment } from "./comments.repository.js";
import type { CommentBodyInput, ListCommentsQuery } from "./comments.schema.js";

/** Shared check: the project must not be archived. */
async function assertProjectNotArchived(db: Db, organizationId: string, projectId: string) {
  const project = await projectsRepo.findProjectById(db, organizationId, projectId, { forShare: true });
  if (project?.archivedAt) {
    throw conflict("Project is archived. Unarchive it before changing comments.");
  }
}

export async function listComments(ctx: TenantContext, taskId: string, query: ListCommentsQuery) {
  await tasksService.getTask(ctx, taskId); // 404 if not in this org or deleted

  const offset = (query.page - 1) * query.limit;
  const [total, items] = await Promise.all([
    commentsRepo.countComments(pool, ctx.organizationId, taskId),
    commentsRepo.listComments(pool, ctx.organizationId, taskId, { limit: query.limit, offset }),
  ]);
  return {
    items,
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
  };
}

export async function createComment(
  ctx: TenantContext,
  taskId: string,
  input: CommentBodyInput,
): Promise<Comment> {
  // No role check: every member may comment (permission table).
  return withTransaction(async (tx) => {
    const task = await tasksRepo.findTaskById(tx, ctx.organizationId, taskId);
    if (!task) throw notFound("Task not found");

    await assertProjectNotArchived(tx, ctx.organizationId, task.projectId);

    const comment = await commentsRepo.insertComment(tx, {
      organizationId: ctx.organizationId,
      taskId,
      authorId: ctx.userId,
      body: input.body,
    });

    await insertActivity(tx, {
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: "comment.created",
      entityType: "comment",
      entityId: comment.id,
      projectId: task.projectId,
      metadata: { taskId }, // IDs only, never the comment text
    });

    return comment;
  });
}

export async function updateComment(
  ctx: TenantContext,
  commentId: string,
  input: CommentBodyInput,
): Promise<Comment> {
  return withTransaction(async (tx) => {
    const current = await commentsRepo.findCommentContext(tx, ctx.organizationId, commentId, {
      forUpdate: true,
    });
    if (!current) throw notFound("Comment not found");
    if (!canEditComment(ctx, current)) throw forbidden();

    await assertProjectNotArchived(tx, ctx.organizationId, current.projectId);
    return commentsRepo.updateCommentBody(tx, ctx.organizationId, commentId, input.body);
  });
}

export async function deleteComment(ctx: TenantContext, commentId: string): Promise<void> {
  await withTransaction(async (tx) => {
    const current = await commentsRepo.findCommentContext(tx, ctx.organizationId, commentId, {
      forUpdate: true,
    });
    if (!current) throw notFound("Comment not found");
    if (!canDeleteComment(ctx, current)) throw forbidden();

    await assertProjectNotArchived(tx, ctx.organizationId, current.projectId);
    await commentsRepo.deleteComment(tx, ctx.organizationId, commentId);

    await insertActivity(tx, {
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: "comment.deleted",
      entityType: "comment",
      entityId: commentId,
      projectId: current.projectId,
      metadata: { taskId: current.taskId, authorId: current.authorId },
    });
  });
}
