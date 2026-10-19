"use client";

import Link from "next/link";
import { BADGES, levelFor, titleFor } from "@/lib/gamification";
import { useProfile, useWords } from "@/lib/useData";

const GAMES = [
  { href: "/play/flashcards", emoji: "🃏", name: "Flashcards", text: "Flip, guess, level up", color: "from-violet-400 to-purple-500" },
  { href: "/play/match", emoji: "⚡", name: "Speed Match", text: "Match pairs against the clock", color: "from-pink-400 to-rose-500" },
  { href: "/play/type", emoji: "⌨️", name: "Type It!", text: "Type the translation, build combos", color: "from-amber-300 to-orange-400" },
  { href: "/play/balloon", emoji: "🎈", name: "Balloon Pop", text: "Pop the right balloon before it flies away", color: "from-sky-400 to-cyan-500" },
];

export default function Home() {
  const profile = useProfile();
  const { words } = useWords();

  if (!profile || !words) return <p className="mt-20 text-center text-xl">Loading... ✨</p>;

  const { level, progress, toNext } = levelFor(profile.xp);
  const due = words.filter((w) => new Date(w.due_at) <= new Date()).length;
  const mastered = words.filter((w) => w.box === 5).length;

  return (
    <div className="space-y-6">
      <section className="card grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <p className="text-sm font-bold uppercase tracking-wide text-bubble">Level {level}</p>
          <h1 className="text-3xl font-black">{titleFor(level)}</h1>
          <div className="mt-3 h-4 overflow-hidden rounded-full bg-purple-100">
            <div className="h-full rounded-full bg-gradient-to-r from-grape to-bubble" style={{ width: `${progress * 100}%` }} />
          </div>
          <p className="mt-1 text-sm">
            {profile.xp} XP · {toNext} XP to level {level + 1}
          </p>
        </div>
        <div className="flex items-center justify-around text-center">
          <Stat value={`🔥 ${profile.streak}`} label="day streak" />
          <Stat value={`🧠 ${mastered}`} label="mastered" />
        </div>
      </section>

      {words.length === 0 ? (
        <section className="card text-center">
          <div className="text-5xl">📸</div>
          <h2 className="mt-2 text-2xl font-black">Let&apos;s add your first words!</h2>
          <p className="mt-1">Take a photo of your vocabulary notebook.</p>
          <Link href="/scan" className="btn-primary mt-4">
            Scan my notebook
          </Link>
        </section>
      ) : (
        <>
          <p className="text-center text-lg font-bold">
            {due > 0 ? `${due} word${due === 1 ? "" : "s"} waiting for practice today 💪` : "All caught up! Play for bonus XP 🌟"}
          </p>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {GAMES.map((g) => (
              <Link
                key={g.href}
                href={g.href}
                className={`rounded-3xl bg-gradient-to-br ${g.color} p-6 text-white shadow-lg transition hover:-translate-y-1 hover:shadow-xl`}
              >
                <div className="text-5xl">{g.emoji}</div>
                <h2 className="mt-2 text-2xl font-black">{g.name}</h2>
                <p className="opacity-90">{g.text}</p>
              </Link>
            ))}
          </section>
        </>
      )}

      <section className="card">
        <h2 className="text-xl font-black">Badges</h2>
        <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-9">
          {BADGES.map((b) => {
            const has = profile.badges.includes(b.id);
            return (
              <div key={b.id} title={b.hint} className={`text-center ${has ? "" : "opacity-30 grayscale"}`}>
                <div className="text-4xl">{b.emoji}</div>
                <div className="text-xs font-bold">{b.name}</div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-3xl font-black">{value}</div>
      <div className="text-xs font-bold uppercase text-purple-400">{label}</div>
    </div>
  );
}
