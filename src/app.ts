import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "@/config/env.ts";
import { apiRouter } from "@/routes/index.ts";
import { errorHandler, notFoundHandler } from "@/middleware/error.middleware.ts";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        const allowedOrigins = new Set(env.clientOrigins);

        if (!origin || allowedOrigins.has(origin)) {
          callback(null, true);
          return;
        }

        if (origin.endsWith(".vercel.app") || origin.endsWith(".onrender.com") || origin === "http://localhost:5173") {
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
