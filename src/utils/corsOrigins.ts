import { env } from "@/config/env.ts";

// The desktop companion app (Tauri) serves its bundled frontend from a
// fixed local pseudo-origin instead of a real domain — different per OS
// webview engine, so all the known ones are allowed rather than just
// whichever one happens to be in front of us.
const DESKTOP_APP_ORIGINS = new Set([
  "tauri://localhost", // macOS (WKWebView) / Linux (WebKitGTK)
  "https://tauri.localhost", // Windows (WebView2)
  "http://tauri.localhost",
]);

/** Shared by both the Express CORS middleware and the Socket.IO server so
 * the two never drift out of sync with each other. */
export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  if (env.clientOrigins.includes(origin)) return true;
  if (origin.endsWith(".vercel.app") || origin.endsWith(".onrender.com") || origin === "http://localhost:5173") {
    return true;
  }
  return DESKTOP_APP_ORIGINS.has(origin);
}
