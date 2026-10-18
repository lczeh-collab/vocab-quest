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

export interface Profile {
  user_id: string;
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

export type GameId = "flashcards" | "match" | "type";

export interface Answer {
  word: Word;
  correct: boolean;
}
