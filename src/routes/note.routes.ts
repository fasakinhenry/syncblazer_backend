import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  createNote,
  deleteNote,
  getNote,
  getPublicNote,
  listNotes,
  shareNote,
  updateNote,
  updatePublicNote,
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
  updatePublicNoteSchema,
} from "@/validators/note.validators.ts";

export const noteRouter = Router();

// Anonymous, no-login edits via a public "edit" link — capped generously
// per IP so a leaked/abused link can't be used to hammer the database.
const publicEditLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

// Public, unauthenticated — must be registered before requireAuth below.
noteRouter.get("/shared/:token", validate({ params: publicNoteTokenParamSchema }), getPublicNote);
noteRouter.patch(
  "/shared/:token",
  publicEditLimiter,
  validate({ params: publicNoteTokenParamSchema, body: updatePublicNoteSchema }),
  updatePublicNote
);

noteRouter.use(requireAuth);

noteRouter.get("/", validate({ query: listNotesQuerySchema }), listNotes);
noteRouter.post("/", validate({ body: createNoteSchema }), createNote);
noteRouter.get("/:noteId", validate({ params: noteIdParamSchema }), getNote);
noteRouter.patch("/:noteId", validate({ params: noteIdParamSchema, body: updateNoteSchema }), updateNote);
noteRouter.delete("/:noteId", validate({ params: noteIdParamSchema }), deleteNote);
noteRouter.post("/:noteId/share", validate({ params: noteIdParamSchema, body: shareNoteSchema }), shareNote);
