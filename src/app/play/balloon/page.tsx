"use client";

import { useEffect, useRef, useState } from "react";
import GameShell, { speak, type Finish } from "@/components/GameShell";
import { cheer, comfort } from "@/lib/gamification";
import { shuffle } from "@/lib/leitner";
import type { Answer, Word } from "@/lib/types";

export default function BalloonPage() {
  return (
    <GameShell game="balloon" title="🎈 Balloon Pop" size={12} minWords={4}>
      {(round, finish, allWords) => <BalloonPop round={round} finish={finish} allWords={allWords} />}
    </GameShell>
  );
}

const LIVES = 3;
const COLORS = ["bg-pink-400", "bg-sky-400", "bg-amber-300", "bg-emerald-400"];
const SHINE = "radial-gradient(circle at 30% 25%, rgba(255,255,255,0.75), transparent 35%)";

interface Question {
  word: Word;
  enFirst: boolean;
  options: Word[];
}

/** The right answer plus 3 other words whose answer text differs, so there is never a "second right" balloon. */
function buildQuestions(round: Word[], allWords: Word[]): Question[] {
  return round.map((word) => {
    const enFirst = Math.random() < 0.5;
    const answer = (w: Word) => (enFirst ? w.hu : w.en).trim().toLowerCase();
    const seen = new Set([answer(word)]);
    const distractors = shuffle(allWords).filter((w) => {
      if (w.id === word.id || seen.has(answer(w))) return false;
      seen.add(answer(w));
      return true;
    });
    return { word, enFirst, options: shuffle([word, ...distractors.slice(0, 3)]) };
  });
}

let audio: AudioContext | undefined;
function popSound(ok: boolean) {
  try {
    audio ??= new AudioContext();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    const t = audio.currentTime;
    osc.type = ok ? "square" : "triangle";
    osc.frequency.setValueAtTime(ok ? 700 : 220, t);
    osc.frequency.exponentialRampToValueAtTime(ok ? 90 : 70, t + (ok ? 0.12 : 0.35));
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + (ok ? 0.15 : 0.4));
    osc.connect(gain).connect(audio.destination);
    osc.start(t);
    osc.stop(t + 0.4);
  } catch {
    // No sound support: the game works silently.
  }
}

function BalloonPop({ round, finish, allWords }: { round: Word[]; finish: Finish; allWords: Word[] }) {
  const [questions] = useState(() => buildQuestions(round, allWords));
  const [q, setQ] = useState(0);
  const [lives, setLives] = useState(LIVES);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  // chosen = index of the clicked balloon, -1 if the right one escaped
  const [result, setResult] = useState<{ chosen: number; ok: boolean; message: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const { word, enFirst, options } = questions[q];
  const correctCount = answers.filter((a) => a.correct).length;
  // Balloons rise faster as she gets more right: 7s down to 3.5s.
  const duration = Math.max(3.5, 7 - correctCount * 0.35);

  function resolve(chosen: number) {
    if (result) return;
    const ok = chosen >= 0 && options[chosen].id === word.id;
    const nextAnswers = [...answers, { word, correct: ok }];
    const nextLives = ok ? lives : lives - 1;
    const c = ok ? combo + 1 : 0;
    const best = Math.max(bestCombo, c);

    popSound(ok);
    if (ok) speak(word.en);
    const answer = enFirst ? word.hu : word.en;
    setResult({ chosen, ok, message: ok ? cheer() : `${chosen < 0 ? "It flew away! 💨" : comfort()} It's “${answer}”` });
    setAnswers(nextAnswers);
    setLives(nextLives);
    setCombo(c);
    setBestCombo(best);

    timer.current = setTimeout(
      () => {
        if (nextLives === 0 || q + 1 >= questions.length) return finish(nextAnswers, { bestCombo: best });
        setResult(null);
        setQ(q + 1);
      },
      ok ? 900 : 1800,
    );
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const n = Number(e.key);
      if (n >= 1 && n <= options.length) resolve(n - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-3 flex items-center justify-between text-lg font-black">
        <span>
          {q + 1} / {questions.length}
        </span>
        {combo >= 2 && <span className="text-orange-500 animate-pop">🔥 x{combo}</span>}
        <span aria-label={`${lives} lives`}>{"❤️".repeat(lives) + "🤍".repeat(LIVES - lives)}</span>
      </div>

      <div className="card text-center">
        <p className="text-xs font-bold uppercase text-purple-400">Pop the {enFirst ? "Hungarian" : "English"} meaning of</p>
        <p className="mt-1 text-3xl font-black">{enFirst ? word.en : word.hu}</p>
        <p className={`mt-1 h-7 text-xl font-black ${result?.ok ? "text-mint" : "text-bubble"}`}>
          {result && <span className="animate-pop inline-block">{result.message}</span>}
        </p>
      </div>

      <div
        key={q}
        className="relative mt-4 h-[460px] overflow-hidden rounded-3xl bg-gradient-to-b from-sky-200 via-sky-100 to-white shadow-inner ring-1 ring-sky-200"
      >
        <span className="absolute left-[8%] top-10 text-5xl opacity-70">☁️</span>
        <span className="absolute right-[12%] top-28 text-6xl opacity-60">☁️</span>

        {options.map((opt, i) => {
          const isRight = opt.id === word.id;
          const popped = result?.chosen === i;
          const reveal = result && !result.ok && isRight;
          return (
            <button
              key={opt.id}
              onClick={() => resolve(i)}
              onAnimationEnd={(e) => e.animationName === "rise" && isRight && resolve(-1)}
              className="absolute top-full w-[21%] animate-rise focus:outline-none"
              style={{
                left: `${3 + i * 24.5}%`,
                animationDuration: `${duration}s`,
                animationDelay: `${[0, 0.5, 0.2, 0.7][i]}s`,
                animationPlayState: result ? "paused" : "running",
              }}
            >
              <div className={popped && result?.ok ? "animate-burst" : "animate-sway"}>
                <div
                  className={`relative mx-auto flex h-36 w-full max-w-36 items-center justify-center rounded-[50%] p-3 font-black text-white shadow-lg transition ${
                    reveal ? "bg-mint ring-8 ring-emerald-200" : popped && !result?.ok ? "bg-gray-400 opacity-60" : COLORS[i]
                  } ${!result ? "hover:scale-105" : ""}`}
                  style={{ backgroundImage: SHINE }}
                >
                  <span className="break-words text-base leading-tight drop-shadow sm:text-lg">{enFirst ? opt.hu : opt.en}</span>
                  <span className="absolute -top-1 left-1 rounded-full bg-white/80 px-2 text-xs text-ink">{i + 1}</span>
                </div>
                <div className="mx-auto h-0 w-0 border-x-[6px] border-t-[8px] border-x-transparent border-t-white/70" />
                <div className="mx-auto h-16 w-px bg-gray-400" />
              </div>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-center text-sm text-purple-400">Click a balloon or press 1–4. They get faster as you go! 🎈</p>
    </div>
  );
}
