import type { Request, Response } from "express";
import { User } from "@/models/User.model.ts";
import { ApiError } from "@/utils/ApiError.ts";
import { asyncHandler } from "@/utils/asyncHandler.ts";

// Deliberately minimal — a shared profile link should never leak email or
// any other account detail, just enough to say "this is who invited you".
export const getPublicProfile = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.params.userId);
  if (!user) throw ApiError.notFound("This profile isn't available");

  res.json({
    success: true,
    data: {
      user: {
        id: user._id,
        name: user.get("name"),
        avatarUrl: user.get("avatarUrl"),
        isGuest: user.get("authProvider") === "guest",
      },
    },
  });
});
