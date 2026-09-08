import { Room } from "@/models/Room.model.ts";
import { Note } from "@/models/Note.model.ts";
import { User } from "@/models/User.model.ts";

export async function memberRoomIds(userId: string): Promise<string[]> {
  const rooms = await Room.find({ $or: [{ ownerId: userId }, { memberIds: userId }] }).select("_id");
  return rooms.map((r) => r._id.toString());
}

export async function isGuestUser(userId: string): Promise<boolean> {
  const user = await User.findById(userId).select("authProvider");
  return user?.get("authProvider") === "guest";
}

/** For "what shows in my notes list" — deliberately narrower than
 * noteReadFilter below: a note that's publicly shared but otherwise not
 * yours/your room's should never clutter a random authenticated user's
 * list just because it happens to be publicly shared. Only used by
 * listNotes. */
export function noteListFilter(userId: string, roomIds: string[]) {
  return { $or: [{ ownerId: userId }, { roomId: { $in: roomIds }, visibility: "room" }] };
}

/** For looking up one SPECIFIC note you already know the id of — broader
 * than the list filter because possessing a note's id here means you
 * either own/room-share it, or you got it by resolving a public share
 * token (see openSharedNote), which is itself the authorization: any
 * authenticated user holding a valid, enabled public link can read the
 * note it points to, same as an anonymous visitor already can. Reading is
 * never gated on guest status — only editing is. */
export function noteReadFilter(userId: string, roomIds: string[]) {
  return {
    $or: [{ ownerId: userId }, { roomId: { $in: roomIds }, visibility: "room" }, { "publicShare.enabled": true }],
  };
}

/** Same shape, but a room only grants it when the note's roomAccess is
 * "edit" (not just "view"), and a public share only grants it when
 * publicShare.access is "edit" — anyone authenticated, not just room
 * members, since that's the whole point of that setting.
 *
 * A guest account only ever gets this via ownership — guests can freely
 * edit their own notes, but never collaborate on someone else's (room or
 * public share). That's a deliberate growth lever: collaborating on a
 * shared note is what prompts a guest to create a real account. */
export function noteWriteFilter(userId: string, roomIds: string[], isGuest: boolean) {
  if (isGuest) return { ownerId: userId };
  return {
    $or: [
      { ownerId: userId },
      { roomId: { $in: roomIds }, visibility: "room", roomAccess: "edit" },
      { "publicShare.enabled": true, "publicShare.access": "edit" },
    ],
  };
}

export interface NoteAccessResult {
  canEdit: boolean;
}

/** Used by the live-collaboration + presence relay (noteCollab.ts) — one
 * query that answers both "can this socket even watch this note" (read)
 * and "can it push edits / count as an editor" (write), since both are
 * needed at join time anyway. Returns null when there's no read access at
 * all — a private note that isn't yours, or someone else's room note. */
export async function getNoteAccess(userId: string, noteId: string, isGuest: boolean): Promise<NoteAccessResult | null> {
  const roomIds = await memberRoomIds(userId);
  const note = await Note.findOne({ _id: noteId, ...noteReadFilter(userId, roomIds) }).select(
    "ownerId roomId visibility roomAccess publicShare"
  );
  if (!note) return null;

  const isOwner = note.get("ownerId").toString() === userId;
  const roomEdit =
    !isGuest &&
    note.get("visibility") === "room" &&
    roomIds.includes(note.get("roomId").toString()) &&
    note.get("roomAccess") === "edit";
  const publicShare = note.get("publicShare") as { enabled?: boolean; access?: string } | undefined;
  const publicEdit = !isGuest && !!publicShare?.enabled && publicShare.access === "edit";

  return { canEdit: isOwner || roomEdit || publicEdit };
}
