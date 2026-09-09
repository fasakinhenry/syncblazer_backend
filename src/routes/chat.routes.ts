import { Router } from "express";
import multer from "multer";
import {
  getChatDevices,
  getChatEpoch,
  getChatUnreadInfo,
  getMyKeyEnvelopes,
  listMessages,
  rotateChatEpoch,
  serveChatAttachment,
  uploadChatAttachment,
  uploadKeyEnvelopes,
} from "@/controllers/chat.controller.ts";
import { requireAuth } from "@/middleware/auth.middleware.ts";
import { validate } from "@/middleware/validate.middleware.ts";
import {
  chatMessagesQuerySchema,
  chatRoomParamSchema,
  chatUnreadQuerySchema,
  uploadEnvelopesSchema,
} from "@/validators/chat.validators.ts";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // ciphertext runs slightly larger than plaintext; 25MB covers a photo or a voice note comfortably
});

export const chatRouter = Router();

chatRouter.use(requireAuth);

chatRouter.post("/attachments", upload.single("file"), uploadChatAttachment);
chatRouter.get("/attachments/:key", serveChatAttachment);

chatRouter.get("/:roomId/devices", validate({ params: chatRoomParamSchema }), getChatDevices);
chatRouter.get("/:roomId/epoch", validate({ params: chatRoomParamSchema }), getChatEpoch);
chatRouter.post("/:roomId/rotate", validate({ params: chatRoomParamSchema }), rotateChatEpoch);
chatRouter.post(
  "/:roomId/key-envelopes",
  validate({ params: chatRoomParamSchema, body: uploadEnvelopesSchema }),
  uploadKeyEnvelopes
);
chatRouter.get("/:roomId/key-envelopes", validate({ params: chatRoomParamSchema }), getMyKeyEnvelopes);
chatRouter.get(
  "/:roomId/messages",
  validate({ params: chatRoomParamSchema, query: chatMessagesQuerySchema }),
  listMessages
);
chatRouter.get(
  "/:roomId/unread",
  validate({ params: chatRoomParamSchema, query: chatUnreadQuerySchema }),
  getChatUnreadInfo
);
