/*
 * Prosody engine — free, local, engine-agnostic expressiveness.
 *
 * The Web Speech API supports no SSML, so expressiveness comes from HOW
 * text is delivered: short clause chunks, each with its own rate/pitch,
 * separated by natural pauses. Every browser with speechSynthesis supports
 * these primitives, which makes this the most compatible approach.
 *
 * Chunk shape: { text, rate, pitch, pauseAfter }
 *   rate/pitch are RELATIVE multipliers applied on top of the user's
 *   base rate/pitch. pauseAfter is milliseconds of silence after the chunk.
 */

const MIN_RATE = 0.7;
const MAX_RATE = 1.3;
const MIN_PITCH = 0.8;
const MAX_PITCH = 1.2;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const clampRate = (v) => clamp(v, MIN_RATE, MAX_RATE);
export const clampPitch = (v) => clamp(v, MIN_PITCH, MAX_PITCH);

// Quoted phrases, `code`, or ALL-CAPS words get spoken slower + lower:
// they are the emphasized terms in an interview question.
const EMPHASIS_RE = /("[^"]+"|`[^`]+`|\b[A-Z][A-Z0-9&+#.-]{2,}\b)/g;

function splitEmphasis(segment, out) {
  let last = 0;
  let m;
  EMPHASIS_RE.lastIndex = 0;
  for (;;) {
    m = EMPHASIS_RE.exec(segment);
    if (!m) break;
    const plain = segment.slice(last, m.index).trim();
    if (plain) out.push({ text: plain, kind: "plain" });
    out.push({ text: m[0].replace(/[`"]/g, ""), kind: "emphasis" });
    last = m.index + m[0].length;
  }
  const rest = segment.slice(last).trim();
  if (rest) out.push({ text: rest, kind: "plain" });
}

export function splitIntoChunks(text) {
  const clean = (text || "").trim().replace(/\s+/g, " ");
  if (!clean) return [];

  // 1. Sentence split on . ? ! followed by space/capital.
  const sentences = clean.match(/[^.?!]+[.?!]+["']?|\S[^.?!]*$/g) || [clean];
  const chunks = [];

  sentences.forEach((sentence, si) => {
    // 2. Break very long sentences on clause punctuation.
    const clauses =
      sentence.length > 140
        ? sentence.split(/(?<=[,;:—–])\s+/).filter(Boolean)
        : [sentence];

    clauses.forEach((clause, ci) => {
      const parts = [];
      splitEmphasis(clause.trim(), parts);
      const isLastClause = ci === clauses.length - 1;
      const isLastSentence = si === sentences.length - 1;
      const endsQuestion = /[?]\s*["']?$/.test(clause);

      parts.forEach((part) => {
        if (part.kind === "emphasis") {
          chunks.push({
            text: part.text,
            rate: 0.85,
            pitch: 0.9,
            pauseAfter: 250,
          });
        } else if (si === 0 && ci === 0) {
          // Opening clause: warm, welcoming, slightly lifted.
          chunks.push({
            text: part.text,
            rate: 0.95,
            pitch: 1.1,
            pauseAfter: isLastClause && isLastSentence ? 0 : 180,
          });
        } else if (isLastSentence && isLastClause && endsQuestion) {
          // Question tail: gentle rise, like a real interviewer asking.
          chunks.push({
            text: part.text,
            rate: 1.0,
            pitch: 1.05,
            pauseAfter: 0,
          });
        } else {
          chunks.push({
            text: part.text,
            rate: 1.0,
            pitch: 1.0,
            pauseAfter: isLastClause ? 300 : 150,
          });
        }
      });
    });
  });

  return chunks.filter((c) => c.text);
}

/*
 * Interviewer lead-ins, chosen from live session context. Returned text is
 * prepended to the question so it flows as one natural delivery.
 */
export function buildLeadIn({ questionIndex = 0, lastScore = null } = {}) {
  if (questionIndex === 0) return "Let's begin.";
  if (lastScore != null && lastScore >= 7) return "Nice answer. Here's the next one.";
  if (lastScore != null && lastScore <= 4) return "No worries. Let's move on.";
  if (questionIndex % 3 === 2) return "Good. Next question.";
  return null;
}

// Difficulty sets the base delivery: easy is a touch warmer/faster,
// hard is slower and more measured.
export function difficultyBase(difficulty) {
  switch ((difficulty || "").toUpperCase()) {
    case "EASY":
      return { rate: 1.05, pitch: 1.05 };
    case "HARD":
      return { rate: 0.92, pitch: 0.95 };
    default:
      return { rate: 1.0, pitch: 1.0 };
  }
}
