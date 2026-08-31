import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

const pairingSessionSchema = new Schema(
  {
    // The user + device that generated the QR code (usually a laptop/desktop).
    initiatorUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    initiatorDeviceId: { type: Schema.Types.ObjectId, ref: "Device", required: true },
    roomId: { type: Schema.Types.ObjectId, ref: "Room", required: true },

    // Short-lived, single-use pairing token embedded in the QR code.
    // Never a permanent credential.
    token: { type: String, required: true, unique: true },

    // Human-typeable fallback for devices that can't scan a QR code (e.g. "482-193").
    shortCode: { type: String, required: true, unique: true },

    status: {
      type: String,
      enum: ["pending", "consumed", "expired"],
      default: "pending",
    },

    consumedByDeviceId: { type: Schema.Types.ObjectId, ref: "Device" },
    consumedAt: { type: Date },

    expiresAt: { type: Date, required: true, expires: 0 },
  },
  { timestamps: true }
);

export type PairingSessionDocument = HydratedDocument<InferSchemaType<typeof pairingSessionSchema>>;

export const PairingSession = model("PairingSession", pairingSessionSchema);
