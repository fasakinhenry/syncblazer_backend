import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    passwordHash: {
      type: String,
      select: false,
      required: function (this: { authProvider: string }) {
        return this.authProvider === "password";
      },
    },
    authProvider: { type: String, enum: ["password", "google", "guest"], default: "password" },
    googleId: { type: String, unique: true, sparse: true },
    avatarUrl: { type: String },
    defaultRoomId: { type: Schema.Types.ObjectId, ref: "Room" },
    preferences: {
      theme: { type: String, enum: ["light", "dark", "system"], default: "system" },
      clipboardSyncEnabled: { type: Boolean, default: false },
      screenshotSyncEnabled: { type: Boolean, default: false },
      defaultDestinationDeviceId: { type: Schema.Types.ObjectId, ref: "Device" },
    },
  },
  { timestamps: true }
);

userSchema.methods.comparePassword = function comparePassword(candidate: string) {
  return bcrypt.compare(candidate, this.passwordHash as string);
};

userSchema.statics.hashPassword = function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
};

export type UserDocument = HydratedDocument<
  InferSchemaType<typeof userSchema> & {
    comparePassword: (candidate: string) => Promise<boolean>;
  }
>;

export const User = model("User", userSchema);
