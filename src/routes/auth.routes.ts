import { Router } from "express";
import {
  deleteAccount,
  google,
  googleAuthStatus,
  guest,
  login,
  me,
  refresh,
  register,
  updateMe,
} from "@/controllers/auth.controller.ts";
import { requireAuth } from "@/middleware/auth.middleware.ts";
import { validate } from "@/middleware/validate.middleware.ts";
import {
  googleAuthSchema,
  guestSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  updateMeSchema,
} from "@/validators/auth.validators.ts";

export const authRouter = Router();

authRouter.post("/register", validate({ body: registerSchema }), register);
authRouter.post("/login", validate({ body: loginSchema }), login);
authRouter.post("/guest", validate({ body: guestSchema }), guest);
authRouter.get("/google/status", googleAuthStatus);
authRouter.post("/google", validate({ body: googleAuthSchema }), google);
authRouter.post("/refresh", validate({ body: refreshSchema }), refresh);
authRouter.get("/me", requireAuth, me);
authRouter.patch("/me", requireAuth, validate({ body: updateMeSchema }), updateMe);
authRouter.delete("/me", requireAuth, deleteAccount);
