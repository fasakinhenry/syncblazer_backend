import { Router } from "express";
import {
  getUnreadCount,
  getVapidPublicKey,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  registerPushSubscription,
  unregisterPushSubscription,
} from "@/controllers/notification.controller.ts";
import { requireAuth } from "@/middleware/auth.middleware.ts";
import { validate } from "@/middleware/validate.middleware.ts";
import {
  notificationIdParamSchema,
  notificationListQuerySchema,
  registerPushSubscriptionSchema,
  unregisterPushSubscriptionSchema,
} from "@/validators/notification.validators.ts";

export const notificationRouter = Router();

notificationRouter.use(requireAuth);

notificationRouter.get("/", validate({ query: notificationListQuerySchema }), listNotifications);
notificationRouter.get("/unread-count", getUnreadCount);
notificationRouter.get("/vapid-public-key", getVapidPublicKey);
notificationRouter.post(
  "/:notificationId/read",
  validate({ params: notificationIdParamSchema }),
  markNotificationRead
);
notificationRouter.post("/read-all", markAllNotificationsRead);
notificationRouter.post(
  "/push-subscriptions",
  validate({ body: registerPushSubscriptionSchema }),
  registerPushSubscription
);
notificationRouter.delete(
  "/push-subscriptions",
  validate({ body: unregisterPushSubscriptionSchema }),
  unregisterPushSubscription
);
