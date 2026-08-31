import { createServer } from "node:http";
import { createApp } from "@/app.ts";
import { env } from "@/config/env.ts";
import { connectDatabase } from "@/config/db.ts";
import { initSocketServer } from "@/sockets/socket.server.ts";
import { logger } from "@/utils/logger.ts";

async function main() {
  if (env.isProduction) {
    const usingDefaultSecret =
      env.jwtAccessSecret === "dev-access-secret" || env.jwtRefreshSecret === "dev-refresh-secret";
    if (usingDefaultSecret) {
      throw new Error("Refusing to start in production with default JWT secrets. Set JWT_ACCESS_SECRET / JWT_REFRESH_SECRET.");
    }
  }

  await connectDatabase();

  const app = createApp();
  const httpServer = createServer(app);
  initSocketServer(httpServer);

  httpServer.listen(env.port, () => {
    logger.info(`SyncBlaze backend listening on port ${env.port} (${env.nodeEnv})`);
  });

  const shutdown = (signal: string) => {
    logger.info(`Received ${signal}, shutting down`);
    httpServer.close(() => process.exit(0));
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.error("Failed to start server", err);
  process.exit(1);
});
