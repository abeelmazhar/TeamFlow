import type { Request, Response } from "express";
import { getTenantContext } from "../../lib/tenant-context.js";
import { uuidParam } from "../../lib/params.js";
import { commentBodySchema, listCommentsQuerySchema } from "./comments.schema.js";
import * as commentsService from "./comments.service.js";

export async function listComments(req: Request, res: Response) {
  const ctx = getTenantContext(req);
  const taskId = uuidParam(req, "taskId", "Task");
  const query = listCommentsQuerySchema.parse(req.query);
  const result = await commentsService.listComments(ctx, taskId, query);
  res.json({ data: result.items, meta: { pagination: result.pagination } });
}

export async function createComment(req: Request, res: Response) {
  const ctx = getTenantContext(req);
  const taskId = uuidParam(req, "taskId", "Task");
  const input = commentBodySchema.parse(req.body);
  const comment = await commentsService.createComment(ctx, taskId, input);
  res.status(201).json({ data: comment });
}

export async function updateComment(req: Request, res: Response) {
  const ctx = getTenantContext(req);
  const commentId = uuidParam(req, "commentId", "Comment");
  const input = commentBodySchema.parse(req.body);
  res.json({ data: await commentsService.updateComment(ctx, commentId, input) });
}

export async function deleteComment(req: Request, res: Response) {
  const ctx = getTenantContext(req);
  const commentId = uuidParam(req, "commentId", "Comment");
  await commentsService.deleteComment(ctx, commentId);
  res.sendStatus(204);
}
