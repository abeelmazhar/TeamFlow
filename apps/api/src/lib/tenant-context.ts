import type { Request } from "express";
import type { Role } from "./roles.js";

/** Who is calling, in which org, with which role. Verified from the DB. */
export type TenantContext = {
  userId: string;
  organizationId: string;
  role: Role;
};

export function getTenantContext(req: Request): TenantContext {
  if (!req.membership) {
    // A programming mistake: the route forgot requireMembership.
    throw new Error("getTenantContext called on a route without requireMembership");
  }
  return req.membership;
}