import { Device } from "@/models/Device.model.ts";
import { Room } from "@/models/Room.model.ts";
import type { AuthedSocket } from "@/sockets/socket.server.ts";

/**
 * Relays WebRTC-style signaling messages (offer/answer/ICE candidates)
 * between two devices so they can negotiate a direct connection. The
 * backend only ever sees signaling metadata here, never the transferred
 * content itself — actual bytes flow peer-to-peer once connected.
 *
 * A target device is reachable either because it belongs to the same
 * account (your own other devices), or because both devices are members of
 * a shared room (someone else's device you're collaborating with there).
 */
export function registerSignalingHandlers(socket: AuthedSocket) {
  const { userId, deviceId } = socket.data;

  socket.on(
    "signal:send",
    async (payload: { targetDeviceId: string; data: unknown; kind: "offer" | "answer" | "ice-candidate" }) => {
      if (!deviceId) return;

      const targetDevice = await Device.findById(payload.targetDeviceId).select("ownerId");
      if (!targetDevice) return;

      const sameOwner = targetDevice.ownerId.toString() === userId;
      const sharedRoom = sameOwner
        ? true
        : await Room.exists({ deviceIds: { $all: [deviceId, payload.targetDeviceId] } });
      if (!sameOwner && !sharedRoom) return;

      socket.to(`device:${payload.targetDeviceId}`).emit("signal:receive", {
        fromDeviceId: deviceId,
        kind: payload.kind,
        data: payload.data,
      });
    }
  );

  socket.on("discovery:ping", () => {
    socket.to(`user:${userId}`).emit("discovery:pong", {
      deviceId: socket.data.deviceId,
    });
  });
}
