import type { Request, Response } from "express";
import { createReadStream, existsSync } from "node:fs";
import { asyncHandler } from "@/utils/asyncHandler.ts";
import { ApiError } from "@/utils/ApiError.ts";
import { storageProvider } from "@/services/storage/local.storage.provider.ts";
import { Transfer } from "@/models/Transfer.model.ts";
import { Device } from "@/models/Device.model.ts";

// Cloud-fallback upload only. Local/LAN transfers never touch this endpoint —
// content flows directly between paired devices instead.
export const uploadAsset = asyncHandler(async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) throw ApiError.badRequest("No file provided");

  const stored = await storageProvider.save({
    buffer: file.buffer,
    originalName: file.originalname,
    mimeType: file.mimetype,
  });

  res.status(201).json({ success: true, data: stored });
});

// Access is gated by transfer ownership (or being the addressed recipient)
// rather than a public URL, so a storage key alone is never enough to read
// someone else's file.
export const downloadAsset = asyncHandler(async (req: Request, res: Response) => {
  const transfer = await Transfer.findOne({ _id: req.params.transferId });
  if (!transfer || !transfer.storageKey) throw ApiError.notFound("Asset not found");

  const isSender = transfer.get("ownerId").toString() === req.userId;
  if (!isSender) {
    const receiverDevice = await Device.findOne({ _id: transfer.get("receiverDeviceId"), ownerId: req.userId });
    if (!receiverDevice) throw ApiError.notFound("Asset not found");
  }

  const filePath = storageProvider.getReadStreamPath(transfer.storageKey);
  if (!existsSync(filePath)) throw ApiError.notFound("Asset not found");

  res.setHeader("Content-Type", transfer.mimeType ?? "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(transfer.name)}"`);
  createReadStream(filePath).pipe(res);
});
