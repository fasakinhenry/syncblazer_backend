import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

// One row per browser/device push registration. `endpoint` is inherently a
// unique key per browser install, so registration is always an upsert on it
// rather than blindly inserting — re-subscribing the same browser (e.g. on
// every app open) never piles up duplicates.
const pushSubscriptionSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    deviceId: { type: Schema.Types.ObjectId, ref: "Device", index: true },
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    userAgent: { type: String },
  },
  { timestamps: true }
);

export type PushSubscriptionDocument = HydratedDocument<InferSchemaType<typeof pushSubscriptionSchema>>;
export const PushSubscription = model("PushSubscription", pushSubscriptionSchema);
