import type { Request, Response } from "express";
import { Types } from "mongoose";
import { Room } from "@/models/Room.model.ts";
import { Activity } from "@/models/Activity.model.ts";
import { User } from "@/models/User.model.ts";
import { ApiError } from "@/utils/ApiError.ts";
import { asyncHandler } from "@/utils/asyncHandler.ts";
import { generateUniqueRoomCode } from "@/utils/roomName.ts";
import { recordActivity } from "@/services/activity.service.ts";
import { ActivityType, RoomType } from "@/constants/index.ts";
import { getIO } from "@/sockets/socket.server.ts";
import { areDevicesOnSameNetwork } from "@/sockets/presence.ts";

const INSTANT_ROOM_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

async function codeExists(code: string): Promise<boolean> {
  return (await Room.exists({ code })) !== null;
}

export const listRooms = asyncHandler(async (req: Request, res: Response) => {
  const rooms = await Room.find({
    $or: [{ ownerId: req.userId }, { memberIds: req.userId }],
    // Instant rooms clutter "your rooms" once you've moved on; they stay
    // reachable by code until they expire, they just don't linger in the list.
    isInstant: { $ne: true },
  }).sort({ isDefault: -1, createdAt: -1 });
  res.json({ success: true, data: { rooms } });
});

export const getRoom = asyncHandler(async (req: Request, res: Response) => {
  const room = await Room.findOne({
    _id: req.params.roomId,
    $or: [{ ownerId: req.userId }, { memberIds: req.userId }],
  })
    .populate("deviceIds")
    .lean();
  if (!room) throw ApiError.notFound("Room not found");

  const viewerDeviceId = req.deviceId;
  const deviceIds = room.deviceIds as unknown as Record<string, unknown>[];
  room.deviceIds = deviceIds.map((device) => {
    const id = String(device._id);
    return {
      ...device,
      isLocal: !!viewerDeviceId && id !== viewerDeviceId && areDevicesOnSameNetwork(viewerDeviceId, id),
    };
  }) as unknown as typeof room.deviceIds;

  const recentActivity = await Activity.find({ roomId: room._id }).sort({ createdAt: -1 }).limit(20);
  const members = await User.find({ _id: { $in: [room.ownerId, ...room.memberIds] } }).select("name avatarUrl");

  res.json({ success: true, data: { room, recentActivity, members } });
});

export const createRoom = asyncHandler(async (req: Request, res: Response) => {
  const code = await generateUniqueRoomCode(codeExists);

  const room = await Room.create({
    ownerId: req.userId,
    name: req.body.name,
    type: req.body.type,
    code,
    deviceIds: req.deviceId ? [req.deviceId] : [],
  });
  res.status(201).json({ success: true, data: { room } });
});

export const createInstantRoom = asyncHandler(async (req: Request, res: Response) => {
  const code = await generateUniqueRoomCode(codeExists);

  const room = await Room.create({
    ownerId: req.userId,
    name: code,
    type: RoomType.TEMPORARY,
    code,
    isInstant: true,
    expiresAt: new Date(Date.now() + INSTANT_ROOM_TTL_MS),
    deviceIds: req.deviceId ? [req.deviceId] : [],
  });
  res.status(201).json({ success: true, data: { room } });
});

export const joinRoom = asyncHandler(async (req: Request, res: Response) => {
  const room = await Room.findOne({ code: req.body.code });
  if (!room) throw ApiError.notFound("No room found with that code");
  if (room.expiresAt && room.expiresAt.getTime() < Date.now()) {
    throw ApiError.gone("This room has expired");
  }

  const alreadyMember =
    room.ownerId.toString() === req.userId || room.memberIds.some((id) => id.toString() === req.userId);

  if (!alreadyMember) room.memberIds.push(new Types.ObjectId(req.userId!));
  if (req.deviceId && !room.deviceIds.some((id) => id.toString() === req.deviceId)) {
    room.deviceIds.push(new Types.ObjectId(req.deviceId));
  }
  await room.save();

  if (!alreadyMember) {
    const user = await User.findById(req.userId).select("name");
    await recordActivity({
      ownerId: req.userId!,
      roomId: room._id.toString(),
      type: ActivityType.MEMBER_JOINED,
      message: `${user?.get("name") ?? "Someone"} joined the room`,
      metadata: { userId: req.userId },
    });
  }

  getIO()?.to(`room:${room._id.toString()}`).emit("room:member-joined", { roomId: room._id });

  res.status(200).json({ success: true, data: { room } });
});

export const updateRoom = asyncHandler(async (req: Request, res: Response) => {
  const room = await Room.findOneAndUpdate(
    { _id: req.params.roomId, ownerId: req.userId },
    { name: req.body.name },
    { new: true }
  );
  if (!room) throw ApiError.notFound("Room not found");
  res.json({ success: true, data: { room } });
});

export const deleteRoom = asyncHandler(async (req: Request, res: Response) => {
  const room = await Room.findOne({ _id: req.params.roomId, ownerId: req.userId });
  if (!room) throw ApiError.notFound("Room not found");
  if (room.isDefault) throw ApiError.badRequest("The default room cannot be deleted");

  await room.deleteOne();
  res.json({ success: true, data: { roomId: room._id } });
});
