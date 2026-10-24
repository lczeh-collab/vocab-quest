import type { SupabaseClient } from "@supabase/supabase-js";
import { BADGES, XP_PER_CORRECT, XP_ROUND_BONUS, levelFor, nextStreak, today } from "./gamification";
import { nextReview } from "./leitner";
import { clearPlayerId, getPlayerId, reloadTo } from "./player";
import type { Answer, GameId, Player } from "./types";

export async function loadPlayer(supabase: SupabaseClient): Promise<Player> {
  const { data, error } = await supabase.from("players").select("*").eq("id", getPlayerId()).maybeSingle();
  if (error) throw error;
  if (!data) {
    // The remembered player no longer exists (or belongs to another login).
    clearPlayerId();
    reloadTo("/players");
    throw new Error("Unknown player");
  }
  return data as Player;
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

  const profile = await loadPlayer(supabase);
  const xp = profile.xp + xpGained;
  const streak = nextStreak(profile);

  const [{ count: wordCount }, { count: mastered }, { data: pastRounds }] = await Promise.all([
    supabase.from("words").select("id", { count: "exact", head: true }).eq("player_id", profile.id),
    supabase.from("words").select("id", { count: "exact", head: true }).eq("player_id", profile.id).eq("box", 5),
    supabase.from("rounds").select("game").eq("player_id", profile.id),
  ]);
  // Include the round being saved right now.
  const roundsPlayed = (pastRounds?.length ?? 0) + 1;
  const gamesPlayed = new Set([...(pastRounds ?? []).map((r) => r.game), game]);

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
  award("words100", (wordCount ?? 0) >= 100);
  award("mastered50", (mastered ?? 0) >= 50);
  award("streak30", streak >= 30);
  award("xp5000", xp >= 5000);
  // A heart is only lost on a wrong answer, so a full round with no mistakes kept all hearts.
  award("balloon_hero", game === "balloon" && total >= 12 && score === total);
  award("spelling_bee", game === "type" && total >= 10 && score === total);
  award("explorer", (["flashcards", "match", "type", "balloon"] as GameId[]).every((g) => gamesPlayed.has(g)));
  award("dedicated", roundsPlayed >= 50);
  const newBadges = BADGES.map((b) => b.id).filter((id) => earned.has(id) && !profile.badges.includes(id));

  await Promise.all([
    supabase
      .from("players")
      .update({
        xp,
        streak,
        best_streak: Math.max(profile.best_streak, streak),
        last_played: today(),
        badges: [...earned],
      })
      .eq("id", profile.id),
    supabase.from("rounds").insert({ player_id: profile.id, game, score, total, xp: xpGained, seconds: extra.seconds ?? null }),
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

/** Awards one badge outside a game round (e.g. the first scan). Returns true if it is new. */
export async function awardBadge(supabase: SupabaseClient, id: string): Promise<boolean> {
  const player = await loadPlayer(supabase);
  if (player.badges.includes(id)) return false;
  const { error } = await supabase.from("players").update({ badges: [...player.badges, id] }).eq("id", player.id);
  return !error;
}
