import { can } from "../../lib/permissions.js";
import type { TenantContext } from "../../lib/tenant-context.js";
import type { Task } from "./tasks.repository.js";

/** Can this user edit or delete this task? */
export function canEditTask(ctx: TenantContext, task: Pick<Task, "assigneeId">): boolean {
  return can(ctx.role, "task:manage") || task.assigneeId === ctx.userId;
}
