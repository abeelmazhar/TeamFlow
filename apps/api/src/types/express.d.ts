import type { TenantContext } from "../lib/tenant-context.js";

declare global {
  namespace Express {
    interface Request {
      auth?: { userId: string };
      membership?: TenantContext;
    }
  }
}

export {};