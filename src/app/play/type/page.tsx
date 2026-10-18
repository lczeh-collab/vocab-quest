"use client";

import { useEffect, useRef, useState } from "react";
import GameShell, { speak, type Finish } from "@/components/GameShell";
import { checkAnswer, type Verdict } from "@/lib/check";
import { cheer, comfort } from "@/lib/gamification";
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

  const word = round[i];
  useEffect(() => input.current?.focus(), [i]);

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

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-3 flex justify-between font-bold">
        <span>
          {i + 1} / {round.length}
        </span>
        {combo >= 2 && <span className="text-orange-500 animate-pop">🔥 x{combo}</span>}
      </div>

      <form onSubmit={submit} className={`card text-center ${verdict === "wrong" ? "animate-shake" : ""}`}>
        <p className="text-xs font-bold uppercase text-purple-400">How do you say it in English?</p>
        <p className="mt-2 text-3xl font-black">{word.hu}</p>
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

        <div className="mt-4 flex justify-center gap-2">
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
