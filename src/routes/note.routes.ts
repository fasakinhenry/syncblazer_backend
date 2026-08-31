import { Router } from "express";
import { createNote, deleteNote, getNote, listNotes, updateNote } from "@/controllers/note.controller.ts";
import { requireAuth } from "@/middleware/auth.middleware.ts";
import { validate } from "@/middleware/validate.middleware.ts";
import {
  createNoteSchema,
  listNotesQuerySchema,
  noteIdParamSchema,
  updateNoteSchema,
} from "@/validators/note.validators.ts";

export const noteRouter = Router();

noteRouter.use(requireAuth);

noteRouter.get("/", validate({ query: listNotesQuerySchema }), listNotes);
noteRouter.post("/", validate({ body: createNoteSchema }), createNote);
noteRouter.get("/:noteId", validate({ params: noteIdParamSchema }), getNote);
noteRouter.patch("/:noteId", validate({ params: noteIdParamSchema, body: updateNoteSchema }), updateNote);
noteRouter.delete("/:noteId", validate({ params: noteIdParamSchema }), deleteNote);
