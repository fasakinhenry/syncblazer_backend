import { Router } from "express";
import { getLinkPreview } from "@/controllers/linkPreview.controller.ts";
import { requireAuth } from "@/middleware/auth.middleware.ts";
import { validate } from "@/middleware/validate.middleware.ts";
import { linkPreviewQuerySchema } from "@/validators/linkPreview.validators.ts";

export const linkPreviewRouter = Router();

linkPreviewRouter.get("/", requireAuth, validate({ query: linkPreviewQuerySchema }), getLinkPreview);
