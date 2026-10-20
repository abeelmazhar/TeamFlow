import { z } from "zod";

export const listProjectsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["active", "archived", "all"]).default("active"),
});

export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;