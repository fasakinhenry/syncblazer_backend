import { Router } from "express";
import multer from "multer";
import { downloadAsset, uploadAsset } from "@/controllers/upload.controller.ts";
import { requireAuth } from "@/middleware/auth.middleware.ts";
import { env } from "@/config/env.ts";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxUploadSizeMb * 1024 * 1024 },
});

export const uploadRouter = Router();

uploadRouter.use(requireAuth);

uploadRouter.post("/", upload.single("file"), uploadAsset);
uploadRouter.get("/:transferId", downloadAsset);
