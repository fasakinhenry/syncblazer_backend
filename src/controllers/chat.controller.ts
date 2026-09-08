import type { Request, Response } from "express";
import { createReadStream, existsSync } from "node:fs";
import { Room } from "@/models/Room.model.ts";
import { Device } from "@/models/Device.model.ts";
import { Message } from "@/models/Message.model.ts";
import { RoomChatKeyEnvelope } from "@/models/RoomChatKeyEnvelope.model.ts";
import { User } from "@/models/User.model.ts";
import { memberRoomIds } from "@/services/noteAccess.service.ts";
import { ApiError } from "@/utils/ApiError.ts";
import { asyncHandler } from "@/utils/asyncHandler.ts";
import { getIO } from "@/sockets/socket.server.ts";
import { storageProvider } from "@/services/storage/local.storage.provider.ts";

async function requireMembership(userId: string, roomId: string) {
  const roomIds = await memberRoomIds(userId);
  if (!roomIds.includes(roomId)) throw ApiError.forbidden("You're not a member of this room");
}

// Every current room member's devices that have a chat keypair set up —
// used both to wrap a fresh epoch key for everyone on rotation, and to show
// "who's set up for chat" in the UI. A device with no publicKey yet simply
// isn't reachable until it opens chat once and uploads one.
export const getChatDevices = asyncHandler(async (req: Request, res: Response) => {
  const roomId = req.params.roomId;
  await requireMembership(req.userId!, roomId);

  const room = await Room.findById(roomId).select("ownerId memberIds");
  if (!room) throw ApiError.notFound("Room not found");

  const memberUserIds = [
    room.get("ownerId").toString(),
    ...(room.get("memberIds") as { toString(): string }[]).map((id) => id.toString()),
  ];

  const devices = await Device.find({ ownerId: { $in: memberUserIds }, publicKey: { $exists: true, $ne: null } })
    .select("+publicKey ownerId name")
    .lean();

  res.json({
    success: true,
    data: {
      devices: devices.map((d) => ({
        deviceId: d._id.toString(),
        userId: d.ownerId.toString(),
        name: d.name,
        publicKey: d.publicKey as string,
      })),
    },
  });
});

export const getChatEpoch = asyncHandler(async (req: Request, res: Response) => {
  const roomId = req.params.roomId;
  await requireMembership(req.userId!, roomId);
  const room = await Room.findById(roomId).select("chatEpoch");
  if (!room) throw ApiError.notFound("Room not found");
  res.json({ success: true, data: { epoch: room.get("chatEpoch") ?? 0 } });
});

// Bumps the room's chat epoch by one. Called by whichever member's client
// notices membership changed (or that chat has never been set up) and is
// about to generate + wrap a fresh key for every current member device —
// the server only ever hands out this counter, never the key itself.
export const rotateChatEpoch = asyncHandler(async (req: Request, res: Response) => {
  const roomId = req.params.roomId;
  await requireMembership(req.userId!, roomId);
  const room = await Room.findByIdAndUpdate(roomId, { $inc: { chatEpoch: 1 } }, { new: true }).select("chatEpoch");
  if (!room) throw ApiError.notFound("Room not found");
  res.status(201).json({ success: true, data: { epoch: room.get("chatEpoch") } });
});

// The caller has just wrapped this room's current (or a fresh) epoch key
// individually for one or more recipient devices' public keys. The server
// stores and relays these opaque blobs — it has no way to unwrap any of
// them itself.
export const uploadKeyEnvelopes = asyncHandler(async (req: Request, res: Response) => {
  const roomId = req.params.roomId;
  await requireMembership(req.userId!, roomId);
  if (!req.deviceId) throw ApiError.badRequest("No device on this session");

  const { epoch, envelopes } = req.body as {
    epoch: number;
    envelopes: { deviceId: string; wrappedKey: string; iv: string }[];
  };

  for (const envelope of envelopes) {
    await RoomChatKeyEnvelope.findOneAndUpdate(
      { roomId, deviceId: envelope.deviceId, epoch },
      { wrappedKey: envelope.wrappedKey, iv: envelope.iv, fromDeviceId: req.deviceId },
      { upsert: true, new: true }
    );
    getIO()?.to(`device:${envelope.deviceId}`).emit("chat:key-envelope", {
      roomId,
      epoch,
      wrappedKey: envelope.wrappedKey,
      iv: envelope.iv,
      fromDeviceId: req.deviceId,
    });
  }

  res.status(201).json({ success: true, data: { count: envelopes.length } });
});

// Every envelope ever wrapped for MY device in this room — potentially
// several epochs if this device has been a member across more than one
// rotation. A device with none for the room's current epoch needs to
// bootstrap via chat:key-request (see roomChat.ts).
export const getMyKeyEnvelopes = asyncHandler(async (req: Request, res: Response) => {
  const roomId = req.params.roomId;
  await requireMembership(req.userId!, roomId);
  if (!req.deviceId) throw ApiError.badRequest("No device on this session");

  const envelopes = await RoomChatKeyEnvelope.find({ roomId, deviceId: req.deviceId }).sort({ epoch: 1 }).lean();
  res.json({
    success: true,
    data: {
      envelopes: envelopes.map((e) => ({
        epoch: e.epoch,
        wrappedKey: e.wrappedKey,
        iv: e.iv,
        fromDeviceId: e.fromDeviceId.toString(),
      })),
    },
  });
});

export const listMessages = asyncHandler(async (req: Request, res: Response) => {
  const roomId = req.params.roomId;
  await requireMembership(req.userId!, roomId);

  const { before, limit } = req.query as { before?: string; limit?: number };
  const query: Record<string, unknown> = { roomId };
  if (before) query.createdAt = { $lt: new Date(before) };
  const pageSize = limit ?? 50;

  const docs = await Message.find(query).sort({ createdAt: -1 }).limit(pageSize).lean();

  const senderIds = [...new Set(docs.map((d) => d.senderId.toString()))];
  const senders = await User.find({ _id: { $in: senderIds } })
    .select("name avatarUrl")
    .lean();
  const senderById = new Map(senders.map((s) => [s._id.toString(), s]));

  const messages = docs
    .map((d) => {
      const sender = senderById.get(d.senderId.toString());
      return {
        _id: d._id.toString(),
        senderId: d.senderId.toString(),
        senderName: sender?.name ?? "Someone",
        senderAvatarUrl: sender?.avatarUrl,
        senderDeviceId: d.senderDeviceId.toString(),
        epoch: d.epoch,
        type: d.type,
        ciphertext: d.ciphertext,
        iv: d.iv,
        createdAt: d.createdAt,
      };
    })
    .reverse();

  res.json({
    success: true,
    data: {
      messages,
      nextCursor: docs.length === pageSize ? docs[docs.length - 1]!.createdAt.toISOString() : null,
    },
  });
});

// Attachments are already AES-GCM encrypted client-side before they ever
// reach here (see roomChatCrypto.ts) — the server stores and serves opaque
// bytes, same as it stores opaque message ciphertext. Auth-gated (unlike
// note images) since there's no <img src> use case forcing a public URL —
// the client always fetches these with an Authorization header, then
// decrypts into a blob URL for rendering.
export const uploadChatAttachment = asyncHandler(async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) throw ApiError.badRequest("No file provided");

  const stored = await storageProvider.save({
    buffer: file.buffer,
    originalName: file.originalname || "blob",
    mimeType: "application/octet-stream",
  });

  res.status(201).json({ success: true, data: { key: stored.key, size: stored.size } });
});

export const serveChatAttachment = asyncHandler(async (req: Request, res: Response) => {
  const key = req.params.key;
  if (key.includes("..") || key.includes("/") || key.includes("\\")) throw ApiError.badRequest("Invalid key");

  const filePath = storageProvider.getReadStreamPath(key);
  if (!existsSync(filePath)) throw ApiError.notFound("Attachment not found");

  res.setHeader("Content-Type", "application/octet-stream");
  createReadStream(filePath).pipe(res);
});
