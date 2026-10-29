import { can } from "../../lib/permissions.js";
import type { TenantContext } from "../../lib/tenant-context.js";
import type { CommentContext } from "./comments.repository.js";

/** Only the author can edit a comment. No role can override this. */
export function canEditComment(ctx: TenantContext, comment: Pick<CommentContext, "authorId">): boolean {
  return comment.authorId === ctx.userId;
}

/** The author can delete their comment, and so can a role with comment:delete_any. */
export function canDeleteComment(ctx: TenantContext, comment: Pick<CommentContext, "authorId">): boolean {
  return comment.authorId === ctx.userId || can(ctx.role, "comment:delete_any");
}
