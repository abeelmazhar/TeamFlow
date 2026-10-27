import { Router } from "express";
import * as controller from "./tasks.controller.js";

export const tasksRouter = Router({ mergeParams: true });

tasksRouter.get("/", controller.listTasks);
tasksRouter.post("/", controller.createTask);
