import { Router } from "express";
import { tasksRouter } from "../tasks/tasks.routes.js";
import * as controller from "./projects.controller.js";

export const projectsRouter = Router();

projectsRouter.use("/:projectId/tasks", tasksRouter);

projectsRouter.get("/", controller.listProjects);
projectsRouter.post("/", controller.createProject);

projectsRouter.get("/:projectId", controller.getProject);
projectsRouter.patch("/:projectId", controller.updateProject);
projectsRouter.post("/:projectId/archive", controller.archiveProject);
projectsRouter.post("/:projectId/unarchive", controller.unarchiveProject);