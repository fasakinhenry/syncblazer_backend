import { Schema, model } from "mongoose";

const pageViewSchema = new Schema(
  {
    path: { type: String, required: true, trim: true },
    referrer: { type: String, trim: true },
    // Anonymous, client-generated id (localStorage) — lets us count unique
    // visitors approximately without tracking anyone by identity.
    sessionId: { type: String, required: true, index: true },
    // Set only when the visitor happens to be logged in at the time.
    userId: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

pageViewSchema.index({ createdAt: -1 });

export const PageView = model("PageView", pageViewSchema);
