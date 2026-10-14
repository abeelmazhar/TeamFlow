import express from "express";
import type { Request, Response } from "express";

export const app = express();
app.disable("x-powered-by");

app.use(express.json());

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ data: { status: "ok" } });
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: "Route not found",
    },
  });
});
