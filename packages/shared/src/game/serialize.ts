import type {
  PlayerResult,
  PublicPlayer,
  PublicQuestion,
  PublicRoomState,
  RoomState,
} from "./types";
import { toPublicQuipState } from "./quipSerialize";

const ANSWER_REVEALED_PHASES = new Set(["reveal", "leaderboard", "final"]);

/**
 * Project the full server `RoomState` down to the redacted `PublicRoomState`
 * that is broadcast to clients. Strips secrets (hostToken, sessions) and never
 * exposes `correctIdx` or other players' choices before the reveal phase.
 */
export function toPublicRoomState(room: RoomState): PublicRoomState {
  const revealed = ANSWER_REVEALED_PHASES.has(room.phase);

  const players: PublicPlayer[] = Object.values(room.players)
    .sort((a, b) => a.joinedAt - b.joinedAt)
    .map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      score: p.score,
      connected: p.connected,
      isVip: p.id === room.vipPlayerId,
    }));

  const currentQuestion = room.questions[room.currentIndex] ?? null;
  const inRound =
    currentQuestion !== null && room.phase !== "lobby" && room.phase !== "final";

  let question: PublicQuestion | null = null;
  if (inRound && currentQuestion) {
    question = {
      id: currentQuestion.id,
      index: room.currentIndex,
      total: room.questions.length,
      text: currentQuestion.text,
      choices: currentQuestion.choices,
      category: currentQuestion.category,
      isFinal: room.currentIndex === room.questions.length - 1,
      correctIdx: revealed ? currentQuestion.correctIdx : null,
    };
  }

  const answersForQuestion = currentQuestion
    ? (room.answers[currentQuestion.id] ?? {})
    : {};
  const answeredPlayerIds = Object.keys(answersForQuestion);

  let results: PlayerResult[] | null = null;
  if (revealed && currentQuestion) {
    results = Object.values(room.players).map((p) => {
      const a = answersForQuestion[p.id];
      return {
        playerId: p.id,
        choice: a?.choice ?? null,
        correct: a ? a.choice === currentQuestion.correctIdx : false,
        pointsEarned: a?.pointsEarned ?? 0,
      };
    });
  }

  return {
    code: room.code,
    phase: room.phase,
    gameId: room.gameId,
    settings: room.settings,
    players,
    hostConnected: room.hostSocketId !== null,
    vipPlayerId: room.vipPlayerId,
    locked: room.locked,
    quip: toPublicQuipState(room),
    question,
    questionStartedAt: room.phase === "question" ? room.currentQuestionStartedAt : null,
    answeredPlayerIds,
    results,
  };
}
