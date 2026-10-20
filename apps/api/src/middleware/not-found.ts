import type { Request, Response, NextFunction } from "express";
import { notFound } from "../lib/errors.js";

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction) {
  next(notFound("Route not found"));
}