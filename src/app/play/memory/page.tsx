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

const GLIDE_MS = 450;

function Memory({ round, finish }: { round: Word[]; finish: Finish }) {
  const { pictures } = usePictures();
  const [cards] = useState<Card[]>(() =>
    shuffle(round.flatMap((word) => [{ key: `${word.id}-hu`, word, side: "hu" as const }, { key: `${word.id}-en`, word, side: "en" as const }])),
  );
  const [open, setOpen] = useState<string[]>([]);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  // The English card of a just-found pair, gliding onto its Hungarian card.
  const [gliding, setGliding] = useState<{ key: string; dx: number; dy: number } | null>(null);
  const [moves, setMoves] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [toast, setToast] = useState<string | null>(null);
  const [best] = useState(() => loadBest(round.length));
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const elements = useRef(new Map<string, HTMLElement>());

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
    // A found card just says its English word again.
    if (matched.has(card.word.id)) return speak(card.word.en);
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

    // Let the second card finish turning over, then glide the English card onto the Hungarian one.
    const en = [a, b].find((c) => c.side === "en")!;
    const hu = [a, b].find((c) => c.side === "hu")!;
    timer.current = setTimeout(() => {
      const from = elements.current.get(en.key)?.getBoundingClientRect();
      const to = elements.current.get(hu.key)?.getBoundingClientRect();
      if (from && to) setGliding({ key: en.key, dx: to.left - from.left, dy: to.top - from.top });
      timer.current = setTimeout(() => {
        setMatched(m);
        setOpen([]);
        setGliding(null);
      }, GLIDE_MS);
    }, 500);

    if (m.size === round.length) {
      const secs = Math.max(1, Math.round((now - (startedAt ?? now)) / 1000));
      if (!best || n < best.moves || (n === best.moves && secs < best.seconds)) saveBest(round.length, { moves: n, seconds: secs });
      // Every pair found counts as practised; a tidy game (few moves) earns bonus XP.
      const bonusXp = Math.max(0, 2 * round.length - n) * 5;
      setTimeout(() => finish(round.map((word) => ({ word, correct: true })), { seconds: secs, moves: n, bonusXp }), 1600);
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
        {cards.map((card, i) =>
          // A found pair's English card leaves an empty gap, so no other card moves.
          card.side === "en" && matched.has(card.word.id) ? (
            <span key={card.key} aria-hidden />
          ) : (
            <CardView
              key={card.key}
              card={card}
              faceUp={isFaceUp(card)}
              found={matched.has(card.word.id)}
              glide={gliding?.key === card.key ? gliding : null}
              picture={pictures?.get(pictureKey(card.word.en))}
              // Cards on the right half open their picture preview to the left, so it stays on screen.
              previewSide={i % COLUMNS < COLUMNS / 2 ? "right" : "left"}
              onClick={() => flip(card)}
              elementRef={(el) => {
                if (el) elements.current.set(card.key, el);
                else elements.current.delete(card.key);
              }}
            />
          ),
        )}
      </div>
      {toast && <p className="pointer-events-none fixed inset-x-0 top-1/3 z-40 text-center text-4xl font-black text-grape animate-pop">{toast}</p>}
    </div>
  );
}

function CardView({
  card,
  faceUp,
  found,
  glide,
  picture,
  previewSide,
  onClick,
  elementRef,
}: {
  card: Card;
  faceUp: boolean;
  found: boolean;
  glide: { dx: number; dy: number } | null;
  picture?: Picture;
  previewSide: "left" | "right";
  onClick: () => void;
  elementRef: (el: HTMLElement | null) => void;
}) {
  const label = found ? `${card.word.en} (found, click to hear it)` : faceUp ? (card.side === "hu" ? card.word.hu : card.word.en) : "Hidden card";
  return (
    <button
      ref={elementRef}
      onClick={onClick}
      aria-label={label}
      className={`relative h-full w-full transition-transform duration-500 transform-3d ${faceUp ? "rotate-y-180" : "hover:-translate-y-1"} ${
        glide ? "z-30" : ""
      }`}
      style={glide ? { transform: `translate(${glide.dx}px, ${glide.dy}px) rotateY(180deg) scale(0.85)`, transitionDuration: `${GLIDE_MS}ms` } : undefined}
    >
      {/* Back */}
      <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-4xl shadow-md backface-hidden">
        <span className="opacity-80">✨</span>
      </span>
      {/* Front */}
      {found ? <FoundFace word={card.word} picture={picture} /> : <OpenFace card={card} picture={picture} previewSide={previewSide} />}
    </button>
  );
}

const FACE = "absolute inset-0 flex items-center gap-3 rounded-2xl p-2 shadow-md backface-hidden rotate-y-180";

/** A card being looked at: the Hungarian word with its picture, or the English word. */
function OpenFace({ card, picture, previewSide }: { card: Card; picture?: Picture; previewSide: "left" | "right" }) {
  const withPicture = card.side === "hu" && picture;
  return (
    <span className={`${FACE} ${card.side === "hu" ? "bg-white" : "bg-amber-50"} ${withPicture ? "" : "justify-center"}`}>
      {withPicture && <PictureThumb picture={picture} previewSide={previewSide} />}
      <span className={`min-w-0 break-words text-lg font-black leading-tight ${withPicture ? "flex-1 text-left" : "text-center"}`}>
        {card.side === "hu" ? card.word.hu : card.word.en}
      </span>
    </span>
  );
}

/** A found pair: the picture on the left and the English word on the right (no Hungarian). */
function FoundFace({ word, picture }: { word: Word; picture?: Picture }) {
  return (
    // The pop animation sits on the inner row: on the face itself it would undo the card's flip.
    <span className={`${FACE} bg-emerald-100 text-emerald-800 ring-4 ring-emerald-300`}>
      <span className={`flex h-full w-full items-center gap-3 animate-pop ${picture ? "" : "justify-center"}`}>
        {picture && (
          // Pictures need the login cookie, which Next's image optimizer doesn't send.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={picture.url} alt="" className="aspect-square h-full shrink-0 rounded-xl object-cover" />
        )}
        <span className={`min-w-0 break-words font-black leading-tight ${picture ? "flex-1 text-left text-xl" : "text-center text-2xl"}`}>
          {/* A no-break space keeps the speaker icon next to the last word. */}
          {word.en} <span className="text-sm opacity-60">🔊</span>
        </span>
      </span>
    </span>
  );
}
