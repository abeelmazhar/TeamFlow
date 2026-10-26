import type { Request } from "express";
import { z } from "zod";
import { notFound } from "./errors.js";

/** Reads a UUID route param. Anything invalid becomes a 404 for that resource. */
export function uuidParam(req: Request, name: string, resource: string): string {
  const parsed = z.uuid().safeParse(req.params[name]);
  if (!parsed.success) {
    throw notFound(`${resource} not found`);
  }
  return parsed.data;
}