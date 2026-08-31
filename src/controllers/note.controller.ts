import type { Request, Response } from "express";
import { Note } from "@/models/Note.model.ts";
import { ApiError } from "@/utils/ApiError.ts";
import { asyncHandler } from "@/utils/asyncHandler.ts";
import { recordActivity } from "@/services/activity.service.ts";
import { ActivityType } from "@/constants/index.ts";
import { getIO } from "@/sockets/socket.server.ts";

export const listNotes = asyncHandler(async (req: Request, res: Response) => {
  const { roomId, search } = req.query as { roomId?: string; search?: string };

  const filter: Record<string, unknown> = { ownerId: req.userId };
  if (roomId) filter.roomId = roomId;
  if (search) filter.$text = { $search: search };

  const notes = await Note.find(filter).sort({ updatedAt: -1 });
  res.json({ success: true, data: { notes } });
});

export const getNote = asyncHandler(async (req: Request, res: Response) => {
  const note = await Note.findOne({ _id: req.params.noteId, ownerId: req.userId });
  if (!note) throw ApiError.notFound("Note not found");
  res.json({ success: true, data: { note } });
});

export const createNote = asyncHandler(async (req: Request, res: Response) => {
  const note = await Note.create({
    ownerId: req.userId,
    roomId: req.body.roomId,
    title: req.body.title ?? "Untitled note",
    content: req.body.content ?? "",
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
  const note = await Note.findOneAndUpdate(
    { _id: req.params.noteId, ownerId: req.userId },
    { $set: req.body },
    { new: true }
  );
  if (!note) throw ApiError.notFound("Note not found");

  getIO()?.to(`room:${note.roomId.toString()}`).emit("note:updated", { note });

  res.json({ success: true, data: { note } });
});

export const deleteNote = asyncHandler(async (req: Request, res: Response) => {
  const note = await Note.findOneAndDelete({ _id: req.params.noteId, ownerId: req.userId });
  if (!note) throw ApiError.notFound("Note not found");

  getIO()?.to(`room:${note.roomId.toString()}`).emit("note:deleted", { noteId: note._id });

  res.json({ success: true, data: { noteId: note._id } });
});
