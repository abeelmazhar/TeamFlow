// ⚠️ TEMPORARY: replaced by real session auth in Phase 4. Delete this file then.
import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { unauthorized } from "../lib/errors.js";

if (env.NODE_ENV === "production") {
  throw new Error("devAuth must never run in production");
}

export function devAuth(req: Request, _res: Response, next: NextFunction) {
  const parsed = z.uuid().safeParse(req.header("x-dev-user-id"));
  if (!parsed.success) {
    return next(unauthorized());
  }
  req.auth = { userId: parsed.data };
  next();
}