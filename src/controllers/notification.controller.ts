import type { Request, Response } from "express";
import { Notification } from "@/models/Notification.model.ts";
import { PushSubscription } from "@/models/PushSubscription.model.ts";
import { User } from "@/models/User.model.ts";
import { env } from "@/config/env.ts";
import { ApiError } from "@/utils/ApiError.ts";
import { asyncHandler } from "@/utils/asyncHandler.ts";
import { getIO } from "@/sockets/socket.server.ts";

export const listNotifications = asyncHandler(async (req: Request, res: Response) => {
  const { category, before, limit } = req.query as { category?: string; before?: string; limit?: number };
  const query: Record<string, unknown> = { userId: req.userId };
  if (category) query.category = category;
  if (before) query.createdAt = { $lt: new Date(before) };
  const pageSize = limit ?? 50;

  const docs = await Notification.find(query).sort({ createdAt: -1 }).limit(pageSize).lean();

  const actorIds = [...new Set(docs.map((d) => d.actorId).filter(Boolean).map((id) => String(id)))];
  const actors = await User.find({ _id: { $in: actorIds } }).select("name avatarUrl").lean();
  const actorById = new Map(actors.map((a) => [String(a._id), a]));

  const notifications = docs.map((d) => {
    const actor = d.actorId ? actorById.get(String(d.actorId)) : undefined;
    return {
      ...d,
      _id: d._id.toString(),
      actorName: actor?.name,
      actorAvatarUrl: actor?.avatarUrl,
    };
  });

  res.json({
    success: true,
    data: {
      notifications,
      nextCursor: docs.length === pageSize ? docs[docs.length - 1]!.createdAt.toISOString() : null,
    },
  });
});

export const getUnreadCount = asyncHandler(async (req: Request, res: Response) => {
  const count = await Notification.countDocuments({ userId: req.userId, readAt: null });
  res.json({ success: true, data: { count } });
});

export const markNotificationRead = asyncHandler(async (req: Request, res: Response) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.notificationId, userId: req.userId, readAt: null },
    { readAt: new Date() },
    { new: true }
  );
  if (!notification) throw ApiError.notFound("Notification not found");

  getIO()?.to(`user:${req.userId}`).emit("notification:read", { id: notification._id });
  res.json({ success: true, data: { id: notification._id } });
});

export const markAllNotificationsRead = asyncHandler(async (req: Request, res: Response) => {
  await Notification.updateMany({ userId: req.userId, readAt: null }, { readAt: new Date() });
  getIO()?.to(`user:${req.userId}`).emit("notification:read-all");
  res.json({ success: true, data: { marked: true } });
});

// Fetched at runtime rather than baked into a VITE_ env var so the frontend
// build doesn't need to change the moment push gets configured (or removed)
// on Render.
export const getVapidPublicKey = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: { publicKey: env.vapidPublicKey ?? null } });
});

export const registerPushSubscription = asyncHandler(async (req: Request, res: Response) => {
  const { endpoint, keys, deviceId } = req.body as { endpoint: string; keys: { p256dh: string; auth: string }; deviceId?: string };
  const subscription = await PushSubscription.findOneAndUpdate(
    { endpoint },
    {
      ownerId: req.userId,
      deviceId: deviceId ?? req.deviceId,
      keys,
      userAgent: req.headers["user-agent"],
    },
    { upsert: true, new: true }
  );
  res.status(201).json({ success: true, data: { id: subscription._id } });
});

export const unregisterPushSubscription = asyncHandler(async (req: Request, res: Response) => {
  const { endpoint } = req.body as { endpoint: string };
  await PushSubscription.deleteOne({ endpoint, ownerId: req.userId });
  res.json({ success: true, data: { removed: true } });
});
