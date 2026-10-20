import express from "express";
import type { Request, Response } from "express";
import { pool } from "./db/pool.js";
import { errorHandler } from "./middleware/error-handler.js";
import { notFoundHandler } from "./middleware/not-found.js";

export const app = express();
app.disable("x-powered-by");

app.use(express.json());

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ data: { status: "ok" } });
});

app.get("/ready", (_req: Request, res: Response) => {
  
  pool.query("SELECT 1", (err, result) => {
    if (err) {
      res.status(500).json({ error: { code: "DATABASE_ERROR", message: err.message } });
    } else {
      res.status(200).json({ data: { status: "ok" } });
    }
  }); 
});

app.use(notFoundHandler); // no route matched
app.use(errorHandler);    // must be LAST


