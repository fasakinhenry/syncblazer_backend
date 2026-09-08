import { env } from "@/config/env.ts";

/** Shared wrapper every notification email uses — one place to keep the
 * look consistent instead of re-styling each email from scratch. */
function wrap(bodyHtml: string, ctaLabel?: string, ctaUrl?: string): string {
  const cta =
    ctaLabel && ctaUrl
      ? `<p style="margin:28px 0 0;"><a href="${ctaUrl}" style="display:inline-block;background:#f97316;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 20px;border-radius:8px;">${ctaLabel}</a></p>`
      : "";

  return `
  <div style="background:#f4f4f5;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
      <p style="margin:0 0 20px;font-weight:700;font-size:16px;color:#0a0a0a;">🔥 SyncBlaze</p>
      <div style="font-size:14px;line-height:1.6;color:#27272a;">${bodyHtml}</div>
      ${cta}
      <p style="margin:32px 0 0;font-size:12px;color:#a1a1aa;">This is an automated message from SyncBlaze.</p>
    </div>
  </div>`;
}

export function welcomeEmailHtml(name: string): string {
  return wrap(
    `<p>Hi ${name},</p><p>Your SyncBlaze account is ready. Move files, notes, and links between your devices — instantly, without the cloud getting in the way.</p>`,
    "Open SyncBlaze",
    env.frontendUrl
  );
}

export function loginNoticeEmailHtml(name: string, deviceName: string | undefined, when: Date): string {
  const deviceLine = deviceName ? ` from <strong>${deviceName}</strong>` : "";
  return wrap(
    `<p>Hi ${name},</p><p>New sign-in to your SyncBlaze account${deviceLine} at ${when.toUTCString()}.</p><p>Wasn't you? Change your password from your profile right away.</p>`
  );
}

export function roomCreatedEmailHtml(name: string, roomName: string, roomId: string): string {
  return wrap(
    `<p>Hi ${name},</p><p>A new room, "<strong>${roomName}</strong>", was created on your account.</p>`,
    "Open room",
    `${env.frontendUrl}/rooms/${roomId}`
  );
}

export function noteSharedEmailHtml(recipientName: string, sharerName: string, noteTitle: string, noteId: string): string {
  return wrap(
    `<p>Hi ${recipientName},</p><p><strong>${sharerName}</strong> shared a note with you: "<strong>${noteTitle || "Untitled note"}</strong>".</p>`,
    "Open note",
    `${env.frontendUrl}/notes?open=${noteId}`
  );
}

export function noteDeletedEmailHtml(recipientName: string, noteTitle: string): string {
  return wrap(
    `<p>Hi ${recipientName},</p><p>A note you had access to, "<strong>${noteTitle || "Untitled note"}</strong>", was deleted by its owner.</p>`
  );
}

export function roomInviteEmailHtml(roomName: string, inviterName: string, joinUrl: string): string {
  return wrap(
    `<p><strong>${inviterName}</strong> invited you to join their room "<strong>${roomName}</strong>" on SyncBlaze.</p>`,
    "Accept invite",
    joinUrl
  );
}

export function roomMemberAddedEmailHtml(recipientName: string, roomName: string, inviterName: string, roomId: string): string {
  return wrap(
    `<p>Hi ${recipientName},</p><p><strong>${inviterName}</strong> added you to their room "<strong>${roomName}</strong>" on SyncBlaze.</p>`,
    "Open room",
    `${env.frontendUrl}/rooms/${roomId}`
  );
}
