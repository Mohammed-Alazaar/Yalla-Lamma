import type { ZodType } from "zod";
import { ERROR_CODES } from "@yalla/shared";
import { emitError } from "./respond";
import type { AppSocket } from "./types";

/**
 * Validate an inbound Socket.IO payload (NFR-7). On failure, emits an
 * `error` event to the offending client and returns null.
 */
export function parsePayload<T>(
  socket: AppSocket,
  schema: ZodType<T>,
  payload: unknown,
): T | null {
  const result = schema.safeParse(payload);
  if (!result.success) {
    const message = result.error.issues[0]?.message ?? "Invalid payload";
    emitError(socket, ERROR_CODES.INVALID_PAYLOAD, message);
    return null;
  }
  return result.data;
}
