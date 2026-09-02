import type { Request, Response } from "express";
import { PageView } from "@/models/PageView.model.ts";
import { verifyAccessToken } from "@/utils/jwt.ts";
import { asyncHandler } from "@/utils/asyncHandler.ts";

// Public and unauthenticated on purpose — we want to count visits from
// people who aren't logged in at all (landing page, shared note links).
// If a valid access token happens to be attached, we tag the view with
// that user id; an invalid/expired one is just ignored rather than
// rejected, since this endpoint has no business enforcing auth.
export const recordPageview = asyncHandler(async (req: Request, res: Response) => {
  const { path, referrer, sessionId } = req.body as { path?: string; referrer?: string; sessionId?: string };
  if (!path || typeof path !== "string" || !sessionId || typeof sessionId !== "string") {
    res.status(204).end();
    return;
  }

  let userId: string | undefined;
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      userId = verifyAccessToken(header.slice("Bearer ".length)).userId;
    } catch {
      // Ignore — an anonymous view is still worth recording.
    }
  }

  await PageView.create({
    path: path.slice(0, 300),
    referrer: referrer?.slice(0, 300),
    sessionId: sessionId.slice(0, 100),
    userId,
  });

  res.status(204).end();
});
