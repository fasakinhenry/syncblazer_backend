import type { Request, Response } from "express";
import { randomBytes } from "node:crypto";
import { Note } from "@/models/Note.model.ts";
import { User } from "@/models/User.model.ts";
import { ApiError } from "@/utils/ApiError.ts";
import { asyncHandler } from "@/utils/asyncHandler.ts";
import { recordActivity } from "@/services/activity.service.ts";
import { ActivityType } from "@/constants/index.ts";
import { getIO } from "@/sockets/socket.server.ts";
import { memberRoomIds, noteReadFilter, noteWriteFilter } from "@/services/noteAccess.service.ts";

export const listNotes = asyncHandler(async (req: Request, res: Response) => {
  const { roomId, search } = req.query as { roomId?: string; search?: string };
  const roomIds = await memberRoomIds(req.userId!);

  const filter: Record<string, unknown> = noteReadFilter(req.userId!, roomIds);
  if (roomId) filter.roomId = roomId;
  if (search) filter.$text = { $search: search };

  const notes = await Note.find(filter).sort({ updatedAt: -1 });
  res.json({ success: true, data: { notes } });
});

export const getNote = asyncHandler(async (req: Request, res: Response) => {
  const roomIds = await memberRoomIds(req.userId!);
  const note = await Note.findOne({ _id: req.params.noteId, ...noteReadFilter(req.userId!, roomIds) });
  if (!note) throw ApiError.notFound("Note not found");
  res.json({ success: true, data: { note } });
});

export const createNote = asyncHandler(async (req: Request, res: Response) => {
  const roomIds = await memberRoomIds(req.userId!);
  if (!roomIds.includes(req.body.roomId)) throw ApiError.forbidden("You don't have access to that room");

  const note = await Note.create({
    ownerId: req.userId,
    roomId: req.body.roomId,
    title: req.body.title ?? "Untitled note",
    content: req.body.content ?? "",
    visibility: req.body.visibility ?? "private",
    fontFamily: req.body.fontFamily,
  });

  await recordActivity({
    ownerId: req.userId!,
    roomId: note.roomId.toString(),
    type: ActivityType.NOTE_CREATED,
    message: `Note "${note.title}" created`,
    metadata: { noteId: note._id },
  });

  getIO()?.to(`room:${note.roomId.toString()}`).emit("note:created", { note });

  res.status(201).json({ success: true, data: { note } });
});

export const updateNote = asyncHandler(async (req: Request, res: Response) => {
  const roomIds = await memberRoomIds(req.userId!);
  const patch = { ...req.body } as Record<string, unknown>;

  // Moving a note to a different room ("the selection of rooms" in the
  // share UI) is an ownership-level decision, not something a room
  // collaborator with plain edit access should be able to do — and the
  // destination has to be somewhere the owner actually belongs.
  let oldRoomId: string | null = null;
  if (typeof patch.roomId === "string") {
    const existing = await Note.findById(req.params.noteId).select("ownerId roomId");
    if (!existing) throw ApiError.notFound("Note not found");
    if (existing.get("ownerId").toString() !== req.userId) {
      throw ApiError.forbidden("Only the owner can move a note to a different room");
    }
    if (!roomIds.includes(patch.roomId as string)) {
      throw ApiError.forbidden("You don't have access to that room");
    }
    oldRoomId = existing.get("roomId").toString();
  }

  const note = await Note.findOneAndUpdate(
    { _id: req.params.noteId, ...noteWriteFilter(req.userId!, roomIds) },
    { $set: patch },
    { new: true }
  );
  if (!note) throw ApiError.notFound("Note not found");

  const newRoomId = note.roomId.toString();
  if (oldRoomId && oldRoomId !== newRoomId) {
    // The old room's members need to see it disappear live, not just on
    // their next refresh; the new room's members see it as freshly arrived.
    getIO()?.to(`room:${oldRoomId}`).emit("note:deleted", { noteId: note._id });
    getIO()?.to(`room:${newRoomId}`).emit("note:created", { note });
  } else {
    getIO()?.to(`room:${newRoomId}`).emit("note:updated", { note });
  }

  res.json({ success: true, data: { note } });
});

export const deleteNote = asyncHandler(async (req: Request, res: Response) => {
  // Deletion stays owner-only even for shared notes, so a collaborator
  // editing along with you can't wipe it out from under you.
  const note = await Note.findOneAndDelete({ _id: req.params.noteId, ownerId: req.userId });
  if (!note) throw ApiError.notFound("Note not found");

  getIO()?.to(`room:${note.roomId.toString()}`).emit("note:deleted", { noteId: note._id });

  res.json({ success: true, data: { noteId: note._id } });
});

export const shareNote = asyncHandler(async (req: Request, res: Response) => {
  const note = await Note.findOne({ _id: req.params.noteId, ownerId: req.userId });
  if (!note) throw ApiError.notFound("Note not found");

  const enabled = req.body.enabled as boolean;
  const access = (req.body.access as "view" | "edit" | undefined) ?? note.get("publicShare")?.access ?? "view";

  if (enabled && !note.get("publicShare")?.token) {
    note.set("publicShare", { enabled: true, access, token: randomBytes(12).toString("hex"), viewCount: 0 });
  } else {
    note.set("publicShare.enabled", enabled);
    note.set("publicShare.access", access);
  }
  await note.save();

  await recordActivity({
    ownerId: req.userId!,
    roomId: note.roomId.toString(),
    type: ActivityType.NOTE_UPDATED,
    message: enabled
      ? `"${note.title}" is now shared via link (${access === "edit" ? "anyone with the link can edit" : "view only"})`
      : `"${note.title}" link sharing turned off`,
    metadata: { noteId: note._id },
  });

  getIO()?.to(`room:${note.roomId.toString()}`).emit("note:updated", { note });

  res.json({ success: true, data: { note } });
});

// Public, unauthenticated: anyone with the link can read; whether they can
// also edit depends on publicShare.access, surfaced here so the public page
// knows whether to render an editor at all.
export const getPublicNote = asyncHandler(async (req: Request, res: Response) => {
  const note = await Note.findOneAndUpdate(
    { "publicShare.token": req.params.token, "publicShare.enabled": true },
    { $inc: { "publicShare.viewCount": 1 }, $set: { "publicShare.lastViewedAt": new Date() } },
    { new: true }
  ).select("title content fontFamily updatedAt ownerId publicShare");
  if (!note) throw ApiError.notFound("This shared note isn't available");

  const owner = await User.findById(note.get("ownerId")).select("name avatarUrl");

  res.json({
    success: true,
    data: {
      note: {
        title: note.get("title"),
        content: note.get("content"),
        fontFamily: note.get("fontFamily"),
        updatedAt: note.get("updatedAt"),
        access: note.get("publicShare")?.access === "edit" ? "edit" : "view",
      },
      owner: owner ? { name: owner.get("name"), avatarUrl: owner.get("avatarUrl") } : null,
    },
  });
});

// Public, unauthenticated, rate-limited at the route level (see
// note.routes.ts) — the deliberate anonymous-editing surface: only reachable
// with the exact unguessable token, only does anything when the owner
// explicitly turned on publicShare.access: "edit", and only ever touches
// title/content/fontFamily — never visibility, sharing settings, or roomId.
export const updatePublicNote = asyncHandler(async (req: Request, res: Response) => {
  const { title, content, fontFamily } = req.body as { title?: string; content?: string; fontFamily?: string };
  const patch: Record<string, unknown> = {};
  if (title !== undefined) patch.title = title;
  if (content !== undefined) patch.content = content;
  if (fontFamily !== undefined) patch.fontFamily = fontFamily;

  // Full document (not a projected subset) for the broadcast below — other
  // clients watching this note's room expect the same complete shape
  // updateNote/shareNote already send them, not a partial one that would
  // clobber fields like ownerId/visibility/publicShare in their local state.
  const note = await Note.findOneAndUpdate(
    { "publicShare.token": req.params.token, "publicShare.enabled": true, "publicShare.access": "edit" },
    { $set: patch },
    { new: true }
  );
  if (!note) throw ApiError.notFound("This shared note isn't available for editing");

  getIO()?.to(`room:${note.roomId.toString()}`).emit("note:updated", { note });

  res.json({
    success: true,
    data: {
      note: {
        title: note.get("title"),
        content: note.get("content"),
        fontFamily: note.get("fontFamily"),
        updatedAt: note.get("updatedAt"),
        access: "edit" as const,
      },
    },
  });
});
