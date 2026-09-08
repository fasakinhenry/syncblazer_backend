import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { RoomType } from "@/constants/index.ts";

const roomSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: Object.values(RoomType), default: RoomType.PERSONAL },
    isDefault: { type: Boolean, default: false },
    deviceIds: [{ type: Schema.Types.ObjectId, ref: "Device" }],
    memberIds: [{ type: Schema.Types.ObjectId, ref: "User" }],

    // Shareable join code. Every non-personal room gets one so it can be
    // joined by anyone who has it, the same way Blaze lets you join a room
    // by its name. Personal (default) rooms never get one since they're
    // private device hubs, not shared spaces.
    code: { type: String, unique: true, sparse: true },

    // Instant rooms are throwaway: quick, auto-named, and cleaned up by the
    // TTL index below once expiresAt passes. Named rooms never set this.
    isInstant: { type: Boolean, default: false },
    expiresAt: { type: Date, expires: 0 },

    // The current E2EE chat "epoch" — bumped by one whenever room membership
    // changes, so a fresh symmetric key gets wrapped for every current
    // member device and a removed member's device stops receiving new
    // epochs. 0 means chat has never been initialized for this room. The
    // server only ever hands out this counter; it never sees the actual key
    // material (see RoomChatKeyEnvelope.model.ts).
    chatEpoch: { type: Number, default: 0 },
  },
  { timestamps: true }
);

roomSchema.index({ ownerId: 1, isDefault: 1 });

export type RoomDocument = HydratedDocument<InferSchemaType<typeof roomSchema>>;

export const Room = model("Room", roomSchema);
