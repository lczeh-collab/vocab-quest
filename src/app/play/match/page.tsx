"use client";

import { useEffect, useState } from "react";
import GameShell, { speak, type Finish } from "@/components/GameShell";
import PictureThumb from "@/components/PictureThumb";
import { cheer } from "@/lib/gamification";
import { shuffle } from "@/lib/leitner";
import { pictureKey, usePictures } from "@/lib/pictures";
import type { Word } from "@/lib/types";

export default function MatchPage() {
  return (
    <GameShell game="match" title="⚡ Speed Match" size={8} minWords={4}>
      {(round, finish) => <Match round={round} finish={finish} />}
    </GameShell>
  );
}

type Side = "hu" | "en";

function Match({ round, finish }: { round: Word[]; finish: Finish }) {
  const { pictures } = usePictures();
  const [left] = useState(() => shuffle(round));
  const [right] = useState(() => shuffle(round));
  const [picked, setPicked] = useState<{ side: Side; id: string } | null>(null);
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

  // Either side can be clicked first; clicking the same side again just changes the choice.
  function choose(side: Side, word: Word) {
    if (matched.has(word.id)) return;
    if (!picked || picked.side === side) return setPicked({ side, id: word.id });

    if (picked.id === word.id) {
      const m = new Set(matched).add(word.id);
      setMatched(m);
      setPicked(null);
      speak(word.en);
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
      setMissed(new Set(missed).add(picked.id));
      setShake(`${side}:${word.id}`);
      setTimeout(() => setShake(null), 300);
    }
  }

  function tileClass(side: Side, w: Word) {
    const base = "flex h-16 w-full items-center gap-3 rounded-2xl p-1.5 text-left text-lg font-bold shadow transition";
    if (matched.has(w.id)) return `${base} scale-95 bg-emerald-100 text-emerald-400`;
    if (picked?.side === side && picked.id === w.id) return `${base} bg-grape text-white ring-4 ring-purple-300`;
    if (shake === `${side}:${w.id}`) return `${base} animate-shake bg-pink-200`;
    return `${base} bg-white ${side === "hu" ? "hover:bg-purple-50" : "hover:bg-pink-50"}`;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-3 flex justify-between text-lg font-black">
        <span>
          ✅ {matched.size} / {round.length}
        </span>
        <span className={seconds < 30 ? "text-mint" : "text-orange-500"}>⏱️ {seconds.toFixed(1)}s</span>
      </div>
      <p className="mb-3 text-center text-sm text-purple-400">Match each Hungarian word with its English partner. Under 30s = ⚡ badge!</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          {left.map((w) => (
            <button key={w.id} disabled={matched.has(w.id)} onClick={() => choose("hu", w)} className={tileClass("hu", w)}>
              <PictureThumb picture={pictures?.get(pictureKey(w.en))} />
              <span className="min-w-0 flex-1 truncate px-1">{w.hu}</span>
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {right.map((w) => (
            <button key={w.id} disabled={matched.has(w.id)} onClick={() => choose("en", w)} className={`${tileClass("en", w)} justify-center`}>
              <span className="min-w-0 truncate px-2">{w.en}</span>
            </button>
          ))}
        </div>
      </div>
      {toast && <p className="pointer-events-none fixed inset-x-0 top-1/3 text-center text-4xl font-black text-grape animate-pop">{toast}</p>}
    </div>
  );
}
