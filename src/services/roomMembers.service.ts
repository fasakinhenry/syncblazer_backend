import { Room } from "@/models/Room.model.ts";
import { User } from "@/models/User.model.ts";

/** Everyone with room-level access to a note/room, except the person who
 * just triggered the event — used by both the email-notification service
 * (notifications.service.ts) and the in-app notification service
 * (userNotification.service.ts) so recipient resolution stays in one place.
 * Guests (no email on file) are still included here; it's up to the caller
 * to skip them if it specifically needs an email address. */
export async function roomNotifyTargets(
  roomId: unknown,
  excludeUserId: string
): Promise<{ _id: unknown; name: string; email?: string | null }[]> {
  const room = await Room.findById(roomId).select("ownerId memberIds");
  if (!room) return [];
  const recipientIds = [room.get("ownerId"), ...(room.get("memberIds") as unknown[])]
    .map((id) => String(id))
    .filter((id) => id !== excludeUserId);
  if (recipientIds.length === 0) return [];

  const users = await User.find({ _id: { $in: recipientIds } }).select("name email");
  return users.map((u) => ({ _id: u._id, name: u.get("name"), email: u.get("email") }));
}

/** Same recipient set as roomNotifyTargets, but skips the User lookup for
 * callers (in-app notifications) that only need ids, not names/emails. */
export async function roomMemberIds(roomId: unknown, excludeUserId?: string): Promise<string[]> {
  const room = await Room.findById(roomId).select("ownerId memberIds");
  if (!room) return [];
  return [room.get("ownerId"), ...(room.get("memberIds") as unknown[])]
    .map((id) => String(id))
    .filter((id) => id !== excludeUserId);
}
