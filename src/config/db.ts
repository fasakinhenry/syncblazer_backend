import mongoose from "mongoose";
import { env } from "@/config/env.ts";
import { logger } from "@/utils/logger.ts";
import { User } from "@/models/User.model.ts";
import { Room } from "@/models/Room.model.ts";

export async function connectDatabase(): Promise<void> {
  mongoose.set("strictQuery", true);

  mongoose.connection.on("disconnected", () => {
    logger.warn("MongoDB disconnected");
  });

  mongoose.connection.on("error", (err) => {
    logger.error("MongoDB connection error", err);
  });

  await mongoose.connect(env.mongodbUri);
  logger.info(`MongoDB connected -> ${mongoose.connection.name}`);

  // Reconcile indexes with the current schema. Needed here because an
  // earlier version of User had `email` as a required, non-sparse unique
  // field; Mongoose's autoIndex only creates missing indexes, it never
  // rebuilds one whose options changed, so without this a stale non-sparse
  // unique index on email would reject every guest/second account (they
  // all have email = null, which a non-sparse unique index only allows once).
  await User.syncIndexes();
  await Room.syncIndexes();
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
