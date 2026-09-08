import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "@/config/env.ts";
import { apiRouter } from "@/routes/index.ts";
import { errorHandler, notFoundHandler } from "@/middleware/error.middleware.ts";
import { isAllowedOrigin } from "@/utils/corsOrigins.ts";

export function createApp() {
  const app = express();

  // Helmet's default Cross-Origin-Resource-Policy: same-origin blocks the
  // frontend (a different origin) from ever loading anything this API
  // serves as a raw resource — most visibly, an <img src> pointed at
  // /api/note-images/:key just renders a broken-image icon in every
  // browser, silently, with no console-visible request failure to explain
  // why. The whole point of this API is to be consumed cross-origin by the
  // frontend (already gated by the CORS allow-list below), so scope this
  // policy accordingly instead of leaving the stricter default on.
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    })
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));
  if (!env.isProduction) {
    app.use(morgan("dev"));
  }

  app.use("/api", apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
