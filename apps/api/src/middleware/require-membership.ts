import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { notFound, unauthorized } from "../lib/errors.js";
import { findMembership } from "../modules/memberships/memberships.repository.js";

export async function requireMembership(req: Request, _res: Response, next: NextFunction) {
  const parsed = z.uuid().safeParse(req.params.orgId);
  if (!parsed.success) {
    throw notFound("Organization not found");
  }

  if (!req.auth) {
    throw unauthorized();
  }

  const membership = await findMembership(pool, parsed.data, req.auth.userId);
  if (!membership) {
    throw notFound("Organization not found");
  }

  req.membership = membership;
  next();
}
