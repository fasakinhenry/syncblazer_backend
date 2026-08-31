import type { Request, Response } from "express";
import { Device } from "@/models/Device.model.ts";
import { Room } from "@/models/Room.model.ts";
import { ApiError } from "@/utils/ApiError.ts";
import { asyncHandler } from "@/utils/asyncHandler.ts";
import { createPairingSession, findActivePairingSession } from "@/services/pairing.service.ts";
import { recordActivity } from "@/services/activity.service.ts";
import { ActivityType, DeviceStatus } from "@/constants/index.ts";
import { getIO } from "@/sockets/socket.server.ts";
import { areDevicesOnSameNetwork } from "@/sockets/presence.ts";

export const listDevices = asyncHandler(async (req: Request, res: Response) => {
  const devices = await Device.find({ ownerId: req.userId }).sort({ createdAt: -1 }).lean();
  const viewerDeviceId = req.deviceId;

  const withNetworkInfo = devices.map((device) => {
    const id = device._id.toString();
    return {
      ...device,
      isLocal: !!viewerDeviceId && id !== viewerDeviceId && areDevicesOnSameNetwork(viewerDeviceId, id),
    };
  });

  res.json({ success: true, data: { devices: withNetworkInfo } });
});

export const renameDevice = asyncHandler(async (req: Request, res: Response) => {
  const device = await Device.findOneAndUpdate(
    { _id: req.params.deviceId, ownerId: req.userId },
    { name: req.body.name },
    { new: true }
  );
  if (!device) throw ApiError.notFound("Device not found");
  res.json({ success: true, data: { device } });
});

export const removeDevice = asyncHandler(async (req: Request, res: Response) => {
  const device = await Device.findOneAndDelete({ _id: req.params.deviceId, ownerId: req.userId });
  if (!device) throw ApiError.notFound("Device not found");

  await Room.updateMany(
    { $or: [{ ownerId: req.userId }, { memberIds: req.userId }] },
    { $pull: { deviceIds: device._id } }
  );

  const defaultRoom = await Room.findOne({ ownerId: req.userId, isDefault: true });
  if (defaultRoom) {
    await recordActivity({
      ownerId: req.userId!,
      roomId: defaultRoom._id.toString(),
      type: ActivityType.DEVICE_REMOVED,
      message: `${device.name} was removed`,
      metadata: { deviceId: device._id },
    });
  }

  getIO()?.to(`user:${req.userId}`).emit("device:removed", { deviceId: device._id });

  res.json({ success: true, data: { deviceId: device._id } });
});

export const createDevicePairingSession = asyncHandler(async (req: Request, res: Response) => {
  if (!req.deviceId) {
    throw ApiError.badRequest("Only an already-paired device can generate a pairing code");
  }

  const room = await Room.findOne({ _id: req.body.roomId, ownerId: req.userId });
  if (!room) throw ApiError.notFound("Room not found");

  const session = await createPairingSession({
    initiatorUserId: req.userId!,
    initiatorDeviceId: req.deviceId,
    roomId: room._id.toString(),
  });

  res.status(201).json({
    success: true,
    data: {
      token: session.token,
      shortCode: session.shortCode,
      expiresAt: session.expiresAt,
    },
  });
});

export const consumeDevicePairingSession = asyncHandler(async (req: Request, res: Response) => {
  const { token, shortCode, device } = req.body;

  const session = await findActivePairingSession({ token, shortCode });
  if (!session) throw ApiError.gone("This pairing code is invalid or has expired");

  if (session.initiatorUserId.toString() !== req.userId) {
    throw ApiError.forbidden("This pairing code belongs to a different account");
  }

  const newDevice = await Device.create({
    ownerId: req.userId,
    name: device.name,
    type: device.type,
    platform: device.platform,
    status: DeviceStatus.ONLINE,
    lastSeenAt: new Date(),
  });

  await Room.updateOne({ _id: session.roomId }, { $addToSet: { deviceIds: newDevice._id } });

  session.status = "consumed";
  session.consumedByDeviceId = newDevice._id;
  session.consumedAt = new Date();
  await session.save();

  await recordActivity({
    ownerId: req.userId!,
    roomId: session.roomId.toString(),
    type: ActivityType.DEVICE_CONNECTED,
    message: `${newDevice.name} connected`,
    metadata: { deviceId: newDevice._id },
  });

  getIO()?.to(`device:${session.initiatorDeviceId.toString()}`).emit("pairing:completed", {
    device: newDevice,
  });

  res.status(201).json({ success: true, data: { device: newDevice, roomId: session.roomId } });
});
