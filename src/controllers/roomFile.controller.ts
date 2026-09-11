import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { RoomFile } from "@/models/RoomFile.model.ts";
import { User } from "@/models/User.model.ts";
import { ApiError } from "@/utils/ApiError.ts";
import { asyncHandler } from "@/utils/asyncHandler.ts";
import { memberRoomIds } from "@/services/noteAccess.service.ts";
import { roomMemberIds } from "@/services/roomMembers.service.ts";
import { notifyUser } from "@/services/userNotification.service.ts";
import { NotificationType } from "@/constants/index.ts";
import { storageProvider } from "@/services/storage/local.storage.provider.ts";
import { getIO } from "@/sockets/socket.server.ts";

async function requireMembership(userId: string, roomId: string) {
  const roomIds = await memberRoomIds(userId);
  if (!roomIds.includes(roomId)) throw ApiError.forbidden("You're not a member of this room");
}

function visibilityFilter(roomId: string, userId: string) {
  return {
    roomId,
    $or: [{ visibility: "room" }, { visibility: "private", recipientId: userId }, { visibility: "private", senderId: userId }],
  };
}

export const uploadRoomFiles = asyncHandler(async (req: Request, res: Response) => {
  const roomId = req.params.roomId;
  await requireMembership(req.userId!, roomId);
  if (!req.deviceId) throw ApiError.badRequest("No device on this session");

  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) throw ApiError.badRequest("No files provided");

  const { recipientId, deliverTo, deviceId } = req.body as {
    recipientId?: string;
    deliverTo?: "device" | "user";
    deviceId?: string;
  };

  if (recipientId) {
    const roomIds = await memberRoomIds(recipientId);
    if (!roomIds.includes(roomId)) throw ApiError.badRequest("That person isn't a member of this room");
  }

  const batchId = files.length > 1 ? randomUUID() : undefined;

  const docs = await Promise.all(
    files.map(async (file) => {
      const stored = await storageProvider.save({
        buffer: file.buffer,
        originalName: file.originalname,
        mimeType: file.mimetype,
      });
      return RoomFile.create({
        roomId,
        senderId: req.userId,
        senderDeviceId: req.deviceId,
        name: file.originalname,
        size: stored.size,
        mimeType: stored.mimeType,
        storageKey: stored.key,
        batchId,
        visibility: recipientId ? "private" : "room",
        recipientId: recipientId || undefined,
      });
    })
  );

  const sender = await User.findById(req.userId).select("name");
  const senderName = sender?.get("name") ?? "Someone";
  const label = docs.length > 1 ? `${docs.length} files` : docs[0]!.get("name");

  const io = getIO();
  if (recipientId) {
    // A specific device gets an instant ping there; "all of their devices"
    // pings every device they're signed into instead — either way the
    // stored rows are identical, only the live-delivery target differs.
    if (deliverTo === "device" && deviceId) {
      io?.to(`device:${deviceId}`).emit("room:file-shared", { roomId, files: docs });
    } else {
      io?.to(`user:${recipientId}`).emit("room:file-shared", { roomId, files: docs });
    }
    void notifyUser({
      recipientIds: recipientId,
      actorId: req.userId,
      type: NotificationType.FILE_SHARED,
      message: `${senderName} sent you ${label}`,
      roomId,
      metadata: { fileIds: docs.map((d) => d._id) },
    });
  } else {
    io?.to(`room:${roomId}`).emit("room:file-shared", { roomId, files: docs });
    void notifyUser({
      recipientIds: await roomMemberIds(roomId, req.userId),
      actorId: req.userId,
      type: NotificationType.FILE_SHARED,
      message: `${senderName} shared ${label} with the room`,
      roomId,
      metadata: { fileIds: docs.map((d) => d._id) },
    });
  }

  res.status(201).json({ success: true, data: { files: docs } });
});

export const listRoomFiles = asyncHandler(async (req: Request, res: Response) => {
  const roomId = req.params.roomId;
  await requireMembership(req.userId!, roomId);

  const { before, limit } = req.query as { before?: string; limit?: number };
  const query: Record<string, unknown> = visibilityFilter(roomId, req.userId!);
  if (before) query.createdAt = { $lt: new Date(before) };
  const pageSize = limit ?? 30;

  const docs = await RoomFile.find(query).sort({ createdAt: -1 }).limit(pageSize).lean();

  const senderIds = [...new Set(docs.map((d) => d.senderId.toString()))];
  const senders = await User.find({ _id: { $in: senderIds } }).select("name avatarUrl").lean();
  const senderById = new Map(senders.map((s) => [s._id.toString(), s]));

  const files = docs.map((d) => {
    const sender = senderById.get(d.senderId.toString());
    return {
      ...d,
      _id: d._id.toString(),
      senderName: sender?.name ?? "Someone",
      senderAvatarUrl: sender?.avatarUrl,
      likeCount: d.likedByUserIds?.length ?? 0,
      likedByMe: (d.likedByUserIds ?? []).some((id) => id.toString() === req.userId),
      downloadedByMe: (d.downloadedByUserIds ?? []).some((id) => id.toString() === req.userId),
    };
  });

  res.json({
    success: true,
    data: { files, nextCursor: docs.length === pageSize ? docs[docs.length - 1]!.createdAt.toISOString() : null },
  });
});

export const downloadRoomFile = asyncHandler(async (req: Request, res: Response) => {
  const roomId = req.params.roomId;
  await requireMembership(req.userId!, roomId);

  const file = await RoomFile.findOne({ _id: req.params.fileId, ...visibilityFilter(roomId, req.userId!) });
  if (!file) throw ApiError.notFound("File not found");

  const filePath = storageProvider.getReadStreamPath(file.get("storageKey"));
  if (!existsSync(filePath)) throw ApiError.notFound("File not found");

  await RoomFile.updateOne(
    { _id: file._id },
    { $addToSet: { downloadedByUserIds: req.userId }, $inc: { downloadCount: 1 } }
  );

  res.setHeader("Content-Type", file.get("mimeType") ?? "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(file.get("name"))}"`);
  createReadStream(filePath).pipe(res);
});

// Streams the same bytes as downloadRoomFile but never marks the file as
// downloaded — used for thumbnails/lightbox previews, so simply looking at
// something in the Files list doesn't silently flip its CTA to "Redownload".
export const previewRoomFile = asyncHandler(async (req: Request, res: Response) => {
  const roomId = req.params.roomId;
  await requireMembership(req.userId!, roomId);

  const file = await RoomFile.findOne({ _id: req.params.fileId, ...visibilityFilter(roomId, req.userId!) });
  if (!file) throw ApiError.notFound("File not found");

  const filePath = storageProvider.getReadStreamPath(file.get("storageKey"));
  if (!existsSync(filePath)) throw ApiError.notFound("File not found");

  res.setHeader("Content-Type", file.get("mimeType") ?? "application/octet-stream");
  createReadStream(filePath).pipe(res);
});

export const likeRoomFile = asyncHandler(async (req: Request, res: Response) => {
  const roomId = req.params.roomId;
  await requireMembership(req.userId!, roomId);

  const file = await RoomFile.findOneAndUpdate(
    { _id: req.params.fileId, ...visibilityFilter(roomId, req.userId!) },
    { $addToSet: { likedByUserIds: req.userId } },
    { new: true }
  );
  if (!file) throw ApiError.notFound("File not found");

  const likerId = req.userId!;
  const senderId = file.get("senderId").toString();
  if (senderId !== likerId) {
    const liker = await User.findById(likerId).select("name");
    void notifyUser({
      recipientIds: senderId,
      actorId: likerId,
      type: NotificationType.FILE_LIKED,
      message: `${liker?.get("name") ?? "Someone"} liked "${file.get("name")}"`,
      roomId,
      metadata: { fileId: file._id },
    });
  }

  res.json({ success: true, data: { likeCount: (file.get("likedByUserIds") as unknown[]).length } });
});

export const unlikeRoomFile = asyncHandler(async (req: Request, res: Response) => {
  const roomId = req.params.roomId;
  await requireMembership(req.userId!, roomId);

  const file = await RoomFile.findOneAndUpdate(
    { _id: req.params.fileId, ...visibilityFilter(roomId, req.userId!) },
    { $pull: { likedByUserIds: req.userId } },
    { new: true }
  );
  if (!file) throw ApiError.notFound("File not found");

  res.json({ success: true, data: { likeCount: (file.get("likedByUserIds") as unknown[]).length } });
});

export const viewRoomFile = asyncHandler(async (req: Request, res: Response) => {
  const roomId = req.params.roomId;
  await requireMembership(req.userId!, roomId);

  const file = await RoomFile.findOneAndUpdate(
    { _id: req.params.fileId, ...visibilityFilter(roomId, req.userId!) },
    { $inc: { viewCount: 1 } },
    { new: true }
  );
  if (!file) throw ApiError.notFound("File not found");

  res.json({ success: true, data: { viewCount: file.get("viewCount") } });
});
