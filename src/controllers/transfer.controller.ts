import type { Request, Response } from "express";
import { Transfer } from "@/models/Transfer.model.ts";
import { Device } from "@/models/Device.model.ts";
import { ApiError } from "@/utils/ApiError.ts";
import { asyncHandler } from "@/utils/asyncHandler.ts";
import { TransferStatus, ActivityType } from "@/constants/index.ts";
import { recordActivity } from "@/services/activity.service.ts";
import { getIO } from "@/sockets/socket.server.ts";

export const createTransfer = asyncHandler(async (req: Request, res: Response) => {
  const { senderDeviceId, receiverDeviceId } = req.body;

  const [sender, receiver] = await Promise.all([
    Device.findOne({ _id: senderDeviceId, ownerId: req.userId }),
    Device.findOne({ _id: receiverDeviceId, ownerId: req.userId }),
  ]);
  if (!sender) throw ApiError.notFound("Sender device not found");
  if (!receiver) throw ApiError.notFound("Receiver device not found");

  const transfer = await Transfer.create({
    ...req.body,
    ownerId: req.userId,
    status: TransferStatus.QUEUED,
  });

  await recordActivity({
    ownerId: req.userId!,
    roomId: transfer.roomId.toString(),
    type: ActivityType.TRANSFER,
    message: `${sender.name} sent "${transfer.name}" to ${receiver.name}`,
    metadata: { transferId: transfer._id },
  });

  getIO()?.to(`device:${receiverDeviceId}`).emit("transfer:incoming", { transfer });
  getIO()?.to(`room:${transfer.roomId.toString()}`).emit("transfer:created", { transfer });

  res.status(201).json({ success: true, data: { transfer } });
});

export const listTransfers = asyncHandler(async (req: Request, res: Response) => {
  const { roomId, type, status, direction, limit, cursor } = req.query as unknown as {
    roomId?: string;
    type?: string;
    status?: string;
    direction?: "sent" | "received";
    limit: number;
    cursor?: string;
  };

  const filter: Record<string, unknown> = { ownerId: req.userId };
  if (roomId) filter.roomId = roomId;
  if (type) filter.type = type;
  if (status) filter.status = status;
  if (cursor) filter._id = { $lt: cursor };

  if (direction === "sent" && req.deviceId) filter.senderDeviceId = req.deviceId;
  if (direction === "received" && req.deviceId) filter.receiverDeviceId = req.deviceId;

  const transfers = await Transfer.find(filter)
    .sort({ _id: -1 })
    .limit(limit)
    .populate("senderDeviceId", "name type")
    .populate("receiverDeviceId", "name type");

  const nextCursor = transfers.length === limit ? transfers[transfers.length - 1]?._id : null;

  res.json({ success: true, data: { transfers, nextCursor } });
});

export const getTransfer = asyncHandler(async (req: Request, res: Response) => {
  const transfer = await Transfer.findOne({ _id: req.params.transferId, ownerId: req.userId })
    .populate("senderDeviceId", "name type platform")
    .populate("receiverDeviceId", "name type platform");
  if (!transfer) throw ApiError.notFound("Transfer not found");
  res.json({ success: true, data: { transfer } });
});

export const updateTransferStatus = asyncHandler(async (req: Request, res: Response) => {
  const { status, progress, errorMessage } = req.body;

  const transfer = await Transfer.findOne({ _id: req.params.transferId, ownerId: req.userId });
  if (!transfer) throw ApiError.notFound("Transfer not found");

  transfer.status = status;
  if (progress !== undefined) transfer.progress = progress;
  if (errorMessage !== undefined) transfer.errorMessage = errorMessage;

  if (status === TransferStatus.TRANSFERRING && !transfer.startedAt) transfer.startedAt = new Date();
  if (status === TransferStatus.COMPLETED) {
    transfer.completedAt = new Date();
    transfer.progress = 100;
  }

  await transfer.save();

  getIO()?.to(`room:${transfer.roomId.toString()}`).emit("transfer:update", {
    transferId: transfer._id,
    status: transfer.status,
    progress: transfer.progress,
  });

  res.json({ success: true, data: { transfer } });
});

export const retryTransfer = asyncHandler(async (req: Request, res: Response) => {
  const transfer = await Transfer.findOne({ _id: req.params.transferId, ownerId: req.userId });
  if (!transfer) throw ApiError.notFound("Transfer not found");
  if (transfer.status !== TransferStatus.FAILED) {
    throw ApiError.badRequest("Only failed transfers can be retried");
  }

  transfer.status = TransferStatus.RETRYING;
  transfer.progress = 0;
  transfer.errorMessage = undefined;
  await transfer.save();

  getIO()?.to(`device:${transfer.receiverDeviceId.toString()}`).emit("transfer:incoming", { transfer });

  res.json({ success: true, data: { transfer } });
});
