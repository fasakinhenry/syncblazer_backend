import { z } from "zod";

export const listUsersQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  authProvider: z.enum(["password", "google", "guest"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(25),
});

export const userIdParamSchema = z.object({
  userId: z.string().min(1),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  email: z.string().trim().email().optional(),
});

export const sendUserEmailSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(5000),
});

export const visitTrendQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(30),
});
