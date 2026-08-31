import type { Request, Response } from "express";
import { createReadStream, existsSync } from "node:fs";
import path from "node:path";
import { asyncHandler } from "@/utils/asyncHandler.ts";
import { ApiError } from "@/utils/ApiError.ts";
import { storageProvider } from "@/services/storage/local.storage.provider.ts";

const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"]);

// Images embedded in a note need to render via a plain <img src>, which can't
// carry an Authorization header — so these are public-by-obscurity (an
// unguessable key), the same tradeoff most simple image hosts make. Upload
// itself still requires auth.
export const uploadNoteImage = asyncHandler(async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) throw ApiError.badRequest("No image provided");
  if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) throw ApiError.badRequest("Unsupported image type");

  const stored = await storageProvider.save({
    buffer: file.buffer,
    originalName: file.originalname,
    mimeType: file.mimetype,
  });

  res.status(201).json({ success: true, data: { key: stored.key, url: `/api/note-images/${stored.key}` } });
});

export const serveNoteImage = asyncHandler(async (req: Request, res: Response) => {
  const key = req.params.key;
  if (key.includes("..") || key.includes("/") || key.includes("\\")) throw ApiError.badRequest("Invalid key");

  const filePath = storageProvider.getReadStreamPath(key);
  if (!existsSync(filePath)) throw ApiError.notFound("Image not found");

  const ext = path.extname(filePath).toLowerCase();
  const mimeByExt: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
  };

  res.setHeader("Content-Type", mimeByExt[ext] ?? "application/octet-stream");
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  createReadStream(filePath).pipe(res);
});
