import { customAlphabet } from "nanoid";
import { QuickPairSession } from "@/models/QuickPairSession.model.ts";
import { env } from "@/config/env.ts";
import type { AuthedSocket } from "@/sockets/socket.server.ts";
import { getIO } from "@/sockets/socket.server.ts";

const numericId = customAlphabet("0123456789", 6);
function formatCode(raw: string): string {
  return `${raw.slice(0, 3)}-${raw.slice(3)}`;
}

// Ephemeral, in-memory roster per code — who's currently in the room and
// what they're calling themselves. Deliberately not persisted: this is
// live presence for an active handshake, not durable state. Keyed by the
// bare code (no "quickpair:" prefix) to match QuickPairSession.code.
const roomMembers = new Map<string, Map<string, string>>();

function roomKey(code: string) {
  return `quickpair:${code}`;
}

/**
 * Relays WebRTC signaling for the "Quick Connect" cloud-assisted local
 * transfer mode: any devices that know the same short code can reach each
 * other here, regardless of account or Room — unlike registerSignalingHandlers
 * (signaling.ts), which only ever relays between devices already related by
 * account/Room membership. Once connected, transferred bytes are strictly
 * peer-to-peer; the server never sees them, only this handshake metadata.
 */
export function registerQuickPairHandlers(socket: AuthedSocket) {
  socket.on("quickpair:create", async (input: { name: string }, ack: (res: { code: string }) => void) => {
    const code = formatCode(numericId());
    const expiresAt = new Date(Date.now() + env.quickPairSessionTtlSeconds * 1000);
    await QuickPairSession.create({ code, hostSocketId: socket.id, expiresAt });

    roomMembers.set(code, new Map([[socket.id, input.name]]));
    socket.join(roomKey(code));
    ack({ code });
  });

  socket.on(
    "quickpair:join",
    async (
      input: { code: string; name: string },
      ack: (res: { ok: true; peers: { peerId: string; name: string }[] } | { ok: false; error: string }) => void
    ) => {
      const session = await QuickPairSession.findOne({ code: input.code });
      if (!session || session.expiresAt.getTime() < Date.now()) {
        ack({ ok: false, error: "That code is invalid or has expired." });
        return;
      }

      const members = roomMembers.get(input.code) ?? new Map<string, string>();
      const peers = [...members.entries()].map(([peerId, name]) => ({ peerId, name }));

      members.set(socket.id, input.name);
      roomMembers.set(input.code, members);
      socket.join(roomKey(input.code));

      ack({ ok: true, peers });
      socket.to(roomKey(input.code)).emit("quickpair:peer-joined", { peerId: socket.id, name: input.name });
    }
  );

  socket.on(
    "quickpair:signal",
    (payload: { code: string; targetPeerId: string; kind: "offer" | "answer" | "ice-candidate"; data: unknown }) => {
      const members = roomMembers.get(payload.code);
      if (!members?.has(payload.targetPeerId)) return; // not a real member of this code's room — ignore

      getIO()?.to(payload.targetPeerId).emit("quickpair:signal", {
        fromPeerId: socket.id,
        kind: payload.kind,
        data: payload.data,
      });
    }
  );

  const leaveCode = (code: string) => {
    const members = roomMembers.get(code);
    if (!members?.delete(socket.id)) return;
    socket.leave(roomKey(code));
    if (members.size === 0) {
      roomMembers.delete(code);
      void QuickPairSession.deleteOne({ code }).catch(() => undefined);
    } else {
      socket.to(roomKey(code)).emit("quickpair:peer-left", { peerId: socket.id });
    }
  };

  // The app's socket connection is long-lived and shared with every other
  // real-time feature, so leaving a pairing session can't rely on the
  // socket disconnecting — it needs its own explicit event. Disconnect
  // (tab closed, network dropped) is still covered below as a fallback.
  socket.on("quickpair:leave", (input: { code: string }) => leaveCode(input.code));

  socket.on("disconnect", () => {
    for (const code of [...roomMembers.keys()]) leaveCode(code);
  });
}
