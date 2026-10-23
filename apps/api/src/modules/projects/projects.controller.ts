import type { Request, Response } from "express";
import { getTenantContext } from "../../lib/tenant-context.js";
import { listProjectsQuerySchema } from "./projects.schemas.js";
import * as projectsService from "./projects.service.js";
import { createProjectBodySchema } from "./projects.schemas.js";

export async function listProjects(req: Request, res: Response) {
  const ctx = getTenantContext(req);
  const query = listProjectsQuerySchema.parse(req.query); // throws ZodError → 400
  const result = await projectsService.listProjects(ctx, query);
  res.json({ data: result.items, meta: { pagination: result.pagination } });
}


export async function createProject(req: Request, res: Response) {
  const ctx = getTenantContext(req);
  const input = createProjectBodySchema.parse(req.body); // 400 on bad/extra fields
  const project = await projectsService.createProject(ctx, input);
  res.status(201).json({ data: project });
}