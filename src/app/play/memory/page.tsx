"use client";

import { useEffect, useRef, useState } from "react";
import GameShell, { speak, type Finish } from "@/components/GameShell";
import PictureThumb from "@/components/PictureThumb";
import { cheer } from "@/lib/gamification";
import { shuffle } from "@/lib/leitner";
import { getPlayerId } from "@/lib/player";
import { pictureKey, usePictures, type Picture } from "@/lib/pictures";
import type { Word } from "@/lib/types";

const PAIRS = 8;
const COLUMNS = 4;
const FLIP_BACK_MS = 1200;

export default function MemoryPage() {
  return (
    <GameShell game="memory" title="🧠 Memory" size={PAIRS} minWords={4}>
      {(round, finish) => <Memory round={round} finish={finish} />}
    </GameShell>
  );
}

interface Card {
  key: string;
  word: Word;
  side: "hu" | "en";
}

interface Best {
  moves: number;
  seconds: number;
}

// The best result is remembered per player on this laptop, per board size.
const bestKey = (pairs: number) => `vq_memory_best_${getPlayerId()}_${pairs}`;
function loadBest(pairs: number): Best | null {
  try {
    return JSON.parse(localStorage.getItem(bestKey(pairs)) ?? "null");
  } catch {
    return null;
  }
}
function saveBest(pairs: number, best: Best) {
  try {
    localStorage.setItem(bestKey(pairs), JSON.stringify(best));
  } catch {
    // Private window or blocked storage: the best result just isn't kept.
  }
}

function Memory({ round, finish }: { round: Word[]; finish: Finish }) {
  const { pictures } = usePictures();
  const [cards] = useState<Card[]>(() =>
    shuffle(round.flatMap((word) => [{ key: `${word.id}-hu`, word, side: "hu" as const }, { key: `${word.id}-en`, word, side: "en" as const }])),
  );
  const [open, setOpen] = useState<string[]>([]);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [moves, setMoves] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [toast, setToast] = useState<string | null>(null);
  const [best] = useState(() => loadBest(round.length));
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => {
      clearInterval(t);
      clearTimeout(timer.current);
    };
  }, []);

  const seconds = startedAt ? Math.floor((now - startedAt) / 1000) : 0;
  const isFaceUp = (c: Card) => open.includes(c.key) || matched.has(c.word.id);

  function flip(card: Card) {
    if (open.length === 2 || isFaceUp(card)) return;
    if (!startedAt) setStartedAt(now);
    const next = [...open, card.key];
    setOpen(next);
    if (next.length < 2) return;

    const n = moves + 1;
    setMoves(n);
    const [a, b] = next.map((k) => cards.find((c) => c.key === k)!);
    if (a.word.id !== b.word.id) {
      // Not a pair: leave them visible a moment to memorise, then turn them back.
      timer.current = setTimeout(() => setOpen([]), FLIP_BACK_MS);
      return;
    }

    const m = new Set(matched).add(a.word.id);
    speak(a.word.en);
    setToast(cheer());
    setTimeout(() => setToast(null), 700);
    timer.current = setTimeout(() => {
      setMatched(m);
      setOpen([]);
    }, 400);
    if (m.size === round.length) {
      const secs = Math.max(1, Math.round((now - (startedAt ?? now)) / 1000));
      if (!best || n < best.moves || (n === best.moves && secs < best.seconds)) saveBest(round.length, { moves: n, seconds: secs });
      // Every pair found counts as practised; a tidy game (few moves) earns bonus XP.
      const bonusXp = Math.max(0, 2 * round.length - n) * 5;
      setTimeout(() => finish(round.map((word) => ({ word, correct: true })), { seconds: secs, moves: n, bonusXp }), 900);
    }
  }

  const rows = Math.ceil(cards.length / COLUMNS);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-3 flex items-center justify-between text-lg font-black">
        <span>
          ✅ {matched.size} / {round.length}
        </span>
        <span className="text-sm font-bold text-purple-400">
          {best ? `🏆 Best: ${best.moves} moves · ${best.seconds}s` : "Find all pairs in as few moves as you can!"}
        </span>
        <span>
          👆 {moves} · ⏱️ {seconds}s
        </span>
      </div>

      {/* The board fills the screen height left under the header (laptop screens are short). */}
      <div
        className="grid gap-3 perspective-[1200px]"
        style={{
          gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
          height: `max(${rows * 76}px, calc(100dvh - 240px))`,
        }}
      >
        {cards.map((card, i) => (
          <CardView
            key={card.key}
            card={card}
            faceUp={isFaceUp(card)}
            done={matched.has(card.word.id)}
            picture={pictures?.get(pictureKey(card.word.en))}
            // Cards on the right half open their picture preview to the left, so it stays on screen.
            previewSide={i % COLUMNS < COLUMNS / 2 ? "right" : "left"}
            onClick={() => flip(card)}
          />
        ))}
      </div>
      {toast && <p className="pointer-events-none fixed inset-x-0 top-1/3 z-40 text-center text-4xl font-black text-grape animate-pop">{toast}</p>}
    </div>
  );
}

function CardView({
  card,
  faceUp,
  done,
  picture,
  previewSide,
  onClick,
}: {
  card: Card;
  faceUp: boolean;
  done: boolean;
  picture?: Picture;
  previewSide: "left" | "right";
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={faceUp ? (card.side === "hu" ? card.word.hu : card.word.en) : "Hidden card"}
      className={`relative h-full w-full transition-transform duration-500 transform-3d ${faceUp ? "rotate-y-180" : "hover:-translate-y-1"} ${
        done ? "opacity-70" : ""
      }`}
    >
      {/* Back */}
      <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-4xl shadow-md backface-hidden">
        <span className="opacity-80">✨</span>
      </span>
      {/* Front */}
      <span
        className={`absolute inset-0 flex items-center gap-3 rounded-2xl p-2 shadow-md backface-hidden rotate-y-180 ${
          done ? "bg-emerald-100 text-emerald-700" : card.side === "hu" ? "bg-white" : "bg-amber-50"
        } ${card.side === "en" || !picture ? "justify-center" : ""}`}
      >
        {card.side === "hu" && picture && <PictureThumb picture={picture} previewSide={previewSide} />}
        <span className={`min-w-0 break-words text-lg font-black leading-tight ${card.side === "hu" && picture ? "flex-1 text-left" : "text-center"}`}>
          {card.side === "hu" ? card.word.hu : card.word.en}
        </span>
      </span>
    </button>
  );
}
