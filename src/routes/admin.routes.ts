import { Router } from "express";
import {
  deleteUser,
  exportUsersCsv,
  getOverview,
  getUserDetail,
  getVisitTrend,
  listUsers,
  resetUserSessions,
  sendUserEmail,
  updateUser,
} from "@/controllers/admin.controller.ts";
import { requireAuth } from "@/middleware/auth.middleware.ts";
import { requireAdmin } from "@/middleware/requireAdmin.middleware.ts";
import { validate } from "@/middleware/validate.middleware.ts";
import {
  listUsersQuerySchema,
  sendUserEmailSchema,
  updateUserSchema,
  userIdParamSchema,
  visitTrendQuerySchema,
} from "@/validators/admin.validators.ts";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin);

adminRouter.get("/overview", getOverview);
adminRouter.get("/visits", validate({ query: visitTrendQuerySchema }), getVisitTrend);

adminRouter.get("/users", validate({ query: listUsersQuerySchema }), listUsers);
adminRouter.get("/users/export.csv", exportUsersCsv);
adminRouter.get("/users/:userId", validate({ params: userIdParamSchema }), getUserDetail);
adminRouter.patch("/users/:userId", validate({ params: userIdParamSchema, body: updateUserSchema }), updateUser);
adminRouter.delete("/users/:userId", validate({ params: userIdParamSchema }), deleteUser);
adminRouter.post("/users/:userId/reset-sessions", validate({ params: userIdParamSchema }), resetUserSessions);
adminRouter.post(
  "/users/:userId/email",
  validate({ params: userIdParamSchema, body: sendUserEmailSchema }),
  sendUserEmail
);
