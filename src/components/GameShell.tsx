"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BADGES, roundMessage } from "@/lib/gamification";
import { pickRound } from "@/lib/leitner";
import { finishRound, type RoundExtra, type RoundSummary } from "@/lib/progress";
import type { Answer, GameId, Word } from "@/lib/types";
import { useWords } from "@/lib/useData";

export type Finish = (answers: Answer[], extra?: RoundExtra) => void;

interface Props {
  game: GameId;
  title: string;
  size: number;
  minWords: number;
  children: (round: Word[], finish: Finish, allWords: Word[]) => React.ReactNode;
}

export default function GameShell({ game, title, size, minWords, children }: Props) {
  const { words, reload, supabase } = useWords();
  const [summary, setSummary] = useState<RoundSummary | null>(null);
  const [saving, setSaving] = useState(false);
  const [playId, setPlayId] = useState(0);

  // playId is a dependency on purpose: bumping it shuffles a fresh round.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const round = useMemo(() => (words ? pickRound(words, size) : null), [words, size, playId]);

  const finish: Finish = async (answers, extra) => {
    setSaving(true);
    setSummary(await finishRound(supabase, game, answers, extra));
    setSaving(false);
  };

  async function again() {
    // Re-fetch so the next round is picked using the updated Leitner boxes.
    await reload();
    setSummary(null);
    setPlayId((n) => n + 1);
  }

  if (!words || !round) return <p className="mt-20 text-center text-xl">Loading... ✨</p>;
  if (words.length < minWords)
    return (
      <div className="card text-center">
        <div className="text-5xl">📸</div>
        <p className="mt-2 text-xl font-bold">You need at least {minWords} words for this game.</p>
        <Link href="/scan" className="btn-primary mt-4">
          Scan more words
        </Link>
      </div>
    );
  if (saving) return <p className="mt-20 animate-pulse text-center text-xl">Counting your points... ✨</p>;
  if (summary) return <Results summary={summary} onAgain={again} />;

  return (
    <div>
      <h1 className="mb-4 text-center text-3xl font-black">{title}</h1>
      <div key={playId}>{children(round, finish, words)}</div>
      <button className="mx-auto mt-6 block text-sm text-purple-400 underline" onClick={() => setPlayId((n) => n + 1)}>
        Shuffle new words
      </button>
    </div>
  );
}

function Results({ summary, onAgain }: { summary: RoundSummary; onAgain: () => void }) {
  const { score, total, xpGained, newBadges, levelUp, streak, tricky } = summary;
  return (
    <div className="card mx-auto max-w-xl text-center animate-pop">
      <div className="text-6xl">{score === total ? "🏆" : score / total >= 0.5 ? "🎉" : "💪"}</div>
      <h1 className="mt-2 text-4xl font-black">
        {score} / {total}
      </h1>
      <p className="mt-1 text-lg font-bold">{roundMessage(score, total)}</p>

      <div className="mt-4 flex justify-center gap-6 text-lg font-black">
        <span className="text-grape">+{xpGained} XP</span>
        <span className="text-orange-500">🔥 {streak}-day streak</span>
      </div>

      {levelUp && <p className="mt-4 rounded-2xl bg-yellow-100 p-3 text-2xl font-black animate-pop">⬆️ LEVEL UP! You&apos;re level {levelUp}!</p>}

      {newBadges.length > 0 && (
        <div className="mt-4 rounded-2xl bg-purple-50 p-3">
          <p className="font-black">New badge{newBadges.length > 1 ? "s" : ""}!</p>
          <div className="mt-2 flex justify-center gap-4">
            {BADGES.filter((b) => newBadges.includes(b.id)).map((b) => (
              <div key={b.id} className="animate-pop">
                <div className="text-5xl">{b.emoji}</div>
                <div className="text-sm font-bold">{b.name}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tricky.length > 0 && (
        <div className="mt-4 text-left">
          <p className="font-black">🎯 Tricky words, they&apos;ll come back soon:</p>
          <ul className="mt-2 space-y-1">
            {tricky.map((w) => (
              <li key={w.id} className="rounded-xl bg-pink-50 px-3 py-2">
                <b>{w.en}</b> = {w.hu}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 flex justify-center gap-2">
        <button className="btn-primary" onClick={onAgain}>
          🔁 Play again
        </button>
        <Link href="/" className="btn-ghost">
          🏠 Home
        </Link>
      </div>
    </div>
  );
}

/** Reads English text aloud; onEnd runs when it has finished (or was cut off by the next one). */
export function speak(text: string, onEnd?: () => void) {
  if (typeof speechSynthesis === "undefined") return onEnd?.();
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/\(.*?\)/g, ""));
  u.lang = "en-GB";
  u.rate = 0.9;
  if (onEnd) {
    u.onend = onEnd;
    u.onerror = onEnd;
  }
  speechSynthesis.speak(u);
}
