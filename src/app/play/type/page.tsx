"use client";

import { useEffect, useRef, useState } from "react";
import GameShell, { speak, type Finish } from "@/components/GameShell";
import { checkAnswer, gapSentence, type Verdict } from "@/lib/check";
import { cheer, comfort } from "@/lib/gamification";
import { pictureKey, usePictures } from "@/lib/pictures";
import type { Answer, Word } from "@/lib/types";

export default function TypePage() {
  return (
    <GameShell game="type" title="⌨️ Type It!" size={10} minWords={1}>
      {(round, finish) => <TypeIt round={round} finish={finish} />}
    </GameShell>
  );
}

const FEEDBACK: Record<Verdict, (w: Word) => string> = {
  correct: () => cheer(),
  accent: (w) => `Correct! Watch the accents: ${w.en}`,
  typo: (w) => `So close! Tiny typo, it's "${w.en}" ✍️`,
  wrong: () => comfort(),
};

function TypeIt({ round, finish }: { round: Word[]; finish: Finish }) {
  const [i, setI] = useState(0);
  const [value, setValue] = useState("");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [message, setMessage] = useState("");
  const [hint, setHint] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const buttons = useRef<HTMLDivElement>(null);
  const { pictures } = usePictures();

  const word = round[i];
  const picture = pictures?.get(pictureKey(word.en));
  const clue = picture?.example ? gapSentence(picture.example, word.en) : null;
  const ready = pictures !== null;
  useEffect(() => input.current?.focus(), [i, ready]);
  // On small screens the feedback can push the Next button below the edge; bring it into view.
  useEffect(() => {
    if (verdict) buttons.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [verdict]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (verdict) return next();
    const v = checkAnswer(value, word.en);
    const ok = v !== "wrong";
    setVerdict(v);
    setMessage(FEEDBACK[v](word));
    setAnswers([...answers, { word, correct: ok }]);
    const c = ok ? combo + 1 : 0;
    setCombo(c);
    setBestCombo(Math.max(bestCombo, c));
    if (ok) speak(word.en);
  }

  function next() {
    if (i + 1 >= round.length) return finish(answers, { bestCombo });
    setI(i + 1);
    setValue("");
    setVerdict(null);
    setHint(0);
  }

  const ok = verdict && verdict !== "wrong";

  // Wait for the pictures so the first word doesn't jump when its picture arrives.
  if (!ready) return <p className="mt-20 text-center text-xl">Loading... ✨</p>;

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-3 flex justify-between font-bold">
        <span>
          {i + 1} / {round.length}
        </span>
        {combo >= 2 && <span className="text-orange-500 animate-pop">🔥 x{combo}</span>}
      </div>

      <form onSubmit={submit} className={`card text-center ${verdict === "wrong" ? "animate-shake" : ""}`}>
        {!picture && <p className="text-xs font-bold uppercase text-purple-400">How do you say it in English?</p>}
        {picture && (
          // Square, as large as fits next to everything else on a laptop screen.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={picture.url}
            alt=""
            className="mx-auto aspect-square rounded-2xl object-cover shadow-md ring-4 ring-purple-100"
            style={{ width: "min(18rem, 30vh)" }}
          />
        )}
        <p className={`mt-3 font-black ${picture ? "text-3xl" : "text-4xl"}`}>{word.hu}</p>
        {clue && <p className="mt-1 italic text-purple-500">“{clue}”</p>}
        {hint > 0 && !verdict && <p className="mt-2 font-mono text-lg tracking-widest text-grape">{word.en.slice(0, hint)}…</p>}

        <input
          ref={input}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          readOnly={!!verdict}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          className={`input mt-4 text-center text-xl ${ok ? "border-mint bg-emerald-50" : verdict ? "border-bubble bg-pink-50" : ""}`}
          placeholder="Type here..."
        />

        {verdict && (
          <div className="mt-3 animate-pop">
            <p className={`text-xl font-black ${ok ? "text-mint" : "text-bubble"}`}>{message}</p>
            {verdict === "wrong" && (
              <p className="mt-1 text-lg">
                The answer is <b>{word.en}</b>
              </p>
            )}
          </div>
        )}

        <div ref={buttons} className="mt-4 flex justify-center gap-2">
          {!verdict && (
            <button type="button" className="btn-ghost" onClick={() => setHint(Math.min(hint + 1, word.en.length))}>
              💡 Hint
            </button>
          )}
          <button className="btn-primary">{verdict ? "Next → (Enter)" : "Check ✔️"}</button>
        </div>
      </form>
    </div>
  );
}
