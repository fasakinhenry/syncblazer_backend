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
  /** Client-generated, since a multi-file send is now one request per
   * file (for real per-file upload progress) rather than one request
   * carrying every file — without this, nothing would tie those separate
   * rows back together as "sent as one batch" for a "download all". */
  batchId: z.string().min(1).optional(),
  /** The folder-relative path, only when this file came from a folder
   * pick — kept separate from the file's own name/originalname, which
   * stays just the plain leaf filename everywhere it's displayed. */
  relativePath: z.string().min(1).optional(),
});
