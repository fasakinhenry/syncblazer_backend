import type { NextFunction, Request, Response } from "express";
import { User } from "@/models/User.model.ts";
import { ApiError } from "@/utils/ApiError.ts";
import { asyncHandler } from "@/utils/asyncHandler.ts";
import { env } from "@/config/env.ts";

// Admin status isn't in the JWT (it can change without the user re-logging
// in, and access tokens are short-lived anyway), so this always checks the
// DB directly against the ADMIN_EMAILS allowlist. Must run after
// requireAuth — depends on req.userId already being set.
export const requireAdmin = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  if (env.adminEmails.length === 0) throw ApiError.forbidden("Admin access isn't configured on this server");

  const user = await User.findById(req.userId).select("email");
  const email = user?.get("email") as string | undefined;
  if (!email || !env.adminEmails.includes(email.toLowerCase())) {
    throw ApiError.forbidden("You don't have access to this");
  }

  next();
});
