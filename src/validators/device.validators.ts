import { z } from "zod";
import { DeviceType, DevicePlatform } from "@/constants/index.ts";

const deviceInfoSchema = z.object({
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

export const createPairingSessionSchema = z.object({
  roomId: z.string().min(1),
});

export const consumePairingSessionSchema = z
  .object({
    token: z.string().min(1).optional(),
    shortCode: z.string().min(1).optional(),
    device: deviceInfoSchema,
  })
  .refine((data) => !!data.token || !!data.shortCode, {
    message: "Either token or shortCode is required",
    path: ["token"],
  });

export const renameDeviceSchema = z.object({
  name: z.string().min(1).max(60),
});

export const deviceIdParamSchema = z.object({
  deviceId: z.string().min(1),
});
