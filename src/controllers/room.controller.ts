import type { Request, Response } from "express";
import { randomBytes } from "node:crypto";
import { Types } from "mongoose";
import { Room, type RoomDocument } from "@/models/Room.model.ts";
import { Activity } from "@/models/Activity.model.ts";
import { Device } from "@/models/Device.model.ts";
import { RoomInvite } from "@/models/RoomInvite.model.ts";
import { User } from "@/models/User.model.ts";
import { ApiError } from "@/utils/ApiError.ts";
import { asyncHandler } from "@/utils/asyncHandler.ts";
import { generateUniqueRoomCode } from "@/utils/roomName.ts";
import { recordActivity } from "@/services/activity.service.ts";
import { notifyRoomCreated, notifyRoomInvite, notifyRoomMemberAdded } from "@/services/notifications.service.ts";
import { notifyUser } from "@/services/userNotification.service.ts";
import { roomMemberIds } from "@/services/roomMembers.service.ts";
import { ActivityType, NotificationType, RoomType } from "@/constants/index.ts";
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
  })
    .sort({ isDefault: -1, createdAt: -1 })
    .populate("deviceIds", "status");
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

  const user = await User.findById(req.userId).select("name email");
  if (user) void notifyRoomCreated({ email: user.get("email"), name: user.get("name") }, room);

  await recordActivity({
    ownerId: req.userId!,
    roomId: room._id.toString(),
    type: ActivityType.ROOM_CREATED,
    message: `Room "${room.name}" created`,
    metadata: { roomId: room._id },
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
    const joinerName = user?.get("name") ?? "Someone";
    await recordActivity({
      ownerId: req.userId!,
      roomId: room._id.toString(),
      type: ActivityType.MEMBER_JOINED,
      message: `${joinerName} joined the room`,
      metadata: { userId: req.userId },
    });
    void notifyUser({
      recipientIds: await roomMemberIds(room._id, req.userId),
      actorId: req.userId,
      type: NotificationType.MEMBER_JOINED,
      message: `${joinerName} joined "${room.name}"`,
      roomId: room._id.toString(),
    });
  }

  getIO()?.to(`room:${room._id.toString()}`).emit("room:member-joined", { roomId: room._id });

  res.status(200).json({ success: true, data: { room } });
});

// Owner-only. If the invited email already belongs to an account, they're
// added directly (no waiting on them to click anything) and get the
// "added to a room" email; otherwise a RoomInvite is created and they get a
// signup link that auto-joins the room once they register (auth.controller.ts).
export const inviteToRoom = asyncHandler(async (req: Request, res: Response) => {
  const room = await Room.findOne({ _id: req.params.roomId, ownerId: req.userId });
  if (!room) throw ApiError.notFound("Room not found");

  const email = (req.body.email as string).trim().toLowerCase();
  const inviter = await User.findById(req.userId).select("name");
  const inviterName = inviter?.get("name") ?? "Someone";

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    const alreadyMember =
      room.ownerId.toString() === existingUser._id.toString() ||
      room.memberIds.some((id) => id.toString() === existingUser._id.toString());
    if (alreadyMember) throw ApiError.conflict("That person is already in this room");

    room.memberIds.push(existingUser._id);
    await room.save();

    await recordActivity({
      ownerId: req.userId!,
      roomId: room._id.toString(),
      type: ActivityType.MEMBER_JOINED,
      message: `${existingUser.get("name")} was added to the room`,
      metadata: { userId: existingUser._id },
    });
    getIO()?.to(`room:${room._id.toString()}`).emit("room:member-joined", { roomId: room._id });

    void notifyRoomMemberAdded({ email: existingUser.get("email"), name: existingUser.get("name") }, room, inviterName);
    void notifyUser({
      recipientIds: await roomMemberIds(room._id, req.userId),
      actorId: req.userId,
      type: NotificationType.MEMBER_JOINED,
      message: `${existingUser.get("name")} joined "${room.name}"`,
      roomId: room._id.toString(),
    });

    res.json({ success: true, data: { status: "added" } });
    return;
  }

  // No account with that email yet — reuse a still-pending invite instead
  // of stacking up duplicates if the owner invites the same address twice.
  let invite = await RoomInvite.findOne({ roomId: room._id, invitedEmail: email, status: "pending" });
  if (!invite) {
    invite = await RoomInvite.create({
      roomId: room._id,
      invitedEmail: email,
      invitedBy: req.userId,
      token: randomBytes(16).toString("hex"),
    });
  }

  void notifyRoomInvite(email, room.get("name"), inviterName, invite.get("token"));

  res.json({ success: true, data: { status: "invited" } });
});

// Shared by removeMember (owner drops someone else) and leaveRoom (you
// drop yourself) — also clears the departing member's own devices from
// the room's device list, since they'd otherwise keep showing up there
// despite no longer having access to anything else in the room.
async function dropMemberFromRoom(room: RoomDocument, targetId: string): Promise<boolean> {
  const before = room.memberIds.length;
  room.memberIds = room.memberIds.filter((id) => id.toString() !== targetId) as typeof room.memberIds;
  if (room.memberIds.length === before) return false;

  const theirDeviceIds = new Set((await Device.find({ ownerId: targetId }).select("_id")).map((d) => d._id.toString()));
  room.deviceIds = room.deviceIds.filter((id) => !theirDeviceIds.has(id.toString())) as typeof room.deviceIds;
  await room.save();
  return true;
}

// Owner-only.
export const removeMember = asyncHandler(async (req: Request, res: Response) => {
  const room = await Room.findOne({ _id: req.params.roomId, ownerId: req.userId });
  if (!room) throw ApiError.notFound("Room not found");

  const targetId = req.params.userId;
  if (targetId === req.userId) throw ApiError.badRequest("You can't remove yourself. Delete the room instead.");

  const removed = await dropMemberFromRoom(room, targetId);
  if (!removed) throw ApiError.notFound("That person isn't a member of this room");

  const removedUser = await User.findById(targetId).select("name");
  await recordActivity({
    ownerId: req.userId!,
    roomId: room._id.toString(),
    type: ActivityType.MEMBER_REMOVED,
    message: `${removedUser?.get("name") ?? "Someone"} was removed from the room`,
    metadata: { userId: targetId },
  });
  void notifyUser({
    recipientIds: targetId,
    actorId: req.userId,
    type: NotificationType.MEMBER_REMOVED,
    message: `You were removed from "${room.name}"`,
    roomId: room._id.toString(),
  });

  getIO()?.to(`room:${room._id.toString()}`).emit("room:member-removed", { roomId: room._id, userId: targetId });
  // The removed member's own client(s) are still subscribed to this room's
  // socket channel until they reconnect otherwise, so nudge them directly.
  getIO()?.to(`user:${targetId}`).emit("room:removed-from", { roomId: room._id });

  res.json({ success: true, data: { roomId: room._id, userId: targetId } });
});

// The room-membership counterpart to removeMember: any member (never the
// owner, who has to delete the room instead) can remove themselves.
export const leaveRoom = asyncHandler(async (req: Request, res: Response) => {
  const room = await Room.findOne({ _id: req.params.roomId });
  if (!room) throw ApiError.notFound("Room not found");
  if (room.ownerId.toString() === req.userId) {
    throw ApiError.badRequest("Room owners can't leave. Delete the room instead.");
  }

  const removed = await dropMemberFromRoom(room, req.userId!);
  if (!removed) throw ApiError.notFound("You're not a member of this room");

  const user = await User.findById(req.userId).select("name");
  await recordActivity({
    ownerId: req.userId!,
    roomId: room._id.toString(),
    type: ActivityType.MEMBER_REMOVED,
    message: `${user?.get("name") ?? "Someone"} left the room`,
    metadata: { userId: req.userId },
  });

  getIO()?.to(`room:${room._id.toString()}`).emit("room:member-removed", { roomId: room._id, userId: req.userId });

  res.json({ success: true, data: { roomId: room._id } });
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
