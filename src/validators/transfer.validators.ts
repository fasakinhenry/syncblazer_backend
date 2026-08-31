import { z } from "zod";
import { TransferType, TransferMethod, TransferStatus } from "@/constants/index.ts";

export const createTransferSchema = z
  .object({
    roomId: z.string().min(1),
    senderDeviceId: z.string().min(1),
    receiverDeviceId: z.string().min(1),
    type: z.enum([TransferType.FILE, TransferType.IMAGE, TransferType.TEXT, TransferType.LINK]),
    name: z.string().min(1).max(300),
    size: z.number().min(0).default(0),
    mimeType: z.string().max(150).optional(),
    textContent: z.string().max(200_000).optional(),
    storageKey: z.string().optional(),
    transferMethod: z.enum([TransferMethod.LOCAL, TransferMethod.CLOUD]),
  })
  .refine(
    (data) => {
      if ([TransferType.TEXT, TransferType.LINK].includes(data.type as "text" | "link")) {
        return !!data.textContent;
      }
      return true;
    },
    { message: "textContent is required for text/link transfers", path: ["textContent"] }
  );

export const updateTransferStatusSchema = z.object({
  status: z.enum([
    TransferStatus.QUEUED,
    TransferStatus.CONNECTING,
    TransferStatus.TRANSFERRING,
    TransferStatus.COMPLETED,
    TransferStatus.FAILED,
    TransferStatus.RETRYING,
    TransferStatus.CANCELLED,
  ]),
  progress: z.number().min(0).max(100).optional(),
  errorMessage: z.string().max(500).optional(),
});

export const transferIdParamSchema = z.object({
  transferId: z.string().min(1),
});

export const listTransfersQuerySchema = z.object({
  roomId: z.string().min(1).optional(),
  type: z.enum([TransferType.FILE, TransferType.IMAGE, TransferType.TEXT, TransferType.LINK]).optional(),
  status: z.string().optional(),
  direction: z.enum(["sent", "received"]).optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  cursor: z.string().optional(),
});
