import webpush from "web-push";
import { env } from "@/config/env.ts";
import { PushSubscription } from "@/models/PushSubscription.model.ts";
import { logger } from "@/utils/logger.ts";

const vapidConfigured = !!(env.vapidPublicKey && env.vapidPrivateKey);

if (vapidConfigured) {
  webpush.setVapidDetails(env.vapidSubject, env.vapidPublicKey!, env.vapidPrivateKey!);
} else {
  logger.info("Web push disabled: VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY not set");
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/** Best-effort: sends to every subscription this user has registered
 * (usually one per device/browser), and quietly prunes any that come back
 * 404/410 (the standard "this subscription no longer exists" web-push
 * response) so they don't keep failing forever. Never throws — a push
 * failure must never take down the caller's actual notification write. */
export async function sendWebPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!vapidConfigured) return;

  const allSubs = await PushSubscription.find({ ownerId: userId });
  const subs = allSubs.filter((sub) => !!sub.get("keys"));
  if (subs.length === 0) return;

  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.get("endpoint"), keys: sub.get("keys")! },
        JSON.stringify(payload)
      )
    )
  );

  const expiredIds: unknown[] = [];
  results.forEach((result, i) => {
    if (result.status !== "rejected") return;
    const statusCode = (result.reason as { statusCode?: number } | undefined)?.statusCode;
    if (statusCode === 404 || statusCode === 410) {
      expiredIds.push(subs[i]!._id);
    } else {
      logger.error(`Web push failed for subscription ${subs[i]!._id}: ${String(result.reason)}`);
    }
  });
  if (expiredIds.length > 0) {
    await PushSubscription.deleteMany({ _id: { $in: expiredIds } });
  }
}
