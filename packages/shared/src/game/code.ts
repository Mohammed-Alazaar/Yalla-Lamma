import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "./constants";

/**
 * Generate a random room code (PRD §16.1). The caller is responsible for
 * retrying on collision against Redis.
 */
export function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

/** Whether a string is a structurally valid room code (length + alphabet). */
export function isValidRoomCode(code: string): boolean {
  if (code.length !== ROOM_CODE_LENGTH) return false;
  for (const ch of code) {
    if (!ROOM_CODE_ALPHABET.includes(ch)) return false;
  }
  return true;
}

/** Normalize user-entered codes (trim + uppercase) before validation. */
export function normalizeRoomCode(input: string): string {
  return input.trim().toUpperCase();
}

/** Cryptographically-random id for players, sessions, and host tokens. */
export function newId(): string {
  return crypto.randomUUID();
}
