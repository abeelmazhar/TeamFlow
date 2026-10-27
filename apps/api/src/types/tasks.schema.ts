import { z } from "zod";

export const TASK_STATUSES = ["todo", "in_progress", "in_review", "done"] as const;
export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const createTaskBodySchema = z.strictObject({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(10000).optional(),
  priority: z.enum(TASK_PRIORITIES).default("medium"),
  dueDate: z.iso.date().optional(),           // "2026-11-30"
  assigneeId: z.uuid().nullable().optional(),
});
export type CreateTaskInput = z.infer<typeof createTaskBodySchema>;

export const listTasksQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(TASK_STATUSES).optional(),
  assigneeId: z.uuid().optional(),
});
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;