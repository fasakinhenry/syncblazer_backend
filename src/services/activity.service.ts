import { Activity } from "@/models/Activity.model.ts";
import type { ActivityType } from "@/constants/index.ts";
import { getIO } from "@/sockets/socket.server.ts";

interface RecordActivityInput {
  ownerId: string;
  roomId: string;
  type: ActivityType;
  message: string;
  metadata?: Record<string, unknown>;
}

export async function recordActivity(input: RecordActivityInput) {
  const activity = await Activity.create(input);

  getIO()?.to(`room:${input.roomId}`).emit("activity:new", {
    id: activity._id,
    type: activity.type,
    message: activity.message,
    metadata: activity.metadata,
    createdAt: activity.createdAt,
  });

  return activity;
}
