import { Router } from "express";
import { listActivity } from "@/controllers/activity.controller.ts";
import { requireAuth } from "@/middleware/auth.middleware.ts";

export const activityRouter = Router();

activityRouter.use(requireAuth);

activityRouter.get("/", listActivity);
