import { customAlphabet, nanoid } from "nanoid";
import { PairingSession } from "@/models/PairingSession.model.ts";
import { env } from "@/config/env.ts";

const numericId = customAlphabet("0123456789", 6);

function formatShortCode(raw: string): string {
  return `${raw.slice(0, 3)}-${raw.slice(3)}`;
}

export async function createPairingSession(input: {
  initiatorUserId: string;
  initiatorDeviceId: string;
  roomId: string;
}) {
  const token = nanoid(32);
  const shortCode = formatShortCode(numericId());
  const expiresAt = new Date(Date.now() + env.pairingSessionTtlSeconds * 1000);

  const session = await PairingSession.create({
    ...input,
    token,
    shortCode,
    expiresAt,
  });

  return session;
}

export async function findActivePairingSession(identifier: { token?: string; shortCode?: string }) {
  const query = identifier.token ? { token: identifier.token } : { shortCode: identifier.shortCode };
  const session = await PairingSession.findOne({ ...query, status: "pending" });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) return null;
  return session;
}
