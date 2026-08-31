import type { Request, Response } from "express";
import { Activity } from "@/models/Activity.model.ts";
import { Room } from "@/models/Room.model.ts";
import { asyncHandler } from "@/utils/asyncHandler.ts";

export const listActivity = asyncHandler(async (req: Request, res: Response) => {
  const { roomId, limit } = req.query as { roomId?: string; limit?: string };

  const filter: Record<string, unknown> = { ownerId: req.userId };
  if (roomId) {
    filter.roomId = roomId;
  } else {
    const rooms = await Room.find({ ownerId: req.userId }).select("_id");
    filter.roomId = { $in: rooms.map((r) => r._id) };
  }

  const activity = await Activity.find(filter)
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit) || 50, 100));

  res.json({ success: true, data: { activity } });
});
