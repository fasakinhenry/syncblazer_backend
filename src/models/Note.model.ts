import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

const noteSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    roomId: { type: Schema.Types.ObjectId, ref: "Room", required: true, index: true },
    title: { type: String, required: true, trim: true, default: "Untitled note" },
    // Canonical storage format is Markdown (the note editor round-trips
    // through it), so "save as Markdown" is just handing back this field.
    content: { type: String, default: "" },
    fontFamily: { type: String, default: "Inter" },

    // Encoded Yjs document state for live collaborative editing (see
    // sockets/noteCollab.ts). Opaque binary — the server never parses it,
    // only relays/persists it; `content` above stays the source of truth
    // for everything that isn't live co-editing (search, export, the public
    // share page). Undefined until a note's first collaborative session.
    yjsState: { type: Buffer, required: false },

    // "private": only the owner can see/edit it, even if roomId is a shared room.
    // "room": every member of roomId can at least view it — roomAccess below
    // says whether they can edit it too.
    visibility: { type: String, enum: ["private", "room"], default: "private" },
    // What "room" visibility actually grants room members. Only meaningful
    // when visibility === "room"; ignored otherwise.
    roomAccess: { type: String, enum: ["view", "edit"], default: "edit" },

    publicShare: {
      enabled: { type: Boolean, default: false },
      // "view": the unauthenticated /n/:token page is read-only (default,
      // safest). "edit": that same page becomes a real (anonymous, no
      // login) editor — a deliberate trade-off the owner opts into.
      access: { type: String, enum: ["view", "edit"], default: "view" },
      // Unguessable id used in the public URL; only set once shared.
      token: { type: String, unique: true, sparse: true },
      viewCount: { type: Number, default: 0 },
      lastViewedAt: { type: Date },
    },
  },
  { timestamps: true }
);

noteSchema.index({ ownerId: 1, updatedAt: -1 });
noteSchema.index({ roomId: 1, visibility: 1 });
noteSchema.index({ title: "text", content: "text" });

export type NoteDocument = HydratedDocument<InferSchemaType<typeof noteSchema>>;

export const Note = model("Note", noteSchema);
