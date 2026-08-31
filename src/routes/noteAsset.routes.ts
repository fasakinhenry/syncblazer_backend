import { Router } from "express";
import multer from "multer";
import { serveNoteImage, uploadNoteImage } from "@/controllers/noteAsset.controller.ts";
import { requireAuth } from "@/middleware/auth.middleware.ts";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB is plenty for a note image
});

export const noteAssetRouter = Router();

noteAssetRouter.post("/", requireAuth, upload.single("image"), uploadNoteImage);
noteAssetRouter.get("/:key", serveNoteImage); // public: rendered via <img src>
