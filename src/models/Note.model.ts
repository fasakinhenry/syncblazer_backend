import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

const noteSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    roomId: { type: Schema.Types.ObjectId, ref: "Room", required: true, index: true },
    title: { type: String, required: true, trim: true, default: "Untitled note" },
    content: { type: String, default: "" },
  },
  { timestamps: true }
);

noteSchema.index({ ownerId: 1, updatedAt: -1 });
noteSchema.index({ title: "text", content: "text" });

export type NoteDocument = HydratedDocument<InferSchemaType<typeof noteSchema>>;

export const Note = model("Note", noteSchema);
