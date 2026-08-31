import { randomInt } from "node:crypto";

const ADJECTIVES = [
  "amber", "brave", "coral", "dusty", "eager", "fleet", "gentle", "hazy",
  "indigo", "jolly", "keen", "lucid", "misty", "nimble", "opal", "prime",
  "quiet", "rapid", "sunny", "tidal", "umber", "vivid", "warm", "zesty",
];

const NOUNS = [
  "falcon", "harbor", "meadow", "lantern", "comet", "cedar", "otter", "delta",
  "ember", "granite", "heron", "island", "juniper", "kestrel", "lagoon",
  "maple", "nectar", "orchard", "pebble", "quartz", "ridge", "summit",
];

export function generateRoomCode(): string {
  const adjective = ADJECTIVES[randomInt(ADJECTIVES.length)];
  const noun = NOUNS[randomInt(NOUNS.length)];
  const number = randomInt(10, 99);
  return `${adjective}-${noun}-${number}`;
}

/** Retries until it finds a code `exists` reports as free. */
export async function generateUniqueRoomCode(exists: (code: string) => Promise<boolean>): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = generateRoomCode();
    if (!(await exists(code))) return code;
  }
  throw new Error("Could not generate a unique room code");
}
