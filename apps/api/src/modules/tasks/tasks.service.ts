import { pool } from "../../db/pool.js";
import { withTransaction } from "../../db/transaction.js";
import { badRequest, conflict, forbidden, notFound } from "../../lib/errors.js";
import { assertCan } from "../../lib/permissions.js";
import type { TenantContext } from "../../lib/tenant-context.js";
import { insertActivity } from "../activity/activity.repository.js";
import { findMembership } from "../memberships/memberships.repository.js";
import * as projectsRepo from "../projects/projects.repository.js";
import * as projectsService from "../projects/projects.service.js";
import { canEditTask } from "./tasks.policy.js";
import type { CreateTaskInput, ListTasksQuery, UpdateTaskInput } from "./tasks.schemas.js";
import * as tasksRepo from "./tasks.repository.js";
import type { Task } from "./tasks.repository.js";

export async function createTask(
  ctx: TenantContext,
  projectId: string,
  input: CreateTaskInput,
): Promise<Task> {
  assertCan(ctx.role, "task:create");

  return withTransaction(async (tx) => {
    const project = await projectsRepo.findProjectById(tx, ctx.organizationId, projectId, {
      forShare: true,
    });
    if (!project) throw notFound("Project not found");
    if (project.archivedAt !== null) {
      throw conflict("Project is archived. Unarchive it before adding tasks.");
    }

    if (input.assigneeId) {
      const membership = await findMembership(tx, ctx.organizationId, input.assigneeId);
      if (!membership) {
        throw badRequest("Assignee must be a member of this organization", [
          { path: "assigneeId", message: "Not a member of this organization" },
        ]);
      }
    }

    const task = await tasksRepo.insertTask(tx, {
      organizationId: ctx.organizationId,
      projectId,
      title: input.title,
      description: input.description || null,
      priority: input.priority,
      dueDate: input.dueDate ?? null,
      assigneeId: input.assigneeId ?? null,
      createdBy: ctx.userId,
    });

    await insertActivity(tx, {
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: "task.created",
      entityType: "task",
      entityId: task.id,
      projectId,
      metadata: { title: task.title, assigneeId: task.assigneeId },
    });

    return task;
  });
}

export async function listTasks(ctx: TenantContext, projectId: string, query: ListTasksQuery) {
  await projectsService.getProject(ctx, projectId);

  const offset = (query.page - 1) * query.limit;
  const filters = { status: query.status, assigneeId: query.assigneeId };
  const [total, items] = await Promise.all([
    tasksRepo.countTasks(pool, ctx.organizationId, projectId, filters),
    tasksRepo.listTasks(pool, ctx.organizationId, projectId, filters, {
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

export async function getTask(ctx: TenantContext, taskId: string): Promise<Task> {
  const task = await tasksRepo.findTaskById(pool, ctx.organizationId, taskId);
  if (!task) throw notFound("Task not found");
  return task;
}

const TASK_FIELDS = ["title", "description", "status", "priority", "dueDate", "assigneeId"] as const;

export async function updateTask(
  ctx: TenantContext,
  taskId: string,
  input: UpdateTaskInput,
): Promise<Task> {
  return withTransaction(async (tx) => {
    const current = await tasksRepo.findTaskById(tx, ctx.organizationId, taskId, {
      forUpdate: true,
    });
    if (!current) throw notFound("Task not found");
    if (!canEditTask(ctx, current)) throw forbidden();

    const assigneeChanging =
      input.assigneeId !== undefined && input.assigneeId !== current.assigneeId;
    if (assigneeChanging) {
      assertCan(ctx.role, "task:assign");
      if (input.assigneeId !== null) {
        const membership = await findMembership(tx, ctx.organizationId, input.assigneeId);
        if (!membership) {
          throw badRequest("Assignee must be a member of this organization", [
            { path: "assigneeId", message: "Not a member of this organization" },
          ]);
        }
      }
    }

    const project = await projectsRepo.findProjectById(tx, ctx.organizationId, current.projectId, {
      forShare: true,
    });
    if (project?.archivedAt) {
      throw conflict("Project is archived. Unarchive it before editing tasks.");
    }

    const updated = await tasksRepo.updateTask(tx, ctx.organizationId, taskId, {
      ...input,
      description: input.description === undefined ? undefined : input.description || null,
    });

    const changes: Record<string, { from: string | null; to: string | null }> = {};
    for (const field of TASK_FIELDS) {
      if (current[field] !== updated[field]) {
        changes[field] = { from: current[field], to: updated[field] };
      }
    }

    if (Object.keys(changes).length > 0) {
      await insertActivity(tx, {
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        action: "task.updated",
        entityType: "task",
        entityId: taskId,
        projectId: current.projectId,
        metadata: changes,
      });
    }

    return updated;
  });
}

export async function deleteTask(ctx: TenantContext, taskId: string): Promise<void> {
  await withTransaction(async (tx) => {
    const current = await tasksRepo.findTaskById(tx, ctx.organizationId, taskId, {
      forUpdate: true,
    });
    if (!current) throw notFound("Task not found");
    if (!canEditTask(ctx, current)) throw forbidden();

    const project = await projectsRepo.findProjectById(tx, ctx.organizationId, current.projectId, {
      forShare: true,
    });
    if (project?.archivedAt) {
      throw conflict("Project is archived. Unarchive it before deleting tasks.");
    }

    await tasksRepo.softDeleteTask(tx, ctx.organizationId, taskId);

    await insertActivity(tx, {
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: "task.deleted",
      entityType: "task",
      entityId: taskId,
      projectId: current.projectId,
      metadata: { title: current.title },
    });
  });
}
