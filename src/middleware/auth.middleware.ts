import type { NextFunction, Request, Response } from "express";
import { ApiError } from "@/utils/ApiError.ts";
import { verifyAccessToken } from "@/utils/jwt.ts";

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw ApiError.unauthorized("Missing or invalid authorization header");
  }

  const token = header.slice("Bearer ".length);
  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.userId;
    req.deviceId = payload.deviceId;
    next();
  } catch {
    throw ApiError.unauthorized("Invalid or expired token");
  }
}
