import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { TransferStatus, TransferType, TransferMethod } from "@/constants/index.ts";

const transferSchema = new Schema(
  {
    roomId: { type: Schema.Types.ObjectId, ref: "Room", required: true, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    senderDeviceId: { type: Schema.Types.ObjectId, ref: "Device", required: true },
    receiverDeviceId: { type: Schema.Types.ObjectId, ref: "Device", required: true },

    type: { type: String, enum: Object.values(TransferType), required: true },
    name: { type: String, required: true },
    size: { type: Number, default: 0 },
    mimeType: { type: String },

    // For TEXT / LINK transfers the payload is stored inline.
    // For FILE / IMAGE transfers this references the stored asset (cloud fallback only).
    textContent: { type: String },
    storageKey: { type: String },

    status: {
      type: String,
      enum: Object.values(TransferStatus),
      default: TransferStatus.CREATED,
      index: true,
    },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    transferMethod: { type: String, enum: Object.values(TransferMethod), required: true },
    errorMessage: { type: String },

    startedAt: { type: Date },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

transferSchema.index({ ownerId: 1, createdAt: -1 });
transferSchema.index({ roomId: 1, createdAt: -1 });

export type TransferDocument = HydratedDocument<InferSchemaType<typeof transferSchema>>;

export const Transfer = model("Transfer", transferSchema);
