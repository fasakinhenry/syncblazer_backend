import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

// Bridges the gap when someone's invited to a room by email but doesn't
// have a SyncBlaze account yet — the invite has to survive until they
// register. Once an account with that email exists, an invite is fulfilled
// immediately instead (see room.controller.ts's inviteToRoom) and this
// collection is only ever touched for the "no account yet" case.
const roomInviteSchema = new Schema(
  {
    roomId: { type: Schema.Types.ObjectId, ref: "Room", required: true, index: true },
    invitedEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    token: { type: String, required: true, unique: true },
    status: { type: String, enum: ["pending", "accepted"], default: "pending" },
  },
  { timestamps: true }
);

roomInviteSchema.index({ roomId: 1, invitedEmail: 1 });

export type RoomInviteDocument = HydratedDocument<InferSchemaType<typeof roomInviteSchema>>;

export const RoomInvite = model("RoomInvite", roomInviteSchema);
