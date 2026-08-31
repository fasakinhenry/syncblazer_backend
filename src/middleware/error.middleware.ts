import type { NextFunction, Request, Response } from "express";
import { ApiError } from "@/utils/ApiError.ts";
import { logger } from "@/utils/logger.ts";
import { env } from "@/config/env.ts";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      details: err.details,
    });
    return;
  }

  if (err && typeof err === "object" && "name" in err && err.name === "ValidationError") {
    res.status(400).json({ success: false, message: (err as Error).message });
    return;
  }

  if (err && typeof err === "object" && "name" in err && err.name === "CastError") {
    res.status(400).json({ success: false, message: "Invalid identifier" });
    return;
  }

  if (err && typeof err === "object" && "code" in err && (err as { code?: number }).code === 11000) {
    res.status(409).json({ success: false, message: "Duplicate resource" });
    return;
  }

  logger.error("Unhandled error", err);
  res.status(500).json({
    success: false,
    message: "Something went wrong",
    stack: env.isProduction ? undefined : (err as Error)?.stack,
  });
}
