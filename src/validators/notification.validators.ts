import { z } from "zod";
import { NotificationCategory } from "@/constants/index.ts";

export const notificationListQuerySchema = z.object({
  category: z.enum([NotificationCategory.ROOMS, NotificationCategory.DEVICES, NotificationCategory.NOTES]).optional(),
  before: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const notificationIdParamSchema = z.object({
  notificationId: z.string().min(1),
});

export const registerPushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  deviceId: z.string().optional(),
});

export const unregisterPushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
});
