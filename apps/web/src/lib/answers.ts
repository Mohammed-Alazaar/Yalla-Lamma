// Fixed presentation for the four answer choices (color + letter + shape).
// Shapes back up the colors for colorblind players (PRD accessibility).
export const ANSWER_META = [
  { color: "#E21B3C", label: "A", shape: "▲" },
  { color: "#1368CE", label: "B", shape: "◆" },
  { color: "#D89E00", label: "C", shape: "●" },
  { color: "#26890C", label: "D", shape: "■" },
] as const;

export type AnswerMeta = (typeof ANSWER_META)[number];
