import { pool } from "../../db/pool.js";
import { withTransaction } from "../../db/transaction.js";
import { conflict, notFound } from "../../lib/errors.js";
import { assertCan } from "../../lib/permissions.js";
import type { TenantContext } from "../../lib/tenant-context.js";
import { insertActivity } from "../activity/activity.repository.js";
import type { CreateProjectInput, ListProjectsQuery, UpdateProjectInput } from "./projects.schemas.js";
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

export async function getProject(ctx: TenantContext, projectId: string): Promise<Project> {
  const project = await projectsRepo.findProjectById(pool, ctx.organizationId, projectId);
  if (!project) throw notFound("Project not found");
  return project;
}

export async function updateProject(
  ctx: TenantContext,
  projectId: string,
  input: UpdateProjectInput,
): Promise<Project> {
  assertCan(ctx.role, "project:update");

  return withTransaction(async (tx) => {
    const current = await projectsRepo.findProjectById(tx, ctx.organizationId, projectId, {
      forUpdate: true,
    });
    if (!current) throw notFound("Project not found");
    if (current.archivedAt !== null) {
      throw conflict("Project is archived. Unarchive it before editing.");
    }

    const description = input.description === undefined ? undefined : input.description || null;
    const updated = await projectsRepo.updateProject(tx, ctx.organizationId, projectId, {
      name: input.name,
      description,
    });

    const changes: Record<string, { from: string | null; to: string | null }> = {};
    if (updated.name !== current.name) {
      changes.name = { from: current.name, to: updated.name };
    }
    if (updated.description !== current.description) {
      changes.description = { from: current.description, to: updated.description };
    }

    if (Object.keys(changes).length > 0) {
      await insertActivity(tx, {
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        action: "project.updated",
        entityType: "project",
        entityId: updated.id,
        projectId: updated.id,
        metadata: changes,
      });
    }

    return updated;
  });
}

export async function setProjectArchived(
  ctx: TenantContext,
  projectId: string,
  archived: boolean,
): Promise<Project> {
  assertCan(ctx.role, "project:archive");

  return withTransaction(async (tx) => {
    const current = await projectsRepo.findProjectById(tx, ctx.organizationId, projectId, {
      forUpdate: true,
    });
    if (!current) throw notFound("Project not found");

    const alreadyInState =
      (archived && current.archivedAt !== null) || (!archived && current.archivedAt === null);
    if (alreadyInState) return current;

    const updated = await projectsRepo.setProjectArchived(
      tx,
      ctx.organizationId,
      projectId,
      archived,
    );

    await insertActivity(tx, {
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: archived ? "project.archived" : "project.unarchived",
      entityType: "project",
      entityId: updated.id,
      projectId: updated.id,
    });

    return updated;
  });
}
