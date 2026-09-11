import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { NotificationCategory, NotificationType } from "@/constants/index.ts";

// Per-recipient, unlike Activity.model.ts's actor-keyed log — userId here is
// always "who should see this," which for e.g. a note shared with a room is
// every other member, not the person who shared it.
const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    actorId: { type: Schema.Types.ObjectId, ref: "User" },
    type: { type: String, enum: Object.values(NotificationType), required: true },
    category: { type: String, enum: Object.values(NotificationCategory), required: true },
    message: { type: String, required: true },
    roomId: { type: Schema.Types.ObjectId, ref: "Room" },
    noteId: { type: Schema.Types.ObjectId, ref: "Note" },
    deviceId: { type: Schema.Types.ObjectId, ref: "Device" },
    metadata: { type: Schema.Types.Mixed },
    // Presence/absence is the read/unread flag — no separate boolean that
    // could drift out of sync with it.
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, category: 1, createdAt: -1 });

export type NotificationDocument = HydratedDocument<InferSchemaType<typeof notificationSchema>>;
export const Notification = model("Notification", notificationSchema);
