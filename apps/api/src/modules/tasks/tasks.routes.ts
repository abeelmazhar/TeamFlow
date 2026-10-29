import { Router } from "express";
import { taskCommentsRouter } from "../comments/comments.routes.js";
import * as controller from "./tasks.controller.js";

export const tasksRouter = Router({ mergeParams: true });

tasksRouter.get("/", controller.listTasks);
tasksRouter.post("/", controller.createTask);

export const taskRouter = Router({ mergeParams: true });

taskRouter.use("/:taskId/comments", taskCommentsRouter);

taskRouter.get("/:taskId", controller.getTask);
taskRouter.patch("/:taskId", controller.updateTask);
taskRouter.delete("/:taskId", controller.deleteTask);
