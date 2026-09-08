import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

const messageSchema = new Schema(
  {
    roomId: { type: Schema.Types.ObjectId, ref: "Room", required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    senderDeviceId: { type: Schema.Types.ObjectId, ref: "Device", required: true },
    epoch: { type: Number, required: true },
    // Client-declared, non-sensitive UI hint only (lets the message list
    // show an icon before decrypting) — the real payload, including
    // attachment key/mime/filename for image and audio messages, lives
    // entirely inside the encrypted ciphertext (see roomChatCrypto.ts on
    // the frontend). The server never learns more than "some message of
    // this shape was sent," never its content.
    type: { type: String, enum: ["text", "image", "audio"], default: "text" },
    ciphertext: { type: String, required: true },
    iv: { type: String, required: true },
  },
  { timestamps: true }
);

messageSchema.index({ roomId: 1, createdAt: -1 });

export type MessageDocument = HydratedDocument<InferSchemaType<typeof messageSchema>>;
export const Message = model("Message", messageSchema);
