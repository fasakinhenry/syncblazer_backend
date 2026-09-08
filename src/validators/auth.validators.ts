import { z } from "zod";
import { DeviceType, DevicePlatform } from "@/constants/index.ts";

export const deviceInfoSchema = z.object({
  name: z.string().min(1).max(60),
  type: z.enum([DeviceType.DESKTOP, DeviceType.LAPTOP, DeviceType.MOBILE, DeviceType.TABLET]),
  platform: z.enum([
    DevicePlatform.WINDOWS,
    DevicePlatform.MACOS,
    DevicePlatform.LINUX,
    DevicePlatform.IOS,
    DevicePlatform.ANDROID,
    DevicePlatform.WEB,
  ]),
  installId: z.string().min(1).max(100).optional(),
});

export const registerSchema = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  device: deviceInfoSchema.optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  device: deviceInfoSchema.optional(),
});

export const upgradeGuestSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const upgradeGuestWithGoogleSchema = z.object({
  idToken: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const guestSchema = z.object({
  device: deviceInfoSchema.optional(),
});

export const googleAuthSchema = z.object({
  idToken: z.string().min(1),
  device: deviceInfoSchema.optional(),
});

export const updateMeSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  avatarUrl: z.string().url().max(500).optional(),
});
