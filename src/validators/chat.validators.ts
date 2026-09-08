import { z } from "zod";

export const chatRoomParamSchema = z.object({
  roomId: z.string().min(1),
});

export const chatMessagesQuerySchema = z.object({
  before: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const envelopeSchema = z.object({
  deviceId: z.string().min(1),
  wrappedKey: z.string().min(1),
  iv: z.string().min(1),
});

export const uploadEnvelopesSchema = z.object({
  epoch: z.number().int().min(1),
  envelopes: z.array(envelopeSchema).min(1).max(200),
});
