import { z } from "zod";

export const roomFileRoomParamSchema = z.object({
  roomId: z.string().min(1),
});

export const roomFileIdParamSchema = z.object({
  roomId: z.string().min(1),
  fileId: z.string().min(1),
});

export const roomFileListQuerySchema = z.object({
  before: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

// multer parses the multipart body's non-file fields as plain strings —
// validated after multer runs, same order chat.routes.ts's attachment
// upload already uses.
export const uploadRoomFilesBodySchema = z.object({
  recipientId: z.string().min(1).optional(),
  deliverTo: z.enum(["device", "user"]).optional(),
  deviceId: z.string().min(1).optional(),
});
