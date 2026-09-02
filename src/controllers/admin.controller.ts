import type { Request, Response } from "express";
import { User } from "@/models/User.model.ts";
import { Room } from "@/models/Room.model.ts";
import { Note } from "@/models/Note.model.ts";
import { Device } from "@/models/Device.model.ts";
import { Transfer } from "@/models/Transfer.model.ts";
import { Activity } from "@/models/Activity.model.ts";
import { PageView } from "@/models/PageView.model.ts";
import { ApiError } from "@/utils/ApiError.ts";
import { asyncHandler } from "@/utils/asyncHandler.ts";
import { sendEmail } from "@/services/mailer.service.ts";
import { dailyCounts } from "@/utils/dailyCounts.ts";

function toAdminUser(user: InstanceType<typeof User>) {
  return {
    id: user._id,
    name: user.get("name"),
    email: user.get("email"),
    authProvider: user.get("authProvider"),
    avatarUrl: user.get("avatarUrl"),
    createdAt: user.get("createdAt"),
    updatedAt: user.get("updatedAt"),
    lastLoginAt: user.get("lastLoginAt"),
  };
}

export const getOverview = asyncHandler(async (_req: Request, res: Response) => {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    guestUsers,
    googleUsers,
    passwordUsers,
    totalNotes,
    publicNotes,
    totalRooms,
    totalDevices,
    totalTransfers,
    completedTransfers,
    visits24h,
    visits7d,
    visits30d,
    visitsAllTime,
    uniqueVisitors30d,
    signupTrend,
    visitTrend,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ authProvider: "guest" }),
    User.countDocuments({ authProvider: "google" }),
    User.countDocuments({ authProvider: "password" }),
    Note.countDocuments(),
    Note.countDocuments({ "publicShare.enabled": true }),
    Room.countDocuments(),
    Device.countDocuments(),
    Transfer.countDocuments(),
    Transfer.countDocuments({ status: "completed" }),
    PageView.countDocuments({ createdAt: { $gte: since24h } }),
    PageView.countDocuments({ createdAt: { $gte: since7d } }),
    PageView.countDocuments({ createdAt: { $gte: since30d } }),
    PageView.countDocuments(),
    PageView.distinct("sessionId", { createdAt: { $gte: since30d } }).then((ids) => ids.length),
    dailyCounts(User, 30),
    dailyCounts(PageView, 30),
  ]);

  res.json({
    success: true,
    data: {
      users: { total: totalUsers, guest: guestUsers, google: googleUsers, password: passwordUsers },
      notes: { total: totalNotes, public: publicNotes },
      rooms: { total: totalRooms },
      devices: { total: totalDevices },
      transfers: { total: totalTransfers, completed: completedTransfers },
      visits: { last24h: visits24h, last7d: visits7d, last30d: visits30d, allTime: visitsAllTime, uniqueLast30d: uniqueVisitors30d },
      signupTrend,
      visitTrend,
    },
  });
});

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const { search, authProvider, page, limit } = req.query as unknown as {
    search?: string;
    authProvider?: string;
    page: number;
    limit: number;
  };

  const filter: Record<string, unknown> = {};
  if (authProvider) filter.authProvider = authProvider;
  if (search) {
    const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: re }, { email: re }];
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: { users: users.map(toAdminUser), total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) },
  });
});

export const getUserDetail = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.params.userId);
  if (!user) throw ApiError.notFound("User not found");

  const userId = user._id;
  const [
    noteCount,
    roomCount,
    deviceCount,
    transferCount,
    publicNoteCount,
    completedBytes,
    devices,
    rooms,
    recentNotes,
    recentTransfers,
    recentActivity,
  ] = await Promise.all([
    Note.countDocuments({ ownerId: userId }),
    Room.countDocuments({ ownerId: userId }),
    Device.countDocuments({ ownerId: userId }),
    Transfer.countDocuments({ ownerId: userId }),
    Note.countDocuments({ ownerId: userId, "publicShare.enabled": true }),
    Transfer.aggregate<{ _id: null; total: number }>([
      { $match: { ownerId: userId, status: "completed" } },
      { $group: { _id: null, total: { $sum: "$size" } } },
    ]).then((rows) => rows[0]?.total ?? 0),
    Device.find({ ownerId: userId }).sort({ lastSeenAt: -1 }).limit(10).select("name type platform status lastSeenAt"),
    Room.find({ ownerId: userId }).sort({ createdAt: -1 }).limit(10).select("name type isDefault createdAt"),
    Note.find({ ownerId: userId })
      .sort({ updatedAt: -1 })
      .limit(10)
      .select("title visibility publicShare.enabled publicShare.viewCount updatedAt"),
    Transfer.find({ ownerId: userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .select("name type status transferMethod size createdAt")
      .populate("senderDeviceId", "name")
      .populate("receiverDeviceId", "name"),
    Activity.find({ ownerId: userId }).sort({ createdAt: -1 }).limit(10).select("type message createdAt"),
  ]);

  res.json({
    success: true,
    data: {
      user: toAdminUser(user),
      counts: {
        notes: noteCount,
        rooms: roomCount,
        devices: deviceCount,
        transfers: transferCount,
        publicNotes: publicNoteCount,
        completedBytes,
      },
      devices,
      rooms,
      recentNotes,
      recentTransfers,
      recentActivity,
    },
  });
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const { name, email } = req.body as { name?: string; email?: string };

  if (email) {
    const existing = await User.findOne({ email, _id: { $ne: req.params.userId } });
    if (existing) throw ApiError.conflict("Another account already uses that email");
  }

  const user = await User.findByIdAndUpdate(req.params.userId, { $set: { name, email } }, { new: true });
  if (!user) throw ApiError.notFound("User not found");

  res.json({ success: true, data: { user: toAdminUser(user) } });
});

// Invalidates every refresh token issued so far for this user (see
// User.model.ts tokenVersion) — they're signed out everywhere within one
// access-token lifetime (15m) and can't silently refresh past it.
export const resetUserSessions = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findByIdAndUpdate(req.params.userId, { $inc: { tokenVersion: 1 } }, { new: true });
  if (!user) throw ApiError.notFound("User not found");
  res.json({ success: true, data: { user: toAdminUser(user) } });
});

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.params.userId;
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound("User not found");

  await Promise.all([
    Device.deleteMany({ ownerId: userId }),
    Room.deleteMany({ ownerId: userId }),
    Note.deleteMany({ ownerId: userId }),
    Transfer.deleteMany({ ownerId: userId }),
    Activity.deleteMany({ ownerId: userId }),
    Room.updateMany({ memberIds: userId }, { $pull: { memberIds: userId } }),
  ]);
  await User.findByIdAndDelete(userId);

  res.json({ success: true, data: { deleted: true } });
});

export const exportUsersCsv = asyncHandler(async (_req: Request, res: Response) => {
  const users = await User.find().sort({ createdAt: -1 });

  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = ["id", "name", "email", "authProvider", "createdAt"].join(",");
  const rows = users.map((u) =>
    [u._id, u.get("name"), u.get("email") ?? "", u.get("authProvider"), u.get("createdAt")].map(escape).join(",")
  );

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="syncblaze-users-${Date.now()}.csv"`);
  res.send([header, ...rows].join("\n"));
});

export const sendUserEmail = asyncHandler(async (req: Request, res: Response) => {
  const { subject, message } = req.body as { subject: string; message: string };
  const user = await User.findById(req.params.userId).select("email name");
  const email = user?.get("email") as string | undefined;
  if (!user || !email) throw ApiError.notFound("This user doesn't have an email address on file");

  const html = `<p>Hi ${user.get("name")},</p><p>${message.replace(/\n/g, "<br/>")}</p>`;
  await sendEmail({ to: email, subject, html });

  res.json({ success: true, data: { sent: true } });
});

export const getVisitTrend = asyncHandler(async (req: Request, res: Response) => {
  const { days } = req.query as unknown as { days: number };
  const trend = await dailyCounts(PageView, days);
  res.json({ success: true, data: { trend } });
});
