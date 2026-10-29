import { z } from "zod";

export const commentBodySchema = z.strictObject({
  body: z.string().trim().min(1).max(5000),
});
export type CommentBodyInput = z.infer<typeof commentBodySchema>;

export const listCommentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListCommentsQuery = z.infer<typeof listCommentsQuerySchema>;