import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";
import { ApiError } from "@/utils/ApiError.ts";

interface Schemas {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
}

export function validate(schemas: Schemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        throw ApiError.badRequest("Invalid request body", result.error.flatten());
      }
      req.body = result.data;
    }
    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        throw ApiError.badRequest("Invalid request params", result.error.flatten());
      }
      req.params = result.data;
    }
    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        throw ApiError.badRequest("Invalid query parameters", result.error.flatten());
      }
      req.query = result.data;
    }
    next();
  };
}
