import type { Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import { User } from "@/models/User.model.ts";
import { Room } from "@/models/Room.model.ts";
import { Device } from "@/models/Device.model.ts";
import { Note } from "@/models/Note.model.ts";
import { Transfer } from "@/models/Transfer.model.ts";
import { Activity } from "@/models/Activity.model.ts";
import { RoomType, DeviceStatus } from "@/constants/index.ts";
import { ApiError } from "@/utils/ApiError.ts";
import { asyncHandler } from "@/utils/asyncHandler.ts";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "@/utils/jwt.ts";
import { generateAvatarUrl, generateGuestName } from "@/utils/guestIdentity.ts";
import { env } from "@/config/env.ts";

const googleClient = env.googleClientId ? new OAuth2Client(env.googleClientId) : null;

function toPublicUser(user: InstanceType<typeof User>) {
  return {
    id: user._id,
    name: user.get("name"),
    email: user.get("email"),
    avatarUrl: user.get("avatarUrl"),
    authProvider: user.get("authProvider"),
    isGuest: user.get("authProvider") === "guest",
    defaultRoomId: user.get("defaultRoomId"),
    preferences: user.get("preferences"),
  };
}

interface DeviceInfo {
  name: string;
  type: string;
  platform: string;
  installId?: string;
}

async function issueDevice(userId: string, roomId: string, device?: DeviceInfo) {
  if (!device) return undefined;

  // Recognize a device we've already seen (by its stable per-browser
  // installId) and reuse that record rather than creating a duplicate on
  // every login. Don't touch `name` here — the user may have renamed it,
  // and re-detecting it every login shouldn't undo that.
  if (device.installId) {
    const existing = await Device.findOneAndUpdate(
      { ownerId: userId, installId: device.installId },
      { status: DeviceStatus.ONLINE, lastSeenAt: new Date(), type: device.type, platform: device.platform },
      { new: true }
    );
    if (existing) {
      await Room.updateOne({ _id: roomId }, { $addToSet: { deviceIds: existing._id } });
      return existing;
    }
  }

  const created = await Device.create({
    ownerId: userId,
    installId: device.installId,
    name: device.name,
    type: device.type,
    platform: device.platform,
    status: DeviceStatus.ONLINE,
    lastSeenAt: new Date(),
    isCurrent: true,
  });
  await Room.updateOne({ _id: roomId }, { $addToSet: { deviceIds: created._id } });
  return created;
}

async function createUserWithDefaultRoom(fields: {
  name: string;
  email?: string;
  passwordHash?: string;
  authProvider: "password" | "google" | "guest";
  googleId?: string;
  avatarUrl?: string;
}) {
  const user = await User.create(fields);

  const room = await Room.create({
    ownerId: user._id,
    name: "My Room",
    type: RoomType.PERSONAL,
    isDefault: true,
  });
  user.set("defaultRoomId", room._id);
  await user.save();

  return { user, room };
}

function issueSession(userId: string, tokenVersion: number, deviceId?: string) {
  return {
    accessToken: signAccessToken({ userId, deviceId, tokenVersion }),
    refreshToken: signRefreshToken({ userId, deviceId, tokenVersion }),
  };
}

// Fire-and-forget on purpose — this is only for the admin dashboard's
// "last active" column, not worth adding latency to every login for.
function touchLastLogin(userId: string) {
  User.updateOne({ _id: userId }, { $set: { lastLoginAt: new Date() } }).catch(() => undefined);
}

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password, device } = req.body;

  const existing = await User.findOne({ email });
  if (existing) throw ApiError.conflict("An account with this email already exists");

  const passwordHash = await (User as unknown as { hashPassword: (p: string) => Promise<string> }).hashPassword(
    password
  );
  const { user, room } = await createUserWithDefaultRoom({
    name,
    email,
    passwordHash,
    authProvider: "password",
    avatarUrl: generateAvatarUrl(email),
  });

  const createdDevice = await issueDevice(user._id.toString(), room._id.toString(), device);
  const session = issueSession(
    user._id.toString(),
    (user.get("tokenVersion") as number | undefined) ?? 0,
    createdDevice?._id.toString()
  );
  touchLastLogin(user._id.toString());

  res.status(201).json({
    success: true,
    data: { user: toPublicUser(user), room, device: createdDevice, ...session },
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, device } = req.body;

  const user = await User.findOne({ email, authProvider: "password" }).select("+passwordHash");
  if (!user) throw ApiError.unauthorized("Invalid email or password");

  const valid = await (user as unknown as { comparePassword: (p: string) => Promise<boolean> }).comparePassword(
    password
  );
  if (!valid) throw ApiError.unauthorized("Invalid email or password");

  const defaultRoomId = user.get("defaultRoomId")?.toString();
  const createdDevice = defaultRoomId ? await issueDevice(user._id.toString(), defaultRoomId, device) : undefined;
  const session = issueSession(
    user._id.toString(),
    (user.get("tokenVersion") as number | undefined) ?? 0,
    createdDevice?._id.toString()
  );
  touchLastLogin(user._id.toString());

  res.json({ success: true, data: { user: toPublicUser(user), device: createdDevice, ...session } });
});

export const guest = asyncHandler(async (req: Request, res: Response) => {
  const { device } = req.body;

  const name = generateGuestName();
  const { user, room } = await createUserWithDefaultRoom({
    name,
    authProvider: "guest",
    avatarUrl: generateAvatarUrl(),
  });

  const createdDevice = await issueDevice(user._id.toString(), room._id.toString(), device);
  const session = issueSession(
    user._id.toString(),
    (user.get("tokenVersion") as number | undefined) ?? 0,
    createdDevice?._id.toString()
  );
  touchLastLogin(user._id.toString());

  res.status(201).json({
    success: true,
    data: { user: toPublicUser(user), room, device: createdDevice, ...session },
  });
});

export const google = asyncHandler(async (req: Request, res: Response) => {
  if (!googleClient) throw ApiError.badRequest("Sign in with Google isn't configured on this server");

  const { idToken, device } = req.body;

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken, audience: env.googleClientId });
    payload = ticket.getPayload();
  } catch {
    throw ApiError.unauthorized("That Google sign-in couldn't be verified");
  }
  if (!payload?.email || !payload.sub) throw ApiError.unauthorized("That Google sign-in couldn't be verified");

  let user = await User.findOne({ googleId: payload.sub });

  if (!user) {
    const existingByEmail = await User.findOne({ email: payload.email });
    if (existingByEmail) {
      existingByEmail.set("googleId", payload.sub);
      if (!existingByEmail.get("avatarUrl") && payload.picture) existingByEmail.set("avatarUrl", payload.picture);
      await existingByEmail.save();
      user = existingByEmail;
    }
  }

  let room;
  if (!user) {
    const created = await createUserWithDefaultRoom({
      name: payload.name ?? payload.email.split("@")[0],
      email: payload.email,
      authProvider: "google",
      googleId: payload.sub,
      avatarUrl: payload.picture ?? generateAvatarUrl(payload.email),
    });
    user = created.user;
    room = created.room;
  }

  const defaultRoomId = user.get("defaultRoomId")?.toString();
  const createdDevice = defaultRoomId ? await issueDevice(user._id.toString(), defaultRoomId, device) : undefined;
  const session = issueSession(
    user._id.toString(),
    (user.get("tokenVersion") as number | undefined) ?? 0,
    createdDevice?._id.toString()
  );
  touchLastLogin(user._id.toString());

  res.status(room ? 201 : 200).json({
    success: true,
    data: { user: toPublicUser(user), room, device: createdDevice, ...session },
  });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw ApiError.unauthorized("Invalid or expired refresh token");
  }

  const user = await User.findById(payload.userId);
  if (!user) throw ApiError.unauthorized("Invalid refresh token");

  const currentVersion = (user.get("tokenVersion") as number | undefined) ?? 0;
  if ((payload.tokenVersion ?? 0) !== currentVersion) {
    throw ApiError.unauthorized("This session was signed out remotely. Please sign in again.");
  }

  const session = issueSession(user._id.toString(), currentVersion, payload.deviceId);
  res.json({ success: true, data: session });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.userId);
  if (!user) throw ApiError.notFound("User not found");
  res.json({ success: true, data: { user: toPublicUser(user) } });
});

export const updateMe = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findByIdAndUpdate(req.userId, { $set: req.body }, { new: true });
  if (!user) throw ApiError.notFound("User not found");
  res.json({ success: true, data: { user: toPublicUser(user) } });
});

export const deleteMe = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId;

  await Room.updateMany({ ownerId: userId }, { $set: { ownerId: null } });
  await Room.updateMany({}, { $pull: { memberIds: userId } });
  await Room.updateMany({}, { $pull: { deviceIds: { $exists: true } } });

  await Device.deleteMany({ ownerId: userId });
  await User.findByIdAndDelete(userId);

  res.json({ success: true, data: { deleted: true } });
});

export const googleAuthStatus = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: { enabled: !!googleClient } });
});

export const deleteAccount = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;

  await Promise.all([
    Device.deleteMany({ ownerId: userId }),
    Room.deleteMany({ ownerId: userId }),
    Note.deleteMany({ ownerId: userId }),
    Transfer.deleteMany({ ownerId: userId }),
    Activity.deleteMany({ ownerId: userId }),
    // Rooms this user joined but doesn't own should just lose them as a member.
    Room.updateMany({ memberIds: userId }, { $pull: { memberIds: userId } }),
  ]);

  await User.findByIdAndDelete(userId);

  res.json({ success: true, data: { deleted: true } });
});
