import { Resend } from "resend";
import { env } from "@/config/env.ts";
import { ApiError } from "@/utils/ApiError.ts";

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
