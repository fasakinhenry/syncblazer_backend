import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseClientOrigins(): string[] {
  const raw = process.env.CLIENT_ORIGIN ?? process.env.CLIENT_ORIGINS ?? "http://localhost:5173";
  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function parseAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  clientOrigins: parseClientOrigins(),

  mongodbUri: required("MONGODB_URI", "mongodb://127.0.0.1:27017/syncblaze"),

  jwtAccessSecret: required("JWT_ACCESS_SECRET", "dev-access-secret"),
  jwtRefreshSecret: required("JWT_REFRESH_SECRET", "dev-refresh-secret"),
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m",
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "30d",

  pairingSessionTtlSeconds: Number(process.env.PAIRING_SESSION_TTL_SECONDS ?? 120),

  googleClientId: process.env.GOOGLE_CLIENT_ID,

  uploadDir: process.env.UPLOAD_DIR ?? "uploads",
  maxUploadSizeMb: Number(process.env.MAX_UPLOAD_SIZE_MB ?? 200),

  // Whoever's logged in with one of these emails can use the /admin API.
  // Leave unset in an environment where nobody should have admin access.
  adminEmails: parseAdminEmails(),

  // Outbound email (admin -> user), via Resend. Unset means the mailer is
  // disabled and admin "send email" calls fail with a clear error instead
  // of silently doing nothing.
  resendApiKey: process.env.RESEND_API_KEY,
  emailFrom: process.env.EMAIL_FROM ?? "SyncBlaze <onboarding@resend.dev>",

  isProduction: process.env.NODE_ENV === "production",
};
