import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { ActivityType } from "@/constants/index.ts";

const activitySchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    roomId: { type: Schema.Types.ObjectId, ref: "Room", required: true, index: true },
    type: { type: String, enum: Object.values(ActivityType), required: true },
    message: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

activitySchema.index({ roomId: 1, createdAt: -1 });

export type ActivityDocument = HydratedDocument<InferSchemaType<typeof activitySchema>>;

export const Activity = model("Activity", activitySchema);
