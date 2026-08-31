import type { Request, Response } from "express";
import dns from "node:dns/promises";
import * as cheerio from "cheerio";
import { asyncHandler } from "@/utils/asyncHandler.ts";
import { ApiError } from "@/utils/ApiError.ts";

const FETCH_TIMEOUT_MS = 6000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024; // only need the <head>, pages can be huge

function isPrivateIp(ip: string): boolean {
  if (ip === "127.0.0.1" || ip === "::1" || ip === "0.0.0.0") return true;
  const parts = ip.split(".").map(Number);
  if (parts.length === 4 && parts.every((p) => !Number.isNaN(p))) {
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 127) return true;
  }
  if (ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80")) return true;
  return false;
}

/**
 * Best-effort SSRF guard: resolve the hostname up front and reject
 * loopback/private ranges before we ever fetch it. This leaves a small
 * residual DNS-rebinding window (the name could re-resolve to a different
 * address by the time `fetch` actually connects) — acceptable for a
 * link-preview feature at this scale, but a pinned-IP fetch agent would be
 * the next hardening step if this ever needs to be bulletproof.
 */
async function assertSafeUrl(rawUrl: string): Promise<URL> {
  const url = new URL(rawUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw ApiError.badRequest("Only http/https links can be previewed");
  }
  if (url.hostname === "localhost") throw ApiError.badRequest("That link isn't reachable");

  try {
    const { address } = await dns.lookup(url.hostname);
    if (isPrivateIp(address)) throw ApiError.badRequest("That link isn't reachable");
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw ApiError.badRequest("Couldn't resolve that link");
  }

  return url;
}

export const getLinkPreview = asyncHandler(async (req: Request, res: Response) => {
  const url = await assertSafeUrl(req.query.url as string);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  const fetchResult = await fetch(url, {
    signal: controller.signal,
    redirect: "follow",
    headers: { "User-Agent": "SyncBlazeLinkPreview/1.0" },
  })
    .catch(() => null)
    .finally(() => clearTimeout(timeout));

  if (!fetchResult || !fetchResult.ok || !fetchResult.body) {
    throw ApiError.badRequest("Couldn't fetch a preview for that link");
  }
  const response = fetchResult;

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) {
    res.json({ success: true, data: { url: url.toString(), title: url.hostname, description: null, image: null } });
    return;
  }

  // Non-null: already guarded above (`!fetchResult.body` would have thrown).
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let html = "";
  while (received < MAX_RESPONSE_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    html += decoder.decode(value, { stream: true });
    if (html.includes("</head>")) break;
  }
  reader.cancel().catch(() => undefined);

  const $ = cheerio.load(html);
  const pick = (selectors: string[]): string | undefined => {
    for (const sel of selectors) {
      const val = $(sel).attr("content") ?? $(sel).text();
      if (val?.trim()) return val.trim();
    }
    return undefined;
  };

  const title = pick(['meta[property="og:title"]', 'meta[name="twitter:title"]', "title"]) ?? url.hostname;
  const description = pick([
    'meta[property="og:description"]',
    'meta[name="description"]',
    'meta[name="twitter:description"]',
  ]);
  let image = pick(['meta[property="og:image"]', 'meta[name="twitter:image"]']);
  if (image && !/^https?:\/\//.test(image)) {
    image = new URL(image, url).toString();
  }

  res.json({
    success: true,
    data: { url: url.toString(), title, description: description ?? null, image: image ?? null },
  });
});
