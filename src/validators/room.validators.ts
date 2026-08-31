import { z } from "zod";
import { RoomType } from "@/constants/index.ts";

export const createRoomSchema = z.object({
  name: z.string().min(1).max(80),
  type: z
    .enum([RoomType.PERSONAL, RoomType.PROJECT, RoomType.TEMPORARY, RoomType.SHARED])
    .default(RoomType.SHARED),
});

export const updateRoomSchema = z.object({
  name: z.string().min(1).max(80).optional(),
});

export const roomIdParamSchema = z.object({
  roomId: z.string().min(1),
});

export const joinRoomSchema = z.object({
  code: z
    .string()
    .min(1)
    .max(80)
    .transform((v) => v.trim().toLowerCase()),
});
