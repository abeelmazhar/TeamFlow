import { Router } from "express";
import * as controller from "./comments.controller.js";

export const taskCommentsRouter = Router({ mergeParams: true });

taskCommentsRouter.get("/", controller.listComments);
taskCommentsRouter.post("/", controller.createComment);

export const commentRouter = Router({ mergeParams: true });

commentRouter.patch("/:commentId", controller.updateComment);
commentRouter.delete("/:commentId", controller.deleteComment);
