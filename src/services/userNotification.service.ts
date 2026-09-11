import { Notification } from "@/models/Notification.model.ts";
import { NOTIFICATION_CATEGORY_BY_TYPE, NotificationType } from "@/constants/index.ts";
import { getIO } from "@/sockets/socket.server.ts";
import { sendWebPushToUser } from "@/services/webPush.service.ts";
import { logger } from "@/utils/logger.ts";

interface NotifyUserInput {
  recipientIds: string | string[];
  actorId?: string;
  type: NotificationType;
  message: string;
  roomId?: string;
  noteId?: string;
  deviceId?: string;
  metadata?: Record<string, unknown>;
}

/** The one place every in-app notification gets created: writes the
 * Notification document(s), pushes a live update over the socket to
 * whoever's connected, and best-effort sends a Web Push. Fire-and-forget
 * from every call site (`void notifyUser(...)`), same convention as the
 * existing email notifications in notifications.service.ts — a
 * notification failing must never block or fail the action that
 * triggered it. */
export async function notifyUser(input: NotifyUserInput): Promise<void> {
  try {
    const recipientIds = [...new Set(Array.isArray(input.recipientIds) ? input.recipientIds : [input.recipientIds])].filter(
      Boolean
    );
    if (recipientIds.length === 0) return;

    const category = NOTIFICATION_CATEGORY_BY_TYPE[input.type];
    const base = {
      actorId: input.actorId,
      type: input.type,
      category,
      message: input.message,
      roomId: input.roomId,
      noteId: input.noteId,
      deviceId: input.deviceId,
      metadata: input.metadata,
    };

    type WrittenDoc = { _id: unknown; get(field: string): unknown; justCreated: boolean };
    let written: WrittenDoc[];
    if (input.type === NotificationType.NOTE_UPDATED && input.noteId) {
      // Repeated debounce-saves of the same note would otherwise flood the
      // feed (and, worse, someone's phone) with one push per keystroke-batch
      // — coalesce into a single unread row per recipient instead. Once they
      // read it, the next edit creates a fresh unread row again ("new
      // activity since you looked"). createdAt === updatedAt on the result
      // is how we tell "just inserted" apart from "refreshed an existing
      // still-unread row" — only the former should actually buzz a phone.
      // (Note: deliberately NOT using Mongoose's own `.isNew`, which means
      // something different — "never saved yet" — and isn't a reliable
      // insert-vs-update signal on a findOneAndUpdate result anyway.)
      const results = await Promise.all(
        recipientIds.map(async (userId) => {
          const doc = await Notification.findOneAndUpdate(
            { userId, type: NotificationType.NOTE_UPDATED, noteId: input.noteId, readAt: null },
            { $set: { ...base, userId } },
            { upsert: true, new: true }
          );
          if (!doc) return null;
          const justCreated = doc.get("createdAt")?.getTime?.() === doc.get("updatedAt")?.getTime?.();
          return Object.assign(doc, { justCreated }) as WrittenDoc;
        })
      );
      written = results.filter((doc): doc is WrittenDoc => !!doc);
    } else {
      const docs = await Notification.insertMany(recipientIds.map((userId) => ({ ...base, userId })));
      written = docs.map((doc) => Object.assign(doc, { justCreated: true }) as WrittenDoc);
    }

    const io = getIO();
    for (const doc of written) {
      // Always tell any open tab, even for a refreshed-not-new row — the
      // message text may have changed and the UI should stay current.
      io?.to(`user:${doc.get("userId")}`).emit("notification:new", doc);
    }

    const freshRecipientIds = written.filter((doc) => doc.justCreated).map((doc) => String(doc.get("userId")));
    void Promise.allSettled(
      freshRecipientIds.map((userId) =>
        sendWebPushToUser(userId, {
          title: "SyncBlaze",
          body: input.message,
          url: input.roomId ? `/rooms/${input.roomId}` : "/activity",
          tag: input.type,
        })
      )
    );
  } catch (err) {
    logger.error(`Failed to create notification: ${String(err)}`);
  }
}
