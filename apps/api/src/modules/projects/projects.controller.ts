import { uuidParam } from "../../lib/params.js";
import { updateProjectBodySchema } from "./projects.schemas.js";
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



export async function getProject(req: Request, res: Response) {
  const ctx = getTenantContext(req);
  const projectId = uuidParam(req, "projectId", "Project");
  res.json({ data: await projectsService.getProject(ctx, projectId) });
}

export async function updateProject(req: Request, res: Response) {
  const ctx = getTenantContext(req);
  const projectId = uuidParam(req, "projectId", "Project");
  const input = updateProjectBodySchema.parse(req.body);
  res.json({ data: await projectsService.updateProject(ctx, projectId, input) });
}

export async function archiveProject(req: Request, res: Response) {
  const ctx = getTenantContext(req);
  const projectId = uuidParam(req, "projectId", "Project");
  res.json({ data: await projectsService.setProjectArchived(ctx, projectId, true) });
}

export async function unarchiveProject(req: Request, res: Response) {
  const ctx = getTenantContext(req);
  const projectId = uuidParam(req, "projectId", "Project");
  res.json({ data: await projectsService.setProjectArchived(ctx, projectId, false) });
}