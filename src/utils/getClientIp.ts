import type { Socket } from "socket.io";

/**
 * Best-effort client IP for a socket connection. Mirrors the standard
 * x-forwarded-for handling reverse-proxied deployments need; falls back to
 * the raw handshake address for local/dev use, which is exactly the LAN
 * case this is used for (detecting devices on the same network).
 */
export function getClientIp(socket: Socket): string {
  const forwardedFor = socket.handshake.headers["x-forwarded-for"];
  const forwarded = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  let ip = forwarded?.split(",")[0]?.trim() || socket.handshake.address;

  // IPv4-mapped IPv6 / localhost normalization so "same network" comparisons
  // between two local dev clients on the same machine still match.
  if (ip === "::1" || ip === "::ffff:127.0.0.1") ip = "127.0.0.1";
  if (ip?.startsWith("::ffff:")) ip = ip.slice(7);

  return ip;
}
