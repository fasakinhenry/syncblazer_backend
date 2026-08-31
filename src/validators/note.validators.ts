import { z } from "zod";

export const createNoteSchema = z.object({
  roomId: z.string().min(1),
  title: z.string().max(200).optional(),
  content: z.string().max(50_000).optional(),
});

export const updateNoteSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().max(50_000).optional(),
});

export const noteIdParamSchema = z.object({
  noteId: z.string().min(1),
});

export const listNotesQuerySchema = z.object({
  roomId: z.string().min(1).optional(),
  search: z.string().max(200).optional(),
});
