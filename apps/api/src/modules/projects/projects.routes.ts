import { Router } from "express";
import * as controller from "./projects.controller.js";

export const projectsRouter = Router();

projectsRouter.get("/", controller.listProjects);
projectsRouter.post("/", controller.createProject);