import { Resend } from "resend";
import { env } from "@/config/env.ts";
import { ApiError } from "@/utils/ApiError.ts";
import { logger } from "@/utils/logger.ts";

const resend = env.resendApiKey ? new Resend(env.resendApiKey) : null;

export async function sendEmail(input: { to: string; subject: string; html: string }): Promise<void> {
  if (!resend) {
    throw ApiError.badRequest(
      "Email isn't configured on this server yet — set RESEND_API_KEY to enable sending."
    );
  }

  const { error } = await resend.emails.send({
    from: env.emailFrom,
    to: input.to,
    subject: input.subject,
    html: input.html,
  });

  if (error) throw ApiError.internal(`Couldn't send that email: ${error.message}`);
}

/** For every notification email in this app (welcome, new sign-in, room
 * created, note shared/deleted, invites) — these fire alongside a real user
 * action (registering, creating a room, editing a note) that must still
 * succeed even if RESEND_API_KEY isn't set or Resend has a bad moment.
 * Never throws; logs and moves on. `sendEmail` itself stays throwing for the
 * one case that wants to know it failed (the admin "email a user" action). */
export async function sendEmailSafe(input: { to: string; subject: string; html: string }): Promise<void> {
  try {
    await sendEmail(input);
  } catch (err) {
    logger.error(`Failed to send "${input.subject}" to ${input.to}: ${String(err)}`);
  }
}
