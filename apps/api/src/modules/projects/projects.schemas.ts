import { z } from "zod";

export const listProjectsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["active", "archived", "all"]).default("active"),
});

export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;


export const createProjectBodySchema = z.strictObject({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(5000).optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectBodySchema>;