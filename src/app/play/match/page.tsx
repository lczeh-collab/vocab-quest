"use client";

import { useEffect, useState } from "react";
import GameShell, { type Finish } from "@/components/GameShell";
import { cheer } from "@/lib/gamification";
import { shuffle } from "@/lib/leitner";
import type { Word } from "@/lib/types";

export default function MatchPage() {
  return (
    <GameShell game="match" title="⚡ Speed Match" size={8} minWords={4}>
      {(round, finish) => <Match round={round} finish={finish} />}
    </GameShell>
  );
}

function Match({ round, finish }: { round: Word[]; finish: Finish }) {
  const [left] = useState(() => shuffle(round));
  const [right] = useState(() => shuffle(round));
  const [picked, setPicked] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [missed, setMissed] = useState<Set<string>>(new Set());
  const [shake, setShake] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, []);

  const seconds = (now - start) / 1000;

  function choose(rightWord: Word) {
    if (!picked || matched.has(rightWord.id)) return;
    if (picked === rightWord.id) {
      const m = new Set(matched).add(picked);
      setMatched(m);
      setPicked(null);
      setToast(cheer());
      setTimeout(() => setToast(null), 600);
      if (m.size === round.length) {
        // A pair counts as known only if it was matched without a wrong try.
        finish(
          round.map((w) => ({ word: w, correct: !missed.has(w.id) })),
          { seconds: Math.round(seconds) },
        );
      }
    } else {
      setMissed(new Set(missed).add(picked));
      setShake(rightWord.id);
      setTimeout(() => setShake(null), 300);
    }
  }

  const tile = "w-full rounded-2xl px-3 py-4 text-lg font-bold shadow transition";

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-3 flex justify-between text-lg font-black">
        <span>
          ✅ {matched.size} / {round.length}
        </span>
        <span className={seconds < 30 ? "text-mint" : "text-orange-500"}>⏱️ {seconds.toFixed(1)}s</span>
      </div>
      <p className="mb-3 text-center text-sm text-purple-400">Click an English word, then its Hungarian partner. Under 30s = ⚡ badge!</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          {left.map((w) => (
            <button
              key={w.id}
              disabled={matched.has(w.id)}
              onClick={() => setPicked(w.id)}
              className={`${tile} ${
                matched.has(w.id)
                  ? "scale-95 bg-emerald-100 text-emerald-400"
                  : picked === w.id
                    ? "bg-grape text-white ring-4 ring-purple-300"
                    : "bg-white hover:bg-purple-50"
              }`}
            >
              {w.en}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {right.map((w) => (
            <button
              key={w.id}
              disabled={matched.has(w.id)}
              onClick={() => choose(w)}
              className={`${tile} ${matched.has(w.id) ? "scale-95 bg-emerald-100 text-emerald-400" : "bg-white hover:bg-pink-50"} ${
                shake === w.id ? "animate-shake bg-pink-200" : ""
              }`}
            >
              {w.hu}
            </button>
          ))}
        </div>
      </div>
      {toast && <p className="pointer-events-none fixed inset-x-0 top-1/3 text-center text-4xl font-black text-grape animate-pop">{toast}</p>}
    </div>
  );
}
