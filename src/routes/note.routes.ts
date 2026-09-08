import { Router } from "express";
import {
  createNote,
  deleteNote,
  getNote,
  getPublicNote,
  listNotes,
  openSharedNote,
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
// Read-only: editing a note always requires being signed in (see
// GET /shared/:token/open below and PATCH /:noteId), even when the owner
// turned on public "edit" access — that setting means "any authenticated
// user with the link," not "literally anyone, no login."
noteRouter.get("/shared/:token", validate({ params: publicNoteTokenParamSchema }), getPublicNote);

noteRouter.use(requireAuth);

noteRouter.get("/", validate({ query: listNotesQuerySchema }), listNotes);
noteRouter.post("/", validate({ body: createNoteSchema }), createNote);
// Resolves a share token to the real note for a signed-in visitor — must
// come before /:noteId so "shared" isn't swallowed as a note id.
noteRouter.get("/shared/:token/open", validate({ params: publicNoteTokenParamSchema }), openSharedNote);
noteRouter.get("/:noteId", validate({ params: noteIdParamSchema }), getNote);
noteRouter.patch("/:noteId", validate({ params: noteIdParamSchema, body: updateNoteSchema }), updateNote);
noteRouter.delete("/:noteId", validate({ params: noteIdParamSchema }), deleteNote);
noteRouter.post("/:noteId/share", validate({ params: noteIdParamSchema, body: shareNoteSchema }), shareNote);
