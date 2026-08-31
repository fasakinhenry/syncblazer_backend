import { Router } from "express";
import { authRouter } from "@/routes/auth.routes.ts";
import { deviceRouter } from "@/routes/device.routes.ts";
import { roomRouter } from "@/routes/room.routes.ts";
import { noteRouter } from "@/routes/note.routes.ts";
import { transferRouter } from "@/routes/transfer.routes.ts";
import { activityRouter } from "@/routes/activity.routes.ts";
import { uploadRouter } from "@/routes/upload.routes.ts";
import { noteAssetRouter } from "@/routes/noteAsset.routes.ts";
import { linkPreviewRouter } from "@/routes/linkPreview.routes.ts";

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
  res.json({ success: true, data: { status: "ok", uptime: process.uptime() } });
});

apiRouter.use("/auth", authRouter);
apiRouter.use("/devices", deviceRouter);
apiRouter.use("/rooms", roomRouter);
apiRouter.use("/notes", noteRouter);
apiRouter.use("/transfers", transferRouter);
apiRouter.use("/activity", activityRouter);
apiRouter.use("/uploads", uploadRouter);
apiRouter.use("/note-images", noteAssetRouter);
apiRouter.use("/link-preview", linkPreviewRouter);
