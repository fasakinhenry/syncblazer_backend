import { Router } from "express";
import multer from "multer";
import {
  downloadRoomFile,
  likeRoomFile,
  listRoomFiles,
  previewRoomFile,
  unlikeRoomFile,
  uploadRoomFiles,
  viewRoomFile,
} from "@/controllers/roomFile.controller.ts";
import { requireAuth } from "@/middleware/auth.middleware.ts";
import { validate } from "@/middleware/validate.middleware.ts";
import { env } from "@/config/env.ts";
import {
  roomFileIdParamSchema,
  roomFileListQuerySchema,
  roomFileRoomParamSchema,
  uploadRoomFilesBodySchema,
} from "@/validators/roomFile.validators.ts";

// Own top-level router (mirrors chat.routes.ts's pattern rather than
// nesting under room.routes.ts) so roomId is just the first path segment
// on every route, no Express mergeParams gotcha to worry about.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxUploadSizeMb * 1024 * 1024 },
});

export const roomFileRouter = Router();

roomFileRouter.use(requireAuth);

roomFileRouter.get("/:roomId", validate({ params: roomFileRoomParamSchema, query: roomFileListQuerySchema }), listRoomFiles);
roomFileRouter.post(
  "/:roomId",
  validate({ params: roomFileRoomParamSchema }),
  upload.array("files", 20),
  validate({ body: uploadRoomFilesBodySchema }),
  uploadRoomFiles
);
roomFileRouter.get("/:roomId/:fileId/download", validate({ params: roomFileIdParamSchema }), downloadRoomFile);
roomFileRouter.get("/:roomId/:fileId/preview", validate({ params: roomFileIdParamSchema }), previewRoomFile);
roomFileRouter.post("/:roomId/:fileId/like", validate({ params: roomFileIdParamSchema }), likeRoomFile);
roomFileRouter.delete("/:roomId/:fileId/like", validate({ params: roomFileIdParamSchema }), unlikeRoomFile);
roomFileRouter.post("/:roomId/:fileId/view", validate({ params: roomFileIdParamSchema }), viewRoomFile);
