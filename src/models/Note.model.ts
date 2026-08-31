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

    // "private": only the owner can see/edit it, even if roomId is a shared room.
    // "room": every member of roomId can view and edit it.
    visibility: { type: String, enum: ["private", "room"], default: "private" },

    publicShare: {
      enabled: { type: Boolean, default: false },
      // Unguessable id used in the public read-only URL; only set once shared.
      token: { type: String, unique: true, sparse: true },
    },
  },
  { timestamps: true }
);

noteSchema.index({ ownerId: 1, updatedAt: -1 });
noteSchema.index({ roomId: 1, visibility: 1 });
noteSchema.index({ title: "text", content: "text" });

export type NoteDocument = HydratedDocument<InferSchemaType<typeof noteSchema>>;

export const Note = model("Note", noteSchema);
