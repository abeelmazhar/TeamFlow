import { Router } from "express";
import * as controller from "./projects.controller.js";

export const projectsRouter = Router();

projectsRouter.get("/", controller.listProjects);
projectsRouter.post("/", controller.createProject);

projectsRouter.get("/:projectId", controller.getProject);
projectsRouter.patch("/:projectId", controller.updateProject);
projectsRouter.post("/:projectId/archive", controller.archiveProject);
projectsRouter.post("/:projectId/unarchive", controller.unarchiveProject);