"use client";

import { useEffect, useState } from "react";
import GameShell, { speak, type Finish } from "@/components/GameShell";
import { cheer, comfort } from "@/lib/gamification";
import type { Answer, Word } from "@/lib/types";

export default function FlashcardsPage() {
  return (
    <GameShell game="flashcards" title="🃏 Flashcards" size={10} minWords={1}>
      {(round, finish) => <Flashcards round={round} finish={finish} />}
    </GameShell>
  );
}

function Flashcards({ round, finish }: { round: Word[]; finish: Finish }) {
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  // Alternate direction so she practices both EN→HU and HU→EN.
  const [directions] = useState(() => round.map(() => Math.random() < 0.5));

  const word = round[i];
  const enFirst = directions[i];

  function answer(correct: boolean) {
    const next = [...answers, { word, correct }];
    const c = correct ? combo + 1 : 0;
    setCombo(c);
    setBestCombo(Math.max(bestCombo, c));
    setToast(correct ? cheer() : comfort());
    setTimeout(() => setToast(null), 900);
    if (i + 1 >= round.length) return finish(next, { bestCombo: Math.max(bestCombo, c) });
    setAnswers(next);
    setFlipped(false);
    setI(i + 1);
  }

  // Keyboard: space flips, ← not yet, → knew it.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code === "Space") {
        e.preventDefault();
        setFlipped(true);
      } else if (flipped && e.key === "ArrowRight") answer(true);
      else if (flipped && e.key === "ArrowLeft") answer(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-3 flex justify-between font-bold">
        <span>
          {i + 1} / {round.length}
        </span>
        {combo >= 2 && <span className="text-orange-500 animate-pop">🔥 x{combo}</span>}
      </div>

      <button
        onClick={() => setFlipped(true)}
        className={`card flex h-64 w-full flex-col items-center justify-center text-center transition ${
          flipped ? "bg-gradient-to-br from-violet-50 to-pink-50" : "hover:-translate-y-1"
        }`}
      >
        <span className="text-xs font-bold uppercase text-purple-400">{enFirst ? "English" : "Magyar"}</span>
        <span className="mt-2 text-3xl font-black">{enFirst ? word.en : word.hu}</span>
        {flipped ? (
          <span className="mt-4 text-2xl font-bold text-grape animate-pop">{enFirst ? word.hu : word.en}</span>
        ) : (
          <span className="mt-4 text-sm text-purple-400">Think of the answer, then click (or press space) to flip</span>
        )}
      </button>

      <div className="mt-2 text-center">
        <button className="text-sm font-bold text-grape" onClick={() => speak(word.en)}>
          🔊 Hear it
        </button>
      </div>

      {flipped && (
        <div className="mt-4 grid grid-cols-2 gap-3 animate-pop">
          <button className="btn bg-pink-100 text-bubble" onClick={() => answer(false)}>
            😅 Not yet ←
          </button>
          <button className="btn bg-emerald-100 text-mint" onClick={() => answer(true)}>
            😎 Knew it! →
          </button>
        </div>
      )}

      {toast && <p className="fixed inset-x-0 top-1/3 text-center text-4xl font-black text-grape animate-pop">{toast}</p>}
    </div>
  );
}
