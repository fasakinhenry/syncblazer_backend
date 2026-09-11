import { env } from "@/config/env.ts";
import { sendEmailSafe } from "@/services/mailer.service.ts";
import { roomNotifyTargets } from "@/services/roomMembers.service.ts";
import {
  loginNoticeEmailHtml,
  noteDeletedEmailHtml,
  noteSharedEmailHtml,
  roomCreatedEmailHtml,
  roomInviteEmailHtml,
  roomMemberAddedEmailHtml,
  welcomeEmailHtml,
} from "@/services/emailTemplates.service.ts";

export async function notifyWelcome(user: { email?: string | null; name: string }): Promise<void> {
  if (!user.email) return; // guests have no email on file
  await sendEmailSafe({ to: user.email, subject: "Welcome to SyncBlaze", html: welcomeEmailHtml(user.name) });
}

export async function notifyLoginNotice(
  user: { email?: string | null; name: string },
  deviceName: string | undefined
): Promise<void> {
  if (!user.email) return;
  await sendEmailSafe({
    to: user.email,
    subject: "New sign-in to your SyncBlaze account",
    html: loginNoticeEmailHtml(user.name, deviceName, new Date()),
  });
}

export async function notifyRoomCreated(user: { email?: string | null; name: string }, room: { name: string; _id: unknown }): Promise<void> {
  if (!user.email) return;
  await sendEmailSafe({
    to: user.email,
    subject: `New room created: ${room.name}`,
    html: roomCreatedEmailHtml(user.name, room.name, String(room._id)),
  });
}

export async function notifyNoteShared(
  note: { _id: unknown; title: string; roomId: unknown },
  sharerId: string,
  sharerName: string
): Promise<void> {
  const targets = await roomNotifyTargets(note.roomId, sharerId);
  await Promise.all(
    targets
      .filter((t) => !!t.email)
      .map((t) =>
        sendEmailSafe({
          to: t.email!,
          subject: `${sharerName} shared a note with you`,
          html: noteSharedEmailHtml(t.name, sharerName, note.title, String(note._id)),
        })
      )
  );
}

export async function notifyNoteDeleted(note: { title: string; roomId: unknown }, deletedByUserId: string): Promise<void> {
  const targets = await roomNotifyTargets(note.roomId, deletedByUserId);
  await Promise.all(
    targets
      .filter((t) => !!t.email)
      .map((t) =>
        sendEmailSafe({
          to: t.email!,
          subject: "A note you had access to was deleted",
          html: noteDeletedEmailHtml(t.name, note.title),
        })
      )
  );
}

/** An email address with no SyncBlaze account yet — invite them to sign up,
 * with a link that auto-joins the room once they register (see
 * auth.controller.ts's register, which reads the same token). */
export async function notifyRoomInvite(email: string, roomName: string, inviterName: string, token: string): Promise<void> {
  await sendEmailSafe({
    to: email,
    subject: `${inviterName} invited you to a room on SyncBlaze`,
    html: roomInviteEmailHtml(roomName, inviterName, `${env.frontendUrl}/register?invite=${token}`),
  });
}

/** An existing account was added directly (no invite-and-wait needed). */
export async function notifyRoomMemberAdded(
  user: { email?: string | null; name: string },
  room: { name: string; _id: unknown },
  inviterName: string
): Promise<void> {
  if (!user.email) return;
  await sendEmailSafe({
    to: user.email,
    subject: `${inviterName} added you to a room on SyncBlaze`,
    html: roomMemberAddedEmailHtml(user.name, room.name, inviterName, String(room._id)),
  });
}
