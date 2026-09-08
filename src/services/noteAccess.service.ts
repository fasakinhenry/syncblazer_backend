import { Room } from "@/models/Room.model.ts";
import { Note } from "@/models/Note.model.ts";

export async function memberRoomIds(userId: string): Promise<string[]> {
  const rooms = await Room.find({ $or: [{ ownerId: userId }, { memberIds: userId }] }).select("_id");
  return rooms.map((r) => r._id.toString());
}

/** Owner always has access; otherwise a note is visible/editable by anyone
 * in the room it lives in, but only if the note itself opted into that via
 * visibility: "room" — being in the room isn't enough on its own. */
export function noteAccessFilter(userId: string, roomIds: string[]) {
  return { $or: [{ ownerId: userId }, { roomId: { $in: roomIds }, visibility: "room" }] };
}

export async function canAccessNote(userId: string, noteId: string): Promise<boolean> {
  const roomIds = await memberRoomIds(userId);
  const note = await Note.findOne({ _id: noteId, ...noteAccessFilter(userId, roomIds) }).select("_id");
  return !!note;
}
