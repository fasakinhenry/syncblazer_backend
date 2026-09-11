import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

// The backing store for a public room's Files history — deliberately
// separate from Transfer.model.ts, which stays exactly what it's always
// been (a point-to-point, P2P-preferred, single-receiver-device record for
// the existing quick-send flow). A RoomFile is always cloud-backed, since
// the whole point is that it's still there to redownload later even if the
// recipient was offline when it was shared.
const roomFileSchema = new Schema(
  {
    roomId: { type: Schema.Types.ObjectId, ref: "Room", required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    senderDeviceId: { type: Schema.Types.ObjectId, ref: "Device", required: true },
    name: { type: String, required: true },
    size: { type: Number, required: true },
    mimeType: { type: String },
    storageKey: { type: String, required: true },
    // Groups files sent together in one action ("3 files"), purely a
    // display grouping — every file in a batch is still its own row.
    batchId: { type: String },
    visibility: { type: String, enum: ["room", "private"], default: "room" },
    // Set only when visibility === "private". Access is per-PERSON, not
    // per-device — whoever it's addressed to can open it from any of their
    // own signed-in devices, regardless of which one got the live ping.
    recipientId: { type: Schema.Types.ObjectId, ref: "User" },
    likedByUserIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    downloadedByUserIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    downloadCount: { type: Number, default: 0 },
    viewCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

roomFileSchema.index({ roomId: 1, createdAt: -1 });
roomFileSchema.index({ roomId: 1, recipientId: 1 });

export type RoomFileDocument = HydratedDocument<InferSchemaType<typeof roomFileSchema>>;
export const RoomFile = model("RoomFile", roomFileSchema);
