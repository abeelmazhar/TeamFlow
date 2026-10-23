import { pool } from "../../db/pool.js";
import { withTransaction } from "../../db/transaction.js";
import { assertCan } from "../../lib/permissions.js";
import type { TenantContext } from "../../lib/tenant-context.js";
import { insertActivity } from "../activity/activity.repository.js";
import type { CreateProjectInput, ListProjectsQuery } from "./projects.schemas.js";
import type { Project } from "./projects.repository.js";
import * as projectsRepo from "./projects.repository.js";

export async function listProjects(ctx: TenantContext, query: ListProjectsQuery) {
  const offset = (query.page - 1) * query.limit;
  const [total, items] = await Promise.all([
    projectsRepo.countProjects(pool, ctx.organizationId, query.status),
    projectsRepo.listProjects(pool, ctx.organizationId, {
      status: query.status,
      limit: query.limit,
      offset,
    }),
  ]);

  return {
    items,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function createProject(ctx: TenantContext, input: CreateProjectInput): Promise<Project> {
  assertCan(ctx.role, "project:create");

  return withTransaction(async (tx) => {
    const project = await projectsRepo.insertProject(tx, {
      organizationId: ctx.organizationId,
      name: input.name,
      description: input.description || null,
      createdBy: ctx.userId,
    });

    await insertActivity(tx, {
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: "project.created",
      entityType: "project",
      entityId: project.id,
      projectId: project.id,
      metadata: { name: project.name },
    });

    return project;
  });
}
