import { Room } from "@/models/Room.model.ts";
import { Note } from "@/models/Note.model.ts";

export async function memberRoomIds(userId: string): Promise<string[]> {
  const rooms = await Room.find({ $or: [{ ownerId: userId }, { memberIds: userId }] }).select("_id");
  return rooms.map((r) => r._id.toString());
}

/** Owner always has full access. Otherwise a note is visible to anyone in
 * the room it lives in, as long as the note opted into that via
 * visibility: "room" (being in the room isn't enough on its own) — this is
 * the broader of the two filters, used for reads. A note shared for public
 * viewing is visible to literally anyone, authenticated or not, which is
 * why it's handled by its own dedicated (unauthenticated) route rather than
 * folded in here. */
export function noteReadFilter(userId: string, roomIds: string[]) {
  return { $or: [{ ownerId: userId }, { roomId: { $in: roomIds }, visibility: "room" }] };
}

/** Same as the read filter, but a room only grants it when the note's
 * roomAccess is "edit" (not just "view") — and a note publicly shared with
 * access: "edit" grants it to ANY authenticated user, not just room
 * members, since that's the whole point of that setting. */
export function noteWriteFilter(userId: string, roomIds: string[]) {
  return {
    $or: [
      { ownerId: userId },
      { roomId: { $in: roomIds }, visibility: "room", roomAccess: "edit" },
      { "publicShare.enabled": true, "publicShare.access": "edit" },
    ],
  };
}

/** Used by the live-collaboration relay (noteCollab.ts) — joining that
 * session lets you push edits with no further per-message check, so it
 * requires write access, not just read. A view-only room member or a
 * view-only public link never gets the live collaborative editor; they see
 * the note through the plain read path instead. */
export async function canAccessNote(userId: string, noteId: string): Promise<boolean> {
  const roomIds = await memberRoomIds(userId);
  const note = await Note.findOne({ _id: noteId, ...noteWriteFilter(userId, roomIds) }).select("_id");
  return !!note;
}
