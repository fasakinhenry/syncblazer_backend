import { randomUUID } from "node:crypto";
import { Message } from "@/models/Message.model.ts";
import { User } from "@/models/User.model.ts";
import { memberRoomIds } from "@/services/noteAccess.service.ts";
import { logger } from "@/utils/logger.ts";
import { getIO } from "@/sockets/socket.server.ts";
import type { AuthedSocket } from "@/sockets/socket.server.ts";

/**
 * Relays the live layer for end-to-end-encrypted room chat: message
 * send/receive, typing indicators, and key-bootstrap requests. The server
 * only ever sees ciphertext for `chat:message` — it persists it as-is and
 * relays it, with no ability to read it (see roomChatCrypto.ts on the
 * frontend for the actual encrypt/decrypt). Key distribution for a new
 * epoch or a new device happens over REST (chat.controller.ts) since it
 * needs to be durable (a currently-offline device must still find its
 * envelope when it next connects) — this file only carries the parts that
 * are fine to lose if nobody's listening: new messages, typing, and the
 * "does anyone have the current key for me" broadcast request.
 */
export function registerRoomChatHandlers(socket: AuthedSocket) {
  const { userId } = socket.data;
  const joinedRooms = new Set<string>();

  socket.on("chat:join", async ({ roomId }: { roomId?: string }) => {
    if (!roomId || joinedRooms.has(roomId)) return;
    const roomIds = await memberRoomIds(userId);
    if (!roomIds.includes(roomId)) return;
    joinedRooms.add(roomId);
    socket.join(`chat:${roomId}`);
  });

  socket.on("chat:leave", ({ roomId }: { roomId?: string }) => {
    if (!roomId || !joinedRooms.has(roomId)) return;
    joinedRooms.delete(roomId);
    socket.leave(`chat:${roomId}`);
  });

  socket.on(
    "chat:message",
    async (payload: {
      roomId?: string;
      clientMsgId?: string;
      ciphertext?: string;
      iv?: string;
      epoch?: number;
      type?: "text" | "image" | "audio";
    }) => {
      const { roomId, clientMsgId, ciphertext, iv, epoch, type } = payload;
      const { deviceId } = socket.data;
      if (!roomId || !joinedRooms.has(roomId) || !ciphertext || !iv || !epoch || !deviceId) return;

      let saved;
      try {
        saved = await Message.create({
          roomId,
          senderId: userId,
          senderDeviceId: deviceId,
          epoch,
          type: type ?? "text",
          ciphertext,
          iv,
        });
      } catch (err) {
        logger.error(`Failed to persist chat message in room ${roomId}: ${String(err)}`);
        return;
      }

      const sender = await User.findById(userId).select("name avatarUrl");

      getIO()
        ?.to(`chat:${roomId}`)
        .emit("chat:message", {
          _id: saved._id.toString(),
          clientMsgId,
          senderId: userId,
          senderName: sender?.get("name") ?? "Someone",
          senderAvatarUrl: sender?.get("avatarUrl") ?? undefined,
          senderDeviceId: deviceId,
          epoch,
          type: type ?? "text",
          ciphertext,
          iv,
          createdAt: saved.get("createdAt"),
        });
    }
  );

  socket.on("chat:typing", ({ roomId }: { roomId?: string }) => {
    if (!roomId || !joinedRooms.has(roomId)) return;
    socket.to(`chat:${roomId}`).emit("chat:typing", { roomId, userId });
  });

  // "I just opened chat on this device and don't have a wrapped key for the
  // room's current epoch — can anyone who does wrap it for me?" Relayed
  // only to other sockets that also have this room's chat open right now;
  // a responder wraps the key and uploads it via POST .../key-envelopes,
  // which pushes it straight to this device (see chat.controller.ts).
  socket.on("chat:key-request", ({ roomId, publicKey }: { roomId?: string; publicKey?: string }) => {
    const { deviceId } = socket.data;
    if (!roomId || !joinedRooms.has(roomId) || !deviceId || !publicKey) return;
    socket.to(`chat:${roomId}`).emit("chat:key-request", { roomId, deviceId, userId, publicKey, requestId: randomUUID() });
  });

  socket.on("disconnect", () => {
    for (const roomId of [...joinedRooms]) socket.leave(`chat:${roomId}`);
    joinedRooms.clear();
  });
}
