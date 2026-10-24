import type { Player } from "./types";

export const XP_PER_CORRECT = 10;
export const XP_ROUND_BONUS = 20;

/** Level n needs 50·(n-1)² XP: 0, 50, 200, 450, 800, ... */
export function levelFor(xp: number) {
  const level = Math.floor(Math.sqrt(xp / 50)) + 1;
  const floor = 50 * (level - 1) ** 2;
  const next = 50 * level ** 2;
  return { level, progress: (xp - floor) / (next - floor), toNext: next - xp };
}

const TITLES = ["Word Explorer", "Vocab Rookie", "Phrase Hunter", "Word Wizard", "Language Ninja", "Vocab Legend"];
export const titleFor = (level: number) => TITLES[Math.min(level - 1, TITLES.length - 1)];

export interface Badge {
  id: string;
  emoji: string;
  name: string;
  hint: string;
}

export const BADGES: Badge[] = [
  { id: "first_round", emoji: "🎮", name: "First Game", hint: "Finish your first round" },
  { id: "perfect", emoji: "💯", name: "Perfect!", hint: "Get every answer right in a round" },
  { id: "speedster", emoji: "⚡", name: "Speedster", hint: "Finish Match in under 30 seconds" },
  { id: "combo10", emoji: "🔥", name: "On Fire", hint: "10 correct answers in a row" },
  { id: "streak3", emoji: "📅", name: "3-Day Streak", hint: "Practice 3 days in a row" },
  { id: "streak7", emoji: "🏆", name: "Week Warrior", hint: "Practice 7 days in a row" },
  { id: "words50", emoji: "📚", name: "Collector", hint: "Have 50 words in your list" },
  { id: "mastered10", emoji: "🧠", name: "Big Brain", hint: "Master 10 words (box 5)" },
  { id: "xp1000", emoji: "💎", name: "XP Diamond", hint: "Reach 1000 XP" },
  { id: "snapshot", emoji: "📸", name: "Snapshot", hint: "Save words from your first notebook scan" },
  { id: "words100", emoji: "📖", name: "Bookworm", hint: "Have 100 words in your list" },
  { id: "mastered50", emoji: "🎓", name: "Professor", hint: "Master 50 words (box 5)" },
  { id: "streak30", emoji: "🌟", name: "Month Master", hint: "Practice 30 days in a row" },
  { id: "xp5000", emoji: "👑", name: "XP Royalty", hint: "Reach 5000 XP" },
  { id: "balloon_hero", emoji: "🎈", name: "Balloon Hero", hint: "Finish a full Balloon Pop round without losing a heart" },
  { id: "spelling_bee", emoji: "🐝", name: "Spelling Bee", hint: "Get every word right in a full Type It round" },
  { id: "explorer", emoji: "🧭", name: "Explorer", hint: "Play all 4 games" },
  { id: "dedicated", emoji: "🏅", name: "Dedicated", hint: "Finish 50 rounds" },
];

/** Local date as YYYY-MM-DD, so streaks follow her day, not UTC. */
export function today(d = new Date()) {
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
}

export function nextStreak(profile: Pick<Player, "streak" | "last_played">, now = new Date()) {
  const t = today(now);
  if (profile.last_played === t) return profile.streak;
  const yesterday = today(new Date(now.getTime() - 86400000));
  return profile.last_played === yesterday ? profile.streak + 1 : 1;
}

const CHEERS = ["Awesome! 🎉", "Nailed it! 💪", "Yesss! ⭐", "Brilliant! 🌟", "You rock! 🤘", "Super! 🚀", "Perfect! ✨"];
const COMFORTS = ["Almost! 💜", "Next time! 🍀", "Good try! 🙌", "You'll get it! 💡", "Keep going! 🌱"];
const pick = (list: string[]) => list[Math.floor(Math.random() * list.length)];
export const cheer = () => pick(CHEERS);
export const comfort = () => pick(COMFORTS);

export function roundMessage(score: number, total: number) {
  const pct = total ? score / total : 0;
  if (pct === 1) return "FLAWLESS! You're a vocab superstar! 🌟";
  if (pct >= 0.8) return "Amazing round! Almost perfect! 🎉";
  if (pct >= 0.5) return "Nice work! The tricky ones will come back soon. 💪";
  return "Every expert started here. Let's try again! 🌱";
}
