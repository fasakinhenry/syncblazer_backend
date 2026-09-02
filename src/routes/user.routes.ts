import { Router } from "express";
import { getPublicProfile } from "@/controllers/user.controller.ts";

export const userRouter = Router();

userRouter.get("/:userId", getPublicProfile); // public: shared profile link
