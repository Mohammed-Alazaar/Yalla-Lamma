// Lightweight, dependency-free profanity check for display names (PRD ROOM-4).
// Intentionally conservative; can be swapped for a fuller library (e.g. obscenity)
// without changing callers.

const BLOCKLIST = [
  "fuck",
  "shit",
  "bitch",
  "cunt",
  "asshole",
  "dick",
  "pussy",
  "bastard",
  "slut",
  "whore",
  "nigger",
  "nigga",
  "faggot",
  "retard",
  "rape",
  "nazi",
  "porn",
  "sex",
  "penis",
  "vagina",
  "cock",
  "wank",
];

const LEET: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  $: "s",
  "!": "i",
};

function normalize(input: string): string {
  return input
    .toLowerCase()
    .split("")
    .map((ch) => LEET[ch] ?? ch)
    .join("")
    .replace(/[^a-z]/g, "");
}

/** True if the name contains blocked content (after de-leetspeak normalization). */
export function containsProfanity(name: string): boolean {
  const normalized = normalize(name);
  if (!normalized) return false;
  return BLOCKLIST.some((word) => normalized.includes(word));
}
