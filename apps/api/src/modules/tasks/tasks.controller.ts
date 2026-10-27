import type { Request, Response } from "express";
import { getTenantContext } from "../../lib/tenant-context.js";
import { uuidParam } from "../../lib/params.js";
import { createTaskBodySchema, listTasksQuerySchema } from "./tasks.schemas.js";
import * as tasksService from "./tasks.service.js";

export async function listTasks(req: Request, res: Response) {
  const ctx = getTenantContext(req);
  const projectId = uuidParam(req, "projectId", "Project");
  const query = listTasksQuerySchema.parse(req.query);
  const result = await tasksService.listTasks(ctx, projectId, query);
  res.json({ data: result.items, meta: { pagination: result.pagination } });
}

export async function createTask(req: Request, res: Response) {
  const ctx = getTenantContext(req);
  const projectId = uuidParam(req, "projectId", "Project");
  const input = createTaskBodySchema.parse(req.body);
  const task = await tasksService.createTask(ctx, projectId, input);
  res.status(201).json({ data: task });
}
