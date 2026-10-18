import type { Word } from "./types";

// Days until a word in each box is due again. Box 1 = every session, box 5 = mastered.
const INTERVAL_DAYS = [0, 0, 1, 3, 7, 14];
const DAY_MS = 24 * 60 * 60 * 1000;

export function nextReview(word: Word, correct: boolean, now = new Date()) {
  const box = correct ? Math.min(word.box + 1, 5) : 1;
  return {
    box,
    due_at: new Date(now.getTime() + INTERVAL_DAYS[box] * DAY_MS).toISOString(),
    correct: word.correct + (correct ? 1 : 0),
    wrong: word.wrong + (correct ? 0 : 1),
  };
}

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Due words first (lowest box first), topped up with random others so a round is never empty. */
export function pickRound(words: Word[], size: number, now = new Date()): Word[] {
  const due = shuffle(words.filter((w) => new Date(w.due_at) <= now)).sort((a, b) => a.box - b.box);
  const picked = due.slice(0, size);
  if (picked.length < size) {
    const rest = shuffle(words.filter((w) => !picked.includes(w)));
    picked.push(...rest.slice(0, size - picked.length));
  }
  return shuffle(picked);
}

export { shuffle };
