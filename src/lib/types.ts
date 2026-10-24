export type Kind = "word" | "expression";

export interface Word {
  id: string;
  en: string;
  hu: string;
  kind: Kind;
  box: number;
  due_at: string;
  correct: number;
  wrong: number;
  created_at: string;
}

export interface Player {
  id: string;
  name: string;
  avatar: string;
  color: string;
  xp: number;
  streak: number;
  best_streak: number;
  last_played: string | null;
  badges: string[];
}

/** A pair extracted from a photo, before it is saved. */
export interface ParsedPair {
  en: string;
  hu: string;
  kind: Kind;
  uncertain: boolean;
}

export type GameId = "match" | "type" | "balloon";

export interface Answer {
  word: Word;
  correct: boolean;
}
