import type { SupabaseClient } from "@supabase/supabase-js";
import { BADGES, XP_PER_CORRECT, XP_ROUND_BONUS, levelFor, nextStreak, today } from "./gamification";
import { nextReview } from "./leitner";
import type { Answer, GameId, Profile } from "./types";

export async function loadProfile(supabase: SupabaseClient): Promise<Profile> {
  const { data } = await supabase.from("profiles").select("*").maybeSingle();
  if (data) return data as Profile;
  const { data: created, error } = await supabase.from("profiles").insert({}).select().single();
  if (error) throw error;
  return created as Profile;
}

export interface RoundSummary {
  score: number;
  total: number;
  xpGained: number;
  newBadges: string[];
  levelUp: number | null;
  streak: number;
  tricky: Answer["word"][];
}

/**
 * Saves a finished round: moves each word between Leitner boxes,
 * adds XP, updates the streak and awards new badges.
 */
export async function finishRound(
  supabase: SupabaseClient,
  game: GameId,
  answers: Answer[],
  extra: { seconds?: number; bestCombo?: number } = {},
): Promise<RoundSummary> {
  // A word answered several times in one round counts by its last answer.
  const byWord = new Map(answers.map((a) => [a.word.id, a]));
  await Promise.all(
    [...byWord.values()].map(({ word, correct }) =>
      supabase.from("words").update(nextReview(word, correct)).eq("id", word.id),
    ),
  );

  const score = answers.filter((a) => a.correct).length;
  const total = answers.length;
  const xpGained = score * XP_PER_CORRECT + (total ? XP_ROUND_BONUS : 0);

  const profile = await loadProfile(supabase);
  const xp = profile.xp + xpGained;
  const streak = nextStreak(profile);

  const [{ count: wordCount }, { count: mastered }] = await Promise.all([
    supabase.from("words").select("id", { count: "exact", head: true }),
    supabase.from("words").select("id", { count: "exact", head: true }).eq("box", 5),
  ]);

  const earned = new Set(profile.badges);
  const award = (id: string, cond: boolean) => cond && earned.add(id);
  award("first_round", true);
  award("perfect", total >= 5 && score === total);
  award("speedster", game === "match" && extra.seconds !== undefined && extra.seconds < 30);
  award("combo10", (extra.bestCombo ?? 0) >= 10);
  award("streak3", streak >= 3);
  award("streak7", streak >= 7);
  award("words50", (wordCount ?? 0) >= 50);
  award("mastered10", (mastered ?? 0) >= 10);
  award("xp1000", xp >= 1000);
  const newBadges = BADGES.map((b) => b.id).filter((id) => earned.has(id) && !profile.badges.includes(id));

  await Promise.all([
    supabase
      .from("profiles")
      .update({
        xp,
        streak,
        best_streak: Math.max(profile.best_streak, streak),
        last_played: today(),
        badges: [...earned],
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", profile.user_id),
    supabase.from("rounds").insert({ game, score, total, xp: xpGained, seconds: extra.seconds ?? null }),
  ]);

  const before = levelFor(profile.xp).level;
  const after = levelFor(xp).level;

  return {
    score,
    total,
    xpGained,
    newBadges,
    levelUp: after > before ? after : null,
    streak,
    tricky: [...byWord.values()].filter((a) => !a.correct).map((a) => a.word),
  };
}
