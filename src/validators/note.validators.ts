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
  // What "room" visibility grants room members — view only, or view+edit.
  roomAccess: z.enum(["view", "edit"]).optional(),
  fontFamily: z.string().max(60).optional(),
  // Moves the note to a different room the caller belongs to — owner-only,
  // enforced in the controller (this schema just accepts the shape).
  roomId: z.string().min(1).optional(),
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
  // Access level for the public link — "view" (default, safe) or "edit"
  // (any authenticated user who opens the link can edit — never anonymous,
  // no-login writes). Omitted keeps whatever access level was already set.
  access: z.enum(["view", "edit"]).optional(),
});

export const publicNoteTokenParamSchema = z.object({
  token: z.string().min(1),
});
