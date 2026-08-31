/**
 * In-memory map of currently-connected device -> the public IP the server
 * saw them connect from. Two of a user's devices sharing that IP are almost
 * always on the same home/office network (same router, same NAT'd public
 * address) — the same trick Blaze uses server-side to build its "local
 * room" without any client-side network APIs. This is intentionally
 * ephemeral (not persisted): it only reflects who is online right now.
 */
const deviceIpBySocket = new Map<string, { deviceId: string; ip: string }>();
const ipsByDevice = new Map<string, Set<string>>();

export function recordDeviceConnection(socketId: string, deviceId: string, ip: string) {
  deviceIpBySocket.set(socketId, { deviceId, ip });

  if (!ipsByDevice.has(deviceId)) ipsByDevice.set(deviceId, new Set());
  ipsByDevice.get(deviceId)!.add(ip);
}

export function forgetSocketConnection(socketId: string) {
  const entry = deviceIpBySocket.get(socketId);
  deviceIpBySocket.delete(socketId);
  if (!entry) return;

  const stillConnectedElsewhere = [...deviceIpBySocket.values()].some(
    (v) => v.deviceId === entry.deviceId && v.ip === entry.ip
  );
  if (!stillConnectedElsewhere) {
    ipsByDevice.get(entry.deviceId)?.delete(entry.ip);
  }
}

/** All IPs a device is currently connected from (usually zero or one). */
export function getDeviceIps(deviceId: string): Set<string> {
  return ipsByDevice.get(deviceId) ?? new Set();
}

/** Whether deviceA and deviceB currently share at least one connection IP. */
export function areDevicesOnSameNetwork(deviceIdA: string, deviceIdB: string): boolean {
  const ipsA = getDeviceIps(deviceIdA);
  if (ipsA.size === 0) return false;
  const ipsB = getDeviceIps(deviceIdB);
  for (const ip of ipsB) {
    if (ipsA.has(ip)) return true;
  }
  return false;
}
