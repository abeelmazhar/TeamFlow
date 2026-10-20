import { pool } from "../../db/pool.js";
import type { TenantContext } from "../../lib/tenant-context.js";
import type { ListProjectsQuery } from "./projects.schemas.js";
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
