import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

// A room's chat symmetric key, individually wrapped for one recipient
// device's public key — opaque ciphertext to the server either way. One row
// per (room, device, epoch); a device collects every envelope addressed to
// it to decrypt whichever epochs it was a member for.
const roomChatKeyEnvelopeSchema = new Schema(
  {
    roomId: { type: Schema.Types.ObjectId, ref: "Room", required: true, index: true },
    deviceId: { type: Schema.Types.ObjectId, ref: "Device", required: true, index: true },
    epoch: { type: Number, required: true },
    wrappedKey: { type: String, required: true },
    iv: { type: String, required: true },
    fromDeviceId: { type: Schema.Types.ObjectId, ref: "Device", required: true },
  },
  { timestamps: true }
);

roomChatKeyEnvelopeSchema.index({ roomId: 1, deviceId: 1, epoch: 1 }, { unique: true });

export type RoomChatKeyEnvelopeDocument = HydratedDocument<InferSchemaType<typeof roomChatKeyEnvelopeSchema>>;
export const RoomChatKeyEnvelope = model("RoomChatKeyEnvelope", roomChatKeyEnvelopeSchema);
