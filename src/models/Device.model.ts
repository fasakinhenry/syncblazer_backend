import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { DeviceType, DevicePlatform, DeviceStatus } from "@/constants/index.ts";

const deviceSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // Stable per-browser id the client generates once and reuses across
    // logins, so the same physical device is recognized (and reused)
    // instead of piling up a fresh Device record on every login.
    installId: { type: String, index: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: Object.values(DeviceType), required: true },
    platform: { type: String, enum: Object.values(DevicePlatform), required: true },
    publicKey: { type: String, select: false },
    status: { type: String, enum: Object.values(DeviceStatus), default: DeviceStatus.OFFLINE },
    lastSeenAt: { type: Date, default: Date.now },
    socketId: { type: String, select: false },
    isCurrent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

deviceSchema.index({ ownerId: 1, name: 1 });
deviceSchema.index({ ownerId: 1, installId: 1 });

export type DeviceDocument = HydratedDocument<InferSchemaType<typeof deviceSchema>>;

export const Device = model("Device", deviceSchema);
