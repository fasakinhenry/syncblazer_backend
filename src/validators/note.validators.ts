import { z } from "zod";

const CONTENT_MAX = 300_000; // markdown, can include embedded link-preview/image blocks

export const createNoteSchema = z.object({
  roomId: z.string().min(1),
  title: z.string().max(200).optional(),
  content: z.string().max(CONTENT_MAX).optional(),
  visibility: z.enum(["private", "room"]).optional(),
  fontFamily: z.string().max(60).optional(),
});

export const updateNoteSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().max(CONTENT_MAX).optional(),
  visibility: z.enum(["private", "room"]).optional(),
  fontFamily: z.string().max(60).optional(),
});

export const noteIdParamSchema = z.object({
  noteId: z.string().min(1),
});

export const listNotesQuerySchema = z.object({
  roomId: z.string().min(1).optional(),
  search: z.string().max(200).optional(),
});

export const shareNoteSchema = z.object({
  enabled: z.boolean(),
});

export const publicNoteTokenParamSchema = z.object({
  token: z.string().min(1),
});
