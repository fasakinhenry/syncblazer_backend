import { randomInt, randomUUID } from "node:crypto";

const ADJECTIVES = [
  "Swift", "Quiet", "Bright", "Clever", "Bold", "Calm", "Rapid", "Nimble",
  "Sharp", "Steady", "Vivid", "Brisk", "Keen", "Sunny", "Cosmic", "Amber",
];

const NOUNS = [
  "Falcon", "Otter", "Ember", "Comet", "Maple", "Harbor", "Pixel", "Meadow",
  "Lynx", "Aurora", "Cedar", "Delta", "Finch", "Granite", "Heron", "Ion",
];

export function generateGuestName(): string {
  const adjective = ADJECTIVES[randomInt(ADJECTIVES.length)];
  const noun = NOUNS[randomInt(NOUNS.length)];
  const number = randomInt(10, 999);
  return `${adjective} ${noun} ${number}`;
}

const AVATAR_STYLE = "thumbs";

export function generateAvatarUrl(seed: string = randomUUID()): string {
  return `https://api.dicebear.com/9.x/${AVATAR_STYLE}/svg?seed=${encodeURIComponent(seed)}`;
}
