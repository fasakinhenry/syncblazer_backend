import { Router } from "express";
import rateLimit from "express-rate-limit";
import { recordPageview } from "@/controllers/analytics.controller.ts";

export const analyticsRouter = Router();

// Public write endpoint hit by every page load — cap it generously per IP
// so it can't be abused to flood the database, without needing a login.
const pageviewLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

analyticsRouter.post("/pageview", pageviewLimiter, recordPageview);
