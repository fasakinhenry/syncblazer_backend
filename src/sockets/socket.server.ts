import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import { env } from "@/config/env.ts";
import { isAllowedOrigin } from "@/utils/corsOrigins.ts";
import { verifyAccessToken } from "@/utils/jwt.ts";
import { getClientIp } from "@/utils/getClientIp.ts";
import { logger } from "@/utils/logger.ts";
import { Device } from "@/models/Device.model.ts";
import { Room } from "@/models/Room.model.ts";
import { registerSignalingHandlers } from "@/sockets/signaling.ts";
import { registerTransferHandlers } from "@/sockets/transfer.events.ts";
import { registerQuickPairHandlers } from "@/sockets/quickPair.ts";
import { recordDeviceConnection, forgetSocketConnection } from "@/sockets/presence.ts";
import { DeviceStatus } from "@/constants/index.ts";

let io: Server | null = null;

export interface AuthedSocket extends Socket {
  data: {
    userId: string;
    deviceId?: string;
  };
}

export function getIO(): Server | null {
  return io;
}

export function initSocketServer(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        callback(null, isAllowedOrigin(origin));
      },
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("Missing auth token"));
    try {
      const payload = verifyAccessToken(token);
      (socket as AuthedSocket).data.userId = payload.userId;
      (socket as AuthedSocket).data.deviceId = payload.deviceId;
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => handleConnection(socket as AuthedSocket));

  return io;
}

async function handleConnection(socket: AuthedSocket) {
  const { userId, deviceId } = socket.data;
  logger.info(`Socket connected: user=${userId} device=${deviceId ?? "n/a"} socket=${socket.id}`);

  socket.join(`user:${userId}`);
  if (deviceId) socket.join(`device:${deviceId}`);

  if (deviceId) {
    const ip = getClientIp(socket);
    recordDeviceConnection(socket.id, deviceId, ip);

    const device = await Device.findOneAndUpdate(
      { _id: deviceId, ownerId: userId },
      { status: DeviceStatus.ONLINE, lastSeenAt: new Date(), socketId: socket.id },
      { new: true }
    );

    const rooms = await Room.find({
      $or: [{ ownerId: userId }, { deviceIds: deviceId }],
    }).select("_id");
    for (const room of rooms) {
      socket.join(`room:${room._id.toString()}`);
    }

    if (device) {
      io?.to(`user:${userId}`).emit("device:presence", {
        deviceId: device._id,
        status: DeviceStatus.ONLINE,
        lastSeenAt: device.lastSeenAt,
      });
      // A device just came online, which can change who's on the same
      // network as whom. Nudge clients to refresh their device list rather
      // than trying to compute "local" relative to every other viewer here.
      io?.to(`user:${userId}`).emit("network:changed");
    }
  }

  registerSignalingHandlers(socket);
  registerTransferHandlers(socket);
  registerQuickPairHandlers(socket);

  socket.on("room:join", async (roomId: string) => {
    const room = await Room.findOne({
      _id: roomId,
      $or: [{ ownerId: userId }, { deviceIds: deviceId }],
    }).select("_id");
    if (room) socket.join(`room:${roomId}`);
  });

  socket.on("disconnect", async () => {
    logger.info(`Socket disconnected: user=${userId} device=${deviceId ?? "n/a"}`);
    forgetSocketConnection(socket.id);
    if (!deviceId) return;

    const device = await Device.findOneAndUpdate(
      { _id: deviceId, ownerId: userId, socketId: socket.id },
      { status: DeviceStatus.OFFLINE, lastSeenAt: new Date(), $unset: { socketId: 1 } },
      { new: true }
    );

    if (device) {
      io?.to(`user:${userId}`).emit("device:presence", {
        deviceId: device._id,
        status: DeviceStatus.OFFLINE,
        lastSeenAt: device.lastSeenAt,
      });
      io?.to(`user:${userId}`).emit("network:changed");
    }
  });
}
