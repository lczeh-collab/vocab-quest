"use client";

import { useEffect, useRef, useState } from "react";
import GameShell, { speak, type Finish } from "@/components/GameShell";
import { cheer, comfort } from "@/lib/gamification";
import { shuffle } from "@/lib/leitner";
import { pictureKey, usePictures } from "@/lib/pictures";
import { similarWords } from "@/lib/similar";
import type { Answer, Word } from "@/lib/types";

export default function ListenPage() {
  return (
    <GameShell game="listen" title="👂 Listen & Pick" size={10} minWords={3}>
      {(round, finish, allWords) => <ListenPick round={round} finish={finish} allWords={allWords} />}
    </GameShell>
  );
}

// Pink, blue, green, as in the design.
const BUBBLES = ["bg-pink-600", "bg-sky-600", "bg-emerald-600"];
const RINGS = ["border-pink-600", "border-sky-600", "border-emerald-600"];

function ListenPick({ round, finish, allWords }: { round: Word[]; finish: Finish; allWords: Word[] }) {
  const { pictures } = usePictures();
  const [questions] = useState(() => round.map((word) => shuffle([word, ...similarWords(word, allWords, 2)])));
  const [q, setQ] = useState(0);
  const [playing, setPlaying] = useState<number | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [message, setMessage] = useState("");
  const nextButton = useRef<HTMLButtonElement>(null);

  const word = round[q];
  const options = questions[q];
  const picture = pictures?.get(pictureKey(word.en));
  const answered = picked !== null;
  const right = options.findIndex((o) => o.id === word.id);

  function play(i: number) {
    setPlaying(i);
    speak(options[i].en, () => setPlaying((p) => (p === i ? null : p)));
  }

  function pick(i: number) {
    if (answered) return;
    const ok = i === right;
    setPicked(i);
    setAnswers([...answers, { word, correct: ok }]);
    const c = ok ? combo + 1 : 0;
    setCombo(c);
    setBestCombo(Math.max(bestCombo, c));
    setMessage(ok ? cheer() : `${comfort()} It was "${word.en}"`);
    // Either way she hears the right word once more.
    play(right);
  }

  function next() {
    if (q + 1 >= round.length) return finish(answers, { bestCombo });
    setQ(q + 1);
    setPicked(null);
    setPlaying(null);
    setMessage("");
  }

  useEffect(() => {
    if (!answered) return;
    // On short laptop screens the Next button may sit below the edge.
    nextButton.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    const onKey = (e: KeyboardEvent) => e.key === "Enter" && next();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Wait for the pictures so the first word doesn't jump when its picture arrives.
  if (!pictures) return <p className="mt-20 text-center text-xl">Loading... ✨</p>;

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center">
      <div className="mb-2 flex w-full justify-between font-bold">
        <span>
          {q + 1} / {round.length}
        </span>
        {combo >= 2 && <span className="text-orange-500 animate-pop">🔥 x{combo}</span>}
      </div>

      <p className={`font-black ${picture ? "text-4xl" : "text-5xl"}`}>{word.hu}</p>
      {picture && (
        // Pictures need the login cookie, which Next's image optimizer doesn't send.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={picture.url}
          alt=""
          className={`mt-3 aspect-square rounded-full object-cover shadow-lg ring-[6px] ${answered && picked === right ? "ring-emerald-300" : "ring-white"}`}
          style={{ width: "min(210px, 25vh)" }}
        />
      )}
      {!picture && <p className="mt-1 text-sm font-bold text-purple-400">Which one is the English word?</p>}

      <div className="mt-4 grid grid-cols-3 gap-10 sm:gap-12">
        {options.map((opt, i) => {
          const isPlaying = playing === i;
          const isRight = answered && i === right;
          const isWrongPick = answered && i === picked && i !== right;
          return (
            <div key={opt.id} className="flex w-36 flex-col items-center gap-3 sm:w-44">
              <div className="relative flex h-32 w-32 items-center justify-center">
                {(isPlaying || isRight) && (
                  <span
                    aria-hidden
                    className={`absolute -inset-1.5 rounded-full border-4 ${isRight ? "border-emerald-400" : `${RINGS[i]} opacity-50 animate-pulse`}`}
                  />
                )}
                <button
                  type="button"
                  onClick={() => play(i)}
                  aria-label={answered ? `Listen to ${opt.en}` : `Play sound ${i + 1}`}
                  className={`flex h-28 w-28 items-center justify-center rounded-full text-white shadow-[inset_-8px_-10px_0_rgba(0,0,0,0.12),0_8px_18px_rgba(30,27,75,0.2)] transition ${
                    isRight ? "bg-emerald-600" : BUBBLES[i]
                  } ${isPlaying ? "scale-110" : "hover:scale-105"} ${answered && !isRight ? "opacity-50 grayscale" : ""}`}
                >
                  <SpeakerIcon />
                </button>
                <span className="absolute right-1 top-0 flex h-8 w-8 items-center justify-center rounded-full bg-white text-base font-black shadow">
                  {i + 1}
                </span>
              </div>
              {answered ? (
                <span
                  className={`flex min-h-11 items-center rounded-full px-4 text-center text-lg font-black leading-tight animate-pop ${
                    isRight ? "bg-emerald-100 text-emerald-800" : isWrongPick ? "bg-pink-100 text-pink-800 line-through" : "text-slate-500"
                  }`}
                >
                  {opt.en}
                </span>
              ) : (
                <button type="button" onClick={() => pick(i)} className="btn min-h-11 rounded-full bg-ink px-7 text-white hover:bg-violet-950">
                  Pick
                </button>
              )}
            </div>
          );
        })}
      </div>

      {answered && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-4 animate-pop">
          <p className={`text-xl font-black ${picked === right ? "text-mint" : "text-bubble"}`}>{message}</p>
          <button ref={nextButton} type="button" className="btn-primary" onClick={next}>
            Next → (Enter)
          </button>
        </div>
      )}
    </div>
  );
}

function SpeakerIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 5 6 9H3v6h3l5 4V5z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  );
}
