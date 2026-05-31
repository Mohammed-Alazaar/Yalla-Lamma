import { z } from "zod";
import {
  CATEGORIES,
  COUNTRIES,
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
  NUM_QUESTIONS_OPTIONS,
  TIME_LIMIT_OPTIONS,
} from "../game/constants";
import {
  QUIP_ANSWER_MAX,
  QUIP_ANSWER_TIME_OPTIONS,
  QUIP_ROUNDS_OPTIONS,
  QUIP_VOTE_TIME_OPTIONS,
} from "../game/quip";
import {
  FIB_LIE_TIME_OPTIONS,
  FIB_QUESTIONS_OPTIONS,
  FIB_SPOT_TIME_OPTIONS,
} from "../game/fib";

// ─── Primitives ─────────────────────────────────────────────────────────────

export const localeSchema = z.enum(["en", "ar"]);

/** Room code — normalized to upper-case, must use the no-I/O/0/1 alphabet. */
export const roomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-HJ-NP-Z]{4}$/, "Invalid room code");

/** Raw display name — length only; profanity filtering happens server-side. */
export const playerNameSchema = z
  .string()
  .trim()
  .min(NAME_MIN_LENGTH, "Name is required")
  .max(NAME_MAX_LENGTH, `Name must be at most ${NAME_MAX_LENGTH} characters`);

export const choiceSchema = z.number().int().min(0).max(3);

export const categorySchema = z.enum(CATEGORIES);

export const countrySchema = z.enum(COUNTRIES);

export const numQuestionsSchema = z
  .number()
  .int()
  .refine(
    (v) => (NUM_QUESTIONS_OPTIONS as readonly number[]).includes(v),
    "Invalid number of questions",
  );

export const timeLimitSchema = z
  .number()
  .int()
  .refine(
    (v) => (TIME_LIMIT_OPTIONS as readonly number[]).includes(v),
    "Invalid time limit",
  );

// ─── Client → server payloads ────────────────────────────────────────────────

export const hostCreateSchema = z.object({ locale: localeSchema });
export const hostRejoinSchema = z.object({
  code: roomCodeSchema,
  hostToken: z.string().min(1),
});
export const playerJoinSchema = z.object({
  code: roomCodeSchema,
  name: playerNameSchema,
});
export const playerRejoinSchema = z.object({
  code: roomCodeSchema,
  sessionId: z.string().min(1),
});
export const vipConfigureSchema = z.object({
  country: countrySchema,
  category: categorySchema,
  numQuestions: numQuestionsSchema,
  timeLimitSec: timeLimitSchema,
});
export const playerAnswerSchema = z.object({
  questionId: z.string().min(1),
  choice: choiceSchema,
});
export const hostKickSchema = z.object({ playerId: z.string().min(1) });
export const hostLockSchema = z.object({ locked: z.boolean() });
export const vipSelectGameSchema = z.object({ gameId: z.enum(["trivia", "quip", "fib"]) });

const inOptions = (opts: readonly number[], msg: string) =>
  z.number().int().refine((v) => opts.includes(v), msg);

export const vipConfigureQuipSchema = z.object({
  totalRounds: inOptions(QUIP_ROUNDS_OPTIONS, "Invalid round count"),
  answerTimeSec: inOptions(QUIP_ANSWER_TIME_OPTIONS, "Invalid answer time"),
  voteTimeSec: inOptions(QUIP_VOTE_TIME_OPTIONS, "Invalid vote time"),
  familyFriendly: z.boolean(),
  audienceVoting: z.boolean(),
});

/** A player's quip answer submission (ANS-2: 1..80 chars). */
export const quipSubmitAnswerSchema = z.object({
  promptId: z.string().min(1),
  text: z.string().trim().min(1, "Empty answer").max(QUIP_ANSWER_MAX, "Answer too long"),
});

export const quipVoteSchema = z.object({
  matchupIndex: z.number().int().min(0),
  choice: z.union([z.literal(0), z.literal(1)]),
});

export const hostSkipAnswerSchema = z.object({ matchupIndex: z.number().int().min(0) });

export const vipConfigureFibSchema = z.object({
  totalQuestions: inOptions(FIB_QUESTIONS_OPTIONS, "Invalid question count"),
  category: categorySchema,
  lieTimeSec: inOptions(FIB_LIE_TIME_OPTIONS, "Invalid lie time"),
  spotTimeSec: inOptions(FIB_SPOT_TIME_OPTIONS, "Invalid spot time"),
  familyFriendly: z.boolean(),
});

export const fibPickSchema = z.object({ optionId: z.string().min(1) });
export const hostSkipOptionSchema = z.object({ optionId: z.string().min(1) });

export type HostCreatePayload = z.infer<typeof hostCreateSchema>;
export type HostRejoinPayload = z.infer<typeof hostRejoinSchema>;
export type PlayerJoinPayload = z.infer<typeof playerJoinSchema>;
export type PlayerRejoinPayload = z.infer<typeof playerRejoinSchema>;
export type VipConfigurePayload = z.infer<typeof vipConfigureSchema>;
export type PlayerAnswerPayload = z.infer<typeof playerAnswerSchema>;
export type HostKickPayload = z.infer<typeof hostKickSchema>;
export type HostLockPayload = z.infer<typeof hostLockSchema>;
export type VipSelectGamePayload = z.infer<typeof vipSelectGameSchema>;
export type VipConfigureQuipPayload = z.infer<typeof vipConfigureQuipSchema>;
export type QuipSubmitAnswerPayload = z.infer<typeof quipSubmitAnswerSchema>;
export type QuipVotePayload = z.infer<typeof quipVoteSchema>;
export type HostSkipAnswerPayload = z.infer<typeof hostSkipAnswerSchema>;
export type VipConfigureFibPayload = z.infer<typeof vipConfigureFibSchema>;
export type FibPickPayload = z.infer<typeof fibPickSchema>;
export type HostSkipOptionPayload = z.infer<typeof hostSkipOptionSchema>;

// ─── Error codes (server → client `error` event) ─────────────────────────────

export const ERROR_CODES = {
  INVALID_PAYLOAD: "INVALID_PAYLOAD",
  ROOM_NOT_FOUND: "ROOM_NOT_FOUND",
  ROOM_FULL: "ROOM_FULL",
  ROOM_LOCKED: "ROOM_LOCKED",
  NAME_TAKEN: "NAME_TAKEN",
  NAME_REJECTED: "NAME_REJECTED",
  NOT_VIP: "NOT_VIP",
  NOT_HOST: "NOT_HOST",
  NOT_ENOUGH_PLAYERS: "NOT_ENOUGH_PLAYERS",
  WRONG_PHASE: "WRONG_PHASE",
  SESSION_INVALID: "SESSION_INVALID",
  INTERNAL: "INTERNAL",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
