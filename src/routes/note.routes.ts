import { Router } from "express";
import {
  createNote,
  deleteNote,
  getNote,
  getPublicNote,
  listNotes,
  shareNote,
  updateNote,
} from "@/controllers/note.controller.ts";
import { requireAuth } from "@/middleware/auth.middleware.ts";
import { validate } from "@/middleware/validate.middleware.ts";
import {
  createNoteSchema,
  listNotesQuerySchema,
  noteIdParamSchema,
  publicNoteTokenParamSchema,
  shareNoteSchema,
  updateNoteSchema,
} from "@/validators/note.validators.ts";

export const noteRouter = Router();

// Public, unauthenticated — must be registered before requireAuth below.
noteRouter.get("/shared/:token", validate({ params: publicNoteTokenParamSchema }), getPublicNote);

noteRouter.use(requireAuth);

noteRouter.get("/", validate({ query: listNotesQuerySchema }), listNotes);
noteRouter.post("/", validate({ body: createNoteSchema }), createNote);
noteRouter.get("/:noteId", validate({ params: noteIdParamSchema }), getNote);
noteRouter.patch("/:noteId", validate({ params: noteIdParamSchema, body: updateNoteSchema }), updateNote);
noteRouter.delete("/:noteId", validate({ params: noteIdParamSchema }), deleteNote);
noteRouter.post("/:noteId/share", validate({ params: noteIdParamSchema, body: shareNoteSchema }), shareNote);
