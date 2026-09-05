import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

/**
 * An ephemeral, cross-account signaling room: two or more devices that
 * merely both know this code can relay WebRTC offer/answer/ICE messages to
 * each other, regardless of whether they share an account or a Room. That's
 * a deliberate departure from PairingSession (which adds a device to the
 * INITIATOR'S OWN account/room) — this one only ever brokers a one-off
 * handshake. Nothing about it is persisted once the session expires; actual
 * transferred bytes never touch the server at all.
 */
const quickPairSessionSchema = new Schema(
  {
    code: { type: String, required: true, unique: true },
    hostSocketId: { type: String, required: true },
    expiresAt: { type: Date, required: true, expires: 0 },
  },
  { timestamps: true }
);

export type QuickPairSessionDocument = HydratedDocument<InferSchemaType<typeof quickPairSessionSchema>>;

export const QuickPairSession = model("QuickPairSession", quickPairSessionSchema);
