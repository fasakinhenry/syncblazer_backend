import type { Request, Response } from "express";
import { randomBytes } from "node:crypto";
import { Note } from "@/models/Note.model.ts";
import { User } from "@/models/User.model.ts";
import { ApiError } from "@/utils/ApiError.ts";
import { asyncHandler } from "@/utils/asyncHandler.ts";
import { recordActivity } from "@/services/activity.service.ts";
import { ActivityType } from "@/constants/index.ts";
import { getIO } from "@/sockets/socket.server.ts";
import { memberRoomIds, noteAccessFilter as accessFilter } from "@/services/noteAccess.service.ts";

export const listNotes = asyncHandler(async (req: Request, res: Response) => {
  const { roomId, search } = req.query as { roomId?: string; search?: string };
  const roomIds = await memberRoomIds(req.userId!);

  const filter: Record<string, unknown> = accessFilter(req.userId!, roomIds);
  if (roomId) filter.roomId = roomId;
  if (search) filter.$text = { $search: search };

  const notes = await Note.find(filter).sort({ updatedAt: -1 });
  res.json({ success: true, data: { notes } });
});

export const getNote = asyncHandler(async (req: Request, res: Response) => {
  const roomIds = await memberRoomIds(req.userId!);
  const note = await Note.findOne({ _id: req.params.noteId, ...accessFilter(req.userId!, roomIds) });
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
  const note = await Note.findOneAndUpdate(
    { _id: req.params.noteId, ...accessFilter(req.userId!, roomIds) },
    { $set: req.body },
    { new: true }
  );
  if (!note) throw ApiError.notFound("Note not found");

  getIO()?.to(`room:${note.roomId.toString()}`).emit("note:updated", { note });

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
  if (enabled && !note.publicShare?.token) {
    note.publicShare = { enabled: true, token: randomBytes(12).toString("hex"), viewCount: 0 };
  } else {
    note.set("publicShare.enabled", enabled);
  }
  await note.save();

  await recordActivity({
    ownerId: req.userId!,
    roomId: note.roomId.toString(),
    type: ActivityType.NOTE_UPDATED,
    message: enabled ? `"${note.title}" is now shared via link` : `"${note.title}" link sharing turned off`,
    metadata: { noteId: note._id },
  });

  getIO()?.to(`room:${note.roomId.toString()}`).emit("note:updated", { note });

  res.json({ success: true, data: { note } });
});

// Public, unauthenticated: anyone with the link can read (never edit).
export const getPublicNote = asyncHandler(async (req: Request, res: Response) => {
  const note = await Note.findOneAndUpdate(
    { "publicShare.token": req.params.token, "publicShare.enabled": true },
    { $inc: { "publicShare.viewCount": 1 }, $set: { "publicShare.lastViewedAt": new Date() } },
    { new: true }
  ).select("title content fontFamily updatedAt ownerId");
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
      },
      owner: owner ? { name: owner.get("name"), avatarUrl: owner.get("avatarUrl") } : null,
    },
  });
});
